// ---- 212. markov chain ----
// the row vector μ times the matrix P
const step = (mu, P) => P[0].map((_, j) => mu.reduce((s, m, i) => s + m * P[i][j], 0));
const tv = (mu, nu) => mu.reduce((s, m, i) => s + Math.abs(m - nu[i]), 0) / 2;
// the stationary π of an irreducible P, solving π(P − I) = 0 with Σπ = 1
function stationary(P) {
	const k = P.length;
	const A = P[0].map((_, j) => P.map((r, i) => r[j] - (i === j ? 1 : 0)));
	A[k - 1] = new Array(k).fill(1);
	const b = new Array(k).fill(0);
	b[k - 1] = 1;
	for (let col = 0; col < k; col++) {
		let piv = col;
		for (let r = col + 1; r < k; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
		[A[col], A[piv]] = [A[piv], A[col]];
		[b[col], b[piv]] = [b[piv], b[col]];
		for (let r = 0; r < k; r++) {
			if (r === col) continue;
			const f = A[r][col] / A[col][col];
			for (let j = col; j < k; j++) A[r][j] -= f * A[col][j];
			b[r] -= f * b[col];
		}
	}
	return b.map((v, i) => v / A[i][i]);
}
// |λ₂| for two or three states, from the trace and determinant of P
function lambda2(P) {
	if (P.length === 2) return Math.abs(P[0][0] + P[1][1] - 1);
	const tr = P[0][0] + P[1][1] + P[2][2];
	const det = P[0][0] * (P[1][1] * P[2][2] - P[1][2] * P[2][1]) - P[0][1] * (P[1][0] * P[2][2] - P[1][2] * P[2][0]) + P[0][2] * (P[1][0] * P[2][1] - P[1][1] * P[2][0]);
	// the other two eigenvalues are the roots of x² − (tr − 1)x + det
	const s = tr - 1, disc = s * s - 4 * det;
	if (disc < 0) return Math.sqrt(det);
	return Math.max(Math.abs((s + Math.sqrt(disc)) / 2), Math.abs((s - Math.sqrt(disc)) / 2));
}

// π(n) against π for three small chains, and the distance by step on a log scale
FIGS['212/tv'] = el => {
	const W = 600, H = 200, NMAX = 30;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const CHAINS = {
		weather: { names: ['sun', 'cloud', 'rain'], P: [[0.7, 0.2, 0.1], [0.3, 0.4, 0.3], [0.2, 0.3, 0.5]] },
		sticky: { names: ['1', '2'], P: [[0.9, 0.1], [0.1, 0.9]] },
		swap: { names: ['1', '2'], P: [[0, 1], [1, 0]] },
	};
	let key = 'weather', n = 4, laws = [], pi = [], dist = [], l2 = 0;
	function exact() {
		const ch = CHAINS[key];
		pi = stationary(ch.P);
		l2 = lambda2(ch.P);
		laws = [ch.P.map((_, i) => i === 0 ? 1 : 0)];
		for (let t = 1; t <= NMAX; t++) laws.push(step(laws[t - 1], ch.P));
		dist = laws.map(mu => tv(mu, pi));
	}
	function draw() {
		const ch = CHAINS[key], k = ch.names.length;
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		// left, the bars of π(n) with π as an orange tick on each
		const L = plotBox(30, 230, 170, 30, [0, k], [0, 1]);
		frameBox(c, L);
		for (const v of [0.5, 1]) label(c, String(v), L.x0 - 4, L.Y(v) + 4, 'right');
		const bw = (L.x1 - L.x0) / k;
		for (let i = 0; i < k; i++) {
			const x = L.x0 + i * bw;
			c.fillStyle = COL.ink;
			c.fillRect(x + bw * 0.25, L.Y(laws[n][i]), bw * 0.5, L.y0 - L.Y(laws[n][i]));
			c.strokeStyle = COL.tail;
			c.lineWidth = 2.5;
			polyline(c, [[x + bw * 0.15, L.Y(pi[i])], [x + bw * 0.85, L.Y(pi[i])]]);
			label(c, ch.names[i], x + bw / 2, L.y0 + 13, 'center');
		}
		label(c, `π(${n})`, L.x0, 18, 'left', COL.ink);
		label(c, 'π', L.x0 + 44, 18, 'left', COL.tail);
		label(c, `π = (${pi.map(v => v.toFixed(3)).join(', ')})`, L.x0 + 64, 18, 'left', COL.mute);
		// right, log₁₀ of the distance against n, with the slope |λ₂|ⁿ anchored on the last dot above 10⁻⁵
		const R = plotBox(300, 580, 170, 30, [0, NMAX], [-6, 0]);
		frameBox(c, R);
		c.strokeStyle = COL.grid;
		c.lineWidth = 1;
		for (let e = -5; e <= -1; e++) polyline(c, [[R.x0, Math.round(R.Y(e)) + 0.5], [R.x1, Math.round(R.Y(e)) + 0.5]]);
		for (const e of [0, -2, -4, -6]) label(c, e === 0 ? '1' : `10${e === -2 ? '⁻²' : e === -4 ? '⁻⁴' : '⁻⁶'}`, R.x0 - 4, R.Y(e) + 4, 'right');
		for (const t of [0, 10, 20, 30]) label(c, String(t), R.X(t), R.y0 + 13, 'center');
		label(c, 'n →', R.x1 + 14, R.y0 + 13);
		const lg = v => Math.max(-6, Math.log10(Math.max(v, 1e-12)));
		let anchor = 0;
		for (let t = 0; t <= NMAX; t++) if (dist[t] > 1e-5) anchor = t;
		if (l2 > 1e-9) {
			const pts = [];
			for (let t = 0; t <= NMAX; t++) {
				const v = Math.log10(dist[anchor]) + (t - anchor) * Math.log10(l2);
				if (v >= -6 && v <= 0.2) pts.push([R.X(t), R.Y(v)]);
			}
			c.strokeStyle = COL.tail;
			c.lineWidth = 1.5;
			c.setLineDash([5, 3]);
			polyline(c, pts);
			c.setLineDash([]);
		}
		for (let t = 0; t <= NMAX; t++) {
			if (dist[t] < 1e-6) continue;
			c.fillStyle = t === n ? COL.bad : COL.ink;
			const r = t === n ? 3.5 : 2;
			c.beginPath();
			c.arc(R.X(t), R.Y(lg(dist[t])), r, 0, 2 * Math.PI);
			c.fill();
		}
		label(c, `‖π(n) − π‖ by n, and |λ₂|ⁿ with |λ₂| = ${l2.toFixed(3)}`, R.x0, 18, 'left', COL.black);
		out.innerHTML = `‖π(${n}) − π‖ = ${dist[n] < 1e-4 ? dist[n].toExponential(1) : dist[n].toFixed(4)}`;
	}
	const pick = presets(row, [['weather', 'Weather'], ['sticky', 'Sticky'], ['swap', 'Swap']], k => { key = k; exact(); draw(); });
	slider(row, 'n', 0, NMAX, n, v => { n = v; draw(); }, { show: v => String(v).padStart(2, ' ') });
	const out = reading(row);
	pick('weather');
};

// Doeblin's coupling on a lazy walk over ten states: two paths that meet
// and then move together, and the exact distance against P(T > n)
FIGS['212/coupling'] = el => {
	const W = 600, H = 200, K = 10, NT = 150;
	const c = canvas(el, W, H);
	const row = figRow(el);
	// stay with probability 1/2, else a step left or right, held at the ends
	const P = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, j) => {
		if (j === i) return i === 0 || i === K - 1 ? 0.75 : 0.5;
		return Math.abs(i - j) === 1 ? 0.25 : 0;
	}));
	const pi = new Array(K).fill(1 / K);
	// the exact curves, ‖δ₀Pⁿ − π‖ and P(T > n) by the pair chain killed on the diagonal
	const dist = [], survive = [];
	let mu = P.map((_, i) => i === 0 ? 1 : 0);
	let pair = Array.from({ length: K }, (_, x) => Array.from({ length: K }, (_, y) => x === 0 && y !== 0 ? 1 / K : 0));
	for (let t = 0; t <= NT; t++) {
		dist.push(tv(mu, pi));
		survive.push(pair.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0));
		mu = step(mu, P);
		const nx = Array.from({ length: K }, () => new Array(K).fill(0));
		for (let x = 0; x < K; x++) for (let y = 0; y < K; y++) {
			if (!pair[x][y]) continue;
			for (let x2 = 0; x2 < K; x2++) if (P[x][x2]) for (let y2 = 0; y2 < K; y2++) if (P[y][y2] && x2 !== y2) nx[x2][y2] += pair[x][y] * P[x][x2] * P[y][y2];
		}
		pair = nx;
	}
	const move = (i, u) => { const v = u(); return v < P[i][i] ? i : (i === 0 ? 1 : i === K - 1 ? K - 2 : v < 0.75 ? i - 1 : i + 1); };
	let seed = 230, X = [], Y = [], T = 0;
	function sample() {
		const u = rng(seed);
		X = [0]; Y = [Math.floor(u() * K)];
		T = X[0] === Y[0] ? 0 : -1;
		for (let t = 1; t <= NT; t++) {
			const x = move(X[t - 1], u);
			const y = T >= 0 ? x : move(Y[t - 1], u);
			X.push(x); Y.push(y);
			if (T < 0 && x === y) T = t;
		}
	}
	function draw() {
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		// left, the two paths of state against time
		const L = plotBox(40, 380, 176, 24, [0, NT], [-0.5, K - 0.5]);
		frameBox(c, L);
		for (const s of [0, 9]) label(c, String(s), L.x0 - 5, L.Y(s) + 4, 'right');
		label(c, 'state', L.x0 - 5, L.Y(4.5) + 4, 'right');
		for (const t of [0, 50, 100, 150]) label(c, String(t), L.X(t), L.y0 + 13, 'center');
		const end = T >= 0 ? T : NT;
		c.lineWidth = 1.4;
		c.strokeStyle = COL.ink;
		polyline(c, X.slice(0, end + 1).map((v, t) => [L.X(t), L.Y(v) + 1.5]));
		c.strokeStyle = COL.tail;
		polyline(c, Y.slice(0, end + 1).map((v, t) => [L.X(t), L.Y(v) - 1.5]));
		if (T >= 0) {
			c.strokeStyle = COL.black;
			c.lineWidth = 2.2;
			polyline(c, X.slice(T).map((v, i) => [L.X(T + i), L.Y(v)]));
			c.strokeStyle = COL.mute;
			c.lineWidth = 1;
			c.setLineDash([3, 3]);
			polyline(c, [[L.X(T) + 0.5, L.y1], [L.X(T) + 0.5, L.y0]]);
			c.setLineDash([]);
			label(c, `T = ${T}`, L.X(T) + 4, L.y1 + 12, 'left', COL.black);
		}
		label(c, 'X from 0', L.x0, 14, 'left', COL.ink);
		label(c, 'Y from π', L.x0 + 60, 14, 'left', COL.tail);
		label(c, 'together after T', L.x0 + 122, 14, 'left', COL.black);
		// right, the exact distance and P(T > n)
		const R = plotBox(420, 590, 176, 24, [0, NT], [0, 1]);
		frameBox(c, R);
		label(c, '1', R.x0 - 4, R.Y(1) + 4, 'right');
		label(c, '0', R.x0 - 4, R.Y(0) + 4, 'right');
		for (const t of [0, 150]) label(c, String(t), R.X(t), R.y0 + 13, 'center');
		c.lineWidth = 1.6;
		c.strokeStyle = COL.tail;
		polyline(c, survive.map((v, t) => [R.X(t), R.Y(v)]));
		c.strokeStyle = COL.ink;
		polyline(c, dist.map((v, t) => [R.X(t), R.Y(v)]));
		label(c, 'P(T > n)', R.x1, R.Y(survive[60]) - 6, 'right', COL.tail);
		label(c, '‖π(n) − π‖', R.X(24), R.Y(dist[24]) + 16, 'left', COL.ink);
		if (T >= 0) {
			c.fillStyle = COL.black;
			c.beginPath(); c.arc(R.X(T), R.Y(survive[T]), 3, 0, 2 * Math.PI); c.fill();
			out.innerHTML = `T = ${T} · ‖π(${T}) − π‖ = ${dist[T].toFixed(3)} ≤ P(T &gt; ${T}) = ${survive[T].toFixed(3)}`;
		} else out.innerHTML = `not met by ${NT} · P(T &gt; ${NT}) = ${survive[NT].toFixed(3)}`;
	}
	button(row, 'Resample', () => { seed += 1; sample(); draw(); });
	const out = reading(row);
	sample();
	draw();
};

// a chain's law as water in tanks, each edge carrying πᵢ(n)pᵢⱼ a step: at π
// a reversible chain has no net flow on any edge, a chain with drift a current
FIGS['212/flow'] = el => {
	const W = 600, H = 250, STEPS = 120;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const CHAINS = {
		reversible: { label: 'birth-death', P: [[0.5, 0.5, 0, 0], [0.25, 0.5, 0.25, 0], [0, 0.25, 0.5, 0.25], [0, 0, 0.5, 0.5]] },
		drift: { label: 'drift cycle', P: [[0.2, 0.6, 0.2], [0.2, 0.2, 0.6], [0.6, 0.2, 0.2]] },
		swap: { label: 'swap', P: [[0, 1], [1, 0]] },
	};
	let P, k, laws, pi, net, n = 0, part = 0;
	function exact(key) {
		P = CHAINS[key].P;
		k = P.length;
		pi = stationary(P);
		laws = [P.map((_, i) => (i === 0 ? 1 : 0))];
		for (let t = 1; t <= STEPS; t++) laws.push(step(laws[t - 1], P));
		// at π, the largest net flow on an edge, π(i)p(i, j) − π(j)p(j, i)
		net = 0;
		for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) net = Math.max(net, Math.abs(pi[i] * P[i][j] - pi[j] * P[j][i]));
		n = 0;
		part = 0;
	}
	const spot = i => {
		const a = -Math.PI / 2 + 2 * Math.PI * i / k;
		return [W / 2 + 150 * Math.cos(a), 112 + 76 * Math.sin(a)];
	};
	function draw() {
		// the law, part of the way from step n to step n + 1
		const mu = laws[n].map((m, i) => m + part * (laws[Math.min(STEPS, n + 1)][i] - m));
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		// each direction of an edge a curve as thick as its flow
		for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
			if (i === j || !P[i][j]) continue;
			const [x1, y1] = spot(i), [x2, y2] = spot(j);
			// bent to the left of its way, so the two directions part, its flow
			// written beyond the band, clear of the thickest
			const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18, my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
			const lx = (x1 + x2) / 2 + (y2 - y1) * 0.24, ly = (y1 + y2) / 2 - (x2 - x1) * 0.24;
			const f = mu[i] * P[i][j];
			c.strokeStyle = COL.ink;
			c.globalAlpha = 0.7;
			c.lineWidth = 1 + 40 * f;
			c.beginPath();
			c.moveTo(x1, y1);
			c.quadraticCurveTo(mx, my, x2, y2);
			c.stroke();
			c.globalAlpha = 1;
			if (f > 5e-4) label(c, f.toFixed(3), lx, ly + 4, 'center', COL.black);
		}
		// the tanks filled to π(n), with π an orange line across each
		for (let i = 0; i < k; i++) {
			const [x, y] = spot(i), w = 34, h = 46;
			c.fillStyle = COL.paper;
			c.fillRect(x - w / 2, y - h / 2, w, h);
			c.fillStyle = '#c8cbe8';
			c.fillRect(x - w / 2, y + h / 2 - h * mu[i], w, h * mu[i]);
			c.strokeStyle = COL.black;
			c.lineWidth = 1;
			c.strokeRect(x - w / 2 - 0.5, y - h / 2 - 0.5, w + 1, h + 1);
			c.strokeStyle = COL.tail;
			c.lineWidth = 2;
			polyline(c, [[x - w / 2 - 4, y + h / 2 - h * pi[i]], [x + w / 2 + 4, y + h / 2 - h * pi[i]]]);
			label(c, String(i + 1), x, y + 4, 'center', COL.black);
		}
		label(c, net < 1e-9 ? 'at π every edge balances, πᵢpᵢⱼ = πⱼpⱼᵢ, so the chain is reversible' : `at π a net ${net.toFixed(3)} a step runs round the cycle, so the chain is not reversible`, 10, H - 10, 'left', net < 1e-9 ? COL.ink : COL.bad);
		out.textContent = `n = ${n} · ‖π(n) − π‖ = ${tv(laws[n], pi).toFixed(4)}`;
	}
	const pick = presets(row, Object.keys(CHAINS).map(key => [key, CHAINS[key].label]), key => { run.stop(); exact(key); draw(); });
	// Run moves a step every 700 ms, the tanks filling smoothly between steps
	const run = runButton(row, dt => {
		if (n >= STEPS) n = 0;
		part += dt / 700;
		if (part >= 1) {
			part = 0;
			n += 1;
		}
		draw();
		return n < STEPS;
	});
	button(row, 'Step', () => {
		run.stop();
		part = 0;
		n = Math.min(STEPS, n + 1);
		draw();
	});
	const out = reading(row);
	pick('reversible');
};
