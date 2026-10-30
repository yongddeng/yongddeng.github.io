// optimiser.exe, for 301: SGD, Momentum, RMSProp, AdamW and Muon set off together
// down a loss surface over two parameters. The map, on the left, draws the
// surface, L over θ, as contours or as a mesh to turn; the top right, how far
// each run is above the surface's lowest point, L − L*, step by step on a log
// axis; the bottom right, the sweep: where each ends after its budget of steps
// at every η the sliders have, which is how each optimiser's η is tuned. Under
// the panes, a card for each optimiser holds its η and knobs, named and set at
// first as PyTorch's are, over its own map of where it ends across η and a knob.
// An η schedule acts on all. Each run follows its gradient, plus Gaussian noise
// of size σ when the noise is up, as a minibatch's gradient wobbles about the
// full one, clipped if clipping is on, and in bf16 or fp16 under AMP, and of
// the loss scaled up, if it is, as summing it over a batch rather than
// averaging would. An init can start 16 seeds at once, to show what the draw
// decides.
//
// From the top: the maths (the optimisers, schedules, mixed precision,
// surfaces and inits), the settings the controls change, the runs, the sweep
// and the cards' maps, which run them in the background, the race on screen,
// then the panes, the cards, the status bar and the controls. The desktop
// re-creates a window's scripts when it swaps the window in, so this runs once
// per window and claims it with data-ready.
(function () {
	const root = document.querySelector('.opt:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';
	const $ = sel => root.querySelector(sel), $$ = sel => [...root.querySelectorAll(sel)];
	const map = $('.opt-map'), plot = $('.opt-loss'), rates = $('.opt-sweep');
	const say = exeStatus(root);
	const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

	// ---- numbers, as the window writes them ----
	const FLOOR = 1e-12; // gaps below this are drawn and read at it
	const SUP = { '-': '⁻', '+': '', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
	const fmt = v => v.toLocaleString('en-GB');
	const power = k => '10' + String(k).split('').map(c => SUP[c]).join('');
	const decade = v => (v === 1 ? '1' : power(Math.round(Math.log10(v)))); // a power of 10 as an axis labels it
	const signed = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
	const sci = v => (v < FLOOR ? '< ' + power(-12) : v >= 0.01 && v < 1000 ? v.toPrecision(3)
		: v.toExponential(1).replace(/e(.*)/, (_, e) => '×' + power(+e)));
	const plain = html => html.replace(/<[^>]+>/g, '');
	const median = vs => vs.slice().sort((a, b) => a - b)[vs.length >> 1];

	// ---- θ as weight matrices ----
	// Muon and the inits take θ for a network's weights, in the shape each
	// surface gives: a 1×2 row; a 2×2 diagonal; or two 1×1 layers, each its own.
	// A shape gives the inits their fan-in and fan-out, and Muon its
	// orthogonalisation: an update
	// USVᵀ made about UVᵀ by Jordan's five Newton–Schulz steps,
	// X → aX + (bA + cA²)X with A = XXᵀ, after X is scaled to norm 1, so that
	// each singular value goes s → as + bs³ + cs⁵, from 1 to near 0.7.
	// torch.optim.Muon runs them in bf16, each product rounded, and so do these
	// (PRECISIONS, below)
	const EPS = 1e-8;
	const NS = [3.4445, -4.775, 2.0315], NS_EPS = 1e-7;
	// One matrix's update orthogonalised, the matrix as its rows, no more of
	// them than its columns. Muon takes it at every step of every run, so in
	// loops over arrays made once: A = XXᵀ, B = bA + cA², then X → aX + BX,
	// each entry's sum from 0 in order and rounded once
	function newtonSchulz(X) {
		const r = PRECISIONS.bf16.round, [a, b, c] = NS, n = X.length, m = X[0].length;
		const grid = cols => Array.from({ length: n }, () => new Array(cols));
		const norm = Math.max(r(Math.hypot(...X.flat().map(r))), r(NS_EPS));
		let Y = grid(m), Z = grid(m);
		const A = grid(n), B = grid(n);
		for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) Y[i][j] = r(r(X[i][j]) / norm);
		for (let k = 0; k < 5; k++) {
			for (let i = 0; i < n; i++) {
				for (let j = 0; j < n; j++) {
					let sum = 0;
					for (let l = 0; l < m; l++) sum += Y[i][l] * Y[j][l];
					A[i][j] = r(sum);
				}
			}
			for (let i = 0; i < n; i++) {
				for (let j = 0; j < n; j++) {
					let sum = 0;
					for (let l = 0; l < n; l++) sum += A[i][l] * A[l][j];
					B[i][j] = r(b * A[i][j] + c * sum);
				}
			}
			for (let i = 0; i < n; i++) {
				for (let j = 0; j < m; j++) {
					let sum = 0;
					for (let l = 0; l < n; l++) sum += B[i][l] * Y[l][j];
					Z[i][j] = r(a * Y[i][j] + sum);
				}
			}
			[Y, Z] = [Z, Y];
		}
		return Y;
	}
	const SHAPES = {
		row: { fans: [2, 1], orthogonal: ([x, y]) => newtonSchulz([[x, y]])[0] },
		diagonal: { fans: [2, 2], orthogonal: ([x, y]) => newtonSchulz([[x, 0], [0, y]]).map((row, i) => row[i]) },
		layers: { fans: [1, 1], orthogonal: u => u.map(e => newtonSchulz([[e]])[0][0]) },
	};

	// ---- the optimisers ----
	// The step each takes, before η, from the gradient g: s keeps what it
	// remembers of past gradients, m and v for each coordinate; t counts the
	// steps it has taken; k holds its knobs' values; shape is θ's, and θ where
	// it is, for the weight decay. Its knobs: PyTorch's name for each, and for
	// AdamW's where its betas hold them, the symbol shown, the values its slider
	// steps through and PyTorch's default. Its lr, PyTorch's default η; its
	// class in torch.optim and the arguments it takes there
	const BETAS = [0, 0.5, 0.9, 0.95, 0.99], DECAYS = [0.5, 0.9, 0.99, 0.999], SQUARES = [0.9, 0.99, 0.999, 0.9999];
	const WEIGHT_DECAYS = [0, 0.001, 0.01, 0.1, 1];
	// torch's lerp, as Muon's buffers take it: from s towards e by w
	const lerp = (s, e, w) => (w < 0.5 ? s + w * (e - s) : e - (e - s) * (1 - w));
	// weight decay, decoupled as AdamW's and Muon's are: θ shrinks by η·wd at
	// each step taken, beside the step the gradient gives
	const decayed = (d, k, θ) => d.map((dj, j) => dj + k.weight_decay * θ[j]);
	const OPTIMISERS = [
		{ name: 'SGD', colour: '#0072b2', lr: 1e-3, knobs: [],
			cls: 'SGD', args: 'lr={lr}',
			step: g => g },
		{ name: 'Momentum', colour: '#e69f00', lr: 1e-3, knobs: [{ key: 'momentum', sym: 'β', values: BETAS, def: 0.9 }],
			cls: 'SGD', args: 'lr={lr}, momentum={momentum}',
			step: (g, s, t, k) => {
				s.m = s.m.map((m, j) => k.momentum * m + g[j]);
				return s.m;
			} },
		// as PyTorch's, with no bias correction: v starts at 0, so the first
		// steps are up to 1/√(1 − α) times as long
		{ name: 'RMSProp', colour: '#cc79a7', lr: 1e-2, knobs: [{ key: 'alpha', sym: 'α', values: DECAYS, def: 0.99 }],
			cls: 'RMSprop', args: 'lr={lr}, alpha={alpha}',
			step: (g, s, t, k) => {
				s.v = s.v.map((v, j) => k.alpha * v + (1 - k.alpha) * g[j] ** 2);
				return g.map((gj, j) => gj / (Math.sqrt(s.v[j]) + EPS));
			} },
		// Adam, its weight decay decoupled
		{ name: 'AdamW', colour: '#d55e00', lr: 1e-3,
			knobs: [{ key: 'beta1', arg: 'betas[0]', sym: 'β₁', values: BETAS, def: 0.9 }, { key: 'beta2', arg: 'betas[1]', sym: 'β₂', values: SQUARES, def: 0.999 },
				{ key: 'weight_decay', sym: 'wd', values: WEIGHT_DECAYS, def: 0.01 }],
			cls: 'AdamW', args: 'lr={lr}, betas=({beta1}, {beta2}), weight_decay={weight_decay}',
			step: (g, s, t, k, shape, θ) => {
				s.m = s.m.map((m, j) => k.beta1 * m + (1 - k.beta1) * g[j]);
				s.v = s.v.map((v, j) => k.beta2 * v + (1 - k.beta2) * g[j] ** 2);
				return decayed(s.m.map((m, j) => (m / (1 - k.beta1 ** t)) / (Math.sqrt(s.v[j] / (1 - k.beta2 ** t)) + EPS)), k, θ);
			} },
		// Nesterov momentum on a running average of the gradient, the update
		// made orthogonal, and the weight decay decoupled
		{ name: 'Muon', colour: '#009e73', lr: 1e-3,
			knobs: [{ key: 'momentum', sym: 'μ', values: BETAS, def: 0.95 }, { key: 'weight_decay', sym: 'wd', values: WEIGHT_DECAYS, def: 0.1 }],
			cls: 'Muon', args: 'lr={lr}, momentum={momentum}, weight_decay={weight_decay}',
			step: (g, s, t, k, shape, θ) => {
				s.m = s.m.map((m, j) => lerp(m, g[j], 1 - k.momentum));
				return decayed(shape.orthogonal(g.map((gj, j) => lerp(gj, s.m[j], k.momentum))), k, θ);
			} },
	];
	const knobOf = (i, key) => OPTIMISERS[i].knobs.find(n => n.key === key);
	// the learning rates the sliders step through and the sweep tries, 1-2-5 a decade
	const ETAS = [1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
	// an optimiser's η and knobs as PyTorch sets them
	const torchOf = o => ({ eta: ETAS.indexOf(o.lr), k: Object.fromEntries(o.knobs.map(n => [n.key, n.def])) });

	// ---- the η schedules: η's share at step t of T, and how PyTorch sets it ----
	// Step t runs at the scheduler's epoch t − 1, as scheduler.step() after
	// each optimiser.step() leaves it. Warmup is SequentialLR with its milestone
	// at the first tenth: LinearLR up from its default start_factor, ⅓, then
	// CosineAnnealingLR from its own epoch 0
	const WARM = 0.1, RAMP_FROM = 1 / 3;
	const SCHEDULES = {
		constant: { at: () => 1, call: () => '' },
		cosine: { at: (t, T) => 0.5 * (1 + Math.cos(Math.PI * (t - 1) / T)), call: T => ' · CosineAnnealingLR(T_max=' + T + ')' },
		warmup: {
			at: (t, T) => {
				const w = WARM * T, e = t - 1;
				return e < w ? RAMP_FROM + (1 - RAMP_FROM) * e / w : 0.5 * (1 + Math.cos(Math.PI * (e - w) / (T - w)));
			},
			call: T => ' · LinearLR(total_iters=' + WARM * T + ') then CosineAnnealingLR(T_max=' + (1 - WARM) * T + ')',
		},
	};

	// ---- mixed precision, as torch.autocast runs it ----
	// The forward and backward in a float of fewer bits, at the weights cast to
	// it, the gradient back in it; the weights and the optimiser's state stay
	// fp32. bf16 keeps fp32's range with 8 bits of significand; fp16 keeps 11
	// but ends at 65,504, so a GradScaler multiplies the loss, from 2¹⁶ at
	// first, to lift small gradients clear of 0, skips a step whose gradient
	// overflows and halves the multiple, and doubles it after GROWTH steps
	// without. A float: bits after the point, the lowest exponent before the
	// gaps stop shrinking, and the highest; a value rounds to the nearest it
	// holds, a tie to the even one, as torch's casts do, and from halfway past
	// the highest to ∞
	function float(bits, emin, emax) {
		const max = (2 - 2 ** -(bits + 1)) * 2 ** emax;
		return v => {
			const a = Math.abs(v);
			if (!a || !isFinite(a)) return v;
			if (a >= max) return Math.sign(v) * Infinity;
			let e = Math.floor(Math.log2(a));
			if (2 ** e > a) e--;
			const q = 2 ** (Math.max(e, emin) - bits), n = a / q, m = Math.round(n);
			return Math.sign(v) * (m - n === 0.5 && m % 2 ? m - 1 : m) * q;
		};
	}
	const SCALE = 2 ** 16, GROWTH = 2000;
	const PRECISIONS = {
		bf16: { round: float(7, -126, 127), dtype: 'torch.bfloat16', scaler: false },
		fp16: { round: float(10, -14, 15), dtype: 'torch.float16', scaler: true },
	};
	// clip_grad_norm_'s max_norm: a gradient longer than this is cut to it; and the eps it adds to the norm
	const CLIP = 1, CLIP_EPS = 1e-6;

	// ---- the surfaces ----
	// Each: the loss and the gradient each weight gets; the box drawn, x0 x1 y0
	// y1; where its lowest point is, or starts to be looked for; where runs
	// start unless an init draws the start; how many steps they take; σ at the
	// noise slider's top; how many decades of L − L* the shading spans; θ's
	// shape; where its lowest points run, when they make a line, from u = 0 to 1;
	// and what else the cards read of θ.
	// Two dips' wells: x, y, width, depth.
	const SHARP = [-0.9, 0.5, 0.15, 1], WIDE = [0.9, -0.4, 0.7, 0.9];
	const well = ([cx, cy, s, depth], x, y) => depth * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s));
	// Cliff's network, Pascanu et al.'s (2013): one sigmoid unit fed back to
	// itself, x ← wσ(x) + b, from x = 0.5 for 50 steps, fit so that σ(x) ends
	// at 0.7; where w is large enough for two attractors, a small change in b
	// moves x from one to the other, and the loss falls off a cliff
	const sigmoid = v => 1 / (1 + Math.exp(-v));
	const UNROLL = 50, X0 = 0.5, AIM = 0.7;
	function unroll(w, b) {
		const xs = [X0];
		for (let k = 1; k <= UNROLL; k++) xs.push(w * sigmoid(xs[k - 1]) + b);
		return xs;
	}
	// x at the last step alone, for the loss, which the map asks of every pixel
	function unrolled(w, b) {
		let x = X0;
		for (let k = 0; k < UNROLL; k++) x = w * sigmoid(x) + b;
		return x;
	}
	// the b, for a w, at which σ(x) ends at 0.7, on the lip above the cliff, by halving
	function lip(w) {
		let lo = -5, hi = 0;
		for (let k = 0; k < 60; k++) {
			const mid = (lo + hi) / 2;
			if (sigmoid(unrolled(w, mid)) > AIM) hi = mid;
			else lo = mid;
		}
		return hi;
	}
	const SURFACES = {
		ravine: {
			L: (x, y) => 0.5 * ((x - 3) ** 2 + 150 * y * y),
			grad: (x, y) => [x - 3, 150 * y],
			box: [-1, 4.2, -0.75, 0.75], min: [3, 0], start: [-0.6, 0.5], steps: 600,
			noise: 8, decades: 4, shape: SHAPES.diagonal,
		},
		dips: {
			L: (x, y) => 0.06 * (x * x + y * y) - well(SHARP, x, y) - well(WIDE, x, y),
			grad: (x, y) => {
				const p = well(SHARP, x, y) / SHARP[2] ** 2, q = well(WIDE, x, y) / WIDE[2] ** 2;
				return [0.12 * x + p * (x - SHARP[0]) + q * (x - WIDE[0]), 0.12 * y + p * (y - SHARP[1]) + q * (y - WIDE[1])];
			},
			box: [-2, 2, -1.5, 1.7], min: [SHARP[0], SHARP[1]], start: [-0.6, 0.75], steps: 1500,
			noise: 2, decades: 2, shape: SHAPES.row,
		},
		ab: {
			L: (a, b) => 0.5 * (a * b - 1) ** 2,
			grad: (a, b) => [(a * b - 1) * b, (a * b - 1) * a],
			box: [-2.5, 2.5, -2.5, 2.5], min: [1, 1], start: [0.012, 0.01], steps: 600,
			noise: 0.4, decades: 4, shape: SHAPES.layers,
			lows: u => [5 * u - 2.5, 1 / (5 * u - 2.5)],
			reading: { label: '<span><i>a</i>² − <i>b</i>²</span>', of: ([a, b]) => signed(a * a - b * b) },
		},
		// θ = (w, b), each a 1×1, and the gradient back through the 50 steps;
		// its lowest points are on the lip, so found by halving, as a step down
		// from one falls off
		cliff: {
			L: (w, b) => (sigmoid(unrolled(w, b)) - AIM) ** 2,
			grad: (w, b) => {
				const xs = unroll(w, b), s = sigmoid(xs[UNROLL]);
				let d = 2 * (s - AIM) * s * (1 - s), gw = 0, gb = 0;
				for (let t = UNROLL; t >= 1; t--) {
					const p = sigmoid(xs[t - 1]);
					gw += d * p;
					gb += d;
					d *= w * p * (1 - p);
				}
				return [gw, gb];
			},
			box: [3.4, 5.8, -3.2, -0.8], min: [5, lip(5)], exact: true, start: [4.7, -2.7], steps: 600,
			noise: 0.5, decades: 1, shape: SHAPES.layers, lows: u => [3.4 + 2.4 * u, lip(3.4 + 2.4 * u)],
		},
	};
	Object.entries(SURFACES).forEach(([key, s]) => (s.key = key));
	// the lowest point, from small steps down from where it is said to be, unless it is there exactly
	function lowest(s) {
		if (s.exact) return s.min;
		let [x, y] = s.min;
		for (let k = 0; k < 2000; k++) {
			const [gx, gy] = s.grad(x, y);
			x -= 0.005 * gx;
			y -= 0.005 * gy;
		}
		return [x, y];
	}
	// the sharpness at a point, the Hessian's larger eigenvalue λ, from the
	// gradient's differences; past η = 2/λ plain SGD diverges there
	function sharpness(s, [x, y]) {
		const h = 1e-5, g = s.grad(x, y), gx = s.grad(x + h, y), gy = s.grad(x, y + h);
		const a = (gx[0] - g[0]) / h, b = (gx[1] - g[1] + gy[0] - g[0]) / (2 * h), d = (gy[1] - g[1]) / h;
		return (a + d) / 2 + Math.hypot((a - d) / 2, b);
	}

	// ---- chance: seeded, so the nth draw of an init, and the noise a run meets, are the same on every visit ----
	const normal = random => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
	function seeded(seed) {
		return () => {
			seed = (seed + 0x6d2b79f5) | 0;
			let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
			return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
		};
	}

	// ---- the inits: θ about 0, each coordinate drawn alike ----
	// From the fan-in and fan-out of θ's shape: Xavier's (Glorot and Bengio),
	// N(0, 2/(fan-in + fan-out)), keeps a linear layer's output as spread as its
	// input; PyTorch's, nn.Linear's own, U(±1/√fan-in), kaiming_uniform_ with
	// a = √5. Each writes its law on a shape's fans and draws a coordinate from it
	const gaussian = sigma => ({
		law: fans => 'N(0, ' + +sigma(fans).toPrecision(2) + '²)',
		draw: (fans, random) => sigma(fans) * normal(random),
	});
	const INITS = {
		zero: { name: '0', ...gaussian(() => 0) },
		small: { name: 'σ = 0.01', ...gaussian(() => 0.01) },
		xavier: { name: 'Xavier', ...gaussian(([i, o]) => Math.sqrt(2 / (i + o))) },
		torch: {
			name: 'PyTorch',
			law: ([i]) => 'U(±' + +(1 / Math.sqrt(i)).toPrecision(2) + ')',
			draw: ([i], random) => (2 * random() - 1) / Math.sqrt(i),
		},
	};
	const SEEDS = 16; // how many seeds of an init run at once
	const CLOUD = 64; // how many of its draws the map shows, round the ones run
	// seed n's draw of an init on this surface
	function sample(key, n) {
		const random = seeded(n), { draw } = INITS[key], fans = surf.shape.fans;
		return [draw(fans, random), draw(fans, random)];
	}

	// ---- the settings, as the controls set them ----
	// The surface, its lowest point, L* there and the η past which SGD diverges
	// there; where the runs start, a fixed θ₀, unless an init is pressed and
	// draws the start, for one seed or SEEDS; the loss's scale, one of SCALES,
	// as summing it over a batch of that many instead of averaging would scale
	// it; the gradient noise σ; the schedule; whether gradients are clipped; and
	// AMP's precision, or fp32. A change to any of them starts everything over
	// (restart)
	const SCALES = [1, 10, 100, 1000];
	let surf, bottom, floor, brink, start, init = null, many = false, scale = 1, sigma = 0, schedule = 'constant', clip = false, amp = null;
	let starts; // where the runs start: the one start, or the init's draw for each seed
	// Each optimiser's: its η, an index into ETAS, at first PyTorch's lr; its
	// knobs, at first PyTorch's; whether it takes the sweep's best η; whether
	// its runs show; and the knob its card's map spans down, AdamW's and Muon's chosen on the card
	const settings = OPTIMISERS.map(o => ({
		...torchOf(o),
		tuned: false,
		shown: true,
		axis: o.knobs.length ? o.knobs[0].key : null,
	}));
	const one = () => starts.length === 1;
	// whether optimiser i is as PyTorch makes it
	const asTorch = i => {
		const s = settings[i], d = torchOf(OPTIMISERS[i]);
		return !s.tuned && s.eta === d.eta && Object.keys(d.k).every(key => s.k[key] === d.k[key]);
	};
	// the η past which plain SGD diverges at the lowest point, 2/λ, λ its
	// sharpness, as scaled with the loss
	const brinkOf = () => 2 / sharpness(surf, bottom) / scale;

	// ---- the runs ----
	const FAR = 50; // a run this far out has diverged
	const TOL = 1e-3; // a run has arrived once L − L* is under this
	const gap = ([x, y]) => Math.max(0, surf.L(x, y) - floor);
	// L − L* where a run ends, a diverged run's beyond any
	const end = r => (r.out ? Infinity : gap(r.at));
	// the gradient as the optimiser gets it: L's, scaled as the loss is
	const seen = g => (scale === 1 ? g : g.map(gi => gi * scale));
	// a run from s0 meeting the nth seed's noise, in a precision, AMP's unless
	// given, with the optimiser's memory, the steps it has taken, and its
	// GradScaler's multiple and the steps that skipped; keep: its path and
	// L − L* step by step
	function fresh(s0, n, keep, precision = amp) {
		return { at: s0, p: precision && PRECISIONS[precision], mem: { m: [0, 0], v: [0, 0] }, taken: 0, scaler: { scale: SCALE, good: 0 }, skips: [], random: seeded(1000 + n),
			path: keep ? [s0] : null, loss: keep ? [gap(s0)] : null, out: 0, arrive: gap(s0) < TOL ? 0 : -1 };
	}
	// the gradient run r takes at step t: its minibatch's, scaled as the loss
	// is, through autocast in its precision, then clipped; null if a GradScaler
	// skips the step
	function gradient(r, t) {
		const p = r.p;
		let g = surf.grad(...(p ? r.at.map(p.round) : r.at));
		if (sigma) g = g.map(gi => gi + sigma * normal(r.random));
		g = seen(g);
		if (p && p.scaler) {
			const s = r.scaler, scaled = g.map(gi => p.round(gi * s.scale));
			if (!scaled.every(isFinite)) {
				s.scale /= 2;
				s.good = 0;
				r.skips.push(t);
				return null;
			}
			g = scaled.map(gi => gi / s.scale);
			if (++s.good === GROWTH) {
				s.scale *= 2;
				s.good = 0;
			}
		} else if (p) g = g.map(p.round);
		if (!clip) return g;
		const cut = Math.min(1, CLIP / (Math.hypot(g[0], g[1]) + CLIP_EPS));
		return g.map(gi => gi * cut);
	}
	// optimiser i's run r takes step t at the rate, as the schedule scales it, with knobs k
	function step(r, i, rate, k, t) {
		if (r.out) return;
		const g = gradient(r, t);
		if (g) {
			const d = OPTIMISERS[i].step(g, r.mem, ++r.taken, k, surf.shape, r.at), lr = rate * SCHEDULES[schedule].at(t, surf.steps);
			r.at = [r.at[0] - lr * d[0], r.at[1] - lr * d[1]];
			if (Math.abs(r.at[0]) >= FAR || Math.abs(r.at[1]) >= FAR) {
				r.out = t;
				return;
			}
		}
		const v = gap(r.at);
		if (r.arrive < 0 && v < TOL) r.arrive = t;
		if (r.path) {
			r.path.push(r.at);
			r.loss.push(v);
		}
	}
	// optimiser i's run from the nth start, at the rate with knobs k, to the last step
	function runOut(i, rate, k, n, keep, precision) {
		const r = fresh(starts[n], n, keep, precision);
		for (let t = 1; t <= surf.steps; t++) step(r, i, rate, k, t);
		return r;
	}
	// its runs, one from each start
	const race = (i, rate, k, keep, precision) => starts.map((s0, n) => runOut(i, rate, k, n, keep, precision));

	// ---- work in the background ----
	// The sweep and the cards' maps race every optimiser to the end hundreds
	// of times, so each is a queue of jobs, a run each. The queues share BUDGET
	// ms a frame, the sweep's first, to keep the sliders live, and after a
	// frame each that worked is drawn(done)
	const BUDGET = 12, queues = [];
	let booked = false; // whether a frame's work is asked for
	// a queue, worked after those made before it, or before them all if first
	function queue(work, drawn, first = false) {
		const q = { jobs: [], work, drawn };
		if (first) queues.unshift(q);
		else queues.push(q);
		return {
			// more jobs, begun on in the next frame
			add(more) {
				q.jobs.push(...more);
				book();
			},
			drop(test) {
				q.jobs = q.jobs.filter(job => !test(job));
			},
			// as many as ms allows now; whether that was all
			lead(ms) {
				for (const t0 = performance.now(); q.jobs.length && performance.now() - t0 < ms;) work(q.jobs.shift());
				return !q.jobs.length;
			},
			// the rest now, for a step that cannot wait
			finish() {
				while (q.jobs.length) work(q.jobs.shift());
				drawn(true);
			},
		};
	}
	function book() {
		if (booked) return;
		booked = true;
		requestAnimationFrame(workAFrame);
	}
	function workAFrame() {
		booked = false;
		if (!root.isConnected) return;
		const t0 = performance.now();
		queues.forEach(q => {
			if (!q.jobs.length) return;
			while (q.jobs.length && performance.now() - t0 < BUDGET) q.work(q.jobs.shift());
			q.drawn(!q.jobs.length);
		});
		if (queues.some(q => q.jobs.length)) book();
	}

	// ---- the sweep ----
	// By optimiser and rate, the median L − L* at the end and arrival over the
	// starts, with the knobs as now set, from the ends and arrivals of the
	// runs so far; done, by optimiser, counts the rates run, in order; best,
	// each optimiser's rate once all are
	let sweep;
	const sweeper = queue(sweepRun, done => (done ? settled() : drawRates()));
	// every optimiser's sweep again, or only's, its knobs changed
	function resweep(only) {
		const which = only === undefined ? OPTIMISERS.map((o, i) => i) : [only];
		if (only === undefined) sweep = { gap: [], arrive: [], ends: [], arrivals: [], done: [] };
		which.forEach(i => {
			sweep.gap[i] = [];
			sweep.arrive[i] = [];
			sweep.ends[i] = ETAS.map(() => []);
			sweep.arrivals[i] = ETAS.map(() => []);
			sweep.done[i] = 0;
		});
		sweep.best = null;
		sweeper.drop(([e, i]) => which.includes(i));
		sweeper.add(ETAS.flatMap((_, e) => which.flatMap(i => starts.map((s0, n) => [e, i, n]))));
	}
	// one of the sweep's runs; with its rate's last start in, the medians
	function sweepRun([e, i, n]) {
		const r = runOut(i, ETAS[e], settings[i].k, n), ends = sweep.ends[i][e], arrivals = sweep.arrivals[i][e];
		ends.push(end(r));
		arrivals.push(r.arrive < 0 ? Infinity : r.arrive);
		if (ends.length < starts.length) return;
		sweep.gap[i][e] = median(ends);
		sweep.arrive[i][e] = median(arrivals);
		sweep.done[i] = e + 1;
	}
	// the sweep done: each optimiser's best rate, the lowest L − L* at the end,
	// FLOOR and under alike, then the earliest arrival; the tuned take it
	function settled() {
		if (sweep.best) return;
		const score = (i, e) => [Math.max(sweep.gap[i][e], FLOOR), sweep.arrive[i][e]];
		const better = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
		sweep.best = OPTIMISERS.map((o, i) => ETAS.reduce((b, _, e) => (better(score(i, e), score(i, b)) ? e : b), 0));
		settings.forEach((s, i) => {
			if (s.tuned) s.eta = sweep.best[i];
		});
		draw();
	}

	// ---- the cards' maps: L − L* at the last step over η across and a knob down ----
	const rowsOf = i => (settings[i].axis ? knobOf(i, settings[i].axis).values : [null]);
	const knobsAt = (i, row) => (settings[i].axis ? { ...settings[i].k, [settings[i].axis]: rowsOf(i)[row] } : settings[i].k);
	// by optimiser, row and rate, the median L − L* at the last step, and the ends of the runs so far
	const cells = [], tallies = [];
	const mapper = queue(([i, row, e, n]) => {
		const ends = tallies[i][row][e];
		ends.push(end(runOut(i, ETAS[e], knobsAt(i, row), n)));
		if (ends.length === starts.length) cells[i][row][e] = median(ends);
	}, drawHeats);
	// every optimiser's cells, or only's: its other knobs changed, and the
	// others' maps hold, as its own does when the knob it spans changes
	function regrid(only) {
		const which = only === undefined ? OPTIMISERS.map((o, i) => i) : [only];
		mapper.drop(([i]) => which.includes(i));
		which.forEach(i => {
			cells[i] = rowsOf(i).map(() => []);
			tallies[i] = rowsOf(i).map(() => ETAS.map(() => []));
		});
		mapper.add(which.flatMap(i => rowsOf(i).flatMap((_, row) => ETAS.flatMap((_, e) => starts.map((s0, n) => [i, row, e, n])))));
	}

	// ---- the race on screen: each optimiser's runs a step at a time, at its own η ----
	const RUN = 900; // frames a race takes, 15 s at 60 a second
	let runs, twins, t, due, playing = false;
	const runBtn = $('[data-act="run"]');
	function reset() {
		runs = OPTIMISERS.map(() => starts.map((s0, n) => fresh(s0, n, true)));
		// under AMP, the same runs in fp32, to draw beside them
		twins = amp && OPTIMISERS.map(() => starts.map((s0, n) => fresh(s0, n, true, null)));
		t = 0;
		due = 0;
	}
	function advance() {
		t++;
		const each = set => set.forEach((its, i) => its.forEach(r => step(r, i, ETAS[settings[i].eta], settings[i].k, t)));
		each(runs);
		if (twins) each(twins);
	}
	// whether a tuned optimiser waits on the sweep for its η
	const tuning = () => !sweep.best && settings.some(s => s.tuned);
	function tick() {
		if (!playing || !root.isConnected) return;
		// a share of a step a frame, and a step whenever the shares make one,
		// once every η is known
		if (!tuning()) due += REDUCED ? surf.steps : surf.steps / RUN;
		for (; due >= 1 && t < surf.steps; due--) advance();
		if (t >= surf.steps) play(false);
		drawRace();
		if (playing) requestAnimationFrame(tick);
	}
	function play(on) {
		const was = playing;
		playing = on;
		runBtn.innerHTML = on ? '&#10074;&#10074; Pause' : '&#9654; Run';
		runBtn.classList.toggle('on', on);
		if (!on || was) return;
		preview = null;
		requestAnimationFrame(tick);
	}
	// back to step 0, to wait there for Run, with no other settings' runs on show
	function rewind() {
		play(false);
		reset();
		preview = null;
		scrub = null;
		draw();
	}
	// a change to where the runs start or how they step: sweep again, map again, and wait at step 0
	function restart() {
		starts = !init ? [start] : Array.from({ length: many ? SEEDS : 1 }, (_, n) => sample(init, n + 1));
		resweep();
		regrid();
		rewind();
	}

	// ---- what the panes show ----
	let view = 'mesh', yaw = -0.7, pitch = 0.75; // the contours or the mesh, and how the mesh is turned
	const TURN = 0.01, PITCH = [0.15, 1.5]; // radians a pixel of drag turns the mesh, and how far it tips
	let preview = null; // every run at the rate the pointer is over on the sweep, run to the end, in place of runs
	let scrub = null; // the step the pointer is over on the loss pane
	let hover = null; // the card under the pointer, whose torch.optim call the status bar shows
	let tip = null; // what the status bar says of the point under the pointer, on the map or a card's
	const onShow = () => (preview ? preview.runs : runs);
	const twinsOnShow = () => (preview ? preview.twins : twins);

	// ---- the palettes ----
	// Each colours the map's bands of log(L − L*), low to high, through its
	// stops, the contour edges between them, darker, and the cards' maps,
	// deeper; its ink draws the marks on the map: the casing of a run's trail,
	// the init's draws, and the mesh. A gradation takes a published ramp of
	// several hues, light at the low end, and washes it over paper, lightly
	// behind the runs so they keep their colour, deeply in the cards' maps. The
	// chips go in this order, the first at the start
	const PAPER = [251, 250, 247];
	const wash = (stops, a) => stops.map(c => c.map((v, k) => Math.round(PAPER[k] * (1 - a) + v * a)));
	const gradation = (name, stops, ink, text) => ({ name, bands: wash(stops, 0.35), heat: wash(stops, 0.85), edge: 0.88, ink, text });
	const PALETTES = {
		// viridis remade to read the same under colour blindness (Nuñez et al.,
		// 2018), matplotlib's own (van der Walt and Smith, 2015), and seaborn's
		// rocket, cream through red to near black (Waskom, 2021)
		cividis: gradation('Cividis', [[254, 232, 56], [188, 175, 111], [124, 123, 120], [65, 77, 107], [0, 34, 78]], [20, 30, 50], '#4a4f5a'),
		paper: { name: 'Paper and ink', bands: [PAPER, [205, 200, 190]], heat: [PAPER, [122, 115, 104]], edge: 0.86, ink: [40, 36, 30], text: '#57524b' },
		viridis: gradation('Viridis', [[253, 231, 37], [94, 201, 98], [33, 145, 140], [59, 82, 139], [68, 1, 84]], [30, 30, 45], '#4a4a5a'),
		rocket: gradation('Rocket', [[250, 235, 221], [243, 118, 81], [203, 27, 79], [97, 31, 83], [3, 5, 26]], [45, 15, 30], '#5a4a50'),
	};
	const BANDS = 14, BODY = 64, BODY_DEPTH = 0.2; // the contours' bands; the mesh's shades, a smooth run of them, and how deep
	const css = c => 'rgb(' + c.join(',') + ')';
	const ramp = (stops, f) => {
		const x = f * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(x)), u = x - k;
		return stops[k].map((v, j) => Math.round(v + (stops[k + 1][j] - v) * u));
	};
	let palette; // the palette in use, as the panes take it
	function paint(key) {
		const p = PALETTES[key], ink = a => 'rgba(' + p.ink.join(', ') + ', ' + a + ')';
		const banded = stops => Array.from({ length: BANDS }, (_, b) => ramp(stops, b / (BANDS - 1)));
		const fills = banded(p.bands);
		palette = {
			key, fills,
			edges: fills.map(c => c.map(v => Math.round(v * p.edge))),
			heats: banded(p.heat),
			// the mesh's, a little deeper than the bands' wash, BODY_DEPTH of the way to the heat's
			body: Array.from({ length: BODY }, (_, n) => {
				const f = n / (BODY - 1), a = ramp(p.bands, f), b = ramp(p.heat, f);
				return a.map((v, j) => Math.round(v + (b[j] - v) * BODY_DEPTH));
			}),
			text: p.text,
			casing: ink(0.5),
			cloud: ink(0.5),
			mesh: ink(0.18),
		};
	}

	// ---- the map: log(L − L*) in bands, pale at the bottom ----
	let level; // a loss from 0 at L* to 1 at the box's highest, on a log scale
	function shading() {
		const [x0, x1, y0, y1] = surf.box;
		let top = 0;
		for (let i = 0; i <= 60; i++) for (let j = 0; j <= 60; j++) top = Math.max(top, surf.L(x0 + (x1 - x0) * i / 60, y0 + (y1 - y0) * j / 60) - floor);
		const delta = top * 10 ** -surf.decades, h0 = Math.log10(delta), h1 = Math.log10(top + delta);
		level = v => Math.min(1, (Math.log10(Math.max(0, v - floor) + delta) - h0) / (h1 - h0));
	}
	const shade = v => Math.min(BANDS - 1, Math.floor(level(v) * BANDS));

	// ---- the map: contours ----
	// the charts' ink, the map's being the palette's. A casing, a thin edge
	// each side of a run's trail, keeps even Okabe and Ito's orange, 2.2:1 on
	// white paper, clear of every band
	const INK = { grid: '#ebe8e2', text: '#57524b', schedule: '#aaa59c', diverged: '#c58f7f', casing: 'rgba(40, 36, 30, 0.5)', start: '#000000', box: 'rgba(255, 255, 255, 0.9)' };
	const FONT = '11px ' + getComputedStyle(root).fontFamily, SMALL = '9px ' + getComputedStyle(root).fontFamily;
	const HINT = 19; // the hint at the map's foot sits in a band this high
	// The contours: their bands, a pixel per screen pixel, worked out a strip
	// of STRIP rows a job, as many as LEAD ms allows at once and the rest in
	// the background ahead of the sweep, the map paper until they are done;
	// then painted, again only when the palette changes. They are kept while
	// the surface and the pane's size hold; while a grip-resize goes on, the
	// last stretch, and are worked out again once the size has rested SETTLE ms
	const STRIP = 8, LEAD = 40, SETTLE = 150;
	let backdrop = null, working = null; // the contours shown, and those being worked out
	let wanted = null, settling = null; // the size they are for, and the wait for it to rest
	const contourer = queue(j0 => {
		const { bands: { w, h, band }, x, y } = working;
		for (let j = j0; j < Math.min(j0 + STRIP, h); j++) {
			const yj = y(j);
			for (let i = 0; i < w; i++) band[j * w + i] = shade(surf.L(x(i), yj));
		}
	}, done => {
		if (!done || !working) return;
		backdrop = working;
		working = null;
		drawMap();
	}, true);
	// the contours for a pane W × H set going, and taken now if they are quick
	function rework(W, H) {
		const dpr = window.devicePixelRatio || 1, f = frame(W, H), w = Math.round(W * dpr), h = Math.round(H * dpr);
		working = { surf: surf.key, bands: { w, h, band: new Uint8Array(w * h) }, x: i => f.x((i + 0.5) / dpr), y: j => f.y((j + 0.5) / dpr) };
		contourer.drop(() => true);
		contourer.add(Array.from({ length: Math.ceil(h / STRIP) }, (_, k) => k * STRIP));
		if (!contourer.lead(LEAD)) return;
		backdrop = working;
		working = null;
	}
	// the contours' image for a pane W × H, or null while they are first worked out
	function contoured(W, H) {
		const size = W + 'x' + H;
		if (!backdrop && !working) {
			wanted = size;
			rework(W, H);
		} else if (size !== wanted) {
			wanted = size;
			clearTimeout(settling);
			settling = setTimeout(() => {
				if (!root.isConnected) return;
				rework(map.clientWidth, map.clientHeight);
				drawMap();
			}, SETTLE);
		}
		if (backdrop && backdrop.palette !== palette.key) Object.assign(backdrop, { palette: palette.key, image: painted(backdrop.bands) });
		return backdrop && backdrop.image;
	}
	// a new surface's contours, worked out when they are drawn
	function uncontour() {
		contourer.drop(() => true);
		backdrop = working = null;
	}
	let lows; // where the lowest points run, in the box, null between where they leave it
	// whether a point of θ is in the box drawn
	const inBox = ([x, y]) => x >= surf.box[0] && x <= surf.box[1] && y >= surf.box[2] && y <= surf.box[3];
	// the box at one scale on both axes, so right angles stay right, centred
	// in the pane and widened to fill it
	function frame(W, H) {
		const [x0, x1, y0, y1] = surf.box, k = Math.min(W / (x1 - x0), H / (y1 - y0));
		const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
		return { X: x => W / 2 + (x - mx) * k, Y: y => H / 2 - (y - my) * k, x: px => mx + (px - W / 2) / k, y: py => my - (py - H / 2) / k };
	}
	// the band of each of w × h pixels, pixel (i, j) at θ = (x(i), y(j))
	function bandsAt(w, h, x, y) {
		const band = new Uint8Array(w * h);
		for (let j = 0; j < h; j++) {
			const yj = y(j);
			for (let i = 0; i < w; i++) band[j * w + i] = shade(surf.L(x(i), yj));
		}
		return { w, h, band };
	}
	// bands in the palette's colours, each pixel its band's fill, or its edge where the band changes
	function painted({ w, h, band }) {
		const img = new ImageData(w, h);
		for (let p = 0; p < w * h; p++) {
			const b = band[p], edge = (p % w < w - 1 && band[p + 1] !== b) || (p + w < w * h && band[p + w] !== b);
			img.data.set(edge ? palette.edges[b] : palette.fills[b], p * 4);
			img.data[p * 4 + 3] = 255;
		}
		const cv = document.createElement('canvas');
		cv.width = w;
		cv.height = h;
		cv.getContext('2d').putImageData(img, 0, 0);
		return cv;
	}

	// ---- the map: the mesh, turned by yaw about the vertical and tipped by pitch towards the eye ----
	// A solid, lit by a light over the viewer's left shoulder: a quad's shade is
	// AMBIENT, and DIFFUSE more as it faces the light, and a GLEAM of
	// highlight as it mirrors the light to the eye (Blinn, 1977); its colour the
	// palette's body at its height; a line along every GRID-th row and column of
	// its MESH × MESH quads. Under it, BASE below its lowest point, the floor:
	// the contours, and each run's shadow on them
	const MESH = 72, GRID = 4, RISE = 0.45, BASE = 0.1, BASE_PX = 256;
	const AMBIENT = 0.68, DIFFUSE = 0.38, GLEAM = 0.18, GLOSS = 24, SHADOW = 0.6;
	const unit = v => {
		const n = Math.hypot(...v);
		return v.map(c => c / n);
	};
	const dot3 = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
	const LIGHT = unit([-0.45, -0.35, 0.82]); // in the view's terms: to the left, towards the viewer, and up
	let mesh; // the loss at the mesh's corners, for this surface
	function meshing() {
		const [x0, x1, y0, y1] = surf.box;
		mesh = Array.from({ length: MESH + 1 }, (_, i) => Array.from({ length: MESH + 1 }, (_, j) => {
			const x = x0 + (x1 - x0) * i / MESH, y = y0 + (y1 - y0) * j / MESH;
			return [x, y, surf.L(x, y)];
		}));
	}
	// A point of θ into the view: across the screen, along the ground away
	// from the eye, and up, as high as its loss; the view to the screen, with
	// its depth, larger further away. at: a point at its loss's height on the
	// screen; floor: on the floor; eye: towards the viewer
	function lens(W, H) {
		const [x0, x1, y0, y1] = surf.box, side = Math.max(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
		const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
		const k = Math.min(W / 1.45, H / (1.42 * sp + (RISE + BASE) * cp + 0.06));
		const view = (x, y, z) => {
			const u = (x - mx) / side, w = (y - my) / side;
			return [u * cy - w * sy, u * sy + w * cy, z];
		};
		const screen = ([a, b, z]) => [W / 2 + a * k, H / 2 - (b * sp + (z + BASE / 2) * cp) * k, b * cp - z * sp];
		const height = v => (level(v) - 0.5) * RISE;
		return { view, screen, height, eye: [0, -cp, sp],
			at: (x, y, v) => screen(view(x, y, height(v))), floor: (x, y) => screen(view(x, y, -RISE / 2 - BASE)) };
	}
	// The floor and the mesh as last drawn, each on a canvas of its own, kept
	// while the pane's size, the turn, the surface and the palette hold; and
	// the floor's contours, their bands while the surface holds and their
	// image while the palette does too
	let solid = null, ground = null;
	function solids(W, H) {
		const key = [W, H, yaw, pitch, surf.key, palette.key].join(' ');
		if (!solid || solid.key !== key) {
			const P = lens(W, H);
			solid = { key, P, floor: layer(W, H, cx => drawFloor(cx, P)), mesh: layer(W, H, cx => drawMesh(cx, P)) };
		}
		return solid;
	}
	// a canvas the pane's size at its pixel ratio, drawn on by fill
	function layer(W, H, fill) {
		const dpr = window.devicePixelRatio || 1, cv = document.createElement('canvas');
		cv.width = Math.round(W * dpr);
		cv.height = Math.round(H * dpr);
		const cx = cv.getContext('2d');
		cx.setTransform(dpr, 0, 0, dpr, 0, 0);
		fill(cx);
		return cv;
	}
	// the contours, BASE_PX a side over the box, laid on the floor
	function drawFloor(cx, P) {
		const [x0, x1, y0, y1] = surf.box, n = BASE_PX;
		if (!ground || ground.surf !== surf.key) ground = { surf: surf.key, bands: bandsAt(n, n, i => x0 + (x1 - x0) * (i + 0.5) / n, j => y1 - (y1 - y0) * (j + 0.5) / n) };
		if (ground.palette !== palette.key) Object.assign(ground, { palette: palette.key, image: painted(ground.bands) });
		const o = P.floor(x0, y1), ex = P.floor(x1, y1), ey = P.floor(x0, y0);
		cx.save();
		cx.transform((ex[0] - o[0]) / n, (ex[1] - o[1]) / n, (ey[0] - o[0]) / n, (ey[1] - o[1]) / n, o[0], o[1]);
		cx.drawImage(ground.image, 0, 0);
		cx.restore();
	}
	// the mesh, the furthest quads first so the nearer cover them
	function drawMesh(cx, P) {
		const n = MESH, half = unit(LIGHT.map((l, j) => l + P.eye[j]));
		const at = mesh.map(col => col.map(([x, y, v]) => P.view(x, y, P.height(v)))), on = at.map(col => col.map(P.screen));
		const quads = [];
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				const c = [on[i][j], on[i + 1][j], on[i + 1][j + 1], on[i][j + 1]];
				const v = (mesh[i][j][2] + mesh[i + 1][j][2] + mesh[i + 1][j + 1][2] + mesh[i][j + 1][2]) / 4;
				// the quad's normal, across its diagonals, and how it takes the light
				const p = at[i][j], q = at[i + 1][j], r = at[i + 1][j + 1], s = at[i][j + 1];
				const d = [r[0] - p[0], r[1] - p[1], r[2] - p[2]], e = [s[0] - q[0], s[1] - q[1], s[2] - q[2]];
				const normal = unit([d[1] * e[2] - d[2] * e[1], d[2] * e[0] - d[0] * e[2], d[0] * e[1] - d[1] * e[0]]);
				const lit = AMBIENT + DIFFUSE * Math.max(0, dot3(normal, LIGHT)), gleam = 255 * GLEAM * Math.max(0, dot3(normal, half)) ** GLOSS;
				const colour = palette.body[Math.round(level(v) * (BODY - 1))].map(ch => Math.min(255, Math.round(ch * lit + gleam)));
				quads.push({ c, i, j, depth: c.reduce((sum, p) => sum + p[2], 0), fill: css(colour) });
			}
		}
		quads.sort((p, q) => q.depth - p.depth);
		const edge = (p, q) => {
			cx.moveTo(p[0], p[1]);
			cx.lineTo(q[0], q[1]);
		};
		quads.forEach(({ c, i, j, fill }) => {
			// filled, and edged in its own colour to close the seams between quads
			cx.fillStyle = cx.strokeStyle = fill;
			cx.lineWidth = 0.6;
			cx.beginPath();
			c.forEach((p, m) => (m ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])));
			cx.closePath();
			cx.fill();
			cx.stroke();
			// then the mesh's lines along its edges that lie on the grid
			cx.strokeStyle = palette.mesh;
			cx.beginPath();
			if (i % GRID === 0) edge(c[0], c[3]);
			if (j % GRID === 0) edge(c[0], c[1]);
			if (i + 1 === n) edge(c[1], c[2]);
			if (j + 1 === n) edge(c[3], c[2]);
			cx.stroke();
		});
	}
	// each run's shadow on the floor, to the scrubbed step if one is, its ink rationed as its trail's is
	function shadows(cx, to, reach) {
		const upto = scrub ?? Infinity;
		cx.strokeStyle = palette.casing;
		cx.lineWidth = 1.2;
		onShow().forEach((its, i) => {
			if (!settings[i].shown) return;
			its.forEach(r => {
				const on = r.path.slice(0, Math.min(r.path.length - 1, upto) + 1).map(to);
				cx.globalAlpha = SHADOW * presence(i) * rationed(i, reach / inked(on));
				line(cx, on);
				cx.stroke();
			});
		});
		cx.globalAlpha = 1;
	}

	// ---- the map: the runs on it ----
	// an arrow ARROW pixels long from p along the direction d in θ, which on
	// the contours is d with y turned down
	const ARROW = 26;
	function arrow(cx, p, d, colour, dash) {
		const n = Math.hypot(d[0], d[1]);
		if (!n) return;
		const ux = d[0] / n, uy = -d[1] / n, x = p[0] + ux * ARROW, y = p[1] + uy * ARROW;
		cx.strokeStyle = colour;
		cx.lineWidth = 1.4;
		cx.setLineDash(dash);
		cx.beginPath();
		cx.moveTo(p[0], p[1]);
		cx.lineTo(x, y);
		cx.stroke();
		cx.setLineDash([]);
		cx.beginPath();
		cx.moveTo(x - 6 * ux + 3.5 * uy, y - 6 * uy - 3.5 * ux);
		cx.lineTo(x, y);
		cx.lineTo(x - 6 * ux - 3.5 * uy, y - 6 * uy + 3.5 * ux);
		cx.stroke();
	}
	// a path through points on the pane, broken where one is null
	function line(cx, on) {
		cx.beginPath();
		let down = false;
		on.forEach(q => {
			if (q && down) cx.lineTo(q[0], q[1]);
			else if (q) cx.moveTo(q[0], q[1]);
			down = !!q;
		});
	}
	// a path through points of θ, as to puts them on the pane, null off it
	const trace = (cx, points, to) => line(cx, points.map(p => p && to(p)));
	function dot(cx, x, y, r, colour, filled, ring = INK.casing) {
		cx.fillStyle = filled ? colour : '#ffffff';
		cx.strokeStyle = filled ? ring : colour;
		cx.lineWidth = filled ? 1 : 1.5;
		cx.beginPath();
		cx.arc(x, y, r, 0, 2 * Math.PI);
		cx.fill();
		cx.stroke();
	}
	// an × with arms r long, in the ink set
	function cross(cx, x, y, r) {
		cx.beginPath();
		cx.moveTo(x - r, y - r);
		cx.lineTo(x + r, y + r);
		cx.moveTo(x + r, y - r);
		cx.lineTo(x - r, y + r);
		cx.stroke();
	}
	// ---- the trails' ink, as the panes share it ----
	// A trail is drawn fainter the longer it runs on its pane, down to FAINT, so
	// a run that thrashes reads as a tint and leaves the others clear; the
	// busiest go underneath; and the card under the pointer brings its own
	// forward, whole and on top, and dims the others to DIM
	const FAINT = 0.3, DIM = 0.15;
	// a line's length on the pane, through its points there, null off it
	function inked(on) {
		let n = 0, q0 = null;
		on.forEach(q => {
			if (q && q0) n += Math.hypot(q[0] - q0[0], q[1] - q0[1]);
			q0 = q;
		});
		return n;
	}
	// how much of optimiser i shows: all, or DIM while another's card is under the pointer
	const presence = i => (hover !== null && hover !== i ? DIM : 1);
	// the share of its ink a trail of optimiser i keeps, k being its pane's reach over its length
	const rationed = (i, k) => (hover === i ? 1 : Math.min(1, Math.max(FAINT, k)));
	// the order to draw them in: the busiest first, underneath, and the card's under the pointer last
	const layered = list => list.slice().sort((a, b) => b.ink - a.ink).sort((a, b) => (a.i === hover) - (b.i === hover));
	// where a trail leaves the picture: the point of its segment from a, inside, to b, outside, still just inside, by bisection
	function exit(a, b, inside) {
		for (let k = 0; k < 16; k++) {
			const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
			if (inside(m)) a = m;
			else b = m;
		}
		return a;
	}
	function drawMap() {
		const { cx, W, H } = fitCanvas(map);
		if (!W || !H) return;
		// a point of θ to the pane, or null off the mesh; on the mesh at L − L* = g if that is known
		let to;
		if (view === 'flat') {
			const image = contoured(W, H);
			cx.fillStyle = css(PAPER);
			if (image) cx.drawImage(image, 0, 0, W, H);
			else cx.fillRect(0, 0, W, H);
			const f = frame(W, H);
			to = ([x, y]) => [f.X(x), f.Y(y)];
		} else {
			// the mesh holds only the box, so a run outside it leaves the picture;
			// round it, paper, and under it the floor, each run's shadow on that
			cx.fillStyle = css(PAPER);
			cx.fillRect(0, 0, W, H);
			const S = solids(W, H);
			cx.drawImage(S.floor, 0, 0, W, H);
			shadows(cx, p => (inBox(p) ? S.P.floor(p[0], p[1]) : null), Math.hypot(W, H));
			cx.drawImage(S.mesh, 0, 0, W, H);
			to = (p, g) => (inBox(p) ? S.P.at(p[0], p[1], g === undefined ? surf.L(p[0], p[1]) : floor + g) : null);
		}
		const inside = p => {
			const q = to(p);
			return !!q && q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= H;
		};
		// paused on the contours, each head points its next step, without the
		// noise, against plain downhill: Momentum's memory and the rescaling of
		// RMSProp and Adam turn it off the gradient
		const pointing = view === 'flat' && !playing && !preview && scrub === null && one() && t > 0 && t < surf.steps;
		// the init's draws for its first CLOUD seeds, faint, so its spread shows round the ones run
		if (init) {
			cx.fillStyle = palette.cloud;
			for (let n = 1; n <= CLOUD; n++) {
				const p = to(sample(init, n));
				if (p) cx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
			}
		}
		// the lowest point, a cross haloed white, named; where they make a line, it dashed
		const low = to(bottom);
		if (lows) {
			cx.strokeStyle = palette.text;
			cx.lineWidth = 1;
			cx.setLineDash([4, 3]);
			trace(cx, lows, to);
			cx.stroke();
			cx.setLineDash([]);
		} else if (low) {
			[[INK.box, 3], [palette.text, 1]].forEach(([colour, width]) => {
				cx.strokeStyle = colour;
				cx.lineWidth = width;
				cx.beginPath();
				cx.moveTo(low[0] - 5, low[1]);
				cx.lineTo(low[0] + 5, low[1]);
				cx.moveTo(low[0], low[1] - 5);
				cx.lineTo(low[0], low[1] + 5);
				cx.stroke();
			});
		}
		if (low) {
			cx.font = SMALL;
			cx.fillStyle = palette.text;
			cx.textAlign = 'left';
			cx.fillText('L*', low[0] + 5, low[1] - 4);
		}
		// the starts, hollow squares
		cx.strokeStyle = INK.start;
		cx.lineWidth = 1;
		starts.forEach(s0 => {
			const p = to(s0), r = one() ? 3.5 : 2.5;
			if (p) cx.strokeRect(p[0] - r, p[1] - r, 2 * r, 2 * r);
		});
		// each run's trail, to the scrubbed step if one is, its ink rationed
		// against the pane's diagonal; then, over every trail, each head there,
		// or the × of a run that diverged
		const upto = scrub ?? Infinity, reach = Math.hypot(W, H), marks = [];
		// each run's points on the pane, the mesh's heights from the L − L* it kept at each step
		const trails = onShow().flatMap((its, i) => (settings[i].shown ? its.map(r => {
			const last = Math.min(r.path.length - 1, upto), on = r.path.slice(0, last + 1).map((p, k) => to(p, r.loss[k]));
			return { i, r, last, on, ink: inked(on) };
		}) : []));
		layered(trails).forEach(({ i, r, last, on, ink }) => {
			const o = OPTIMISERS[i];
			// one run cased in ink; many, faint and bare, so their spread reads
			cx.globalAlpha = presence(i) * rationed(i, reach / ink) * (one() ? 1 : 0.45);
			line(cx, on);
			if (one()) {
				cx.strokeStyle = palette.casing;
				cx.lineWidth = 3.4;
				cx.stroke();
			}
			cx.strokeStyle = o.colour;
			cx.lineWidth = one() ? 1.6 : 1;
			cx.stroke();
			cx.globalAlpha = 1;
			marks.push(() => {
				cx.globalAlpha = presence(i);
				// a run that has diverged ends in an × where its trail left the picture, or at its end if it never did
				if (r.out && last === r.path.length - 1) {
					let j = last;
					while (j >= 0 && !inside(r.path[j])) j--;
					const p = j < 0 ? null : to(j === last ? r.path[last] : exit(r.path[j], r.path[j + 1], inside));
					if (p) {
						const x = Math.min(W - 6, Math.max(6, p[0])), y = Math.min(H - HINT - 6, Math.max(6, p[1])); // kept in the pane, above the hint
						[[INK.box, 3.5], [o.colour, 1.5]].forEach(([colour, width]) => {
							cx.strokeStyle = colour;
							cx.lineWidth = width;
							cross(cx, x, y, 4);
						});
					}
				} else {
					const head = on[last];
					if (head && pointing) {
						const g = seen(surf.grad(...r.at)), mem = { m: r.mem.m.slice(), v: r.mem.v.slice() };
						arrow(cx, head, [-g[0], -g[1]], palette.text, [3, 2]);
						arrow(cx, head, o.step(g, mem, r.taken + 1, settings[i].k, surf.shape, r.at).map(d => -d), o.colour, []);
					}
					if (head) dot(cx, head[0], head[1], one() ? 3.5 : 2.5, o.colour, true, palette.casing);
				}
				cx.globalAlpha = 1;
			});
		});
		marks.forEach(f => f());
		const from = init && (init === 'zero' ? 'init 0: θ = 0' : INITS[init].name + ': θ ~ ' + INITS[init].law(surf.shape.fans) + ', '
			+ (many ? SEEDS + ' seeds' : 'one seed, dots more'));
		const hint = pointing ? 'paused · solid: its next step · dashed: downhill, −∇L'
			: view === 'flat' ? (from || 'bands of log(L − L*)') + ' · click to start there' : from || 'height log(L − L*) · drag to turn';
		cx.font = FONT;
		cx.fillStyle = INK.box;
		cx.fillRect(4, H - HINT, cx.measureText(hint).width + 10, 15);
		cx.fillStyle = palette.text;
		cx.textAlign = 'left';
		cx.fillText(hint, 9, H - 8);
	}

	// ---- the loss pane and the sweep: L − L* up a log axis ----
	const EDGE = [40, 10, 18, 22]; // margins: left, right, top and bottom
	const LOSS_REACH = 1.5; // a loss line this many widths of its pane long keeps all its ink
	const SKIP = 5; // a skipped step's tick
	// whole decades up the pane round lo to hi, labelled every few, TOL's dashed;
	// returns the y of a gap, held to the pane, a diverged run's at the top
	function decades(cx, W, H, lo, hi) {
		const [L, R, T, B] = EDGE;
		if (!isFinite(lo)) lo = hi = 1;
		const d1 = Math.ceil(Math.log10(Math.max(hi, 10 * FLOOR))), d0 = Math.min(d1 - 2, Math.floor(Math.log10(Math.max(lo, FLOOR))));
		const Y = v => Math.min(H - B, Math.max(T, T + (d1 - Math.log10(Math.max(v, FLOOR))) / (d1 - d0) * (H - T - B)));
		cx.font = FONT;
		cx.lineWidth = 1;
		cx.fillStyle = INK.text;
		cx.textAlign = 'right';
		const every = Math.ceil((d1 - d0) / 6);
		for (let d = d1; d >= d0; d--) {
			const tol = d === Math.log10(TOL);
			cx.strokeStyle = tol ? INK.text : INK.grid;
			cx.setLineDash(tol ? [2, 3] : []);
			cx.beginPath();
			cx.moveTo(L, Y(10 ** d));
			cx.lineTo(W - R, Y(10 ** d));
			cx.stroke();
			if ((d1 - d) % every === 0) cx.fillText(power(d), L - 6, Y(10 ** d) + 4);
		}
		cx.setLineDash([]);
		return Y;
	}
	function title(cx, text) {
		cx.fillStyle = INK.text;
		cx.textAlign = 'left';
		cx.fillText(text, EDGE[0], 12);
	}
	// the lowest and highest finite values among the lists
	function bounds(lists) {
		let lo = Infinity, hi = 0;
		lists.forEach(vs => vs.forEach(v => {
			if (!isFinite(v)) return;
			lo = Math.min(lo, v);
			hi = Math.max(hi, v);
		}));
		return [lo, hi];
	}
	// a dashed upright at x, from y0 down to y1
	function dashed(cx, x, y0, y1, dash, colour = INK.text) {
		cx.strokeStyle = colour;
		cx.lineWidth = 1;
		cx.setLineDash(dash);
		cx.beginPath();
		cx.moveTo(x, y0);
		cx.lineTo(x, y1);
		cx.stroke();
		cx.setLineDash([]);
	}

	// the step under a point across the loss pane
	const stepAt = px => Math.min(t, Math.max(0, Math.round((px - EDGE[0]) / (plot.clientWidth - EDGE[0] - EDGE[1]) * surf.steps)));
	// step by step over a set of runs: the lowest, the median and the highest
	// L − L*, a diverged run's beyond any
	function bandOf(its) {
		const len = Math.max(...its.map(r => r.loss.length)), lo = [], mid = [], hi = [];
		for (let n = 0; n < len; n++) {
			const vs = its.map(r => r.loss[n] ?? Infinity).sort((a, b) => a - b);
			lo.push(vs[0]);
			mid.push(vs[vs.length >> 1]);
			hi.push(vs[vs.length - 1]);
		}
		return { lo, mid, hi };
	}
	function drawLoss() {
		const { cx, W, H } = fitCanvas(plot), [L, R, T, B] = EDGE;
		const shown = (set, f) => set.map((its, i) => (settings[i].shown ? f(its) : null));
		// each optimiser's spread, and under AMP its median in fp32
		const spreads = shown(onShow(), bandOf), pale = twinsOnShow() ? shown(twinsOnShow(), its => bandOf(its).mid) : [];
		// the decades the medians span; a band beyond them is cut at the pane's edge
		const mids = [...spreads.filter(Boolean).map(s => s.mid), ...pale.filter(Boolean)];
		const X = n => L + n / surf.steps * (W - L - R), Y = decades(cx, W, H, ...bounds(mids));
		[0, 0.5, 1].forEach((k, i) => {
			cx.textAlign = ['left', 'center', 'right'][i];
			cx.fillText(fmt(k * surf.steps), X(k * surf.steps), H - 6);
		});
		// the schedule's share of η, from the pane's foot at 0 to its top at 1
		const scheduled = schedule !== 'constant';
		if (scheduled) {
			cx.strokeStyle = INK.schedule;
			cx.lineWidth = 1;
			cx.setLineDash([4, 3]);
			cx.beginPath();
			for (let n = 1; n <= surf.steps; n++) {
				const y = H - B - SCHEDULES[schedule].at(n, surf.steps) * (H - T - B);
				n > 1 ? cx.lineTo(X(n), y) : cx.moveTo(X(n), y);
			}
			cx.stroke();
			cx.setLineDash([]);
		}
		// the steps a GradScaler skipped, ticked up from the foot and named after the last, haloed
		const skipped = [...new Set(onShow().flatMap((its, i) => (settings[i].shown ? its.flatMap(r => r.skips) : [])))];
		if (skipped.length) {
			cx.strokeStyle = INK.text;
			cx.beginPath();
			skipped.forEach(n => {
				cx.moveTo(X(n) + 0.5, H - B);
				cx.lineTo(X(n) + 0.5, H - B - SKIP);
			});
			cx.stroke();
			const x = X(Math.max(...skipped)) + 4, y = H - B - 1;
			cx.font = SMALL;
			cx.textAlign = 'left';
			cx.strokeStyle = INK.box;
			cx.lineWidth = 3;
			cx.strokeText('skipped', x, y);
			cx.fillStyle = INK.text;
			cx.fillText('skipped', x, y);
			cx.font = FONT;
		}
		// fp32's medians, pale and wide, beneath
		const point = ([n, v]) => [X(n), Y(v)];
		cx.lineWidth = 3;
		pale.forEach((mid, i) => {
			if (!mid) return;
			cx.globalAlpha = 0.3 * presence(i);
			cx.strokeStyle = OPTIMISERS[i].colour;
			line(cx, mid.map((v, n) => point([n, v])));
			cx.stroke();
		});
		cx.globalAlpha = 1;
		// the band from lowest to highest, then the median, or the one run's
		// line, its ink rationed against LOSS_REACH widths of the pane
		const reach = LOSS_REACH * (W - L - R);
		layered(spreads.flatMap((s, i) => (s ? [{ i, s, ink: inked(s.mid.map((v, n) => point([n, v]))) }] : []))).forEach(({ i, s, ink }) => {
			const colour = OPTIMISERS[i].colour, a = presence(i) * rationed(i, reach / ink);
			if (!one()) {
				cx.fillStyle = colour;
				cx.globalAlpha = 0.15 * a;
				cx.beginPath();
				s.lo.forEach((v, n) => (n ? cx.lineTo(X(n), Y(v)) : cx.moveTo(X(n), Y(v))));
				for (let n = s.hi.length - 1; n >= 0; n--) cx.lineTo(X(n), Y(s.hi[n]));
				cx.closePath();
				cx.fill();
			}
			cx.globalAlpha = a;
			cx.strokeStyle = colour;
			cx.lineWidth = 1.3;
			line(cx, s.mid.map((v, n) => point([n, v])));
			cx.stroke();
			// a diverged run an × at the top, at the step it went
			cx.globalAlpha = presence(i);
			onShow()[i].forEach(r => r.out && cross(cx, X(r.out), T, 3));
			cx.globalAlpha = 1;
		});
		if (scrub !== null) dashed(cx, X(scrub), T, H - B, [3, 2]);
		title(cx, 'L − L* by step' + (one() ? '' : ', the median of ' + SEEDS + ' seeds, the band all of them') + (pale.length ? ' · pale: fp32' : '')
			+ (scheduled ? ' · dashed: η’s share' : ''));
	}

	// the rate under a point across the sweep
	const rateAt = px => Math.min(ETAS.length - 1, Math.max(0, Math.round((px - EDGE[0]) / (rates.clientWidth - EDGE[0] - EDGE[1]) * (ETAS.length - 1))));
	function drawRates() {
		const { cx, W, H } = fitCanvas(rates), [L, R, T, B] = EDGE;
		const lg = Math.log10, e0 = lg(ETAS[0]), e1 = lg(ETAS[ETAS.length - 1]);
		const X = rate => L + (lg(rate) - e0) / (e1 - e0) * (W - L - R);
		const Y = decades(cx, W, H, ...bounds(sweep.gap.filter((gs, i) => settings[i].shown)));
		for (let d = e0; d <= e1; d++) {
			cx.textAlign = d === e0 ? 'left' : d === e1 ? 'right' : 'center';
			cx.fillText(decade(10 ** d), X(10 ** d), H - 6);
		}
		// where SGD diverges at the lowest point, η = 2/λ, dashed in its colour,
		// named on its left at the pane's right edge
		if (brink >= ETAS[0] && brink <= ETAS[ETAS.length - 1]) {
			const x = X(brink), edge = x > W - R - 20;
			dashed(cx, x, T, H - B, [1, 2], OPTIMISERS[0].colour);
			cx.font = SMALL;
			cx.fillStyle = INK.text;
			cx.textAlign = edge ? 'right' : 'left';
			cx.fillText('2/λ', x + (edge ? -3 : 3), H - B - 3);
			cx.font = FONT;
		}
		// each optimiser's curve over the rates run so far, a diverged end an × at the top
		layered(sweep.gap.map((gs, i) => ({ i, gs, ink: 0 }))).forEach(({ i, gs }) => {
			if (!settings[i].shown) return;
			cx.globalAlpha = presence(i);
			cx.strokeStyle = OPTIMISERS[i].colour;
			cx.lineWidth = 1.3;
			line(cx, gs.map((v, e) => [X(ETAS[e]), Y(v)]));
			cx.stroke();
			gs.forEach((v, e) => isFinite(v) || cross(cx, X(ETAS[e]), T, 3));
			cx.globalAlpha = 1;
		});
		// a dot at each one's η, filled at its best, a tuned one's once it is known
		settings.forEach((s, i) => {
			if (s.shown && s.eta < sweep.done[i] && (!s.tuned || sweep.best)) {
				cx.globalAlpha = presence(i);
				dot(cx, X(ETAS[s.eta]), Y(sweep.gap[i][s.eta]), 3.5, OPTIMISERS[i].colour, !!sweep.best && sweep.best[i] === s.eta);
				cx.globalAlpha = 1;
			}
		});
		// dotted, the rate the pointer is over
		if (preview) dashed(cx, X(ETAS[preview.e]), T, H - B, [2, 3]);
		title(cx, 'L − L* at step ' + fmt(surf.steps) + ' by η · dots: each one’s η, filled at its best');
	}

	// ---- the cards: an optimiser each ----
	// Its name, which shows or hides its runs; its readings; its η and knobs on
	// sliders, ticked at each value, PyTorch's default long; and at its foot
	// its map, L − L* at the last step over η across and one knob down,
	// outlined where the sliders are. A slider moves the outline, a click on
	// the map moves the sliders
	const ticks = (n, torch) => Array.from({ length: n }, (_, k) => (k === torch ? '<i class="torch"></i>' : '<i></i>')).join('');
	const slider = (sym, data, n, torch) => '<dd class="opt-knob" ' + data + '><span>' + sym + '</span><span class="opt-track"><input type="range" min="0" max="' + (n - 1) + '">'
		+ '<span class="opt-ticks">' + ticks(n, torch) + '</span></span><output></output></dd>';
	const cardHtml = o => '<div class="opt-card"><dt><button type="button" class="opt-name"><i class="exe-sw" style="background:' + o.colour + '"></i>' + o.name + '</button>'
		+ (o.knobs.length > 1 ? '<button type="button" class="opt-axis" title="The knob the map spans down"></button>' : '') + '</dt>'
		+ '<dd data-out="gap"></dd><dd data-out="when"></dd><dd class="opt-more"></dd>'
		+ slider('<i>η</i>', 'data-eta', ETAS.length, ETAS.indexOf(o.lr))
		+ o.knobs.map(n => slider(n.sym, 'data-knob="' + n.key + '"', n.values.length, n.values.indexOf(n.def))).join('')
		+ '<dd class="opt-heat-cell"><canvas class="opt-heat"></canvas></dd></div>';
	const cardsEl = $('.opt-cards');
	cardsEl.innerHTML = OPTIMISERS.map(cardHtml).join('');
	const sliderOf = row => ({ row, input: row.querySelector('input'), out: row.querySelector('output'), label: row.querySelector('span'), key: row.dataset.knob });
	const cards = [...cardsEl.children].map(el => {
		const q = sel => el.querySelector(sel);
		return { el, name: q('.opt-name'), axis: q('.opt-axis'), gap: q('[data-out="gap"]'), when: q('[data-out="when"]'), more: q('.opt-more'),
			eta: sliderOf(q('[data-eta]')), knobs: [...el.querySelectorAll('[data-knob]')].map(sliderOf), heat: q('.opt-heat') };
	});

	// What each optimiser's runs read at the scrubbed step or the last: L − L*,
	// the median's over many seeds, or where they diverged; when they came under
	// TOL, or how many seeds have; and the first's reading of θ, if the surface has one, and steps skipped
	function results() {
		const n = scrub ?? (preview ? surf.steps : t);
		return onShow().map(its => {
			const gone = r => r.out && n >= r.out, at = r => (gone(r) ? Infinity : r.loss[Math.min(n, r.loss.length - 1)]);
			const there = its.filter(r => r.arrive >= 0 && r.arrive <= n).length, [a, b] = its[0].path[Math.min(n, its[0].path.length - 1)];
			const first = { reading: surf.reading && surf.reading.of([a, b]), skipped: its[0].skips.filter(s => s <= n).length };
			return one()
				? { ...first, gap: at(its[0]), out: gone(its[0]) ? its[0].out : 0, arrive: there ? its[0].arrive : Infinity }
				: { ...first, gap: median(its.map(at)), outs: its.filter(gone).length, there };
		});
	}
	// a reading in words, its labels in spans for a quieter face
	const gapText = r => (one() ? (r.out ? '<span>diverged at step</span> ' + fmt(r.out) : sci(r.gap))
		: isFinite(r.gap) ? '<span>median</span> ' + sci(r.gap) : '<span>diverged</span> ' + r.outs + ' of ' + SEEDS);
	const whenText = r => '<span>under 10⁻³</span> ' + (!one() ? r.there + ' <span>of</span> ' + SEEDS + ' <span>seeds</span>'
		: isFinite(r.arrive) ? '<span>at step</span> ' + fmt(r.arrive) : '—');
	// an optimiser's η as shown, waiting while the sweep tunes it
	const etaText = i => (settings[i].tuned && !sweep.best ? '…' : String(ETAS[settings[i].eta]));
	// a knob as torch.optim's arguments write it; the arguments it takes there,
	// and the call that makes it, with the schedule, the clipping and AMP
	const argOf = (i, key) => knobOf(i, key).arg || key;
	const args = i => OPTIMISERS[i].args.replace(/\{(\w+)\}/g, (_, key) => (key === 'lr' ? ETAS[settings[i].eta] : settings[i].k[key]));
	const torchCall = i => 'torch.optim.' + OPTIMISERS[i].cls + '(params, ' + args(i) + ')' + SCHEDULES[schedule].call(surf.steps)
		+ (scale > 1 ? ' · loss × ' + fmt(scale) : '')
		+ (clip ? ' · clip_grad_norm_(params, max_norm=' + CLIP.toFixed(1) + ')' : '')
		+ (amp ? ' · autocast("cuda", dtype=' + PRECISIONS[amp].dtype + ')' + (PRECISIONS[amp].scaler ? ' · GradScaler()' : '') : '');
	function updateCards(res) {
		cards.forEach((c, i) => {
			const s = settings[i];
			c.el.classList.toggle('off', !s.shown);
			c.gap.innerHTML = gapText(res[i]);
			c.when.innerHTML = whenText(res[i]);
			// the surface's reading of θ, and the steps a GradScaler skipped, for one run
			const more = [surf.reading && surf.reading.label + ' ' + res[i].reading,
				amp && PRECISIONS[amp].scaler && '<span>skipped</span> ' + res[i].skipped].filter(Boolean);
			c.more.classList.toggle('off', !one() || !more.length);
			c.more.innerHTML = more.join(' <span>·</span> ');
			c.eta.input.value = s.eta;
			c.eta.out.innerHTML = etaText(i) + (s.tuned ? ' <span>tuned</span>' : '');
			c.knobs.forEach(n => {
				n.input.value = knobOf(i, n.key).values.indexOf(s.k[n.key]);
				n.out.textContent = s.k[n.key];
				n.label.classList.toggle('opt-mapped', n.key === s.axis);
			});
			if (c.axis) c.axis.textContent = 'map: ' + knobOf(i, s.axis).sym;
		});
	}

	// the cards' maps: the palette's heat, low L − L* to high, so the low cells
	// glow, on one scale over every map, so a shade means the same L − L* in
	// each; a diverged cell brick, marked ×
	const HEAT = [30, 11]; // a map's margins: on the left for the knob's values, below for η's
	function drawHeats() {
		let [lo, hi] = bounds(cells.flat().map(r => r.map(v => Math.max(v, FLOOR))));
		if (!isFinite(lo)) lo = hi = 1;
		const l0 = Math.log10(lo), span = Math.max(1, Math.log10(hi) - l0);
		cards.forEach((c, i) => {
			const { cx, W, H } = fitCanvas(c.heat), [L, B] = HEAT, rows = rowsOf(i), w = (W - L) / ETAS.length, h = (H - B) / rows.length;
			cx.font = SMALL;
			rows.forEach((v, row) => {
				cells[i][row].forEach((g, e) => {
					const x = L + e * w, y = row * h;
					cx.fillStyle = isFinite(g) ? css(palette.heats[Math.min(BANDS - 1, Math.floor((Math.log10(Math.max(g, FLOOR)) - l0) / span * BANDS))]) : INK.diverged;
					cx.fillRect(x, y, w + 0.5, h + 0.5);
					if (isFinite(g)) return;
					cx.strokeStyle = '#ffffff';
					cx.lineWidth = 1;
					cross(cx, x + w / 2, y + h / 2, 2.5);
				});
				cx.fillStyle = INK.text;
				cx.textAlign = 'right';
				if (v !== null) cx.fillText(v, L - 3, row * h + h / 2 + 3);
			});
			// η along the foot, labelled at its ends and its middle
			[0, ETAS.length >> 1, ETAS.length - 1].forEach((e, k) => {
				cx.textAlign = ['left', 'center', 'right'][k];
				cx.fillText(decade(ETAS[e]), L + (e + [0, 0.5, 1][k]) * w, H - 1);
			});
			// where the sliders are, outlined in black about white, to show on paper and stone alike
			const s = settings[i], row = s.axis ? rows.indexOf(s.k[s.axis]) : 0, x = L + s.eta * w, y = row * h;
			cx.strokeStyle = '#000000';
			cx.lineWidth = 1.5;
			cx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
			cx.strokeStyle = '#ffffff';
			cx.lineWidth = 1;
			cx.strokeRect(x + 2, y + 2, w - 4, h - 4);
		});
	}
	// the cell under a point on optimiser i's map, as its row and rate
	function cellAt(i, e) {
		const cv = cards[i].heat, [L, B] = HEAT, rows = rowsOf(i).length;
		const col = Math.floor((e.offsetX - L) / ((cv.clientWidth - L) / ETAS.length)), row = Math.floor(e.offsetY / ((cv.clientHeight - B) / rows));
		return col >= 0 && col < ETAS.length && row >= 0 && row < rows ? [row, col] : null;
	}

	// ---- the status bar, the readings and the buttons pressed, as things stand ----
	const rateIn = $('[data-in="rate"]'), noiseIn = $('[data-in="noise"]'), torchBtn = $('[data-act="torch"]'), tuneBtn = $('[data-act="tune"]');
	const seedsBtn = $('[data-act="seeds"]'), scaleIn = $('[data-in="scale"]'), clipBtn = $('[data-act="clip"]'), chips = $('.opt-palettes');
	const press = (group, key, value) => group.forEach(b => b.classList.toggle('on', b.dataset[key] === value));
	const buttons = { surface: $$('[data-surface]'), view: $$('[data-view]'), init: $$('[data-init]'), amp: $$('[data-amp]'), schedule: $$('[data-schedule]') };
	function readout() {
		updateCards(results());
		press(buttons.surface, 'surface', surf.key);
		press(buttons.view, 'view', view);
		map.classList.toggle('turn', view === 'mesh');
		press(buttons.init, 'init', init ?? 'fixed');
		press(buttons.amp, 'amp', amp);
		press(buttons.schedule, 'schedule', schedule);
		press([...chips.children], 'palette', palette.key);
		seedsBtn.classList.toggle('on', many && !!init);
		seedsBtn.disabled = !init;
		clipBtn.classList.toggle('on', clip);
		torchBtn.classList.toggle('on', OPTIMISERS.every((o, i) => asTorch(i)));
		tuneBtn.classList.toggle('on', settings.every(s => s.tuned));
		// the slider for all at its rate, when all share one
		const same = settings.every(s => s.eta === settings[0].eta);
		if (same) rateIn.value = settings[0].eta;
		$('[data-out="rate"]').textContent = same ? ETAS[settings[0].eta] : '—';
		say(tip ?? (hover !== null ? torchCall(hover) : preview ? 'All at η = ' + ETAS[preview.e] + ', run to the end · click to keep it'
			: scrub !== null ? 'At step ' + fmt(scrub) : playing && tuning() ? 'Tuning η…' : playing ? 'Step ' + fmt(t) + ' of ' + fmt(surf.steps)
			: !t ? 'Ready' : t < surf.steps ? 'Paused at step ' + fmt(t) : fmt(t) + ' steps'));
	}
	function draw() {
		drawRace();
		drawRates();
		drawHeats();
	}
	// what a step of the race changes: the map, the loss pane and the readings
	function drawRace() {
		drawMap();
		drawLoss();
		readout();
	}

	// ---- the toolbar ----
	// a surface, at its own start or its init's seeds; the same surface again
	// goes back to its own start from one clicked on the map
	function pick(key) {
		surf = SURFACES[key];
		uncontour();
		bottom = lowest(surf);
		floor = surf.L(...bottom);
		brink = brinkOf();
		start = surf.start;
		shading();
		meshing();
		lows = surf.lows && Array.from({ length: 201 }, (_, n) => surf.lows(n / 200)).map(p => (inBox(p) ? p : null));
		noise();
		$$('.exe-note[data-for]').forEach(p => p.classList.toggle('on', p.dataset.for === key));
		$('.opt-caption').textContent = 'Long ticks: PyTorch’s defaults · maps: L − L* at step ' + fmt(surf.steps) + ' by η across and the navy knob down · lighter is lower · × diverged · outlined, the sliders · click a cell to set them';
		restart();
	}
	runBtn.addEventListener('click', () => {
		if (t >= surf.steps) rewind();
		play(!playing);
	});
	// a step cannot wait on the sweep, so a tuned η is found now
	$('[data-act="step"]').addEventListener('click', () => {
		if (tuning()) sweeper.finish();
		play(false);
		if (t < surf.steps) advance();
		drawRace();
	});
	$('[data-act="reset"]').addEventListener('click', rewind);
	buttons.surface.forEach(b => b.addEventListener('click', () => pick(b.dataset.surface)));
	buttons.view.forEach(b => b.addEventListener('click', () => {
		view = b.dataset.view;
		draw();
	}));
	// an init pressed draws the start; fixed goes back to the surface's own
	buttons.init.forEach(b => b.addEventListener('click', () => {
		init = b.dataset.init === 'fixed' ? null : b.dataset.init;
		start = surf.start;
		restart();
	}));
	seedsBtn.addEventListener('click', () => {
		many = !many;
		restart();
	});

	// ---- the row over the cards: all at one η, PyTorch's or tuned, the schedule, the noise, the loss's scale, clipping and AMP ----
	function allAt(e) {
		settings.forEach(s => {
			s.eta = e;
			s.tuned = false;
		});
		rewind();
	}
	rateIn.addEventListener('input', () => allAt(+rateIn.value));
	// every optimiser back as torch.optim makes it, its lr and knobs
	torchBtn.addEventListener('click', () => {
		settings.forEach((s, i) => Object.assign(s, torchOf(OPTIMISERS[i]), { tuned: false }));
		resweep();
		regrid();
		rewind();
	});
	// tuned: each at its best, now or once the sweep is done; let go, each back at PyTorch's lr
	tuneBtn.addEventListener('click', () => {
		const on = !settings.every(s => s.tuned);
		settings.forEach((s, i) => {
			s.tuned = on;
			s.eta = on && sweep.best ? sweep.best[i] : ETAS.indexOf(OPTIMISERS[i].lr);
		});
		rewind();
	});
	// cosine or warmup pressed; pressed again, back to a constant η
	buttons.schedule.forEach(b => b.addEventListener('click', () => {
		schedule = b.dataset.schedule === schedule ? 'constant' : b.dataset.schedule;
		restart();
	}));
	function noise() {
		sigma = noiseIn.value / noiseIn.max * surf.noise;
		$('[data-out="noise"]').textContent = +sigma.toPrecision(2);
	}
	noiseIn.addEventListener('input', () => {
		noise();
		restart();
	});
	// the loss scaled up: every gradient as much longer, and SGD's edge as much nearer
	scaleIn.addEventListener('input', () => {
		scale = SCALES[scaleIn.value];
		$('[data-out="scale"]').textContent = fmt(scale);
		brink = brinkOf();
		restart();
	});
	clipBtn.addEventListener('click', () => {
		clip = !clip;
		restart();
	});
	// bf16 or fp16 pressed; pressed again, back to fp32
	buttons.amp.forEach(b => b.addEventListener('click', () => {
		amp = b.dataset.amp === amp ? null : b.dataset.amp;
		restart();
	}));

	// ---- the cards' controls ----
	cards.forEach((c, i) => {
		const s = settings[i];
		c.eta.input.addEventListener('input', () => {
			s.eta = +c.eta.input.value;
			s.tuned = false;
			rewind();
		});
		// a knob: the sweep runs again, and the maps but for the one that spans it
		c.knobs.forEach(n => n.input.addEventListener('input', () => {
			s.k[n.key] = knobOf(i, n.key).values[n.input.value];
			resweep(i);
			if (n.key !== s.axis) regrid(i);
			rewind();
		}));
		c.name.addEventListener('click', () => {
			s.shown = !s.shown;
			draw();
		});
		// AdamW's and Muon's maps, down each of their knobs in turn
		if (c.axis) c.axis.addEventListener('click', () => {
			const keys = OPTIMISERS[i].knobs.map(n => n.key);
			s.axis = keys[(keys.indexOf(s.axis) + 1) % keys.length];
			regrid(i);
			draw();
		});
		// the pointer on a card brings its runs forward and shows its torch.optim call; on its map, the cell's
		c.el.addEventListener('pointerenter', () => {
			hover = i;
			draw();
		});
		c.el.addEventListener('pointerleave', () => {
			hover = null;
			draw();
		});
		c.heat.addEventListener('pointermove', e => {
			const at = cellAt(i, e), v = at && cells[i][at[0]][at[1]];
			tip = v === undefined || v === null ? null : OPTIMISERS[i].name + ' at lr=' + ETAS[at[1]] + (s.axis ? ', ' + argOf(i, s.axis) + '=' + rowsOf(i)[at[0]] : '')
				+ ': L − L* ' + (isFinite(v) ? plain(sci(v)) : 'diverged') + ' at step ' + fmt(surf.steps) + ' · click to take it';
			readout();
		});
		c.heat.addEventListener('pointerleave', () => {
			tip = null;
			readout();
		});
		// the map spans this knob, so it holds; the sweep and the runs start again
		c.heat.addEventListener('click', e => {
			const at = cellAt(i, e);
			if (!at) return;
			s.eta = at[1];
			s.tuned = false;
			if (s.axis) s.k[s.axis] = rowsOf(i)[at[0]];
			resweep(i);
			rewind();
		});
	});

	// ---- the panes' controls ----
	// the surface's note and the credits, in a balloon from the ? on the map
	const helpBtn = $('.opt-help'), balloon = $('.opt-balloon');
	function help(open) {
		balloon.hidden = !open;
		helpBtn.setAttribute('aria-expanded', open);
	}
	helpBtn.addEventListener('click', () => help(balloon.hidden));
	root.addEventListener('keydown', e => e.key === 'Escape' && help(false));
	// the palettes, a chip each in the map's corner, its heat ramp on it
	chips.innerHTML = Object.entries(PALETTES).map(([key, p]) => '<button type="button" data-palette="' + key + '" title="' + p.name + '" aria-label="' + p.name
		+ '" style="background:linear-gradient(to right,' + p.heat.map(css).join(',') + ')"></button>').join('');
	chips.addEventListener('click', e => {
		const b = e.target.closest('[data-palette]');
		if (!b) return;
		paint(b.dataset.palette);
		draw();
	});
	// on the contours the status bar reads the point under the pointer, and a
	// click starts every run from there; on the mesh a drag turns it
	map.addEventListener('pointermove', e => {
		if (view !== 'flat') return;
		const f = frame(map.clientWidth, map.clientHeight), p = [f.x(e.offsetX), f.y(e.offsetY)];
		tip = 'θ = (' + signed(p[0]) + ', ' + signed(p[1]) + ') · L − L* ' + plain(sci(gap(p))) + ' · click to start there';
		readout();
	});
	map.addEventListener('pointerleave', () => {
		tip = null;
		readout();
	});
	map.addEventListener('pointerdown', e => {
		if (view === 'flat') {
			const f = frame(map.clientWidth, map.clientHeight);
			start = [f.x(e.offsetX), f.y(e.offsetY)];
			init = null;
			restart();
			return;
		}
		const x0 = e.clientX, y0 = e.clientY, yaw0 = yaw, pitch0 = pitch;
		map.setPointerCapture(e.pointerId);
		const turn = ev => {
			yaw = yaw0 + (ev.clientX - x0) * TURN;
			pitch = Math.min(PITCH[1], Math.max(PITCH[0], pitch0 + (ev.clientY - y0) * TURN));
			if (!playing) drawMap();
		};
		const done = () => ['pointermove', 'pointerup', 'pointercancel'].forEach((type, k) => map.removeEventListener(type, k ? done : turn));
		map.addEventListener('pointermove', turn);
		map.addEventListener('pointerup', done);
		map.addEventListener('pointercancel', done);
	});
	// over the loss pane, the runs as they were at that step, on the map and in the readings
	plot.addEventListener('pointermove', e => {
		scrub = stepAt(e.offsetX);
		if (!playing) draw();
	});
	plot.addEventListener('pointerleave', () => {
		scrub = null;
		if (!playing) draw();
	});
	// over the sweep, every run at that rate, run to the end; a click keeps the rate for all
	rates.addEventListener('pointermove', ev => {
		const e = rateAt(ev.offsetX);
		if (playing || (preview && preview.e === e)) return;
		preview = { e, runs: OPTIMISERS.map((o, i) => race(i, ETAS[e], settings[i].k, true)),
			twins: amp && OPTIMISERS.map((o, i) => race(i, ETAS[e], settings[i].k, true, null)) };
		draw();
	});
	rates.addEventListener('pointerleave', () => {
		preview = null;
		if (!playing) draw();
	});
	rates.addEventListener('click', e => {
		if (playing) return;
		preview = null;
		allAt(rateAt(e.offsetX));
	});

	// the slider for all at one η steps through ETAS, at first at most optimisers' lr
	rateIn.max = ETAS.length - 1;
	rateIn.value = ETAS.indexOf(OPTIMISERS[0].lr);
	// a grip-resize or a maximise redraws the panes at their new size; a closed window lets go
	const resized = new ResizeObserver(() => {
		if (!root.isConnected) resized.disconnect();
		else if (runs) draw();
	});
	resized.observe($('.exe-body'));
	paint('cividis');
	pick('ravine');
})();
