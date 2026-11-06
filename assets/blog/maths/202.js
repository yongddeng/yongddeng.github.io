// ---- 202. random variable ----

// the binary digits of ω read in base 3 as digits 0 and 2
const cantorX = w => {
	let x = 0, t = 1;
	for (let k = 0; k < 32; k++) { w *= 2; const b = Math.floor(w); w -= b; t /= 3; x += 2 * b * t; }
	return x;
};
// the Cantor function, by the ternary digits of x
const cantorF = x => {
	if (x <= 0) return 0;
	if (x >= 1) return 1;
	let f = 0, h = 0.5;
	for (let k = 0; k < 40; k++) {
		x *= 3;
		const d = Math.floor(x);
		x -= d;
		if (d === 1) return f + h;
		f += h * d / 2;
		h /= 2;
	}
	return f;
};
const clip = x => Math.min(1, Math.max(0, x));
const STEPS = [[0, 0.3, 0], [0.3, 0.45, 2], [0.45, 0.8, 1], [0.8, 1, 0]];
const MAPS = {
	identity: { name: 'X(ω) = ω', X: w => w, F: clip, range: [0, 1] },
	tent: { name: 'X(ω) = 2 min(ω, 1 − ω)', X: w => 2 * Math.min(w, 1 - w), F: clip, range: [0, 1] },
	steps: { name: 'X a step function, atoms at 0, 1, 2', X: w => STEPS.find(([a, b]) => w >= a && w < b)[2], F: x => STEPS.reduce((s, [a, b, v]) => s + (v <= x ? b - a : 0), 0), range: [-0.5, 2.5] },
	Cantor: { name: 'binary digits of ω read in base 3', X: cantorX, F: cantorF, range: [0, 1] },
	normal: { name: 'X(ω) = Φ⁻¹(ω)', X: PhiInv, F: Phi, range: [-3, 3] },
};
// a random variable on Ω = [0, 1), the set {X ≤ x} under it, and the law it pushes forward
FIGS['202/law'] = el => {
	const W = 560, H = 210;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const sel = document.createElement('select');
	for (const k of Object.keys(MAPS)) {
		const o = document.createElement('option');
		o.value = k;
		o.textContent = k;
		sel.appendChild(o);
	}
	row.appendChild(sel);
	let map = MAPS.identity, t = 0.42, xs = [], L, R;
	// the map at the centre of each pixel of Ω, and the two panels for its range
	function prepare() {
		L = plotBox(34, 274, 158, 30, [0, 1], map.range);
		R = plotBox(346, 546, 158, 30, map.range, [0, 1]);
		xs = [];
		for (let i = 0; i < L.x1 - L.x0; i++) xs.push(map.X((i + 0.5) / (L.x1 - L.x0)));
	}
	function draw() {
		const [lo, hi] = map.range, x = lo + (hi - lo) * t, Fx = map.F(x);
		clear(c);
		frameBox(c, L);
		frameBox(c, R);
		label(c, map.name, L.x0, 14, 'left', COL.black);
		label(c, 'F(x) = P(X ≤ x)', R.x0, 14, 'left', COL.black);
		// the level x across Ω
		c.strokeStyle = COL.tail;
		c.lineWidth = 1;
		c.setLineDash([4, 3]);
		polyline(c, [[L.x0, L.Y(x)], [L.x1, L.Y(x)]]);
		polyline(c, [[R.X(x), R.y1], [R.X(x), R.y0]]);
		c.setLineDash([]);
		// the map, dark where X ≤ x, and the set {X ≤ x} as a bar under Ω
		for (let i = 0; i < xs.length; i++) {
			const v = xs[i], px = L.x0 + i + 0.5, inSet = v <= x;
			c.fillStyle = inSet ? COL.ink : '#b7b2ba';
			c.fillRect(px - 0.8, L.Y(v) - 0.8, 1.6, 1.6);
			if (inSet) c.fillRect(px - 0.5, L.y0 + 6, 1, 6);
		}
		c.strokeStyle = COL.frame;
		c.strokeRect(L.x0 - 0.5, L.y0 + 5.5, L.x1 - L.x0 + 1, 7);
		label(c, '0', L.x0, L.y0 + 26, 'center');
		label(c, 'ω', (L.x0 + L.x1) / 2, L.y0 + 26, 'center');
		label(c, '1', L.x1, L.y0 + 26, 'center');
		label(c, '{X ≤ x}', L.x1 + 6, L.y0 + 12, 'left', COL.ink);
		label(c, minus(lo), L.x0 - 5, L.y0 + 4, 'right');
		label(c, minus(hi), L.x0 - 5, L.y1 + 8, 'right');
		label(c, 'x', L.x0 - 5, L.Y(x) + 4, 'right', COL.tail);
		// the distribution function, and F(x) as a bar of the same length up its side
		c.strokeStyle = COL.black;
		c.lineWidth = 1.4;
		const pts = [];
		for (let px = R.x0; px <= R.x1; px++) pts.push([px, R.Y(map.F(R.x(px)))]);
		polyline(c, pts);
		c.fillStyle = COL.ink;
		c.fillRect(R.x0 - 12, R.Y(Fx), 6, R.Y(0) - R.Y(Fx));
		dot(c, R.X(x), R.Y(Fx), 3);
		label(c, minus(lo), R.x0, R.y0 + 13, 'center');
		label(c, minus(hi), R.x1, R.y0 + 13, 'center');
		label(c, 'x', R.X(x), R.y0 + 13, 'center', COL.tail);
		label(c, '1', R.x0 - 16, R.y1 + 8, 'right');
		label(c, '0', R.x0 - 16, R.y0, 'right');
		readEl.textContent = `x = ${minus(x.toFixed(2))} · P(X ≤ x) = ${Fx.toFixed(3)} = length of {X ≤ x}`;
	}
	sel.addEventListener('change', () => { map = MAPS[sel.value]; prepare(); draw(); });
	slider(row, 'x', 0, 200, 84, v => { t = v / 200; draw(); }, { show: () => '' });
	const readEl = reading(row);
	prepare();
	draw();
};
