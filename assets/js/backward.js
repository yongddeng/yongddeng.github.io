// backward.exe, for 307: one backward pass through a small network, x → Linear → φ
// → Linear → φ → Linear, under nn.MSELoss over a batch of 8, in float64, run a
// node at a time in the order torch.autograd's engine runs it. Every partial
// derivative has one of three roles: ∂J/∂W and ∂J/∂b update, kept in .grad;
// δ = ∂J/∂z and ∂J/∂a back-propagate, handed down one hop and dropped; a local
// derivative multiplies, from what the forward pass saved. Two views of the one
// pass. Pass: the derivative tree, the tape of gates and the graph torch
// records, on one vertical from J down to x, over what the pass costs, each
// node a vector–Jacobian product against the forward pass. Chain Rule:
// the chain rule a line at a time, each line the product a line above made
// times one local derivative, over what is held, step by step. Drawn in
// PyTorch's red, indigo and teal on white, a colour a role, set in IBM Plex.
// The desktop runs a window's scripts each time it opens one, so this runs once
// per window and claims it with data-ready.
(function () {
	const root = document.querySelector('.grd:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';
	const $ = sel => root.querySelector(sel), $$ = sel => [...root.querySelectorAll(sel)];
	const say = exeStatus(root);

	const WIDTHS = [4, 6, 6, 3];         // x's width, then each layer's
	const L = WIDTHS.length - 1;         // layers
	const BATCH = 8;                     // inputs in the batch
	const SHOWN = 0;                     // the input the tape and the step show, the first
	const ENTRIES = BATCH * WIDTHS[L];   // the entries nn.MSELoss takes the mean over
	const SEED = 7;                      // the weights' draw, and the data's
	const STEP_MS = 1300;                // Run's pace at ×1, a node a step, with time to read each

	// ---- the look: PyTorch's, its red, indigo and teal on white, the words and
	// the code set in IBM Plex as its pages are, the maths in Georgia, every size
	// a tenth up so the panes read at a glance. weight is what updates, grad what
	// back-propagates, act a local derivative, which multiplies; gold the step's
	// path and ink the node running, both black; onfill words on a solid role.
	// The three pass the dataviz validator on white, every pair: colour-blind
	// separation 12.6, normal vision 27, contrast 4.5:1 or more. The chain rule's
	// table takes the same colours from the stylesheet ----
	const INK = {
		ink: '#141414', grad: '#e0301e', weight: '#3f3ac6', act: '#08866d', text: '#111111', grid: '#c3c6d0',
		frame: '#8f929b', paper: '#f6f6f8', ground: '#ffffff', sign: '#141414', mute: '#4a4a52', edge: '#7a7d86',
		param: '#141414', data: '#4a4a52', gold: '#141414', card: '#f3f4f7', wire: '#2a2a2a', onfill: '#ffffff',
	};
	// a faded mark's opacity, held up to a floor so it still reads
	const faded = a => Math.max(a, 0.6);
	// one language for memory in every pane, the tracks': what is held solid in its own colour; what is gone from
	// memory, freed or dropped, faded in its own colour, a fill, a line or words; what is still to come dashed
	const GONE = { fill: 0.25, line: 0.35, text: 0.6 }, AHEAD = [3, 2];
	// a canvas font's size, a tenth up on the size it was drawn at; the code's names keep theirs, the graph's
	// boxes being measured for them
	const SCALE = 1.1, scaled = n => `${+(n * SCALE).toFixed(2)}px `;
	const SANS = '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
	const MONOFACE = '"IBM Plex Mono", "Lucida Console", Menlo, Monaco, monospace';
	const FONT = scaled(10.5) + SANS, SMALL = scaled(10) + SANS, BOLD = '600 ' + scaled(12) + SANS, NAME = 'italic ' + scaled(12.5) + SERIF;
	const MONO = '9.5px ' + MONOFACE;
	// IBM Plex comes from Google Fonts with the first window, as KaTeX comes from cdnjs with the first maths. A
	// canvas cannot wait for a face, so the panes are drawn at once in the fallbacks and again once Plex is in
	const PLEX = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans:wght@400;600&display=swap';
	function plex() {
		let link = document.querySelector(`link[href="${PLEX}"]`);
		if (!link) {
			link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: PLEX });
			document.head.appendChild(link);
		}
		const sheet = link.sheet ? Promise.resolve() : new Promise(done => link.addEventListener('load', done, { once: true }));
		return sheet.then(() => Promise.all([FONT, BOLD, MONO].map(f => document.fonts.load(f))));
	}

	// ---- numbers ----
	const sub = n => String(n).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
	// to three figures, with a true minus
	function fmt(v, p = 3) {
		if (v === 0 || !isFinite(v)) return String(v);
		const a = Math.abs(v), sign = v < 0 ? '−' : '';
		if (a >= 1e-3 && a < 1e5) return sign + String(+a.toPrecision(p));
		const e = Math.floor(Math.log10(a));
		return `${sign}${+(a / 10 ** e).toPrecision(2)}×${exePower(e)}`;
	}
	// bytes, as float32 would hold them
	function size(n) {
		if (n < 1024) return `${Math.round(n)} B`;
		return n < 1024 ** 2 ? `${+(n / 1024).toPrecision(3)} KiB` : `${+(n / 1024 ** 2).toPrecision(3)} MiB`;
	}
	const rgba = (hex, a) => `rgba(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')}, ${a})`;
	const within = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

	// ---- a pane's furniture ----
	// a pane's canvas, cleared to the paper, lighter at its middle, squared in
	// faint lines
	function paper(cv) {
		const { cx, W, H } = fitCanvas(cv);
		const g = cx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.75);
		g.addColorStop(0, INK.ground);
		g.addColorStop(1, INK.paper);
		cx.fillStyle = g;
		cx.fillRect(0, 0, W, H);
		for (let k = 0; k * 12 < Math.max(W, H); k++) {
			cx.fillStyle = rgba(INK.grid, k % 5 ? 0.16 : 0.32);
			cx.fillRect(k * 12, 0, 1, H);
			cx.fillRect(0, k * 12, W, 1);
		}
		return { cx, W, H };
	}
	// a run of words along the baseline y from x, each [text, colour, font]; returns where it ends
	function words(cx, parts, x, y) {
		cx.textAlign = 'left';
		for (const [text, colour, font] of parts) {
			if (font) cx.font = font;
			cx.fillStyle = colour;
			cx.fillText(text, x, y);
			x += cx.measureText(text).width;
		}
		return x;
	}
	// words set from x, or centred on it, or ending at it, the first with a font
	function put(cx, parts, x, y, align = 'left') {
		let w = 0;
		for (const [text, , font] of parts) {
			if (font) cx.font = font;
			w += cx.measureText(text).width;
		}
		words(cx, parts, align === 'right' ? x - w : align === 'center' ? x - w / 2 : x, y);
	}
	// words set across a width, broken where they no longer fit; returns the baseline after the last line
	function wrap(cx, text, x, y, width, colour, font, lead) {
		cx.font = font;
		cx.fillStyle = colour;
		cx.textAlign = 'left';
		let row = '';
		for (const w of text.split(' ')) {
			const next = row ? `${row} ${w}` : w;
			if (cx.measureText(next).width > width && row) {
				cx.fillText(row, x, y);
				y += lead;
				row = w;
			} else row = next;
		}
		if (row) cx.fillText(row, x, y);
		return y + lead;
	}
	// a pane's heading: its title in bold, underlined in red, a key a series beside it, the keys going on to a line under it where
	// the pane is too narrow for them, as on a phone; returns how far down that line moves what is under it
	function heading(cx, title, keys = []) {
		const end = words(cx, [[title, INK.sign, BOLD]], 8, 15);
		cx.fillStyle = INK.grad;
		cx.fillRect(8, 18, end - 8, 2);
		let x = end + 10, y = 15;
		cx.font = FONT;
		for (const [colour, text] of keys) {
			if (x + cx.measureText(text).width > cx.canvas.clientWidth - 8) [x, y] = [8, y + 13];
			x = words(cx, [[text, colour]], x, y) + 9;
		}
		return y - 15;
	}
	// maths set as a printed page sets it, along the baseline y from x: a string, or [text, colour], in italic;
	// {op} upright with room either side; {n, d} a fraction, its bar on the maths axis. With measure, nothing
	// is drawn. Returns where the run ends
	function maths(cx, x, y, pieces, px = 12, colour = INK.sign, measure = false) {
		px *= SCALE;
		for (const p of pieces) {
			if (p.n !== undefined) {
				cx.font = `italic ${Math.round(px * 0.88)}px ${SERIF}`;
				const w = Math.max(cx.measureText(p.n).width, cx.measureText(p.d).width) + 5, bar = y - px * 0.3;
				if (!measure) {
					cx.fillStyle = p.c || colour;
					cx.textAlign = 'center';
					cx.fillText(p.n, x + w / 2, bar - px * 0.22);
					cx.fillText(p.d, x + w / 2, bar + px * 0.8);
					cx.fillRect(x + 1.5, bar, w - 3, 0.9);
				}
				x += w;
			} else if (p.op !== undefined) {
				cx.font = `${px}px ${SERIF}`;
				const w = cx.measureText(p.op).width + px * 0.55;
				if (!measure) {
					cx.fillStyle = p.c || INK.text;
					cx.textAlign = 'center';
					cx.fillText(p.op, x + w / 2, y);
				}
				x += w;
			} else {
				const [t, c] = Array.isArray(p) ? p : [p, colour];
				cx.font = `italic ${px}px ${SERIF}`;
				if (!measure) {
					cx.fillStyle = c;
					cx.textAlign = 'left';
					cx.fillText(t, x, y);
				}
				x += cx.measureText(t).width;
			}
		}
		return x;
	}
	// ∂top/∂bottom, a fraction for maths(), in a colour
	const partial = (top, bottom, c) => ({ n: `∂${top}`, d: `∂${bottom}`, c });
	function line(cx, pts, colour, width = 1, dash = []) {
		cx.strokeStyle = colour;
		cx.lineWidth = width;
		cx.setLineDash(dash);
		cx.beginPath();
		pts.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y)));
		cx.stroke();
		cx.setLineDash([]);
	}
	// a path, traced by draw, stroked in a colour at a width and an opacity
	function pen(cx, draw, colour, width = 1.2, alpha = 1) {
		cx.save();
		cx.strokeStyle = colour;
		cx.globalAlpha = alpha;
		cx.lineWidth = width;
		draw();
		cx.stroke();
		cx.restore();
	}
	function penLine(cx, pts, colour, width = 1.2, alpha = 1, dash = []) {
		pen(cx, () => {
			cx.setLineDash(dash);
			cx.beginPath();
			pts.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y)));
		}, colour, width, alpha);
	}
	function arrow(cx, pts, colour, width = 1.2) {
		line(cx, pts, colour, width);
		const [px, py] = pts[pts.length - 2], [x, y] = pts[pts.length - 1], a = Math.atan2(y - py, x - px);
		cx.fillStyle = colour;
		cx.beginPath();
		cx.moveTo(x, y);
		cx.lineTo(x - 6 * Math.cos(a - 0.42), y - 6 * Math.sin(a - 0.42));
		cx.lineTo(x - 6 * Math.cos(a + 0.42), y - 6 * Math.sin(a + 0.42));
		cx.fill();
	}
	const box = (cx, x, y, w, h) => {
		cx.beginPath();
		cx.rect(x, y, w, h);
	};
	const disc = (cx, x, y, r) => {
		cx.beginPath();
		cx.arc(x, y, r, 0, 2 * Math.PI);
	};
	// a tensor's entries as a heatmap, darker the larger in size
	function heat(cx, x, y, M, rows, cols, cell, colour) {
		let max = 1e-12;
		for (let k = 0; k < rows * cols; k++) max = Math.max(max, Math.abs(M[k]));
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
			cx.fillStyle = rgba(colour, 0.07 + 0.93 * Math.abs(M[r * cols + c]) / max);
			cx.fillRect(x + c * cell, y + r * cell, cell - 1, cell - 1);
		}
	}
	// one input's row of a tensor as cells, darker the larger
	function strip(cx, x, y, vals, n, count, cell, colour, alpha = 1) {
		const max = vals.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-12);
		cx.globalAlpha = alpha;
		for (let c = 0; c < count; c++) {
			cx.fillStyle = rgba(colour, 0.08 + 0.92 * Math.abs(vals[n * count + c]) / max);
			cx.fillRect(x + c * cell, y, cell - 1, cell - 1);
		}
		cx.globalAlpha = 1;
	}

	// ---- the network: x → Linear → φ → Linear → φ → Linear → z₃, under
	// nn.MSELoss, in float64 ----
	// each activation: its φ and φ′, φ′ from what its node saved, the node autograd records for it, and its local
	// derivative as the chain rule writes it
	const ACTS = {
		tanh: {
			label: 'tanh', f: Math.tanh, d: (z, a) => 1 - a * a,
			node: 'TanhBackward0', saves: 'result', local: k => `1 − a${sub(k)}²`,
		},
		relu: {
			label: 'ReLU', f: z => Math.max(z, 0), d: (z, a) => (a > 0 ? 1 : 0),
			node: 'ReluBackward0', saves: 'result', local: k => `1[a${sub(k)} > 0]`,
		},
	};
	// nn.Linear's own init, U(−1/√fan-in, 1/√fan-in) for W and b
	function params(seed) {
		const r = exeRng(seed), W = [null], b = [null];
		for (let l = 1; l <= L; l++) {
			const n = WIDTHS[l], m = WIDTHS[l - 1], k = 1 / Math.sqrt(m);
			W[l] = Float64Array.from({ length: n * m }, () => (2 * r() - 1) * k);
			b[l] = Float64Array.from({ length: n }, () => (2 * r() - 1) * k);
		}
		return { W, b };
	}
	// x and the targets standard normal, the first of a draw of 64 each
	function data(seed) {
		const g = exeRng(seed * 31 + 5);
		const X = Float64Array.from({ length: 64 * WIDTHS[0] }, () => exeNormal(g)).slice(0, BATCH * WIDTHS[0]);
		const Y = Float64Array.from({ length: 64 * WIDTHS[L] }, () => exeNormal(g)).slice(0, BATCH * WIDTHS[L]);
		return { X, Y };
	}
	function forward(net) {
		const { W, b, X } = net, f = ACTS[net.act].f, a = [X], z = [null];
		for (let l = 1; l <= L; l++) {
			const n = WIDTHS[l], m = WIDTHS[l - 1], Z = new Float64Array(BATCH * n);
			for (let r = 0; r < BATCH; r++) for (let o = 0; o < n; o++) {
				let s = b[l][o];
				for (let i = 0; i < m; i++) s += a[l - 1][r * m + i] * W[l][o * m + i];
				Z[r * n + o] = s;
			}
			z[l] = Z;
			a[l] = l < L ? Z.map(f) : Z;
		}
		return { a, z };
	}
	// J as nn.MSELoss() takes it: the mean over all the batch's entries
	function lossOf(net, a) {
		let s = 0;
		for (let k = 0; k < a[L].length; k++) s += (a[L][k] - net.Y[k]) ** 2;
		return s / a[L].length;
	}
	function backward(net, fw) {
		const { W } = net, act = ACTS[net.act], { a, z } = fw;
		const d = [], da = [], gW = [], gb = [], dphi = [];
		d[L] = a[L].map((v, k) => 2 * (v - net.Y[k]) / ENTRIES);
		for (let l = L; l >= 1; l--) {
			const no = WIDTHS[l], ni = WIDTHS[l - 1];
			gW[l] = new Float64Array(no * ni);
			gb[l] = new Float64Array(no);
			da[l - 1] = new Float64Array(BATCH * ni);
			for (let r = 0; r < BATCH; r++) for (let o = 0; o < no; o++) {
				const g = d[l][r * no + o];
				gb[l][o] += g;
				for (let i = 0; i < ni; i++) {
					gW[l][o * ni + i] += g * a[l - 1][r * ni + i];
					da[l - 1][r * ni + i] += g * W[l][o * ni + i];
				}
			}
			if (l > 1) {
				dphi[l - 1] = z[l - 1].map((v, k) => act.d(v, a[l - 1][k]));
				d[l - 1] = da[l - 1].map((v, k) => v * dphi[l - 1][k]);
			}
		}
		return { d, da, gW, gb, dphi };
	}
	// every ∂J/∂W and ∂J/∂b against central differences, the largest gap over the largest gradient
	function gradcheck(net, bw) {
		const eps = 1e-6;
		let worst = 0, scale = 1e-12;
		for (let l = 1; l <= L; l++) for (const [P, G] of [[net.W[l], bw.gW[l]], [net.b[l], bw.gb[l]]]) {
			for (let k = 0; k < P.length; k++) {
				const keep = P[k];
				P[k] = keep + eps;
				const up = lossOf(net, forward(net).a);
				P[k] = keep - eps;
				const dn = lossOf(net, forward(net).a);
				P[k] = keep;
				worst = Math.max(worst, Math.abs((up - dn) / (2 * eps) - G[k]));
				scale = Math.max(scale, Math.abs(G[k]));
			}
		}
		return worst / scale;
	}
	function transpose(M, rows, cols) {
		const T = new Float64Array(rows * cols);
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) T[c * rows + r] = M[r * cols + c];
		return T;
	}

	// ---- state: the toolbar's settings, the view, and how many nodes the pass has run ----
	const S = { act: 'tanh', retainGrad: false, xGrad: false, retainGraph: false, view: 'pass', step: 0 };
	const P = params(SEED);
	let net, fw, bw, check, plan, chain;
	// where each pane's parts were drawn, for a click to find
	let treeAt = [], tapeAt = [], boxes = [], costAt = null, lifeAt = null;
	const prevName = l => (l === 1 ? 'x' : `a${sub(l - 1)}`);

	// ---- the graph model(x) leaves: a node per op that needs a gradient,
	// numbered in the order the forward pass made it (its sequence number), and
	// an AccumulateGrad for each leaf that requires grad, which runs as soon as it
	// is ready. Each node keeps what it saved; each edge, the partial derivative
	// it hands on, its shape and values, and the .grad retain_grad() keeps it in ----
	function build() {
		net = { act: S.act, W: P.W, b: P.b, ...data(SEED) };
		fw = forward(net);
		bw = backward(net, fw);
		check = gradcheck(net, bw);
		const act = ACTS[S.act], nodes = {}, edges = [];
		let seq = 0;
		const node = (id, name, l, saved) => (nodes[id] = { id, name, l, seq: seq++, saved, kids: [] });
		const tensor = (name, rows, cols, data, role, shape = `${rows}×${cols}`, bytes = rows * cols * 4) =>
			({ name, rows, cols, data, role, shape, bytes });
		const A = WIDTHS.map((n, l) => tensor(l === 0 ? 'x' : `a${sub(l)}`, BATCH, n, fw.a[l], l === 0 ? 'data' : 'loc'));
		const Z = WIDTHS.map((n, l) => (l && l < L ? tensor(`z${sub(l)}`, BATCH, n, fw.z[l], 'loc') : null));
		const OUT = tensor(`z${sub(L)}`, BATCH, WIDTHS[L], fw.a[L], 'loc');
		for (let l = 1; l <= L; l++) {
			node('T' + l, 'TBackward0', l, []);
			// mat2, the view Wᵀ, is saved only if mat1 needs a gradient: not at layer 1 unless x requires grad
			const Wt = l > 1 || S.xGrad
				? tensor(`W${sub(l)}ᵀ`, WIDTHS[l - 1], WIDTHS[l], transpose(net.W[l], WIDTHS[l], WIDTHS[l - 1]), 'param', 'a view of W', 0)
				: tensor('None', 0, 0, null, 'none', '', 0);
			node('M' + l, 'AddmmBackward0', l, [['mat1', A[l - 1]], ['mat2', Wt]]);
			if (l < L) node('F' + l, act.node, l, [[act.saves, act.saves === 'result' ? A[l] : Z[l]]]);
		}
		node('loss', 'MseLossBackward0', L, [['self', OUT], ['target', tensor('y', BATCH, WIDTHS[L], net.Y, 'data')]]);
		const acc = (id, of, l, grad) => (nodes[id] = { id, name: 'AccumulateGrad', of, l, grad, seq: Infinity, saved: [], kids: [] });
		for (let l = 1; l <= L; l++) {
			acc('AW' + l, `W${sub(l)}`, l, bw.gW[l]);
			acc('Ab' + l, `b${sub(l)}`, l, bw.gb[l]);
		}
		if (S.xGrad) acc('Ax', 'x', 0, bw.da[0]);
		const edge = (from, to, t, full, kept = null) => {
			edges.push({ from, to, ...t, full, kept });
			nodes[from].kids.push(to);
		};
		const z = l => `z${sub(l)}`, a = l => `a${sub(l)}`, d = l => `δ${sub(l)}`;
		edge('loss', 'M' + L, tensor(d(L), BATCH, WIDTHS[L], bw.d[L], 'mid'), `∂J/∂${z(L)} = ${d(L)}`, `${z(L)}.grad`);
		for (let l = L; l >= 1; l--) {
			const no = WIDTHS[l], ni = WIDTHS[l - 1];
			edge('M' + l, 'Ab' + l, tensor(`∂J/∂b${sub(l)}`, 1, no, bw.gb[l], 'mid', String(no)), `∂J/∂b${sub(l)}`);
			edge('M' + l, 'T' + l, tensor(`∂J/∂W${sub(l)}ᵀ`, ni, no, transpose(bw.gW[l], no, ni), 'mid'), `∂J/∂W${sub(l)}ᵀ`);
			edge('T' + l, 'AW' + l, tensor(`∂J/∂W${sub(l)}`, no, ni, bw.gW[l], 'mid'), `∂J/∂W${sub(l)}`);
			if (l > 1) {
				const k = l - 1;
				edge('M' + l, 'F' + k, tensor(`∂J/∂${a(k)}`, BATCH, ni, bw.da[k], 'mid'), `∂J/∂${a(k)}`, `${a(k)}.grad`);
				edge('F' + k, 'M' + k, tensor(d(k), BATCH, ni, bw.d[k], 'mid'), `∂J/∂${z(k)} = ${d(k)}`, `${z(k)}.grad`);
			} else if (S.xGrad) edge('M1', 'Ax', tensor('∂J/∂x', BATCH, ni, bw.da[0], 'mid'), '∂J/∂x');
		}
		// the engine's order: of the nodes ready, the one with the highest sequence number first
		const ready = [nodes.loss], order = [];
		while (ready.length) {
			ready.sort((p, q) => q.seq - p.seq);
			const n = ready.shift();
			order.push(n.id);
			n.ran = order.length;
			for (const k of n.kids) ready.push(nodes[k]);
		}
		const saved = [...new Set(Object.values(nodes).flatMap(n => n.saved.map(([, t]) => t)))].filter(t => t.bytes);
		plan = { nodes, edges, order, A, OUT, saved };
		chain = chainLines();
	}
	// after s nodes have run: a gradient is made when its node runs and dropped once the next has run, unless
	// retain_grad() keeps it; AccumulateGrad keeps the tensor it is handed as .grad; what a node saved goes once
	// every node that saved it has run, unless retain_graph=True
	const ran = (id, s) => plan.nodes[id].ran <= s;
	const edgeOf = (from, to) => plan.edges.find(e => e.from === from && e.to === to);
	function edgeState(e, s) {
		if (!ran(e.from, s)) return 'ahead';
		const to = plan.nodes[e.to];
		if (!ran(e.to, s)) return plan.nodes[e.from].ran === s ? 'new' : 'live';
		if (to.name === 'AccumulateGrad') return 'grad';
		if (S.retainGrad && e.kept) return 'kept';
		return to.ran === s ? 'used' : 'gone';
	}
	const holders = t => Object.values(plan.nodes).filter(n => n.saved.some(([, u]) => u === t));
	function savedState(t, s) {
		const by = holders(t), now = by.some(n => n.ran === s);
		if (S.retainGraph || by.some(n => !ran(n.id, s))) return now ? 'read' : 'live';
		return now ? 'freed' : 'gone';
	}
	// the bytes held: what the graph saved, of it x and y apart, the gradients in flight, and the .grads
	function memory(s) {
		const m = { loc: 0, data: 0, mid: 0, upd: 0 };
		for (const t of plan.saved) if (['live', 'read'].includes(savedState(t, s))) m[t.role === 'data' ? 'data' : 'loc'] += t.bytes;
		for (const e of plan.edges) {
			const st = edgeState(e, s);
			if (st === 'grad') m.upd += e.bytes;
			else if (['new', 'live', 'kept'].includes(st)) m.mid += e.bytes;
		}
		return m;
	}

	// ---- the vertical the tree, the tape and the graph share: a level a
	// tensor, from J down to x, and between two levels the band of the node that
	// maps the lower to the upper. AddmmBackward0's TBackward0 and AccumulateGrads
	// share its band ----
	const LEVELS = ['J'], BANDS = ['loss'];
	for (let l = L; l >= 1; l--) {
		LEVELS.push('z' + l, l > 1 ? 'a' + (l - 1) : 'x');
		BANDS.push('M' + l);
		if (l > 1) BANDS.push('F' + (l - 1));
	}
	// the node whose band a node shares: a layer's TBackward0 and AccumulateGrads, and x's, its AddmmBackward0's
	const ownerOf = id => (id === 'Ax' ? 'M1' : id && /^(T|AW|Ab)\d$/.test(id) ? 'M' + id.slice(-1) : id);
	function rowsOf(H) {
		const top = 46, step = (H - top - 30) / (LEVELS.length - 1);
		return { lv: k => top + k * step, bd: b => top + (b + 0.5) * step, step };
	}
	const nameOf = k => (k === 'J' || k === 'x' || k === 'y' ? k : k[0] + sub(k[1]));
	// the path from J to a quantity runs through the nodes from the loss down to the one that makes it: a W or
	// b's own AddmmBackward0, a z's activation, an a's AddmmBackward0 above it, and x's, layer 1's, only if x
	// requires grad. y is data, with no path
	const pathOf = key => (key && (/^[Wbza]\d$/.test(key) || (key === 'x' && S.xGrad)) ? key : null);
	function pathNodes(key) {
		if (!pathOf(key)) return new Set();
		const l = +key[1];
		const last = key === 'x' ? 'M1' : key[0] === 'a' ? 'M' + (l + 1) : key[0] === 'z' ? (l === L ? 'loss' : 'F' + l) : 'M' + l;
		return new Set(BANDS.slice(0, BANDS.indexOf(last) + 1));
	}
	// the path the step follows: from J to the key derivative its node makes
	function pathAt(s) {
		const id = plan.order[s - 1], o = ownerOf(id);
		if (!o) return null;
		if (id === 'Ax') return 'x';
		return o === 'loss' ? 'z' + L : o[0] === 'F' ? 'z' + o[1] : /^Ab/.test(id) ? 'b' + o[1] : 'W' + o[1];
	}
	// the bands the three panes shade alike: what the step multiplies, boxed, from the highest key derivative
	// still held down to the node running, so one hop, as a line of the chain rule reads, unless retain_grad()
	// keeps what was handed down; the node running, grey. J's seed is never kept
	function shadeBands(cx, W, H, s) {
		const r = rowsOf(H), running = ownerOf(plan.order[s - 1]), on = pathNodes(pathAt(s));
		if (on.size) {
			let top = BANDS.indexOf(running);
			for (let k = top - 1; k >= 1 && held(treeState(LEVELS[k], s)); k--) top = k;
			const y0 = r.lv(top) - 13, y1 = r.lv(on.size) + 13;
			cx.fillStyle = rgba(INK.gold, 0.05);
			cx.fillRect(3, y0, W - 6, y1 - y0);
			pen(cx, () => {
				cx.setLineDash([4, 3]);
				box(cx, 3.5, y0 + 0.5, W - 7, y1 - y0 - 1);
			}, INK.gold, 0.9, 0.7);
		}
		BANDS.forEach((id, b) => {
			if (running !== id) return;
			const y0 = r.lv(b) + 5, y1 = r.lv(b + 1) - 5;
			cx.fillStyle = rgba(INK.ink, 0.06);
			cx.fillRect(6, y0, W - 12, y1 - y0);
		});
	}

	// ---- the derivative tree: J at the root, the stem z, a down to x, and at
	// each z its wings W and b, the leaves. A node is lit with the role of ∂J/∂(it);
	// an edge carries its local derivative, ∂(parent)/∂(it). The chain rule is the
	// product of the edges along the path from J ----
	const TREE = { J: { lv: 0, side: 0, parent: null }, y: { lv: 1, side: -1, parent: 'J' } };
	for (let l = L; l >= 1; l--) {
		const z = 'z' + l, lv = LEVELS.indexOf(z);
		TREE[z] = { lv, side: 0, parent: l === L ? 'J' : 'a' + l };
		TREE['W' + l] = { lv: lv + 1, side: -1, parent: z };
		TREE[l > 1 ? 'a' + (l - 1) : 'x'] = { lv: lv + 1, side: 0, parent: z };
		TREE['b' + l] = { lv: lv + 1, side: 1, parent: z };
	}
	const RX = 18, RY = 10.5, RING = 3.5; // a node's ellipse, and how far out the ring round one on the step's path is
	// an edge's local derivative: ∂top/∂bottom, its value, the node that multiplies it in, and whether any does
	function localOf(k) {
		const l = +k[1];
		if (k === 'y') return { top: 'J', bottom: 'y', val: 'not needed', node: 'loss', needed: false };
		if (k === 'x') return { top: 'z₁', bottom: 'x', val: 'W₁', node: 'M1', needed: S.xGrad };
		if (k === 'z' + L) return { top: 'J', bottom: `z${sub(L)}`, val: `2(z${sub(L)} − y)/${ENTRIES}`, node: 'loss', needed: true };
		if (k[0] === 'W') return { top: `z${sub(l)}`, bottom: `W${sub(l)}`, val: prevName(l), node: 'M' + l, needed: true };
		if (k[0] === 'b') return { top: `z${sub(l)}`, bottom: `b${sub(l)}`, val: '1', node: 'M' + l, needed: true };
		if (k[0] === 'a') return { top: `z${sub(l + 1)}`, bottom: `a${sub(l)}`, val: `W${sub(l + 1)}`, node: 'M' + (l + 1), needed: true };
		return { top: `a${sub(l)}`, bottom: `z${sub(l)}`, val: ACTS[S.act].local(l), node: 'F' + l, needed: true };
	}
	// where ∂J/∂(node) is after s nodes have run: stored, in flight, used, dropped, or never formed
	function treeState(k, s) {
		if (k === 'J') return 'root';
		if (k === 'y' || (k === 'x' && !S.xGrad)) return 'none';
		const l = +k[1];
		if (k[0] === 'W' || k[0] === 'b') return ran((k[0] === 'W' ? 'AW' : 'Ab') + l, s) ? 'stored' : ran('M' + l, s) ? 'live' : 'ahead';
		const e = k === 'x' ? edgeOf('M1', 'Ax')
			: k[0] === 'z' ? (l === L ? edgeOf('loss', 'M' + L) : edgeOf('F' + l, 'M' + l))
			: edgeOf('M' + (l + 1), 'F' + l);
		const st = edgeState(e, s);
		return st === 'grad' ? 'stored' : st;
	}
	function treePath(k) {
		const p = [];
		for (let n = k; n && n !== 'J'; n = TREE[n].parent) p.unshift(n);
		return p;
	}
	// a node's colour: its key derivative's role, updates for a leaf, back-propagates for the stem, whatever its state
	const roleColour = k => (k === 'J' ? INK.sign : k === 'y' || (k === 'x' && !S.xGrad) ? INK.data : /^[Wb]/.test(k) ? INK.weight : INK.grad);
	const dropped = st => ['used', 'gone'].includes(st);
	function drawTree(s) {
		const { cx, W, H } = paper($('[data-pane="tree"]')), r = rowsOf(H), mid = W / 2, wing = W * 0.36;
		heading(cx, 'The tree', [[INK.weight, 'updates'], [INK.grad, 'back-propagates'], [INK.act, 'multiplies']]);
		shadeBands(cx, W, H, s);
		const at = k => [mid + TREE[k].side * wing, r.lv(TREE[k].lv)], onPath = new Set(pathAt(s) ? treePath(pathAt(s)) : []);
		treeAt = [];
		// the edges, each with its local derivative in a box partway along, lit once its node has multiplied it in
		for (const k of Object.keys(TREE)) {
			if (k === 'J') continue;
			const e = localOf(k), [x0, y0] = at(k), [x1, y1] = at(TREE[k].parent), gold = onPath.has(k), used = e.needed && ran(e.node, s);
			const colour = gold ? INK.gold : e.needed ? INK.act : INK.mute, running = e.needed && ownerOf(plan.order[s - 1]) === e.node;
			if (e.needed) penLine(cx, [[x0, y0 - RY], [x1, y1 + RY]], colour, gold ? 1.6 : 1.1, used || gold ? 1 : 0.6, used || gold ? [] : AHEAD);
			else line(cx, [[x0, y0 - RY], [x1, y1 + RY]], rgba(INK.mute, GONE.line), 1);
			const value = e.needed ? `= ${e.val}` : '';
			// a stem's box hangs the same way in every band, just under the ring of the node above, or midway where the
			// band is too short for that; a wing's sits near its wing, beside the stem's
			const t = k === 'y' ? 0.75 : 0.62, stem = !TREE[k].side;
			cx.font = 'italic ' + scaled(9) + SERIF;
			const bx = stem ? x1 : x1 + (x0 - x1) * t, by = y1 + (stem ? Math.min(RY + RING + 14, (y0 - y1) / 2) : (y0 - y1) * t) + 1;
			const fwid = maths(cx, 0, 0, [partial(e.top, e.bottom)], 9.5, INK.sign, true);
			const w = fwid + (value ? cx.measureText(value).width + 3 : 0) + 6;
			cx.fillStyle = INK.card;
			cx.fillRect(bx - w / 2, by - 11, w, 21);
			const lit = used || gold || running, frame = () => box(cx, bx - w / 2 + 0.5, by - 10.5, w - 1, 20);
			if (e.needed) {
				pen(cx, () => {
					cx.setLineDash(lit ? [] : AHEAD);
					frame();
				}, running ? INK.ink : colour, running || gold ? 1.3 : 0.8, lit ? 1 : 0.6);
			} else pen(cx, frame, INK.mute, 0.8, GONE.line);
			cx.globalAlpha = used || gold || running || s === 0 ? 1 : faded(0.45);
			maths(cx, bx - w / 2 + 3, by + 2.5, [partial(e.top, e.bottom, e.needed ? INK.act : INK.mute)], 9.5);
			cx.font = 'italic ' + scaled(9) + SERIF;
			cx.fillStyle = INK.act;
			cx.textAlign = 'left';
			cx.fillText(value, bx - w / 2 + 3 + fwid + 2, by + 2.5);
			cx.globalAlpha = 1;
			treeAt.push({ node: e.needed ? e.node : null, x0: bx - w / 2, x1: bx + w / 2, y0: by - 11, y1: by + 10 });
		}
		// the nodes, each in its role's colour, the leaves' updates and the stem's back-propagates, x and y in the
		// data's: solid while its gradient is held, faded once it is dropped, dashed while still to come
		for (const k of Object.keys(TREE)) {
			const [x, y] = at(k), st = treeState(k, s), colour = st === 'stored' ? INK.weight : roleColour(k), gold = onPath.has(k) || (k === 'J' && onPath.size);
			const ellipse = (rx, ry) => {
				cx.beginPath();
				cx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
			};
			ellipse(RX, RY);
			cx.fillStyle = INK.card;
			cx.fill();
			const tint = { new: 0.34, live: 0.2, kept: 0.2, used: 0.1, gone: 0.1, stored: 0.26 }[st];
			if (tint) {
				cx.fillStyle = rgba(colour, tint);
				cx.fill();
			}
			if (st === 'ahead') {
				pen(cx, () => {
					cx.setLineDash(AHEAD);
					ellipse(RX, RY);
				}, colour, 1, 0.6);
			} else pen(cx, () => ellipse(RX, RY), colour, st === 'new' ? 1.8 : 1.1, dropped(st) || st === 'none' ? GONE.line : 1);
			if (gold) pen(cx, () => ellipse(RX + RING, RY + RING), INK.gold, 1.2);
			cx.font = NAME;
			cx.fillStyle = st === 'ahead' ? INK.mute : st === 'none' ? INK.data : dropped(st) ? rgba(INK.sign, GONE.text) : INK.sign;
			cx.textAlign = 'center';
			cx.fillText(nameOf(k), x, y + 4);
			// its key derivative, ∂J/∂(it): beside a node of the stem, under a wing, set off from where the ring would be,
			// so it keeps its place whether the step's path runs through the node or not
			const key = k === 'J' ? '∂J/∂J = 1' : k === 'y' || (k === 'x' && !S.xGrad) ? ''
				: k[0] === 'z' ? `δ${sub(k[1])} = ∂J/∂z${sub(k[1])}` : `∂J/∂${nameOf(k)}`;
			cx.font = 'italic ' + scaled(10) + SERIF;
			cx.fillStyle = st === 'ahead' || st === 'none' ? INK.mute : dropped(st) ? rgba(colour, GONE.text) : colour;
			if (TREE[k].side) {
				cx.textAlign = 'center';
				cx.fillText(key, x, y + RY + RING + 11);
			} else {
				cx.textAlign = 'left';
				cx.fillText(key, x + RX + RING + 5, y + 4);
			}
		}
	}

	// ---- the graph torch records, on the tree's vertical: each node in the
	// band of the map it undoes, the partial derivative it hands on crossing the
	// level of the tensor it belongs to, and each AddmmBackward0's branches to
	// AccumulateGrad and .grad on its right ----
	function drawGraph(s) {
		const { cx, W, H } = paper($('[data-pane="graph"]')), nodes = plan.nodes, r = rowsOf(H);
		heading(cx, 'The graph', [[INK.grad, '→ ∂J/∂z, a'], [INK.weight, '▭ ∂J/∂W, b in .grad']]);
		shadeBands(cx, W, H, s);
		const xn = Math.round(W * 0.32), bw = 90, NODE = '8px ' + MONOFACE, LEAF = '7px ' + MONOFACE, on = pathNodes(pathAt(s));
		const rowY = id => r.bd(BANDS.indexOf(id));
		boxes = [];
		// a node: framed in white while it runs, its number as the engine runs it, outlined gold on the step's path
		const nodeBox = (id, x, y, w, face = NODE) => {
			const nd = nodes[id], state = nd.ran === s ? 'run' : nd.ran < s ? 'done' : 'wait';
			cx.fillStyle = state === 'run' ? rgba(INK.ink, 0.14) : INK.card;
			cx.fillRect(x - w / 2, y - 8, w, 16);
			if (state === 'run') pen(cx, () => box(cx, x - w / 2 + 0.5, y - 7.5, w - 1, 15), INK.ink, 1.3);
			else {
				cx.strokeStyle = state === 'done' ? INK.edge : INK.frame;
				cx.lineWidth = 1;
				cx.strokeRect(x - w / 2 + 0.5, y - 7.5, w - 1, 15);
			}
			if (on.has(id)) pen(cx, () => box(cx, x - w / 2 - 2, y - 10, w + 4, 20), INK.gold, 1.1);
			cx.font = face;
			cx.fillStyle = state === 'done' ? INK.mute : INK.sign;
			cx.textAlign = 'center';
			cx.fillText(nd.name, x + (face === LEAF ? 6 : 5), y + 3);
			cx.font = scaled(8.5) + SERIF;
			cx.fillStyle = state === 'run' ? INK.ink : INK.mute;
			cx.textAlign = 'left';
			cx.fillText(String(nd.ran), x - w / 2 + 3, y + 3);
			boxes.push({ id, x: x - w / 2, y: y - 8, w, h: 16 });
		};
		// a leaf's .grad: None, dashed, until its AccumulateGrad has stored it
		const slot = (x, y, name, full, lit) => {
			cx.fillStyle = full ? rgba(INK.weight, 0.22) : INK.card;
			cx.fillRect(x, y - 7, 34, 14);
			if (full) pen(cx, () => box(cx, x + 0.5, y - 6.5, 33, 13), INK.weight, lit ? 1.4 : 0.8);
			else {
				const l = x + 0.5, r = x + 33.5;
				line(cx, [[l, y - 6.5], [r, y - 6.5], [r, y + 6.5], [l, y + 6.5], [l, y - 6.5]], rgba(INK.weight, 0.5), 1, [2, 2]);
			}
			cx.font = '7.5px ' + MONOFACE;
			cx.fillStyle = rgba(INK.weight, full ? 1 : 0.55);
			cx.textAlign = 'center';
			cx.fillText(full ? name : 'None', x + 17, y + 3);
		};
		// the partial derivative an edge carries, ending at x: faded once dropped, dashed while still to come
		const chip = (x, y, text, state) => {
			cx.font = scaled(9) + SERIF;
			const w = cx.measureText(text).width + 8, ahead = state === 'ahead';
			cx.fillStyle = state === 'kept' ? rgba(INK.grad, 0.2) : INK.card;
			cx.fillRect(x - w, y - 6, w, 12);
			pen(cx, () => {
				cx.setLineDash(ahead ? AHEAD : []);
				box(cx, x - w + 0.5, y - 5.5, w - 1, 11);
			}, INK.grad, state === 'new' ? 1.4 : 0.8, ahead ? 0.6 : dropped(state) ? GONE.line : 1);
			cx.fillStyle = ahead ? INK.mute : rgba(INK.grad, dropped(state) ? GONE.text : 1);
			cx.textAlign = 'left';
			cx.fillText(text, x - w + 4, y + 3);
		};
		const flow = (pts, st, width = 1.3) => (st === 'ahead' ? penLine(cx, pts, INK.grad, 1, 0.6, AHEAD)
			: dropped(st) ? penLine(cx, pts, INK.grad, 1, GONE.line) : penLine(cx, pts, INK.grad, width));
		// J at its level, and the chain down through the bands, each edge's chip on the level it crosses
		cx.font = NAME;
		cx.textAlign = 'center';
		cx.fillStyle = INK.sign;
		cx.fillText('J', xn, r.lv(0) + 4);
		flow([[xn, r.lv(0) + 8], [xn, rowY('loss') - 9]], s >= 1 ? 'live' : 'ahead', 1.1);
		for (let k = 0; k < BANDS.length - 1; k++) {
			const e = edgeOf(BANDS[k], BANDS[k + 1]), st = edgeState(e, s);
			flow([[xn, rowY(BANDS[k]) + 8], [xn, rowY(BANDS[k + 1]) - 9]], st, 1.4);
			chip(xn - 6, r.lv(k + 1), st === 'kept' ? `${e.name} → ${e.kept}` : `${e.name}  ${e.shape}`, st);
		}
		const yx = r.lv(LEVELS.length - 1);
		cx.font = NAME;
		cx.fillStyle = INK.data;
		cx.textAlign = 'center';
		cx.fillText('x', xn, yx + 4);
		if (S.xGrad) {
			const e = edgeOf('M1', 'Ax'), st = edgeState(e, s);
			flow([[xn, rowY('M1') + 8], [xn, yx - 9]], st);
			chip(xn - 10, yx, `${e.full}  ${e.shape}`, st);
			// x's leaf a little below its level, clear of W₁'s just above
			nodeBox('Ax', xn + 60, yx + 11, 76, LEAF);
			slot(xn + 101, yx + 11, '∂J/∂x', st === 'grad', nodes.Ax.ran === s);
		} else line(cx, [[xn, rowY('M1') + 8], [xn, yx - 10]], INK.mute, 1, [2, 3]);
		for (const id of BANDS) {
			const nd = nodes[id], y = rowY(id);
			nodeBox(id, xn, y, bw);
			if (nd.name !== 'AddmmBackward0') continue;
			const l = nd.l, xb = xn + bw / 2 + 6;
			flow([[xn + bw / 2, y - 3], [xb + 2, y - 18]], edgeState(edgeOf(id, 'Ab' + l), s), 1);
			nodeBox('Ab' + l, xb + 40, y - 18, 76, LEAF);
			slot(xb + 81, y - 18, `∂J/∂b${sub(l)}`, ran('Ab' + l, s), nodes['Ab' + l].ran === s);
			flow([[xn + bw / 2, y + 1], [xb + 2, y + 1]], edgeState(edgeOf(id, 'T' + l), s), 1);
			nodeBox('T' + l, xb + 30, y + 1, 56, LEAF);
			flow([[xb + 30, y + 9], [xb + 30, y + 12]], edgeState(edgeOf('T' + l, 'AW' + l), s), 1);
			nodeBox('AW' + l, xb + 40, y + 20, 76, LEAF);
			slot(xb + 81, y + 20, `∂J/∂W${sub(l)}`, ran('AW' + l, s), nodes['AW' + l].ran === s);
		}
	}

	// ---- the tape, as cs231n draws a circuit, stood on end to share the tree's
	// vertical: J at the top and x at the foot, one wire up the middle through the
	// gates. A value left of its wire and ∂J/∂ of it right, the backward pass
	// running down; each layer's × and + in its band, W coming in from the right
	// and b from the left as leaves, each with its .grad beside it. Its states
	// are the graph's: a gradient is made when the node that makes it runs, and a
	// .grad is filled when its AccumulateGrad does ----
	const TINY = 'italic ' + scaled(9.5) + SERIF, GLYPH = scaled(12) + SERIF;
	const held = st => ['new', 'live', 'kept'].includes(st);
	// the node a gate stands for, and the nodes at work for it: AddmmBackward0 does the work of both × and +
	const gateNode = (type, l) => ({ mul: 'M' + l, add: 'M' + l, phi: 'F' + l, loss: 'loss' })[type];
	const gateOn = (type, l, id) => !!id
		&& { mul: ['M' + l, 'T' + l, 'AW' + l, l === 1 && 'Ax'], add: ['M' + l, 'Ab' + l], phi: ['F' + l], loss: ['loss'] }[type].includes(id);
	// a leaf's .grad: empty until its AccumulateGrad runs, then stored
	function leafState(k, l, s) {
		const id = (k === 'W' ? 'AW' : 'Ab') + l;
		return ran(id, s) ? (plan.nodes[id].ran === s ? 'new' : 'stored') : 'ahead';
	}
	// the way back along the wire: an arrow while its gradient is in flight, faded once it is dropped, dashed
	// while still to come
	function wayBack(cx, from, to, st) {
		if (st === 'none') return;
		if (st === 'ahead') penLine(cx, [from, to], INK.grad, 1, 0.6, AHEAD);
		else if (held(st) || st === 'stored') arrow(cx, [from, to], INK.grad, st === 'new' ? 1.8 : 1.1);
		else penLine(cx, [from, to], INK.grad, 1, GONE.line);
	}
	// a gate: a disc with its sign, ringed in white while its node is at work
	function gate(cx, x, y, r, sign, on, font = GLYPH) {
		disc(cx, x, y, r);
		cx.fillStyle = INK.card;
		cx.fill();
		pen(cx, () => disc(cx, x, y, r), on ? INK.ink : INK.sign, on ? 2.2 : 1.1);
		cx.font = font;
		cx.fillStyle = on ? INK.ink : INK.sign;
		cx.textAlign = 'center';
		cx.fillText(sign, x, y + (font === GLYPH ? 4 : 3));
	}
	// what a level's wire carries: its values, and the gradient the pass makes for it
	function carried(key) {
		const l = +key[1];
		if (key === 'x') return { name: 'x', vals: fw.a[0], n: WIDTHS[0], colour: INK.data, g: S.xGrad ? bw.da[0] : null, gname: '∂J/∂x' };
		if (key[0] === 'z') return { name: `z${sub(l)}`, vals: fw.z[l], n: WIDTHS[l], colour: INK.act, g: bw.d[l], gname: `δ${sub(l)}` };
		return { name: `a${sub(l)}`, vals: fw.a[l], n: WIDTHS[l], colour: INK.act, g: bw.da[l], gname: `∂J/∂a${sub(l)}` };
	}
	// the tape's stops from J down to x: a level a tensor, a gate a map; a layer's band holds its + over its ×
	function stops(r) {
		const list = [{ level: 'J', y: r.lv(0) }];
		BANDS.forEach((id, b) => {
			const y = r.bd(b), l = +id[1];
			if (id === 'loss') list.push({ gate: 'loss', l: L, y });
			else if (id[0] === 'F') list.push({ gate: 'phi', l, y });
			else list.push({ gate: 'add', l, y: y - 11 }, { gate: 'mul', l, y: y + 11 });
			list.push({ level: LEVELS[b + 1], y: r.lv(b + 1) });
		});
		return list;
	}
	// a saved tensor's mark, a line under what it saved: solid while a node holds it, faded once freed
	function savedMark(cx, t, x, y, w, s) {
		const kept = ['live', 'read'].includes(savedState(t, s));
		line(cx, [[x, y], [x + w, y]], kept ? INK.act : rgba(INK.act, GONE.line), kept ? 1.6 : 1.2);
	}
	// the entry of a parameter the tape frames at a linear step: W's [1,1] at its layer, or b's [1] at b's own step;
	// none at x's, whose entry is a whole row of δ times W
	function workOf(s) {
		const id = plan.order[s - 1] || '', o = ownerOf(id), l = !o || o === 'loss' ? L : +o[1];
		if (id === 'Ax') return null;
		return /^Ab/.test(id) ? { k: 'b', l } : { k: 'W', l };
	}
	// the tensor a level's value is, where a node saved it: the loss's input, a layer's input, an activation's output
	const savedOf = key => (key === 'z' + L ? plan.OUT : /^(a\d|x)$/.test(key) ? plan.A[key === 'x' ? 0 : +key[1]] : null);
	function drawTape(s) {
		const { cx, W, H } = paper($('[data-pane="tape"]')), r = rowsOf(H), running = plan.order[s - 1], xw = Math.round(W * 0.43), cell = 7;
		const list = stops(r), stripAt = {};
		tapeAt = [];
		heading(cx, 'The tape', [[INK.act, '▭ value'], [INK.grad, '▭ ∂J/∂z, a'], [INK.weight, '▭ ∂J/∂W, b']]);
		shadeBands(cx, W, H, s);
		// each node's gates in a light frame, numbered as the graph numbers it: a layer's AddmmBackward0 does its + and ×.
		// The number at the frame's corner, or lower where the pane is short, clear of the gradient on the level above
		for (const stop of list) {
			if (!stop.gate || stop.gate === 'mul') continue;
			const id = gateNode(stop.gate, stop.l), nd = plan.nodes[id], y0 = stop.y - 14, y1 = stop.gate === 'add' ? stop.y + 36 : stop.y + 14;
			pen(cx, () => box(cx, xw - 13.5, y0 + 0.5, 27, y1 - y0), nd.ran === s ? INK.ink : INK.frame, 0.8, nd.ran === s ? 1 : 0.55);
			put(cx, [[String(nd.ran), nd.ran === s ? INK.ink : INK.mute, MONO]], xw + 16, Math.max(y0 + 8, r.lv(BANDS.indexOf(id)) + 12));
		}
		line(cx, [[xw, r.lv(0) + 9], [xw, r.lv(LEVELS.length - 1) - 5]], INK.wire, 1);
		// the way back, a stretch at a time: from a level, ∂J/∂ of it; into a level, the same; between a
		// layer's + and ×, the δ the + copies
		for (let k = 0; k < list.length - 1; k++) {
			const a = list[k], b = list[k + 1], key = a.level || b.level;
			const st = key === 'J' ? (s ? 'live' : 'ahead') : key ? (key === 'x' && !S.xGrad ? 'none' : treeState(key, s)) : treeState('z' + a.l, s);
			wayBack(cx, [xw + 4, a.y + (a.gate ? 10 : 6)], [xw + 4, b.y - (b.gate ? 10 : 6)], st);
		}
		// the levels: the value left of the wire, the gradient right of it
		for (const stop of list) {
			if (!stop.level) continue;
			const k = stop.level, y = stop.y;
			if (k === 'J') {
				put(cx, [['J ', INK.sign, NAME], [fmt(lossOf(net, fw.a)), INK.act, MONO]], xw - 8, y + 4, 'right');
				if (s) put(cx, [['1', INK.grad, MONO]], xw + 8, y + 4);
				continue;
			}
			const t = carried(k), w = t.n * cell, xv = xw - 7 - w, xg = xw + 9;
			stripAt[k] = { xv, xg, y: y - cell / 2 };
			put(cx, [[t.name, t.colour, NAME]], xv - 4, y + 4, 'right');
			strip(cx, xv, y - cell / 2, t.vals, SHOWN, t.n, cell, t.colour);
			if (savedOf(k)) savedMark(cx, savedOf(k), xv, y + cell / 2 + 2.5, w - 1, s);
			if (!t.g) {
				put(cx, [['no ∂J/∂x', INK.mute, TINY]], xg, y + 3);
				continue;
			}
			const st = treeState(k, s), colour = st === 'ahead' ? INK.mute : dropped(st) ? rgba(INK.grad, GONE.text) : INK.grad;
			if (st === 'ahead') {
				pen(cx, () => {
					cx.setLineDash(AHEAD);
					box(cx, xg - 0.5, y - cell / 2 - 0.5, w, cell - 1);
				}, INK.grad, 0.8, 0.6);
			} else strip(cx, xg, y - cell / 2, t.g, SHOWN, t.n, cell, INK.grad, dropped(st) ? GONE.fill : 1);
			if (st === 'new') pen(cx, () => box(cx, xg - 2.5, y - cell / 2 - 2.5, w + 4, cell + 3), INK.ink, 1.1);
			put(cx, [[t.gname, colour, 'italic ' + scaled(10) + SERIF]], xg + w + 4, y + 4);
		}
		// a parameter comes in to its gate as a leaf, its values and then its .grad, lit as updates once
		// AccumulateGrad has stored the sum over the batch there: W from the right into ×, b from the left into +.
		// Its values are kept inside its layer's band and its names set under b's + and over W's ×, clear of the
		// levels above and below however short the pane
		const wk = workOf(s);
		const feed = (y, Pm, Gr, rows, cols, k, l, side) => {
			const c = 4, w = cols * c, h = rows * c, st = leafState(k, l, s), name = `${k}${sub(l)}`;
			const band = BANDS.indexOf('M' + l), xp = side > 0 ? xw + 18 : xw - 18 - 2 * w - 3, xq = xp + w + 3;
			const top = within(y - h / 2, r.lv(band) + 10, r.lv(band + 1) - 10 - h);
			line(cx, [[xw + side * 9, y], [side > 0 ? xp : xq + w, y]], INK.wire, 1);
			heat(cx, xp, top, Pm, rows, cols, c, INK.param);
			// × saves Wᵀ, a view of W, when its input needs a gradient
			const wt = k === 'W' && plan.nodes['M' + l].saved[1][1];
			if (wt && wt.name !== 'None') savedMark(cx, wt, xp, top + h + 2.5, w - 1, s);
			if (st === 'ahead') {
				pen(cx, () => {
					cx.setLineDash(AHEAD);
					box(cx, xq - 0.5, top - 0.5, w, h);
				}, INK.weight, 0.8, 0.6);
			} else {
				heat(cx, xq, top, Gr, rows, cols, c, INK.weight);
				if (st === 'new') pen(cx, () => box(cx, xq - 2.5, top - 2.5, w + 4, h + 4), INK.ink, 1.1);
			}
			if (pathAt(s) === k + l) pen(cx, () => box(cx, xp - 3.5, top - 3.5, 2 * w + 10, h + 7), INK.gold, 1.4);
			const xl = side > 0 ? xq + w + 5 : xp - 5, align = side > 0 ? 'left' : 'right', yl = side > 0 ? y - 12 : y + 7;
			put(cx, [[name, INK.param, 'italic ' + scaled(11) + SERIF]], xl, yl, align);
			put(cx, [[`∂J/∂${name}`, st === 'ahead' ? INK.mute : INK.weight, 'italic ' + scaled(10) + SERIF]], xl, yl + 11, align);
			// the entry the step works, [1,1], framed in the .grad
			if (wk && wk.k === k && wk.l === l && st !== 'ahead') pen(cx, () => box(cx, xq - 1.5, top - 1.5, c + 2, c + 2), INK.ink, 1.4);
		};
		for (const stop of list) {
			if (!stop.gate) continue;
			const { gate: type, l, y } = stop, node = gateNode(type, l);
			tapeAt.push({ x0: xw - 10, x1: xw + 10, y0: y - 10, y1: y + 10, node });
			if (type === 'mul') feed(y, net.W[l], bw.gW[l], WIDTHS[l], WIDTHS[l - 1], 'W', l, 1);
			else if (type === 'add') feed(y, net.b[l], bw.gb[l], WIDTHS[l], 1, 'b', l, -1);
			else if (type === 'loss') {
				// the targets come in to the loss from the left, as a leaf does, but they are data
				const w = WIDTHS[L] * cell;
				line(cx, [[xw - 10, y], [xw - 18, y]], INK.wire, 1);
				strip(cx, xw - 18 - w, y - cell / 2, net.Y, SHOWN, WIDTHS[L], cell, INK.data);
				savedMark(cx, plan.nodes.loss.saved[1][1], xw - 18 - w, y + cell / 2 + 2.5, w - 1, s);
				put(cx, [['y', INK.data, NAME]], xw - 22 - w, y + 4, 'right');
			}
			const font = type === 'loss' ? '7px ' + MONOFACE : type === 'phi' ? 'italic ' + scaled(12) + SERIF : GLYPH;
			gate(cx, xw, y, 9, { mul: '×', add: '+', phi: 'φ', loss: 'mse' }[type], gateOn(type, l, running), font);
		}
		// at W's steps, the two numbers its entry [1,1] multiplies for input 1: the upstream δ[1] and the input [1],
		// framed on their levels; at b's, δ[1] alone, as + copies it
		const own = ownerOf(running);
		if (wk && own && own[0] === 'M') {
			const l = wk.l, zs = stripAt['z' + l], is = stripAt[l > 1 ? 'a' + (l - 1) : 'x'];
			if (wk.k === 'W') pen(cx, () => box(cx, is.xv - 2, is.y - 2, cell + 3, cell + 3), l > 1 ? INK.act : INK.data, 2.2);
			pen(cx, () => box(cx, zs.xg - 2, zs.y - 2, cell + 3, cell + 3), INK.grad, 2.2);
		}
	}

	// ---- what the pass costs, across the foot. Each node of backward() is a
	// vector–Jacobian product: it stands for a Jacobian, its output's local
	// derivative by its input, but never forms it. It multiplies the gradient it
	// is handed straight through, by the entries that are not 0 by structure
	// alone, so it costs what its forward op cost. Counted as multiply-adds in
	// matrix products, as torch.utils.flop_counter counts them (two FLOPs each);
	// the elementwise work, the loss's, φ′'s and Σₙ δ's, a few dozen numbers a
	// node, is left out ----
	const PARAMS = WIDTHS.slice(1).reduce((t, n, i) => t + n * (WIDTHS[i] + 1), 0);
	const times = r => String(+r.toFixed(2));
	// a node's matrix products: δᵀa, the inputs summed, which makes ∂J/∂W, and δW, which makes ∂J/∂a and which
	// layer 1 skips unless x requires grad
	function macs(id) {
		const nd = plan.nodes[id];
		if (nd.name !== 'AddmmBackward0') return { w: 0, a: 0 };
		const m = BATCH * WIDTHS[nd.l] * WIDTHS[nd.l - 1];
		return { w: m, a: nd.l > 1 || S.xGrad ? m : 0 };
	}
	// the forward pass's products, a layer each, and backward()'s, in all or as far as step s
	const forwardMacs = () => WIDTHS.slice(1).map((n, i) => BATCH * n * WIDTHS[i]);
	const backwardMacs = (upto = plan.order.length) => plan.order.slice(0, upto).reduce((t, id) => t + macs(id).w + macs(id).a, 0);
	// the node at step s as the Jacobian it stands for, and what it does instead
	function vjp(s) {
		const id = plan.order[s - 1], fwd = forwardMacs().reduce((t, m) => t + m, 0), all = backwardMacs();
		if (!id) {
			return 'backward() is a chain of vector–Jacobian products: each node is handed ∂J/∂(its output) and multiplies it '
				+ 'by its local Jacobian without forming it, by the entries not 0 by structure alone, at its forward op’s cost. '
				+ `All ${PARAMS} partial derivatives cost one backward pass, ${times(all / fwd)} times the forward; one at a time, `
				+ 'a forward pass each.';
		}
		const nd = plan.nodes[id], l = nd.l, no = WIDTHS[l], ni = WIDTHS[l - 1], rows = BATCH * no;
		if (nd.name === 'MseLossBackward0') {
			return `MseLossBackward0 stands for ∂J/∂z${sub(L)}, a 1 × ${rows} Jacobian, a gradient already: it works out `
				+ `2(z${sub(L)} − y)/${ENTRIES}, ${rows} numbers, with no matrix product.`;
		}
		if (nd.name === 'AddmmBackward0') {
			const m = BATCH * no * ni, x = prevName(l), W = `W${sub(l)}`, z = `z${sub(l)}`, d = `δ${sub(l)}`;
			if (l > 1 || S.xGrad) {
				return `AddmmBackward0 stands for ∂${z}/∂${W}, ${rows} × ${no * ni}, and ∂${z}/∂${x}, ${rows} × ${BATCH * ni}, `
					+ `${exeFmt(rows * no * ni)} and ${exeFmt(rows * BATCH * ni)} entries, of which only ${m} each are not 0 by structure: `
					+ `${x}’s entries and ${W}’s, repeated. It forms neither: ${d}ᵀ${x} and ${d}${W} take ${m} multiply-adds each, `
					+ `one a non-zero, as many as the forward product; Σₙ ${d} is ${rows} adds.`;
			}
			return `AddmmBackward0 stands for ∂${z}/∂${W}, ${rows} × ${no * ni} = ${exeFmt(rows * no * ni)} entries, of which only ${m} `
				+ `are not 0 by structure, x’s entries repeated. It forms none: ${d}ᵀx takes ${m} multiply-adds, one a non-zero, `
				+ `as many as the forward product. ∂${z}/∂x is never wanted, as x needs no grad, so ${d}${W} is skipped.`;
		}
		if (nd.name === 'TBackward0') {
			return `TBackward0 stands for ∂W${sub(l)}ᵀ/∂W${sub(l)}, a ${no * ni} × ${no * ni} permutation: it hands ∂J/∂W${sub(l)}ᵀ `
				+ 'back turned, with no arithmetic.';
		}
		if (nd.name === 'AccumulateGrad') {
			return `AccumulateGrad stands for the identity: it keeps the very tensor it is handed as ${nd.of}.grad, while .grad `
				+ 'is None, with no arithmetic. All of the pass’s multiply-adds are in the AddmmBackward0s.';
		}
		const n = BATCH * no;
		return `${nd.name} stands for ∂a${sub(l)}/∂z${sub(l)}, ${n} × ${n} = ${exeFmt(n * n)} entries, of which only the ${n} on the `
			+ `diagonal, ${ACTS[S.act].local(l)}, are not 0 by structure: it multiplies ∂J/∂a${sub(l)} by them entry by entry, `
			+ `${n} products and no matrix product.`;
	}
	function drawCost(s) {
		const { cx, W } = paper($('[data-pane="cost"]')), T = plan.order.length, fwd = forwardMacs();
		const total = fwd.reduce((t, m) => t + m, 0), all = backwardMacs();
		const dy = heading(cx, 'What the pass costs, in multiply-adds', [[INK.data, 'the forward pass'], [INK.weight, 'δᵀa, to ∂J/∂W'], [INK.grad, 'δW, to ∂J/∂a']]);
		// the columns: the forward pass, a layer a block, the yardstick, then each node's products, δᵀa under δW;
		// done solid, the node at work outlined, those to come dashed. The totals beside them, or under them where
		// the pane is too narrow, as on a phone
		const beside = W >= 600, lx = 10, rx = beside ? Math.round(W * 0.5) : W - 10, cw = (rx - lx) / (T + 1), yb = 100 + dy, per = 66 / total;
		const X = k => lx + k * cw;
		costAt = { lx, cw, T, y0: 24 + dy, y1: yb + 16 };
		if (s) {
			cx.fillStyle = rgba(INK.frame, 0.18);
			cx.fillRect(X(s), 24 + dy, cw, yb - 24 - dy + 16);
		}
		line(cx, [[lx, yb + 0.5], [rx, yb + 0.5]], INK.edge);
		let y = yb;
		for (const m of fwd) {
			cx.fillStyle = rgba(INK.data, 0.85);
			cx.fillRect(X(0) + 3, y - m * per + 1, cw - 6, m * per - 1);
			y -= m * per;
		}
		put(cx, [[exeFmt(total), INK.data, scaled(8.5) + SERIF]], X(0) + cw / 2, y - 3, 'center');
		put(cx, [['fwd', INK.mute, SMALL]], X(0) + cw / 2, yb + 12, 'center');
		for (let k = 1; k <= T; k++) {
			const { w, a } = macs(plan.order[k - 1]), x0 = X(k) + 3, bw = cw - 6, state = k < s ? 'done' : k === s ? 'now' : 'ahead';
			let top = yb;
			for (const [m, colour] of [[w, INK.weight], [a, INK.grad]]) {
				if (!m) continue;
				const h = m * per;
				if (state === 'ahead') {
					pen(cx, () => {
						cx.setLineDash(AHEAD);
						box(cx, x0 + 0.5, top - h + 0.5, bw - 1, h - 1);
					}, colour, 1, 0.6);
				} else {
					cx.fillStyle = rgba(colour, 0.85);
					cx.fillRect(x0, top - h + 1, bw, h - 1);
				}
				top -= h;
			}
			if (state === 'now' && top < yb) pen(cx, () => box(cx, x0 - 1.5, top - 0.5, bw + 3, yb - top + 1), INK.ink, 1.2);
			if (w + a) put(cx, [[exeFmt(w + a), state === 'ahead' ? INK.mute : INK.text, scaled(8.5) + SERIF]], X(k) + cw / 2, top - 3, 'center');
			put(cx, [[String(k), k === s ? INK.sign : INK.mute, k === s ? 'bold ' + scaled(9.5) + SERIF : SMALL]], X(k) + cw / 2, yb + 12, 'center');
		}
		// the totals on a log scale: the forward pass; backward() so far, against all of it; and the same partial
		// derivatives one at a time, a forward pass each, as forward mode or finite differences take them, and
		// twice that, as gradcheck's central differences do
		const tx = beside ? rx + 14 : lx, ty = beside ? 40 : yb + 36, bx0 = tx + 182, bx1 = W - 12, LO = 2, HI = 6;
		const at = v => bx0 + (Math.log10(Math.max(v, 10 ** LO)) - LO) / (HI - LO) * (bx1 - bx0);
		const done = backwardMacs(s);
		const totals = [
			[`the forward pass: ${exeFmt(total)}`, total, INK.data, null],
			[`backward(): ${exeFmt(done)} of ${exeFmt(all)}, ${times(all / total)} ×`, done, INK.wire, all],
			[`a forward pass a parameter, ${PARAMS}: ${exeFmt(PARAMS * total)}`, PARAMS * total, INK.edge, null],
			[`central differences, ${2 * PARAMS}: ${exeFmt(2 * PARAMS * total)}`, 2 * PARAMS * total, INK.edge, null],
		];
		totals.forEach(([label, v, colour, whole], i) => {
			const yy = ty + i * 17;
			put(cx, [[label, i === 1 ? INK.sign : INK.text, 'italic ' + scaled(9.5) + SERIF]], tx, yy + 3);
			if (whole) {
				pen(cx, () => {
					cx.setLineDash(AHEAD);
					box(cx, bx0 + 0.5, yy - 4.5, at(whole) - bx0 - 1, 8);
				}, colour, 1, 0.6);
			}
			if (v >= 10 ** LO) {
				cx.fillStyle = rgba(colour, 0.85);
				cx.fillRect(bx0, yy - 4, at(v) - bx0, 8);
			}
		});
		const ya = ty + 68;
		line(cx, [[bx0, ya + 0.5], [bx1, ya + 0.5]], INK.edge);
		for (let e = LO; e <= HI; e++) {
			line(cx, [[at(10 ** e) + 0.5, ya - 2], [at(10 ** e) + 0.5, ya + 3]], INK.edge);
			put(cx, [[exePower(e), INK.mute, scaled(8.5) + SERIF]], at(10 ** e), ya + 12, 'center');
		}
		// the node at work, as the Jacobian it stands for
		wrap(cx, vjp(s), 10, ya + 24, W - 20, INK.text, 'italic ' + scaled(10) + SERIF, 12.5);
	}

	// ---- the chain rule a line at a time: a line per key derivative, by the
	// node that makes it, the product of the local derivatives from J down to it.
	// The stem's first k factors were made on a line above and go by made[k], or,
	// with none made yet, backward()'s seed ∂J/∂J = 1; the one local derivative
	// in teal is multiplied in on the line, from what the node saved ----
	const fr = (top, bottom) => `<span class="fr"><span>∂${top}</span><span>∂${bottom}</span></span>`;
	function chainLines() {
		const z = l => `z${sub(l)}`, a = l => `a${sub(l)}`, d = l => `δ${sub(l)}`, w = WIDTHS;
		const stem = [['J', z(L)]], made = ['1', d(L)];
		const lines = [{
			node: 'loss', of: z(L), k: 0, own: ['J', z(L)], product: `2(${z(L)} − y)/${ENTRIES}`, shape: `${BATCH} × ${w[L]}`, saved: `${z(L)}, y`,
		}];
		for (let l = L; l >= 1; l--) {
			const k = stem.length, x = prevName(l), W = `W${sub(l)}`, b = `b${sub(l)}`, off = l === 1 && !S.xGrad;
			lines.push({ node: 'M' + l, of: W, k, own: [z(l), W], product: `${d(l)}ᵀ${x}`, shape: `${w[l]} × ${w[l - 1]}, as ${W}`, saved: x });
			lines.push({
				node: 'M' + l, of: b, k, own: [z(l), b], product: `Σₙ ${d(l)}[n]`, shape: `${w[l]}, as ${b}`, saved: `none: ${fr(z(l), b)} = 1`,
			});
			// ∂J/∂x is worked, and Wᵀ saved for it, only if x requires grad
			lines.push({
				node: 'M' + l, of: x, k, own: [z(l), x], off, product: off ? 'not computed' : `${d(l)}${W}`,
				shape: off ? '' : `${BATCH} × ${w[l - 1]}, as ${x}`, saved: off ? 'nothing: x needs no grad' : `${W}ᵀ`,
			});
			if (l === 1) break;
			stem.push([z(l), a(l - 1)]);
			made.push(`∂J/∂${a(l - 1)}`);
			const slope = ACTS[S.act].local(l - 1);
			lines.push({
				node: 'F' + (l - 1), of: z(l - 1), k: stem.length, own: [a(l - 1), z(l - 1)],
				product: `${fr('J', a(l - 1))} ⊙ ${slope.includes(' − ') ? `(${slope})` : slope}`,
				shape: `${BATCH} × ${w[l - 1]}`, saved: a(l - 1),
			});
			stem.push([a(l - 1), z(l - 1)]);
			made.push(d(l - 1));
		}
		return { stem, made, lines };
	}
	// made once the pass has run its node, now while it runs, ahead of it; off if never made
	const lineState = (node, s, off) => (off ? 'off' : plan.nodes[node].ran < s ? '' : plan.nodes[node].ran === s ? 'now' : 'ahead');
	const ROLES = { W: 'updates', b: 'updates', z: 'propagates', a: 'propagates' };
	const keyOf = ln => (ln.of[0] === 'z' ? `δ${ln.of.slice(1)} = ${fr('J', ln.of)}` : fr('J', ln.of));
	// each line's chain, from its name handed down, a δ by name, a ∂J/∂a as a fraction, times its own factor;
	// under the table, what writing every chain out in full from J would cost: a line's k factors made above
	// and its own, against one multiplication a line
	function drawFull(s) {
		const rows = chain.lines.map(ln => {
			const made = chain.made[ln.k], n = plan.nodes[ln.node];
			const handed = ln.k ? [`<span class="propagates">${made.startsWith('∂J/∂') ? fr('J', made.slice(4)) : made}</span>`] : [];
			const factors = [...handed, `<span class="multiplies">${fr(...ln.own)}</span>`].join('<span class="dot">·</span>');
			return `<tr class="${lineState(ln.node, s, ln.off)}" data-node="${ln.node}"><th>${n.ran} ${n.name}</th>`
				+ `<td><span class="${ROLES[ln.of[0]] || 'muted'}">${keyOf(ln)}</span> =</td><td class="chain">${factors}</td>`
				+ `<td>= ${ln.product}<span class="sh">${ln.shape}</span></td><td><span class="muted">${ln.saved}</span></td></tr>`;
		}).join('');
		const live = chain.lines.filter(ln => !ln.off), full = live.reduce((t, ln) => t + ln.k + 1, 0), body = $('.grd-chain-body');
		body.innerHTML = '<table><thead><tr><th>node</th><th>key derivative</th><th>handed down · multiplied in</th><th>in matrices</th>'
			+ `<th>saved in the forward pass</th></tr></thead><tbody>${rows}</tbody></table><p class="grd-sum">Written out in full from J, `
			+ `the ${live.length} chains would hold ${full} factors; a line at a time, each is one product handed down times one new `
			+ `factor, ${live.length} multiplications in all.</p>`;
		body.insertAdjacentHTML('beforeend', pointers(body, s));
	}
	// a rail for each product a line makes, from a dot at that line down to an arrow at each line that takes it,
	// into the name it goes by there; the δs in one lane, the ∂J/∂as in the other. Lit while the product is held,
	// made and not yet taken, or kept by retain_grad(); faded once it is dropped, as its track is; dashed before
	// it is made
	function pointers(body, s) {
		const { lines, stem, made } = chain, at = body.getBoundingClientRect(), rows = [...body.querySelectorAll('tbody tr')];
		const mid = i => {
			const r = rows[i].getBoundingClientRect();
			return r.top + r.height / 2 - at.top;
		};
		const left = rows[0].querySelector('td.chain').getBoundingClientRect().left - at.left, tip = left + 23;
		const same = (f, g) => f.join() === g.join();
		let marks = '';
		made.forEach((name, k) => {
			if (!k) return;
			const from = lines.findIndex(ln => ln.k === k - 1 && same(ln.own, stem[k - 1]));
			const takers = lines.flatMap((ln, i) => (ln.k === k ? [i] : []));
			const x = left + (name.startsWith('δ') ? 6 : 13), y0 = mid(from), y1 = mid(takers.at(-1));
			const st = edgeState(edgeOf(lines[from].node, lines[takers[0]].node), s), ahead = st === 'ahead';
			const alpha = held(st) ? 0.9 : ahead ? 0.6 : GONE.line;
			const style = `stroke="${INK.grad}" stroke-width="1.1" opacity="${alpha}"${ahead ? ` stroke-dasharray="${AHEAD.join(' ')}"` : ''}`;
			marks += `<circle cx="${x}" cy="${y0}" r="2.4" fill="${INK.grad}" opacity="${alpha}"/>`
				+ `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" ${style}/>`;
			for (const i of takers) {
				const y = mid(i);
				marks += `<line x1="${x}" y1="${y}" x2="${tip - 4}" y2="${y}" ${style}/>`
					+ `<path d="M${tip - 5} ${y - 3}L${tip} ${y}L${tip - 5} ${y + 3}z" fill="${INK.grad}" opacity="${alpha}"/>`;
			}
		});
		return `<svg class="grd-ptr" width="${at.width}" height="${at.height}">${marks}</svg>`;
	}

	// ---- what is held, step by step, across the foot of the Chain Rule view.
	// What a node saved lives from the forward pass until the last node to read it
	// has run, unless retain_graph=True; a gradient in flight, δ or ∂J/∂a, from the
	// node that makes it to the one that takes it, unless retain_grad() keeps it;
	// a .grad from its AccumulateGrad on, for the optimiser ----
	function lives() {
		const { nodes } = plan;
		return {
			saved: plan.saved.map(t => ({
				name: t.name, colour: t.role === 'data' ? INK.data : INK.act,
				from: 0, to: S.retainGraph ? Infinity : Math.max(...holders(t).map(n => n.ran)),
			})),
			flight: plan.edges.filter(e => e.kept).map(e => ({
				name: e.name, colour: INK.grad, from: nodes[e.from].ran, to: S.retainGrad ? Infinity : nodes[e.to].ran,
			})),
			grads: plan.edges.filter(e => nodes[e.to].name === 'AccumulateGrad').map(e => ({
				name: `${nodes[e.to].of}.grad`, colour: INK.weight, from: nodes[e.from].ran, held: nodes[e.to].ran, to: Infinity,
			})),
		};
	}
	// gone from memory after s nodes have run, as memory() counts it: freed or dropped once the node that last
	// reads it has run. x and y never go: the graph lets go of them, but the caller still holds them
	const gone = (r, s) => r.to !== Infinity && s >= r.to && r.colour !== INK.data;
	// the steps along the top from lx to rx, the forward pass first, the step reached banded; where a click lands
	function steps(cx, s, lx, rx, y, H) {
		const T = plan.order.length, cw = (rx - lx) / (T + 1), X = k => lx + (k + 0.5) * cw;
		lifeAt = { lx, cw, T, y0: y - 10, y1: H };
		if (s) {
			cx.fillStyle = rgba(INK.frame, 0.18);
			cx.fillRect(X(s) - cw / 2, y - 10, cw, H - y + 8);
		}
		put(cx, [['fwd', INK.mute, SMALL]], X(0), y, 'center');
		for (let k = 1; k <= T; k++) {
			put(cx, [[String(k), k === s ? INK.sign : INK.mute, k === s ? 'bold ' + scaled(9.5) + SERIF : SMALL]], X(k), y, 'center');
		}
		return { X, cw };
	}
	// a life as a bar from the node that makes it to the last to read it, column middle to column middle, so a
	// gradient handed on ends where the next begins: solid in its colour as far as the pass has come, past the
	// step reached dashed, still to come, and once it is gone from memory faded, as the chain's dropped pointers
	// fade; a .grad thin while in flight to its AccumulateGrad and thick once held
	function lifeBar(cx, r, y, X, cw, s, h, rx) {
		const a = X(r.from) + 1, b = r.to === Infinity ? rx : X(r.to) - 1, cut = within(X(s) + cw / 2, a, b), start = r.held ? X(r.held) + 1 : a;
		const thin = Math.max(2, h / 3), alpha = gone(r, s) ? GONE.fill : 0.9;
		const bar = (p, q, t) => {
			if (q <= p) return;
			cx.fillStyle = rgba(r.colour, alpha);
			cx.fillRect(p, y - t / 2, q - p, t);
		};
		// still to come: a dashed outline round a bar, or a dashed line along one too thin to outline
		const ahead = (p, q, t) => {
			if (q <= p) return;
			cx.save();
			cx.setLineDash(AHEAD);
			cx.strokeStyle = rgba(r.colour, 0.6);
			cx.lineWidth = 1;
			cx.beginPath();
			if (t > 4) cx.rect(p + 0.5, y - t / 2 + 0.5, q - p - 1, t - 1);
			else {
				cx.moveTo(p, y);
				cx.lineTo(q, y);
				cx.lineWidth = Math.min(t, 2);
			}
			cx.stroke();
			cx.restore();
		};
		bar(a, Math.min(start, cut), thin);
		bar(start, cut, h);
		ahead(Math.max(a, cut), start, thin);
		ahead(Math.max(start, cut), b, h);
		return { a, b };
	}
	// three tracks: what is saved, a thin bar each; the gradients in flight on one track, each handing on to the
	// next as the one before is taken; the .grads a stair. The lanes fill the pane: what room is left over goes
	// to the gaps between them, and where retain_grad() and x.requires_grad add more rows than it holds, the rows
	// are drawn closer
	const PITCH = { saved: 8, flight: 15, kept: 6.5, grad: 6.5 }, GAPS = 8 + 4;
	function drawLife(s) {
		const { cx, W, H } = paper($('[data-pane="life"]')), L3 = lives();
		const dy = heading(cx, 'What is held, step by step', [[INK.act, 'saved: freed once read'], [INK.grad, 'in flight: one hop, then dropped'],
			[INK.weight, '.grad: kept for step()'], [INK.mute, 'faded: gone from memory'], [INK.mute, 'dashed: still to come']]);
		const lx = 78, rx = W - 56, { X, cw } = steps(cx, s, lx, rx, 30 + dy, H);
		// the gradients in flight, each on the first track free from where it starts. Where retain_grad() keeps
		// them none is ever free, so each has a thin track of its own and is named at its start, as a .grad is
		const kept = S.retainGrad, ends = [];
		const track = L3.flight.map(r => {
			let k = ends.findIndex(end => end <= r.from);
			if (k < 0) k = ends.push(0) - 1;
			ends[k] = r.to;
			return k;
		});
		// each lane's rows at its pitch, times f where they need more room than the pane has
		const pitch = [PITCH.saved, kept ? PITCH.kept : PITCH.flight, PITCH.grad];
		const need = L3.saved.length * pitch[0] + Math.max(1, ends.length) * pitch[1] + L3.grads.length * pitch[2];
		const room = H - 46 - dy - GAPS, f = Math.min(1, room / need), spare = Math.max(0, room - need) / 2;
		const [ps, pf, pg] = pitch.map(p => p * f);
		const lane = (name, colour, top, n, p) => put(cx, [[name, colour, 'bold ' + scaled(9.5) + SERIF]], lx - 8, top + (n - 1) * p / 2 + 3, 'right');
		let y = 40 + dy;
		lane('saved', INK.act, y, L3.saved.length, ps);
		for (const r of L3.saved) {
			const { b } = lifeBar(cx, r, y, X, cw, s, 5, rx), yours = r.colour === INK.data && s >= r.to;
			const name = r.to === Infinity ? `${r.name}, kept` : yours ? `${r.name}, still yours` : r.name;
			put(cx, [[name, rgba(r.colour, gone(r, s) ? GONE.text : 0.85), 'italic ' + scaled(8.5) + SERIF]], Math.min(b + 3, rx), y + 3);
			y += ps;
		}
		// the segments, then the names and the drops over all of them, so none is covered
		y += 8 + spare;
		lane('in flight', INK.grad, y, Math.max(1, ends.length), pf);
		const segs = L3.flight.map((r, i) => ({ r, yy: y + track[i] * pf, ...lifeBar(cx, r, y + track[i] * pf, X, cw, s, kept ? 4 : 12, rx) }));
		for (const { r, yy, a, b } of segs) {
			if (kept) {
				put(cx, [[r.name, rgba(r.colour, 0.85), 'italic ' + scaled(8.5) + SERIF]], a - 3, yy + 3, 'right');
				continue;
			}
			// the name on the bar in navy as far as it is filled, and past that, over the dashes, muted
			const cut = gone(r, s) ? W : within(X(s) + cw / 2, a, b);
			for (const [p, q, ink] of [[a, cut, gone(r, s) ? rgba(INK.sign, GONE.text) : INK.onfill], [cut, W, INK.mute]]) {
				if (q <= p) continue;
				cx.save();
				cx.beginPath();
				cx.rect(p, yy - 8, q - p, 16);
				cx.clip();
				put(cx, [[r.name, ink, 'italic ' + scaled(9) + SERIF]], a + 3, yy + 3.5);
				cx.restore();
			}
			if (b < rx) put(cx, [['×', gone(r, s) ? rgba(INK.sign, GONE.text) : rgba(INK.grad, 0.8), scaled(9) + SERIF]], b - 3, yy + 3, 'right');
		}
		y += Math.max(1, ends.length) * pf + 4 + spare;
		lane('.grad', INK.weight, y, L3.grads.length, pg);
		put(cx, [['→ step()', rgba(INK.weight, 0.9), 'italic ' + scaled(8.5) + SERIF]], rx + 4, y + (L3.grads.length - 1) * pg / 2 + 3);
		for (const r of L3.grads) {
			const { a } = lifeBar(cx, r, y, X, cw, s, 4, rx);
			put(cx, [[r.name, rgba(r.colour, 0.85), 'italic ' + scaled(8.5) + SERIF]], a - 3, y + 3, 'right');
			y += pg;
		}
	}

	// ---- the views, each its panes' drawings, and what both read out ----
	const VIEWS = { pass: [drawTree, drawTape, drawGraph, drawCost], chain: [drawFull, drawLife] };
	// J; what the graph holds, the gradients in flight and the .grads written, in bytes as float32 would hold
	// them; and every ∂J/∂W and ∂J/∂b against central differences
	function readings(s) {
		const m = memory(s), accs = Object.values(plan.nodes).filter(n => n.name === 'AccumulateGrad');
		return [
			['J', fmt(lossOf(net, fw.a))],
			['saved', `${size(m.loc)} <span>+ ${size(m.data)} of x, y</span>`],
			['in flight', size(m.mid)],
			['.grad', `${accs.filter(n => n.ran <= s).length} <span>of ${accs.length}, ${size(m.upd)}</span>`],
			['gradcheck', fmt(check, 2)],
		];
	}
	const atField = $('[data-out="at"]'), runBtn = $('[data-act="run"]'), ends = exeEnds(root);
	let running = 0;
	function render() {
		const last = plan.order.length, s = (S.step = within(S.step, 0, last));
		root.dataset.view = S.view;
		for (const draw of VIEWS[S.view]) draw(s);
		$$('[data-act-f]').forEach(b => exePress(b, b.dataset.actF === S.act));
		$$('[data-opt]').forEach(b => exePress(b, S[b.dataset.opt]));
		$$('[data-view]').forEach(b => exePress(b, b.dataset.view === S.view));
		// how far the pass has run, and the field filled as far
		atField.textContent = s ? `node ${s} of ${last}` : 'graph built';
		atField.style.setProperty('--at', Math.round(s / last * atField.clientWidth) + 'px');
		ends(s <= 0, s >= last);
		exeRunning(runBtn, !!running);
		const at = s ? `node ${s} of ${last}, ${plan.nodes[plan.order[s - 1]].name}` : 'the forward pass has built the graph';
		say(`${exeState(running, s >= last)} · ${at} · J = ${fmt(lossOf(net, fw.a))} · batch ${BATCH}, ${ACTS[S.act].label}`);
		$('[data-out="read"]').innerHTML = readings(s).map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('');
	}

	// ---- the toolbar ----
	// another activation is another graph, but its nodes run in the same order, so the pass stays at its node, as
	// it does when a torch option is pressed
	$$('[data-act-f]').forEach(b => b.addEventListener('click', () => {
		S.act = b.dataset.actF;
		build();
		render();
	}));
	$$('[data-opt]').forEach(b => b.addEventListener('click', () => {
		S[b.dataset.opt] = !S[b.dataset.opt];
		build();
		render();
	}));
	// another view keeps the node the pass is at; the window's View menu lists the views and presses these
	$$('[data-view]').forEach(b => b.addEventListener('click', () => {
		S.view = b.dataset.view;
		render();
	}));

	// ---- the transport: back to the graph as the forward pass left it, back n
	// nodes, on n or to the end, greyed at the two ends; and Run, a node a step at
	// the speed chosen ----
	function show(step) {
		S.step = step;
		render();
	}
	function stop() {
		cancelAnimationFrame(running);
		running = 0;
	}
	let lastStep = 0, speed = 1;
	exeSpeed($('[data-in="speed"]'), speed, v => { speed = v; });
	function tick(now) {
		if (!running || !root.isConnected) return;
		if (now - lastStep >= STEP_MS / speed) {
			lastStep = now;
			show(S.step + 1);
		}
		if (S.step >= plan.order.length) {
			stop();
			render();
		} else running = requestAnimationFrame(tick);
	}
	function run() {
		if (running) {
			stop();
			render();
			return;
		}
		if (S.step >= plan.order.length) S.step = 0;
		lastStep = performance.now();
		running = requestAnimationFrame(tick);
		show(S.step + 1);
	}
	const STEP = { start: () => 0, back: (s, n) => s - n, next: (s, n) => s + n, end: () => plan.order.length };
	$$('.exe-buttons [data-act]').forEach(b => b.addEventListener('click', () => {
		stop();
		show(STEP[b.dataset.act](S.step, 1));
	}));
	runBtn.addEventListener('click', run);
	exeSeekBar(atField, share => {
		stop();
		show(Math.round(share * plan.order.length));
	});
	// the keys wherever the focus is in the window but on a control, whose keys are its own, as optimiser.exe's:
	// Space runs, the arrows step, Shift ten, Home and End go to the ends; presses keep them with the window
	const KEYS = { ' ': 'run', ArrowLeft: 'back', ArrowRight: 'next', Home: 'start', End: 'end' };
	root.addEventListener('keydown', e => {
		if (e.target.closest('button, select, input') || !KEYS[e.key]) return;
		e.preventDefault();
		if (KEYS[e.key] === 'run') run();
		else {
			stop();
			show(STEP[KEYS[e.key]](S.step, e.shiftKey ? 10 : 1));
		}
	});
	root.addEventListener('pointerdown', e => {
		if (!e.target.closest('input, select')) setTimeout(() => root.focus({ preventScroll: true }));
	});

	// ---- clicking: a box on the tree, a gate on the tape, a node of the graph,
	// a column of the costs, a line of the chain rule or a column of what is held
	// runs the pass there. Nothing waits on the pointer: what a node does is
	// written out under the costs ----
	const pointAt = (cv, e) => {
		const r = cv.getBoundingClientRect();
		return [e.clientX - r.left, e.clientY - r.top];
	};
	const inside = (x, y) => b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
	function runTo(node) {
		if (!node) return;
		stop();
		show(plan.nodes[node].ran);
	}
	// a column, of the costs or of what is held, a step: the pass run to it. Off the columns, on a label or a
	// total, nothing
	function toColumn(at, x, y) {
		const k = Math.floor((x - at.lx) / at.cw);
		if (k < 0 || k > at.T || y < at.y0 || y > at.y1) return;
		stop();
		show(k);
	}
	const clicks = {
		tree: (x, y) => runTo(treeAt.find(inside(x, y))?.node),
		tape: (x, y) => runTo(tapeAt.find(inside(x, y))?.node),
		graph: (x, y) => runTo(boxes.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id),
		cost: (x, y) => toColumn(costAt, x, y),
		life: (x, y) => toColumn(lifeAt, x, y),
	};
	for (const [pane, click] of Object.entries(clicks)) {
		const cv = $(`[data-pane="${pane}"]`);
		cv.addEventListener('click', e => click(...pointAt(cv, e)));
	}
	$('.grd-chain').addEventListener('click', e => runTo(e.target.closest('[data-node]')?.dataset.node));

	exeResized(root, render, $('.exe-body'));
	build();
	render();
	plex().then(render);
})();
