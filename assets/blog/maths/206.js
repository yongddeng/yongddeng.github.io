// ---- 206. mode of convergence ----

// the reciprocal of d as a reading
const frac = d => d === 1 ? '1' : `1/${d}`;
// the ω × n raster for a sequence on [0, 1), with Aₙ and Tₙ as bars
const lev = n => Math.floor(Math.log2(n));
const RASTER = {
	typewriter: {
		value: (n, w) => Math.floor(w * 2 ** lev(n)) === n - 2 ** lev(n) ? 1 : 0,
		last: () => Infinity,
		start: 21,
		read: n => `P(A<sub>n</sub>) = ${frac(2 ** lev(n))} · P(T<sub>n</sub>) = 1 · E X<sub>n</sub> = ${frac(2 ** lev(n))}`,
	},
	spikes: {
		value: (n, w) => w < 1 / n ? n : 0,
		last: w => Math.ceil(1 / w) - 1,
		start: 6,
		read: n => `P(A<sub>n</sub>) = ${frac(n)} · P(T<sub>n</sub>) = ${frac(n)} · E X<sub>n</sub> = 1`,
	},
};
function rasterFig(el, seq) {
	const N = 64, ROWS = 128, W = 460, H = 206;
	const G = { x0: 74, y0: 14, w: 320, h: 160 };
	const c = canvas(el, W, H);
	const off = document.createElement('canvas');
	off.width = N; off.height = ROWS;
	const img = off.getContext('2d').createImageData(N, ROWS);
	const lastRow = new Float64Array(ROWS), over = new Uint8Array(ROWS * (N + 1));
	for (let r = 0; r < ROWS; r++) {
		const w = (r + 0.5) / ROWS;
		lastRow[r] = seq.last(w);
		for (let n = 1; n <= N; n++) {
			const on = seq.value(n, w) > 0.5;
			over[r * (N + 1) + n] = on ? 1 : 0;
			const k = 4 * ((ROWS - 1 - r) * N + n - 1);
			const col = on ? [0, 0, 128] : [255, 255, 255];
			img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
		}
	}
	off.getContext('2d').putImageData(img, 0, 0);
	const colW = G.w / N, colX = n => G.x0 + (n - 1) * colW;
	const row = figRow(el);
	function draw(n) {
		clear(c);
		c.imageSmoothingEnabled = false;
		c.drawImage(off, G.x0, G.y0, G.w, G.h);
		c.fillStyle = 'rgba(255, 255, 255, 0.7)';
		c.fillRect(G.x0, G.y0, colX(n) - G.x0, G.h);
		c.strokeStyle = COL.frame;
		c.lineWidth = 1;
		c.strokeRect(G.x0 - 0.5, G.y0 - 0.5, G.w + 1, G.h + 1);
		c.strokeStyle = COL.black;
		c.strokeRect(Math.round(colX(n)) - 1.5, G.y0 - 4.5, colW + 2, G.h + 9);
		const bar = (x, inSet, colour, name) => {
			c.fillStyle = COL.paper;
			c.fillRect(x, G.y0, 11, G.h);
			c.fillStyle = colour;
			const rh = G.h / ROWS;
			for (let r = 0; r < ROWS; r++) if (inSet(r)) c.fillRect(x, G.y0 + (ROWS - 1 - r) * rh, 11, rh + 0.05);
			c.strokeStyle = COL.frame;
			c.strokeRect(x - 0.5, G.y0 - 0.5, 12, G.h + 1);
			label(c, name, x + 6, G.y0 + G.h + 14, 'center', colour);
		};
		bar(28, r => over[r * (N + 1) + n], COL.ink, 'Aₙ');
		bar(46, r => lastRow[r] >= n, COL.tail, 'Tₙ');
		label(c, '1', 22, G.y0 + 9, 'right');
		label(c, '0', 22, G.y0 + G.h, 'right');
		label(c, 'ω', 22, G.y0 + G.h / 2 + 4, 'right');
		for (const m of [1, 16, 32, 48]) label(c, String(m), colX(m) + colW / 2, G.y0 + G.h + 14, 'center');
		label(c, '64', G.x0 + G.w, G.y0 + G.h + 14, 'right');
		label(c, 'n →', G.x0 + G.w + 8, G.y0 + G.h + 14);
		label(c, 'dark where', G.x0 + G.w + 10, G.y0 + 12, 'left', COL.ink);
		label(c, 'Xₙ(ω) > ε', G.x0 + G.w + 10, G.y0 + 26, 'left', COL.ink);
		label(c, 'faded', G.x0 + G.w + 10, G.y0 + 50);
		label(c, 'before n', G.x0 + G.w + 10, G.y0 + 64);
		readEl.innerHTML = seq.read(n);
	}
	slider(row, 'n', 1, N, seq.start, draw, { show: n => String(n).padStart(2, ' ') });
	const readEl = reading(row);
	draw(seq.start);
}
FIGS['206/typewriter'] = el => rasterFig(el, RASTER.typewriter);
FIGS['206/spikes'] = el => rasterFig(el, RASTER.spikes);

// the quantile functions of Sₙ/√n against Φ⁻¹, on (0, 1)
FIGS['206/quantile'] = el => {
	const W = 460, H = 206, YMAX = 3;
	const P = plotBox(34, 446, 186, 10, [0, 1], [-YMAX, YMAX]);
	const c = canvas(el, W, H);
	const row = figRow(el);
	const Y = v => P.Y(Math.max(-YMAX, Math.min(YMAX, v)));
	const normal = [];
	for (let px = P.x0 + 1; px < P.x1; px++) normal.push([px, Y(PhiInv(P.x(px)))]);
	function draw(n) {
		// the law of Sₙ/√n, its values (2k − n)/√n with binomial weights
		let acc = 0;
		const cdf = binom(n).map(w => (acc += w));
		const value = k => (2 * k - n) / Math.sqrt(n);
		const quant = u => { let k = 0; while (k < n && cdf[k] < u) k++; return value(k); };
		clear(c);
		c.strokeStyle = COL.grid;
		c.lineWidth = 1;
		for (const v of [-2, -1, 0, 1, 2]) { c.beginPath(); c.moveTo(P.x0, Math.round(Y(v)) + 0.5); c.lineTo(P.x1, Math.round(Y(v)) + 0.5); c.stroke(); }
		frameBox(c, P);
		for (const v of [-2, 0, 2]) label(c, minus(v), P.x0 - 5, Y(v) + 4, 'right');
		label(c, '0', P.x0, P.y0 + 13, 'center');
		label(c, 'ω', (P.x0 + P.x1) / 2, P.y0 + 13, 'center');
		label(c, '1', P.x1, P.y0 + 13, 'center');
		c.strokeStyle = COL.tail;
		c.lineWidth = 2;
		c.setLineDash([5, 3]);
		polyline(c, normal);
		c.setLineDash([]);
		c.strokeStyle = COL.black;
		c.lineWidth = 1.4;
		const pts = [];
		for (let px = P.x0 + 1; px < P.x1; px++) pts.push([px, Y(quant(P.x(px)))]);
		polyline(c, pts);
		label(c, 'Yₙ(ω), the quantile of Sₙ/√n', P.x0 + 8, P.y1 + 14, 'left', COL.black);
		label(c, 'Φ⁻¹(ω)', P.x0 + 8, P.y1 + 28, 'left', COL.tail);
	}
	slider(row, 'n', 1, 120, 6, draw, { show: n => String(n).padStart(3, ' ') + ' coins' });
	draw(6);
};
