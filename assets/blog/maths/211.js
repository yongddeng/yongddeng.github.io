// ---- 211. martingale ----

// the doubling system on a fair coin with at most m bets a round: the
// fortune bet by bet, and the exact law of one round's gain beside it
FIGS['211/doubling'] = el => {
	const W = 600, H = 210, BETS = 400;
	const c = canvas(el, W, H);
	const row = figRow(el);
	let m = 5, seed = 211, flips = [];
	const sample = () => { const u = rng(seed); flips = Array.from({ length: BETS }, () => u() < 0.5); };
	// the same flips replayed under the limit m, each bet tagged with whether its round was lost
	function play() {
		const fortune = [0], lost = [];
		let stake = 1, round = [], won = 0, rounds = 0;
		for (let i = 0; i < BETS; i++) {
			const f = fortune[i] + (flips[i] ? stake : -stake);
			fortune.push(f);
			round.push(i);
			if (flips[i]) { won++; rounds++; round = []; stake = 1; }
			else if (round.length === m) { rounds++; for (const j of round) lost[j] = true; round = []; stake = 1; }
			else stake *= 2;
		}
		return { fortune, lost, won, rounds };
	}
	function draw() {
		const g = play();
		const lo = Math.min(0, ...g.fortune), hi = Math.max(4, ...g.fortune);
		const pad = (hi - lo) * 0.06;
		const P = plotBox(40, 410, 186, 26, [0, BETS], [lo - pad, hi + pad]);
		clear(c);
		frameBox(c, P);
		c.strokeStyle = COL.grid;
		c.lineWidth = 1;
		polyline(c, [[P.x0, Math.round(P.Y(0)) + 0.5], [P.x1, Math.round(P.Y(0)) + 0.5]]);
		// each bet a segment, red when its round ends in m losses
		c.lineWidth = 1.3;
		for (let i = 0; i < BETS; i++) {
			c.strokeStyle = g.lost[i] ? COL.bad : COL.ink;
			polyline(c, [[P.X(i), P.Y(g.fortune[i])], [P.X(i + 1), P.Y(g.fortune[i + 1])]]);
		}
		label(c, '0', P.x0 - 5, P.Y(0) + 4, 'right');
		if (P.Y(lo) - P.Y(0) > 14) label(c, minus(Math.round(lo)), P.x0 - 5, P.Y(lo) + 4, 'right');
		if (P.Y(0) - P.Y(hi) > 14) label(c, String(Math.round(hi)), P.x0 - 5, P.Y(hi) + 4, 'right');
		for (const s of [0, 100, 200, 300, 400]) label(c, String(s), P.X(s), P.y0 + 13, 'center');
		label(c, 'bet →', P.x1 + 18, P.y0 + 13);
		const lost = g.rounds - g.won;
		label(c, `${g.rounds} rounds, ${lost} lost · fortune ${minus(g.fortune[BETS])} after ${BETS} bets`, P.x0, 14, 'left', COL.black);
		// the law of one round, a bar at each gain with its probability
		const Q = { x0: 470, x1: 590, y0: 170, y1: 46 };
		const pLose = 2 ** -m;
		const bar = (x, p, colour, gain, prob) => {
			const h = Math.max(1, p * (Q.y0 - Q.y1));
			c.fillStyle = colour;
			c.fillRect(x, Q.y0 - h, 30, h);
			label(c, gain, x + 15, Q.y0 + 13, 'center', colour);
			label(c, prob, x + 15, Q.y0 - h - 5, 'center', colour);
		};
		c.strokeStyle = COL.frame;
		c.lineWidth = 1;
		polyline(c, [[Q.x0, Q.y0 + 0.5], [Q.x1, Q.y0 + 0.5]]);
		bar(Q.x0 + 10, 1 - pLose, COL.ink, '+1', (1 - pLose).toFixed(3));
		bar(Q.x0 + 70, pLose, COL.bad, minus(-(2 ** m - 1)), pLose < 0.001 ? `1/${2 ** m}` : pLose.toFixed(3));
		label(c, 'one round', (Q.x0 + Q.x1) / 2, 14, 'center', COL.black);
		label(c, 'mean gain 0', (Q.x0 + Q.x1) / 2, 30, 'center', COL.tail);
		label(c, 'gain', (Q.x0 + Q.x1) / 2, Q.y0 + 27, 'center');
	}
	slider(row, 'm', 1, 10, m, v => { m = v; draw(); }, { show: v => String(v).padStart(2, ' ') });
	button(row, 'Resample', () => { seed += 1; sample(); draw(); });
	reading(row).innerHTML = '(1 − 2<sup>−m</sup>) − 2<sup>−m</sup>(2<sup>m</sup> − 1) = 0';
	sample();
	draw();
};

// a path with the band [a, b] and its upcrossings, below the exact E Uₙ and
// Doob's bound E(Xₙ − a)⁺/(b − a), for the walk and for Pólya's urn
FIGS['211/upcrossings'] = el => {
	const W = 600, H = 210, N = 200;
	const c = canvas(el, W, H);
	const row = figRow(el);
	// each kind: band, start, one step from (value, step) by a uniform, and the
	// exact law of the next value as [value, probability] pairs
	const KIND = {
		walk: {
			a: -2, b: 2, start: 0,
			next: (x, n, u) => x + (u() < 0.5 ? 1 : -1),
			law: (x) => [[x + 1, 0.5], [x - 1, 0.5]],
			value: x => x,
		},
		urn: {
			// the state is the number r of red balls, out of n + 2 at step n
			a: 0.4, b: 0.6, start: 1,
			next: (r, n, u) => u() < r / (n + 2) ? r + 1 : r,
			law: (r, n) => [[r + 1, r / (n + 2)], [r, 1 - r / (n + 2)]],
			value: (r, n) => r / (n + 2),
		},
	};
	let kind = 'walk', seed = 2110, n = N, path = [], EU = [], bound = [];
	// E Uₙ by dynamic programming over (state, phase), phase 1 once the path is at or below a
	function exact() {
		const k = KIND[kind];
		let dist = new Map([[`${k.start}|${k.value(k.start, 0) <= k.a ? 1 : 0}`, 1]]);
		EU = [0]; bound = [Math.max(0, k.value(k.start, 0) - k.a) / (k.b - k.a)];
		let done = 0;
		for (let t = 0; t < N; t++) {
			const nd = new Map();
			let up = 0;
			for (const [key, mass] of dist) {
				const [s, ph] = key.split('|').map(Number);
				for (const [s2, p] of k.law(s, t)) {
					if (p === 0) continue;
					const v = k.value(s2, t + 1);
					let ph2 = ph;
					if (ph === 0 && v <= k.a) ph2 = 1;
					else if (ph === 1 && v >= k.b) { ph2 = 0; done += mass * p; }
					const kk = `${s2}|${ph2}`;
					nd.set(kk, (nd.get(kk) || 0) + mass * p);
				}
			}
			dist = nd;
			EU.push(done);
			let e = 0;
			for (const [key, mass] of dist) e += mass * Math.max(0, k.value(+key.split('|')[0], t + 1) - k.a);
			bound.push(e / (k.b - k.a));
		}
	}
	function sample() {
		const k = KIND[kind], u = rng(seed);
		const s = [k.start];
		for (let t = 0; t < N; t++) s.push(k.next(s[t], t, u));
		path = s.map((v, t) => k.value(v, t));
	}
	// the completed upcrossings of the sample path up to time n, as [from, to]
	function crossings(upTo) {
		const k = KIND[kind], out = [];
		let from = path[0] <= k.a ? 0 : -1;
		for (let t = 1; t <= upTo; t++) {
			if (from < 0 && path[t] <= k.a) from = t;
			else if (from >= 0 && path[t] >= k.b) { out.push([from, t]); from = -1; }
		}
		return out;
	}
	function draw() {
		const k = KIND[kind];
		let lo, hi;
		if (kind === 'walk') { const r = Math.max(6, ...path.map(Math.abs)) + 1; lo = -r; hi = r; } else { lo = 0; hi = 1; }
		const P = plotBox(40, 560, 186, 30, [0, N], [lo, hi]);
		clear(c);
		c.fillStyle = COL.pale;
		c.fillRect(P.x0, P.Y(k.b), P.x1 - P.x0, P.Y(k.a) - P.Y(k.b));
		frameBox(c, P);
		label(c, `a = ${minus(k.a)}`, P.x0 - 5, P.Y(k.a) + 4, 'right');
		label(c, `b = ${k.b}`, P.x0 - 5, P.Y(k.b) + 4, 'right');
		for (const s of [0, 50, 100, 150, 200]) label(c, String(s), P.X(s), P.y0 + 13, 'center');
		label(c, 'n →', P.x1 + 18, P.y0 + 13);
		c.strokeStyle = COL.ink;
		c.lineWidth = 1.2;
		polyline(c, path.slice(0, n + 1).map((v, t) => [P.X(t), P.Y(v)]));
		const ups = crossings(n);
		c.strokeStyle = COL.tail;
		c.lineWidth = 2.4;
		for (const [f, t] of ups) polyline(c, path.slice(f, t + 1).map((v, i) => [P.X(f + i), P.Y(v)]));
		label(c, `Uₙ = ${ups.length} on this path`, P.x0, 14, 'left', COL.tail);
		label(c, `E Uₙ = ${EU[n].toFixed(3)} ≤ E(Xₙ − a)⁺/(b − a) = ${bound[n].toFixed(3)}`, P.x0 + 150, 14, 'left', COL.black);
	}
	const pick = presets(row, [['walk', 'Walk'], ['urn', 'Pólya urn']], key => { kind = key; exact(); sample(); draw(); });
	button(row, 'Resample', () => { seed += 1; sample(); draw(); });
	runSlider(row, slider(row, 'n', 10, N, n, v => { n = v; draw(); }, { show: v => String(v).padStart(3, ' ') }));
	pick('walk');
};
