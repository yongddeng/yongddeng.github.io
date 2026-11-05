// ---- 207. law of large number ----

// twelve running means on a logarithmic n axis, red when they leave μ ± ε late
const N = 10000, PATHS = 12, LATE = 1000;
// each law draws Xₙ at step n from a seeded uniform source u
const LAWS = {
	die: { label: 'die', mu: 3.5, span: 2.5, draw: u => 1 + Math.floor(6 * u()) },
	jumps: { label: '±n', mu: 0, span: 1.5, draw: (u, n) => n < 2 || u() >= 1 / (n * Math.log(n)) ? 0 : (u() < 0.5 ? n : -n) },
	cauchy: { label: 'Cauchy', mu: 0, span: 3, draw: u => Math.tan(Math.PI * (u() - 0.5)) },
};
FIGS['207/means'] = el => {
	const W = 600, H = 220;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const P = { x0: 40, x1: W - 14, y0: H - 24, y1: 30 };
	const X = n => P.x0 + Math.log10(n) / Math.log10(N) * (P.x1 - P.x0);
	let law = LAWS.die, seed = 207, eps = 0.2, means = [];
	function sample() {
		means = [];
		for (let p = 0; p < PATHS; p++) {
			const u = rng(seed * 101 + p);
			const m = new Float64Array(N + 1);
			let s = 0;
			for (let n = 1; n <= N; n++) { s += law.draw(u, n); m[n] = s / n; }
			means.push(m);
		}
	}
	function draw() {
		const lo = law.mu - law.span, hi = law.mu + law.span;
		const Y = v => P.y0 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (P.y0 - P.y1);
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		// the late window, where an exit puts the path in the tail event
		c.fillStyle = '#f3f2f5';
		c.fillRect(X(LATE), P.y1, P.x1 - X(LATE), P.y0 - P.y1);
		// the band μ ± ε
		c.fillStyle = COL.pale;
		c.fillRect(P.x0, Y(law.mu + eps), P.x1 - P.x0, Y(law.mu - eps) - Y(law.mu + eps));
		c.strokeStyle = COL.tail;
		c.lineWidth = 1;
		c.setLineDash([5, 3]);
		polyline(c, [[P.x0, Y(law.mu)], [P.x1, Y(law.mu)]]);
		c.setLineDash([]);
		// the paths, the late leavers drawn last and in red
		const late = means.map(m => { for (let n = LATE; n <= N; n++) if (Math.abs(m[n] - law.mu) > eps) return true; return false; });
		for (const pass of [false, true]) {
			means.forEach((m, p) => {
				if (late[p] !== pass) return;
				c.strokeStyle = pass ? COL.bad : COL.ink;
				c.globalAlpha = pass ? 0.9 : 0.55;
				c.lineWidth = 1;
				const pts = [];
				for (let n = 1; n <= N; n++) pts.push([X(n), Y(m[n])]);
				polyline(c, pts);
			});
		}
		c.globalAlpha = 1;
		frameBox(c, P);
		// the axes
		const POW = ['1', '10', '10²', '10³', '10⁴'];
		POW.forEach((t, k) => label(c, t, X(10 ** k), P.y0 + 14, 'center'));
		label(c, 'n →', P.x1 - 16, P.y0 + 14, 'right');
		for (const v of [lo, law.mu, hi]) label(c, minus(+v.toFixed(1)), P.x0 - 5, Y(v) + 4, 'right');
		label(c, `μ ± ε`, P.x1 - 4, Y(law.mu + eps) - 4, 'right', COL.tail);
		const k = late.filter(Boolean).length;
		label(c, `${k} of ${PATHS} running means leave ${minus(law.mu)} ± ${eps.toFixed(2)} after n = 10³`, P.x0, 18, 'left', k ? COL.bad : COL.ink);
	}
	const pick = presets(row, Object.keys(LAWS).map(key => [key, LAWS[key].label]), key => { law = LAWS[key]; sample(); draw(); });
	button(row, 'Resample', () => { seed++; sample(); draw(); });
	slider(row, 'ε', 5, 50, 20, v => { eps = v / 100; draw(); }, { show: v => (v / 100).toFixed(2) });
	pick('die');
};
