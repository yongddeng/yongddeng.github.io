'use strict';

// ---- what every maths figure shares (maths.html loads it, then a post's own file) ----
// A figure is FIGS['2NN/name'] = el => { ... }, drawn into an empty div of
// the iframe's width: one canvas and, if it moves, one .fig-row of controls,
// most often ending in an exact reading
const FIGS = {};
const DPR = Math.min(2, window.devicePixelRatio || 1);
const COL = { ink: '#000080', tail: '#c25b00', bad: '#a40000', mute: '#4d4852', grid: '#e3e0e5', frame: '#808080', paper: '#ffffff', pale: '#e8e8f4', black: '#000000' };
const FONT = '11px "Helvetica Neue", Arial, sans-serif';
const SERIF = '13px Georgia, "Times New Roman", serif';

// ---- the page: a canvas, a row of controls ----
// a canvas of w × h css pixels appended to el, and its context at device pixels
function canvas(el, w, h) {
	const cv = document.createElement('canvas');
	cv.width = Math.round(w * DPR);
	cv.height = Math.round(h * DPR);
	cv.style.width = w + 'px';
	cv.style.height = h + 'px';
	el.appendChild(cv);
	const c = cv.getContext('2d');
	c.setTransform(DPR, 0, 0, DPR, 0, 0);
	return c;
}
function figRow(el) {
	const row = document.createElement('div');
	row.className = 'fig-row';
	el.appendChild(row);
	return row;
}
// a labelled range input, then a <b> showing its value as show(v) writes it;
// onInput(v) runs when it moves, not here, so a figure draws once it is set up
function slider(row, label, min, max, value, onInput, { step = 1, show = String } = {}) {
	const lab = document.createElement('label');
	lab.textContent = label + ' ';
	const inp = document.createElement('input');
	inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = value;
	lab.appendChild(inp);
	row.appendChild(lab);
	const out = document.createElement('b');
	out.textContent = show(value);
	row.appendChild(out);
	inp.addEventListener('input', () => {
		out.textContent = show(+inp.value);
		onInput(+inp.value);
	});
	return inp;
}
function button(row, label, onClick) {
	const b = document.createElement('button');
	b.type = 'button';
	b.className = 'fig-btn';
	b.textContent = label;
	b.addEventListener('click', onClick);
	row.appendChild(b);
	return b;
}
// buttons of which one stays pressed, [key, label] each; the returned
// pick(key) presses one and calls onPick, as a click does
function presets(row, names, onPick) {
	const btns = names.map(([key, text]) => button(row, text, () => pick(key)));
	function pick(key) {
		btns.forEach((b, i) => b.setAttribute('aria-pressed', String(names[i][0] === key)));
		onPick(key);
	}
	return pick;
}
// a plain reading after the controls
function reading(row) {
	const s = document.createElement('span');
	row.appendChild(s);
	return s;
}
// ▶ Run, reading ❚❚ Pause while it runs, which calls frame(ms since the last
// frame) on every animation frame until frame returns false or it is paused
function runButton(row, frame) {
	let id = 0, last = 0;
	const stop = () => {
		cancelAnimationFrame(id);
		id = 0;
		b.textContent = '▶ Run';
	};
	const tick = now => {
		const more = frame(now - last);
		last = now;
		// a frame that stopped the run, itself or through a control it moved
		if (!id) return;
		if (more) id = requestAnimationFrame(tick);
		else stop();
	};
	const b = button(row, '▶ Run', () => {
		if (id) stop();
		else {
			b.textContent = '❚❚ Pause';
			last = performance.now();
			id = requestAnimationFrame(tick);
		}
	});
	b.classList.add('fig-run');
	return { stop };
}

// ---- drawing ----
// a plot box { x0, x1, y0 (bottom), y1 (top) } with maps X and Y from data to pixels
function plotBox(x0, x1, y0, y1, [a, b], [lo, hi]) {
	return { x0, x1, y0, y1, X: t => x0 + (t - a) / (b - a) * (x1 - x0), Y: v => y0 - (v - lo) / (hi - lo) * (y0 - y1) };
}
function frameBox(c, P) {
	c.strokeStyle = COL.frame;
	c.lineWidth = 1;
	c.strokeRect(P.x0 - 0.5, P.y1 - 0.5, P.x1 - P.x0 + 1, P.y0 - P.y1 + 1);
}
// a polyline through [x, y] pixel pairs
function polyline(c, pts) {
	c.beginPath();
	pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
	c.stroke();
}
function label(c, text, x, y, align = 'left', colour = COL.mute, font = FONT) {
	c.fillStyle = colour;
	c.font = font;
	c.textAlign = align;
	c.fillText(text, x, y);
}
// 1/d when v is the reciprocal of a whole number d, else three decimals
const frac = v => {
	if (v === 1) return '1';
	const d = Math.round(1 / v);
	return Math.abs(1 / d - v) < 1e-12 ? `1/${d}` : v.toFixed(3);
};
const minus = s => String(s).replace(/-/g, '−');

// ---- 3D: a view that turns under the pointer ----
// z is up. The view turns by yaw about z round the centre, then tilts by pitch
// towards the viewer, and v.at(p) projects a point orthographically to
// [x, y, depth] with depth larger nearer. onTurn redraws at every move of a
// drag, and v.curve(pts, colour, width) draws in the context c
function view3d(c, { W, H, scale, yaw = -0.55, pitch = 0.42, centre = [0, 0, 0] }, onTurn) {
	const v = { yaw, pitch };
	v.at = p => {
		const [x, y, z] = p.map((q, i) => q - centre[i]);
		const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
		const x1 = cy * x - sy * y, y1 = sy * x + cy * y;
		return [W / 2 + scale * x1, H / 2 - scale * (z * cp + y1 * sp), -y1 * cp + z * sp];
	};
	// a polyline in space, each segment as dark as it is near, in twelve shades
	// over the ±1.4 of depth round the centre a figure spans; a run of segments
	// of one shade is one stroke
	const shade = p => Math.round(12 * Math.min(1, Math.max(0, (p[2] + 1.4) / 2.8)));
	v.curve = (pts, colour, width = 1.2) => {
		const ps = pts.map(v.at);
		c.strokeStyle = colour;
		c.lineWidth = width;
		for (let i = 1; i < ps.length;) {
			const s = shade(ps[i]);
			c.globalAlpha = 0.25 + 0.75 * s / 12;
			c.beginPath();
			c.moveTo(ps[i - 1][0], ps[i - 1][1]);
			for (; i < ps.length && shade(ps[i]) === s; i++) c.lineTo(ps[i][0], ps[i][1]);
			c.stroke();
		}
		c.globalAlpha = 1;
	};
	const cv = c.canvas;
	cv.classList.add('turn');
	// one pointer turns it, so a second finger cannot make it jump
	let from = null;
	cv.addEventListener('pointerdown', e => {
		if (!e.isPrimary) return;
		from = [e.clientX, e.clientY];
		cv.setPointerCapture(e.pointerId);
	});
	cv.addEventListener('lostpointercapture', () => { from = null; });
	cv.addEventListener('pointermove', e => {
		if (!from || !e.isPrimary) return;
		v.yaw += (e.clientX - from[0]) * 0.01;
		v.pitch = Math.max(-0.2, Math.min(1.45, v.pitch + (e.clientY - from[1]) * 0.01));
		from = [e.clientX, e.clientY];
		onTurn();
	});
	return v;
}

// ---- numbers ----
// a seeded uniform on [0, 1) (mulberry32), so every redraw is reproducible
function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
// a standard normal from a uniform source, by Box-Muller
function gauss(u) {
	return Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
}
// Φ by Abramowitz and Stegun 7.1.26, and Φ⁻¹ by bisection on it
const erf = x => {
	const s = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
	return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
};
const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
// the standard normal density
const normalPdf = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
const PhiInv = u => { let lo = -8, hi = 8; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; Phi(m) < u ? lo = m : hi = m; } return (lo + hi) / 2; };
