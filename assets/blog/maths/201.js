// ---- 201. probability theory ----

// independent events Aₙ with P(Aₙ) = n⁻ᵖ, one row per outcome, n on a log scale
FIGS['201/borel'] = el => {
	const W = 520, H = 200, ROWS = 40, N = 10000;
	const P = { x0: 30, x1: 470, y0: 176, y1: 32 };
	const X = n => P.x0 + Math.log10(n) / 4 * (P.x1 - P.x0);
	const rh = (P.y0 - P.y1) / ROWS;
	const c = canvas(el, W, H);
	const row = figRow(el);
	let seed = 201, u = null, p = 1;
	// one uniform per row and n, kept across p so that raising p only removes marks
	function sample() {
		const r = rng(seed);
		u = new Float32Array(ROWS * N);
		for (let i = 0; i < u.length; i++) u[i] = r();
	}
	// ζ(p) by its first N − 1 terms and the Euler-Maclaurin tail
	const zeta = s => {
		let t = 0;
		for (let n = 1; n < N; n++) t += n ** -s;
		return t + N ** (1 - s) / (s - 1) + N ** -s / 2;
	};
	function draw() {
		clear(c);
		// the last decade, where infinitely often shows
		c.fillStyle = COL.pale;
		c.fillRect(X(1000), P.y1, P.x1 - X(1000), P.y0 - P.y1);
		let hit = 0;
		for (let r = 0; r < ROWS; r++) {
			const y = P.y1 + r * rh;
			let late = false;
			for (let n = 1; n <= N; n++) {
				if (u[r * N + n - 1] >= n ** -p) continue;
				c.fillStyle = n > 1000 ? COL.tail : COL.ink;
				c.fillRect(X(n) - 0.5, y + 0.5, 1, rh - 1);
				if (n > 1000) late = true;
			}
			if (late) hit++;
		}
		frameBox(c, P);
		for (const [n, s] of [[1, '1'], [10, '10'], [100, '10²'], [1000, '10³'], [10000, '10⁴']]) label(c, s, X(n), P.y0 + 13, 'center');
		label(c, 'n →', P.x1 + 8, P.y0 + 13);
		label(c, 'ω', P.x0 - 8, (P.y0 + P.y1) / 2 + 4, 'right');
		label(c, 'a mark where Aₙ occurs, independent, P(Aₙ) = n⁻ᵖ', P.x0, 12, 'left', COL.ink);
		label(c, p <= 1 ? 'Σ n⁻ᵖ = ∞' : `Σ n⁻ᵖ = ${zeta(p).toFixed(3)}`, P.x1, 12, 'right', COL.black);
		label(c, 'n > 10³', X(1000) + 3, P.y1 - 5, 'left', COL.tail);
		// P(some Aₙ with 10³ < n ≤ 10⁴) exactly, by the product of the complements
		let none = 1;
		for (let n = 1001; n <= N; n++) none *= 1 - n ** -p;
		readEl.textContent = `${hit}/${ROWS} rows marked past 10³ · P = ${(1 - none).toFixed(3)}`;
	}
	slider(row, 'p', 50, 200, 100, v => { p = v / 100; draw(); }, { show: v => (v / 100).toFixed(2) });
	button(row, 'Resample', () => { seed++; sample(); draw(); });
	const readEl = reading(row);
	sample();
	draw();
};
