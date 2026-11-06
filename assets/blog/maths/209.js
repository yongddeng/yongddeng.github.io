// ---- 209. law of the iterated logarithm ----

// a coin-tossing walk to 10⁶ on a logarithmic clock, Sₙ/√n between ±√(2 log log n)
FIGS['209/clock'] = el => {
	const W = 600, H = 220, N = 1e6, A = 2, B = 6;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const P = plotBox(40, W - 14, H - 24, 30, [A, B], [-3.5, 3.5]);
	const Y = v => P.Y(Math.max(-3.5, Math.min(3.5, v)));
	const env = n => Math.sqrt(2 * Math.log(Math.log(n)));
	const S = new Int32Array(N + 1);
	let seed = 209;
	// the walk, 32 fair steps from each draw of the seeded source
	function walk() {
		const u = rng(seed);
		let s = 0, bits = 0, left = 0;
		for (let n = 1; n <= N; n++) {
			if (!left) { bits = Math.floor(u() * 4294967296); left = 32; }
			s += (bits & 1) ? 1 : -1;
			bits >>>= 1;
			left--;
			S[n] = s;
		}
	}
	function draw() {
		clear(c);
		c.strokeStyle = COL.grid;
		c.lineWidth = 1;
		for (let k = A + 1; k < B; k++) polyline(c, [[Math.round(P.X(k)) + 0.5, P.y1], [Math.round(P.X(k)) + 0.5, P.y0]]);
		polyline(c, [[P.x0, Math.round(P.Y(0)) + 0.5], [P.x1, Math.round(P.Y(0)) + 0.5]]);
		// one standard deviation, the scale of the central limit theorem
		c.strokeStyle = COL.frame;
		c.setLineDash([4, 3]);
		for (const v of [-1, 1]) polyline(c, [[P.x0, P.Y(v)], [P.x1, P.Y(v)]]);
		c.setLineDash([]);
		// the envelope ±√(2 log log n)
		const up = [], down = [];
		for (let px = P.x0; px <= P.x1; px++) {
			const n = 10 ** P.x(px);
			up.push([px, P.Y(env(n))]);
			down.push([px, P.Y(-env(n))]);
		}
		c.strokeStyle = COL.tail;
		c.lineWidth = 1.6;
		polyline(c, up);
		polyline(c, down);
		// the walk, each pixel column drawn from its lowest to its highest value, red past the envelope
		let prev = null;
		for (let px = P.x0; px < P.x1; px++) {
			const a = Math.ceil(10 ** P.x(px));
			const b = Math.max(a, Math.ceil(10 ** P.x(px + 1)) - 1);
			let lo = Infinity, hi = -Infinity, out = false;
			const e = env(a);
			for (let n = a; n <= Math.min(b, N); n++) {
				const v = S[n] / Math.sqrt(n);
				if (v < lo) lo = v;
				if (v > hi) hi = v;
				// the envelope grows, so env(a) screens and env(n) decides
				if (!out && Math.abs(v) > e && Math.abs(v) > env(n)) out = true;
			}
			c.strokeStyle = out ? COL.bad : COL.ink;
			c.lineWidth = out ? 1.6 : 1;
			c.beginPath();
			if (prev !== null) c.moveTo(px - 0.5, Y(prev));
			else c.moveTo(px + 0.5, Y(lo));
			c.lineTo(px + 0.5, Y(lo));
			c.lineTo(px + 0.5, Y(hi));
			c.stroke();
			prev = S[Math.min(b, N)] / Math.sqrt(Math.min(b, N));
		}
		frameBox(c, P);
		['10²', '10³', '10⁴', '10⁵', '10⁶'].forEach((t, k) => label(c, t, P.X(A + k), P.y0 + 14, 'center'));
		label(c, 'n, log scale →', P.x1, 18, 'right');
		for (const v of [-2, 0, 2]) label(c, minus(v), P.x0 - 5, P.Y(v) + 4, 'right');
		label(c, '√(2 log log n)', P.X(2.05), P.Y(env(110)) - 5, 'left', COL.tail);
		label(c, 'Sₙ/√n', P.x0, 18, 'left', COL.ink);
		// the reading, over the last decade
		let top = -Infinity, bottom = Infinity;
		for (let n = N / 10 + 1; n <= N; n++) {
			const v = S[n] / Math.sqrt(2 * n * Math.log(Math.log(n)));
			top = Math.max(top, v);
			bottom = Math.min(bottom, v);
		}
		readEl.textContent = `over 10⁵ < n ≤ 10⁶, Sₙ/√(2n log log n) runs from ${minus(bottom.toFixed(3))} to ${minus(top.toFixed(3))}`;
	}
	button(row, 'Resample', () => { seed++; walk(); draw(); });
	const readEl = reading(row);
	walk();
	draw();
};
