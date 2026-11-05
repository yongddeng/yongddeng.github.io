// ---- 208. central limit theorem ----

// the summands, each a law on a lattice a + bk by its weights, the exponential,
// or one big coin of variance 3(n − 1) beside n − 1 fair ±1 coins
const lattice = (label, a, b, w) => {
	const mu = w.reduce((s, p, k) => s + p * (a + b * k), 0);
	const v = w.reduce((s, p, k) => s + p * (a + b * k - mu) ** 2, 0);
	const rho = w.reduce((s, p, k) => s + p * Math.abs(a + b * k - mu) ** 3, 0);
	return { label, a, b, w, mu, sigma: Math.sqrt(v), ratio: rho / v ** 1.5 };
};
const SUMMANDS = [
	lattice('coin', -1, 2, [0.5, 0.5]),
	lattice('p = 0.1', 0, 1, [0.9, 0.1]),
	lattice('die', 1, 1, [1, 1, 1, 1, 1, 1].map(x => x / 6)),
	{ label: 'exp', exp: true, ratio: 12 / Math.E - 2 },
	// at n = 1 the big coin is a fair one, whose ρ/σ³ is 1
	{ label: 'one big', big: true, ratio: 1 },
];
const logFact = [0];
for (let k = 1; k <= 400; k++) logFact.push(logFact[k - 1] + Math.log(k));
const binom = m => {
	const w = [2 ** -m];
	for (let j = 0; j < m; j++) w.push(w[j] * (m - j) / (j + 1));
	return w;
};
// the big coin's size b and the standard deviation s of the whole sum
const bigScale = n => {
	const b = n > 1 ? Math.sqrt(3 * (n - 1)) : 1;
	return { b, s: Math.sqrt(b * b + n - 1) };
};
// the law of Zₙ, as sorted atoms [z, p] with the bar width h, or as the gamma's density and cdf
function lawOf(sum, n) {
	if (sum.exp) {
		const rn = Math.sqrt(n);
		const logDens = x => (n - 1) * Math.log(x) - x - logFact[n - 1];
		return {
			density: z => { const x = n + z * rn; return x > 0 ? rn * Math.exp(logDens(x)) : 0; },
			cdf: z => {
				const x = n + z * rn;
				if (x <= 0) return 0;
				let tail = 0;
				for (let k = 0; k < n; k++) tail += Math.exp(-x + k * Math.log(x) - logFact[k]);
				return Math.max(0, 1 - tail);
			},
		};
	}
	if (sum.big) {
		const { b, s } = bigScale(n), w = binom(n - 1), atoms = [];
		w.forEach((p, j) => { for (const sign of [-1, 1]) atoms.push([(2 * j - (n - 1) + sign * b) / s, p / 2]); });
		atoms.sort((x, y) => x[0] - y[0]);
		return { atoms, h: 2 / s, binned: true };
	}
	let w = [1];
	for (let r = 0; r < n; r++) {
		const next = new Array(w.length + sum.w.length - 1).fill(0);
		w.forEach((p, i) => sum.w.forEach((q, j) => { next[i + j] += p * q; }));
		w = next;
	}
	const scale = sum.sigma * Math.sqrt(n);
	return { atoms: w.map((p, j) => [(n * sum.a + sum.b * j - n * sum.mu) / scale, p]), h: sum.b / scale };
}
// sup over z of |Fₙ(z) − Φ(z)|, exact at the atoms, on a fine grid for the gamma
function distance(law) {
	let d = 0;
	if (law.atoms) {
		let F = 0;
		for (const [z, p] of law.atoms) {
			const G = Phi(z);
			d = Math.max(d, Math.abs(F - G), Math.abs(F + p - G));
			F += p;
		}
		return d;
	}
	for (let z = -6; z <= 6; z += 0.004) d = Math.max(d, Math.abs(law.cdf(z) - Phi(z)));
	return d;
}
// the characteristic function of Zₙ at t, as [re, im]
function cfOf(sum, n, t) {
	if (sum.big) {
		const { b, s } = bigScale(n);
		return [Math.cos(b * t / s) * Math.cos(t / s) ** (n - 1), 0];
	}
	const u = t / Math.sqrt(n);
	let re, im;
	if (sum.exp) {
		// e^{−iu}/(1 − iu), the centred exponential
		const c = Math.cos(u), s = Math.sin(u), d = 1 + u * u;
		re = (c + u * s) / d;
		im = (c * u - s) / d;
	} else {
		re = 0; im = 0;
		sum.w.forEach((p, k) => { const x = u * (sum.a + sum.b * k - sum.mu) / sum.sigma; re += p * Math.cos(x); im += p * Math.sin(x); });
	}
	const r = Math.hypot(re, im) ** n, th = n * Math.atan2(im, re);
	return [r * Math.cos(th), r * Math.sin(th)];
}
// the preset buttons and the n slider every 208 figure shares
function controls(el, draw) {
	const row = figRow(el);
	const state = { sum: SUMMANDS[0], n: 10 };
	const pick = presets(row, SUMMANDS.map((sum, i) => [i, sum.label]), i => { state.sum = SUMMANDS[i]; draw(state); });
	slider(row, 'n', 1, 100, state.n, v => { state.n = v; draw(state); }, { show: v => String(v).padStart(3, ' ') });
	pick(0);
}
const W = 600;

// the exact law of Zₙ as bars of its probabilities, against the normal density
FIGS['208/law'] = el => {
	const H = 200;
	const c = canvas(el, W, H);
	const P = plotBox(34, W - 12, H - 22, 30, [-4, 4], [0, 0.7]);
	const Y = v => P.Y(Math.min(0.7, v));
	controls(el, ({ sum, n }) => {
		const law = lawOf(sum, n);
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		c.fillStyle = COL.pale;
		c.strokeStyle = COL.ink;
		c.lineWidth = 1;
		if (law.atoms) {
			// bars of width h and area p, or bins of width h when the atoms sit on two lattices
			let bars = law.atoms;
			if (law.binned) {
				const bins = new Map();
				for (const [z, p] of law.atoms) { const k = Math.floor(z / law.h + 0.5); bins.set(k, (bins.get(k) || 0) + p); }
				bars = [...bins].map(([k, p]) => [k * law.h, p]);
			}
			const thin = (P.X(law.h) - P.X(0)) < 4;
			for (const [z, p] of bars) {
				const x0 = P.X(z - law.h / 2), x1 = P.X(z + law.h / 2);
				if (x1 < P.x0 || x0 > P.x1) continue;
				const l = Math.max(P.x0, x0), r = Math.min(P.x1, x1), y = Y(p / law.h);
				c.fillRect(l, y, r - l, P.y0 - y);
				if (!thin) c.strokeRect(l + 0.5, y + 0.5, r - l - 1, P.y0 - y - 0.5);
			}
		} else {
			const pts = [];
			for (let px = P.x0; px <= P.x1; px++) pts.push([px, Y(law.density(-4 + (px - P.x0) / (P.x1 - P.x0) * 8))]);
			c.beginPath();
			c.moveTo(P.x0, P.y0);
			pts.forEach(([x, y]) => c.lineTo(x, y));
			c.lineTo(P.x1, P.y0);
			c.fill();
			polyline(c, pts);
		}
		// the standard normal density
		const normal = [];
		for (let px = P.x0; px <= P.x1; px++) { const z = -4 + (px - P.x0) / (P.x1 - P.x0) * 8; normal.push([px, Y(normalPdf(z))]); }
		c.strokeStyle = COL.tail;
		c.lineWidth = 2;
		c.setLineDash([5, 3]);
		polyline(c, normal);
		c.setLineDash([]);
		frameBox(c, P);
		for (const z of [-4, -2, 0, 2, 4]) label(c, minus(z), P.X(z), P.y0 + 13, 'center');
		label(c, 'z', P.x1, P.y0 + 13, 'right');
		label(c, 'normal', P.X(0.45), Y(0.4) - 2, 'left', COL.tail);
		const d = distance(law);
		const text = sum.big && n > 1
			? `sup |Fₙ − Φ| = ${d.toFixed(3)} · one summand holds ¾ of the variance, so the Berry-Esseen bound does not vanish`
			: `sup |Fₙ − Φ| = ${d.toFixed(3)} ≤ 0.4748 ρ/σ³√n = ${(0.4748 * sum.ratio / Math.sqrt(n)).toFixed(3)}`;
		label(c, text, P.x0, 18, 'left', COL.black);
	});
};

// the characteristic function of Zₙ for t ≥ 0 as a curve in (t, Re, Im), against
// e^{−t²/2} in the real plane, and where a lattice law returns to the unit circle
FIGS['208/cf'] = el => {
	const H = 260, T = 15;
	const c = canvas(el, W, H);
	// t across, the real part up, the imaginary part into the screen
	const pt = (t, re, im) => [(t / T - 0.5) * 5, im, re];
	let shown;
	const view = view3d(c, { W, H, scale: 76, yaw: -0.3, pitch: 0.32, centre: [0, 0, 0.12] }, () => draw(shown));
	function draw(state) {
		shown = state;
		const { sum, n } = state;
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		view.curve([pt(0, 0, 0), pt(T, 0, 0)], COL.frame, 1);
		for (const t of [0, 3, 6, 9, 12, 15]) {
			const [x, y] = view.at(pt(t, 0, 0));
			label(c, String(t), x, y + 14, 'center');
		}
		view.curve([pt(0, -1, 0), pt(0, 1, 0)], COL.grid, 1);
		view.curve([pt(0, 0, -1), pt(0, 0, 1)], COL.grid, 1);
		for (const [p, name] of [[pt(T, 0, 0), 't'], [pt(0, 1.12, 0), 'Re'], [pt(0, 0, 1.12), 'Im']]) {
			const [x, y] = view.at(p);
			label(c, name, x + 5, y + 4);
		}
		// where a lattice law's characteristic function returns to modulus 1
		if (!sum.big && !sum.exp) {
			const t = 2 * Math.PI * sum.sigma * Math.sqrt(n) / sum.b;
			if (t <= T) {
				const ring = [];
				for (let j = 0; j <= 64; j++) ring.push(pt(t, Math.cos(j * Math.PI / 32), Math.sin(j * Math.PI / 32)));
				view.curve(ring, COL.bad, 1);
				const [x, y] = view.at(pt(t, 1, 0));
				label(c, '2π/h', x, y - 6, 'center', COL.bad);
			}
		}
		const bell = [], curve = [];
		let gap = 0;
		for (let j = 0; j <= 600; j++) {
			const t = j / 600 * T, [a, b] = cfOf(sum, n, t), g = Math.exp(-t * t / 2);
			bell.push(pt(t, g, 0));
			curve.push(pt(t, a, b));
			if (t <= 3) gap = Math.max(gap, Math.hypot(a - g, b));
		}
		view.curve(bell, COL.tail, 2);
		view.curve(curve, COL.ink, 1.4);
		const [x, y] = view.at(pt(1.3, 0.62, 0));
		label(c, 'exp(−t²/2)', x + 4, y, 'left', COL.tail);
		label(c, `max over 0 ≤ t ≤ 3 of |φₙ(t) − exp(−t²/2)| = ${gap.toFixed(4)}`, 10, 18, 'left', COL.black);
	}
	controls(el, draw);
};
