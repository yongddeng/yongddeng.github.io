// ---- 205. characteristic function ----

// the Gil-Pelaez integral cut off at T, for ½N(0, 1) + ½δ₁, against F
FIGS['205/inversion'] = el => {
	const W = 460, H = 200;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const P = plotBox(34, 446, 184, 10, [-3, 3], [-0.08, 1.08]);
	// Si(z) = ∫₀^z sin u/u du on [0, 260] by the trapezoid rule, odd beyond
	const STEP = 0.01, N = 26000, si = new Float64Array(N + 1);
	for (let k = 1, prev = 1; k <= N; k++) {
		const u = k * STEP, cur = Math.sin(u) / u;
		si[k] = si[k - 1] + STEP * (prev + cur) / 2;
		prev = cur;
	}
	const Si = z => {
		const a = Math.abs(z), k = Math.min(N - 1, Math.floor(a / STEP)), f = a / STEP - k;
		const v = si[k] + f * (si[k + 1] - si[k]);
		return z < 0 ? -v : v;
	};
	// ∫₀^T e^(−t²/2) sin(tx)/t dt by Simpson's rule, the normal half of the law
	const normalPart = (x, T) => {
		const top = Math.min(T, 12), m = 240, h = top / m;
		let s = 0;
		for (let k = 0; k <= m; k++) {
			const t = k * h, f = t === 0 ? x : Math.exp(-t * t / 2) * Math.sin(t * x) / t;
			s += f * (k === 0 || k === m ? 1 : k % 2 ? 4 : 2);
		}
		return s * h / 3;
	};
	// Im(e^(−itx)φ(t)) = −½e^(−t²/2) sin tx + ½ sin t(1 − x), integrated against 1/t
	const FT = (x, T) => 0.5 + normalPart(x, T) / (2 * Math.PI) - Si(T * (1 - x)) / (2 * Math.PI);
	const F = x => 0.5 * Phi(x) + (x >= 1 ? 0.5 : 0);
	const mid = 0.5 * Phi(1) + 0.25;
	function draw(T) {
		clear(c);
		c.strokeStyle = COL.grid;
		c.lineWidth = 1;
		for (const v of [0, 0.25, 0.5, 0.75, 1]) polyline(c, [[P.x0, Math.round(P.Y(v)) + 0.5], [P.x1, Math.round(P.Y(v)) + 0.5]]);
		frameBox(c, P);
		// F itself, dashed, in two pieces either side of the atom
		c.strokeStyle = COL.tail;
		c.lineWidth = 2;
		c.setLineDash([5, 3]);
		for (const [lo, hi] of [[-3, 1 - 1e-9], [1, 3]]) {
			const pts = [];
			for (let i = 0; i <= 120; i++) { const x = lo + (hi - lo) * i / 120; pts.push([P.X(x), P.Y(F(x))]); }
			polyline(c, pts);
		}
		c.setLineDash([]);
		c.fillStyle = COL.tail;
		dot(c, P.X(1), P.Y(mid), 3.5);
		// the truncated integral, one value per pixel
		c.strokeStyle = COL.ink;
		c.lineWidth = 1.4;
		const pts = [];
		for (let px = P.x0; px <= P.x1; px++) pts.push([px, P.Y(Math.max(-0.08, Math.min(1.08, FT(P.x(px), T))))]);
		polyline(c, pts);
		for (const x of [-3, -2, -1, 0, 1, 2, 3]) label(c, minus(x), P.X(x), P.y0 + 13, 'center');
		for (const v of [0, 0.5, 1]) label(c, String(v), P.x0 - 5, P.Y(v) + 4, 'right');
		label(c, 'the integral cut off at T', P.x0 + 8, P.y1 + 14, 'left', COL.ink);
		label(c, 'F, and the midpoint at the atom', P.x0 + 8, P.y1 + 28, 'left', COL.tail);
		readEl.innerHTML = `F<sub>T</sub>(1) = ${FT(1, T).toFixed(3)}, midpoint ${mid.toFixed(3)}`;
	}
	slider(row, 'T', 1, 60, 4, draw, { show: T => String(T).padStart(2, ' ') });
	const readEl = reading(row);
	draw(4);
};

// φ of a standardised sum as a curve in ℂ for |t| ≤ 8, and its modulus against e^(−t²/2)
FIGS['205/curve'] = el => {
	const W = 460, H = 224, T = 8;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const L = plotBox(14, 204, 202, 12, [-1.08, 1.08], [-1.08, 1.08]);
	const R = plotBox(244, 452, 186, 12, [0, T], [0, 1.05]);
	// φₙ(t) as [re, im] for the sum of n summands, centred and scaled
	const LAWS = {
		Exponential: (n, t) => {
			// e^(−it√n)(1 − it/√n)^(−n)
			const u = t / Math.sqrt(n), r = (1 + u * u) ** (-n / 2), a = n * Math.atan(u) - t * Math.sqrt(n);
			return [r * Math.cos(a), r * Math.sin(a)];
		},
		Coin: (n, t) => {
			// e^(−itnp/s)(q + pe^(it/s))^n with p = 0.2 and s² = npq, a lattice of step 1/s
			const p = 0.2, s = Math.sqrt(n * p * (1 - p)), v = t / s;
			const re = 1 - p + p * Math.cos(v), im = p * Math.sin(v);
			const r = Math.hypot(re, im) ** n, a = n * Math.atan2(im, re) - t * n * p / s;
			return [r * Math.cos(a), r * Math.sin(a)];
		},
		Cauchy: (n, t) => [Math.exp(-Math.sqrt(n) * Math.abs(t)), 0],
	};
	let law = 'Exponential', n = 4;
	function draw() {
		const phi = LAWS[law];
		clear(c);
		// the plane, its unit circle and axes
		c.strokeStyle = COL.grid;
		c.lineWidth = 1;
		polyline(c, [[L.X(-1.08), L.Y(0)], [L.X(1.08), L.Y(0)]]);
		polyline(c, [[L.X(0), L.Y(-1.08)], [L.X(0), L.Y(1.08)]]);
		c.strokeStyle = COL.frame;
		c.beginPath();
		c.arc(L.X(0), L.Y(0), L.X(1) - L.X(0), 0, 2 * Math.PI);
		c.stroke();
		// the limit e^(−t²/2), the real segment (0, 1]
		c.strokeStyle = COL.tail;
		c.lineWidth = 4;
		polyline(c, [[L.X(0), L.Y(0)], [L.X(1), L.Y(0)]]);
		// the curve t ↦ φₙ(t)
		c.strokeStyle = COL.ink;
		c.lineWidth = 1.2;
		const pts = [];
		for (let i = 0; i <= 1600; i++) {
			const [re, im] = phi(n, -T + 2 * T * i / 1600);
			pts.push([L.X(re), L.Y(im)]);
		}
		polyline(c, pts);
		const [r1, i1] = phi(n, 1);
		c.fillStyle = COL.black;
		dot(c, L.X(r1), L.Y(i1), 3);
		label(c, 't = 1', L.X(r1) + 5, L.Y(i1) - 5, 'left', COL.black);
		label(c, '1', L.X(1) + 3, L.Y(0) + 12);
		label(c, 'i', L.X(0) + 4, L.Y(1) - 2);
		// the modulus against e^(−t²/2)
		frameBox(c, R);
		c.strokeStyle = COL.tail;
		c.lineWidth = 2;
		c.setLineDash([5, 3]);
		const bell = [];
		for (let px = R.x0; px <= R.x1; px++) { const t = R.x(px); bell.push([px, R.Y(Math.exp(-t * t / 2))]); }
		polyline(c, bell);
		c.setLineDash([]);
		c.strokeStyle = COL.ink;
		c.lineWidth = 1.4;
		const mod = [];
		let sup = 0;
		for (let px = R.x0; px <= R.x1; px++) {
			const t = R.x(px), [re, im] = phi(n, t);
			mod.push([px, R.Y(Math.hypot(re, im))]);
			sup = Math.max(sup, Math.hypot(re - Math.exp(-t * t / 2), im));
		}
		polyline(c, mod);
		for (const t of [0, 2, 4, 6, 8]) label(c, String(t), R.X(t), R.y0 + 13, 'center');
		label(c, '1', R.x0 - 5, R.Y(1) + 4, 'right');
		label(c, '0', R.x0 - 5, R.Y(0) + 4, 'right');
		label(c, '|φₙ(t)|', R.x1 - 4, R.y1 + 14, 'right', COL.ink);
		label(c, 'exp(−t²/2)', R.x1 - 4, R.y1 + 28, 'right', COL.tail);
		if (law === 'Coin') {
			// the first return of the modulus to 1, at 2π√(npq)
			const back = 2 * Math.PI * Math.sqrt(n * 0.16);
			if (back <= T) label(c, '↓ 2π√(npq)', R.X(back), R.y1 + 44, 'center', COL.bad);
		}
		label(c, `sup |φₙ − exp(−t²/2)| = ${sup.toFixed(3)}`, R.x0, R.y0 + 32, 'left', COL.black);
	}
	const pick = presets(row, Object.keys(LAWS).map(name => [name, name]), name => { law = name; draw(); });
	runSlider(row, slider(row, 'n', 1, 100, n, v => { n = v; draw(); }, { show: v => String(v).padStart(3, ' ') }));
	pick(law);
};
