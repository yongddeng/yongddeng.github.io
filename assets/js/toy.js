// 301. toy: one Mixtral decoder layer in the post window. A toy model built to
// Mixtral's recipe at d = 8 runs in the browser. The pane on the left draws its
// tensors as cubes and plays one token's pass through the layer as the pane is
// scrolled; the pane on the right is the maths, one section per component, with
// the current step worked in that token's numbers, by hand and in PyTorch. Prose,
// TeX and code come from _data/toy.yml via the JSON script in the post; KaTeX
// typesets them. The desktop re-creates a post's scripts when it swaps the window
// in, so this runs once per window and claims it with data-ready.
(function () {
	const root = document.querySelector('.toy:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';
	const win = root.closest('.content') || root;
	const $ = (sel, from) => (from || root).querySelector(sel);
	const $$ = (sel, from) => [...(from || root).querySelectorAll(sel)];
	const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
	const range = n => [...Array(n).keys()];
	const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
	const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const DATA = JSON.parse($('script[type="application/json"]', win).textContent);

	// ---- the toy model --------------------------------------------------------
	// Mixtral's recipe at d = 8: four query heads of 4 sharing two key-value heads,
	// RoPE, RMSNorm with gain 1 and no biases, and for the FFN eight SwiGLU experts
	// 8 → 3 → 8, of which a router runs two a token. A 16-token vocabulary. Layer 1,
	// so x is the embedding. Weights are random and rounded to one decimal.
	const D = 8, NH = 4, NKV = 2, DH = 4, NE = 8, TOPK = 2, FE = 3, EPS = 1e-5;
	const GRP = NH / NKV, NN = NE * FE; // query heads a key-value head serves; the experts' neurons, all told
	const kvOf = n => Math.floor(n / GRP); // the key-value head query head n reads
	const WORDS = ['the', 'cat', 'sat', 'on', 'the', 'mat'], T = WORDS.length;
	const VOCAB = ['the', 'cat', 'sat', 'on', 'mat', '.', 'a', 'dog', 'rug', 'ran', 'in', 'and', 'it', 'was', '<s>', '</s>'], NV = VOCAB.length;
	const THETA = [1, 0.001]; // RoPE, 1,000,000^(-2i/d_h) for the two pairs of a head

	function makeToy(seed, seedE) {
		let state = seed >>> 0;
		const rnd = () => {
			state = (state + 0x6D2B79F5) >>> 0;
			let t = state;
			t = Math.imul(t ^ t >>> 15, t | 1);
			t ^= t + Math.imul(t ^ t >>> 7, t | 61);
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
		const gauss = () => {
			let u = 0;
			while (!u) u = rnd();
			return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
		};
		const round1 = v => Math.round(v * 10) / 10;
		const matrix = (rows, cols, sd) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => round1(gauss() * sd)));
		// drawn in this order from seed 187, so the embedding is the one the toy had as a LLaMA layer
		const E = {};
		[...new Set(WORDS)].forEach(w => { E[w] = matrix(1, D, 1)[0]; });
		const Wq = matrix(D, NH * DH, 0.6), Wk = matrix(D, NKV * DH, 0.6), Wv = matrix(D, NKV * DH, 0.5), Wo = matrix(NH * DH, D, 0.5);
		const Wg = matrix(D, NE, 0.6);
		// the experts draw from a seed of their own, picked so that every token's two experts fire. An expert has 3
		// neurons where one dense FFN would have 22, so W2 is drawn wider than that FFN's 0.3, at 0.3 · √(22/3) ≈ 0.8,
		// and f comes out as large
		state = seedE >>> 0;
		const EX = range(NE).map(() => ({ W1: matrix(D, FE, 0.5), W3: matrix(D, FE, 0.5), W2: matrix(FE, D, 0.8) }));
		const WU = matrix(D, NV, 0.6);

		const mul = (u, W) => W[0].map((_, j) => u.reduce((acc, ui, i) => acc + ui * W[i][j], 0)); // row vector × matrix
		const add = (a, b) => a.map((v, i) => v + b[i]);
		const rms = u => Math.sqrt(u.reduce((acc, v) => acc + v * v, 0) / D + EPS);
		const softmax = z => {
			const top = Math.max(...z), e = z.map(v => Math.exp(v - top)), Z = e.reduce((a, b) => a + b, 0);
			return e.map(v => v / Z);
		};
		const head = (v, n) => v.slice(n * DH, n * DH + DH);
		// pair i of every head of q or k turns by θᵢ a position
		const rope = (v, pos) => {
			const out = v.slice();
			for (let i = 0; i < v.length; i += 2) {
				const a = v[i], b = v[i + 1], ang = pos * THETA[(i % DH) / 2];
				out[i] = a * Math.cos(ang) - b * Math.sin(ang);
				out[i + 1] = a * Math.sin(ang) + b * Math.cos(ang);
			}
			return out;
		};

		// one record per token, with every intermediate the drawings and the maths show
		const tok = WORDS.map((w, t) => {
			const x = E[w], r = rms(x), xn = x.map(v => v / r);
			const q = mul(xn, Wq), k = mul(xn, Wk), v = mul(xn, Wv);
			return { w, t, x, rms: r, xn, q, k, v, qr: rope(q, t), kr: rope(k, t) };
		});
		tok.forEach(a => {
			// attention: each query head scores the cached keys of its key-value head up to this position,
			// softmaxes, and blends that head's values
			a.heads = range(NH).map(n => {
				const q = head(a.qr, n), g = kvOf(n);
				const sc = tok.slice(0, a.t + 1).map(b => head(b.kr, g).reduce((acc, kv, i) => acc + kv * q[i], 0) / Math.sqrt(DH));
				const w = softmax(sc);
				const o = range(DH).map(i => w.reduce((acc, wj, j) => acc + wj * head(tok[j].v, g)[i], 0));
				return { sc, w, o };
			});
			a.cat = a.heads.flatMap(hd => hd.o);
			a.att = mul(a.cat, Wo);
			a.out = add(a.x, a.att);
			// the experts: the router scores all eight, the top two run, and the softmax of their two scores mixes
			// their outputs
			a.hrms = rms(a.out);
			a.hn = a.out.map(v => v / a.hrms);
			a.r = mul(a.hn, Wg);
			a.top = range(NE).sort((i, j) => a.r[j] - a.r[i]).slice(0, TOPK);
			a.G = softmax(a.top.map(e => a.r[e]));
			a.ex = a.top.map(e => {
				const g = mul(a.hn, EX[e].W1), u = mul(a.hn, EX[e].W3), sg = g.map(z => z / (1 + Math.exp(-z)));
				const m = sg.map((z, i) => z * u[i]);
				return { e, g, u, sg, m, f: mul(m, EX[e].W2) };
			});
			a.f = range(D).map(j => a.ex.reduce((acc, x, n) => acc + a.G[n] * x.f[j], 0));
			a.y = add(a.out, a.f);
			// the LM head
			a.zrms = rms(a.y);
			a.zn = a.y.map(v => v / a.zrms);
			a.logits = mul(a.zn, WU);
			a.probs = softmax(a.logits);
			a.pick = a.probs.indexOf(Math.max(...a.probs));
			a.nextReal = a.t + 1 < T ? VOCAB.indexOf(WORDS[a.t + 1]) : -1;
		});
		return { Wq, Wk, Wv, Wo, Wg, EX, WU, tok };
	}
	const model = makeToy(187, 66611), TOK = model.tok;

	// ---- PyTorch: what each step's lines print ---------------------------------------
	// A step's code in toy.yml is cut from the listing of §0.5, which prints under
	// torch.set_printoptions(precision=2, sci_mode=False, linewidth=64). torchStr lays a
	// value out as torch does: one width for every entry, set by the nonzero ones, and as
	// many entries a line as fit in 64 columns.
	const LINE = 64;
	function torchStr(v, ints = false) {
		const dims = !Array.isArray(v) ? 0 : Array.isArray(v[0]) ? 2 : 1;
		const all = dims === 2 ? v.flat() : dims === 1 ? v : [v], nz = all.filter(x => x !== 0);
		const whole = nz.every(Number.isInteger); // a float tensor of whole numbers prints them as "1."
		const f = x => ints ? String(x) : whole ? x.toFixed(0) + '.' : x.toFixed(2);
		const w = Math.max(1, ...(ints ? all : nz).map(x => f(x).length)), el = x => f(x).padStart(w);
		const vec = (r, indent) => {
			const per = Math.max(1, Math.floor((LINE - indent) / (w + 2))), lines = [];
			for (let i = 0; i < r.length; i += per) lines.push(r.slice(i, i + per).map(el).join(', '));
			return '[' + lines.join(',\n' + ' '.repeat(indent + 1)) + ']';
		};
		return 'tensor(' + (dims === 0 ? el(v) : dims === 1 ? vec(v, 7) : '[' + v.map(r => vec(r, 8)).join(',\n' + ' '.repeat(8)) + ']') + ')';
	}
	const heads = (v, n) => range(n).map(h => v.slice(h * DH, h * DH + DH)); // .view(n, dh)
	const size = (...s) => `torch.Size([${s.join(', ')}])`;
	// one entry a step: the values its print() gets, in order; whole numbers are an int64 tensor
	const PRINTS = {
		arrive: a => [a.x],
		norm: a => [a.xn],
		qkv: a => [heads(a.q, NH), heads(a.k, NKV), heads(a.v, NKV)],
		rope: a => [heads(a.qr, NH), heads(a.kr, NKV)],
		cache: a => [size(a.t + 1, NKV, DH) + ' ' + size(a.t + 1, NKV, DH)],
		repeat: a => [range(NH).map(n => heads(a.kr, NKV)[kvOf(n)])],
		scores: a => [a.heads.map(hd => hd.sc)],
		softmax: a => [a.heads.map(hd => hd.w)],
		blend: a => [a.heads.map(hd => hd.o)],
		wo: a => [a.att],
		add: a => [a.out],
		norm2: a => [a.hn],
		route: a => [a.r, { ints: a.top }, a.G],
		gateUp: a => [a.ex.map(x => x.g), a.ex.map(x => x.u)],
		swiglu: a => [a.ex.map(x => x.m)],
		down: a => [a.f],
		add2: a => [a.y],
		finalNorm: a => [a.zn],
		logits: a => [a.logits],
		pick: a => [a.probs, { ints: a.pick }],
	};
	const printed = (name, p) => PRINTS[name](TOK[p]).map(v => typeof v === 'string' ? v : v.ints !== undefined ? torchStr(v.ints, true) : torchStr(v)).join('\n');

	// ---- colours and formatting -------------------------------------------------
	const NAVY = [0, 0, 128], RED = [176, 0, 0];
	let PAPER = [251, 250, 251]; // System Properties' paper; readPaper keeps it and C.paper current
	const C = { ink: '#000000', navy: '#000080', red: '#b00000', mute: '#55505a', dim: '#9a949f', faint: '#b0aab4', paper: '#fbfafb', gold: '#c8a000' };
	const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
	const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
	const tint = (c, k) => c.map(v => Math.round(255 + (v - 255) * k)); // k of the colour over white
	const fade = (c, k) => c.map((v, i) => Math.round(v + (PAPER[i] - v) * k)); // k of the way back to paper
	const strength = (v, max) => Math.min(1, Math.abs(v) / max) * 0.92;
	const valueColour = (v, max = 3) => tint(v >= 0 ? NAVY : RED, strength(v, max)); // a signed value: navy up, red down
	const weightColour = w => tint(NAVY, Math.min(1, w) * 0.92); // an attention weight in [0, 1]
	const textOn = k => k > 0.5 ? '#ffffff' : '#000000';
	const sign = v => v >= 0 ? C.navy : C.red;
	const LIT = 0.5; // an edge while the sweep crosses it: plain over the faint ones, not solid
	const fmt = (v, d = 2) => { const s = Math.abs(v).toFixed(d); return (v < 0 && +s !== 0 ? '−' : '') + s; };
	const SUB = '₀₁₂₃₄₅';
	const tokName = j => WORDS[j] + SUB[j];
	const tokHtml = j => `<i>${WORDS[j]}</i><sub>${j}</sub>`;
	const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
	const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

	// ---- the twenty steps -------------------------------------------------------
	// One row a step: its name in the code, the walls lit (the others fade back), and where the
	// camera looks, in units down the page. _plugins/check_toy.rb counts these rows against toy.yml.
	const STEPS = [
		['arrive', ['x'], 0],
		['norm', ['x'], 0],
		['qkv', ['x', 'q', 'k', 'v'], 26],
		['rope', ['q', 'k'], 27],
		['cache', ['k', 'v'], 28],
		['repeat', ['k', 'v', 'kc', 'vc'], 29],
		['scores', ['q', 'k', 'kc', 'a'], 34.4],
		['softmax', ['a'], 35.4],
		['blend', ['a', 'v', 'vc', 'o'], 35.4],
		['wo', ['o', 'h'], 40],
		['add', ['x', 'h'], 40],
		['norm2', ['h'], 47],
		['route', ['h'], 60],
		['gateUp', [], 65],
		['swiglu', [], 68],
		['down', [], 73],
		['add2', ['h', 'y'], 79],
		['finalNorm', ['y'], 91],
		['logits', [], 99],
		['pick', [], 103],
	];
	const ST = Object.fromEntries(STEPS.map(([name], s) => [name, s]));
	const FOCUS = STEPS.map(r => r[1]), FOCUS_Y = STEPS.map(r => r[2]), NST = STEPS.length;

	// ---- geometry -----------------------------------------------------------------
	// Scene units: a cube of the residual stream is one unit; x runs right, y runs down
	// the page (stored negative, so up is up for the camera), z toward the viewer. A
	// wall holds one row per token and a layer of depth per query head: head 0 in
	// front, each next one HZ further back and SX further right, so the stack fans out
	// and a layer behind shows beside the one in front. Key-value head g sits in the
	// layer of its group's first query head; the group's other layers hold, empty, the
	// heads multi-head attention would keep. Attention's walls are drawn at u of a
	// unit, smaller than the stream's and with air between them.
	const HS = 0.42, HZ = 2.2, SX = 1.1, SMALL = 0.85, HOLD = 0.18, PEND = 3.4, RAILX = -1.7;
	const SUM_X = -0.85; // the two ⊕, between the rail and the walls
	const FX = 2, NETW = 22; // the networks' left edge and width: the experts', and the LM head's
	const PANEL = { x0: 0.8, x1: FX + NETW + 7.2, z: -HZ - 0.7 }; // the boards: one column, behind the front walls
	const WALLS = {
		x: { x: 0, top: 0, w: 8, u: 1 },
		q: { x: 2.4, top: 19.4, w: DH, u: SMALL },
		k: { x: 13.5, top: 19.4, w: DH, u: SMALL },
		v: { x: 24.5, top: 19.4, w: DH, u: SMALL },
		a: { x: 4, top: 33.8, w: T, u: SMALL },
		o: { x: 20.5, top: 33.8, w: DH, u: SMALL },
		h: { x: 0, top: 45.8, w: 8, u: 1 },
		y: { x: 0, top: 81, w: 8, u: 1 },
	};
	// the copies of a key or value head, kc and vc, go in the layer of its group's second query head; until Repeat
	// and after the blend that layer holds kd and vd, empty cubes for the head multi-head attention would keep there
	const COPY = { kc: 'k', vc: 'v', kd: 'k', vd: 'v' }, LAYER = { k: 0, v: 0, kc: 1, vc: 1, kd: 1, vd: 1 };
	// h is a query head in q, a and o, a key-value head in k and v and their copies
	const layerOf = (b, h) => b in LAYER ? h * GRP + LAYER[b] : h;
	const wallOf = b => WALLS[COPY[b] ?? b];
	const cellPos = (b, h, t, i) => { const { x, top, u } = wallOf(b), n = layerOf(b, h); return [x + (i + 0.5 + n * SX) * u, -(top + (t + 0.5) * u), -n * HZ]; };
	// the experts as networks: 8 inputs, the router's score for each expert, each expert's 3 neurons in a box of its
	// own (a gate node fed by W1, a value node fed by W3, their product), 8 outputs. Neuron n is neuron n mod 3 of
	// expert ⌊n/3⌋
	const NY = { in: 58.2, r: 61.8, g: 66.0, u: 67.8, m: 70.6, out: 76.4 };
	const SLOT = 0.75, EW = FE * SLOT, EGAP = (NETW - NE * EW) / (NE - 1); // a neuron's width, an expert's, the gap between two
	const EX0 = e => FX + e * (EW + EGAP); // expert e's left edge
	const nx = (n, at) => EX0(Math.floor(n / FE)) + (n % FE + at) * SLOT;
	const NX = { in: f => FX + (f + 0.5) * NETW / D, r: e => EX0(e) + EW / 2, g: n => nx(n, 0.27), u: n => nx(n, 0.73), m: n => nx(n, 0.5), out: f => FX + (f + 0.5) * NETW / D };
	const NR = { in: 0.42, out: 0.42, r: 0.36, g: 0.24, u: 0.24, m: 0.27 }; // node radii, in units
	const netPos = (kind, i) => [NX[kind](i), -NY[kind], 0];
	// the LM head: z, a node per vocabulary token, then the probability bars and their labels
	const HY = { in: 95.4, voc: 101.0, bar: 102.2, lab: 108.8 };
	const HXv = j => FX + (j + 0.5) * NETW / NV;
	const headPos = (kind, i) => kind === 'in' ? [NX.in(i), -HY.in, 0] : [HXv(i), -HY.voc, 0];
	// the components: a board each, lit while the token is inside it, on a plane at depth z; attention's sits behind
	// its four layers and reaches wide to the right. top and bottom are its edges, which placeBoards stretches into
	// y0 and y1 for the view. tint fills the board; accent draws its spine, its edge and its heading's square; ink sets
	// its heading
	const CASES = [
		{ name: 'Attention', sub: '4 query heads on 2 key-value heads here; 32 on 8, 42 M weights in Mixtral', top: 15.0, bottom: 40.5, z: -(NH - 1) * HZ - 0.7, wide: 3, tint: [221, 232, 255], accent: [47, 85, 180], ink: '#22407f', steps: [ST.norm, ST.wo] },
		{ name: 'Mixture of experts · SwiGLU', sub: '8 experts of 3, 2 run a token; 8 of 14,336 in Mixtral, 1.4 B weights', top: 55.8, bottom: 78.0, z: PANEL.z, wide: 0, tint: [227, 242, 218], accent: [46, 125, 58], ink: '#235f2d', steps: [ST.norm2, ST.down] },
		{ name: 'LM head · next token', sub: '16 tokens here; 32,000 in Mixtral, 131 M weights', top: 92.0, bottom: 112.6, z: PANEL.z, wide: 0, tint: [236, 228, 248], accent: [122, 79, 179], ink: '#5a3790', steps: [ST.finalNorm, ST.pick] },
	];
	const LAST = CASES[CASES.length - 1], MOE = CASES[1];
	// a board sits under what it holds. The view pushes a plane at depth z sideways by push(z) and lifts it by lift(z),
	// in scene units; a board's edges were drawn for those of a board at PANEL.z seen from (-0.3, 0.3), so it reaches
	// out at the side the view pushes it from and at the bottom (or, looked at from below, the top) by what it gets
	// beyond them. A deeper board's far side moves back with it, so it lines up with the others there
	const push = (z, y) => z * Math.tan(y), lift = (z, y, p) => -z * Math.cos(y) * Math.sin(p);
	const PUSHED = push(PANEL.z, -0.3), DRAWN = lift(PANEL.z, -0.3, 0.3);
	function placeBoards() {
		CASES.forEach(c => {
			const dx = push(c.z, yaw), back = push(c.z - PANEL.z, yaw), dy = lift(c.z, yaw, pitch);
			c.x0 = PANEL.x0 - Math.max(0, dx - PUSHED) - Math.max(0, -back);
			c.x1 = PANEL.x1 + c.wide + Math.max(0, -dx - PUSHED) - Math.max(0, back);
			c.y0 = c.top + Math.min(0, dy + DRAWN);
			c.y1 = c.bottom + Math.max(0, dy - DRAWN);
		});
	}
	const backAt = y => (CASES.find(c => -y >= c.y0 && -y <= c.y1) || PANEL).z; // the plane behind a point
	const AFTER_Y = 87.5; // where the rail ends and "then 31 more layers" begins
	const caseOn = (c, s) => s >= c.steps[0] && s <= c.steps[1];
	// two layers: the residual stream's walls (and its copies riding the rail) in front, the boards and everything on
	// them behind, a step paler
	const FRONT = ['x', 'h', 'y'], BACK_FADE = 0.35;

	// ---- scenes -----------------------------------------------------------------------
	// scene(p, s): every cube on show when token p is at step s, keyed wall|head|row|col.
	// Cached for the current token only; setTok clears it.
	// A cube carries its value, position, unit, colour and how far it fades back;
	// `from`, `win`, `grow` say how it enters. Ghosts are cubes in flight between two
	// scenes.
	const sceneCache = new Map();
	function scene(p, s) {
		const key = p + ':' + s;
		if (sceneCache.has(key)) return sceneCache.get(key);
		const cells = new Map(), lit = FOCUS[s];
		const put = (b, h, t, i, val, colour, extra = {}) => {
			const [x, y, z] = cellPos(b, h, t, i), live = t === p;
			const back = live ? (lit.includes(b) ? 0 : 0.45) : (b === 'k' || b === 'v' || b in COPY) ? (lit.includes(b) ? 0 : 0.5) : 0.86;
			cells.set(`${b}|${h}|${t}|${i}`, { b, h, t, i, val, st: s, x, y, z, u: wallOf(b).u, base: colour, fade: back, op: 1, sc: 1, ...extra }); // st: the step whose value it holds
		};
		const ghost = (id, from, to, colour, extra = {}) => {
			cells.set(id, { ghost: true, peak: 1, from, x: to[0], y: to[1], z: to[2], u: 1, base: colour, fade: 0, op: 0, sc: 0.8, ...extra });
		};
		for (let t = 0; t <= p; t++) {
			const r = TOK[t], live = t === p, reached = step => !live || s >= step;
			for (let f = 0; f < D; f++) {
				const v = live && s === ST.norm ? r.xn[f] : r.x[f];
				put('x', 0, t, f, v, valueColour(v));
			}
			if (!reached(ST.qkv)) continue;
			for (let f = 0; f < NH * DH; f++) {
				const qv = live && s === ST.qkv ? r.q[f] : r.qr[f];
				put('q', Math.floor(f / DH), t, f % DH, qv, valueColour(qv), live ? { from: cellPos('x', 0, t, Math.floor(f * D / (NH * DH))) } : {});
			}
			for (let f = 0; f < NKV * DH; f++) {
				const h = Math.floor(f / DH), from = live ? { from: cellPos('x', 0, t, f) } : {};
				const waiting = live && s < ST.cache ? { z: -layerOf('k', h) * HZ + PEND } : {}; // k and v wait in front of the cache
				const kv = live && s === ST.qkv ? r.k[f] : r.kr[f];
				put('k', h, t, f % DH, kv, valueColour(kv), { ...from, ...waiting });
				put('v', h, t, f % DH, r.v[f], valueColour(r.v[f]), { ...from, ...waiting });
			}
			// the layer of each group's second query head, for every cached row: from Repeat to the blend, the row's
			// copy; otherwise empty cubes
			if (!live || s >= ST.cache) {
				const copied = s >= ST.repeat && s <= ST.blend;
				for (let f = 0; f < NKV * DH; f++) {
					const h = Math.floor(f / DH), i = f % DH, fly = b => s === ST.repeat ? { from: cellPos(b, h, t, i) } : {};
					if (copied) {
						put('kc', h, t, i, r.kr[f], valueColour(r.kr[f]), fly('k'));
						put('vc', h, t, i, r.v[f], valueColour(r.v[f]), fly('v'));
					} else {
						put('kd', h, t, i, 0, PAPER, { hollow: true });
						put('vd', h, t, i, 0, PAPER, { hollow: true });
					}
				}
			}
			if (!reached(ST.scores)) continue;
			for (let h = 0; h < NH; h++) {
				for (let j = 0; j <= t; j++) {
					const hd = r.heads[h], raw = live && s === ST.scores, v = raw ? hd.sc[j] : hd.w[j];
					// the new scores grow in one key at a time, as their query and key rows arrive (below)
					const arrive = live && s === ST.scores ? { win: [0.4 + 0.06 * j, 0.7 + 0.06 * j] } : {};
					put('a', h, t, j, v, raw ? valueColour(v, 4) : weightColour(v), live ? { grow: true, ...arrive } : {});
				}
			}
			if (!reached(ST.blend)) continue;
			for (let h = 0; h < NH; h++) {
				for (let i = 0; i < DH; i++) put('o', h, t, i, r.heads[h].o[i], valueColour(r.heads[h].o[i]), live ? { grow: true, win: [0.6, 1] } : {});
			}
			if (!reached(ST.wo)) continue;
			for (let f = 0; f < D; f++) {
				const v = live && s === ST.wo ? r.att[f] : live && s === ST.norm2 ? r.hn[f] : r.out[f];
				const c = f * NH * DH / D; // the column of o above it: o is twice as wide as h
				put('h', 0, t, f, v, valueColour(v), live ? { from: cellPos('o', Math.floor(c / DH), t, c % DH) } : {});
			}
			if (!live) for (let f = 0; f < D; f++) put('y', 0, t, f, r.y[f], valueColour(r.y[f])); // earlier tokens' outputs
		}
		const r = TOK[p];
		// the experts and the LM head are drawn as networks; the cubes only enter and leave them
		if (s === ST.route) for (let f = 0; f < D; f++) ghost(`gi|${f}`, cellPos('h', 0, p, f), netPos('in', f), valueColour(r.hn[f]), { win: [0, 0.3] });
		if (s === ST.finalNorm) for (let f = 0; f < D; f++) ghost(`gz|${f}`, cellPos('y', 0, p, f), headPos('in', f), valueColour(r.y[f]), { win: [0, 0.4] });
		if (s >= ST.add2) for (let f = 0; f < D; f++) put('y', 0, p, f, r.y[f], valueColour(r.y[f]), { from: netPos('out', f), win: [0, 0.55] });
		// the scores: for each cached key, the query row and that key's row converge on their score, a dot product a
		// cell. The second query head of each group reads the copies
		if (s === ST.scores) {
			for (let h = 0; h < NH; h++) {
				const g = kvOf(h);
				for (let j = 0; j <= p; j++) {
					const to = cellPos('a', h, p, j), win = [0.05 + 0.06 * j, 0.55 + 0.06 * j];
					for (let i = 0; i < DH; i++) {
						ghost(`gq|${h}|${j}|${i}`, cellPos('q', h, p, i), to, valueColour(r.qr[h * DH + i]), { peak: 0.85, sz: 0.6, win, u: SMALL });
						ghost(`gk|${h}|${j}|${i}`, cellPos(h % GRP ? 'kc' : 'k', g, j, i), to, valueColour(TOK[j].kr[g * DH + i]), { peak: 0.85, sz: 0.6, win, u: SMALL });
					}
				}
			}
		}
		// the blend: each head's weights and its value rows (the copies, for a group's second head) converge on the new
		// row of o. Every cached row is read, so the cache stays lit; how much of a row arrives is its weight, in the
		// size and strength of its cubes
		if (s === ST.blend) {
			for (let h = 0; h < NH; h++) {
				const ws = r.heads[h].w, top = Math.max(...ws), g = kvOf(h);
				for (let j = 0; j <= p; j++) {
					for (let i = 0; i < DH; i++) {
						ghost(`g7|${h}|${j}|${i}`, cellPos(h % GRP ? 'vc' : 'v', g, j, i), cellPos('o', h, p, i), valueColour(TOK[j].v[g * DH + i]), { peak: 0.2 + 0.8 * ws[j] / top, sz: 0.3 + 0.6 * ws[j] / top, win: [0.3, 1], u: SMALL });
					}
					const [ox, oy, oz] = cellPos('o', h, p, 0), beside = [ox - 1.6 * SMALL - 0.12 * j, oy + 0.1 * j, oz];
					ghost(`ga|${h}|${j}`, cellPos('a', h, p, j), beside, weightColour(ws[j]), { life: 0.8, sz: 0.85, win: [0, 0.5], sc: 0.85, u: SMALL });
				}
			}
		}
		// the residual: a copy of the row comes down the rail and joins the sum
		const railGhosts = (src, dst, vals) => {
			for (let f = 0; f < D; f++) ghost(`r${s}|${f}`, cellPos(src, 0, p, f), cellPos(dst, 0, p, f), valueColour(vals[f]), { rail: true, ri: f, peak: 0.9, sc: 0.85 });
		};
		if (s === ST.add) railGhosts('x', 'h', r.x);
		if (s === ST.add2) railGhosts('h', 'y', r.out);
		if (s === ST.swiglu) r.ex.forEach(x => x.u.forEach((u, c) => { const n = x.e * FE + c; ghost(`g12|${n}`, netPos('u', n), netPos('m', n), valueColour(u), { peak: 0.8 }); }));
		cells.forEach(c => { c.col = fade(c.base, c.fade); });
		sceneCache.set(key, cells);
		return cells;
	}

	// a ghost part-way through its flight: `win` is the part of the move it flies in,
	// `life` keeps it at full strength until then; rail ghosts go out to the rail and back
	function ghostAt(g, k) {
		if (g.win) {
			const kg = clamp((k - g.win[0]) / (g.win[1] - g.win[0])), q = lerp3(g.from, [g.x, g.y, g.z], kg);
			const op = g.life ? g.peak * (k < g.life ? 1 : clamp(1 - (k - g.life) / 0.14)) : g.peak * Math.sin(Math.PI * kg);
			return { ...g, x: q[0], y: q[1], z: q[2], op, sc: g.life ? g.sz : (g.sz ?? 0.8) * (1 - 0.5 * kg) };
		}
		let q;
		if (g.rail) {
			const a0 = g.from, dy = (3.5 - g.ri) * 0.9, a1 = [RAILX, a0[1] + dy, 0], a2 = [RAILX, g.y + dy, 0], a3 = [g.x, g.y, g.z];
			q = k < 0.2 ? lerp3(a0, a1, k / 0.2) : k < 0.8 ? lerp3(a1, a2, (k - 0.2) / 0.6) : lerp3(a2, a3, (k - 0.8) / 0.2);
		} else {
			q = lerp3(g.from, [g.x, g.y, g.z], k);
		}
		return { ...g, x: q[0], y: q[1], z: q[2], op: g.peak * Math.sin(Math.PI * k) };
	}

	// the cubes at a scroll position: scene s held for a while, then eased into scene s + 1
	function stateAt(p, tau) {
		const s = Math.min(NST - 1, Math.floor(tau)), f = tau - s, A = scene(p, s);
		// held, the scene as it is: its ghosts wait at op 0, which drawCubes passes by
		if (s === NST - 1 || f <= HOLD) return { cells: A, s, k: 0 };
		const k = ease(clamp((f - HOLD) / (1 - 2 * HOLD))), B = scene(p, s + 1), L = (u, v) => u + (v - u) * k, out = new Map();
		B.forEach((to, id) => {
			if (to.ghost) { out.set(id, ghostAt(to, k)); return; }
			const from = A.get(id), kk = to.win ? clamp((k - to.win[0]) / (to.win[1] - to.win[0])) : k;
			if (from && !from.ghost) {
				out.set(id, { ...to, x: L(from.x, to.x), y: L(from.y, to.y), z: L(from.z, to.z), col: from.col.map((c, i) => Math.round(L(c, to.col[i]))), op: 1, sc: 1 });
			} else if (to.from) {
				const q = lerp3(to.from, [to.x, to.y, to.z], kk);
				out.set(id, { ...to, x: q[0], y: q[1], z: q[2], op: to.win && kk <= 0 ? 0 : 1 });
			} else if (to.grow) {
				out.set(id, { ...to, sc: kk });
			} else {
				out.set(id, { ...to, op: kk });
			}
		});
		A.forEach((from, id) => { if (!from.ghost && !B.has(id)) out.set(id, { ...from, op: 1 - k }); });
		return { cells: out, s, k };
	}

	// ---- the camera -----------------------------------------------------------------
	const VIEWS = { front: [0, 0.02], turned: [-0.55, 0.5] }; // yaw and pitch, radians: looked down on enough that four layers open up
	const CX = 10.5; // the scene turns about this x
	let yaw = VIEWS.turned[0], pitch = VIEWS.turned[1];
	let W = 0, H = 0, S = 18, OX = 0, OY = 0, camY = -15; // canvas size, pixels a unit, origin, camera height
	const rotate = (x, y, z) => {
		const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
		const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
		return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
	};
	const project = (x, y, z) => {
		const r = rotate(x - CX, y - camY, z + 1);
		return [OX + S * r[0], OY - S * r[1], r[2]];
	};
	const scroller = $('.toy-scroll'), stage = $('.toy-stage'), spacer = $('.toy-spacer');
	const canvas = $('.toy-cube'), ctx = canvas.getContext('2d'), tip = $('.toy-tip');
	// the paper the canvas sits on, as a #rrggbb in --paper: its background, the halos, and what cells fade to
	function readPaper() {
		const hex = getComputedStyle(canvas).getPropertyValue('--paper').trim();
		if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
		PAPER = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
		C.paper = hex;
	}
	readPaper();

	// pixels a unit: the scene's full width at the turned view has to fit the pane
	function fit() {
		W = Math.max(200, stage.clientWidth);
		H = Math.max(200, stage.clientHeight);
		const saved = [yaw, pitch];
		[yaw, pitch] = VIEWS.turned;
		let lo = Infinity, hi = -Infinity;
		placeBoards();
		// the boards as the turned view places them, and the stacked walls' labels, which ride over their back layers
		const labels = Object.keys(WALLS).filter(b => !FRONT.includes(b)).map(b => { const w = WALLS[b]; return [w.x + (NH - 1) * SX * w.u + 6.5, HS * w.u - (NH - 1) * HZ]; });
		[[RAILX - 1.2, 0], [PANEL.x1 + 0.4, 0.8], ...CASES.map(c => [c.x1 + 0.4, c.z]), ...labels].forEach(([x, z]) => {
			const r = rotate(x - CX, 0, z + 1);
			lo = Math.min(lo, r[0]);
			hi = Math.max(hi, r[0]);
		});
		[yaw, pitch] = saved;
		S = Math.min((W - 24) / (hi - lo), H / 30, 24);
		OX = W / 2 - S * (hi + lo) / 2;
		OY = H / 2;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	// the camera follows the step, kept between the top labels and the last panel. With
	// yaw, the left of the scene rises and the right drops by |sin yaw|·tan pitch a unit of x
	function placeCamera(s, k) {
		const half = H / 2 / (S * Math.cos(pitch));
		const want = FOCUS_Y[s] + (s < NST - 1 ? (FOCUS_Y[s + 1] - FOCUS_Y[s]) * k : 0);
		const lift = Math.abs(Math.sin(yaw)) * Math.tan(pitch);
		const topM = 48 / (S * Math.cos(pitch)) + CX * lift, botM = 1.2 + (PANEL.x1 + 0.4 - CX) * lift;
		camY = -Math.max(half - topM, Math.min(LAST.y1 + botM - half, want));
	}

	// ---- drawing ---------------------------------------------------------------------
	const SERIF = 'Georgia, serif', UI = '"Helvetica Neue", Arial, sans-serif';
	let cur = 0, tau = 0, lastStep = -1, explainTimer = 0, hoverKey = null, faces = [], nodeHits = [];

	// text with a paper-coloured halo, so it reads over edges and cubes
	function write(str, x, y, font, colour, align = 'left', baseline = 'middle', halo = true) {
		ctx.font = font;
		ctx.fillStyle = colour;
		ctx.textAlign = align;
		ctx.textBaseline = baseline;
		if (halo) {
			ctx.lineWidth = 3;
			ctx.strokeStyle = rgba(PAPER, 0.92);
			ctx.lineJoin = 'round';
			ctx.strokeText(str, x, y);
		}
		ctx.fillText(str, x, y);
	}
	const measure = (str, font) => { ctx.font = font; return ctx.measureText(str).width; };
	function line(a, b, colour, alpha, width) {
		ctx.strokeStyle = colour;
		ctx.globalAlpha = Math.min(1, alpha);
		ctx.lineWidth = width;
		ctx.beginPath();
		ctx.moveTo(a[0], a[1]);
		ctx.lineTo(b[0], b[1]);
		ctx.stroke();
	}
	// draw with a shadow, in CSS pixels; the shadow ends with the drawing, so none leaks into the next one
	function shadowed(colour, blur, dx, dy, draw) {
		const dpr = window.devicePixelRatio || 1;
		ctx.save();
		ctx.shadowColor = colour;
		ctx.shadowBlur = blur * dpr;
		ctx.shadowOffsetX = dx * dpr;
		ctx.shadowOffsetY = dy * dpr;
		draw();
		ctx.restore();
	}
	// Lifted things, the lit edges and the networks' nodes, cast soft shadows. A blur a drawing is the costly part
	// of a frame, so they are collected and their shadows cast in one pass: their outlines as one path, drawn off
	// the canvas so only the blurred shadow lands (as drawShadows does), then the drawings themselves over it.
	const OFF = 10000;
	let liftedEdges = [], liftedNodes = [];
	// a weight edge; while the sweep lights it, it stands off the board, so the products being summed show
	function edge(a, b, colour, alpha, width, lit) {
		if (lit) liftedEdges.push([a, b, colour, alpha, width]);
		else line(a, b, colour, alpha, width);
	}
	// ends a bundle of edges: the lit ones over their shadows, and the alpha back to 1
	function flushEdges() {
		if (liftedEdges.length) {
			ctx.beginPath();
			liftedEdges.forEach(([a, b]) => { ctx.moveTo(a[0] - OFF, a[1]); ctx.lineTo(b[0] - OFF, b[1]); });
			ctx.globalAlpha = LIT;
			ctx.strokeStyle = '#000000';
			ctx.lineWidth = 2.2;
			shadowed('rgba(20,20,50,0.45)', 4, OFF + 1.5, 2.5, () => ctx.stroke());
			liftedEdges.forEach(e => line(...e));
			liftedEdges = [];
		}
		ctx.globalAlpha = 1;
	}
	function poly(pts, fill, stroke, width) {
		ctx.beginPath();
		pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
		ctx.closePath();
		if (fill) { ctx.fillStyle = fill; ctx.fill(); }
		if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
	}
	const onScreen = (p, margin = 30) => p[1] > -margin && p[1] < H + margin;
	// how far a sweep inside a step has come: `at` is its progress over the window [a, b]
	// of the move into that step, `live` whether it is lighting up right now
	const sweep = (s, k) => ({
		at: (step, a, b) => s >= step ? 1 : s === step - 1 ? clamp((k - a) / (b - a)) : 0,
		live: (step, a, b) => s === step - 1 && k >= a && k <= b + 0.04,
	});

	function draw() {
		if (!W) return;
		placeBoards();
		const { cells, s, k } = stateAt(cur, tau);
		placeCamera(s, k);
		const SL = k > 0.5 && s < NST - 1 ? s + 1 : s; // the step the labels follow: the nearer one
		ctx.fillStyle = C.paper;
		ctx.fillRect(0, 0, W, H);
		drawRail();
		drawOutlines();
		drawPanels(SL);
		drawShadows(cells);
		drawNet(s, k, SL);
		drawProjections(s, k, SL);
		drawMask(SL);
		drawAfterLayer();
		drawHead(s, k, SL);
		drawVeil();
		const hovered = drawCubes(cells);
		drawPanelHeadings(SL);
		if (hovered) hovered.forEach(q => poly(q, null, C.gold, 2.4));
		drawNames();
		drawWallLabels(SL);
		if (tau < 0.25) {
			ctx.globalAlpha = 1 - tau * 4;
			write('scroll in this pane to move the token ▾', W / 2, H - 10, `bold 11px ${UI}`, C.navy, 'center', 'bottom');
			ctx.globalAlpha = 1;
		}
		// the side pane is rebuilt after the frame, not in it, and once for a scroll that crosses several steps
		if (SL !== lastStep) {
			lastStep = SL;
			clearTimeout(explainTimer);
			explainTimer = setTimeout(() => explain(lastStep), 60);
		}
	}

	// the residual stream: a rail down the left, a tick into x, h and y, a ⊕ where a sum lands
	function drawRail() {
		const top = project(RAILX, 0.5, 0), end = project(RAILX, -AFTER_Y, 0);
		line(top, end, '#c9c4cc', 1, 3);
		['x', 'h', 'y'].forEach(b => line(project(RAILX, -(WALLS[b].top + 3), 0), project(-0.1, -(WALLS[b].top + 3), 0), '#c9c4cc', 1, 1.5));
		['h', 'y'].forEach(b => {
			const c = project(SUM_X, -(WALLS[b].top + 3), 0);
			ctx.beginPath(); ctx.arc(c[0], c[1], 7, 0, 2 * Math.PI);
			ctx.fillStyle = '#ffffff'; ctx.fill();
			ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
			ctx.beginPath(); ctx.moveTo(c[0] - 4, c[1]); ctx.lineTo(c[0] + 4, c[1]); ctx.moveTo(c[0], c[1] - 4); ctx.lineTo(c[0], c[1] + 4); ctx.stroke();
		});
		const at = project(RAILX, -(WALLS.h.top - 4), 0);
		ctx.save();
		ctx.translate(at[0] - 7, at[1]);
		ctx.rotate(-Math.PI / 2);
		write('residual stream', 0, 0, `10px ${UI}`, '#8a848f', 'center', 'alphabetic', false);
		ctx.restore();
	}
	// after the layer: the rail turns into the LM head's input
	function drawAfterLayer() {
		const a = project(RAILX, -AFTER_Y, 0), b = project(RAILX, -HY.in, 0), c = project(NX.in(0) - 0.6, -HY.in, 0);
		ctx.setLineDash([4, 4]);
		ctx.strokeStyle = '#b8b3bc'; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
		ctx.setLineDash([]);
		// beside y's last rows, where the next layer would take y as its x
		const y = WALLS.y;
		[[T - 2, 'then 31 more layers in Mixtral;'], [T - 1, 'this toy has one']].forEach(([row, str]) => {
			const p = project(y.x + y.w + 0.7, -(y.top + row + 0.5), 0);
			write(str, p[0], p[1], `italic 11px ${SERIF}`, '#8a848f');
		});
	}
	// dashed outlines: each wall's room for six tokens
	function drawOutlines() {
		ctx.setLineDash([3, 3]);
		Object.values(WALLS).forEach(w => {
			const q = [[0.08, 0.08], [w.w - 0.08, 0.08], [w.w - 0.08, T - 0.08], [0.08, T - 0.08]].map(([i, t]) => project(w.x + i * w.u, -(w.top + t * w.u), HS * w.u));
			if (q.every(p => p[1] < -40) || q.every(p => p[1] > H + 40)) return;
			poly(q, null, 'rgba(0,0,0,0.15)', 0.8);
		});
		ctx.setLineDash([]);
	}
	// a rounded rectangle, added to the current path
	const roundRect = (x, y, w, h, r) => { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
	// draw flat on the plane z. The projection is orthographic, so a plane reaches the screen through one affine
	// transform; under it, coordinates are pixels of the plane (u() turns scene units into them), y down
	function onPlane(z, fn) {
		const o = project(0, 0, z), ex = project(1, 0, z), ey = project(0, -1, z);
		ctx.save();
		ctx.transform((ex[0] - o[0]) / S, (ex[1] - o[1]) / S, (ey[0] - o[0]) / S, (ey[1] - o[1]) / S, o[0], o[1]);
		fn(v => v * S);
		ctx.restore();
	}
	// a board's outline, on its plane (u turns scene units into the plane's pixels), and whether it is on screen
	const board = (c, u) => roundRect(u(c.x0), u(c.y0), u(c.x1 - c.x0), u(c.y1 - c.y0), u(0.7));
	const boardOnScreen = c => project(c.x1, -c.y1, c.z)[1] >= -20 && project(c.x0, -c.y0, c.z)[1] <= H + 40;
	// each component is a board on the back plane: a light fill, a hairline and a spine in its colour, and a little
	// shadow, a touch more while the token is inside it
	function drawPanels(SL) {
		CASES.filter(boardOnScreen).forEach(c => {
			const on = caseOn(c, SL);
			onPlane(c.z, u => {
				const x = u(c.x0), y = u(c.y0), w = u(c.x1 - c.x0), h = u(c.y1 - c.y0);
				// every board sits just off the page, the one the token is in a little higher. The shadow is clipped
				// to outside the board, so it keeps its strength under a light fill and never greys the board itself
				ctx.save();
				ctx.beginPath();
				ctx.rect(x - w, y - h, 3 * w, 3 * h);
				board(c, u);
				ctx.clip('evenodd');
				ctx.beginPath();
				board(c, u);
				ctx.fillStyle = C.paper;
				shadowed(on ? 'rgba(30,40,80,0.15)' : 'rgba(30,40,80,0.10)', on ? 14 : 10, 0, on ? 5 : 3, () => ctx.fill());
				ctx.restore();
				ctx.beginPath();
				board(c, u);
				ctx.fillStyle = rgba(c.tint, on ? 0.85 : 0.4);
				ctx.fill();
				ctx.save();
				ctx.clip();
				ctx.fillStyle = rgba(c.accent, on ? 0.85 : 0.3);
				ctx.fillRect(x, y, u(0.3), h);
				ctx.restore();
				ctx.beginPath();
				board(c, u);
				ctx.strokeStyle = rgba(c.accent, on ? 0.45 : 0.2);
				ctx.lineWidth = 1.2;
				ctx.stroke();
			});
		});
	}
	// the back layer steps back: a veil of paper over each board and what is drawn on it so far (edges, nodes, the
	// mask); drawCubes pales the back layer's cubes the same way, and the front walls stay at full colour
	function drawVeil() {
		CASES.filter(boardOnScreen).forEach(c => onPlane(c.z, u => {
			ctx.beginPath();
			board(c, u);
			ctx.fillStyle = rgba(PAPER, 0.42);
			ctx.fill();
		}));
	}
	// each panel's heading, a tag on its top edge drawn in the board's own plane, so it turns with the board: a tab in
	// the board's colour holding a square and its name, its foot over the edge, and its Mixtral sizes beside it
	function drawPanelHeadings(SL) {
		CASES.forEach(c => {
			const on = caseOn(c, SL), p = project(c.x0, -c.y0, c.z);
			if (p[1] < -10 || p[1] > H + 40) return;
			onPlane(c.z, u => {
				const font = `bold 13px ${SERIF}`, x = u(c.x0 + 0.7), y = u(c.y0), w = measure(c.name, font) + 30, h = 21;
				ctx.beginPath();
				roundRect(x, y - h, w, h + 3, 5);
				ctx.fillStyle = rgba(fade(c.tint, on ? 0 : 0.5), 1);
				ctx.fill();
				ctx.strokeStyle = rgba(c.accent, on ? 0.6 : 0.25);
				ctx.lineWidth = 1.2;
				ctx.stroke();
				ctx.fillStyle = rgba(c.accent, on ? 1 : 0.4);
				ctx.fillRect(x + 9, y - h / 2 - 4, 8, 8);
				write(c.name, x + 22, y - h / 2 + 0.5, font, on ? c.ink : '#8a848f', 'left', 'middle', false);
				write(c.sub, x + w + 8, y - h / 2 + 1, `10px ${UI}`, on ? C.mute : C.faint);
			});
		});
	}

	// soft shadows, never much: each cube's footprint cast down and right onto the back plane, a little farther for
	// the nearer head layer. One path for all of them, drawn off the canvas so only its blurred shadow lands
	const SHADOW = 'rgba(30,30,60,0.14)';
	function drawShadows(cells) {
		ctx.beginPath();
		cells.forEach(c => {
			if (c.ghost || c.hollow || c.op < 0.5 || c.sc < 0.5) return;
			const z = backAt(c.y), d = 0.15 + 0.08 * (c.z - z), x = c.x + d, y = c.y - d, h = HS * c.sc * c.u;
			const q = [project(x - h, y + h, z), project(x + h, y + h, z), project(x + h, y - h, z), project(x - h, y - h, z)];
			if (!onScreen(q[0], 60)) return;
			q.forEach((pt, i) => (i ? ctx.lineTo(pt[0] - OFF, pt[1]) : ctx.moveTo(pt[0] - OFF, pt[1])));
			ctx.closePath();
		});
		ctx.fillStyle = '#000000';
		shadowed(SHADOW, 6, OFF, 0, () => ctx.fill());
	}

	// the cubes, far to near; faces take their shade from one light. Returns the hovered cube's faces.
	const CORNERS = range(8).map(k => [(k & 1) ? 1 : -1, (k & 2) ? 1 : -1, (k & 4) ? 1 : -1]);
	const FACES = [[[1, 0, 0], [1, 3, 7, 5]], [[-1, 0, 0], [0, 4, 6, 2]], [[0, 1, 0], [2, 6, 7, 3]], [[0, -1, 0], [0, 1, 5, 4]], [[0, 0, 1], [4, 5, 7, 6]], [[0, 0, -1], [0, 2, 3, 1]]];
	const LIGHT = (() => { const l = [-0.35, 0.75, 0.6], n = Math.hypot(...l); return l.map(v => v / n); })();
	function drawCubes(cells) {
		// a cube's corners on screen, by its half-size; cubes at rest share two sizes
		const corners = new Map();
		const offsets = h => { if (!corners.has(h)) corners.set(h, CORNERS.map(q => { const r = rotate(q[0] * h, q[1] * h, q[2] * h); return [S * r[0], -S * r[1]]; })); return corners.get(h); };
		const visible = FACES.map(([n, idx]) => {
			const r = rotate(...n);
			return { idx, front: r[2] > 0.002, shade: 0.66 + 0.34 * Math.max(0, r[0] * LIGHT[0] + r[1] * LIGHT[1] + r[2] * LIGHT[2]) };
		}).filter(f => f.front);
		const list = [];
		cells.forEach((c, id) => {
			if (c.op <= 0.01 || c.sc <= 0.02) return;
			const p = project(c.x, c.y, c.z);
			if (onScreen(p)) list.push({ id, c, p });
		});
		list.sort((a, b) => a.p[2] - b.p[2]);
		faces = [];
		let hovered = null;
		list.forEach(({ id, c, p }) => {
			const off = offsets(HS * c.sc * c.u);
			const quads = visible.map(f => f.idx.map(i => [p[0] + off[i][0], p[1] + off[i][1]]));
			const strong = c.fade < 0.3;
			ctx.globalAlpha = Math.min(1, c.op);
			if (c.hollow) {
				ctx.setLineDash([2, 2]);
				visible.forEach((f, n) => poly(quads[n], null, `rgba(0,0,0,${c.fade < 0.3 ? 0.45 : 0.22})`, 0.7));
				ctx.setLineDash([]);
			} else {
				const col = FRONT.includes(c.b) || c.rail ? c.col : fade(c.col, BACK_FADE);
				visible.forEach((f, n) => poly(quads[n], rgb(col.map(v => Math.round(v * f.shade))), strong ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)', strong ? 0.8 : 0.6));
			}
			ctx.globalAlpha = 1;
			if (!c.ghost) {
				faces.push({ id, c, pts: quads });
				if (id === hoverKey) hovered = quads;
			}
		});
		return hovered;
	}

	// a node of a network: white until the sweep reaches it, then its value's colour. Drawn by flushNodes; one
	// that nothing goes through fades back by op and casts no shadow
	function drawNode(p, r, val, max, fill, id, on, hit, op = 1) {
		liftedNodes.push({ p, r, id, op, fill: fill > 0 ? rgb(fade(valueColour(val, max), 1 - fill)) : '#ffffff', stroke: on || fill > 0 ? C.ink : C.dim });
		nodeHits.push({ id, ...hit, val, fill, x: p[0], y: p[1], r: Math.max(r, 6) });
	}
	function flushNodes() {
		const disc = (n, r) => { ctx.beginPath(); ctx.arc(n.p[0], n.p[1], r, 0, 2 * Math.PI); };
		ctx.beginPath();
		liftedNodes.forEach(n => { if (n.op === 1) { ctx.moveTo(n.p[0] - OFF + n.r, n.p[1]); ctx.arc(n.p[0] - OFF, n.p[1], n.r, 0, 2 * Math.PI); } });
		ctx.fillStyle = '#000000';
		shadowed('rgba(30,30,60,0.30)', 6, OFF + 1, 3, () => ctx.fill()); // lifted clearly off the board
		liftedNodes.forEach(n => {
			ctx.globalAlpha = n.op;
			disc(n, n.r);
			ctx.fillStyle = n.fill; ctx.fill();
			ctx.lineWidth = 1; ctx.strokeStyle = n.stroke; ctx.stroke();
			ctx.globalAlpha = 1;
			if (n.id === hoverKey) { disc(n, n.r + 2.5); ctx.strokeStyle = C.gold; ctx.lineWidth = 2.4; ctx.stroke(); }
		});
		liftedNodes = [];
	}
	// a label to the right of the experts or the LM head: a name over its Mixtral size
	function sideLabel(y, name, sub, on) {
		const p = project(FX + NETW + 0.9, -y, 0);
		write(name, p[0], p[1] - (sub ? 7 : 0), `bold 12.5px ${SERIF}`, on ? C.ink : C.dim);
		if (sub) write(sub, p[0], p[1] + 7, `10px ${UI}`, on ? C.mute : C.faint);
	}
	// the largest |input × weight| over a bundle, so brightness is relative
	const brightest = (u, Wm) => { let m = 1e-9; u.forEach((ui, i) => Wm[i].forEach(w => { m = Math.max(m, Math.abs(ui * w)); })); return m; };

	// the experts, drawn as the networks they are: every weight an edge, lit by input × weight as the sweep passes.
	// The router's edges come first, into a score for each expert; then only the two experts it picks are run. The
	// other six keep their weights, but nothing goes through them
	function drawNet(s, k, SL) {
		nodeHits = [];
		const t = TOK[cur], { at, live } = sweep(s, k);
		const on = SL >= ST.norm2 && SL <= ST.down, fm = on ? 1 : 0.5;
		const P = (kind, i) => project(...netPos(kind, i));
		if (P('out', 0)[1] < -30 || P('in', 0)[1] > H + 30) return;
		const pin = range(D).map(f => P('in', f)), pout = range(D).map(f => P('out', f)), pr = range(NE).map(e => P('r', e));
		const pg = range(NN).map(n => P('g', n)), pu = range(NN).map(n => P('u', n)), pm = range(NN).map(n => P('m', n));
		// the pick, as far as it has come; the neurons of the two picked experts, in their order; what each one holds
		const picked = at(ST.route, 0.8, 0.95), slot = n => t.top.indexOf(Math.floor(n / FE));
		const run = range(NN).filter(n => slot(n) >= 0), rec = n => t.ex[slot(n)];
		const rest = n => slot(n) < 0 ? 0.05 - 0.03 * picked : 0.05; // an unlit edge; a passed-over expert's fades back
		const cr = brightest(t.hn, model.Wg), mm = Math.max(1e-9, ...t.ex.flatMap(x => x.m.map(Math.abs)));
		const most = f => Math.max(...t.ex.map(f));
		const c1 = most(x => brightest(t.hn, model.EX[x.e].W1)), c3 = most(x => brightest(t.hn, model.EX[x.e].W3));
		const c2 = most((x, n) => brightest(x.m.map(v => v * t.G[n]), model.EX[x.e].W2));
		const hovE = [];
		// each expert's box, on the front plane; the two the router opens take the board's colour
		onPlane(0, u => range(NE).forEach(e => {
			const open = t.top.includes(e) ? picked : 0;
			ctx.beginPath();
			roundRect(u(EX0(e) - 0.14), u(NY.g - 0.75), u(EW + 0.28), u(NY.m - NY.g + 1.4), u(0.3));
			if (open) { ctx.fillStyle = rgba(MOE.accent, 0.1 * open); ctx.fill(); }
			ctx.setLineDash(open ? [] : [3, 3]);
			ctx.strokeStyle = open ? rgba(MOE.accent, (0.3 + 0.4 * fm) * open) : 'rgba(0,0,0,0.16)';
			ctx.lineWidth = 1;
			ctx.stroke();
			ctx.setLineDash([]);
		}));
		// the router: W_g's edges into a score for each expert
		for (let e = 0; e < NE; e++) {
			const a0 = 0.32 + 0.4 * e / NE, done = at(ST.route, a0, a0 + 0.05), lit = live(ST.route, a0, a0 + 0.05);
			for (let f = 0; f < D; f++) {
				const w = model.Wg[f][e], id = `wg|0|${f}|${e}`;
				if (id === hoverKey) hovE.push([pin[f], pr[e]]);
				edge(pin[f], pr[e], sign(w), lit ? LIT : 0.05 + done * fm * 0.4 * Math.abs(t.hn[f] * w) / cr, lit ? 2.2 : 0.8, lit);
			}
		}
		// W3 edges into the value nodes, then W1 edges into the gate nodes
		[['w3', 1, 'W3', pu, c3], ['w1', 0, 'W1', pg, c1]].forEach(([b, h, Wn, dst, cm]) => {
			for (let n = 0; n < NN; n++) {
				const ri = run.indexOf(n), a0 = 0.3 + 0.6 * Math.max(0, ri) / run.length;
				const done = ri < 0 ? 0 : at(ST.gateUp, a0, a0 + 0.07), lit = ri >= 0 && live(ST.gateUp, a0, a0 + 0.07);
				for (let f = 0; f < D; f++) {
					const w = model.EX[Math.floor(n / FE)][Wn][f][n % FE], id = `${b}|${h}|${f}|${n}`;
					if (id === hoverKey) hovE.push([pin[f], dst[n]]);
					edge(pin[f], dst[n], sign(w), lit ? LIT : rest(n) + done * fm * 0.4 * Math.abs(t.hn[f] * w) / cm, lit ? 2.2 : 0.8, lit);
				}
			}
		});
		// each neuron: gate and value meet in the product node
		for (let n = 0; n < NN; n++) {
			const ri = run.indexOf(n), a0 = 0.15 + 0.7 * Math.max(0, ri) / run.length;
			const done = ri < 0 ? 0 : at(ST.swiglu, a0, a0 + 0.12), lit = ri >= 0 && live(ST.swiglu, a0, a0 + 0.12);
			const alpha = lit ? 0.95 : (ri < 0 ? 0.14 - 0.08 * picked : 0.14) + done * fm * 0.75 * Math.abs(rec(n)?.m[n % FE] ?? 0) / mm;
			line(pg[n], pm[n], '#45404a', alpha, lit ? 1.6 : 1);
			line(pu[n], pm[n], '#45404a', alpha, lit ? 1.6 : 1);
		}
		// W2 edges into the outputs, each picked expert's scaled by its weight from the router
		for (let j = 0; j < D; j++) {
			const a0 = 0.1 + 0.75 * j / D, done = at(ST.down, a0, a0 + 0.08), lit = live(ST.down, a0, a0 + 0.08);
			for (let n = 0; n < NN; n++) {
				const w = model.EX[Math.floor(n / FE)].W2[n % FE][j], id = `w2|0|${j}|${n}`, x = rec(n);
				if (id === hoverKey) hovE.push([pm[n], pout[j]]);
				if (!x) { line(pm[n], pout[j], sign(w), rest(n), 0.8); continue; }
				edge(pm[n], pout[j], sign(w), lit ? LIT : 0.05 + done * fm * 0.4 * Math.abs(t.G[slot(n)] * x.m[n % FE] * w) / c2, lit ? 2.2 : 0.8, lit);
			}
		}
		flushEdges();
		hovE.forEach(([a, b]) => line(a, b, C.gold, 1, 2.6));
		// the router opens the two boxes
		t.top.forEach(e => line(pr[e], project(NX.r(e), -(NY.g - 0.75), 0), rgb(MOE.accent), picked, 2));
		ctx.globalAlpha = 1;
		// the nodes fill as the sweep reaches them
		const node = (kind, i, p, val, fill, id, op) => drawNode(p, NR[kind] * S, val, 3, fill, id, on, { kind, i }, op);
		const inDone = at(ST.route, 0.18, 0.3);
		for (let f = 0; f < D; f++) node('in', f, pin[f], t.hn[f], inDone, `hc|0|${cur}|${f}`);
		for (let e = 0; e < NE; e++) { const a0 = 0.32 + 0.4 * e / NE; node('r', e, pr[e], t.r[e], at(ST.route, a0 + 0.02, a0 + 0.07), `r|0|${cur}|${e}`); }
		for (let n = 0; n < NN; n++) {
			const ri = run.indexOf(n), c = n % FE, x = rec(n);
			if (!x) { ['g', 'u', 'm'].forEach(kind => node(kind, n, P(kind, n), 0, 0, `${kind}|${kind === 'u' ? 1 : 0}|${cur}|${n}`, 1 - 0.55 * picked)); continue; }
			const a0 = 0.3 + 0.6 * ri / run.length, d = at(ST.gateUp, a0 + 0.02, a0 + 0.07), b0 = 0.15 + 0.7 * ri / run.length;
			node('g', n, pg[n], x.g[c], d, `g|0|${cur}|${n}`);
			node('u', n, pu[n], x.u[c], d, `u|1|${cur}|${n}`);
			node('m', n, pm[n], x.m[c], at(ST.swiglu, b0, b0 + 0.12), `m|0|${cur}|${n}`);
		}
		for (let j = 0; j < D; j++) { const a0 = 0.1 + 0.75 * j / D; node('out', j, pout[j], t.f[j], at(ST.down, a0, a0 + 0.08), `fc|0|${cur}|${j}`); }
		flushNodes();
		// the two picked: a ring in the board's colour and the weight each one gets
		if (picked > 0) {
			ctx.globalAlpha = picked;
			t.top.forEach((e, n) => {
				ctx.beginPath();
				ctx.arc(pr[e][0], pr[e][1], NR.r * S + 3, 0, 2 * Math.PI);
				ctx.strokeStyle = rgb(MOE.accent);
				ctx.lineWidth = 2;
				ctx.stroke();
				write(`× ${t.G[n].toFixed(2)}`, pr[e][0], pr[e][1] - NR.r * S - 5, `bold 10.5px ${UI}`, MOE.ink, 'center', 'bottom');
			});
			ctx.globalAlpha = 1;
		}
		range(NE).forEach(e => {
			const p = project(NX.r(e), -(NY.m + 1.25), 0), open = picked > 0 && t.top.includes(e);
			write(`expert ${e}`, p[0], p[1], `${open ? 'bold ' : ''}9px ${UI}`, open ? MOE.ink : on ? C.mute : C.faint, 'center');
		});
		sideLabel(NY.in, 'ĥ · 8 inputs', '4,096 in Mixtral', on);
		sideLabel(NY.r - 0.4, 'r · router scores', 'W_g, 8 × 8 edges', on);
		sideLabel((NY.r + NY.g) / 2 - 0.2, 'W1 and W3', '8 × 3 edges an expert', on);
		sideLabel(NY.g, 'g · gates', 'fed by W1', on);
		sideLabel(NY.u + 0.3, 'u · values', 'fed by W3', on);
		sideLabel(NY.m, 'm = SiLU(g) ⊙ u', '14,336 each in Mixtral', on);
		sideLabel((NY.m + NY.out) / 2 + 0.4, 'W2, then × G', '3 × 8 edges an expert', on);
		sideLabel(NY.out, 'f · 8 outputs', '4,096 in Mixtral', on);
	}

	// attention's weights, drawn as the experts' are: every entry of Wq, Wk, Wv and Wo an edge between the walls
	function drawProjections(s, k, SL) {
		const t = TOK[cur], { at, live } = sweep(s, k);
		const bundleLabel = (x, y, name, sub, on, atY) => {
			const p = project(x, y, 0), py = atY ?? p[1];
			write(name, p[0], py, `bold 11px ${SERIF}`, on ? C.ink : C.dim, 'center');
			write(sub, p[0], py + 11, `9.5px ${UI}`, on ? C.mute : C.faint, 'center');
		};
		const mid = b => { const w = WALLS[b]; return w.x + w.w * w.u / 2; }; // the middle of a wall's front layer
		// x̂ → q, k, v: from the token's row of x to the top of each wall's columns; the row itself then drops into the wall
		{
			const yt = -(WALLS.x.top + T), yb = -WALLS.q.top;
			if (project(0, yb, 0)[1] > -30 && project(0, yt, 0)[1] < H + 30) {
				const fm = SL === ST.qkv ? 1 : SL < ST.qkv ? 0 : 0.35, done = at(ST.qkv, 0.1, 0.9);
				const cm = Math.max(brightest(t.xn, model.Wq), brightest(t.xn, model.Wk), brightest(t.xn, model.Wv));
				const src = range(D).map(f => project(WALLS.x.x + f + 0.5, -(WALLS.x.top + cur + 1), 0));
				// each column of q lands over its query head's block; k and v have half as many
				[['q', model.Wq], ['k', model.Wk], ['v', model.Wv]].forEach(([b, Wm]) => {
					const n = Wm[0].length;
					for (let c = 0; c < n; c++) {
						const [cx, , cz] = cellPos(b, Math.floor(c / DH), 0, c % DH), dst = project(cx, yb + 3.6, cz), a0 = 0.1 + 0.7 * c / n, lit = live(ST.qkv, a0, a0 + 0.08);
						for (let f = 0; f < D; f++) {
							const w = Wm[f][c];
							edge(src[f], dst, sign(w), lit ? LIT : 0.04 + done * fm * 0.45 * Math.abs(t.xn[f] * w) / cm, lit ? 2 : 0.8, lit);
						}
					}
				});
				flushEdges();
				// one screen line for the three, at Wq's height: turned, the scene drops to the right and Wv would land on the Attention heading
				const atY = project(mid('q'), yt - 0.75, 0)[1];
				[['Wq', 'q', '8 × 16 edges'], ['Wk', 'k', '8 × 8 edges'], ['Wv', 'v', '8 × 8 edges']].forEach(([name, b, sub]) => bundleLabel(mid(b), yt - 0.75, name, sub, SL === ST.qkv, atY));
			}
		}
		// o → o Wo: from the bottom of o's columns to the top of h's
		{
			const yt = -(WALLS.o.top + T * WALLS.o.u), yb = -WALLS.h.top;
			if (project(0, yb, 0)[1] > -30 && project(0, yt, 0)[1] < H + 30) {
				const fm = SL === ST.wo ? 1 : SL < ST.wo ? 0 : 0.35, done = at(ST.wo, 0.1, 0.9), cm = brightest(t.cat, model.Wo);
				const src = range(NH * DH).map(c => { const [cx, , cz] = cellPos('o', Math.floor(c / DH), 0, c % DH); return project(cx, yt - 0.05, cz); });
				for (let f = 0; f < D; f++) {
					const dst = project(WALLS.h.x + f + 0.5, yb + 0.05, 0), a0 = 0.1 + 0.7 * f / D, lit = live(ST.wo, a0, a0 + 0.08);
					for (let c = 0; c < NH * DH; c++) {
						const w = model.Wo[c][f];
						edge(src[c], dst, sign(w), lit ? LIT : 0.04 + done * fm * 0.45 * Math.abs(t.cat[c] * w) / cm, lit ? 2 : 0.8, lit);
					}
				}
				flushEdges();
				bundleLabel(mid('o'), (yt + yb) / 2, 'Wo', '16 × 8 edges · the heads mix', SL === ST.wo);
			}
		}
	}

	// the mask: the cells of a that no token reads, hatched, so the staircase of weights and the grey make the full
	// square. It is the same for every head, so it is drawn once, on the back layer, which nothing lies behind
	function drawMask(SL) {
		const { x, top, w: n, u } = WALLS.a, x0 = x + (NH - 1) * SX * u, z = HS * u - (NH - 1) * HZ;
		if (project(x0, -top, z)[1] < -40 || project(x0, -(top + T * u), z)[1] > H + 40) return;
		const on = SL === ST.scores || SL === ST.softmax;
		for (let t = 0; t < T; t++) {
			for (let j = t + 1; j < n; j++) {
				const q = [[j + 0.1, t + 0.1], [j + 0.9, t + 0.1], [j + 0.9, t + 0.9], [j + 0.1, t + 0.9]].map(([i, r]) => project(x0 + i * u, -(top + r * u), z));
				poly(q, on ? 'rgba(0,0,0,0.09)' : 'rgba(0,0,0,0.05)', on ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.14)', 0.6);
				ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.stroke();
			}
		}
		const p = project(x0 + (n + 0.6) * u, -(top + u), z);
		write('mask', p[0], p[1], `bold 10px ${UI}`, on ? C.ink : C.dim);
		write('row t reads keys ≤ t', p[0], p[1] + 11, `9px ${UI}`, on ? C.mute : C.faint);
		write('grey is never read', p[0], p[1] + 21, `9px ${UI}`, on ? C.mute : C.faint);
	}

	// the LM head: z → logits → probabilities → one token
	function drawHead(s, k, SL) {
		const t = TOK[cur], { at, live } = sweep(s, k);
		const on = SL >= ST.finalNorm, fm = on ? 1 : 0.5;
		const P = (kind, i) => project(...headPos(kind, i));
		if (project(0, -HY.lab - 2, 0)[1] < -30 || project(0, -HY.in + 3, 0)[1] > H + 30) return;
		const pin = range(D).map(f => P('in', f)), pv = range(NV).map(j => P('voc', j));
		const cm = brightest(t.zn, model.WU), hovE = [];
		for (let j = 0; j < NV; j++) {
			const a0 = 0.1 + 0.75 * j / NV, done = at(ST.logits, a0, a0 + 0.04), lit = live(ST.logits, a0, a0 + 0.04);
			for (let f = 0; f < D; f++) {
				const w = model.WU[f][j], id = `wu|0|${f}|${j}`;
				if (id === hoverKey) hovE.push([pin[f], pv[j]]);
				edge(pin[f], pv[j], sign(w), lit ? LIT : 0.05 + done * fm * 0.4 * Math.abs(t.zn[f] * w) / cm, lit ? 2.2 : 0.8, lit);
			}
		}
		flushEdges();
		hovE.forEach(([a, b]) => line(a, b, C.gold, 1, 2.6));
		const zDone = at(ST.finalNorm, 0.3, 0.45);
		for (let f = 0; f < D; f++) drawNode(pin[f], 0.42 * S, t.zn[f], 3, zDone, `z|0|${cur}|${f}`, on, { kind: 'zin', i: f });
		for (let j = 0; j < NV; j++) {
			const a0 = 0.1 + 0.75 * j / NV;
			drawNode(pv[j], 0.36 * S, t.logits[j], 4, at(ST.logits, a0 + 0.02, a0 + 0.06), `lg|0|${cur}|${j}`, on, { kind: 'voc', i: j });
		}
		flushNodes();
		// the probability bars, then the pick
		const grow = at(ST.pick, 0.05, 0.55), pick = at(ST.pick, 0.6, 0.78), pmax = Math.max(...t.probs);
		let realAt = null;
		for (let j = 0; j < NV; j++) {
			const hgt = Math.max(0.04, 5.2 * t.probs[j] / pmax * grow), x = HXv(j);
			const q = [project(x - 0.32, -HY.bar, 0), project(x + 0.32, -HY.bar, 0), project(x + 0.32, -HY.bar - hgt, 0), project(x - 0.32, -HY.bar - hgt, 0)];
			const chosen = j === t.pick && pick > 0, real = j === t.nextReal;
			poly(q, chosen ? C.navy : `rgba(0,0,128,${0.25 + 0.45 * fm})`, chosen ? `rgba(200,160,0,${pick})` : null, 2.4);
			const lp = project(x, -HY.lab, 0);
			write(VOCAB[j], lp[0], lp[1], `${chosen ? 'bold ' : ''}10px ${SERIF}`, chosen ? C.navy : on ? C.ink : C.dim, 'center');
			if (grow > 0.6) write(t.probs[j] >= 0.005 ? t.probs[j].toFixed(2) : '0', lp[0], lp[1] + 11, `8.5px ${UI}`, C.mute, 'center');
			if (real) realAt = lp;
			const bc = project(x, -HY.bar - Math.max(0.5, hgt) / 2, 0);
			nodeHits.push({ id: `lg|0|${cur}|${j}`, kind: 'bar', i: j, val: t.probs[j], fill: grow, x: bc[0], y: bc[1], r: Math.max(6, 0.32 * S) });
		}
		// the word that really comes next, marked last and running left from it: turned, the labels sit higher there
		if (realAt && grow > 0) write('next in the sentence ▲', realAt[0] + 4, realAt[1] + 22, `8.5px ${UI}`, C.red, 'right');
		if (pick > 0) {
			const p = project(FX + NETW + 0.9, -(HY.bar + 2.4), 0);
			ctx.globalAlpha = pick;
			write(`next: “${VOCAB[t.pick]}”`, p[0], p[1], `bold 13px ${SERIF}`, C.navy);
			write(`greedy, p = ${t.probs[t.pick].toFixed(2)}`, p[0], p[1] + 14, `10px ${UI}`, C.mute);
			ctx.globalAlpha = 1;
		}
		sideLabel(HY.in, 'z · final RMSNorm', '4,096 in Mixtral', on);
		sideLabel((HY.in + HY.voc) / 2 + 0.2, 'W_U', '8 × 16 edges', on);
		sideLabel(HY.voc, 'logits', '32,000 in Mixtral', on);
	}

	// token names: to the right of x's rows, and to the left of a's rows, which are the queries
	function drawNames() {
		const small = `8.5px ${UI}`;
		for (let t = 0; t < T; t++) {
			const colour = t === cur ? C.navy : t < cur ? C.mute : '#b8b3bc';
			const font = `${t === cur ? 'bold ' : t > cur ? 'italic ' : ''}12px ${SERIF}`;
			const wordW = measure(WORDS[t], font), numW = measure(String(t), small);
			const px = project(WALLS.x.x + WALLS.x.w + 0.7, -(WALLS.x.top + t + 0.5), 0);
			if (onScreen(px, 10)) {
				write(WORDS[t], px[0], px[1], font, colour);
				write(String(t), px[0] + wordW + 1, px[1] + 3, small, colour);
			}
			const a = WALLS.a, pa = project(a.x - 0.35, -(a.top + (t + 0.5) * a.u), HS * a.u);
			if (onScreen(pa, 10)) {
				write(String(t), pa[0] - numW, pa[1] + 3, small, colour);
				write(WORDS[t], pa[0] - numW - 1 - wordW, pa[1], font, colour);
			}
		}
	}
	// the name over each wall, with its formula and its Mixtral size; some change with the step
	const wallLabel = (b, s) => ({
		x: s === ST.norm ? ['x̂', 'RMSNorm(x), this step', '4,096'] : ['x · input', 'the residual stream, into the layer', '4,096 a token'],
		q: ['q′', 'RoPE(x̂ Wq)', '32 × 128'],
		k: ['K′ cache', 'RoPE(x̂ Wk)', '8 × t × 128'],
		v: ['V cache', 'x̂ Wv', '8 × t × 128'],
		a: s === ST.scores ? ['scores', 'q′K′ᵀ ÷ √dₕ', '32 × t'] : ['a', 'softmax(q′K′ᵀ ÷ √dₕ)', '32 × t'],
		o: ['o', 'a V', '32 × 128'],
		h: s === ST.wo ? ['o Wo', 'concat(o) Wo, leaving attention', '4,096'] : s === ST.norm2 ? ['ĥ', 'RMSNorm(h), this step', '4,096'] : ['h · intermediate', 'x + attention', '4,096'],
		y: ['y · output', 'h + f, to layer 2', '4,096'],
	}[b]);
	function drawWallLabels(SL) {
		Object.keys(WALLS).forEach(b => {
			const [name, formula, size] = wallLabel(b, SL), on = FOCUS[SL].includes(b), w = WALLS[b];
			const back = FRONT.includes(b) ? 0 : NH - 1, p = project(w.x + back * SX * w.u, -w.top + 0.3, HS * w.u - back * HZ);
			if (p[1] < -10 || p[1] > H + 60) return;
			// k and v count the heads GQA keeps against multi-head attention's, whose empty layers show the rest
			const heads = b === 'k' || b === 'v' ? `${NKV} of MHA’s ${NH} heads` : '', up = heads ? 12 : 0;
			write(name, p[0], p[1] - 26 - up, `bold 13px ${SERIF}`, on ? C.ink : C.dim, 'left', 'bottom');
			write(formula, p[0], p[1] - 13 - up, `10.5px ${UI}`, on ? C.ink : C.dim, 'left', 'bottom');
			write('Mixtral ' + size, p[0], p[1] - up, `10.5px ${UI}`, on ? C.mute : C.faint, 'left', 'bottom');
			if (heads) write(heads, p[0], p[1], `9px ${UI}`, on ? C.mute : C.faint, 'left', 'bottom');
		});
	}

	// ---- the maths: TeX helpers ---------------------------------------------------------
	const R = String.raw;
	const tex = (src, display) => window.katex
		? katex.renderToString(src, { displayMode: !!display, fleqn: true, throwOnError: false, strict: false })
		: `<code>${esc(src)}</code>`;
	const mx = (src, cls) => `<div class="toy-mx${cls ? ' ' + cls : ''}">${tex(src, true)}</div>`;
	const note = html => `<p class="toy-mnote">${html}</p>`;
	// prose from the data file: $$…$$ is a display line, $…$ inline
	const typeset = html => html.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => mx(t)).replace(/\$([^$]+?)\$/g, (_, t) => tex(t));
	// a point or a note: TeX as above, **bold** and `code`
	const md = s => typeset(s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`));
	const points = list => `<ul class="toy-pts">${list.map(s => `<li>${md(s)}</li>`).join('')}</ul>`;
	const codeHtml = src => esc(src).replace(/(^|\s)(#.*)$/gm, '$1<span class="cm">$2</span>');
	const code = src => `<pre class="toy-code">${codeHtml(src)}</pre>`;
	// the toy against Mixtral 8x7B, a row a quantity
	const scale = rows => `<table class="toy-dims toy-scale"><thead><tr><th></th><th>toy</th><th>Mixtral 8x7B</th></tr></thead><tbody>`
		+ rows.map(r => `<tr>${r.map(c => `<td>${typeset(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
	const num = (v, d = 2) => { const s = Math.abs(v).toFixed(d); return (v < 0 && +s !== 0 ? '-' : '') + s; };
	const par = (v, d = 2) => num(v, d)[0] === '-' ? `(${num(v, d)})` : num(v, d);
	const rowv = (vals, d = 2, split = 0) => R`\bigl(` + vals.map((v, i) => (i === 0 ? '' : split && i % split === 0 ? R`\;\big|\;` : R`,\,`) + num(v, d)).join('') + R`\bigr)`;
	const prods = (a, b, da = 2, db = 1) => a.map((v, i) => R`${par(v, da)}\cdot ${par(b[i], db)}`);
	const chunk = (terms, per) => { const L = []; for (let i = 0; i < terms.length; i += per) L.push(terms.slice(i, i + per).join(' + ')); return L; };
	const aligned = rows => R`\begin{aligned}` + rows.map(([l, r]) => `${l} &${r}`).join(R` \\[2pt] `) + R`\end{aligned}`;
	// a sum written out: its definition, the terms `per` to a line, then the value
	const sumRows = (lhs, def, terms, per, res, d = 2) => [[lhs, `= ${def}`], ...chunk(terms, per).map((l, i) => ['', (i ? R`\quad + ` : '= ') + l]), ['', R`\approx ` + num(res, d)]];
	const word = w => w[0] === '<' ? R`\texttt{` + w.replace('<', R`\textless{}`).replace('>', R`\textgreater{}`) + '}' : R`\text{` + w + '}';
	const argmax = a => a.indexOf(Math.max(...a));
	const argabs = a => a.reduce((best, v, i) => Math.abs(v) > Math.abs(a[best]) ? i : best, 0);
	const repeatKV = v => range(NH).flatMap(n => v.slice(kvOf(n) * DH, kvOf(n) * DH + DH)); // a key-value row, a copy for each query head
	// RMSNorm by hand: the sum of squares, the rms, the division
	const rmsRows = (b, p, u, d, rms, out, gain) => {
		const sq = u.map(v => `${par(v, d)}^2`), sum = u.reduce((a, v) => a + v * v, 0), rel = d === 1 ? '=' : R`\approx`;
		return mx(aligned([
			[R`\textstyle\sum_i ${b}_{${p},i}^2`, '= ' + sq.slice(0, 4).join(' + ')],
			['', R`\quad + ` + sq.slice(4).join(' + ') + ` ${rel} ${num(sum)}`],
			[R`\operatorname{rms}(${b}_{${p}})`, R`= \sqrt{${num(sum)}/8 + 10^{-5}} \approx ${num(rms, 3)}`],
			[`${out}_{${p}}`, R`= ${b}_{${p}} / ${num(rms, 3)} \odot ${gain}`],
		])) + note(`${tex(gain + ' = 1')} in the toy, so ${tex(R`\operatorname{rms}(${out}_{${p}}) = 1`)} afterwards, up to ${tex(R`\varepsilon`)}.`);
	};
	// column addition for the residual: two rows and their sum, entries lined up
	const colAdd = (a, b, c) => mx(R`\begin{array}{rrc` + 'r'.repeat(D) + '}'
		+ [[' ', ...a], ['+', ...b]].map(([sg, l, rel, v, d]) => `${sg} & ${l} & ${rel} & ` + v.map(x => num(x, d)).join(' & ')).join(R` \\ `)
		+ R` \\ \hline & ${c[0]} & ${c[1]} & ` + c[2].map(x => num(x, 2)).join(' & ') + R`\end{array}`, 'tight');
	// the head and key the derivation follows: a repeated word if there is one (it shows RoPE at work), else the strongest key
	const focusKey = p => {
		let j1 = -1, j2 = -1;
		for (let j = p; j >= 0 && j1 < 0; j--) { const i = WORDS.indexOf(WORDS[j]); if (i < j) { j1 = i; j2 = j; } }
		const most = f => argmax(range(NH).map(f));
		if (j1 >= 0) return { nh: most(h => Math.abs(TOK[p].heads[h].sc[j2] - TOK[p].heads[h].sc[j1])), j: j2, j1 };
		const nh = most(h => Math.max(...TOK[p].heads[h].w));
		return { nh, j: argmax(TOK[p].heads[nh].w), j1: -1 };
	};

	// ---- by hand: one entry of the current step, worked in the token's values --------------
	// The whole rows are the PyTorch part's print and the cells; here one entry is worked out.
	function numbers(p, s) {
		const t = TOK[p], V = VOCAB;
		const by = {
			[ST.arrive]: () => {
				const i = WORDS.indexOf(WORDS[p]);
				return mx(aligned([[`x_{${p}}`, R`= E_{${word(WORDS[p])}}`], ['', '= ' + rowv(t.x, 1)]]))
					+ (i < p ? note(`${tex(`x_{${p}} = x_{${i}}`)}: same word, same row. The embedding knows the word, not the position; position enters only through RoPE, in step (4).`) : '');
			},
			[ST.norm]: () => rmsRows('x', p, t.x, 1, t.rms, R`\hat x`, R`\gamma_1`),
			[ST.qkv]: () => {
				const c = argabs(t.q);
				return mx(aligned(sumRows(`q_{${p},${c}}`, R`\textstyle\sum_i \hat x_{${p},i}\,(W_q)_{i,${c}}`, prods(t.xn, model.Wq.map(r => r[c])), 3, t.q[c])))
					+ note(`Entry ${c} of ${tex(`q_{${p}}`)}, its largest. Every entry of ${tex('q')}, ${tex('k')} and ${tex('v')} is such a sum of 8 products, 32 sums in all.`);
			},
			[ST.rope]: () => {
				const c = Math.cos(p), sn = Math.sin(p), [a, b] = t.q, [a2, b2] = t.qr, slow = p * THETA[1];
				return mx(aligned([
					[R`t\,\theta`, R`= ${p}\cdot(1,\ 0.001) = (${p},\ ${num(slow, 3)})\ \text{rad}`],
					[R`(q'_{${p},0},\ q'_{${p},1})`, R`= (q_{${p},0},\ q_{${p},1})\; R(${p})`],
					['', R`= (${num(a)},\ ${num(b)}) \begin{pmatrix} ${num(c)} & ${num(sn)} \\ ${num(-sn)} & ${num(c)} \end{pmatrix}`],
					['', R`\approx (${num(a2)},\ ${num(b2)})`],
				])) + note(`Pair 0 of head 0. A turn keeps length: ${tex(R`\lVert(q_{${p},0},\, q_{${p},1})\rVert = \lVert(q'_{${p},0},\, q'_{${p},1})\rVert \approx ${num(Math.hypot(a, b))}`)}. ${p ? `Pair 1 turns by only ${num(slow, 3)} rad: Mixtral’s base of 1,000,000 makes it ten times slower than LLaMA’s 10,000 would, ${num(p * 0.01)}.` : `At position 0 nothing turns: ${tex('R(0)')} is the identity.`}`);
			},
			[ST.cache]: () => {
				const stack = (M, r) => p ? R`\begin{bmatrix} ${M}_{<${p}} \\ ${r}_{${p}} \end{bmatrix}` : `${r}_{0}`;
				return mx(aligned([
					[R`K'_{\le ${p}}`, R`= ${stack("K'", "k'")},\quad V_{\le ${p}} = ${stack('V', 'v')}`],
					[`k'_{${p}}`, R`\approx ` + rowv(t.kr, 2, 4)],
					[`v_{${p}}`, R`\approx ` + rowv(t.v, 2, 4)],
				])) + note(p ? `Rows ${tex(R`0, \dots, ${p - 1}`)} came from earlier passes. Row ${p} is new, and stays for every later token.` : 'The cache was empty: row 0 is its first.');
			},
			[ST.repeat]: () => mx(aligned([
				[`k'_{${p}}`, R`\approx ` + rowv(t.kr, 2, 4)],
				[`k'_{${p}}C`, R`= \big[\,k'^{(0)}_{${p}},\ k'^{(0)}_{${p}},\ k'^{(1)}_{${p}},\ k'^{(1)}_{${p}}\,\big]`],
			])) + note(`Each block row of ${tex('C')} copies one key-value head into the places of its group’s two query heads, and ${tex(`v_{${p}}C`)} alike.`),
			[ST.scores]: () => {
				const { nh, j, j1 } = focusKey(p), g = kvOf(nh), hd = t.heads[nh], hs = `^{(${nh})}`, gs = `^{(${g})}`;
				const pr = prods(t.qr.slice(nh * DH, nh * DH + DH), TOK[j].kr.slice(g * DH, g * DH + DH), 2, 2);
				return mx(aligned([
					[`s${hs}_{${p},${j}}`, R`= \tfrac{1}{\sqrt{4}}\; q'${hs}_{${p}} \cdot k'${gs}_{${j}}`],
					['', R`= \tfrac12\big(` + pr.slice(0, 2).join(' + ')],
					['', R`\quad + ` + pr.slice(2).join(' + ') + R`\big)`],
					['', R`\approx ${num(hd.sc[j])}`],
					...(j1 >= 0 ? [[`s${hs}_{${p},${j1}}`, R`\approx ${num(hd.sc[j1])}`]] : []),
				])) + note(`Query heads ${g * GRP} and ${g * GRP + 1} both read key head ${g}.`
					+ (j1 >= 0 ? ` ${tokHtml(j1)} and ${tokHtml(j)} are one word, so ${tex(`k_{${j1}} = k_{${j}}`)} before RoPE. Their scores differ only through the offsets, ${tex(`${p} - ${j1} = ${p - j1}`)} and ${tex(`${p} - ${j} = ${p - j}`)}.` : ''));
			},
			[ST.softmax]: () => {
				const { nh, j } = focusKey(p), hd = t.heads[nh], hs = `^{(${nh})}`, e = hd.sc.map(Math.exp);
				return mx(aligned([
					[`a${hs}_{${p},${j}}`, R`= \dfrac{e^{s${hs}_{${p},${j}}}}{\sum_{k=0}^{${p}} e^{s${hs}_{${p},k}}}`],
					['', R`= \dfrac{${num(e[j])}}{${e.map(v => num(v)).join(' + ')}}`],
					['', R`\approx ${num(hd.w[j])}`],
				])) + note(`Head ${nh}, key ${tokHtml(j)}. The row of ${tex(`a${hs}_{${p}}`)} sums to 1.`);
			},
			[ST.blend]: () => {
				const { nh } = focusKey(p), g = kvOf(nh), hd = t.heads[nh], hs = `^{(${nh})}`, i = argabs(hd.o);
				return mx(aligned(sumRows(`o${hs}_{${p},${i}}`, R`\textstyle\sum_{j=0}^{${p}} a${hs}_{${p},j}\; v^{(${g})}_{j,${i}}`, prods(hd.w, TOK.slice(0, p + 1).map(r => r.v[g * DH + i]), 2, 2), 3, hd.o[i])))
					+ note(`Every weight of ${tex(`a${hs}_{${p}}`)} meets its own row of ${tex(`V^{(${g})}`)}, the value head that heads ${g * GRP} and ${g * GRP + 1} share.`);
			},
			[ST.wo]: () => {
				const c = argabs(t.att);
				return mx(aligned(sumRows(`(o_{${p}}W_o)_{${c}}`, R`\textstyle\sum_k o_{${p},k}\,(W_o)_{k,${c}}`, prods(t.cat, model.Wo.map(r => r[c])), 3, t.att[c])))
					+ note(`Entry ${c}, the largest: 16 products, four from each head.`);
			},
			[ST.add]: () => colAdd([`x_{${p}}`, '=', t.x, 2], [`o_{${p}}W_o`, R`\approx`, t.att, 2], [`h_{${p}}`, R`\approx`, t.out]),
			[ST.norm2]: () => rmsRows('h', p, t.out, 2, t.hrms, R`\hat h`, R`\gamma_2`),
			[ST.route]: () => {
				const [e1, e2] = t.top, [G1, G2] = t.G, ex = e => R`^{[${e}]}`;
				return mx(aligned(sumRows(`r_{${p},${e1}}`, R`\textstyle\sum_i \hat h_{${p},i}\,(W_g)_{i,${e1}}`, prods(t.hn, model.Wg.map(r => r[e1])), 3, t.r[e1])))
					+ mx(aligned([
						[R`\operatorname{top}_2(r_{${p}})`, R`= \{${e1},\ ${e2}\}`],
						[R`(G${ex(e1)},\ G${ex(e2)})`, R`= \operatorname{softmax}(${num(t.r[e1])},\ ${num(t.r[e2])})`],
						['', R`= \Big(\tfrac{1}{1 + e^{${num(t.r[e2] - t.r[e1])}}},\ \tfrac{1}{1 + e^{${num(t.r[e1] - t.r[e2])}}}\Big) \approx (${num(G1)},\ ${num(G2)})`],
					])) + note(`Expert ${e1} has the top score and expert ${e2} the next. The other six get no weight and are never run for this token.`);
			},
			[ST.gateUp]: () => {
				const x = t.ex[0], c = argabs(x.g), ex = R`^{[${x.e}]}`;
				return mx(aligned([
					...sumRows(`g${ex}_{${p},${c}}`, R`\textstyle\sum_i \hat h_{${p},i}\,(W${ex}_1)_{i,${c}}`, prods(t.hn, model.EX[x.e].W1.map(r => r[c])), 3, x.g[c]),
					[`u${ex}_{${p},${c}}`, R`= \textstyle\sum_i \hat h_{${p},i}\,(W${ex}_3)_{i,${c}} \approx ${num(x.u[c])}`],
				])) + note(`Expert ${x.e}’s neuron ${c}, the one with its largest gate. The other 18 neurons stay idle.`);
			},
			[ST.swiglu]: () => {
				const x = t.ex[0], c = argabs(x.g), ex = R`^{[${x.e}]}`, all = t.ex.flatMap(y => y.g.map((g, i) => [g, y, i]));
				const [g2, y, c2] = all.reduce((lo, a) => a[0] < lo[0] ? a : lo), ey = R`^{[${y.e}]}`;
				return mx(aligned([
					[`m${ex}_{${p},${c}}`, R`= \operatorname{SiLU}(g${ex}_{${p},${c}})\; u${ex}_{${p},${c}}`],
					['', R`= \dfrac{${num(x.g[c])}}{1 + e^{${num(-x.g[c])}}} \cdot ${par(x.u[c])}`],
					['', R`\approx ${num(x.sg[c])} \cdot ${par(x.u[c])} \approx ${num(x.m[c])}`],
					[R`\operatorname{SiLU}(g${ey}_{${p},${c2}})`, R`= \operatorname{SiLU}(${num(g2)}) \approx ${num(y.sg[c2])}`],
				])) + note('The last line is the lowest of the six gates, all but shut.');
			},
			[ST.down]: () => {
				const i = argabs(t.f), [a, b] = t.ex, [Ga, Gb] = t.G, ea = R`^{[${a.e}]}`, eb = R`^{[${b.e}]}`;
				return mx(aligned([
					...sumRows(R`(m${ea}_{${p}} W${ea}_2)_{${i}}`, R`\textstyle\sum_{c=0}^{2} m${ea}_{${p},c}\,(W${ea}_2)_{c,${i}}`, prods(a.m, model.EX[a.e].W2.map(r => r[i]), 2, 1), 3, a.f[i]),
					[R`(m${eb}_{${p}} W${eb}_2)_{${i}}`, R`\approx ${num(b.f[i])}`],
					[`f_{${p},${i}}`, R`= G${ea}\,(m${ea}_{${p}} W${ea}_2)_{${i}} + G${eb}\,(m${eb}_{${p}} W${eb}_2)_{${i}}`],
					['', R`= ${num(Ga)}\cdot ${par(a.f[i])} + ${num(Gb)}\cdot ${par(b.f[i])} \approx ${num(t.f[i])}`],
				])) + note(`Entry ${i}, the largest of ${tex(`f_{${p}}`)}.`);
			},
			[ST.add2]: () => colAdd([`h_{${p}}`, R`\approx`, t.out, 2], [`f_{${p}}`, R`\approx`, t.f, 2], [`y_{${p}}`, R`\approx`, t.y]),
			[ST.finalNorm]: () => rmsRows('y', p, t.y, 2, t.zrms, 'z', R`\gamma_f`),
			[ST.logits]: () => {
				const js = argmax(t.logits), wj = word(V[js]);
				return mx(aligned(sumRows(R`\ell_{${p},${wj}}`, R`z_{${p}} \cdot (W_U)_{:,${wj}}`, prods(t.zn, model.WU.map(r => r[js])), 3, t.logits[js])))
					+ note('The largest logit. There is one such dot product for every token in the vocabulary: 16 here, 32,000 in Mixtral.');
			},
			[ST.pick]: () => {
				const Z = t.logits.reduce((a, l) => a + Math.exp(l), 0), wp = word(V[t.pick]), nr = t.nextReal, wn = nr >= 0 ? word(V[nr]) : '';
				const losses = TOK.slice(0, T - 1).map(r => -Math.log(r.probs[r.nextReal])), mean = losses.reduce((a, b) => a + b, 0) / losses.length;
				return mx(aligned([
					[`p_{${p},${wp}}`, R`= e^{\ell_{${p},${wp}}} \big/ \textstyle\sum_{w} e^{\ell_{${p},w}}`],
					['', R`= ${num(Math.exp(t.logits[t.pick]))} / ${num(Z)} \approx ${num(t.probs[t.pick], 3)}`],
					[R`\hat w_{${p + 1}}`, R`= \arg\max_w\, p_{${p},w} = ${wp}`],
					...(nr >= 0 ? [[R`\mathcal{L}_{${p}}`, R`= -\log p_{${p},${wn}} = -\log ${num(t.probs[nr], 3)} \approx ${num(-Math.log(t.probs[nr]))}`]] : []),
				])) + (nr >= 0 ? '' : note(`The sentence ends here; in generation <i>${esc(V[t.pick])}</i> would become position ${p + 1}.`))
					+ mx(R`\mathcal{L} = \tfrac{1}{5}\textstyle\sum_{t=0}^{4} \mathcal{L}_t \approx ${num(mean)}`)
					+ note(`The loss over the sentence: one prediction per position, all from one prefill. Guessing uniformly gives ${tex(R`\log 16 \approx 2.77`)}${mean > Math.log(16) ? ', so the random toy does worse than guessing' : ''}.`);
			},
		};
		return by[s]();
	}

	// ---- the captions: what the cubes are doing, in a sentence or two -------------------------
	function caption(p, s) {
		const t = TOK[p], w = `<i>${WORDS[p]}</i>`;
		const best = h => { const ws = t.heads[h].w, j = argmax(ws); return `<i>${tokName(j)}</i> (${ws[j].toFixed(2)})`; };
		const by = {
			[ST.arrive]: () => `${w} arrives at position ${p}, and its row of x lights up.${p ? ' The pale rows above are earlier tokens; this layer kept only their keys and values.' : ''}`,
			[ST.norm]: () => `RMSNorm divides the row by its root mean square, ${fmt(t.rms, 2)}, so the branch works at unit scale.`,
			[ST.qkv]: () => 'Wq, Wk and Wv make q, k and v. q folds into four heads, a layer each; k and v into two, in the layers of heads 0 and 2, and the layers of heads 1 and 3 stay empty.',
			[ST.rope]: () => `RoPE turns q and k pair by pair: pair 0 by ${p} rad, pair 1 by ${(p * THETA[1]).toFixed(3)}. Dashed is before, solid after, red the turn.`,
			[ST.cache]: () => `k′ and v drop into row ${p} of the cache. The empty grids are the heads multi-head attention would also keep.`,
			[ST.repeat]: () => 'Each key and value head is copied for the second query head of its group, filling the empty layers for this pass only.',
			[ST.scores]: () => 'Each query head scores every cached key of its group, and a new row of scores grows in each layer of a.',
			[ST.softmax]: () => p ? `Each head’s scores become weights. Heads 0 and 1 scored the same keys, yet head 0 puts most on ${best(0)} and head 1 on ${best(1)}.` : 'Each head’s scores become weights; with one key, every weight is 1.',
			[ST.blend]: () => 'Every row of V arrives scaled by its weight, bright where the weight is large, and the rows sum to o.',
			[ST.wo]: () => 'The four head layers unfold into one row, and Wo mixes them.',
			[ST.add]: () => 'x comes down the rail and is added: h = x + o Wo. Attention is done.',
			[ST.norm2]: () => `The experts start with their own RMSNorm: h is divided by ${fmt(t.hrms, 2)}.`,
			[ST.route]: () => `The router scores all eight experts. Experts ${t.top[0]} and ${t.top[1]} score highest and open, weighed ${t.G[0].toFixed(2)} and ${t.G[1].toFixed(2)}; the other six are skipped.`,
			[ST.gateUp]: () => `Only experts ${t.top[0]} and ${t.top[1]} run. Their edges light by input × weight as the sweep passes; the idle experts’ stay dark.`,
			[ST.swiglu]: () => `Each gate passes through SiLU and scales its value. ${t.ex.flatMap(x => x.g).filter(v => v < 0).length} of the 6 gates are negative, and those neurons are nearly shut.`,
			[ST.down]: () => `Each running expert writes all 8 outputs from its 3 neurons, and the router mixes the two: f = ${t.G[0].toFixed(2)} · expert ${t.top[0]} + ${t.G[1].toFixed(2)} · expert ${t.top[1]}.`,
			[ST.add2]: () => `The outputs drop back into the residual row, and h comes down the rail: y = h + f.`,
			[ST.finalNorm]: () => `In Mixtral, y would pass 31 more layers first. A final RMSNorm divides it by ${fmt(t.zrms, 2)}.`,
			[ST.logits]: () => 'Each logit is z dotted with one token’s column of W_U, and the sweep fills them one at a time.',
			[ST.pick]: () => `Greedy decoding picks the most probable token: <i>${esc(VOCAB[t.pick])}</i> (${t.probs[t.pick].toFixed(2)}). `
				+ (t.nextReal >= 0
					? `The sentence goes on with <i>${esc(VOCAB[t.nextReal])}</i>, at ${t.probs[t.nextReal].toFixed(3)}; −log of it, ${(-Math.log(t.probs[t.nextReal])).toFixed(2)}, is the loss here.`
					: 'In generation the pick would be appended as position 6 and fed back in.'),
		};
		return by[s]();
	}

	// ---- the cells: each step's numbers as a small SVG, hoverable both ways -----------------
	const CW = 26, CH = 18, VX = 92;
	function cell(x, y, v, key, max = 3, w = CW, kind = 'v', small = false) {
		const k = kind === 'w' ? Math.min(1, v) * 0.92 : strength(v, max);
		const fill = kind === 'w' ? rgb(weightColour(v)) : rgb(valueColour(v, max));
		return `<g${key ? ` data-k="${key}"` : ''}><rect x="${x}" y="${y}" width="${w}" height="${CH}" fill="${fill}" class="cl"/>`
			+ `<text x="${x + w / 2}" y="${y + 12.5}" fill="${textOn(k)}" class="${small ? 'cv9' : 'cv'}" text-anchor="middle">${kind === 'w' ? v.toFixed(2) : fmt(v)}</text></g>`;
	}
	// a RoPE dial: the pair before the turn dashed, after it solid, the turn as a red arc
	function dial(cx, cy, a, b, a2, b2, d, colour) {
		const RD = 13, len = Math.min(RD - 1.5, Math.hypot(a, b) * 3.6), f0 = Math.atan2(b, a), f1 = Math.atan2(b2, a2);
		const pt = (f, r) => [(cx + r * Math.cos(f)).toFixed(1), (cy - r * Math.sin(f)).toFixed(1)];
		let s = `<circle cx="${cx}" cy="${cy}" r="${RD}" class="dl"/><path d="M${cx - RD},${cy}h${2 * RD}M${cx},${cy - RD}v${2 * RD}" class="dax"/>`;
		if (d > 0.1) s += `<path d="M${pt(f0, 6)}A6,6 0 ${(d % (2 * Math.PI)) > Math.PI ? 1 : 0} 0 ${pt(f0 + d, 6)}" class="darc"/>`;
		const e1 = pt(f1, len);
		return s + `<path d="M${cx},${cy}L${pt(f0, len)}" class="dbe"/><path d="M${cx},${cy}L${e1}" stroke="${colour}" stroke-width="2"/><circle cx="${e1[0]}" cy="${e1[1]}" r="1.8" fill="${colour}"/>`;
	}
	// a sheet of rows, drawn top down: a label at the left, cells to the right of VX
	class Sheet {
		constructor(p) { this.p = p; this.o = []; this.y = 4; }
		push(...parts) { this.o.push(...parts); }
		lab(yy, name, sub) {
			this.push(`<text x="${VX - 8}" y="${yy + 13}" class="pl" text-anchor="end">${sub ? `<tspan class="ps">${sub}</tspan><tspan dx="6" class="pv">${name}</tspan>` : `<tspan class="pv">${name}</tspan>`}</text>`);
		}
		v8(vals, keyf, name, sub, max = 3) { // a row of 8, split in halves
			this.lab(this.y, name, sub);
			vals.forEach((v, f) => this.push(cell(VX + f * 30 + (f >= 4 ? 6 : 0), this.y, v, keyf(f), max, 30)));
			this.y += 26;
		}
		q16(vals, keyf, name, sub) { // a row of 16 as four heads of 4, a group to a line: heads 0 and 1 over heads 2 and 3
			this.lab(this.y, name, sub);
			vals.forEach((v, f) => {
				const n = Math.floor(f / DH);
				this.push(cell(VX + (n % GRP) * (DH * CW + 6) + (f % DH) * CW, this.y + kvOf(n) * 20, v, keyf(f), 3, CW, 'v', true));
			});
			range(NKV).forEach(g => this.push(`<text x="${VX + GRP * (DH * CW + 6) + 2}" y="${this.y + g * 20 + 13}" class="hl">heads ${g * GRP}, ${g * GRP + 1}</text>`));
			this.y += 46;
		}
		kv8(vals, keyf, name, sub) { // a row of 8 as two key-value heads of 4, each on its group's line, under its two query heads
			this.lab(this.y, name, sub);
			vals.forEach((v, f) => this.push(cell(VX + (GRP - 1) * (DH * CW + 6) / 2 + (f % DH) * CW, this.y + Math.floor(f / DH) * 20, v, keyf(f), 3, CW, 'v', true)));
			range(NKV).forEach(g => this.push(`<text x="${VX + GRP * (DH * CW + 6) + 2}" y="${this.y + g * 20 + 13}" class="hl">kv head ${g}</text>`));
			this.y += 46;
		}
		ex6(vals, keyf, name, sub) { // the two running experts' 3 neurons each
			this.lab(this.y, name, sub);
			vals.forEach((v, c) => this.push(cell(VX + c * 30 + (c >= FE ? 12 : 0), this.y, v, keyf(c), 3, 30)));
			this.y += 26;
		}
		op(txt) { this.push(`<text x="${VX}" y="${this.y + 11}" class="po">${txt}</text>`); this.y += 18; }
		head(txt) { this.push(`<text x="${VX}" y="${this.y + 9}" class="hl">${txt}</text>`); this.y += 14; }
		tok(yy, j) { this.push(`<text x="${VX - 8}" y="${yy + 13}" class="rl${j === this.p ? ' cur' : ''}" text-anchor="end">${tokName(j)}</text>`); }
		svg() { return `<svg viewBox="0 0 ${VX + 300} ${this.y + 4}" role="img" aria-label="The arithmetic for this step">${this.o.join('')}</svg>`; }
	}
	function panelSVG(p, s) {
		const t = TOK[p], sh = new Sheet(p), V = VOCAB;
		const kx = f => `x|0|${p}|${f}`, kh = b => f => `${b}|${Math.floor(f / DH)}|${p}|${f % DH}`, k8 = b => f => `${b}|0|${p}|${f}`;
		// a running neuron's key, by its place among the six: the network numbers all 24
		const kn = b => c => `${b}|${b === 'u' ? 1 : 0}|${p}|${t.ex[Math.floor(c / FE)].e * FE + c % FE}`;
		const six = key => t.ex.flatMap(x => x[key]);
		const experts = () => { t.ex.forEach((x, n) => sh.push(`<text x="${VX + n * 102}" y="${sh.y + 8}" class="hl">expert ${x.e} · × ${t.G[n].toFixed(2)}</text>`)); sh.y += 12; };
		const vlab = (x, yy, j) => sh.push(`<text x="${x}" y="${yy}" class="hl" text-anchor="middle">${esc(V[j])}</text>`);
		const by = {
			[ST.arrive]: () => sh.v8(t.x, kx, 'x', `${WORDS[p]} arrives`),
			[ST.norm]: () => { sh.v8(t.x, kx, 'x'); sh.op(`÷ rms(x) = ${fmt(t.rms, 3)}, then × gain (1 here)`); sh.v8(t.xn, kx, 'x̂'); },
			[ST.qkv]: () => { sh.v8(t.xn, kx, 'x̂'); sh.y += 6; sh.q16(t.q, kh('q'), 'q', 'x̂ Wq'); sh.kv8(t.k, kh('k'), 'k', 'x̂ Wk'); sh.kv8(t.v, kh('v'), 'v', 'x̂ Wv'); },
			[ST.rope]: () => {
				sh.q16(t.q, kh('q'), 'q'); sh.q16(t.qr, kh('q'), 'q′', 'turned'); sh.y += 4; sh.kv8(t.k, kh('k'), 'k'); sh.kv8(t.kr, kh('k'), 'k′', 'turned'); sh.y += 10;
				// a group at a time: its two query heads' pairs, then its key head's pairs under them
				range(NKV).forEach(g => {
					const y = sh.y;
					[g * GRP, g * GRP + 1].forEach((n, r) => [0, 1].forEach(pr => {
						const i = n * DH + 2 * pr, x = VX + 14 + r * 120 + pr * 52;
						sh.push(`<text x="${x}" y="${y + 8}" class="hl" text-anchor="middle">h${n} pair ${pr}</text>`, dial(x, y + 26, t.q[i], t.q[i + 1], t.qr[i], t.qr[i + 1], p * THETA[pr], '#3d63c4'));
					}));
					[0, 1].forEach(pr => {
						const i = g * DH + 2 * pr, x = VX + 74 + pr * 52;
						sh.push(`<text x="${x}" y="${y + 52}" class="hl" text-anchor="middle">kv${g} pair ${pr}</text>`, dial(x, y + 70, t.k[i], t.k[i + 1], t.kr[i], t.kr[i + 1], p * THETA[pr], '#c8741f'));
					});
					sh.push(`<text x="${VX - 8}" y="${y + 30}" class="pl" text-anchor="end"><tspan class="pv">q</tspan></text><text x="${VX - 8}" y="${y + 74}" class="pl" text-anchor="end"><tspan class="pv">k</tspan></text>`);
					sh.y += 92;
				});
			},
			// the token's cached row, then that row per query head: the second of each group reading a copy
			[ST.repeat]: () => [['k′', t.kr, 'k', 'kc'], ['v', t.v, 'v', 'vc']].forEach(([name, vals, b, bc]) => {
				sh.kv8(vals, kh(b), name, 'cached');
				sh.op('× C: a copy for each group’s second head');
				sh.q16(repeatKV(vals), f => { const n = Math.floor(f / DH); return `${n % GRP ? bc : b}|${kvOf(n)}|${p}|${f % DH}`; }, name, 'per head');
				sh.y += 6;
			}),
			[ST.cache]: () => [['K′ cache', j => TOK[j].kr, 'k'], ['V cache', j => TOK[j].v, 'v']].forEach(([title, vals, b]) => {
				sh.head(`${title} · kv head 0 | kv head 1`);
				for (let j = 0; j <= p; j++) {
					sh.tok(sh.y, j);
					vals(j).forEach((v, f) => sh.push(cell(VX + f * 30 + Math.floor(f / DH) * 6, sh.y, v, `${b}|${Math.floor(f / DH)}|${j}|${f % DH}`, 3, 30)));
					if (j === p) sh.push(`<rect x="${VX - 1.5}" y="${sh.y - 1.5}" width="${NKV * DH * 30 + 9}" height="${CH + 3}" class="new"/>`);
					sh.y += 19;
				}
				sh.y += 8;
			}),
			// a key head's rows once, with the scores of the two query heads that read them beside each
			[ST.scores]: () => range(NKV).forEach(g => {
				const hs = [g * GRP, g * GRP + 1], sl = (v, n) => v.slice(n * DH, n * DH + DH);
				sh.head(`kv head ${g}: its keys meet q′ of heads ${hs[0]} and ${hs[1]}`);
				hs.forEach(h => {
					sh.lab(sh.y, 'q′' + SUB[h]);
					sl(t.qr, h).forEach((v, i) => sh.push(cell(VX + i * 30, sh.y, v, `q|${h}|${p}|${i}`, 3, 30)));
					sh.y += 20;
				});
				hs.forEach((h, c) => sh.push(`<text x="${VX + 150 + c * 70 + 30}" y="${sh.y + 8}" class="hl" text-anchor="middle">head ${h}</text>`));
				sh.y += 12;
				for (let j = 0; j <= p; j++) {
					sh.tok(sh.y, j);
					sl(TOK[j].kr, g).forEach((v, i) => sh.push(cell(VX + i * 30, sh.y, v, `k|${g}|${j}|${i}`, 3, 30)));
					sh.push(`<text x="${VX + 126}" y="${sh.y + 13}" class="po">→</text>`);
					hs.forEach((h, c) => sh.push(cell(VX + 150 + c * 70, sh.y, t.heads[h].sc[j], `a|${h}|${p}|${j}`, 4, 60)));
					sh.y += 19;
				}
				sh.y += 8;
			}),
			[ST.softmax]: () => range(NKV).forEach(g => {
				const hs = [g * GRP, g * GRP + 1];
				hs.forEach((h, c) => sh.push(`<text x="${VX + c * 150}" y="${sh.y + 9}" class="hl">head ${h}: softmax of its scores</text>`));
				sh.y += 14;
				for (let j = 0; j <= p; j++) {
					sh.tok(sh.y, j);
					hs.forEach((h, c) => {
						const x = VX + c * 150, wv = t.heads[h].w[j];
						sh.push(cell(x, sh.y, t.heads[h].sc[j], `a|${h}|${p}|${j}`, 4, 40), `<text x="${x + 44}" y="${sh.y + 13}" class="po">→</text>`,
							`<g data-k="a|${h}|${p}|${j}"><rect x="${x + 58}" y="${sh.y + 3}" width="${Math.max(0.6, wv * 60).toFixed(1)}" height="12" class="wb"/><text x="${(x + 61 + wv * 60).toFixed(1)}" y="${sh.y + 13}" class="wv">${wv.toFixed(2)}</text></g>`);
					});
					sh.y += 19;
				}
				sh.y += 8;
			}),
			// a value head's rows once, with the weights of the two query heads that blend them
			[ST.blend]: () => range(NKV).forEach(g => {
				const hs = [g * GRP, g * GRP + 1];
				sh.head(`kv head ${g}: one V, blended by heads ${hs[0]} and ${hs[1]}`);
				hs.forEach((h, c) => sh.push(`<text x="${VX + c * 44 + 20}" y="${sh.y + 8}" class="hl" text-anchor="middle">a${SUB[h]}</text>`));
				sh.push(`<text x="${VX + 110 + DH * 15}" y="${sh.y + 8}" class="hl" text-anchor="middle">v</text>`);
				sh.y += 12;
				for (let j = 0; j <= p; j++) {
					sh.tok(sh.y, j);
					hs.forEach((h, c) => sh.push(cell(VX + c * 44, sh.y, t.heads[h].w[j], `a|${h}|${p}|${j}`, 1, 40, 'w')));
					sh.push(`<text x="${VX + 94}" y="${sh.y + 13}" class="po">×</text>`);
					TOK[j].v.slice(g * DH, g * DH + DH).forEach((v, i) => sh.push(cell(VX + 110 + i * 30, sh.y, v, `v|${g}|${j}|${i}`, 3, 30)));
					sh.y += 19;
				}
				sh.push(`<path d="M${VX + 110},${sh.y + 2}h${DH * 30}" class="hb"/>`);
				sh.y += 6;
				hs.forEach(h => {
					sh.push(`<text x="${VX + 102}" y="${sh.y + 13}" class="rl" text-anchor="end">o${SUB[h]} = Σ a${SUB[h]} v =</text>`);
					t.heads[h].o.forEach((v, i) => sh.push(cell(VX + 110 + i * 30, sh.y, v, `o|${h}|${p}|${i}`, 3, 30)));
					sh.y += 21;
				});
				sh.y += 10;
			}),
			[ST.wo]: () => { sh.q16(t.cat, kh('o'), 'o', 'four heads'); sh.op('concat, then × Wo'); sh.v8(t.att, k8('h'), 'o Wo'); },
			[ST.add]: () => { sh.v8(t.x, kx, 'x', 'off the rail'); sh.op('+'); sh.v8(t.att, () => null, 'o Wo'); sh.op('='); sh.v8(t.out, k8('h'), 'h', 'x + o Wo'); },
			[ST.norm2]: () => { sh.v8(t.out, k8('h'), 'h'); sh.op(`÷ rms(h) = ${fmt(t.hrms, 3)}, then × gain (1 here)`); sh.v8(t.hn, k8('h'), 'ĥ'); },
			[ST.route]: () => {
				const e1 = t.top[0];
				sh.v8(t.hn, k8('hc'), 'ĥ', '8 inputs');
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="hl">expert ${e1}: its 8 W_g edges, input × weight, summed</text>`); sh.y += 16;
				sh.v8(model.Wg.map(r => r[e1]), f => `wg|0|${f}|${e1}`, `W_g[:, ${e1}]`, '', 1.6);
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="po">= Σ ĥ × W_g[:, ${e1}] =</text>`, cell(VX + 150, sh.y - 2, t.r[e1], `r|0|${p}|${e1}`, 3, 40)); sh.y += 26;
				// a score an expert, the two picked boxed
				sh.lab(sh.y + 12, 'r', 'ĥ W_g');
				t.r.forEach((v, e) => {
					const x = VX + e * 33;
					sh.push(`<text x="${x + 15}" y="${sh.y + 8}" class="hl" text-anchor="middle">${e}</text>`, cell(x, sh.y + 12, v, `r|0|${p}|${e}`, 3, 30));
					if (t.top.includes(e)) sh.push(`<rect x="${x - 1.5}" y="${sh.y + 10.5}" width="33" height="${CH + 3}" class="new"/>`);
				});
				sh.y += 38;
				sh.op('the top 2, then a softmax over their two scores');
				t.top.forEach((e, n) => {
					const G = t.G[n];
					sh.push(`<text x="${VX - 8}" y="${sh.y + 13}" class="rl cur" text-anchor="end">expert ${e}</text>`, cell(VX, sh.y, t.r[e], `r|0|${p}|${e}`, 3, 40), `<text x="${VX + 46}" y="${sh.y + 13}" class="po">→</text>`,
						`<g data-k="r|0|${p}|${e}"><rect x="${VX + 62}" y="${sh.y + 3}" width="${(G * 150).toFixed(1)}" height="12" class="wb"/><text x="${(VX + 66 + G * 150).toFixed(1)}" y="${sh.y + 13}" class="wv">G = ${G.toFixed(2)}</text></g>`);
					sh.y += 19;
				});
			},
			[ST.gateUp]: () => {
				const x = t.ex[0], c = argabs(x.g), n = x.e * FE + c;
				sh.v8(t.hn, k8('hc'), 'ĥ', '8 inputs');
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="hl">expert ${x.e}, neuron ${c}: its 8 W1 edges, input × weight, summed</text>`); sh.y += 16;
				sh.v8(model.EX[x.e].W1.map(r => r[c]), f => `w1|0|${f}|${n}`, `W1[:, ${c}]`, '', 1.6);
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="po">= Σ ĥ × W1[:, ${c}] =</text>`, cell(VX + 150, sh.y - 2, x.g[c], `g|0|${p}|${n}`, 3, 40)); sh.y += 26;
				experts(); sh.ex6(six('g'), kn('g'), 'g', 'ĥ W1'); sh.ex6(six('u'), kn('u'), 'u', 'ĥ W3');
			},
			[ST.swiglu]: () => {
				experts(); sh.ex6(six('g'), kn('g'), 'g'); sh.ex6(six('u'), kn('u'), 'u');
				// the gate: SiLU, with the running neurons' 6 gates on it
				const PW = 286, PH = 96, y = sh.y, zx = z => VX + (z + 4.5) / 9 * PW, zy = v => y + PH - (v + 0.6) / 5.1 * PH, silu = z => z / (1 + Math.exp(-z));
				let d = '';
				for (let z = -4.5; z <= 4.5001; z += 0.1) d += (d ? 'L' : 'M') + zx(z).toFixed(1) + ',' + zy(silu(z)).toFixed(1);
				sh.push(`<rect x="${VX}" y="${y}" width="${PW}" height="${PH}" fill="#ffffff" stroke="#d6d2da"/><path d="M${VX},${zy(0).toFixed(1)}h${PW}M${zx(0).toFixed(1)},${y}v${PH}" stroke="#e2e2e2"/><path d="${d}" fill="none" stroke="#55505a" stroke-width="1.4"/>`);
				t.ex.forEach(x => x.g.forEach((g, c) => sh.push(`<g data-k="g|0|${p}|${x.e * FE + c}"><circle cx="${zx(clamp(g, -4.5, 4.5)).toFixed(1)}" cy="${zy(x.sg[c]).toFixed(1)}" r="3.2" fill="${rgb(valueColour(x.m[c]))}" stroke="#000" stroke-width="0.6"/></g>`)));
				sh.push(`<text x="${VX + 6}" y="${y + 13}" class="hl">SiLU(g) against g, one dot per running neuron, coloured by m</text>`, `<text x="${VX - 8}" y="${y + PH / 2}" class="pl" text-anchor="end"><tspan class="pv">SiLU</tspan></text>`);
				sh.y += PH + 8;
				sh.ex6(six('m'), kn('m'), 'm', 'SiLU(g) ⊙ u');
			},
			[ST.down]: () => {
				const i = argabs(t.f);
				experts(); sh.ex6(six('m'), kn('m'), 'm');
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="hl">output ${i}: each expert's 3 W2 edges, m × weight, summed, then × G</text>`); sh.y += 16;
				t.ex.forEach((x, k) => {
					sh.lab(sh.y, `W2ᵀ[${i}, :]`);
					x.m.forEach((_, c) => sh.push(cell(VX + c * 30, sh.y, model.EX[x.e].W2[c][i], `w2|0|${i}|${x.e * FE + c}`, 1.6, 30)));
					sh.push(`<text x="${VX + 96}" y="${sh.y + 13}" class="po">→</text>`, cell(VX + 112, sh.y, x.f[i], null, 3, 40), `<text x="${VX + 158}" y="${sh.y + 13}" class="po">× ${t.G[k].toFixed(2)}, expert ${x.e}</text>`);
					sh.y += 22;
				});
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="po">= the two, added =</text>`, cell(VX + 150, sh.y - 2, t.f[i], `fc|0|${p}|${i}`, 3, 40)); sh.y += 26;
				sh.v8(t.f, k8('fc'), 'f', 'mixed');
			},
			[ST.add2]: () => { sh.v8(t.out, k8('h'), 'h', 'off the rail'); sh.op('+'); sh.v8(t.f, k8('fc'), 'f'); sh.op('='); sh.v8(t.y, k8('y'), 'y', 'h + f'); },
			[ST.finalNorm]: () => { sh.v8(t.y, k8('y'), 'y', 'leaving the layer'); sh.op(`÷ rms(y) = ${fmt(t.zrms, 3)}, then × gain (1 here)`); sh.v8(t.zn, k8('z'), 'z', 'final norm'); },
			[ST.logits]: () => {
				const js = argmax(t.logits), name = esc(V[js]);
				sh.v8(t.zn, k8('z'), 'z');
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="hl">the top token, “${name}”: z against its column of W_U</text>`); sh.y += 16;
				sh.v8(model.WU.map(r => r[js]), f => `wu|0|${f}|${js}`, `W_U[:, ${name}]`, '', 1.6);
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="po">= Σ z × W_U[:, ${name}] =</text>`, cell(VX + 170, sh.y - 2, t.logits[js], `lg|0|${p}|${js}`, 4, 40)); sh.y += 28;
				sh.lab(sh.y + 14, 'logits');
				for (let j = 0; j < NV; j++) {
					const x = VX + (j % 8) * 37, yy = sh.y + Math.floor(j / 8) * 36;
					vlab(x + 18, yy + 9, j);
					sh.push(cell(x, yy + 12, t.logits[j], `lg|0|${p}|${j}`, 4, 36));
				}
				sh.y += 76;
			},
			[ST.pick]: () => {
				const order = t.probs.map((pr, j) => [pr, j]).sort((a, b) => b[0] - a[0]);
				sh.head('token · logit · probability');
				order.forEach(([pr, j]) => {
					const pick = j === t.pick, real = j === t.nextReal;
					sh.push(`<text x="${VX - 8}" y="${sh.y + 12}" class="rl${pick ? ' cur' : ''}" text-anchor="end">${esc(V[j])}</text>`, cell(VX, sh.y, t.logits[j], `lg|0|${p}|${j}`, 4, 40));
					sh.push(`<g data-k="lg|0|${p}|${j}"><rect x="${VX + 48}" y="${sh.y + 3}" width="${Math.max(0.6, pr * 200).toFixed(1)}" height="11" class="wb"${pick ? ' stroke="#c8a000" stroke-width="2"' : ''}/><text x="${(VX + 52 + pr * 200).toFixed(1)}" y="${sh.y + 12}" class="wv">${pr.toFixed(3)}${pick ? '  ← picked' : ''}${real ? '  ▲ next in the sentence' : ''}</text></g>`);
					sh.y += 17;
				});
			},
		};
		by[s]();
		return sh.svg();
	}

	// ---- the side pane ---------------------------------------------------------------------
	// One section per component, each with its prerequisites, folded to their defining line and
	// numbered as the posts number their sections (2.4, cited §2.4), then its forward pass, built
	// once from the data. The current step's detail block moves into that step's row.
	const side = $('.toy-side'), sideHead = $('.toy-sidehead'), nav = $('.toy-nav'), map = $('.toy-map'), secs = $('.toy-secs');
	const detail = $('.toy-detail'), panel = $('.toy-panel');
	// the window's status bar: the step in words, then the token and how far through the pass it is. The layout
	// draws the bar after the post, so the post defers this script
	const status = $('.post_total', win), place = document.createElement('span');
	if (status) status.append(place);
	const PRE = {};
	DATA.prerequisites.forEach(it => { PRE[it.id] = it; });
	DATA.components.forEach(c => c.pre.forEach((id, k) => { PRE[id].tag = `${c.n}.${k + 1}`; }));
	const COMP_OF = [];
	DATA.components.forEach(c => c.steps.forEach(s => { COMP_OF[s] = c; }));
	const preRef = (id, short) => `<button type="button" class="toy-ref" data-pre="${id}"${short ? ` title="${PRE[id].title}"` : ''}>§${PRE[id].tag}${short ? '' : ' ' + PRE[id].title}</button>`;
	const stepRef = s => `<button type="button" class="toy-ref" data-step="${s}">(${s + 1})</button>`;

	function buildSide() {
		const usedIn = {};
		DATA.steps.forEach((st, s) => st.uses.forEach(id => (usedIn[id] = usedIn[id] || []).push(s)));
		// a prerequisite folds to its title and defining line; open, its points, table and code
		const preItem = id => {
			const it = PRE[id];
			return `<details class="toy-pre" data-pre="${id}"><summary><span class="toy-preh" role="heading" aria-level="4"><span class="num">${it.tag}</span>${it.title}${it.cite ? `<em>${it.cite}</em>` : ''}</span>${it.def ? mx(it.def) : ''}</summary>`
				+ (it.body ? typeset(it.body) : '') + (it.points ? points(it.points) : '') + (it.scale ? scale(it.scale) : '') + (it.code ? code(it.code) : '')
				+ (usedIn[id] ? `<div class="toy-used">used in ${usedIn[id].map(stepRef).join(' ')}</div>` : '') + '</details>';
		};
		const stepItem = s => `<section class="toy-fp" data-s="${s}"><button type="button" class="toy-fph" data-step="${s}" aria-label="Go to step ${s + 1}: ${DATA.steps[s].title}">`
			+ `<span class="n">(${s + 1})</span><b>${DATA.steps[s].title}</b><span class="eq">${tex(DATA.steps[s].eq)}</span></button></section>`;
		nav.innerHTML = DATA.components.map(c => `<button type="button" data-go="${c.id}"><span>${c.n}</span> ${c.nav}</button>`).join('');
		secs.innerHTML = DATA.components.map(c => `<section class="toy-cp" data-cp="${c.id}"><div class="toy-cph" role="heading" aria-level="3"><span class="num">${c.n}</span>${c.name}<small>${c.tag}</small></div>`
			+ (c.intro ? `<p class="toy-intro">${c.intro}</p>` : '')
			+ (c.eq ? mx(c.eq, 'toy-cpeq') : '')
			+ `<div class="toy-sub">${c.steps.length ? 'Prerequisites' : 'Setup'}</div>` + c.pre.map(preItem).join('')
			+ (c.also ? `<p class="toy-also">Also uses ${c.also.map(id => preRef(id)).join(', ')}.</p>` : '')
			+ (c.steps.length ? '<div class="toy-sub">Forward pass <span class="toy-tok"></span></div>' + c.steps.map(stepItem).join('') : '')
			+ '</section>').join('');
	}
	// the step map: one cell per step, grouped by component with a gutter between groups
	function buildMap() {
		const groups = DATA.components.filter(c => c.steps.length), col = [];
		let next = 1;
		map.style.gridTemplateColumns = groups.map(c => `repeat(${c.steps.length}, 1fr)`).join(' 6px ');
		map.innerHTML = groups.map(c => {
			const start = next;
			c.steps.forEach(s => { col[s] = next++; });
			next++;
			const label = c.steps.length > 1 ? `${c.n} ${c.nav.split(' ').pop().toLowerCase()}` : String(c.n);
			return `<span class="grp" style="grid-column: ${start} / span ${c.steps.length}">${label}</span>`;
		}).join('') + DATA.steps.map((st, s) => `<button type="button" style="grid-column: ${col[s]}" aria-label="Step ${s + 1}: ${st.title}" title="${st.title}"></button>`).join('');
	}
	const sideTo = el => {
		let y = 0;
		for (let e = el; e && e !== side; e = e.offsetParent) y += e.offsetTop;
		side.scrollTo({ top: Math.max(0, y - sideHead.offsetHeight - 6), behavior: REDUCED ? 'auto' : 'smooth' });
	};
	const flash = el => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); };
	// the nav shows which component is in view
	function syncNav() {
		const cps = $$('.toy-cp', secs), lineY = side.scrollTop + sideHead.offsetHeight + 40;
		let on = cps[0];
		cps.forEach(c => { if (c.offsetTop <= lineY) on = c; });
		if (side.scrollTop + side.clientHeight >= side.scrollHeight - 2) on = cps[cps.length - 1];
		$$('[data-go]', nav).forEach(b => b.classList.toggle('on', b.dataset.go === on.dataset.cp));
	}
	let shownStep = null;
	function explain(s) {
		const row = $(`.toy-fp[data-s="${s}"]`, secs);
		$$('.toy-fp', secs).forEach(b => {
			const i = +b.dataset.s;
			b.classList.toggle('cur', i === s);
			b.classList.toggle('done', i < s);
			b.classList.toggle('future', i > s);
		});
		row.appendChild(detail);
		$$('.toy-cp', secs).forEach(c => c.classList.toggle('here', c.dataset.cp === COMP_OF[s].id));
		$$('.toy-pre', secs).forEach(el => el.classList.toggle('now', DATA.steps[s].uses.includes(el.dataset.pre)));
		// the parts, in their fixed order: maths, by hand, PyTorch, cells, toy against Mixtral, notes
		const st = DATA.steps[s], out = $('.toy-out');
		$('.toy-cap').innerHTML = caption(cur, s);
		$('.toy-uses').innerHTML = st.uses.map(id => preRef(id, true)).join(' ');
		$('.toy-mth').innerHTML = mx(st.maths);
		$('.toy-num').innerHTML = numbers(cur, s);
		$('.toy-py .toy-code').innerHTML = codeHtml(st.code);
		out.textContent = printed(STEPS[s][0], cur);
		out.dataset.t = `t = ${cur}`;
		panel.innerHTML = panelSVG(cur, s);
		if (hoverKey) markPanel(hoverKey);
		$('.toy-at').innerHTML = st.scale ? scale(st.scale) : '';
		$('.toy-at').hidden = !st.scale;
		$('.toy-notes').innerHTML = st.notes.map(n => `<li>${md(n)}</li>`).join('');
		$('.toy-nb').hidden = !st.notes.length;
		$$('button', map).forEach((b, i) => { b.classList.toggle('on', i === s); b.classList.toggle('done', i < s); });
		$('.toy-end').hidden = s !== NST - 1;
		$('[data-act="nexttok"]').textContent = cur < T - 1 ? `Run the next token: ${tokName(cur + 1)} →` : 'Back to the first token';
		if (status) {
			$('.left', status).textContent = `${COMP_OF[s].nav} · ${DATA.steps[s].title}`;
			place.textContent = `${WORDS[cur]} · step ${s + 1} of ${NST}`;
		}
		// the side follows the step, as the cubes do; on first load it stays at the top
		if (shownStep !== null && shownStep !== s) sideTo(row);
		shownStep = s;
		syncNav();
	}
	side.addEventListener('scroll', syncNav, { passive: true });
	side.addEventListener('click', e => {
		const b = e.target.closest('button');
		if (!b) return;
		if (b.dataset.step != null) { stopPlay(); scrollToTau(+b.dataset.step, true); }
		else if (b.dataset.pre) { const el = $(`.toy-pre[data-pre="${b.dataset.pre}"]`, secs); el.open = true; sideTo(el); flash(el); }
		else if (b.dataset.go) sideTo($(`.toy-cp[data-cp="${b.dataset.go}"]`, secs));
		else if (b.dataset.act === 'nexttok') { setTok(cur < T - 1 ? cur + 1 : 0); scrollToTau(0, false); }
	});
	map.addEventListener('click', e => {
		const b = e.target.closest('button');
		if (!b) return;
		stopPlay();
		scrollToTau($$('button', map).indexOf(b), true);
	});

	// ---- scroll --------------------------------------------------------------------------
	// the scroll lives inside the pane: a sticky stage over a spacer as long as the nineteen moves
	let STEP = 400, ticking = false;
	function layout() {
		const h = scroller.clientHeight;
		stage.style.height = h + 'px';
		STEP = Math.max(160, Math.round(h * 0.6));
		spacer.style.height = ((NST - 1) * STEP) + 'px';
	}
	const readTau = () => { tau = clamp(scroller.scrollTop / STEP, 0, NST - 1); };
	const scrollToTau = (t, smooth) => scroller.scrollTo({ top: t * STEP, behavior: smooth && !REDUCED ? 'smooth' : 'auto' });
	scroller.addEventListener('scroll', () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => { ticking = false; readTau(); draw(); });
	}, { passive: true });

	// ---- controls ------------------------------------------------------------------------
	const tool = $('.lit-tool'), playBtn = $('[data-act="play"]', tool);
	$('.toy-toks', tool).innerHTML = WORDS.map((w, j) => `<button type="button" class="lit-btn" data-tok="${j}">${w}</button>`).join('');
	function setTok(p) {
		cur = p;
		lastStep = -1;
		sceneCache.clear();
		$$('.toy-tok', secs).forEach(e => { e.innerHTML = `${tokHtml(cur)}, ${tex(`t = ${cur}`)}`; });
		$$('[data-tok]', tool).forEach(b => b.classList.toggle('on', +b.dataset.tok === p));
		draw();
	}
	let playing = false, lastT = 0, holdT = 0, rafPlay = 0;
	function stopPlay() {
		playing = false;
		cancelAnimationFrame(rafPlay);
		playBtn.innerHTML = '&#9654; Play';
		playBtn.classList.remove('on');
	}
	// play: scroll the pane at a steady pace, pause at the end, then run the next token
	function startPlay() {
		readTau();
		if (tau >= NST - 1.001) scrollToTau(0, false);
		playing = true;
		lastT = performance.now();
		holdT = 0;
		playBtn.innerHTML = '&#10074;&#10074; Pause';
		playBtn.classList.add('on');
		const tick = now => {
			if (!playing || !root.isConnected) return; // a closed window stops here, so it can be freed
			const dt = Math.min(64, now - lastT);
			lastT = now;
			readTau();
			if (tau >= NST - 1.001) {
				holdT += dt;
				if (holdT > 1800) {
					if (cur >= T - 1) return stopPlay();
					setTok(cur + 1);
					scrollToTau(0, false);
					holdT = 0;
				}
			} else {
				scroller.scrollTop += Math.max(1, STEP * dt / (REDUCED ? 3200 : 2100));
			}
			rafPlay = requestAnimationFrame(tick);
		};
		rafPlay = requestAnimationFrame(tick);
	}
	// step buttons: each click scrolls to the next whole step, so the motion plays on the way
	let navTarget = null, navTimer = 0;
	const navTo = t => { navTarget = t; clearTimeout(navTimer); navTimer = setTimeout(() => { navTarget = null; }, 700); scrollToTau(t, true); };
	const ACTS = {
		first() { setTok(0); navTarget = null; scrollToTau(0, false); },
		prev() {
			const base = navTarget ?? Math.ceil(tau - 0.02);
			if (base > 0) navTo(base - 1);
			else if (cur > 0) { setTok(cur - 1); navTarget = null; scrollToTau(NST - 1, false); }
		},
		next() {
			const base = navTarget ?? Math.floor(tau + 0.02);
			if (base < NST - 1) navTo(base + 1);
			else if (cur < T - 1) { setTok(cur + 1); navTarget = null; scrollToTau(0, false); }
		},
		play() { if (playing) stopPlay(); else startPlay(); },
		maths() {
			const b = $('[data-act="maths"]', tool), on = !b.classList.contains('on');
			b.classList.toggle('on', on);
			b.innerHTML = on ? 'maths &#10003;' : 'maths';
			$('.toy-body').classList.toggle('nomaths', !on);
		},
	};
	tool.addEventListener('click', e => {
		const b = e.target.closest('button');
		if (!b) return;
		if (b.dataset.tok != null) {
			setTok(+b.dataset.tok);
		} else if (b.dataset.view) {
			[yaw, pitch] = VIEWS[b.dataset.view];
			$$('[data-view]', tool).forEach(v => v.classList.toggle('on', v === b));
			draw();
		} else if (ACTS[b.dataset.act]) {
			if (b.dataset.act !== 'play') stopPlay();
			ACTS[b.dataset.act]();
		}
	});
	['wheel', 'touchstart', 'keydown'].forEach(ev => scroller.addEventListener(ev, () => { if (playing) stopPlay(); }, { passive: true }));

	// ---- hover, both ways ----------------------------------------------------------------
	function markPanel(k) {
		$$('[data-k].on', panel).forEach(e => e.classList.remove('on'));
		if (k) $$(`[data-k="${k}"]`, panel).forEach(e => e.classList.add('on'));
	}
	function setHover(k) { hoverKey = k; markPanel(k); draw(); }
	panel.addEventListener('mouseover', e => { const g = e.target.closest('[data-k]'), k = g ? g.dataset.k : null; if (k !== hoverKey) setHover(k); });
	panel.addEventListener('mouseleave', () => setHover(null));
	const inside = (pt, q) => {
		let sg = 0;
		for (let i = 0; i < q.length; i++) {
			const a = q[i], b = q[(i + 1) % q.length], c = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
			if (c !== 0) { if (!sg) sg = Math.sign(c); else if (Math.sign(c) !== sg) return false; }
		}
		return true;
	};
	// the tooltip for a cube or a node
	function describe(c) {
		const t = TOK[cur];
		if (c.node) {
			const n = c.node, v = fmt(n.val, 3), wait = n.fill < 1 ? ' (not reached yet)' : '';
			if (n.kind === 'zin') return `z[${n.i}] = ${v}${wait}`;
			if (n.kind === 'voc' || n.kind === 'bar') return `“${VOCAB[n.i]}”: logit ${fmt(t.logits[n.i], 3)}, p = ${t.probs[n.i].toFixed(3)}${wait}`;
			if (n.kind === 'r') {
				const k = t.top.indexOf(n.i);
				return `router score, expert ${n.i} = ${v}` + (wait || (k < 0 ? ' · passed over' : ` · picked, G = ${t.G[k].toFixed(3)}`));
			}
			if (n.kind === 'in' || n.kind === 'out') return (n.kind === 'in' ? `input ĥ[${n.i}] = ` : `output f[${n.i}] = `) + v + wait;
			// a neuron: expert ⌊i/3⌋'s neuron i mod 3, run only if the router picked that expert
			const e = Math.floor(n.i / FE), j = n.i % FE, x = t.ex.find(y => y.e === e);
			if (!x) return `expert ${e}, neuron ${j}: not run for ${WORDS[cur]}`;
			return `expert ${e}, ` + { g: `gate g, neuron ${j} = ${v} · SiLU ${fmt(x.sg[j], 3)}`, u: `value u, neuron ${j} = ${v}`, m: `neuron ${j}: SiLU(g) × u = ${v}` }[n.kind] + wait;
		}
		// named for the step its value comes from: mid-move a carried cube already holds the next step's
		if (c.hollow) return `empty: the ${c.b === 'kd' ? 'key' : 'value'} head multi-head attention would keep for head ${c.h * GRP + 1}, ${tokName(c.t)}, ${c.i}`;
		if (c.b in COPY) return `${c.b === 'kc' ? 'K′' : 'V'} copy[kv head ${c.h}, for head ${c.h * GRP + 1}, ${tokName(c.t)}, ${c.i}] = ${fmt(c.val, 3)} · not cached`;
		const s = c.st, name = wallLabel(c.b, s)[0], who = tokName(c.t);
		const past = c.t < cur ? ' · from an earlier pass' : '';
		const v = c.b === 'a' && !(s === ST.scores && c.t === cur) ? c.val.toFixed(3) : fmt(c.val, 3);
		if (c.b === 'a') return `${name}[head ${c.h}, query ${who}, key ${tokName(c.i)}] = ${v}${past}`;
		if (c.b === 'k' || c.b === 'v') return `${name}[kv head ${c.h}, for heads ${c.h * GRP} and ${c.h * GRP + 1}, ${who}, ${c.i}] = ${v}`;
		if (c.b === 'q' || c.b === 'o') return `${name}[head ${c.h}, ${who}, ${c.i}] = ${v}${past}`;
		return `${name}[${who}, ${c.i}] = ${v}${past}`;
	}
	let drag = null;
	const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
	canvas.addEventListener('pointerdown', e => {
		if (e.pointerType !== 'mouse') return;
		drag = { x: e.clientX, y: e.clientY, yaw, pitch };
		canvas.setPointerCapture(e.pointerId);
		canvas.classList.add('drag');
		tip.hidden = true;
	});
	canvas.addEventListener('pointermove', e => {
		if (drag) {
			yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
			pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.008, -0.2, 1.2);
			draw();
			return;
		}
		if (e.pointerType !== 'mouse') return;
		const pt = local(e);
		let hit = null;
		const nh = nodeHits.find(n => Math.hypot(n.x - pt[0], n.y - pt[1]) <= n.r + 2);
		if (nh) hit = { id: nh.id, c: { node: nh } };
		for (let i = faces.length - 1; i >= 0 && !hit; i--) if (faces[i].pts.some(q => inside(pt, q))) hit = faces[i];
		if (hit) {
			tip.hidden = false;
			tip.textContent = describe(hit.c);
			tip.style.left = Math.max(4, Math.min(pt[0] + 14, W - tip.offsetWidth - 4)) + 'px';
			tip.style.top = Math.min(pt[1] + 16, H - 24) + 'px';
		} else {
			tip.hidden = true;
		}
		const k = hit ? hit.id : null;
		if (k !== hoverKey) setHover(k);
	});
	const endDrag = () => { drag = null; canvas.classList.remove('drag'); };
	canvas.addEventListener('pointerup', endDrag);
	canvas.addEventListener('pointercancel', endDrag);
	canvas.addEventListener('pointerleave', () => { tip.hidden = true; if (hoverKey) setHover(null); });

	// ---- start -----------------------------------------------------------------------------
	// The toy starts the first time its pane has a size, so never on a phone, where it is hidden.
	// Only then is KaTeX fetched, pinned by its hashes; the side is typeset once it has run, or
	// failed, which leaves the TeX as code.
	const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min';
	const SRI = { css: 'sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+', js: 'sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg' };
	let started = false;
	function start() {
		started = true;
		const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: KATEX + '.css', integrity: SRI.css, crossOrigin: 'anonymous' });
		root.append(css);
		const run = () => {
			buildSide();
			buildMap();
			layout();
			fit();
			setTok(cur);
		};
		if (window.katex) return run();
		const js = Object.assign(document.createElement('script'), { src: KATEX + '.js', integrity: SRI.js, crossOrigin: 'anonymous', onload: run, onerror: run });
		root.append(js);
	}
	const resized = new ResizeObserver(() => {
		if (!scroller.clientHeight) return;
		if (!started) start();
		else if (W) { layout(); readTau(); fit(); draw(); }
	});
	resized.observe(scroller);
	// a new paper from System Properties: the cached scenes faded to the old one go
	const repaper = () => { readPaper(); sceneCache.clear(); draw(); };
	document.addEventListener('settings:changed', repaper);
	// a closed window lets go of everything, so it can be freed
	document.addEventListener('content:swapped', function closed() {
		if (root.isConnected) return;
		resized.disconnect();
		document.removeEventListener('settings:changed', repaper);
		stopPlay();
		clearTimeout(explainTimer);
		document.removeEventListener('content:swapped', closed);
	});
})();
