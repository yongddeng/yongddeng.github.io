// 301. toy: one LLaMA decoder layer in the post window. A toy model built to
// LLaMA's recipe at d = 8 runs in the browser. The pane on the left draws its
// tensors as cubes and plays one token's pass through the layer as the pane is
// scrolled; the pane on the right is the maths, one section per component, with
// the current step worked in that token's numbers. Prose and TeX come from
// _data/toy.yml via the JSON script in the post; KaTeX typesets them. The desktop
// re-creates a post's scripts when it swaps the window in, so this runs once per
// window and claims it with data-ready.
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
	// LLaMA's recipe at d = 8: two heads of 4, RoPE with base 10000, RMSNorm with
	// gain 1 and no biases, SwiGLU 8 → 22 → 8, a 16-token vocabulary. Layer 1, so
	// x is the embedding. Weights are random and rounded to one decimal.
	const D = 8, NH = 2, DH = 4, FF = 22, EPS = 1e-6;
	const WORDS = ['the', 'cat', 'sat', 'on', 'the', 'mat'], T = WORDS.length;
	const VOCAB = ['the', 'cat', 'sat', 'on', 'mat', '.', 'a', 'dog', 'rug', 'ran', 'in', 'and', 'it', 'was', '<s>', '</s>'], NV = VOCAB.length;
	const THETA = [1, 0.01]; // RoPE, 10000^(-2i/d_h) for the two pairs of a head

	function makeToy(seed) {
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
		// drawn in this order, so each block's numbers stayed put as the next block was added
		const E = {};
		[...new Set(WORDS)].forEach(w => { E[w] = matrix(1, D, 1)[0]; });
		const Wq = matrix(D, D, 0.6), Wk = matrix(D, D, 0.6), Wv = matrix(D, D, 0.5), Wo = matrix(D, D, 0.5);
		const W1 = matrix(D, FF, 0.5), W3 = matrix(D, FF, 0.5), W2 = matrix(FF, D, 0.3);
		const WU = matrix(D, NV, 0.6);

		const mul = (u, W) => W[0].map((_, j) => u.reduce((acc, ui, i) => acc + ui * W[i][j], 0)); // row vector × matrix
		const add = (a, b) => a.map((v, i) => v + b[i]);
		const rms = u => Math.sqrt(u.reduce((acc, v) => acc + v * v, 0) / D + EPS);
		const softmax = z => {
			const top = Math.max(...z), e = z.map(v => Math.exp(v - top)), Z = e.reduce((a, b) => a + b, 0);
			return e.map(v => v / Z);
		};
		const head = (v, n) => v.slice(n * DH, n * DH + DH);
		const rope = (v, pos) => {
			const out = v.slice();
			for (let n = 0; n < NH; n++) {
				for (let i = 0; i < DH / 2; i++) {
					const a = v[n * DH + 2 * i], b = v[n * DH + 2 * i + 1], ang = pos * THETA[i];
					out[n * DH + 2 * i] = a * Math.cos(ang) - b * Math.sin(ang);
					out[n * DH + 2 * i + 1] = a * Math.sin(ang) + b * Math.cos(ang);
				}
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
			// attention: each head scores the cached keys up to this position, softmaxes, and blends the values
			a.heads = range(NH).map(n => {
				const q = head(a.qr, n);
				const sc = tok.slice(0, a.t + 1).map(b => head(b.kr, n).reduce((acc, kv, i) => acc + kv * q[i], 0) / Math.sqrt(DH));
				const w = softmax(sc);
				const o = range(DH).map(i => w.reduce((acc, wj, j) => acc + wj * head(tok[j].v, n)[i], 0));
				return { sc, w, o };
			});
			a.cat = a.heads.flatMap(hd => hd.o);
			a.att = mul(a.cat, Wo);
			a.out = add(a.x, a.att);
			// the feed-forward
			a.hrms = rms(a.out);
			a.hn = a.out.map(v => v / a.hrms);
			a.g = mul(a.hn, W1);
			a.u = mul(a.hn, W3);
			a.sg = a.g.map(z => z / (1 + Math.exp(-z)));
			a.m = a.sg.map((z, i) => z * a.u[i]);
			a.f = mul(a.m, W2);
			a.y = add(a.out, a.f);
			// the LM head
			a.zrms = rms(a.y);
			a.zn = a.y.map(v => v / a.zrms);
			a.logits = mul(a.zn, WU);
			a.probs = softmax(a.logits);
			a.pick = a.probs.indexOf(Math.max(...a.probs));
			a.nextReal = a.t + 1 < T ? VOCAB.indexOf(WORDS[a.t + 1]) : -1;
		});
		return { Wq, Wk, Wv, Wo, W1, W2, W3, WU, tok };
	}
	const model = makeToy(187), TOK = model.tok;

	// ---- colours and formatting -------------------------------------------------
	const NAVY = [0, 0, 128], RED = [176, 0, 0], PAPER = [251, 250, 251];
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

	// ---- the eighteen steps -----------------------------------------------------
	// One row a step: its name in the code, the walls lit (the others fade back), and where the
	// camera looks, in units down the page. _plugins/check_toy.rb counts these rows against toy.yml.
	const STEPS = [
		['arrive', ['x'], 0],
		['norm', ['x'], 0],
		['qkv', ['x', 'q', 'k', 'v'], 22],
		['rope', ['q', 'k'], 23],
		['cache', ['k', 'v'], 24],
		['scores', ['q', 'k', 'a'], 26],
		['softmax', ['a'], 27],
		['blend', ['a', 'v', 'o'], 27],
		['wo', ['o', 'h'], 30],
		['add', ['x', 'h'], 30],
		['norm2', ['h'], 37],
		['gateUp', ['h'], 52],
		['swiglu', [], 56],
		['down', [], 61],
		['add2', ['h', 'y'], 67],
		['finalNorm', ['y'], 79],
		['logits', [], 87],
		['pick', [], 91],
	];
	const ST = Object.fromEntries(STEPS.map(([name], s) => [name, s]));
	const FOCUS = STEPS.map(r => r[1]), FOCUS_Y = STEPS.map(r => r[2]), NST = STEPS.length;

	// ---- geometry -----------------------------------------------------------------
	// Scene units: a cube is one unit; x runs right, y runs down the page (stored
	// negative, so up is up for the camera), z toward the viewer. A wall holds one
	// row per token; head 0 sits in front, head 1 a depth HZ behind it.
	const HS = 0.42, HZ = 2.2, HOLD = 0.18, PEND = 3.4, RAILX = -1.7;
	const SUM_X = -0.85; // the two ⊕, between the rail and the walls
	const FX = 2; // the FFN network's left edge
	const PANEL = { x0: 0.8, x1: FX + FF + 7.2, z: -HZ - 0.7 }; // the components' panels: one column, behind the back head layer
	const WALLS = {
		x: { x: 0, top: 0, w: 8 },
		q: { x: 3, top: 15.4, w: 4 },
		k: { x: 11, top: 15.4, w: 4 },
		v: { x: 19, top: 15.4, w: 4 },
		a: { x: 4, top: 25.4, w: 6 },
		o: { x: 19, top: 25.4, w: 4 },
		h: { x: 0, top: 35.8, w: 8 },
		y: { x: 0, top: 69.6, w: 8 },
	};
	const cellPos = (b, h, t, i) => { const w = WALLS[b]; return [w.x + i + 0.5, -(w.top + t + 0.5), -h * HZ]; };
	// the FFN as a network: 8 inputs, 22 neurons (a gate node fed by W1, a value node fed by W3, their product), 8 outputs
	const NY = { in: 48.2, g: 54.0, u: 55.8, m: 58.8, out: 65.0 };
	const NX = { in: f => FX + (f + 0.5) * FF / D, g: c => FX + c + 0.27, u: c => FX + c + 0.73, m: c => FX + c + 0.5, out: f => FX + (f + 0.5) * FF / D };
	const NR = { in: 0.42, out: 0.42, g: 0.27, u: 0.27, m: 0.3 }; // node radii, in units
	const netPos = (kind, i) => [NX[kind](i), -NY[kind], 0];
	// the LM head: z, a node per vocabulary token, then the probability bars and their labels
	const HY = { in: 84.0, voc: 89.6, bar: 90.8, lab: 97.4 };
	const HXv = j => FX + (j + 0.5) * FF / NV;
	const headPos = (kind, i) => kind === 'in' ? [NX.in(i), -HY.in, 0] : [HXv(i), -HY.voc, 0];
	// the components: a panel each, lit while the token is inside it. tint fills the panel; accent draws its
	// spine, its edge and its heading's square; ink sets its heading
	const CASES = [
		{ name: 'Attention', sub: '2 heads here; 64 heads, 268 M weights in LLaMA 65B', y0: 13.0, y1: 33.0, tint: [221, 232, 255], accent: [47, 85, 180], ink: '#22407f', steps: [ST.norm, ST.wo] },
		{ name: 'Feed-forward · SwiGLU', sub: 'every weight an edge; 541 M weights in LLaMA 65B', y0: 45.8, y1: 66.6, tint: [227, 242, 218], accent: [46, 125, 58], ink: '#235f2d', steps: [ST.norm2, ST.down] },
		{ name: 'LM head · next token', sub: '16 tokens here; 32,000 in LLaMA, 262 M weights', y0: 80.6, y1: 101.2, tint: [236, 228, 248], accent: [122, 79, 179], ink: '#5a3790', steps: [ST.finalNorm, ST.pick] },
	];
	const LAST = CASES[CASES.length - 1];
	const AFTER_Y = 76.1; // where the rail ends and "then 79 more layers" begins
	const caseOn = (c, s) => s >= c.steps[0] && s <= c.steps[1];
	// two layers: the residual stream's walls (and its copies riding the rail) in front, the boards and everything on
	// them behind, a step paler
	const FRONT = ['x', 'h', 'y'], BACK_FADE = 0.35;

	// ---- scenes -----------------------------------------------------------------------
	// scene(p, s): every cube on show when token p is at step s, keyed wall|head|row|col.
	// Cached for the current token only; setTok clears it.
	// A cube carries its value, position, colour and how far it fades back; `from`,
	// `win`, `grow` say how it enters. Ghosts are cubes in flight between two scenes.
	const sceneCache = new Map();
	function scene(p, s) {
		const key = p + ':' + s;
		if (sceneCache.has(key)) return sceneCache.get(key);
		const cells = new Map(), lit = FOCUS[s];
		const put = (b, h, t, i, val, colour, extra = {}) => {
			const [x, y, z] = cellPos(b, h, t, i), live = t === p;
			const back = live ? (lit.includes(b) ? 0 : 0.45) : (b === 'k' || b === 'v') ? (lit.includes(b) ? 0 : 0.5) : 0.86;
			cells.set(`${b}|${h}|${t}|${i}`, { b, h, t, i, val, st: s, x, y, z, base: colour, fade: back, op: 1, sc: 1, ...extra }); // st: the step whose value it holds
		};
		const ghost = (id, from, to, colour, extra = {}) => {
			cells.set(id, { ghost: true, peak: 1, from, x: to[0], y: to[1], z: to[2], base: colour, fade: 0, op: 0, sc: 0.8, ...extra });
		};
		for (let t = 0; t <= p; t++) {
			const r = TOK[t], live = t === p, reached = step => !live || s >= step;
			for (let f = 0; f < D; f++) {
				const v = live && s === ST.norm ? r.xn[f] : r.x[f];
				put('x', 0, t, f, v, valueColour(v));
			}
			if (!reached(ST.qkv)) continue;
			for (let h = 0; h < NH; h++) {
				for (let i = 0; i < DH; i++) {
					const f = h * DH + i, from = live ? { from: cellPos('x', 0, t, f) } : {};
					const waiting = live && s < ST.cache ? { z: -h * HZ + PEND } : {}; // k and v wait in front of the cache
					const qv = live && s === ST.qkv ? r.q[f] : r.qr[f], kv = live && s === ST.qkv ? r.k[f] : r.kr[f];
					put('q', h, t, i, qv, valueColour(qv), from);
					put('k', h, t, i, kv, valueColour(kv), { ...from, ...waiting });
					put('v', h, t, i, r.v[f], valueColour(r.v[f]), { ...from, ...waiting });
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
				put('h', 0, t, f, v, valueColour(v), live ? { from: cellPos('o', f >> 2, t, f & 3) } : {});
			}
			if (!live) for (let f = 0; f < D; f++) put('y', 0, t, f, r.y[f], valueColour(r.y[f])); // earlier tokens' outputs
		}
		const r = TOK[p];
		// the FFN and the LM head are drawn as networks; the cubes only enter and leave them
		if (s === ST.gateUp) for (let f = 0; f < D; f++) ghost(`gi|${f}`, cellPos('h', 0, p, f), netPos('in', f), valueColour(r.hn[f]), { win: [0, 0.3] });
		if (s === ST.finalNorm) for (let f = 0; f < D; f++) ghost(`gz|${f}`, cellPos('y', 0, p, f), headPos('in', f), valueColour(r.y[f]), { win: [0, 0.4] });
		if (s >= ST.add2) for (let f = 0; f < D; f++) put('y', 0, p, f, r.y[f], valueColour(r.y[f]), { from: netPos('out', f), win: [0, 0.55] });
		// the scores: for each cached key, the query row and that key's row converge on their score, a dot product a cell
		if (s === ST.scores) {
			for (let h = 0; h < NH; h++) {
				for (let j = 0; j <= p; j++) {
					const to = cellPos('a', h, p, j), win = [0.05 + 0.06 * j, 0.55 + 0.06 * j];
					for (let i = 0; i < DH; i++) {
						ghost(`gq|${h}|${j}|${i}`, cellPos('q', h, p, i), to, valueColour(r.qr[h * DH + i]), { peak: 0.85, sz: 0.6, win });
						ghost(`gk|${h}|${j}|${i}`, cellPos('k', h, j, i), to, valueColour(TOK[j].kr[h * DH + i]), { peak: 0.85, sz: 0.6, win });
					}
				}
			}
		}
		// the blend: each head's weights and the cached value rows converge on the new row of o
		if (s === ST.blend) {
			for (let h = 0; h < NH; h++) {
				const ws = r.heads[h].w, top = Math.max(...ws);
				for (let j = 0; j <= p; j++) {
					for (let i = 0; i < DH; i++) {
						cells.get(`v|${h}|${j}|${i}`).fade = 0.85 * (1 - ws[j] / top);
						ghost(`g7|${h}|${j}|${i}`, cellPos('v', h, j, i), cellPos('o', h, p, i), valueColour(TOK[j].v[h * DH + i]), { peak: 0.2 + 0.8 * ws[j] / top, sz: 0.3 + 0.6 * ws[j] / top, win: [0.3, 1] });
					}
					const beside = [WALLS.o.x - 1.1 - 0.12 * j, -(WALLS.o.top + p + 0.5) + 0.1 * j, -h * HZ];
					ghost(`ga|${h}|${j}`, cellPos('a', h, p, j), beside, weightColour(ws[j]), { life: 0.8, sz: 0.85, win: [0, 0.5], sc: 0.85 });
				}
			}
		}
		// the residual: a copy of the row comes down the rail and joins the sum
		const railGhosts = (src, dst, vals) => {
			for (let f = 0; f < D; f++) ghost(`r${s}|${f}`, cellPos(src, 0, p, f), cellPos(dst, 0, p, f), valueColour(vals[f]), { rail: true, ri: f, peak: 0.9, sc: 0.85 });
		};
		if (s === ST.add) railGhosts('x', 'h', r.x);
		if (s === ST.add2) railGhosts('h', 'y', r.out);
		if (s === ST.swiglu) for (let c = 0; c < FF; c++) ghost(`g12|${c}`, netPos('u', c), netPos('m', c), valueColour(r.u[c]), { peak: 0.8 });
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
	const VIEWS = { front: [0, 0.02], turned: [-0.3, 0.3] }; // yaw and pitch, radians
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

	// pixels a unit: the scene's full width at the turned view has to fit the pane
	function fit() {
		W = Math.max(200, stage.clientWidth);
		H = Math.max(200, stage.clientHeight);
		const saved = [yaw, pitch];
		[yaw, pitch] = VIEWS.turned;
		let lo = Infinity, hi = -Infinity;
		[[RAILX - 1.2, 0], [PANEL.x1 + 0.4, 0.8], [PANEL.x1 + 0.4, PANEL.z]].forEach(([x, z]) => {
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
			ctx.strokeStyle = 'rgba(251,250,251,0.92)';
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
		[[T - 2, 'then 79 more layers in LLaMA 65B;'], [T - 1, 'this toy has one']].forEach(([row, str]) => {
			const p = project(y.x + y.w + 0.7, -(y.top + row + 0.5), 0);
			write(str, p[0], p[1], `italic 11px ${SERIF}`, '#8a848f');
		});
	}
	// dashed outlines: each wall's room for six tokens
	function drawOutlines() {
		ctx.setLineDash([3, 3]);
		Object.values(WALLS).forEach(w => {
			const q = [project(w.x + 0.08, -w.top - 0.08, HS), project(w.x + w.w - 0.08, -w.top - 0.08, HS), project(w.x + w.w - 0.08, -w.top - T + 0.08, HS), project(w.x + 0.08, -w.top - T + 0.08, HS)];
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
	const board = (c, u) => roundRect(u(PANEL.x0), u(c.y0), u(PANEL.x1 - PANEL.x0), u(c.y1 - c.y0), u(0.7));
	const boardOnScreen = c => project(PANEL.x1, -c.y1, PANEL.z)[1] >= -20 && project(PANEL.x0, -c.y0, PANEL.z)[1] <= H + 40;
	// each component is a board on the back plane: a light fill, a hairline and a spine in its colour, and a little
	// shadow, a touch more while the token is inside it
	function drawPanels(SL) {
		CASES.filter(boardOnScreen).forEach(c => {
			const on = caseOn(c, SL);
			onPlane(PANEL.z, u => {
				const x = u(PANEL.x0), y = u(c.y0), w = u(PANEL.x1 - PANEL.x0), h = u(c.y1 - c.y0);
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
		CASES.filter(boardOnScreen).forEach(c => onPlane(PANEL.z, u => {
			ctx.beginPath();
			board(c, u);
			ctx.fillStyle = rgba(PAPER, 0.42);
			ctx.fill();
		}));
	}
	// each panel's heading, above its top-left corner: a square in its colour, its name, its LLaMA sizes
	function drawPanelHeadings(SL) {
		CASES.forEach(c => {
			const on = caseOn(c, SL), p = project(PANEL.x0, -c.y0, PANEL.z);
			if (p[1] < -10 || p[1] > H + 40) return;
			const font = `bold 13px ${SERIF}`, x = p[0] + 15, y = p[1] - 12;
			ctx.fillStyle = rgba(c.accent, on ? 1 : 0.4);
			ctx.fillRect(p[0] + 2, y - 4, 8, 8);
			write(c.name, x, y, font, on ? c.ink : '#8a848f');
			write(c.sub, x + measure(c.name, font) + 8, y + 1, `10px ${UI}`, on ? C.mute : C.faint);
		});
	}

	// soft shadows, never much: each cube's footprint cast down and right onto the back plane, a little farther for
	// the nearer head layer. One path for all of them, drawn off the canvas so only its blurred shadow lands
	const SHADOW = 'rgba(30,30,60,0.14)';
	function drawShadows(cells) {
		ctx.beginPath();
		cells.forEach(c => {
			if (c.ghost || c.op < 0.5 || c.sc < 0.5) return;
			const d = 0.15 + 0.08 * (c.z - PANEL.z), x = c.x + d, y = c.y - d, h = HS * c.sc;
			const q = [project(x - h, y + h, PANEL.z), project(x + h, y + h, PANEL.z), project(x + h, y - h, PANEL.z), project(x - h, y - h, PANEL.z)];
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
		const offsets = sc => CORNERS.map(q => { const r = rotate(q[0] * HS * sc, q[1] * HS * sc, q[2] * HS * sc); return [S * r[0], -S * r[1]]; });
		const unit = offsets(1);
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
			const off = Math.abs(c.sc - 1) < 0.01 ? unit : offsets(c.sc);
			const quads = visible.map(f => f.idx.map(i => [p[0] + off[i][0], p[1] + off[i][1]]));
			const strong = c.fade < 0.3;
			ctx.globalAlpha = Math.min(1, c.op);
			const col = FRONT.includes(c.b) || c.rail ? c.col : fade(c.col, BACK_FADE);
			visible.forEach((f, n) => poly(quads[n], rgb(col.map(v => Math.round(v * f.shade))), strong ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)', strong ? 0.8 : 0.6));
			ctx.globalAlpha = 1;
			if (!c.ghost) {
				faces.push({ id, c, pts: quads });
				if (id === hoverKey) hovered = quads;
			}
		});
		return hovered;
	}

	// a node of a network: white until the sweep reaches it, then its value's colour. Drawn by flushNodes
	function drawNode(p, r, val, max, fill, id, on, hit) {
		liftedNodes.push({ p, r, id, fill: fill > 0 ? rgb(fade(valueColour(val, max), 1 - fill)) : '#ffffff', stroke: on || fill > 0 ? C.ink : C.dim });
		nodeHits.push({ id, ...hit, val, fill, x: p[0], y: p[1], r: Math.max(r, 6) });
	}
	function flushNodes() {
		const disc = (n, r) => { ctx.beginPath(); ctx.arc(n.p[0], n.p[1], r, 0, 2 * Math.PI); };
		ctx.beginPath();
		liftedNodes.forEach(n => { ctx.moveTo(n.p[0] - OFF + n.r, n.p[1]); ctx.arc(n.p[0] - OFF, n.p[1], n.r, 0, 2 * Math.PI); });
		ctx.fillStyle = '#000000';
		shadowed('rgba(30,30,60,0.30)', 6, OFF + 1, 3, () => ctx.fill()); // lifted clearly off the board
		liftedNodes.forEach(n => {
			disc(n, n.r);
			ctx.fillStyle = n.fill; ctx.fill();
			ctx.lineWidth = 1; ctx.strokeStyle = n.stroke; ctx.stroke();
			if (n.id === hoverKey) { disc(n, n.r + 2.5); ctx.strokeStyle = C.gold; ctx.lineWidth = 2.4; ctx.stroke(); }
		});
		liftedNodes = [];
	}
	// a label to the right of the FFN or the LM head: a name over its LLaMA size
	function sideLabel(y, name, sub, on) {
		const p = project(FX + FF + 0.9, -y, 0);
		write(name, p[0], p[1] - (sub ? 7 : 0), `bold 12.5px ${SERIF}`, on ? C.ink : C.dim);
		if (sub) write(sub, p[0], p[1] + 7, `10px ${UI}`, on ? C.mute : C.faint);
	}
	// the largest |input × weight| over a bundle, so brightness is relative
	const brightest = (u, Wm) => { let m = 1e-9; u.forEach((ui, i) => Wm[i].forEach(w => { m = Math.max(m, Math.abs(ui * w)); })); return m; };

	// the FFN, drawn as the network it is: every weight an edge, lit by input × weight as the sweep passes
	function drawNet(s, k, SL) {
		nodeHits = [];
		const t = TOK[cur], { at, live } = sweep(s, k);
		const on = SL >= ST.norm2 && SL <= ST.down, fm = on ? 1 : 0.5;
		const P = (kind, i) => project(...netPos(kind, i));
		if (P('out', 0)[1] < -30 || P('in', 0)[1] > H + 30) return;
		const pin = range(D).map(f => P('in', f)), pout = range(D).map(f => P('out', f));
		const pg = range(FF).map(c => P('g', c)), pu = range(FF).map(c => P('u', c)), pm = range(FF).map(c => P('m', c));
		const c1 = brightest(t.hn, model.W1), c3 = brightest(t.hn, model.W3), c2 = brightest(t.m, model.W2), mm = Math.max(1e-9, ...t.m.map(Math.abs));
		const hovE = [];
		// W3 edges into the value nodes, then W1 edges into the gate nodes
		[['w3', 1, model.W3, pu, c3], ['w1', 0, model.W1, pg, c1]].forEach(([b, h, Wm, dst, cm]) => {
			for (let c = 0; c < FF; c++) {
				const a0 = 0.3 + 0.6 * c / FF, done = at(ST.gateUp, a0, a0 + 0.05), lit = live(ST.gateUp, a0, a0 + 0.05);
				for (let f = 0; f < D; f++) {
					const w = Wm[f][c], id = `${b}|${h}|${f}|${c}`;
					if (id === hoverKey) hovE.push([pin[f], dst[c]]);
					edge(pin[f], dst[c], sign(w), lit ? LIT : 0.05 + done * fm * 0.4 * Math.abs(t.hn[f] * w) / cm, lit ? 2.2 : 0.8, lit);
				}
			}
		});
		// each neuron: gate and value meet in the product node
		for (let c = 0; c < FF; c++) {
			const a0 = 0.15 + 0.7 * c / FF, done = at(ST.swiglu, a0, a0 + 0.1), lit = live(ST.swiglu, a0, a0 + 0.1);
			const alpha = lit ? 0.95 : 0.14 + done * fm * 0.75 * Math.abs(t.m[c]) / mm;
			line(pg[c], pm[c], '#45404a', alpha, lit ? 1.6 : 1);
			line(pu[c], pm[c], '#45404a', alpha, lit ? 1.6 : 1);
		}
		// W2 edges into the outputs
		for (let j = 0; j < D; j++) {
			const a0 = 0.1 + 0.75 * j / D, done = at(ST.down, a0, a0 + 0.08), lit = live(ST.down, a0, a0 + 0.08);
			for (let c = 0; c < FF; c++) {
				const w = model.W2[c][j], id = `w2|0|${j}|${c}`;
				if (id === hoverKey) hovE.push([pm[c], pout[j]]);
				edge(pm[c], pout[j], sign(w), lit ? LIT : 0.05 + done * fm * 0.4 * Math.abs(t.m[c] * w) / c2, lit ? 2.2 : 0.8, lit);
			}
		}
		flushEdges();
		hovE.forEach(([a, b]) => line(a, b, C.gold, 1, 2.6));
		// the nodes fill as the sweep reaches them
		const node = (kind, i, p, val, fill, id) => drawNode(p, NR[kind] * S, val, 3, fill, id, on, { kind, i });
		const inDone = at(ST.gateUp, 0.18, 0.3);
		for (let f = 0; f < D; f++) node('in', f, pin[f], t.hn[f], inDone, `hc|0|${cur}|${f}`);
		for (let c = 0; c < FF; c++) {
			const a0 = 0.3 + 0.6 * c / FF, d = at(ST.gateUp, a0 + 0.02, a0 + 0.07);
			node('g', c, pg[c], t.g[c], d, `g|0|${cur}|${c}`);
			node('u', c, pu[c], t.u[c], d, `u|1|${cur}|${c}`);
		}
		for (let c = 0; c < FF; c++) { const a0 = 0.15 + 0.7 * c / FF; node('m', c, pm[c], t.m[c], at(ST.swiglu, a0, a0 + 0.1), `m|0|${cur}|${c}`); }
		for (let j = 0; j < D; j++) { const a0 = 0.1 + 0.75 * j / D; node('out', j, pout[j], t.f[j], at(ST.down, a0, a0 + 0.08), `fc|0|${cur}|${j}`); }
		flushNodes();
		sideLabel(NY.in, 'ĥ · 8 inputs', '8,192 in LLaMA', on);
		sideLabel((NY.in + NY.g) / 2 + 0.2, 'W1 and W3', '8 × 22 edges each', on);
		sideLabel(NY.g, 'g · gates', 'fed by W1', on);
		sideLabel(NY.u + 0.3, 'u · values', 'fed by W3', on);
		sideLabel(NY.m, 'm = SiLU(g) ⊙ u', '22,016 in LLaMA', on);
		sideLabel((NY.m + NY.out) / 2 + 0.2, 'W2', '22 × 8 edges', on);
		sideLabel(NY.out, 'f · 8 outputs', '8,192 in LLaMA', on);
	}

	// attention's weights, drawn as the FFN's are: every entry of Wq, Wk, Wv and Wo an edge between the walls
	function drawProjections(s, k, SL) {
		const t = TOK[cur], { at, live } = sweep(s, k);
		const bundleLabel = (x, y, name, sub, on, atY) => {
			const p = project(x, y, 0), py = atY ?? p[1];
			write(name, p[0], py, `bold 11px ${SERIF}`, on ? C.ink : C.dim, 'center');
			write(sub, p[0], py + 11, `9.5px ${UI}`, on ? C.mute : C.faint, 'center');
		};
		// x̂ → q, k, v: from the token's row of x to the top of each wall's columns; the row itself then drops into the wall
		{
			const yt = -(WALLS.x.top + T), yb = -WALLS.q.top;
			if (project(0, yb, 0)[1] > -30 && project(0, yt, 0)[1] < H + 30) {
				const fm = SL === ST.qkv ? 1 : SL < ST.qkv ? 0 : 0.35, done = at(ST.qkv, 0.1, 0.9);
				const cm = Math.max(brightest(t.xn, model.Wq), brightest(t.xn, model.Wk), brightest(t.xn, model.Wv));
				const src = range(D).map(f => project(WALLS.x.x + f + 0.5, -(WALLS.x.top + cur + 1), 0));
				[['q', model.Wq], ['k', model.Wk], ['v', model.Wv]].forEach(([b, Wm]) => {
					for (let c = 0; c < D; c++) {
						const dst = project(WALLS[b].x + (c & 3) + 0.5, yb + 3.6, -(c >> 2) * HZ), a0 = 0.1 + 0.7 * c / D, lit = live(ST.qkv, a0, a0 + 0.08);
						for (let f = 0; f < D; f++) {
							const w = Wm[f][c];
							edge(src[f], dst, sign(w), lit ? LIT : 0.04 + done * fm * 0.45 * Math.abs(t.xn[f] * w) / cm, lit ? 2 : 0.8, lit);
						}
					}
				});
				flushEdges();
				// one screen line for the three, at Wq's height: turned, the scene drops to the right and Wv would land on the Attention heading
				const atY = project(WALLS.q.x + 2, yt - 0.75, 0)[1];
				[['Wq', 'q'], ['Wk', 'k'], ['Wv', 'v']].forEach(([name, b]) => bundleLabel(WALLS[b].x + 2, yt - 0.75, name, '8 × 8 edges', SL === ST.qkv, atY));
			}
		}
		// o → o Wo: from the bottom of o's columns to the top of h's
		{
			const yt = -(WALLS.o.top + T), yb = -WALLS.h.top;
			if (project(0, yb, 0)[1] > -30 && project(0, yt, 0)[1] < H + 30) {
				const fm = SL === ST.wo ? 1 : SL < ST.wo ? 0 : 0.35, done = at(ST.wo, 0.1, 0.9), cm = brightest(t.cat, model.Wo);
				const src = range(D).map(c => project(WALLS.o.x + (c & 3) + 0.5, yt - 0.05, -(c >> 2) * HZ));
				for (let f = 0; f < D; f++) {
					const dst = project(WALLS.h.x + f + 0.5, yb + 0.05, 0), a0 = 0.1 + 0.7 * f / D, lit = live(ST.wo, a0, a0 + 0.08);
					for (let c = 0; c < D; c++) {
						const w = model.Wo[c][f];
						edge(src[c], dst, sign(w), lit ? LIT : 0.04 + done * fm * 0.45 * Math.abs(t.cat[c] * w) / cm, lit ? 2 : 0.8, lit);
					}
				}
				flushEdges();
				bundleLabel(WALLS.o.x + 2, (yt + yb) / 2, 'Wo', '8 × 8 edges · the heads mix', SL === ST.wo);
			}
		}
	}

	// the mask: the cells of a that no token reads, hatched, so the staircase of weights and the grey make the full square
	function drawMask(SL) {
		const { x: x0, top, w: n } = WALLS.a;
		if (project(x0, -top, HS)[1] < -40 || project(x0, -(top + T), HS)[1] > H + 40) return;
		const on = SL === ST.scores || SL === ST.softmax;
		for (let t = 0; t < T; t++) {
			for (let j = t + 1; j < n; j++) {
				const q = [project(x0 + j + 0.1, -(top + t + 0.1), HS), project(x0 + j + 0.9, -(top + t + 0.1), HS), project(x0 + j + 0.9, -(top + t + 0.9), HS), project(x0 + j + 0.1, -(top + t + 0.9), HS)];
				poly(q, on ? 'rgba(0,0,0,0.09)' : 'rgba(0,0,0,0.05)', on ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.14)', 0.6);
				ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.stroke();
			}
		}
		const p = project(x0 + n + 0.4, -(top + 1.0), HS);
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
			const p = project(FX + FF + 0.9, -(HY.bar + 2.4), 0);
			ctx.globalAlpha = pick;
			write(`next: “${VOCAB[t.pick]}”`, p[0], p[1], `bold 13px ${SERIF}`, C.navy);
			write(`greedy, p = ${t.probs[t.pick].toFixed(2)}`, p[0], p[1] + 14, `10px ${UI}`, C.mute);
			ctx.globalAlpha = 1;
		}
		sideLabel(HY.in, 'z · final RMSNorm', '8,192 in LLaMA', on);
		sideLabel((HY.in + HY.voc) / 2 + 0.2, 'W_U', '8 × 16 edges', on);
		sideLabel(HY.voc, 'logits', '32,000 in LLaMA', on);
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
			const pa = project(WALLS.a.x - 0.35, -(WALLS.a.top + t + 0.5), HS);
			if (onScreen(pa, 10)) {
				write(String(t), pa[0] - numW, pa[1] + 3, small, colour);
				write(WORDS[t], pa[0] - numW - 1 - wordW, pa[1], font, colour);
			}
		}
	}
	// the name over each wall, with its formula and its LLaMA size; some change with the step
	const wallLabel = (b, s) => ({
		x: s === ST.norm ? ['x̂', 'RMSNorm(x), this step', '8,192'] : ['x · input', 'the residual stream, into the layer', '8,192 a token'],
		q: ['q′', 'RoPE(x̂ Wq)', '64 × 128'],
		k: ['K′ cache', 'RoPE(x̂ Wk)', '64 × t × 128'],
		v: ['V cache', 'x̂ Wv', '64 × t × 128'],
		a: s === ST.scores ? ['scores', 'q′K′ᵀ ÷ √4', '64 × t'] : ['a', 'softmax(q′K′ᵀ ÷ √4)', '64 × t'],
		o: ['o', 'a V', '64 × 128'],
		h: s === ST.wo ? ['o Wo', 'concat(o) Wo, leaving attention', '8,192'] : s === ST.norm2 ? ['ĥ', 'RMSNorm(h), this step', '8,192'] : ['h · intermediate', 'x + attention', '8,192'],
		y: ['y · output', 'h + f, to layer 2', '8,192'],
	}[b]);
	function drawWallLabels(SL) {
		Object.keys(WALLS).forEach(b => {
			const [name, formula, size] = wallLabel(b, SL), on = FOCUS[SL].includes(b), w = WALLS[b];
			const p = project(w.x, -w.top + 0.3, HS);
			if (p[1] < -10 || p[1] > H + 60) return;
			write(name, p[0], p[1] - 26, `bold 13px ${SERIF}`, on ? C.ink : C.dim, 'left', 'bottom');
			write(formula, p[0], p[1] - 13, `10.5px ${UI}`, on ? C.ink : C.dim, 'left', 'bottom');
			write('LLaMA ' + size, p[0], p[1], `10.5px ${UI}`, on ? C.mute : C.faint, 'left', 'bottom');
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
	// RMSNorm with the numbers: the sum of squares, the rms, the division
	const rmsRows = (b, p, u, d, rms, out, ov, gain) => {
		const sq = u.map(v => `${par(v, d)}^2`), sum = u.reduce((a, v) => a + v * v, 0), rel = d === 1 ? '=' : R`\approx`;
		return mx(aligned([
			[R`\textstyle\sum_i ${b}_{${p},i}^2`, '= ' + sq.slice(0, 4).join(' + ')],
			['', R`\quad + ` + sq.slice(4).join(' + ') + ` ${rel} ${num(sum)}`],
			[R`\operatorname{rms}(${b}_{${p}})`, R`= \sqrt{${num(sum)}/8 + 10^{-6}} \approx ${num(rms, 3)}`],
			[`${out}_{${p}}`, R`= ${b}_{${p}} / ${num(rms, 3)} \odot ${gain}`],
			['', R`\approx ` + rowv(ov)],
		])) + note(`${tex(gain + ' = 1')} in the toy, so the gain changes nothing. ${tex(R`\operatorname{rms}(${out}_{${p}}) = 1`)} afterwards, up to ${tex(R`\varepsilon`)}.`);
	};
	// column addition for the residual: two rows and their sum, entries lined up
	const colAdd = (a, b, c) => mx(R`\begin{array}{rrc` + 'r'.repeat(D) + '}'
		+ [[' ', ...a], ['+', ...b]].map(([sg, l, rel, v, d]) => `${sg} & ${l} & ${rel} & ` + v.map(x => num(x, d)).join(' & ')).join(R` \\ `)
		+ R` \\ \hline & ${c[0]} & ${c[1]} & ` + c[2].map(x => num(x, 2)).join(' & ') + R`\end{array}`, 'tight');
	// the head and key the derivation follows: a repeated word if there is one (it shows RoPE at work), else the strongest key
	const focusKey = p => {
		let j1 = -1, j2 = -1;
		for (let j = p; j >= 0 && j1 < 0; j--) { const i = WORDS.indexOf(WORDS[j]); if (i < j) { j1 = i; j2 = j; } }
		if (j1 >= 0) {
			const gap = h => Math.abs(TOK[p].heads[h].sc[j2] - TOK[p].heads[h].sc[j1]), nh = gap(1) > gap(0) ? 1 : 0;
			return { nh, j: j2, j1 };
		}
		const best = h => Math.max(...TOK[p].heads[h].w), nh = best(1) > best(0) ? 1 : 0;
		return { nh, j: argmax(TOK[p].heads[nh].w), j1: -1 };
	};

	// ---- the numbers: the current step worked in the token's values -----------------------
	function numbers(p, s) {
		const t = TOK[p], V = VOCAB;
		const by = {
			[ST.arrive]: () => {
				const i = WORDS.indexOf(WORDS[p]);
				return mx(aligned([[`x_{${p}}`, R`= E_{${word(WORDS[p])}}`], ['', '= ' + rowv(t.x, 1)]]))
					+ (i < p ? note(`${tex(`x_{${p}} = x_{${i}}`)}: same word, same row. The embedding knows the word, not the position; position enters only through RoPE, in step (4).`)
						: note(`Layer 1 of ${tex('L')}, so ${tex('x')} is the token’s row of the embedding.`));
			},
			[ST.norm]: () => rmsRows('x', p, t.x, 1, t.rms, R`\hat x`, t.xn, R`\gamma_1`),
			[ST.qkv]: () => {
				const c = argabs(t.q);
				return mx(aligned(sumRows(`q_{${p},${c}}`, R`\textstyle\sum_i \hat x_{${p},i}\,(W_q)_{i,${c}}`, prods(t.xn, model.Wq.map(r => r[c])), 3, t.q[c])))
					+ mx(aligned([[`q_{${p}}`, R`\approx ` + rowv(t.q, 2, 4)], [`k_{${p}}`, R`\approx ` + rowv(t.k, 2, 4)], [`v_{${p}}`, R`\approx ` + rowv(t.v, 2, 4)]]))
					+ note(`Each entry is one such sum of 8 products. The bar splits the heads: ${tex(R`q_{${p}} = \big[\,q^{(0)}_{${p}};\ q^{(1)}_{${p}}\,\big]`)}.`);
			},
			[ST.rope]: () => {
				const c = Math.cos(p), sn = Math.sin(p), [a, b] = t.q, [a2, b2] = t.qr;
				return mx(aligned([
					[R`t\,\theta`, R`= ${p}\cdot(1,\ 0.01) = (${p},\ ${num(p * 0.01)})\ \text{rad}`],
					[R`(q'_{${p},0},\ q'_{${p},1})`, R`= (q_{${p},0},\ q_{${p},1})\; R(${p})`],
					['', R`= (${num(a)},\ ${num(b)}) \begin{pmatrix} ${num(c)} & ${num(sn)} \\ ${num(-sn)} & ${num(c)} \end{pmatrix}`],
					['', R`\approx (${num(a2)},\ ${num(b2)})`],
				])) + mx(aligned([[`q'_{${p}}`, R`\approx ` + rowv(t.qr, 2, 4)], [`k'_{${p}}`, R`\approx ` + rowv(t.kr, 2, 4)]]))
					+ note(`A turn keeps length: ${tex(R`\lVert(q_{${p},0},\, q_{${p},1})\rVert = \lVert(q'_{${p},0},\, q'_{${p},1})\rVert \approx ${num(Math.hypot(a, b))}`)}. Pair 1 turns by only ${num(p * 0.01)} rad. ${tex('v')} is not turned.`);
			},
			[ST.cache]: () => mx(aligned([[R`K'_{\le ${p}},\ V_{\le ${p}}`, R`\in \mathbb{R}^{${p + 1}\times 8}`]]))
				+ note(p ? `Rows ${tex(R`0, \dots, ${p - 1}`)} were written by earlier passes; row ${tex(`${p}`)} is ${tex(`k'_{${p}}`)} and ${tex(`v_{${p}}`)}, and it stays for every later token.` : `The cache was empty; row 0 is ${tex(`k'_0`)} and ${tex('v_0')}.`)
				+ mx(R`\underbrace{2}_{K',\,V} \times \underbrace{8192}_{d} \times \underbrace{2\ \text{B}}_{\text{fp16}} \times \underbrace{80}_{L} \approx 2.6\ \text{MB a token}`)
				+ note('That is LLaMA 65B. A full context of 2,048 tokens holds 5.4 GB of cache.'),
			[ST.scores]: () => {
				const { nh, j, j1 } = focusKey(p), hd = t.heads[nh], sl = v => v.slice(nh * 4, nh * 4 + 4), hs = `^{(${nh})}`;
				const pr = prods(sl(t.qr), sl(TOK[j].kr), 2, 2);
				return mx(aligned([
					[`s${hs}_{${p},${j}}`, R`= \tfrac{1}{\sqrt{4}}\; q'${hs}_{${p}} \cdot k'${hs}_{${j}}`],
					['', R`= \tfrac12\big(` + pr.slice(0, 2).join(' + ')],
					['', R`\quad + ` + pr.slice(2).join(' + ') + R`\big)`],
					['', R`\approx ${num(hd.sc[j])}`],
					...(j1 >= 0 ? [[`s${hs}_{${p},${j1}}`, R`\approx ${num(hd.sc[j1])}`]] : []),
				])) + (j1 >= 0 ? note(`${tokHtml(j1)} and ${tokHtml(j)} are one word, so ${tex(`k_{${j1}} = k_{${j}}`)} before RoPE. Their scores differ only through the offsets, ${tex(`${p} - ${j1} = ${p - j1}`)} and ${tex(`${p} - ${j} = ${p - j}`)}.`) : '')
					+ mx(aligned([0, 1].map(h => [`s^{(${h})}_{${p}}`, R`\approx ` + rowv(t.heads[h].sc)])));
			},
			[ST.softmax]: () => {
				const { nh, j } = focusKey(p), hd = t.heads[nh], hs = `^{(${nh})}`, e = hd.sc.map(Math.exp);
				return mx(aligned([
					[`a${hs}_{${p},${j}}`, R`= \dfrac{e^{s_{${p},${j}}}}{\sum_{k=0}^{${p}} e^{s_{${p},k}}}`],
					['', R`= \dfrac{${num(e[j])}}{${e.map(v => num(v)).join(' + ')}}`],
					['', R`\approx ${num(hd.w[j])}`],
				])) + note(`Head ${nh}; each ${tex('s')} in the fraction is ${tex(`s${hs}`)}.`)
					+ mx(aligned([0, 1].map(h => [`a^{(${h})}_{${p}}`, R`\approx ` + rowv(t.heads[h].w)]))) + note('Each row sums to 1.');
			},
			[ST.blend]: () => {
				const { nh } = focusKey(p), hd = t.heads[nh], hs = `^{(${nh})}`, i = argabs(hd.o);
				return mx(aligned(sumRows(`o${hs}_{${p},${i}}`, R`\textstyle\sum_{j=0}^{${p}} a${hs}_{${p},j}\; v${hs}_{j,${i}}`, prods(hd.w, TOK.slice(0, p + 1).map(r => r.v[nh * 4 + i]), 2, 2), 3, hd.o[i])))
					+ mx(aligned([0, 1].map(h => [`o^{(${h})}_{${p}}`, R`\approx ` + rowv(t.heads[h].o)])))
					+ note(`Every weight of ${tex(`a${hs}_{${p}}`)} meets its own row of ${tex('V')}: the weights pick rows, and the values carry the content.`);
			},
			[ST.wo]: () => {
				const c = argabs(t.att);
				return mx(aligned([[`o_{${p}}`, R`= \big[\,o^{(0)}_{${p}};\ o^{(1)}_{${p}}\,\big]`], ['', R`\approx ` + rowv(t.cat, 2, 4)]]))
					+ mx(aligned(sumRows(`(o_{${p}}W_o)_{${c}}`, R`\textstyle\sum_k o_{${p},k}\,(W_o)_{k,${c}}`, prods(t.cat, model.Wo.map(r => r[c])), 3, t.att[c])))
					+ mx(aligned([[`o_{${p}}W_o`, R`\approx ` + rowv(t.att)]]));
			},
			[ST.add]: () => colAdd([`x_{${p}}`, '=', t.x, 2], [`o_{${p}}W_o`, R`\approx`, t.att, 2], [`h_{${p}}`, R`\approx`, t.out]),
			[ST.norm2]: () => rmsRows('h', p, t.out, 2, t.hrms, R`\hat h`, t.hn, R`\gamma_2`),
			[ST.gateUp]: () => {
				const c = argabs(t.g);
				return mx(aligned([
					...sumRows(`g_{${p},${c}}`, R`\textstyle\sum_i \hat h_{${p},i}\,(W_1)_{i,${c}}`, prods(t.hn, model.W1.map(r => r[c])), 3, t.g[c]),
					[`u_{${p},${c}}`, R`= \textstyle\sum_i \hat h_{${p},i}\,(W_3)_{i,${c}} \approx ${num(t.u[c])}`],
				])) + note(`Neuron ${c}, the one with the largest gate. ${tex(`g_{${p}}`)} and ${tex(`u_{${p}}`)} have 22 entries each, one per neuron; all of them are in the cells below.`);
			},
			[ST.swiglu]: () => {
				const c = argabs(t.g), c2 = t.g.indexOf(Math.min(...t.g));
				return mx(aligned([
					[`m_{${p},${c}}`, R`= \operatorname{SiLU}(g_{${p},${c}})\; u_{${p},${c}}`],
					['', R`= \dfrac{${num(t.g[c])}}{1 + e^{${num(-t.g[c])}}} \cdot ${par(t.u[c])}`],
					['', R`\approx ${num(t.sg[c])} \cdot ${par(t.u[c])} \approx ${num(t.m[c])}`],
					[R`\operatorname{SiLU}(g_{${p},${c2}})`, R`= \operatorname{SiLU}(${num(t.g[c2])}) \approx ${num(t.sg[c2])}`],
				])) + note(`SiLU never drops below −0.28, so a neuron with a negative gate passes almost nothing, whatever ${tex('u')} says.`);
			},
			[ST.down]: () => {
				const i = argabs(t.f), terms = prods(t.m, model.W2.map(r => r[i]), 2, 1);
				return mx(aligned([
					[`f_{${p},${i}}`, R`= \textstyle\sum_{c=0}^{21} m_{${p},c}\,(W_2)_{c,${i}}`],
					['', '= ' + terms.slice(0, 2).join(' + ') + R` + \cdots + ` + terms[FF - 1]],
					['', R`\approx ${num(t.f[i])}`],
					[`f_{${p}}`, R`\approx ` + rowv(t.f)],
				])) + note('22 products per output, one per neuron.');
			},
			[ST.add2]: () => colAdd([`h_{${p}}`, R`\approx`, t.out, 2], [`f_{${p}}`, R`\approx`, t.f, 2], [`y_{${p}}`, R`\approx`, t.y])
				+ note(`${tex(`y_{${p}}`)} is the layer’s output, and ${tex('x')} for the next layer.`),
			[ST.finalNorm]: () => rmsRows('y', p, t.y, 2, t.zrms, 'z', t.zn, R`\gamma_f`),
			[ST.logits]: () => {
				const js = argmax(t.logits), wj = word(V[js]);
				return mx(aligned(sumRows(R`\ell_{${p},${wj}}`, R`z_{${p}} \cdot (W_U)_{:,${wj}}`, prods(t.zn, model.WU.map(r => r[js])), 3, t.logits[js])))
					+ note('The largest logit. There is one such dot product for every token in the vocabulary: 16 here, 32,000 in LLaMA.');
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

	// ---- the captions: what the cubes are doing, in the token's numbers ---------------------
	function caption(p, s) {
		const t = TOK[p], w = `<i>${WORDS[p]}</i>`;
		const best = h => { const ws = t.heads[h].w, j = argmax(ws); return `<i>${tokName(j)}</i> (${ws[j].toFixed(2)})`; };
		const by = {
			[ST.arrive]: () => `${w} arrives at position ${p}, and its row of x lights up. ${p ? 'The pale rows above it are earlier tokens. This layer kept only their keys and values.' : 'Nothing has passed through yet.'}`,
			[ST.norm]: () => `RMSNorm divides the row by its root mean square, ${fmt(t.rms, 2)}, so the branch works at unit scale.`,
			[ST.qkv]: () => 'Wq, Wk and Wv make q, k and v. Each 8-number row folds into two heads of 4, so the cubes land in two layers.',
			[ST.rope]: () => `RoPE turns q and k pair by pair: pair 0 by ${p} rad, pair 1 by ${(p * 0.01).toFixed(2)} rad. The same word at another position gets a different key.`,
			[ST.cache]: () => `k′ and v drop into row ${p} of the cache. ${p ? `Rows 0–${p - 1} were written by earlier passes.` : 'The cache was empty.'} They stay for every later token.`,
			[ST.scores]: () => 'q′ meets every cached key, head by head: q′·k′ⱼ ÷ √4. A new row of scores grows in a.',
			[ST.softmax]: () => `Softmax turns each head's scores into weights that sum to 1. Head 0 puts most on ${best(0)}, head 1 on ${best(1)}.`,
			[ST.blend]: () => 'o = a V uses both. Each head’s weights and the cached value rows converge on o: every row of V arrives scaled by its weight aⱼ, bright where the weight is large, and they add up into the new row of o.',
			[ST.wo]: () => 'The two head layers unfold into one row, and Wo mixes them.',
			[ST.add]: () => 'x comes down the rail and is added: h = x + o Wo. Attention is done.',
			[ST.norm2]: () => `The FFN starts with its own RMSNorm. The row of h is divided by its root mean square, ${fmt(t.hrms, 2)}.`,
			[ST.gateUp]: () => 'ĥ becomes the 8 input nodes. Each of the 22 neurons has a gate node fed by W1 and a value node fed by W3, 8 edges each. As you scroll, each neuron’s edges light up and its nodes fill: input × weight, summed.',
			[ST.swiglu]: () => `Each neuron's gate passes through SiLU and scales its value: m = SiLU(g) ⊙ u. ${t.g.filter(v => v < 0).length} of the 22 gates are negative here, and those neurons are nearly shut.`,
			[ST.down]: () => 'Every neuron connects to all 8 outputs through W2. Each output node sums its 22 incoming edges, m × weight, and the outputs fill one at a time.',
			[ST.add2]: () => `The 8 outputs drop back into the residual row, and h comes down the rail: y = h + f. Row ${p} of y is the layer's output for ${w}.`,
			[ST.finalNorm]: () => `In LLaMA, y would pass through 79 more layers first; this toy has one. A final RMSNorm divides it by ${fmt(t.zrms, 2)} and gives z, the input to the LM head.`,
			[ST.logits]: () => 'The unembedding W_U scores every token in the vocabulary: each logit is z dotted with that token’s column. 16 tokens here, 32,000 in LLaMA. The sweep fills them one at a time.',
			[ST.pick]: () => `Softmax turns the logits into probabilities, and greedy decoding picks the largest: <i>${esc(VOCAB[t.pick])}</i> (${t.probs[t.pick].toFixed(2)}). `
				+ (t.nextReal >= 0
					? `The sentence actually continues with <i>${esc(VOCAB[t.nextReal])}</i>, which gets ${t.probs[t.nextReal].toFixed(3)}; training would push that up, and −log of it, ${(-Math.log(t.probs[t.nextReal])).toFixed(2)}, is the loss here.`
					: 'In generation the pick would be appended as position 6 and fed back in as the next pass.'),
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
		v8(vals, keyf, name, sub, max = 3) { // a row of 8, split between the heads
			this.lab(this.y, name, sub);
			vals.forEach((v, f) => this.push(cell(VX + f * 30 + (f >= 4 ? 6 : 0), this.y, v, keyf(f), max, 30)));
			this.y += 26;
		}
		v22(vals, keyf, name, sub) { // the FFN's 22, on two lines
			this.lab(this.y, name, sub);
			vals.forEach((v, c) => this.push(cell(VX + (c % 11) * CW, this.y + Math.floor(c / 11) * 20, v, keyf(c), 3, CW, 'v', true)));
			this.y += 46;
		}
		op(txt) { this.push(`<text x="${VX}" y="${this.y + 11}" class="po">${txt}</text>`); this.y += 18; }
		heads() { [0, 1].forEach(h => this.push(`<text x="${VX + h * 126}" y="${this.y + 8}" class="hl">head ${h}</text>`)); this.y += 12; }
		head(txt) { this.push(`<text x="${VX}" y="${this.y + 9}" class="hl">${txt}</text>`); this.y += 14; }
		tok(yy, j) { this.push(`<text x="${VX - 8}" y="${yy + 13}" class="rl${j === this.p ? ' cur' : ''}" text-anchor="end">${tokName(j)}</text>`); }
		svg() { return `<svg viewBox="0 0 ${VX + 300} ${this.y + 4}" role="img" aria-label="The arithmetic for this step">${this.o.join('')}</svg>`; }
	}
	function panelSVG(p, s) {
		const t = TOK[p], sh = new Sheet(p), V = VOCAB;
		const kx = f => `x|0|${p}|${f}`, kh = b => f => `${b}|${f >> 2}|${p}|${f & 3}`, k8 = b => f => `${b}|0|${p}|${f}`, kg = b => c => `${b}|${b === 'u' ? 1 : 0}|${p}|${c}`;
		const vlab = (x, yy, j) => sh.push(`<text x="${x}" y="${yy}" class="hl" text-anchor="middle">${esc(V[j])}</text>`);
		const by = {
			[ST.arrive]: () => sh.v8(t.x, kx, 'x', `${WORDS[p]} arrives`),
			[ST.norm]: () => { sh.v8(t.x, kx, 'x'); sh.op(`÷ rms(x) = ${fmt(t.rms, 3)}, then × gain (1 here)`); sh.v8(t.xn, kx, 'x̂'); },
			[ST.qkv]: () => { sh.v8(t.xn, kx, 'x̂'); sh.y += 6; sh.heads(); sh.v8(t.q, kh('q'), 'q', 'x̂ Wq'); sh.v8(t.k, kh('k'), 'k', 'x̂ Wk'); sh.v8(t.v, kh('v'), 'v', 'x̂ Wv'); },
			[ST.rope]: () => {
				sh.heads(); sh.v8(t.q, kh('q'), 'q'); sh.v8(t.qr, kh('q'), 'q′', 'turned'); sh.y += 6; sh.v8(t.k, kh('k'), 'k'); sh.v8(t.kr, kh('k'), 'k′', 'turned'); sh.y += 10;
				for (let n = 0; n < 4; n++) {
					const h = n >> 1, pr = n & 1, i = h * 4 + pr * 2, x = VX + 14 + n * 64, d = p * THETA[pr];
					sh.push(`<text x="${x}" y="${sh.y + 8}" class="hl" text-anchor="middle">h${h} pair ${pr}</text>`, dial(x, sh.y + 28, t.q[i], t.q[i + 1], t.qr[i], t.qr[i + 1], d, '#3d63c4'), dial(x, sh.y + 62, t.k[i], t.k[i + 1], t.kr[i], t.kr[i + 1], d, '#c8741f'));
				}
				sh.push(`<text x="${VX - 8}" y="${sh.y + 32}" class="pl" text-anchor="end"><tspan class="pv">q</tspan></text><text x="${VX - 8}" y="${sh.y + 66}" class="pl" text-anchor="end"><tspan class="pv">k</tspan></text>`);
				sh.y += 84;
			},
			[ST.cache]: () => [['K′ cache', j => TOK[j].kr, 'k'], ['V cache', j => TOK[j].v, 'v']].forEach(([title, vals, b]) => {
				sh.head(`${title} · head 0 | head 1`);
				for (let j = 0; j <= p; j++) {
					sh.tok(sh.y, j);
					vals(j).forEach((v, f) => sh.push(cell(VX + f * 30 + (f >= 4 ? 6 : 0), sh.y, v, `${b}|${f >> 2}|${j}|${f & 3}`, 3, 30)));
					if (j === p) sh.push(`<rect x="${VX - 1.5}" y="${sh.y - 1.5}" width="${8 * 30 + 9}" height="${CH + 3}" class="new"/>`);
					sh.y += 19;
				}
				sh.y += 8;
			}),
			[ST.scores]: () => [0, 1].forEach(h => {
				const hd = t.heads[h], sl = v => v.slice(h * 4, h * 4 + 4);
				sh.head(`head ${h}: q′${SUB[h]} · k′ⱼ ÷ √4`);
				sh.lab(sh.y, 'q′' + SUB[h]);
				sl(t.qr).forEach((v, i) => sh.push(cell(VX + i * 30, sh.y, v, `q|${h}|${p}|${i}`, 3, 30)));
				sh.y += 24;
				for (let j = 0; j <= p; j++) {
					sh.tok(sh.y, j);
					sl(TOK[j].kr).forEach((v, i) => sh.push(cell(VX + i * 30, sh.y, v, `k|${h}|${j}|${i}`, 3, 30)));
					sh.push(`<text x="${VX + 126}" y="${sh.y + 13}" class="po">→</text>`, cell(VX + 144, sh.y, hd.sc[j], `a|${h}|${p}|${j}`, 4, 40));
					sh.y += 19;
				}
				sh.y += 8;
			}),
			[ST.softmax]: () => [0, 1].forEach(h => {
				const hd = t.heads[h];
				sh.head(`head ${h}: softmax of the scores`);
				for (let j = 0; j <= p; j++) {
					const wv = hd.w[j];
					sh.tok(sh.y, j);
					sh.push(cell(VX, sh.y, hd.sc[j], `a|${h}|${p}|${j}`, 4, 40), `<text x="${VX + 46}" y="${sh.y + 13}" class="po">→</text>`,
						`<g data-k="a|${h}|${p}|${j}"><rect x="${VX + 62}" y="${sh.y + 3}" width="${Math.max(0.6, wv * 150).toFixed(1)}" height="12" class="wb"/><text x="${(VX + 66 + wv * 150).toFixed(1)}" y="${sh.y + 13}" class="wv">${wv.toFixed(2)}</text></g>`);
					sh.y += 19;
				}
				sh.y += 8;
			}),
			[ST.blend]: () => [0, 1].forEach(h => {
				const hd = t.heads[h], sl = v => v.slice(h * 4, h * 4 + 4);
				sh.head(`head ${h}: o${SUB[h]} = Σ aⱼ vⱼ`);
				for (let j = 0; j <= p; j++) {
					sh.tok(sh.y, j);
					sh.push(cell(VX, sh.y, hd.w[j], `a|${h}|${p}|${j}`, 1, 40, 'w'), `<text x="${VX + 46}" y="${sh.y + 13}" class="po">×</text>`);
					sl(TOK[j].v).forEach((v, i) => sh.push(cell(VX + 60 + i * 30, sh.y, v, `v|${h}|${j}|${i}`, 3, 30)));
					sh.y += 19;
				}
				sh.push(`<path d="M${VX + 60},${sh.y + 2}h120" class="hb"/><text x="${VX + 52}" y="${sh.y + 19}" class="rl" text-anchor="end">o${SUB[h]} =</text>`);
				hd.o.forEach((v, i) => sh.push(cell(VX + 60 + i * 30, sh.y + 6, v, `o|${h}|${p}|${i}`, 3, 30)));
				sh.y += 38;
			}),
			[ST.wo]: () => { sh.heads(); sh.v8(t.cat, kh('o'), 'o', 'both heads'); sh.op('concat, then × Wo'); sh.v8(t.att, k8('h'), 'o Wo'); },
			[ST.add]: () => { sh.v8(t.x, kx, 'x', 'off the rail'); sh.op('+'); sh.v8(t.att, () => null, 'o Wo'); sh.op('='); sh.v8(t.out, k8('h'), 'h', 'x + o Wo'); },
			[ST.norm2]: () => { sh.v8(t.out, k8('h'), 'h'); sh.op(`÷ rms(h) = ${fmt(t.hrms, 3)}, then × gain (1 here)`); sh.v8(t.hn, k8('h'), 'ĥ'); },
			[ST.gateUp]: () => {
				const c = argabs(t.g);
				sh.v8(t.hn, k8('hc'), 'ĥ', '8 inputs');
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="hl">neuron ${c}: its 8 W1 edges, input × weight, summed</text>`); sh.y += 16;
				sh.v8(model.W1.map(r => r[c]), f => `w1|0|${f}|${c}`, `W1[:, ${c}]`, '', 1.6);
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="po">= Σ ĥ × W1[:, ${c}] =</text>`, cell(VX + 150, sh.y - 2, t.g[c], `g|0|${p}|${c}`, 3, 40)); sh.y += 26;
				sh.v22(t.g, kg('g'), 'g', 'ĥ W1'); sh.v22(t.u, kg('u'), 'u', 'ĥ W3');
			},
			[ST.swiglu]: () => {
				sh.v22(t.g, kg('g'), 'g'); sh.v22(t.u, kg('u'), 'u');
				// the gate: SiLU, with this token's 22 gates on it
				const PW = 286, PH = 96, y = sh.y, zx = z => VX + (z + 4.5) / 9 * PW, zy = v => y + PH - (v + 0.6) / 5.1 * PH, silu = z => z / (1 + Math.exp(-z));
				let d = '';
				for (let z = -4.5; z <= 4.5001; z += 0.1) d += (d ? 'L' : 'M') + zx(z).toFixed(1) + ',' + zy(silu(z)).toFixed(1);
				sh.push(`<rect x="${VX}" y="${y}" width="${PW}" height="${PH}" fill="#ffffff" stroke="#d6d2da"/><path d="M${VX},${zy(0).toFixed(1)}h${PW}M${zx(0).toFixed(1)},${y}v${PH}" stroke="#e2e2e2"/><path d="${d}" fill="none" stroke="#55505a" stroke-width="1.4"/>`);
				t.g.forEach((g, c) => sh.push(`<g data-k="g|0|${p}|${c}"><circle cx="${zx(clamp(g, -4.5, 4.5)).toFixed(1)}" cy="${zy(t.sg[c]).toFixed(1)}" r="3.2" fill="${rgb(valueColour(t.m[c]))}" stroke="#000" stroke-width="0.6"/></g>`));
				sh.push(`<text x="${VX + 6}" y="${y + 13}" class="hl">SiLU(g) against g, one dot per neuron, coloured by m</text>`, `<text x="${VX - 8}" y="${y + PH / 2}" class="pl" text-anchor="end"><tspan class="pv">SiLU</tspan></text>`);
				sh.y += PH + 8;
				sh.v22(t.m, kg('m'), 'm', 'SiLU(g) ⊙ u');
			},
			[ST.down]: () => {
				const i = argabs(t.f);
				sh.v22(t.m, kg('m'), 'm');
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="hl">output ${i}: its 22 W2 edges, m × weight, summed</text>`); sh.y += 16;
				sh.v22(model.W2.map(r => r[i]), c => `w2|0|${i}|${c}`, `W2ᵀ[${i}, :]`);
				sh.push(`<text x="${VX}" y="${sh.y + 11}" class="po">= Σ m × W2ᵀ[${i}, :] =</text>`, cell(VX + 150, sh.y - 2, t.f[i], `fc|0|${p}|${i}`, 3, 40)); sh.y += 26;
				sh.v8(t.f, k8('fc'), 'f', 'm W2');
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
	// One section per component, each with its prerequisites and its forward pass, built
	// once from the data. The current step's detail block moves into that step's row.
	const side = $('.toy-side'), sideHead = $('.toy-sidehead'), nav = $('.toy-nav'), map = $('.toy-map'), secs = $('.toy-secs');
	const detail = $('.toy-detail'), panel = $('.toy-panel'), crumb = $('.lit-crumb');
	const PRE = {};
	DATA.prerequisites.forEach(it => { PRE[it.id] = it; });
	DATA.components.forEach(c => c.pre.forEach((id, k) => { PRE[id].tag = c.n + 'abcdefgh'[k]; }));
	const COMP_OF = [];
	DATA.components.forEach(c => c.steps.forEach(s => { COMP_OF[s] = c; }));
	const preRef = id => `<button type="button" class="toy-ref" data-pre="${id}">${PRE[id].tag} ${PRE[id].title}</button>`;
	const stepRef = s => `<button type="button" class="toy-ref" data-step="${s}">(${s + 1})</button>`;

	function buildSide() {
		const usedIn = {};
		DATA.steps.forEach((st, s) => st.uses.forEach(id => (usedIn[id] = usedIn[id] || []).push(s)));
		const preItem = id => {
			const it = PRE[id];
			return `<div class="toy-pre" data-pre="${id}"><div class="toy-preh" role="heading" aria-level="4"><span class="num">${it.tag}</span>${it.title}${it.cite ? `<em>${it.cite}</em>` : ''}</div>${typeset(it.body)}`
				+ (usedIn[id] ? `<div class="toy-used">used in ${usedIn[id].map(stepRef).join(' ')}</div>` : '') + '</div>';
		};
		const stepItem = s => `<section class="toy-fp" data-s="${s}"><button type="button" class="toy-fph" data-step="${s}" aria-label="Go to step ${s + 1}: ${DATA.steps[s].title}">`
			+ `<span class="n">(${s + 1})</span><b>${DATA.steps[s].title}</b><span class="eq">${tex(DATA.steps[s].eq)}</span></button></section>`;
		nav.innerHTML = DATA.components.map(c => `<button type="button" data-go="${c.id}"><span>${c.n}</span> ${c.nav}</button>`).join('');
		secs.innerHTML = DATA.components.map(c => `<section class="toy-cp" data-cp="${c.id}"><div class="toy-cph" role="heading" aria-level="3"><span class="num">${c.n}</span>${c.name}<small>${c.tag}</small></div>`
			+ (c.intro ? `<p class="toy-intro">${c.intro}</p>` : '')
			+ (c.eq ? mx(c.eq, 'toy-cpeq') : '')
			+ `<div class="toy-sub">${c.steps.length ? 'Prerequisites' : 'Setup'}</div>` + c.pre.map(preItem).join('')
			+ (c.also ? `<p class="toy-also">Also uses ${c.also.map(preRef).join(', ')}.</p>` : '')
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
		$('.toy-uses').innerHTML = 'uses ' + DATA.steps[s].uses.map(preRef).join(' ');
		$('.toy-cap').innerHTML = caption(cur, s);
		$('.toy-num').innerHTML = numbers(cur, s);
		panel.innerHTML = panelSVG(cur, s);
		if (hoverKey) markPanel(hoverKey);
		$('.toy-notes').innerHTML = DATA.steps[s].notes.map(n => `<li>${n}</li>`).join('');
		$$('button', map).forEach((b, i) => { b.classList.toggle('on', i === s); b.classList.toggle('done', i < s); });
		$('.toy-end').hidden = s !== NST - 1;
		$('[data-act="nexttok"]').textContent = cur < T - 1 ? `Run the next token: ${tokName(cur + 1)} →` : 'Back to the first token';
		crumb.textContent = `${tokName(cur)} · step ${s + 1} of ${NST}`;
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
		else if (b.dataset.pre) { const el = $(`.toy-pre[data-pre="${b.dataset.pre}"]`, secs); sideTo(el); flash(el); }
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
	// the scroll lives inside the pane: a sticky stage over a spacer as long as the seventeen moves
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
	$('.toy-toks', tool).innerHTML = WORDS.map((w, j) => `<button type="button" class="lit-btn" data-tok="${j}">${w}<sub>${j}</sub></button>`).join('');
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
			return { in: `input ĥ[${n.i}] = ${v}`, g: `gate g, neuron ${n.i} = ${v} · SiLU ${fmt(t.sg[n.i], 3)}`, u: `value u, neuron ${n.i} = ${v}`, m: `neuron ${n.i}: SiLU(g) × u = ${v}`, out: `output f[${n.i}] = ${v}` }[n.kind] + wait;
		}
		// named for the step its value comes from: mid-move a carried cube already holds the next step's
		const s = c.st, name = wallLabel(c.b, s)[0], who = tokName(c.t);
		const past = c.t < cur && c.b !== 'k' && c.b !== 'v' ? ' · from an earlier pass' : '';
		const v = c.b === 'a' && !(s === ST.scores && c.t === cur) ? c.val.toFixed(3) : fmt(c.val, 3);
		if (c.b === 'a') return `${name}[head ${c.h}, query ${who}, key ${tokName(c.i)}] = ${v}${past}`;
		if (['q', 'k', 'v', 'o'].includes(c.b)) return `${name}[head ${c.h}, ${who}, ${c.i}] = ${v}${past}`;
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
	// a closed window lets go of everything, so it can be freed
	document.addEventListener('content:swapped', function closed() {
		if (root.isConnected) return;
		resized.disconnect();
		stopPlay();
		clearTimeout(explainTimer);
		document.removeEventListener('content:swapped', closed);
	});
})();
