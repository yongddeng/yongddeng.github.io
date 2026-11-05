// ---- 210. stochastic process ----

// small digits for canvas labels
const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉', SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const subN = n => String(n).replace(/\d/g, d => SUB_DIGITS[d]);
const supN = n => String(n).replace(/\d/g, d => SUP_DIGITS[d]);

// sample paths of the walk and of the autoregression along the floor, and over
// them the law of the value at each time as a surface, with its slices at time
// 5 and at time t in orange
FIGS['210/slices'] = el => {
	const W = 600, H = 260, N = 60, PATHS = 24, S = 5, PHI = 0.8;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const NORMAL = [];
	for (let y = -3.2; y <= 3.2001; y += 0.1) NORMAL.push([y, normalPdf(y)]);
	const KIND = {
		walk: {
			lim: 18, ticks: [-15, 0, 15],
			start: () => 0,
			step: (x, u) => x + (u() < 0.5 ? 1 : -1),
			// the atoms (2k − t, P(Sₜ = 2k − t)/2), a density on the lattice of step 2
			law: t => {
				const pts = [];
				let w = 2 ** -t;
				for (let k = 0; k <= t; k++) { pts.push([2 * k - t, w / 2]); w = w * (t - k) / (k + 1); }
				return pts;
			},
			text: t => [`Var Sₜ = t = ${t}`, t > S ? `Sₜ − S₅ has the law of S${subN(t - S)}` : 'stationary increments, Sₜ not stationary'],
		},
		ar: {
			lim: 3.2, ticks: [-2, 0, 2],
			start: u => gauss(u),
			step: (x, u) => PHI * x + Math.sqrt(1 - PHI * PHI) * gauss(u),
			// N(0, 1) at every time
			law: () => NORMAL,
			text: t => {
				const r = PHI ** Math.abs(t - S);
				return ['Xₜ ∼ N(0, 1) for every t', `Cov(Xₜ, X₅) = ${PHI}${supN(Math.abs(t - S))} = ${r < 0.01 ? minus(r.toExponential(1)) : r.toFixed(3)}`];
			},
		},
	};
	let kind = 'walk', seed = 210, paths = [], t = 40;
	// the value across, time into the screen and the density up, scaled to keep
	// its area and cut at a ceiling where the walk's early laws are tall
	const pt = (s, y, d) => {
		const lim = KIND[kind].lim;
		return [y / lim * 1.6, (s / N - 0.5) * 2.4, Math.min(3, d * lim) * 0.4 - 0.5];
	};
	const view = view3d(c, { W, H, scale: 92, yaw: -0.95, pitch: 0.38, centre: [0, 0, -0.08] }, draw);
	function sample() {
		const u = rng(seed), k = KIND[kind];
		paths = [];
		for (let p = 0; p < PATHS; p++) {
			const x = [k.start(u)];
			for (let s = 1; s <= N; s++) x.push(k.step(x[s - 1], u));
			paths.push(x);
		}
	}
	function draw() {
		const k = KIND[kind];
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		// the floor's frame and ticks
		view.curve([pt(0, -k.lim, 0), pt(0, k.lim, 0), pt(N, k.lim, 0), pt(N, -k.lim, 0), pt(0, -k.lim, 0)], COL.frame, 1);
		for (const v of k.ticks) {
			const [x, y] = view.at(pt(0, v, 0));
			label(c, minus(v), x, y + 14, 'center');
		}
		for (const s of [20, 40, 60]) {
			const [x, y] = view.at(pt(s, -k.lim, 0));
			label(c, String(s), x - 5, y + 4, 'right');
		}
		const [tx, ty] = view.at(pt(N, -k.lim, 0));
		label(c, 't', tx - 5, ty - 8, 'right');
		// the paths, segment by segment while both ends are inside the frame
		for (const x of paths) {
			for (let s = 1; s <= N; s++) {
				if (Math.abs(x[s - 1]) <= k.lim && Math.abs(x[s]) <= k.lim) view.curve([pt(s - 1, x[s - 1], 0), pt(s, x[s], 0)], COL.frame, 0.7);
			}
		}
		// the surface, a slice at every other time
		const slice = s => k.law(s).filter(([y]) => Math.abs(y) <= k.lim).map(([y, d]) => pt(s, y, d));
		for (let s = 2; s <= N; s += 2) view.curve(slice(s), 'rgba(0, 0, 128, 0.4)', 0.8);
		// the slices at 5 and at t, and the paths' values there
		for (const [s, width] of [[S, 1.2], [t, 2.2]]) {
			view.curve(slice(s), COL.tail, width);
			c.fillStyle = COL.ink;
			for (const x of paths) {
				if (Math.abs(x[s]) > k.lim) continue;
				const [px, py] = view.at(pt(s, x[s], 0));
				c.fillRect(px - 1.5, py - 1.5, 3, 3);
			}
		}
		const [a, b] = k.text(t);
		label(c, a, 10, 16, 'left', COL.black);
		label(c, b, 210, 16, 'left', COL.ink);
	}
	const pick = presets(row, [['walk', 'Walk'], ['ar', 'AR(1)']], key => { kind = key; sample(); draw(); });
	button(row, 'Resample', () => { seed += 1; sample(); draw(); });
	const tIn = slider(row, 't', 1, N, t, v => { t = v; draw(); }, { show: v => String(v).padStart(2, ' ') });
	// Run moves t along through its slider, a step every 80 ms, from 1 again once at the end
	let wait = 0;
	runButton(row, dt => {
		wait += dt;
		if (wait < 80) return true;
		wait = 0;
		tIn.value = t >= N ? 1 : t + 1;
		tIn.dispatchEvent(new Event('input'));
		return t < N;
	});
	pick('walk');
};

// one long path and its running time average, against the ensemble average,
// for a mean-ergodic autoregression and a stationary random level that is not
FIGS['210/ergodic'] = el => {
	const W = 600, H = 210, N = 1000, PHI = 0.9;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const KIND = {
		ar: {
			gamma: k => PHI ** k,
			path: u => {
				const x = [gauss(u)];
				for (let t = 1; t < N; t++) x.push(PHI * x[t - 1] + Math.sqrt(1 - PHI * PHI) * gauss(u));
				return { x, z: null };
			},
		},
		level: {
			gamma: k => k === 0 ? 2 : 1,
			path: u => {
				const z = gauss(u), x = [];
				for (let t = 0; t < N; t++) x.push(z + gauss(u));
				return { x, z };
			},
		},
	};
	let kind = 'ar', seed = 2100, run = null, varMean = null;
	// Var X̄ₙ = n⁻²(n γ(0) + 2 Σₖ₌₁ⁿ⁻¹ (n − k) γ(k)), and the Cesàro mean of γ
	function exact() {
		const g = KIND[kind].gamma;
		varMean = new Float64Array(N + 1);
		let s1 = 0, s2 = 0;
		for (let n = 1; n <= N; n++) {
			if (n > 1) { s1 += g(n - 1); s2 += (n - 1) * g(n - 1); }
			varMean[n] = (n * g(0) + 2 * (n * s1 - s2)) / (n * n);
		}
	}
	function sample() {
		run = KIND[kind].path(rng(seed));
		let acc = 0;
		run.mean = run.x.map((v, i) => (acc += v) / (i + 1));
	}
	const cesaro = n => { let s = 0; for (let k = 0; k < n; k++) s += KIND[kind].gamma(k); return s / n; };
	function draw() {
		const LX = n => 40 + Math.log10(n) / 3 * 460;
		const top = plotBox(40, 500, 58, 20, [0, 1], [-4.5, 4.5]);
		const P = plotBox(40, 500, 186, 72, [0, 1], [-2.5, 2.5]);
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		// the path itself, a thin strip on the same log scale
		frameBox(c, top);
		c.save();
		c.beginPath(); c.rect(top.x0, top.y1, top.x1 - top.x0, top.y0 - top.y1); c.clip();
		c.strokeStyle = 'rgba(0, 0, 128, 0.45)';
		c.lineWidth = 1;
		polyline(c, run.x.map((v, i) => [LX(i + 1), top.Y(v)]));
		c.restore();
		label(c, 'Xₜ', top.x0 - 5, (top.y0 + top.y1) / 2 + 4, 'right');
		// the band μ ± 2 sd(X̄ₙ) and the ensemble mean μ = 0
		c.fillStyle = COL.pale;
		c.beginPath();
		for (let n = 1; n <= N; n++) c.lineTo(LX(n), P.Y(Math.min(2.5, 2 * Math.sqrt(varMean[n]))));
		for (let n = N; n >= 1; n--) c.lineTo(LX(n), P.Y(Math.max(-2.5, -2 * Math.sqrt(varMean[n]))));
		c.closePath();
		c.fill();
		frameBox(c, P);
		c.strokeStyle = COL.tail;
		c.lineWidth = 1.5;
		c.setLineDash([5, 3]);
		polyline(c, [[P.x0, P.Y(0)], [P.x1, P.Y(0)]]);
		c.setLineDash([]);
		label(c, 'μ = 0', P.x1 + 6, P.Y(0) + 4, 'left', COL.tail);
		if (run.z !== null) {
			const zc = Math.max(-2.5, Math.min(2.5, run.z));
			c.strokeStyle = COL.bad;
			c.setLineDash([2, 3]);
			polyline(c, [[P.x0, P.Y(zc)], [P.x1, P.Y(zc)]]);
			c.setLineDash([]);
			label(c, `Z = ${minus(run.z.toFixed(2))}`, P.x1 + 6, P.Y(zc) + (Math.abs(zc) < 0.4 ? (zc < 0 ? 14 : -6) : 4), 'left', COL.bad);
		}
		c.save();
		c.beginPath(); c.rect(P.x0, P.y1, P.x1 - P.x0, P.y0 - P.y1); c.clip();
		c.strokeStyle = COL.black;
		c.lineWidth = 1.4;
		polyline(c, run.mean.map((v, i) => [LX(i + 1), P.Y(v)]));
		c.restore();
		for (const v of [-2, 0, 2]) label(c, minus(v), P.x0 - 5, P.Y(v) + 4, 'right');
		label(c, 'X̄ₙ', P.x0 - 5, P.Y(1) + 4, 'right', COL.black);
		for (const [n, s] of [[1, '1'], [10, '10'], [100, '100'], [1000, '1000']]) label(c, s, LX(n), P.y0 + 13, 'center');
		label(c, 'n →', P.x1 + 18, P.y0 + 13);
		label(c, kind === 'ar' ? 'γ(k) = 0.9ᵏ → 0, so X̄ₙ → μ' : 'γ(k) = Var Z = 1 for k ≠ 0, so X̄ₙ → Z', P.x0, 12, 'left', COL.black);
	}
	const show = () => {
		draw();
		out.innerHTML = `X̄<sub>1000</sub> = ${minus(run.mean[N - 1].toFixed(3))} · n<sup>−1</sup>Σ<sub>k&lt;n</sub>γ(k) = ${cesaro(N).toFixed(4)}`;
	};
	const pick = presets(row, [['ar', 'AR(1)'], ['level', 'Random level']], key => { kind = key; exact(); sample(); show(); });
	button(row, 'Resample', () => { seed += 1; sample(); show(); });
	const out = reading(row);
	pick('ar');
};
