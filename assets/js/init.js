// init.exe, for 307: a plain stack at initialisation, z = W a + b and a = φ(z)
// from the input x up, in two views of the one stack. Units is the network unit
// by unit: three of its layers laid on a ground that turns, each unit a dot at
// its value on its layer's line, the ground coloured by how densely the values
// of many inputs lie, the terms of one unit's sum and each layer's weights as a
// sheet; each layer's second moment, and its gradient's in the backward pass,
// against mean field's; and the activation's curve and its slope φ′ at the bold
// layer. Shape is what the second moment leaves out: a ring of inputs, each
// layer's ring on its own top two principal components and laid along the depth
// as a tube (Poole et al. 2016); the ring's length by layer against √χ a layer;
// and the input-output Jacobian's singular values, whose mean σ² mean field
// fixes and whose spread it does not (Pennington, Schoenholz and Ganguli 2017).
// A norm, LayerNorm or RMSNorm, can stand between a layer's sums and its
// activation, a = φ(ẑ) with ẑ the sums normalised over the layer's units, as
// Ba, Kiros and Hinton (2016) place it. In the code a layer's sums are h, as
// mean field writes them. The desktop runs a window's scripts each time it
// opens one, so this runs once per window and claims it with data-ready.
(function () {
	const root = document.querySelector('.ini:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';
	const $ = sel => root.querySelector(sel), $$ = sel => [...root.querySelectorAll(sel)];
	const say = exeStatus(root);

	const N = 64;                    // units a layer
	const K = 96;                    // inputs round the ring
	const ROWS = 256;                // inputs for the river and the ridges
	const WIDE = 0.95;               // the share of a line's values its dashed span holds
	const QN = 400;                  // the quantiles a line's values are kept as, for the river
	const ARCS = 12;                 // the ring drawn in arcs of one hue each
	const LMAX = 64;                 // the deepest stack
	const STEP_MS = 620;             // Run's pace at ×1, a layer a step, with time to see each
	const GLIDE_MS = 360;            // the ground eases from one layer, or one setting, to the next
	const PICK_PX = 14;              // how near a dot the pointer picks its unit
	const B_LO = 1e-4, B_HI = 0.5;   // σb²'s slider past 0, on a log scale
	const SV_LO = -8, SV_HI = 1, SV_BIN = 0.25; // the histogram's log₁₀ σ
	const INK = {
		ink: '#1d3c8f', tail: '#b8780f', text: '#4d4852', grid: '#ebe8e2', frame: '#808080', bad: '#a40000',
		act: '#1f7a55', weight: '#9b3f8f', input: '#5b5560', paper: '#fdfcf8', sign: '#2b2730', norm: '#4d79c7',
		grad: '#a8322d',
	};
	// a line's colour by what it holds: the input, a layer's sums, the sums normalised, or what the activation makes of them
	const KIND = { input: INK.input, sum: INK.ink, norm: INK.norm, out: INK.act };
	// the panes set as a printed page is: a serif, and each line's name in italic, as maths
	const SERIF = 'Georgia, "Times New Roman", serif', FONT = '10px ' + SERIF, BOLD = 'bold 11px ' + SERIF, NAME = 'italic 12px ' + SERIF;

	// ---- the scales, each the weights' variance it sets, with no bias, and what
	// to look at where its button is down, by view and activation ----
	const METHODS = { zero: { w: 0, b: 0 }, xavier: { w: 1, b: 0 }, he: { w: 2, b: 0 } };
	const SAID = {
		units: {
			linear: {
				xavier: 'A linear unit hands on exactly what it summed, so each a line repeats the z line under it and nothing is bounded. Xavier’s σw² = 1 keeps the spread the same from layer to layer in the mean, and that alone holds it.',
				he: 'A linear unit hands on exactly what it summed, and He’s σw² = 2 doubles the second moment at every layer. By layer 6 most dots have run off the axis and wait hollow at its ends.',
			},
			tanh: {
				xavier: 'tanh takes every sum into (−1, 1), so that band is all the next layer reads from. With σw² = 1 and no bias the weights give back less than tanh takes off, so the sums narrow with depth towards 0, where tanh is nearly the identity. Step on through the layers and the links straighten.',
				he: 'tanh takes every sum into (−1, 1), so however far He’s σw² = 2 spreads the sums, the next layer reads from that band alone. The two settle within about ten layers, at sums a little narrower than the band.',
			},
			relu: {
				xavier: 'ReLU sends every negative sum to 0 and hands on the rest unchanged, so about half the units hand on nothing and the second moment halves. Xavier’s σw² = 1 does not make that up, and the dots close in on 0 layer by layer.',
				he: 'ReLU sends every negative sum to 0 and hands on the rest unchanged, so its range is the half line from 0 and about half the units hand on nothing. That halves the second moment, and He’s σw² = 2 doubles it back in the mean.',
			},
		},
		shape: {
			tanh: {
				xavier: 'With no bias tanh’s edge of chaos is σw² = 1, where q* = 0 and χ₁ = 1. The signal only nears q*, so each layer’s own χ stays under 1 and nearby inputs draw together a little. The ring keeps its shape and its length falls by a power of the depth, not at a rate. At q* itself mean field puts the Jacobian’s mean σ² at 1. Gaussian weights spread its singular values over decades, and orthogonal ones hold them near 1.',
			},
			relu: {
				he: 'ReLU’s χ is σw² / 2 at any q, so He’s σw² = 2 sets it to 1 and the ring’s length holds in the mean. Its correlation map still draws every pair of inputs together, slowly, so the ring narrows against its size. Half or more of the Jacobian’s singular values are 0, since a unit that is off passes nothing back.',
			},
		},
	};
	// with every weight 0 the activation has nothing to act on, so each view says one thing for all of them
	const ZERO = {
		units: 'With every weight 0 each sum is 0 whatever x holds, so all 64 units of a layer sit on one dot and nothing of the input climbs past W¹. Units that start alike also get the same gradient, so training could never tell them apart. A random draw is there to break that symmetry.',
		shape: 'With every weight 0 every input lands on the same point, so the ring is a point from the first layer on. The Jacobian is all zeros, so nothing passes back either.',
	};
	// a convolution's, in Units: what its sheet and its links show
	const DELTA = 'Drawn orthogonal, a convolution is delta-orthogonal (Xiao et al. 2018): only its centre tap is drawn, a random rotation of the 4 channels the same at every position, and its other taps are 0. Each unit reads 4 units, and the layer as a whole is a rotation, so it keeps the spread as an orthogonal dense layer does.';
	const SLID = 'A convolution gives each unit 12 of the 64 units before it, the 3 nearest positions in each of 4 channels, and a channel’s units all read theirs through the same 12 weights. As a 64 × 64 matrix that is 48 numbers along 16 diagonal bands and 0 elsewhere, as the sheet shows. The fan-in is 12, so Xavier’s Var W is 1 / 12, and with so few inputs to a sum E z² strays further from mean field’s.';
	// elsewhere. Units: each activation by its range, which is all the next layer reads from
	const HANDS = {
		linear: 'A linear unit hands on exactly what it summed. Its range is the whole line, so nothing bounds what the next layer is given, and the stack is one linear map of the input plus a bias.',
		tanh: 'tanh takes every sum into (−1, 1). However wide a layer’s sums, the next layer reads from that band alone, so mean field’s q can never pass σw² + σb². A wide sum is cut back hard and a narrow one hardly at all.',
		relu: 'ReLU sends every negative sum to 0 and hands on the rest unchanged. Its range is the half line from 0, with no upper end, so it halves the second moment and bounds nothing. Only the weights hold the scale.',
	};
	// Shape: tanh by the slope χ₁ at q*, the others by their own law
	const PHASES = [
		{ below: 0.98, text: 'χ₁ is below 1 at q*, the ordered phase. Nearby inputs draw together and the ring shrinks towards a point.' },
		{ below: 1.02, text: 'χ₁ is close to 1 at q*, near the edge of chaos. Nearby inputs keep their distance, so the length holds nearly level, while the ring’s span narrows slowly.' },
		{ below: Infinity, text: 'χ₁ is above 1 at q*, chaos. Nearby inputs fly apart and the ring crumples.' },
	];
	const OWN = {
		linear: 'A linear stack multiplies distances by about σw a layer, so the ring only changes scale and keeps its shape up to the random weights’ stretch, which orthogonal weights do not have.',
		relu: 'ReLU has no chaotic phase. Its correlation map draws every pair of inputs together at any σw², so the ring shrinks towards a point against its size, fast below He’s σw² = 2 if a bias holds q* above 0, and slowly otherwise.',
	};
	// under a norm: in Units what it does to the scale, by norm; in Shape what it leaves of the phase, by activation
	const NORMED = {
		units: {
			layer: 'LayerNorm takes each input’s 64 sums to mean 0 and variance 1 before the activation, so the blue ẑ lines hold E ẑ² = 1 at every layer, whatever σw² and the depth. E z² stops compounding and sits level from layer 2 at σw² E φ(ẑ)² + σb². Only σb² / σw² reaches ẑ, so Xavier and He build the same stack. The sums already have a mean near 0 across the units, so the centring changes little.',
			rms: 'RMSNorm divides each input’s 64 sums by their root mean square before the activation, so the blue ẑ lines hold E ẑ² = 1 at every layer, whatever σw² and the depth. E z² stops compounding and sits level from layer 2 at σw² E φ(ẑ)² + σb². Only σb² / σw² reaches ẑ, so Xavier and He build the same stack. It is LayerNorm without the centring, which sums of zero-mean weights hardly need (Zhang and Sennrich 2019).',
		},
		shape: {
			tanh: 'A norm holds ẑ at variance 1, where tanh still bends: χ₁ = σw² E φ′(ẑ)² / (σw² E φ(ẑ)² + σb²), 1.18 with no bias at any σw². So nearby inputs fly apart and the Jacobian’s σ² grows by about 1.18 a layer. The norm fixes the scale, not the phase. A bias of σb² = 0.07 σw² brings χ₁ to 1.',
			relu: 'Under a norm ReLU’s χ₁ is (σw² / 2) / (σw² / 2 + σb²), so with no bias it is exactly 1 at any σw², the edge however the weights are scaled. A bias puts the stack in order.',
			linear: 'Under a norm a linear stack’s χ₁ is σw² / (σw² + σb²), 1 with no bias and under 1 with one. With no bias each layer’s ring lies in a plane through 0, and the norm puts every input at the same distance from 0, so ẑ’s ring is a circle at every layer and the sums’ ring an ellipse, a circle only under orthogonal weights.',
		},
	};
	// the scale whose button is down: the one that sets the weights and the bias as they stand
	const method = () => Object.keys(METHODS).find(m => METHODS[m].w === S.w && METHODS[m].b === S.b) || null;

	// ---- numbers ----
	const MINUS = '−';
	const decade = e => (e === 0 ? '1' : e === 1 ? '10' : exePower(e));
	const tickText = v => String(v).replace('-', MINUS);
	// three figures, or a mantissa and a power of ten past them
	function fmt(x) {
		if (Number.isNaN(x)) return '–';
		if (!isFinite(x)) return (x > 0 ? '' : MINUS) + '∞';
		if (x === 0) return '0';
		const a = Math.abs(x);
		if (a >= 1e-3 && a < 1e5) return String(+x.toPrecision(3)).replace('-', MINUS);
		let e = Math.floor(Math.log10(a)), m = (a / 10 ** e).toFixed(2);
		if (m === '10.00') { m = '1.00'; e += 1; }
		return (x < 0 ? MINUS : '') + m + '×' + exePower(e);
	}
	// σb² from its slider's 0 to 100: 0, then B_LO to B_HI evenly in log, and back
	const bOf = v => (v <= 0 ? 0 : B_LO * (B_HI / B_LO) ** ((v - 1) / 99));
	const vOf = b => (b <= 0 ? 0 : Math.round(1 + 99 * Math.log(b / B_LO) / Math.log(B_HI / B_LO)));
	const meanSq = x => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return s / x.length; };
	const ease = x => x * x * (3 - 2 * x);
	const within = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
	const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

	// ---- mean field ----
	// each activation as code writes a = φ(z), with its derivative, its range's ends and the values marked up an axis of it
	const ACTS = {
		linear: { code: 'z', f: x => x, d: () => 1, lo: -Infinity, hi: Infinity, ticks: [-4, 0, 4] },
		tanh: { code: 'tanh(z)', f: Math.tanh, d: x => 1 - Math.tanh(x) ** 2, lo: -1, hi: 1, ticks: [-1, 0, 1] },
		relu: { code: 'relu(z)', f: x => (x > 0 ? x : 0), d: x => (x > 0 ? 1 : 0), lo: 0, hi: Infinity, ticks: [0, 2, 4] },
	};
	// Gaussian expectations on a midpoint grid, an even count so that no node
	// sits on ReLU's kink
	function nodes(k, span) {
		const z = new Float64Array(k), w = new Float64Array(k), dz = 2 * span / k;
		let s = 0;
		for (let i = 0; i < k; i++) { z[i] = -span + (i + 0.5) * dz; w[i] = Math.exp(-z[i] * z[i] / 2); s += w[i]; }
		for (let i = 0; i < k; i++) w[i] /= s;
		return { z, w };
	}
	// fine for one variable, and a square grid for two
	const Q = nodes(120, 8), Q2 = nodes(40, 6);
	// [E φ(√q z)², E φ′(√q z)²]
	function moments(act, q) {
		const s = Math.sqrt(q);
		let ef = 0, ed = 0;
		for (let i = 0; i < Q.z.length; i++) {
			const x = s * Q.z[i], f = act.f(x), d = act.d(x);
			ef += Q.w[i] * f * f;
			ed += Q.w[i] * d * d;
		}
		return [ef, ed];
	}
	// E φ(u)φ(v) for (u, v) ~ N(0, q [[1, c], [c, 1]])
	function cross(act, q, c) {
		c = within(c, [-1, 1]);
		const s = Math.sqrt(q), r = Math.sqrt(1 - c * c), { z, w } = Q2;
		let e = 0;
		for (let i = 0; i < z.length; i++) {
			let inner = 0;
			for (let j = 0; j < z.length; j++) inner += w[j] * act.f(s * (c * z[i] + r * z[j]));
			e += w[i] * act.f(s * z[i]) * inner;
		}
		return e;
	}
	// the length map q ↦ σw² E φ(√q z)² + σb²'s fixed point from q = 1, Infinity
	// where the length grows without end, as it does more slowly than any test
	// on its size can catch at linear's σw² = 1 or ReLU's σw² = 2 with a bias
	function qStar(act, w, b) {
		let q = 1;
		for (let k = 0; k < 4000; k++) {
			const next = w * moments(act, q)[0] + b;
			if (!(next < 1e8)) return Infinity;
			if (Math.abs(next - q) < 1e-13 * Math.max(1, q)) return next;
			q = next;
		}
		return w * moments(act, q)[0] + b > q ? Infinity : q;
	}
	// the correlation map c ↦ (σw² E φ(u)φ(v) + σb²)/q's stable fixed point at
	// length q, from c = 0.5, with u and v of the variance the activation reads
	function cStar(act, w, b, q, reads = q) {
		let c = 0.5;
		for (let k = 0; k < 2000; k++) {
			const next = (w * cross(act, reads, c) + b) / q;
			if (Math.abs(next - c) < 1e-12) return next;
			c = next;
		}
		return c;
	}
	// q*, c*, and χ₁ = σw² E φ′(√q z)² at q*: the slope of the correlation map at
	// c = 1, and the factor a nearby pair's squared distance gains a layer. A
	// length that runs off is a linear or ReLU stack's, whose χ does not depend on q.
	// c = 1 is stable up to χ₁ = 1, which rounding can put a hair above 1. Under a
	// norm the activation reads ẑ of variance 1 whatever q, so q* is the length
	// map's one step from 1, and χ₁ is over q*, as the norm divides by √q
	function fixedPoints(act, w, b, normed) {
		if (normed) {
			const [ef, ed] = moments(act, 1), q = w * ef + b, chi = q > 0 ? w * ed / q : 0;
			return { q, chi, c: chi > 1 + 1e-9 ? cStar(act, w, b, q, 1) : 1 };
		}
		const q = qStar(act, w, b), chi = w * moments(act, isFinite(q) ? q : 1)[1];
		return { q, chi, c: isFinite(q) && chi > 1 + 1e-9 ? cStar(act, w, b, q) : 1 };
	}

	// ---- the network ----
	const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
	// a direction scaled to squared length N, so of unit variance a unit
	const toN = x => { const s = Math.sqrt(N / dot(x, x)); return x.map(y => s * y); };
	// normals from a seeded uniform, so the weights are the same every time, by
	// Box-Muller, both of each pair
	function normals(u) {
		let spare = null;
		return () => {
			if (spare !== null) { const s = spare; spare = null; return s; }
			const r = Math.sqrt(-2 * Math.log(1 - u())), t = 2 * Math.PI * u();
			spare = r * Math.sin(t);
			return r * Math.cos(t);
		};
	}
	// an n × n matrix with orthonormal rows: Gram-Schmidt on Gaussian rows, which
	// is Haar's measure
	function orthogonal(n, gauss) {
		const m = Float64Array.from({ length: n * n }, gauss);
		for (let i = 0; i < n; i++) {
			for (let k = 0; k < i; k++) {
				let d = 0;
				for (let j = 0; j < n; j++) d += m[i * n + j] * m[k * n + j];
				for (let j = 0; j < n; j++) m[i * n + j] -= d * m[k * n + j];
			}
			let s = 0;
			for (let j = 0; j < n; j++) s += m[i * n + j] ** 2;
			for (let j = 0; j < n; j++) m[i * n + j] /= Math.sqrt(s);
		}
		return m;
	}
	// a convolution's weights as the N × N matrix they make: CONV.channels
	// channels of N / CONV.channels positions, a kernel of CONV.size drawn entry by
	// entry between each pair of channels slid round the positions, so that a unit
	// reads CONV.channels × CONV.size of the N and every other entry is 0. What
	// is not 0 has variance N over that fan-in, which affine's σw/√N makes σw² over it
	const CONV = { channels: 4, size: 3 };
	function convolution(entry) {
		const { channels, size } = CONV, places = N / channels, reach = (size - 1) / 2, gain = Math.sqrt(N / (channels * size)), m = new Float32Array(N * N);
		for (let out = 0; out < channels; out++) for (let inp = 0; inp < channels; inp++) for (let k = 0; k < size; k++) {
			const w = gain * entry();
			for (let place = 0; place < places; place++) m[(out * places + place) * N + inp * places + (place + k - reach + places) % places] = w;
		}
		return m;
	}
	// a convolution drawn delta-orthogonal (Xiao et al. 2018): its centre tap a random rotation of the
	// channels, the same at every position, and every other tap 0, so that the layer is a rotation too
	function delta(gauss) {
		const { channels } = CONV, places = N / channels, q = orthogonal(channels, gauss), m = new Float32Array(N * N);
		for (let out = 0; out < channels; out++) for (let inp = 0; inp < channels; inp++) for (let place = 0; place < places; place++)
			m[(out * places + place) * N + inp * places + place] = Math.sqrt(N) * q[out * channels + inp];
		return m;
	}
	// the draws, each an entry of unit variance, and what the status bar calls them; orthogonal draws the
	// matrix at once, times √N so that its entries have unit variance as the others' do
	const DRAWN = {
		gauss: { label: 'Gaussian', entry: gauss => gauss },
		uniform: { label: 'uniform', entry: (gauss, u) => () => Math.sqrt(3) * (2 * u() - 1) },
		orth: { label: 'orthogonal' },
	};
	// the layers, a layer's N × N matrix from a draw
	const WIRINGS = {
		dense: (draw, entry, gauss) => (draw === 'orth' ? Float32Array.from(orthogonal(N, gauss), x => x * Math.sqrt(N)) : Float32Array.from({ length: N * N }, entry)),
		conv: (draw, entry, gauss) => (draw === 'orth' ? delta(gauss) : convolution(entry)),
	};
	// each pair's seed, init.exe's first for Gaussian and orthogonal dense layers
	const SEEDS = { 'gauss dense': 1064, 'orth dense': 1071, 'uniform dense': 1069, 'gauss conv': 1077, 'uniform conv': 1083, 'orth conv': 1089 };
	const weightsLabel = () => (S.wiring === 'conv' ? `${S.draw === 'orth' ? 'delta-orthogonal' : DRAWN[S.draw].label} conv weights, ${CONV.channels} channels, kernel ${CONV.size}` : `${DRAWN[S.draw].label} dense weights`);
	// every layer's weights and biases, the ring's two orthogonal directions, the
	// Jacobian's input, and the river's inputs with a row of signs each, drawn
	// once a draw and a layer; σw and σb only scale them. A layer's fan-in is how
	// many of a row's entries are not 0
	function build(draw, wiring) {
		const key = `${draw} ${wiring}`, seed = SEEDS[key], gauss = normals(exeRng(seed)), entry = DRAWN[draw].entry ? DRAWN[draw].entry(gauss, exeRng(seed + 1)) : null;
		const pick = () => Float64Array.from({ length: N }, gauss), Z = [], zb = [];
		for (let l = 0; l < LMAX; l++) {
			Z.push(WIRINGS[wiring](draw, entry, gauss));
			zb.push(Float32Array.from({ length: N }, gauss));
		}
		const u = toN(pick()), v = pick(), along = dot(u, v) / N, x = toN(pick());
		const rows = Float64Array.from({ length: ROWS * N }, gauss), signs = Float64Array.from({ length: ROWS * N }, () => (gauss() < 0 ? -1 : 1));
		const fanIn = Z[0].slice(0, N).filter(z => z).length;
		// the loss's gradient at the last layer's a for the river's inputs, drawn after the rest so that it leaves them as they were
		const top = Float64Array.from({ length: ROWS * N }, gauss);
		return { key, fanIn, Z, zb, u, v: toN(v.map((y, j) => y - along * u[j])), x, rows, signs, top };
	}
	// the norms, each over a row's N sums, as PyTorch's start: γ = 1 and β = 0, and
	// their eps, nn.RMSNorm's float32's own. LayerNorm takes the mean off, then
	// both divide by the root mean square of what is left
	const NORMS = {
		layer: { label: 'LayerNorm', sign: '− μ, ÷ s', centres: true, eps: 1e-5 },
		rms: { label: 'RMSNorm', sign: '÷ rms', centres: false, eps: 2 ** -23 },
	};
	// a row's centre and the scale the norm divides by
	function measure(h, o, norm) {
		let mean = 0, sq = 0;
		if (norm.centres) for (let j = 0; j < N; j++) mean += h[o + j] / N;
		for (let j = 0; j < N; j++) sq += (h[o + j] - mean) ** 2 / N;
		return [mean, Math.sqrt(sq + norm.eps)];
	}
	// m rows of N sums normalised, ẑ, or the sums as they are with no norm
	function normalise(h) {
		const norm = NORMS[S.norm];
		if (!norm) return h;
		const out = new Float64Array(h.length);
		for (let o = 0; o < h.length; o += N) {
			const [mean, s] = measure(h, o, norm);
			for (let j = 0; j < N; j++) out[o + j] = (h[o + j] - mean) / s;
		}
		return out;
	}
	// layer l's affine map on m rows of N: a Zₗ x + bs zbₗ, a = σw/√N
	function affine(l, inp, m) {
		const a = Math.sqrt(S.w / N), bs = Math.sqrt(S.b), Z = net.Z[l], zb = net.zb[l], out = new Float64Array(m * N);
		for (let b = 0; b < m; b++) {
			const o = b * N;
			for (let i = 0; i < N; i++) {
				const zi = i * N;
				let acc = 0;
				for (let j = 0; j < N; j++) acc += Z[zi + j] * inp[o + j];
				out[o + i] = a * acc + bs * zb[i];
			}
		}
		return out;
	}
	// K inputs u cos θ + v sin θ round a great circle of unit variance a unit,
	// each layer's K rows of N
	function ring() {
		const act = ACTS[S.act], x = new Float64Array(K * N), H = new Array(S.L + 1);
		for (let k = 0; k < K; k++) {
			const th = 2 * Math.PI * k / K, c = Math.cos(th), s = Math.sin(th);
			for (let j = 0; j < N; j++) x[k * N + j] = c * net.u[j] + s * net.v[j];
		}
		H[1] = affine(0, x, K);
		for (let l = 2; l <= S.L; l++) H[l] = affine(l - 1, normalise(H[l - 1]).map(act.f), K);
		return H;
	}
	// the river's ROWS inputs, standard normals, each layer's ROWS rows of N. A
	// stack of 64 units strays far from the mean that mean field speaks of,
	// ReLU's most, and many inputs through it stray together. So each input
	// meets every layer under signs of its own on what the layer takes in, which
	// flips the signs of the weights' columns: a draw as likely as the one made,
	// and the rows pool nearly as if each had a stack of its own
	const signed = (a, f) => a.map((x, i) => f(x) * net.signs[i]);
	function pass() {
		const act = ACTS[S.act], H = new Array(S.L + 1);
		H[1] = affine(0, signed(net.rows, ACTS.linear.f), ROWS);
		for (let l = 2; l <= S.L; l++) H[l] = affine(l - 1, signed(normalise(H[l - 1]), act.f), ROWS);
		return H;
	}
	// one input through the stack as it is, with no signs: each layer's N sums
	function single() {
		const act = ACTS[S.act], H = new Array(S.L + 1);
		H[1] = affine(0, net.x, 1);
		for (let l = 2; l <= S.L; l++) H[l] = affine(l - 1, normalise(H[l - 1]).map(act.f), 1);
		return H;
	}
	// the backward pass over the river's inputs, whose sums are H: a loss's gradient arrives at the last
	// layer's a, drawn standard normal input by input and unit by unit, as mean field takes it, apart from
	// the forward pass (Schoenholz et al. 2017). Each layer passes it back through the gate, φ′(ẑ) ∂ℓ/∂a,
	// then the norm's own Jacobian, which is symmetric, to δ = ∂ℓ/∂z, then down W's columns, under the
	// input's signs, to the layer below's ∂ℓ/∂a. Kept is each layer's E δ²
	function backward(H) {
		const act = ACTS[S.act], norm = NORMS[S.norm], m2b = [];
		let ga = net.top;
		for (let l = S.L; l >= 1; l--) {
			const n = normalise(H[l]), g = ga.map((x, i) => act.d(n[i]) * x), d = norm ? normBack(H[l], n, g) : g;
			m2b[l] = meanSq(d);
			if (l > 1) {
				ga = affineT(l - 1, d, ROWS);
				for (let i = 0; i < ga.length; i++) ga[i] *= net.signs[i];
			}
		}
		return m2b;
	}
	// layer l's map back on m rows of N: a Zₗᵀ δ, a = σw/√N
	function affineT(l, d, m) {
		const a = Math.sqrt(S.w / N), Z = net.Z[l], out = new Float64Array(m * N);
		for (let b = 0; b < m; b++) {
			const o = b * N;
			for (let i = 0; i < N; i++) {
				const di = a * d[o + i], zi = i * N;
				if (di) for (let j = 0; j < N; j++) out[o + j] += Z[zi + j] * di;
			}
		}
		return out;
	}
	// the norm's Jacobian at rows of sums h, n their normalised values, on g row by row:
	// (g − n (n · g) / N) / s for RMSNorm, and for LayerNorm with g's mean taken off g first
	function normBack(h, n, g) {
		const norm = NORMS[S.norm], out = new Float64Array(g.length);
		for (let o = 0; o < g.length; o += N) {
			const s = measure(h, o, norm)[1];
			let mean = 0, along = 0;
			for (let j = 0; j < N; j++) { mean += g[o + j] / N; along += n[o + j] * g[o + j] / N; }
			for (let j = 0; j < N; j++) out[o + j] = (g[o + j] - (norm.centres ? mean : 0) - n[o + j] * along) / s;
		}
		return out;
	}
	// the ring's length, Σ |h(θₖ₊₁) − h(θₖ)|, in units of √N
	function ringLength(h) {
		let s = 0;
		for (let k = 0; k < K; k++) {
			const p = k * N, q = ((k + 1) % K) * N;
			let d = 0;
			for (let j = 0; j < N; j++) d += (h[p + j] - h[q + j]) ** 2;
			s += Math.sqrt(d / N);
		}
		return s;
	}
	// the singular values of ∂hᴸ/∂h¹ at one input. J = Wᴸ Dᴸ⁻¹ ⋯ W² D¹ with
	// Dˡ = diag φ′(hˡ), built a layer at a time, then one-sided Jacobi (Hestenes);
	// rounding in J leaves any σ under about 10⁻¹² of the largest as noise. As
	// Pennington et al. (2017) take it, the input is scaled so that the signal
	// starts at its fixed point q*, where every layer passes back the same χ₁. A
	// norm adds its own Jacobian before each D: (I − 11ᵀ/N − ẑẑᵀ/N) / s for
	// LayerNorm and (I − ẑẑᵀ/N) / s for RMSNorm, s the scale it divides by
	function jacobian(qs) {
		const act = ACTS[S.act], a = Math.sqrt(S.w / N), norm = NORMS[S.norm];
		const scale = isFinite(qs) && qs > S.b ? Math.sqrt((qs - S.b) / S.w) : 1;
		let h = affine(0, net.x.map(x => scale * x), 1), J = new Float64Array(N * N);
		for (let i = 0; i < N; i++) J[i * N + i] = 1;
		for (let l = 2; l <= S.L; l++) {
			const Z = net.Z[l - 1], dJ = new Float64Array(N * N), next = new Float64Array(N * N), n = normalise(h);
			if (norm) {
				const s = measure(h, 0, norm)[1], mean = new Float64Array(N), along = new Float64Array(N);
				for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { mean[j] += J[i * N + j] / N; along[j] += n[i] * J[i * N + j] / N; }
				for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
					J[i * N + j] = (J[i * N + j] - (norm.centres ? mean[j] : 0) - n[i] * along[j]) / s;
				}
			}
			for (let i = 0; i < N; i++) { const d = act.d(n[i]); for (let j = 0; j < N; j++) dJ[i * N + j] = d * J[i * N + j]; }
			for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) {
				const z = a * Z[i * N + k];
				for (let j = 0; j < N; j++) next[i * N + j] += z * dJ[k * N + j];
			}
			J = next;
			h = affine(l - 1, n.map(act.f), 1);
		}
		// columns of J as rows of its transpose, orthogonalised pairwise
		const A = new Float64Array(N * N);
		for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) A[j * N + i] = J[i * N + j];
		for (let sweep = 0; sweep < 40; sweep++) {
			let rotated = false;
			for (let p = 0; p < N - 1; p++) for (let q = p + 1; q < N; q++) {
				let al = 0, be = 0, ga = 0;
				for (let i = 0; i < N; i++) { const x = A[p * N + i], y = A[q * N + i]; al += x * x; be += y * y; ga += x * y; }
				if (Math.abs(ga) <= 1e-15 * Math.sqrt(al * be)) continue;
				rotated = true;
				const zeta = (be - al) / (2 * ga), t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
				const c = 1 / Math.sqrt(1 + t * t), s = c * t;
				for (let i = 0; i < N; i++) {
					const x = A[p * N + i], y = A[q * N + i];
					A[p * N + i] = c * x - s * y;
					A[q * N + i] = s * x + c * y;
				}
			}
			if (!rotated) break;
		}
		const sv = new Float64Array(N);
		for (let p = 0; p < N; p++) { let s = 0; for (let i = 0; i < N; i++) s += A[p * N + i] ** 2; sv[p] = Math.sqrt(s); }
		return sv;
	}

	// ---- a ring's plane: its top two principal components ----
	// the K rows of N centred, on the top two eigenvectors of their N × N
	// covariance by subspace iteration and a 2 × 2 Rayleigh-Ritz step, in units
	// a unit as ringLength's; and the share of the variance the two hold. Two
	// vectors at once converge however close the top two are, as on a circle,
	// so the test is on the variance their span holds, not on either vector
	function plane2(h) {
		const mean = new Float64Array(N);
		for (let k = 0; k < K; k++) for (let j = 0; j < N; j++) mean[j] += h[k * N + j] / K;
		const X = Float64Array.from(h, (v, i) => v - mean[i % N]), C = new Float64Array(N * N);
		for (let k = 0; k < K; k++) {
			const o = k * N;
			for (let i = 0; i < N; i++) for (let j = i; j < N; j++) C[i * N + j] += X[o + i] * X[o + j];
		}
		let trace = 0;
		for (let i = 0; i < N; i++) {
			trace += C[i * N + i];
			for (let j = 0; j < i; j++) C[i * N + j] = C[j * N + i];
		}
		// a ring that is a point has no plane: its spread is then rounding alone,
		// some 10⁻³² of its size, as when every weight is 0 and a bias is not
		const xy = new Float64Array(2 * K), size = dot(h, h);
		if (!(trace > 1e-24 * size)) return { xy, share: NaN };
		const times = v => {
			const out = new Float64Array(N);
			for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += C[i * N + j] * v[j]; out[i] = s; }
			return out;
		};
		let u = Float64Array.from({ length: N }, (_, j) => Math.sin(1.3 * j + 0.1));
		let v = Float64Array.from({ length: N }, (_, j) => Math.cos(0.7 * j + 0.3));
		let last = 0;
		for (let it = 0; it < 200; it++) {
			const cu = times(u), cv = times(v), held = dot(u, cu) + dot(v, cv);
			// Gram-Schmidt, u first
			const nu = Math.sqrt(dot(cu, cu));
			u = cu.map(x => x / nu);
			const p = dot(u, cv);
			v = cv.map((x, i) => x - p * u[i]);
			const nv = Math.sqrt(dot(v, v));
			v = v.map(x => x / nv);
			if (Math.abs(held - last) < 1e-12 * held) break;
			last = held;
		}
		// the 2 × 2 problem in span(u, v), its eigenvectors the two components
		const cu = times(u), cv = times(v), a = dot(u, cu), b = dot(u, cv), d = dot(v, cv);
		const t = 0.5 * Math.atan2(2 * b, a - d), e1 = u.map((x, i) => Math.cos(t) * x + Math.sin(t) * v[i]), e2 = u.map((x, i) => -Math.sin(t) * x + Math.cos(t) * v[i]);
		for (let k = 0; k < K; k++) {
			let s1 = 0, s2 = 0;
			for (let j = 0; j < N; j++) { s1 += X[k * N + j] * e1[j]; s2 += X[k * N + j] * e2[j]; }
			xy[2 * k] = s1 / Math.sqrt(N);
			xy[2 * k + 1] = s2 / Math.sqrt(N);
		}
		return { xy, share: (dot(e1, times(e1)) + dot(e2, times(e2))) / trace };
	}
	// turn, and mirror if that fits better, a layer's ring onto the layer
	// before's: the orthogonal 2 × 2 R that brings X R closest to P (Procrustes)
	// maximises tr(RᵀM), M = XᵀP, in closed form; a sign flip alone would let
	// two components that are nearly tied spin from layer to layer
	function align(xy, prev) {
		let a = 0, b = 0, c = 0, d = 0;
		for (let k = 0; k < K; k++) {
			const x = xy[2 * k], y = xy[2 * k + 1], px = prev[2 * k], py = prev[2 * k + 1];
			a += x * px; b += x * py; c += y * px; d += y * py;
		}
		const mirror = Math.hypot(a - d, b + c) > Math.hypot(a + d, c - b);
		const t = mirror ? Math.atan2(b + c, a - d) : Math.atan2(c - b, a + d), co = Math.cos(t), si = Math.sin(t);
		for (let k = 0; k < K; k++) {
			const x = xy[2 * k], y = xy[2 * k + 1];
			xy[2 * k] = x * co + y * si;
			xy[2 * k + 1] = mirror ? x * si - y * co : -x * si + y * co;
		}
	}

	// ---- a ridge: a tensor's entries as heights along an axis ----
	// the axes: their values from −range to range in an odd count of bins, so
	// that 0 sits mid-bin, and the height a unit of density stands, as a share
	// of a ridge's room: a standard normal's peak 0.45 of it on SIGNAL
	const SIGNAL = { range: 4, bins: 121, scale: 1.13 };     // z and a
	const WEIGHT = { range: 0.75, bins: 81, scale: 0.19 };   // W
	const TICKS = [-4, -2, 0, 2, 4]; // the values marked along SIGNAL's axis
	const EASE_FROM = 0.7;           // heights ease off from here towards 1, all the room
	const BANDWIDTH = 1.5;           // a kernel's width over spread × count^(−1/5), and its ends in bins
	const KERNEL_MIN = 0.3, KERNEL_MAX = 4;
	const PILE = 8;                  // a bin this many times a typical one's count is a pile
	// a histogram over the axis, each bin's count then spread over its neighbours
	// by a normal kernel. Its width starts from the bins' own spread and their
	// number, as a kernel density's does, and then follows the counts (Abramson
	// 1982): wider where they are thin, narrower where they pile up. A bin that
	// holds many times a typical bin's count is a pile and keeps to itself, and a
	// kernel folds back from a pile or an empty bin as from a wall. So a bell
	// comes out smooth, a point mass stays a needle with the bell beside it whole,
	// and nothing leaks past an edge such as ReLU's 0 or tanh's ±1
	function ridgeOf(axis, values) {
		const { range, bins, scale } = axis, bw = 2 * range / bins, counts = new Float64Array(bins), spread = new Float64Array(bins);
		let inside = 0;
		for (let i = 0; i < values.length; i++) {
			const k = Math.floor((values[i] + range) / bw);
			if (k >= 0 && k < bins) { counts[k]++; inside++; }
		}
		// the quartiles the spread is taken from
		let run = 0, q1 = -1, q3 = -1;
		counts.forEach((c, k) => {
			run += c;
			if (q1 < 0 && run >= inside / 4) q1 = k;
			if (q3 < 0 && run >= 3 * inside / 4) q3 = k;
		});
		// a typical entry's bin: three entries in ten sit in a bin that holds fewer
		let typical = 0;
		run = 0;
		for (const k of [...counts.keys()].sort((p, q) => counts[p] - counts[q])) {
			run += counts[k];
			if (run >= 0.3 * inside) { typical = counts[k]; break; }
		}
		const open = k => counts[k] > 0 && counts[k] <= PILE * typical;
		const base = BANDWIDTH * (q3 - q1) / 1.349 * inside ** -0.2;
		for (let k = 0; k < bins; k++) {
			if (!open(k)) { spread[k] += counts[k]; continue; }
			// the count about the bin sets its kernel's width; the first wall either side bounds it
			const near = ((open(k - 1) ? counts[k - 1] : counts[k]) + 2 * counts[k] + (open(k + 1) ? counts[k + 1] : counts[k])) / 4;
			const width = within(base * typical / near, [KERNEL_MIN, KERNEL_MAX]), reach = Math.ceil(3 * width), share = [];
			let left = 1, right = 1, total = 0;
			while (left <= reach && open(k - left)) left++;
			while (right <= reach && open(k + right)) right++;
			for (let j = -reach; j <= reach; j++) {
				const to = j <= -left ? k - 2 * left + 1 - j : j >= right ? k + 2 * right - 1 - j : k + j;
				if (to <= k - left || to >= k + right) continue;
				const weight = Math.exp(-j * j / (2 * width * width));
				share.push([to, weight]);
				total += weight;
			}
			for (const [to, weight] of share) spread[to] += counts[k] * weight / total;
		}
		const unit = scale / (values.length * bw), h = new Float32Array(bins);
		for (let k = 0; k < bins; k++) {
			const d = unit * spread[k];
			h[k] = d <= EASE_FROM ? d : EASE_FROM + (1 - EASE_FROM) * (1 - Math.exp(-(d - EASE_FROM) / (1 - EASE_FROM)));
		}
		return h;
	}

	// ---- state, and what it computes ----
	const S = { act: 'tanh', norm: 'none', w: 1, b: 0, draw: 'gauss', wiring: 'dense', L: 16, layer: 1, view: 'units' };
	let net = null, data = null;
	// Units: every layer's sums for the river's inputs and their second moment, the same of their gradients,
	// and the one input's sums. What a layer hands on, its sums' spread, its weights' ridge and picture are
	// made when first asked for
	function pooled() {
		const H = pass(), m2 = [];
		for (let l = 1; l <= S.L; l++) m2[l] = meanSq(H[l]);
		return { H, m2, m2b: backward(H), one: single(), handed: [], summed: [], levelled: [], entries: [], tiles: [] };
	}
	// a line's values over the river's inputs, sorted: the span that holds WIDE
	// of them, the rest left out evenly at its two ends, and QN quantiles
	function spread(values) {
		const sorted = Float64Array.from(values).sort(), n = sorted.length, cut = Math.floor(n * (1 - WIDE) / 2);
		return {
			wide: [sorted[cut], sorted[n - 1 - cut]],
			quant: Float64Array.from({ length: QN }, (_, i) => sorted[Math.floor((i + 0.5) / QN * n)]),
		};
	}
	// a line's values over the river's inputs as the panes draw them: their ridge, their second moment and
	// their spread, kept without the values themselves
	const outline = values => ({ ridge: ridgeOf(SIGNAL, values), moment: meanSq(values), ...spread(values) });
	// layer l's sums, the same normalised, ẑˡ, and what it hands on, aˡ = φ(ẑˡ), the input x for layer 0
	const summed = l => (data.summed[l] ||= outline(data.H[l]));
	const levelled = l => (data.levelled[l] ||= outline(normalise(data.H[l])));
	const handed = l => (data.handed[l] ||= outline(l ? normalise(data.H[l]).map(ACTS[S.act].f) : net.rows));
	// the ridge of layer l's weights as its sums use them, σw/√N times each entry that is not 0
	const entries = l => (data.entries[l] ||= ridgeOf(WEIGHT, Float32Array.from(net.Z[l - 1].filter(z => z), z => Math.sqrt(S.w / N) * z)));
	// Shape: each layer's ring on its plane, its length against √χ a layer, and
	// the Jacobian's singular values
	function shape(chi, fp) {
		const H = ring(), rings = [], share = [], len = [], guide = [];
		for (let l = 1; l <= S.L; l++) {
			const p = plane2(H[l]);
			if (l > 1) align(p.xy, rings[l - 1]);
			rings[l] = p.xy;
			share[l] = p.share;
			len[l] = ringLength(H[l]);
		}
		// √χ a layer, χ at each layer's own q, from layer 1's length
		guide[1] = len[1];
		for (let l = 2; l <= S.L; l++) guide[l] = guide[l - 1] * Math.sqrt(chi[l - 1]);
		// in chaos, the most K points can span: each step √(2q*(1 − c*)) a unit
		const ceiling = fp.c < 0.99 ? K * Math.sqrt(2 * fp.q * (1 - fp.c)) : NaN;
		// the first layer the drawn length falls a third short of √χ, on its way to that ceiling
		const bend = isFinite(ceiling) ? len.findIndex((v, l) => l > 1 && v < guide[l] / 1.5) : -1;
		let reach = 0;
		for (const xy of rings.slice(1)) for (let k = 0; k < K; k++) reach = Math.max(reach, Math.hypot(xy[2 * k], xy[2 * k + 1]));
		return { rings, share, len, guide, ceiling, bend, reach, sv: jacobian(fp.q) };
	}
	// mean field's q by layer from unit inputs, χ at each layer's q, the fixed points, and the view's own.
	// Under a norm the activation reads ẑ of variance 1 at every layer, and χ is over the q the norm divides by.
	// Back from the top, E δ² is the last layer's gate, E φ′², and then gains χ a layer going down (qb)
	function compute() {
		if (!net || net.key !== `${S.draw} ${S.wiring}`) net = build(S.draw, S.wiring);
		const act = ACTS[S.act], norm = NORMS[S.norm], q = [], chi = [], gate = [], qb = [];
		q[1] = S.w + S.b;
		for (let l = 1; l <= S.L; l++) {
			const [ef, ed] = moments(act, norm ? 1 : q[l]);
			gate[l] = !norm ? ed : q[l] > 0 ? ed / q[l] : 0;
			chi[l] = S.w * gate[l];
			q[l + 1] = S.w * ef + S.b;
		}
		qb[S.L] = gate[S.L];
		for (let l = S.L - 1; l >= 1; l--) qb[l] = chi[l] * qb[l + 1];
		const fp = fixedPoints(act, S.w, S.b, norm);
		data = { view: S.view, q, qb, fp, ...(S.view === 'units' ? pooled() : shape(chi, fp)) };
	}
	// q*, where mean field's q has come to it by the last layer, and NaN where it has not
	const settled = () => (Math.abs(data.q[S.L] - data.fp.q) < 0.01 * data.fp.q ? data.fp.q : NaN);

	// ---- a pane's furniture ----
	function path(cx, points) {
		cx.beginPath();
		points.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y)));
	}
	const BARE = 30;                 // where a plot starts under a heading with no notes, its words in its card
	// a key a series, each in its colour, along the baseline y from x
	function keyed(cx, keys, x, y) {
		cx.font = FONT;
		for (const [colour, text] of keys) {
			cx.fillStyle = colour;
			cx.fillText(text, x, y);
			x += cx.measureText(text).width + 10;
		}
	}
	// its heading: the title in bold, a key a series beside it, notes under it
	function heading(cx, title, keys, notes = []) {
		cx.textAlign = 'left';
		cx.fillStyle = '#000000';
		cx.font = BOLD;
		cx.fillText(title, 8, 15);
		keyed(cx, keys, 8 + cx.measureText(title).width + 10, 15);
		cx.fillStyle = INK.text;
		notes.forEach((text, i) => cx.fillText(text, 8, 27 + 12 * i));
	}
	// a log axis by layer: for each set its dots as measured, in its ink, the
	// bold layer's larger, and a line beside them; a level dashed across and a
	// layer marked if there are any; two decades at least, about the dots if
	// centred and up from them if not; the plot from y1 down
	function byLayer(cv, sets, level, mark, centred, y1 = 46) {
		const { cx, W, H } = fitCanvas(cv), L = S.L, x0 = 40, x1 = W - 10, y0 = H - 20;
		const X = l => x0 + (l - 1) / (L - 1) * (x1 - x0);
		let lo = Infinity, hi = -Infinity;
		for (const arr of sets.flatMap(set => [set.dots, set.line])) for (let l = 1; l <= L; l++) {
			const v = arr[l];
			if (v > 0 && isFinite(v)) { lo = Math.min(lo, Math.log10(v)); hi = Math.max(hi, Math.log10(v)); }
		}
		if (isFinite(level)) hi = Math.max(hi, Math.log10(level));
		// nothing above 0, as when every weight is 0: a log axis has no place for it
		if (!isFinite(lo)) {
			cx.font = FONT;
			cx.fillStyle = INK.text;
			cx.textAlign = 'center';
			cx.fillText('0 at every layer, below any log axis', (x0 + x1) / 2, (y0 + y1) / 2);
			return cx;
		}
		const mid = Math.round((lo + hi) / 2);
		lo = Math.floor(lo - 0.05);
		hi = Math.ceil(hi + 0.05);
		if (hi - lo < 2 && centred) lo = mid - 1;
		if (hi - lo < 2) hi = lo + 2;
		const Y = v => y0 - (Math.log10(v) - lo) / (hi - lo) * (y0 - y1);
		cx.font = FONT;
		cx.textAlign = 'right';
		const step = Math.max(1, Math.ceil((hi - lo) / 5));
		for (let e = lo; e <= hi; e += step) {
			const y = Math.round(Y(10 ** e)) + 0.5;
			cx.strokeStyle = INK.grid;
			cx.lineWidth = 1;
			cx.beginPath(); cx.moveTo(x0, y); cx.lineTo(x1, y); cx.stroke();
			cx.fillStyle = INK.text;
			cx.fillText(decade(e), x0 - 4, y + 3);
		}
		cx.textAlign = 'center';
		for (const l of [1, L / 2, L]) cx.fillText(String(l), X(l), H - 6);
		if (isFinite(level)) {
			cx.strokeStyle = INK.frame;
			cx.setLineDash([4, 3]);
			cx.beginPath(); cx.moveTo(x0, Y(level)); cx.lineTo(x1, Y(level)); cx.stroke();
			cx.setLineDash([]);
		}
		for (const { dots, line, ink } of sets) {
			cx.strokeStyle = INK.tail;
			cx.lineWidth = 1.2;
			cx.setLineDash([5, 3]);
			cx.beginPath();
			let on = false;
			for (let l = 1; l <= L; l++) {
				const v = line[l];
				if (!(v > 0 && isFinite(v))) { on = false; continue; }
				on ? cx.lineTo(X(l), Y(v)) : cx.moveTo(X(l), Y(v));
				on = true;
			}
			cx.stroke();
			cx.setLineDash([]);
			cx.fillStyle = ink;
			for (let l = 1; l <= L; l++) {
				const v = dots[l];
				if (!(v > 0 && isFinite(v))) continue;
				cx.beginPath(); cx.arc(X(l), Y(v), l === S.layer ? 3.6 : 2.2, 0, 2 * Math.PI); cx.fill();
			}
		}
		if (mark > 0) {
			const x = X(mark);
			cx.strokeStyle = INK.frame;
			cx.lineWidth = 1;
			cx.beginPath(); cx.moveTo(x + 0.5, y1); cx.lineTo(x + 0.5, y0); cx.stroke();
		}
		return cx;
	}
	// a ridge between x0 and x1 on the baseline y, tall the room it has: a wash
	// under it, then its line
	function ridge2(cx, h, x0, x1, y, tall, colour, width, wash) {
		const step = (x1 - x0) / h.length, points = [[x0, y]];
		for (let k = 0; k < h.length; k++) points.push([x0 + (k + 0.5) * step, y - tall * h[k]]);
		points.push([x1, y]);
		path(cx, points);
		cx.globalAlpha = wash;
		cx.fillStyle = colour;
		cx.fill();
		cx.globalAlpha = 1;
		cx.strokeStyle = colour;
		cx.lineWidth = width;
		cx.lineJoin = 'round';
		cx.stroke();
	}

	// ---- Units: three layers on a ground that turns ----
	// value across (u), the layers away from the input (v), height (h). A line
	// is a layer's z or a, a dot a unit of the one input, the input nearest.
	// The ground between two lines takes on their two colours as it goes, as
	// deep as the river's values lie densely there. Between a layer's z and a
	// each unit slides along its own path, so the river there is what the
	// activation does, exactly; between an a line and the next z the weights mix
	// the units rather than move them, so there the one fades into the other.
	// Over it: the ringed unit's terms and its path through every line, each
	// layer's W lying in the gap it acts in, and × W, Σ and σ where each happens
	// it opens turned and tilted, so that it reads as a ground to turn and the ridges and the signs stand
	const ground = { yaw: 0.3, pitch: 0.85 };
	// layers, half the value axis, the a to z gap, the z to a, and the room the view keeps over the far end's middle and its right corner
	const FLOOR = { shown: 3, half: 2.1, gap: 1.5, pair: 0.55, room: [0.75, 0.42] };
	const GROUND_PAD = { l: 34, r: 12, t: 56, b: 40 };   // t clear of the keys, b of the views' buttons in the corner
	const SHEET = { side: 0.85, inset: 0.05, tall: 0.5, full: 0.4 }; // W's: its side, in from the lines' ends, its ridge's height, the entry drawn darkest
	const SIGNS = { lift: 0.12, size: 0.2, before: 0.32 };            // × W, Σ and σ: their height, their size, and how far before the sheets
	// the river: strips a gap; a cell as deep as 1 − e^(−density / scale) of most of the way from the paper to its
	// colour; the counts lightly smoothed across the bins; and the share of that a gap the weights mix keeps
	const RIVER = { steps: 8, scale: 0.22, most: 0.42, smooth: [1, 2, 3, 2, 1], mixed: 0.8 };
	const TENTHS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
	const LETTER = { input: 'x', sum: 'z', norm: 'ẑ', out: 'a' };
	// what the activation reads, the sums or the sums normalised, and its code written so
	const reading = () => (NORMS[S.norm] ? 'ẑ' : 'z');
	const coded = act => act.code.replace('z', reading());
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	// the ringed unit, and each dot drawn with its unit, for the pointer to pick
	let picked = 0, spots = [];
	// what was last drawn, a line a slot, the ease from it if one is under way, and whether the next frame is to start one
	let laid = null, glide = null, eased = false;
	// an orthographic view of a floor, value across (u), depth (v), height (h):
	// turned by yaw about the upright and tilted by pitch, then scaled and placed
	// so that the given points fit the pane inside its padding
	function sight(cam, points, pad, W, H) {
		const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
		const flat = (u, v, h) => [u * cy - v * sy, h * cp + (v * cy + u * sy) * sp];
		const at = points.map(point => flat(...point)), xs = at.map(c => c[0]), ys = at.map(c => c[1]);
		const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
		const w = W - pad.l - pad.r, h = H - pad.t - pad.b, s = Math.min(w / (x1 - x0), h / (y1 - y0));
		const ox = pad.l + (w - s * (x1 - x0)) / 2 - s * x0, oy = pad.t + (h - s * (y1 - y0)) / 2 + s * y1;
		return (u, v, h) => { const [x, y] = flat(u, v, h); return [ox + s * x, oy - s * y]; };
	}
	// the first layer of those drawn: the bold one, or the last that leaves room for the rest
	const first = () => Math.min(S.layer, S.L - FLOOR.shown + 1);
	// this frame's scene: the view, fitted to the ground's corners with room over its far end for the sheets'
	// ridges and the signs, and the lines and layers in it. A line has what it holds, its values for the one
	// input, how far from the input it lies, its name, its second moment and its spread over the river's
	// inputs, and whether its layer is the bold one. A layer has its two lines, z and a, with ẑ between them
	// under a norm, and the line it reads
	function scene(cv) {
		const { cx, W, H } = fitCanvas(cv), act = ACTS[S.act], R = SIGNAL.range, s = first(), { shown, half, gap, pair, room } = FLOOR;
		const norm = NORMS[S.norm], inner = norm ? 2 * pair : pair, deep = shown * (gap + inner);
		const project = sight(ground, [[-half, 0, 0], [half, 0, 0], [-half, deep, 0], [half, deep, 0], [0, deep, room[0]], [half, deep, room[1]]], GROUND_PAD, W, H);
		const across = value => within(value, [-R, R]) / R * half;
		const line = (kind, values, v, name, { moment, wide, quant }, bold) => ({ kind, values, v, name, moment, wide, quant, bold });
		const given = s > 1
			? line('out', normalise(data.one[s - 1]).map(act.f), 0, `a${exeSup(s - 1)}`, handed(s - 1), false)
			: line('input', net.x, 0, 'x', handed(0), false);
		const rows = [];
		for (let i = 0; i < shown; i++) {
			const l = s + i, v = i * (gap + inner) + gap, z = data.one[l], n = normalise(z), sup = exeSup(l), bold = l === S.layer;
			rows.push({
				l, reads: i ? rows[i - 1].out : given,
				sums: line('sum', z, v, `z${sup}`, summed(l), bold),
				level: norm ? line('norm', n, v + pair, `ẑ${sup}`, levelled(l), bold) : null,
				out: line('out', n.map(act.f), v + inner, `a${sup}`, handed(l), bold),
			});
		}
		const lines = [given, ...rows.flatMap(r => [r.sums, ...(r.level ? [r.level] : []), r.out])];
		// a change of layer, or a button's, eases each line in from what its slot last drew; then where its units fall
		if (eased) glide = laid && laid.length === lines.length && !reduced.matches ? { from: laid, t0: performance.now() } : null;
		eased = false;
		const e = glide ? ease(Math.min(1, (performance.now() - glide.t0) / GLIDE_MS)) : 1;
		const KEYS = ['values', 'wide', 'quant'];
		lines.forEach((k, i) => {
			if (glide) for (const key of KEYS) k[key] = k[key].map((x, j) => glide.from[i][key][j] + (x - glide.from[i][key][j]) * e);
			k.at = Array.from(k.values, value => project(across(value), k.v, 0));
		});
		laid = lines.map(k => Object.fromEntries(KEYS.map(key => [key, k[key]])));
		if (e >= 1) glide = null;
		// how long a unit across the ground is on the pane, for the signs' size, which seen from above a unit of height is not
		const [ox, oy] = project(0, 0, 0), [ux, uy] = project(1, 0, 0);
		cx.font = FONT;
		cx.lineJoin = 'round';
		return { cx, act, R, s, half, deep, project, across, rows, lines, top: lines[lines.length - 1], px: Math.hypot(ux - ox, uy - oy) };
	}
	// how densely QN quantiles lie in each of SIGNAL's bins, lightly smoothed, as a share of the deepest the colour goes
	function density(q) {
		const { range, bins } = SIGNAL, bw = 2 * range / bins, counts = new Float64Array(bins), out = new Float64Array(bins);
		const k = RIVER.smooth, r = (k.length - 1) / 2, sum = k.reduce((a, b) => a + b, 0);
		for (const value of q) {
			const b = Math.floor((value + range) / bw);
			if (b >= 0 && b < bins) counts[b]++;
		}
		for (let b = 0; b < bins; b++) {
			let acc = 0;
			for (let j = -r; j <= r; j++) acc += (counts[b + j] || 0) * k[j + r];
			out[b] = 1 - Math.exp(-acc / sum / (QN * bw) / RIVER.scale);
		}
		return out;
	}
	// the river, a strip at a time from the input up: exact where the norm or the activation moves each
	// unit, its quantiles carried across; faded from one line to the next where the weights mix them
	function river({ cx, project, half, lines }) {
		const { bins } = SIGNAL, bw = 2 * half / bins, paper = rgb(INK.paper), own = lines.map(k => density(k.quant));
		for (let i = 0; i + 1 < lines.length; i++) {
			const a = lines[i], b = lines[i + 1], moved = b.kind !== 'sum', from = rgb(KIND[a.kind]), to = rgb(KIND[b.kind]);
			for (let t = 0; t < RIVER.steps; t++) {
				const f = (t + 0.5) / RIVER.steps, colour = from.map((c, j) => c + (to[j] - c) * f);
				const d = moved ? density(a.quant.map((x, j) => x + (b.quant[j] - x) * f)) : own[i].map((x, j) => RIVER.mixed * (x + (own[i + 1][j] - x) * f));
				const v0 = a.v + (b.v - a.v) * t / RIVER.steps, v1 = a.v + (b.v - a.v) * (t + 1) / RIVER.steps;
				for (let k = 0; k < bins; k++) {
					if (d[k] < 0.02) continue;
					// a cell a hair wider than its bin, so that no seam shows between two
					const u0 = -half + k * bw, u1 = u0 + bw + 0.003;
					cx.fillStyle = `rgb(${paper.map((g, j) => Math.round(g + (colour[j] - g) * RIVER.most * d[k])).join(', ')})`;
					path(cx, [project(u0, v0, 0), project(u1, v0, 0), project(u1, v1, 0), project(u0, v1, 0)]);
					cx.fill();
				}
			}
		}
	}
	// the river's flow lines: each tenth of the values from the input up, rank to rank, straight where the
	// norm or the activation moves the units and dotted where the weights mix them and a rank is all that carries over
	function flow({ cx, project, across, lines }) {
		cx.strokeStyle = 'rgba(60, 50, 40, 0.3)';
		cx.lineWidth = 0.7;
		for (const share of TENTHS) {
			const at = lines.map(k => project(across(k.quant[Math.floor(share * QN)]), k.v, 0));
			for (let i = 0; i + 1 < lines.length; i++) {
				cx.setLineDash(lines[i + 1].kind === 'sum' ? [1, 2.5] : []);
				path(cx, [at[i], at[i + 1]]);
				cx.stroke();
			}
		}
		cx.setLineDash([]);
	}
	// the values marked under the first line, and 0 from the first line to the last
	function ticks({ cx, project, across, deep }) {
		cx.lineWidth = 1;
		cx.strokeStyle = INK.grid;
		path(cx, [project(0, 0, 0), project(0, deep, 0)]);
		cx.stroke();
		cx.strokeStyle = INK.frame;
		cx.fillStyle = INK.text;
		cx.textAlign = 'center';
		for (const value of TICKS) {
			const [x, y] = project(across(value), 0, 0);
			path(cx, [[x, y], [x, y + 3]]);
			cx.stroke();
			cx.fillText(tickText(value), x, y + 13);
		}
	}
	// a layer's weights as a picture, a pixel an entry, as strong as the entry
	// is large against SHEET.full; made when first drawn
	function tile(l) {
		if (data.tiles[l]) return data.tiles[l];
		const cv = document.createElement('canvas'), Z = net.Z[l - 1], a = Math.sqrt(S.w / N), colour = rgb(INK.weight);
		cv.width = cv.height = N;
		const cx = cv.getContext('2d'), image = cx.createImageData(N, N);
		for (let i = 0; i < N * N; i++) {
			image.data.set(colour, 4 * i);
			image.data[4 * i + 3] = 255 * Math.min(1, Math.abs(a * Z[i]) / SHEET.full);
		}
		cx.putImageData(image, 0, 0);
		return (data.tiles[l] = cv);
	}
	// a ridge standing on the ground between two points of a line, its heights as shares of how tall it may stand
	function stand({ cx, project }, heights, u0, u1, v, tall, colour, width, wash) {
		const step = (u1 - u0) / heights.length, points = [project(u0, v, 0)];
		for (let k = 0; k < heights.length; k++) points.push(project(u0 + (k + 0.5) * step, v, tall * heights[k]));
		points.push(project(u1, v, 0));
		path(cx, points);
		cx.globalAlpha = wash;
		cx.fillStyle = colour;
		cx.fill();
		cx.globalAlpha = 1;
		cx.strokeStyle = colour;
		cx.lineWidth = width;
		cx.stroke();
	}
	// text laid along the ground from a point, in the direction of the lines
	function along({ cx, project }, text, u, v, dx, dy, colour) {
		const [x, y] = project(u, v, 0), [x1, y1] = project(u + 1, v, 0);
		cx.save();
		cx.translate(x, y);
		cx.rotate(Math.atan2(y1 - y, x1 - x));
		cx.textAlign = 'left';
		cx.fillStyle = colour;
		cx.fillText(text, dx, dy);
		cx.restore();
	}
	// a layer's W lying on the ground, its picture laid on the square the view makes of it, the ridge of its
	// entries behind it and its name before it
	function lie(sc, l, u, v) {
		const { cx, project } = sc, side = SHEET.side, name = `W${exeSup(l)}`;
		const near = project(u, v, 0), right = project(u + side, v, 0), far = project(u, v + side, 0);
		cx.save();
		cx.transform((right[0] - near[0]) / N, (right[1] - near[1]) / N, (far[0] - near[0]) / N, (far[1] - near[1]) / N, near[0], near[1]);
		cx.imageSmoothingEnabled = false;
		cx.fillStyle = INK.paper;
		cx.fillRect(0, 0, N, N);
		cx.drawImage(tile(l), 0, 0);
		cx.restore();
		cx.strokeStyle = INK.frame;
		cx.lineWidth = 1;
		path(cx, [near, right, project(u + side, v + side, 0), far, near]);
		cx.stroke();
		stand(sc, entries(l), u, u + side, v + side, SHEET.tall, INK.weight, 1.3, 0.14);
		along(sc, name, u, v, 2, 11, INK.weight);
		along(sc, `, Var W ${fmt(S.w / net.fanIn)}`, u, v, 2 + cx.measureText(name).width, 11, INK.text);
	}
	// what the ringed unit's sum is made of, a link a term W a of it, as thick and as strong as the term is
	// large against the largest, solid where it adds and dashed where it takes away; then its own norm and activation
	function terms({ cx, rows }) {
		cx.strokeStyle = INK.weight;
		for (const { l, reads, sums } of rows) {
			const Z = net.Z[l - 1], term = Array.from(reads.values, (v, j) => Z[picked * N + j] * v), most = Math.max(...term.map(Math.abs)) || 1;
			for (let j = 0; j < N; j++) {
				if (!term[j]) continue;
				const share = Math.abs(term[j]) / most;
				cx.globalAlpha = 0.12 + 0.88 * share;
				cx.lineWidth = 0.4 + 1.6 * share;
				cx.setLineDash(term[j] > 0 ? [] : [2, 2]);
				path(cx, [reads.at[j], sums.at[picked]]);
				cx.stroke();
			}
		}
		cx.setLineDash([]);
		cx.globalAlpha = 1;
		cx.lineWidth = 1.8;
		if (rows[0].level) {
			cx.strokeStyle = INK.norm;
			cx.beginPath();
			for (const { sums, level } of rows) { cx.moveTo(...sums.at[picked]); cx.lineTo(...level.at[picked]); }
			cx.stroke();
		}
		cx.strokeStyle = INK.act;
		cx.beginPath();
		for (const { sums, level, out } of rows) { cx.moveTo(...(level || sums).at[picked]); cx.lineTo(...out.at[picked]); }
		cx.stroke();
	}
	// the dots on each line, the nearest last, each on a white rim, one past the axis hollow, the ringed unit's larger
	const DOT = { r: 1.6, rim: 0.8, ring: 3.2 };
	function beads({ cx, R, lines }) {
		for (const k of lines.slice().reverse()) {
			cx.globalAlpha = 0.9;
			cx.strokeStyle = '#ffffff';
			cx.lineWidth = 2 * DOT.rim;
			for (const [x, y] of k.at) { cx.beginPath(); cx.arc(x, y, DOT.r, 0, 2 * Math.PI); cx.stroke(); }
			cx.fillStyle = cx.strokeStyle = KIND[k.kind];
			cx.lineWidth = 1;
			k.at.forEach(([x, y], i) => {
				cx.beginPath(); cx.arc(x, y, DOT.r, 0, 2 * Math.PI);
				Math.abs(k.values[i]) > R ? cx.stroke() : cx.fill();
				spots.push([x, y, i]);
			});
			cx.globalAlpha = 1;
			cx.beginPath(); cx.arc(...k.at[picked], DOT.ring, 0, 2 * Math.PI); cx.fill();
			cx.strokeStyle = '#000000';
			cx.lineWidth = 1.4;
			cx.stroke();
		}
	}
	// a sign floating over the ground, facing the viewer whatever the turn, as large as the scene is near
	function float({ cx, project, px }, text, u, v, italic) {
		const [x, y] = project(u, v, SIGNS.lift);
		cx.font = `${italic ? 'italic ' : ''}${Math.round(SIGNS.size * px)}px ${SERIF}`;
		cx.textAlign = 'center';
		cx.textBaseline = 'middle';
		cx.lineWidth = 4;
		cx.strokeStyle = '#ffffff';
		cx.strokeText(text, x, y);
		cx.fillStyle = INK.sign;
		cx.fillText(text, x, y);
		cx.textBaseline = 'alphabetic';
		cx.font = FONT;
	}
	// each line named at its left end, the bold layer's two in black, with its second moment along it
	function names(sc) {
		const { cx, project, half, lines } = sc;
		for (const { kind, name, v, moment, bold } of lines) {
			const [x, y] = project(-half, v, 0);
			cx.textAlign = 'right';
			cx.fillStyle = bold ? '#000000' : INK.text;
			cx.font = NAME;
			cx.fillText(name, x - 6, y + 3);
			cx.font = FONT;
			along(sc, `E ${LETTER[kind]}² ${fmt(moment)}`, -half, v, 6, -5, INK.text);
		}
	}
	// the pane's title, and its keys on a line of their own under it
	function titled({ cx, s, act }) {
		const norm = NORMS[S.norm];
		heading(cx, `Layers ${s} to ${s + FLOOR.shown - 1}`, []);
		keyed(cx, [...(s > 1 ? [] : [[INK.input, '● x']]), [INK.ink, '● z = Wa + b'], ...(norm ? [[INK.norm, `● ẑ = ${norm.label}(z)`]] : []),
			[INK.act, `● a = ${coded(act)}`], [INK.weight, '— adds'], [INK.weight, '╌ takes away'], [INK.text, `┄ ${100 * WIDE}%`]], 8, 28);
	}
	function drawGround(cv) {
		const sc = scene(cv), { cx, project, across, half, deep, rows, lines, top } = sc;
		spots = [];
		// a hairline at each tick, under the river; ticks draws 0's again over it
		cx.lineWidth = 1;
		cx.strokeStyle = INK.grid;
		for (const value of TICKS) { path(cx, [project(across(value), 0, 0), project(across(value), deep, 0)]); cx.stroke(); }
		river(sc);
		ticks(sc);
		flow(sc);
		// the lines over it
		cx.strokeStyle = '#ffffff';
		cx.lineWidth = 1.2;
		for (const { v } of lines) { path(cx, [project(-half, v, 0), project(half, v, 0)]); cx.stroke(); }
		// the span that holds WIDE of each line's values, dashed, from the input up
		cx.setLineDash([1.5, 2.5]);
		cx.strokeStyle = INK.frame;
		cx.lineWidth = 1;
		for (const end of [0, 1]) { path(cx, lines.map(k => project(across(k.wide[end]), k.v, 0))); cx.stroke(); }
		cx.setLineDash([]);
		// each W lying in the gap it acts in, at the river's right
		const u = half - SHEET.inset - SHEET.side;
		for (const { l, reads } of rows) lie(sc, l, u, reads.v + (FLOOR.gap - SHEET.side) / 2);
		// the ringed unit's terms, its path through every line, and the dots
		terms(sc);
		cx.strokeStyle = '#000000';
		cx.lineWidth = 1;
		path(cx, lines.map(k => k.at[picked]));
		cx.stroke();
		beads(sc);
		// the signs in a column just before the sheets, read from the input up: × W and Σ in the gap the
		// weights act in, × W near the line they read and Σ near the sums, the norm's between z and ẑ, and
		// σ between what the activation reads and a
		for (const { reads, sums, level, out } of rows) {
			float(sc, '× W', u - SIGNS.before, reads.v + FLOOR.gap * 0.3);
			float(sc, 'Σ', u - SIGNS.before, reads.v + FLOOR.gap * 0.72);
			if (level) float(sc, NORMS[S.norm].sign, u - SIGNS.before, (sums.v + level.v) / 2);
			float(sc, 'σ', u - SIGNS.before, ((level || sums).v + out.v) / 2, true);
		}
		names(sc);
		// the ringed unit numbered over its dot on the last line
		const [x, y] = top.at[picked];
		cx.textAlign = 'center';
		cx.fillStyle = '#000000';
		cx.fillText(`unit ${picked + 1}`, x, y - 9);
		titled(sc);
	}
	// each layer's second moment by layer, and its gradient's from the top down, each against mean field's
	function drawMoment(cv) {
		const level = settled(), sets = [{ dots: data.m2, line: data.q, ink: INK.ink }, { dots: data.m2b, line: data.qb, ink: INK.grad }];
		const cx = byLayer(cv, sets, level, 0, true, BARE);
		heading(cx, 'E z² and E δz², layer by layer', [[INK.ink, '● E z²'], [INK.grad, '● E δz²'], [INK.tail, '╌ mean field'],
			...(isFinite(level) ? [[INK.frame, '┄ q*']] : [])]);
	}
	// the activation at the bold layer: its curve with that layer's units on
	// it, the ridge of its sums under it, and at its right the ridge of what it
	// makes of them, which the next layer reads
	const GRAPH = { l: 30, r: 50, t: BARE + 8, b: 48, ridge: 26, margin: 0.12, steps: 160 };
	function drawGraph(cv) {
		const { cx, W, H } = fitCanvas(cv), act = ACTS[S.act], l = S.layer, sup = exeSup(l), R = SIGNAL.range;
		const x0 = GRAPH.l, x1 = W - GRAPH.r, y0 = H - GRAPH.b, y1 = GRAPH.t, yb = y0 + 4 + GRAPH.ridge, xb = x1 + 5;
		// up, as much of the activation's range as the sums' axis holds, and a margin
		const lo = Math.max(act.lo, -R), hi = Math.min(act.hi, R), pad = GRAPH.margin * (hi - lo), v0 = Math.max(-R, lo - pad), v1 = Math.min(R, hi + pad);
		const X = z => x0 + (z + R) / (2 * R) * (x1 - x0), Y = v => y0 - (v - v0) / (v1 - v0) * (y0 - y1);
		cx.font = FONT;
		// the axes through 0, the frame's two sides, and the values up it
		cx.lineWidth = 1;
		cx.strokeStyle = INK.grid;
		path(cx, [[Math.round(X(0)) + 0.5, y1], [Math.round(X(0)) + 0.5, y0]]);
		cx.stroke();
		path(cx, [[x0, Math.round(Y(0)) + 0.5], [x1, Math.round(Y(0)) + 0.5]]);
		cx.stroke();
		cx.strokeStyle = INK.frame;
		path(cx, [[x0 + 0.5, y1], [x0 + 0.5, y0 + 0.5], [x1, y0 + 0.5]]);
		cx.stroke();
		cx.fillStyle = INK.text;
		cx.textAlign = 'right';
		for (const v of act.ticks) cx.fillText(tickText(v), x0 - 4, Y(v) + 3);
		// its range up the right side
		cx.fillStyle = INK.act;
		cx.globalAlpha = 0.3;
		cx.fillRect(x1 - 4.5, Y(hi), 9, Y(lo) - Y(hi));
		cx.globalAlpha = 1;
		// the curve, and its slope φ′ dashed, the gate a gradient passes back through
		const curve = f => Array.from({ length: GRAPH.steps + 1 }, (_, i) => { const z = -R + 2 * R * i / GRAPH.steps; return [X(z), Y(f(z))]; });
		path(cx, curve(act.d));
		cx.strokeStyle = INK.grad;
		cx.lineWidth = 1.4;
		cx.setLineDash([2, 2]);
		cx.stroke();
		cx.setLineDash([]);
		path(cx, curve(act.f));
		cx.strokeStyle = INK.act;
		cx.lineWidth = 1.8;
		cx.lineJoin = 'round';
		cx.stroke();
		// the layer's units for the one input, each where its sum, or the norm, put it on the curve, and the ringed one's way through
		const z = normalise(data.one[l]);
		cx.fillStyle = '#000000';
		cx.globalAlpha = 0.45;
		for (let i = 0; i < N; i++) {
			if (Math.abs(z[i]) > R) continue;
			cx.beginPath(); cx.arc(X(z[i]), Y(act.f(z[i])), 1.8, 0, 2 * Math.PI); cx.fill();
		}
		cx.globalAlpha = 1;
		if (Math.abs(z[picked]) <= R) {
			const px = X(z[picked]), py = Y(act.f(z[picked]));
			cx.strokeStyle = INK.frame;
			cx.lineWidth = 1;
			cx.setLineDash([3, 3]);
			path(cx, [[px, y0], [px, py], [x1, py]]);
			cx.stroke();
			cx.setLineDash([]);
			cx.beginPath(); cx.arc(px, py, 3.4, 0, 2 * Math.PI); cx.fill();
		}
		// under it the ridge of what the curve reads, the layer's sums or the same normalised, on its axis
		const norm = NORMS[S.norm];
		cx.strokeStyle = INK.frame;
		path(cx, [[x0, yb + 0.5], [x1, yb + 0.5]]);
		cx.stroke();
		cx.fillStyle = INK.text;
		cx.textAlign = 'center';
		for (const v of TICKS) cx.fillText(tickText(v), X(v), yb + 12);
		ridge2(cx, (norm ? levelled(l) : summed(l)).ridge, x0, x1, yb, GRAPH.ridge, norm ? INK.norm : INK.ink, 1.4, 0.14);
		// at its right the ridge of what it makes of them, on its side
		const made = handed(l).ridge, bw = 2 * R / made.length, points = [];
		for (let k = 0; k < made.length; k++) {
			const v = -R + (k + 0.5) * bw;
			if (v >= v0 && v <= v1) points.push([xb + GRAPH.ridge * made[k], Y(v)]);
		}
		path(cx, [[xb, points[0][1]], ...points, [xb, points[points.length - 1][1]]]);
		cx.globalAlpha = 0.14;
		cx.fillStyle = INK.act;
		cx.fill();
		cx.globalAlpha = 1;
		cx.strokeStyle = INK.act;
		cx.lineWidth = 1.4;
		cx.stroke();
		cx.fillStyle = '#000000';
		cx.textAlign = 'left';
		cx.fillText(`a${sup}`, xb, y1 - 5);
		cx.fillText(`${reading()}${sup}`, xb + 3, yb + 3);
		heading(cx, `a = ${coded(act)} at layer ${l}`, [[INK.grad, '┄ φ′, the gate going back']]);
	}

	// ---- Shape: the ring as a tube, turned by a drag ----
	// the depth across (x), the two components in the ring's plane (y, z); the
	// view turns by yaw about z, then tilts by pitch towards the viewer, and a
	// point projects orthographically to [x, y, depth], depth larger nearer
	const view = { yaw: -0.35, pitch: 0.24 };
	const DEPTH = 1.7, RADIUS = 0.8;
	const LABEL_GAP = 8;             // the least room between two of its layer labels
	const LABEL_UP = 32;             // their baseline over the pane's foot, clear of the views' buttons in its corner
	function project(p, W, H, scale) {
		const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
		const x1 = cy * p[0] - sy * p[1], y1 = sy * p[0] + cy * p[1];
		return [W / 2 + scale * x1, H / 2 + 8 - scale * (p[2] * cp + y1 * sp), -y1 * cp + p[2] * sp];
	}
	const fade = depth => 0.25 + 0.75 * within((depth + 1.8) / 3.6, [0, 1]);
	// a hue round the ring, dark enough to read on white
	const hue = k => `hsl(${Math.round(360 * k / K)}, 55%, 38%)`;
	function drawRing(cv) {
		const { cx, W, H } = fitCanvas(cv), L = S.L, s = data.reach ? RADIUS / data.reach : 0;
		const scale = Math.min(W / 4.2, H / 2.6), along = l => ((l - 1) / (L - 1) * 2 - 1) * DEPTH;
		const at = (l, k) => project([along(l), s * data.rings[l][2 * k], s * data.rings[l][2 * k + 1]], W, H, scale);
		// the axis down the middle, and the layers along the pane's foot under it
		cx.font = FONT;
		const a0 = project([-DEPTH, 0, 0], W, H, scale), a1 = project([DEPTH, 0, 0], W, H, scale);
		cx.strokeStyle = INK.frame;
		cx.lineWidth = 1;
		cx.beginPath(); cx.moveTo(a0[0], a0[1]); cx.lineTo(a1[0], a1[1]); cx.stroke();
		cx.fillStyle = INK.text;
		cx.textAlign = 'center';
		// the nearest first, and one that would print over another left out, as when the tube is end on
		const marks = [1, L / 2, L].map(l => ({ text: `l = ${l}`, at: project([along(l), 0, 0], W, H, scale) })).sort((p, q) => q.at[2] - p.at[2]), placed = [];
		for (const { text, at: [x] } of marks) {
			const half = (cx.measureText(text).width + LABEL_GAP) / 2;
			if (placed.some(p => Math.abs(p.x - x) < p.half + half)) continue;
			cx.fillText(text, x, H - LABEL_UP);
			placed.push({ x, half });
		}
		// a spine for every arc's first input, through the layers
		for (let i = 0; i < ARCS; i++) {
			const k = i * K / ARCS;
			cx.strokeStyle = hue(k);
			cx.lineWidth = 0.7;
			for (let l = 2; l <= L; l++) {
				const p = at(l - 1, k), q = at(l, k);
				cx.globalAlpha = 0.5 * fade(q[2]);
				cx.beginPath(); cx.moveTo(p[0], p[1]); cx.lineTo(q[0], q[1]); cx.stroke();
			}
		}
		// each layer's ring in arcs, the bold one last
		const drawn = (l, width, alpha) => {
			for (let i = 0; i < ARCS; i++) {
				const k0 = i * K / ARCS, pts = [];
				for (let k = k0; k <= k0 + K / ARCS; k++) pts.push(at(l, k % K));
				cx.strokeStyle = hue(k0 + K / ARCS / 2);
				cx.lineWidth = width;
				cx.globalAlpha = alpha === undefined ? fade(pts[K / ARCS / 2][2]) : alpha;
				cx.beginPath();
				pts.forEach(([x, y], j) => (j ? cx.lineTo(x, y) : cx.moveTo(x, y)));
				cx.stroke();
			}
		};
		for (let l = 1; l <= L; l++) if (l !== S.layer) drawn(l, 0.9);
		drawn(S.layer, 2.4, 1);
		cx.globalAlpha = 1;
		heading(cx, `A ring of ${K} inputs, layer by layer`, [], ['each layer on its own top two principal components · drag to turn']);
		drawInset(cx, W);
	}
	// the bold layer's ring alone in the corner, scaled to fit, so its shape
	// shows however small it has grown
	function drawInset(cx, W) {
		const SIZE = 94, x0 = W - SIZE - 8, y0 = 8, xy = data.rings[S.layer];
		let r = 0;
		for (let k = 0; k < K; k++) r = Math.max(r, Math.abs(xy[2 * k]), Math.abs(xy[2 * k + 1]));
		cx.fillStyle = '#ffffff';
		cx.fillRect(x0, y0, SIZE, SIZE);
		cx.strokeStyle = INK.frame;
		cx.lineWidth = 1;
		cx.strokeRect(x0 - 0.5, y0 - 0.5, SIZE + 1, SIZE + 1);
		const m = (SIZE / 2 - 6) / (r || 1), X = k => x0 + SIZE / 2 + m * xy[2 * (k % K)], Y = k => y0 + SIZE / 2 - m * xy[2 * (k % K) + 1];
		cx.lineWidth = 1.4;
		for (let i = 0; i < ARCS; i++) {
			const k0 = i * K / ARCS;
			cx.strokeStyle = hue(k0 + K / ARCS / 2);
			cx.beginPath();
			for (let k = k0; k <= k0 + K / ARCS; k++) k === k0 ? cx.moveTo(X(k), Y(k)) : cx.lineTo(X(k), Y(k));
			cx.stroke();
		}
		cx.fillStyle = INK.text;
		cx.textAlign = 'center';
		cx.fillText(`layer ${S.layer}, scaled to fit`, x0 + SIZE / 2, y0 + SIZE + 12);
	}
	// the ring's length by layer, on a log axis
	function drawLength(cv) {
		const cx = byLayer(cv, [{ dots: data.len, line: data.guide, ink: INK.ink }], data.ceiling, data.bend), notes = [];
		if (isFinite(data.ceiling)) notes.push(`dashed, the most ${K} points can span, K√(2q*(1 − c*))`);
		if (data.bend > 0) notes.push(`from layer ${data.bend} it falls short, as neighbours near any two’s distance`);
		heading(cx, 'The ring’s length', [[INK.ink, '● measured'], [INK.tail, '╌ √χ a layer']], notes);
	}
	// the Jacobian's singular values, a histogram of log₁₀ σ
	function drawJacobian(cv) {
		const { cx, W, H } = fitCanvas(cv), x0 = 30, x1 = W - 10, y0 = H - 20, y1 = 34;
		const bins = Math.round((SV_HI - SV_LO) / SV_BIN), counts = new Float64Array(bins);
		let below = 0, above = 0;
		for (const sv of data.sv) {
			const e = Math.log10(sv);
			if (!(e >= SV_LO)) below++;
			else if (e >= SV_HI) above++;
			else counts[Math.floor((e - SV_LO) / SV_BIN)]++;
		}
		// an end bin either side for σ past the axis, one bar's width from the bins
		const bw = (x1 - x0) / (bins + 4), X = e => x0 + 2 * bw + (e - SV_LO) / (SV_HI - SV_LO) * bins * bw;
		const max = Math.max(1, below, above, ...counts), tall = v => v / max * (y0 - y1);
		cx.font = FONT;
		cx.fillStyle = INK.bad;
		cx.fillRect(x0, y0 - tall(below), bw - 1, tall(below));
		cx.fillRect(x1 - bw, y0 - tall(above), bw - 1, tall(above));
		cx.fillStyle = INK.ink;
		counts.forEach((v, i) => cx.fillRect(X(SV_LO + i * SV_BIN), y0 - tall(v), Math.max(1, bw - 1), tall(v)));
		cx.strokeStyle = INK.frame;
		cx.lineWidth = 1;
		cx.beginPath(); cx.moveTo(x0, y0 + 0.5); cx.lineTo(x1, y0 + 0.5); cx.stroke();
		// σ = 1
		cx.strokeStyle = INK.tail;
		cx.lineWidth = 1.5;
		cx.beginPath(); cx.moveTo(X(0), y1 - 4); cx.lineTo(X(0), y0); cx.stroke();
		cx.fillStyle = INK.text;
		cx.textAlign = 'left';
		cx.fillText('< 10⁻⁸', x0, H - 6);
		cx.textAlign = 'right';
		cx.fillText('> 10', x1, H - 6);
		cx.textAlign = 'center';
		for (const e of [-6, -4, -2, 0]) cx.fillText(decade(e), X(e), H - 6);
		cx.fillStyle = INK.tail;
		cx.fillText('σ = 1', X(0), y1 - 6);
		heading(cx, `The Jacobian ∂zᴸ/∂z¹, its ${N} singular values`, [], [`from one input at q*, ${weightsLabel()}`]);
	}

	// ---- the views: what each pane draws and says it is, and the view's readings ----
	const VIEWS = {
		units: {
			main: [drawGround, 'Three layers of the stack on a ground that turns: each unit a dot at its value on its layer’s line, the ground coloured by how densely the values lie, the terms of one unit’s sum, and each layer’s weights as a sheet with the ridge of its entries; point at a unit to follow it, drag to turn'],
			top: [drawMoment, 'Each layer’s second moment, and its gradient’s from the top down, measured as dots, each against mean field’s'],
			foot: [drawGraph, 'The activation’s curve with its slope dashed and the bold layer’s units on it, the ridge of that layer’s sums under it and the ridge of what it makes of them at its right'],
			read: () => {
				const l = S.layer, n = net.fanIn, taken = handed(l - 1).moment, read = l > 1 ? 'a' : 'x', norm = NORMS[S.norm];
				return [
					['E z²', `${fmt(data.m2[l])} <span>measured</span>`],
					[`${n === N ? 'N' : 'n'} Var W E ${read}² + σb²`, `${fmt(S.w * taken + S.b)} <span>= ${n} × ${fmt(S.w / n)} × ${fmt(taken)} + ${fmt(S.b)}</span>`],
					...(norm ? [['E ẑ²', `${fmt(levelled(l).moment)} <span>after ${norm.label}</span>`]] : []),
				];
			},
		},
		shape: {
			main: [drawRing, 'A ring of inputs layer by layer, each on its own top two principal components, laid along the depth as a tube; drag to turn'],
			top: [drawLength, 'The ring’s length by layer, measured as dots, against √χ a layer'],
			foot: [drawJacobian, 'Histogram of the input-output Jacobian’s singular values on a log scale'],
			read: () => {
				const sv = data.sv, ms2 = sv.reduce((s, x) => s + x * x, 0) / sv.length, near = sv.filter(x => x >= 0.5 && x <= 2).length / sv.length;
				return [
					['top two components', `${fmt(100 * data.share[S.layer])}% <span>of the variance</span>`],
					['mean σ²', `${fmt(ms2)} <span>measured</span> ${fmt(data.fp.chi ** (S.L - 1))} <span>χ₁ᴸ⁻¹</span>`],
					['σ within ×2 of 1', `${fmt(100 * near)}%`],
				];
			},
		},
	};
	const panes = $$('[data-pane]');
	// what to look at, in the readings' card: a norm's where one is on, a scale's own words where its button
	// is down, else the activation's, a convolution's in Units, or Shape's phase
	function caption() {
		const down = method();
		if (down === 'zero') return ZERO[S.view];
		if (NORMS[S.norm]) return S.view === 'units' ? NORMED.units[S.norm] : NORMED.shape[S.act];
		if (S.wiring === 'conv' && S.view === 'units') return S.draw === 'orth' ? DELTA : SLID;
		const said = SAID[S.view][S.act]?.[down];
		if (said) return said;
		if (S.view === 'units') return HANDS[S.act];
		return OWN[S.act] || PHASES.find(p => data.fp.chi < p.below).text;
	}
	function readout() {
		$('[data-out="read"]').innerHTML = VIEWS[S.view].read().map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('');
		$('[data-out="caption"]').textContent = caption();
	}
	function draw() {
		for (const cv of panes) VIEWS[S.view][cv.dataset.pane][0](cv);
	}

	// ---- one update a frame: a change recomputes, a drag or the layer only redraws ----
	let pending = null;
	function update(recompute) {
		if (pending) { pending.recompute ||= recompute; return; }
		pending = { recompute };
		requestAnimationFrame(() => {
			const { recompute } = pending;
			pending = null;
			if (!root.isConnected) return;
			if (recompute || data.view !== S.view) compute();
			draw();
			readout();
			sync();
			say(`${exeState(running, S.layer >= S.L)} · layer ${S.layer} of ${S.L} · ${[weightsLabel(), NORMS[S.norm]?.label].filter(Boolean).join(', ')} · χ₁ = ${fmt(data.fp.chi)} at q* = ${fmt(data.fp.q)}`);
			// the ground drawn again next frame while it eases
			if (glide) update(false);
		});
	}

	// ---- the toolbar ----
	const wIn = $('[data-in="w"]'), bIn = $('[data-in="b"]'), atField = $('[data-out="at"]'), ends = exeEnds(root);
	const press = (sel, key, value) => $$(sel).forEach(b => exePress(b, b.dataset[key] === value));
	// the controls as the state is
	function sync() {
		wIn.value = Math.round(S.w * 100);
		bIn.value = vOf(S.b);
		$('[data-out="w"]').textContent = String(+S.w.toPrecision(4));
		$('[data-out="b"]').textContent = fmt(S.b);
		// the layer it is at, and the field filled as far down the stack
		atField.textContent = `layer ${S.layer} of ${S.L}`;
		atField.style.setProperty('--at', Math.round((S.layer - 1) / (S.L - 1) * atField.clientWidth) + 'px');
		press('[data-act-f]', 'actF', S.act);
		press('[data-norm]', 'norm', S.norm);
		press('[data-draw]', 'draw', S.draw);
		press('[data-wiring]', 'wiring', S.wiring);
		press('[data-method]', 'method', method() || '');
		press('[data-view]', 'view', S.view);
		ends(S.layer <= 1, S.layer >= S.L);
		// each pane named for what its view draws, and its card the view's notes
		for (const cv of panes) cv.setAttribute('aria-label', VIEWS[S.view][cv.dataset.pane][1]);
		$$('[data-note][data-for]').forEach(p => { p.hidden = p.dataset.for !== S.view; });
	}
	// a button's change eases the ground in from what it last drew; a slider's is smooth already
	const set = (change, glides) => {
		Object.assign(S, change);
		if (glides) eased = true;
		update(true);
	};
	$$('[data-act-f]').forEach(b => b.addEventListener('click', () => set({ act: b.dataset.actF }, true)));
	// a norm's button again takes it off, as optimiser.exe's AMP does
	$$('[data-norm]').forEach(b => b.addEventListener('click', () => set({ norm: S.norm === b.dataset.norm ? 'none' : b.dataset.norm }, true)));
	$$('[data-draw]').forEach(b => b.addEventListener('click', () => set({ draw: b.dataset.draw }, true)));
	$$('[data-wiring]').forEach(b => b.addEventListener('click', () => set({ wiring: b.dataset.wiring }, true)));
	// a scale sets the weights' variance and no bias, whatever the activation, the draw and the layer
	$$('[data-method]').forEach(b => b.addEventListener('click', () => set(METHODS[b.dataset.method], true)));
	// another view leaves any ease of the ground behind
	$$('[data-view]').forEach(b => b.addEventListener('click', () => {
		S.view = b.dataset.view;
		glide = null;
		update(false);
	}));
	wIn.addEventListener('input', () => set({ w: wIn.value / 100 }));
	bIn.addEventListener('input', () => set({ b: bOf(+bIn.value) }));
	$('[data-in="L"]').addEventListener('change', e => {
		S.L = +e.target.value;
		S.layer = Math.min(S.layer, S.L);
		update(true);
	});
	// the bold layer to another, the ground easing there
	const go = layer => {
		S.layer = within(layer, [1, S.L]);
		eased = true;
		update(false);
	};
	exeSeekBar(atField, share => go(1 + Math.round(share * (S.L - 1))));

	// ---- the transport: the bold layer to the first, back n layers, on n or to
	// the last, greyed at the stack's two ends; and Run, from layer 1 to the
	// last, a layer a step at the speed chosen ----
	const STEP = { start: () => 1, back: (l, n) => l - n, next: (l, n) => l + n, end: () => S.L };
	$$('.exe-buttons [data-act]').forEach(b => b.addEventListener('click', () => go(STEP[b.dataset.act](S.layer, 1))));
	const runBtn = $('[data-act="run"]');
	let running = 0, last = 0, speed = 1;
	exeSpeed($('[data-in="speed"]'), speed, v => { speed = v; });
	function stop() {
		cancelAnimationFrame(running);
		running = 0;
		exeRunning(runBtn, false);
		update(false);
	}
	function tick(now) {
		if (!running || !root.isConnected) return;
		if (now - last >= STEP_MS / speed) {
			last = now;
			go(S.layer + 1);
		}
		if (S.layer >= S.L) stop();
		else running = requestAnimationFrame(tick);
	}
	function run() {
		if (running) {
			stop();
			return;
		}
		if (S.layer >= S.L) go(1);
		exeRunning(runBtn, true);
		last = performance.now();
		running = requestAnimationFrame(tick);
	}
	runBtn.addEventListener('click', run);
	// the keys wherever the focus is in the window but on a control, whose keys
	// are its own, as optimiser.exe's: Space runs, the arrows step, Shift ten,
	// Home and End go to the ends; presses keep them with the window but for a
	// slider's
	const KEYS = { ' ': 'run', ArrowLeft: 'back', ArrowRight: 'next', Home: 'start', End: 'end' };
	root.addEventListener('keydown', e => {
		if (e.target.closest('button, select, input') || !KEYS[e.key]) return;
		e.preventDefault();
		if (KEYS[e.key] === 'run') run();
		else go(STEP[KEYS[e.key]](S.layer, e.shiftKey ? 10 : 1));
	});
	root.addEventListener('pointerdown', e => {
		if (!e.target.closest('input')) setTimeout(() => root.focus({ preventScroll: true }));
	});

	// ---- the main pane turns under one pointer's drag, each view its own way
	// and within its own bounds; in Units the pointer also rings the unit whose
	// dot it is on ----
	const main = $('.ini-main');
	const TURNS = {
		units: { cam: ground, yaw: [-1.1, 1.1], pitch: [0.15, Math.PI / 2] },
		shape: { cam: view, yaw: [-Infinity, Infinity], pitch: [-0.2, 1.45] },
	};
	function pick(e) {
		const box = main.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
		let reach = PICK_PX ** 2, unit = picked;
		for (const [sx, sy, i] of spots) {
			const d = (sx - x) ** 2 + (sy - y) ** 2;
			if (d < reach) { reach = d; unit = i; }
		}
		if (unit === picked) return;
		picked = unit;
		update(false);
	}
	let from = null;
	main.addEventListener('pointerdown', e => {
		if (!e.isPrimary) return;
		if (S.view === 'units') pick(e);
		from = [e.clientX, e.clientY];
		main.setPointerCapture(e.pointerId);
	});
	main.addEventListener('lostpointercapture', () => { from = null; });
	main.addEventListener('pointermove', e => {
		if (!e.isPrimary) return;
		if (!from) {
			if (S.view === 'units') pick(e);
			return;
		}
		const { cam, yaw, pitch } = TURNS[S.view];
		cam.yaw = within(cam.yaw + (e.clientX - from[0]) * 0.01, yaw);
		cam.pitch = within(cam.pitch + (e.clientY - from[1]) * 0.01, pitch);
		from = [e.clientX, e.clientY];
		update(false);
	});

	exeResized(root, () => { if (data && data.view === S.view) draw(); }, $('.exe-body'));
	update(true);
})();
