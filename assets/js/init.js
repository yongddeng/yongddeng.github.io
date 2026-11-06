// init.exe, for 302: what mean field's variance leaves out. A ring of inputs goes
// through a plain stack, each layer's ring on its own top two principal components
// and laid along the depth as a tube that turns under a drag (Poole et al. 2016);
// the ring's length by layer against √χ a layer; and the input-output Jacobian's
// singular values, whose mean σ² mean field fixes and whose spread it does not
// (Pennington, Schoenholz and Ganguli 2017). The desktop runs a window's scripts
// each time it opens one, so this runs once per window and claims it with
// data-ready.
(function () {
	const root = document.querySelector('.ini:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';
	const $ = sel => root.querySelector(sel), $$ = sel => [...root.querySelectorAll(sel)];
	const say = exeStatus(root);

	const N = 64;                    // units a layer, for the ring and the Jacobian
	const K = 96;                    // inputs round the ring
	const ARCS = 12;                 // the ring drawn in arcs of one hue each
	const LMAX = 64;                 // the deepest stack
	const STEP_MS = 120;             // Run's pace, a layer a step
	const B_LO = 1e-4, B_HI = 0.5;   // σb²'s slider past 0, on a log scale
	const SV_LO = -8, SV_HI = 1, SV_BIN = 0.25; // the histogram's log₁₀ σ
	const INK = { ink: '#000080', tail: '#c25b00', text: '#4d4852', grid: '#e3e0e5', frame: '#808080', bad: '#a40000' };
	const FAMILY = getComputedStyle(root).fontFamily, FONT = '10px ' + FAMILY, BOLD = 'bold 11px ' + FAMILY;

	// ---- the presets, each a setting and what to look at there ----
	const PRESETS = {
		ordered: { act: 'tanh', w: 0.8, b: 0.05, orth: false,
			text: 'χ₁ is below 1, the ordered phase. Down the tube the ring shrinks towards a point as every input comes to look alike, its length falls by √χ a layer, and the Jacobian’s singular values sink far below 1.' },
		edge: { act: 'tanh', w: 1.761, b: 0.05, orth: false,
			text: 'χ₁ = 1 at q*, the edge of chaos. Nearby inputs keep their distance, so the length holds nearly level, while the ring’s span narrows slowly as far inputs’ correlation creeps towards 1. The mean of σ² stays near 1, yet Gaussian weights spread the singular values over decades, and orthogonal ones tighten them only part of the way while q* is this far from 0.' },
		chaos: { act: 'tanh', w: 4, b: 0.05, orth: false,
			text: 'χ₁ is above 1, chaos. Nearby inputs fly apart, so the ring crumples layer by layer into a tangle, and by about layer 14 two components hold under half of it. Its length grows by √χ a layer, then levels off as the 96 points near the distance of any two inputs.' },
		isometry: { act: 'tanh', w: 1.05, b: 1e-4, orth: true,
			text: 'Orthogonal weights with tanh at σw² just above 1 and σb² near 0, so q* is near 0, where tanh is nearly linear. The ring keeps its circle, and nearly every singular value stays within a factor of two of 1 over the whole depth, the dynamical isometry of Pennington et al. (2017). Switch to Gaussian weights to lose it.' },
	};
	// what to look at off the presets: tanh by the slope χ₁ at q*, the others by their own law
	const PHASES = [
		{ below: 0.98, text: 'χ₁ is below 1 at q*, the ordered phase. Nearby inputs draw together and the ring shrinks towards a point.' },
		{ below: 1.02, text: 'χ₁ is close to 1 at q*, near the edge of chaos. Nearby inputs keep their distance, so the length holds nearly level, while the ring’s span narrows slowly.' },
		{ below: Infinity, text: 'χ₁ is above 1 at q*, chaos. Nearby inputs fly apart and the ring crumples.' },
	];
	const OWN = {
		linear: 'A linear stack multiplies distances by about σw a layer, so the ring only changes scale and keeps its shape up to the random weights’ stretch, which orthogonal weights do not have.',
		relu: 'ReLU has no chaotic phase. Its correlation map draws every pair of inputs together at any σw², so the ring shrinks towards a point against its size, fast below He’s σw² = 2 if a bias holds q* above 0, and slowly otherwise.',
	};

	// ---- numbers ----
	const MINUS = '−';
	const decade = e => (e === 0 ? '1' : e === 1 ? '10' : exePower(e));
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

	// ---- mean field ----
	// each φ with its derivative
	const ACTS = {
		linear: { label: 'linear', f: x => x, d: () => 1 },
		tanh: { label: 'tanh', f: Math.tanh, d: x => 1 - Math.tanh(x) ** 2 },
		relu: { label: 'ReLU', f: x => (x > 0 ? x : 0), d: x => (x > 0 ? 1 : 0) },
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
		c = Math.max(-1, Math.min(1, c));
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
	// length q, from c = 0.5
	function cStar(act, w, b, q) {
		let c = 0.5;
		for (let k = 0; k < 2000; k++) {
			const next = (w * cross(act, q, c) + b) / q;
			if (Math.abs(next - c) < 1e-12) return next;
			c = next;
		}
		return c;
	}
	// q*, c*, and χ₁ = σw² E φ′(√q z)² at q*: the slope of the correlation map at
	// c = 1, and the factor a nearby pair's squared distance gains a layer. A
	// length that runs off is a linear or ReLU stack's, whose χ does not depend on q.
	// c = 1 is stable up to χ₁ = 1, which rounding can put a hair above 1
	function fixedPoints(act, w, b) {
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
	// an N × N matrix with orthonormal rows, times √N so that its entries have
	// unit variance as the Gaussian ones do: Gram-Schmidt on Gaussian rows, which
	// is Haar's measure
	function orthogonal(gauss) {
		const m = Float64Array.from({ length: N * N }, gauss);
		for (let i = 0; i < N; i++) {
			const ri = i * N;
			for (let k = 0; k < i; k++) {
				const rk = k * N;
				let dot = 0;
				for (let j = 0; j < N; j++) dot += m[ri + j] * m[rk + j];
				for (let j = 0; j < N; j++) m[ri + j] -= dot * m[rk + j];
			}
			let s = 0;
			for (let j = 0; j < N; j++) s += m[ri + j] ** 2;
			s = Math.sqrt(s);
			for (let j = 0; j < N; j++) m[ri + j] /= s;
		}
		return Float32Array.from(m, x => x * Math.sqrt(N));
	}
	// every layer's weights and biases, the ring's two orthogonal directions and
	// the Jacobian's input, drawn once a kind of weights; σw and σb only scale them
	function build(orth) {
		const gauss = normals(exeRng(orth ? 1071 : 1064));
		const draw = () => Float64Array.from({ length: N }, gauss), Z = [], zb = [];
		for (let l = 0; l < LMAX; l++) {
			Z.push(orth ? orthogonal(gauss) : Float32Array.from({ length: N * N }, gauss));
			zb.push(Float32Array.from({ length: N }, gauss));
		}
		const u = toN(draw()), v = draw(), along = dot(u, v) / N;
		return { orth, Z, zb, u, v: toN(v.map((y, j) => y - along * u[j])), x: toN(draw()) };
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
		for (let l = 2; l <= S.L; l++) H[l] = affine(l - 1, H[l - 1].map(act.f), K);
		return H;
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
	// starts at its fixed point q*, where every layer passes back the same χ₁
	function jacobian(qs) {
		const act = ACTS[S.act], a = Math.sqrt(S.w / N);
		const scale = isFinite(qs) && qs > S.b ? Math.sqrt((qs - S.b) / S.w) : 1;
		let h = affine(0, net.x.map(x => scale * x), 1), J = new Float64Array(N * N);
		for (let i = 0; i < N; i++) J[i * N + i] = 1;
		for (let l = 2; l <= S.L; l++) {
			const Z = net.Z[l - 1], dJ = new Float64Array(N * N), next = new Float64Array(N * N);
			for (let i = 0; i < N; i++) { const d = act.d(h[i]); for (let j = 0; j < N; j++) dJ[i * N + j] = d * J[i * N + j]; }
			for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) {
				const z = a * Z[i * N + k];
				for (let j = 0; j < N; j++) next[i * N + j] += z * dJ[k * N + j];
			}
			J = next;
			h = affine(l - 1, h.map(act.f), 1);
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
	// vectors at once converge however close the top two are, as on a circle
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
		const xy = new Float64Array(2 * K);
		if (!(trace > 1e-300)) return { xy, share: NaN };
		const times = v => Float64Array.from({ length: N }, (_, i) => { let s = 0; for (let j = 0; j < N; j++) s += C[i * N + j] * v[j]; return s; });
		let u = Float64Array.from({ length: N }, (_, j) => Math.sin(1.3 * j + 0.1));
		let v = Float64Array.from({ length: N }, (_, j) => Math.cos(0.7 * j + 0.3));
		let last = 0;
		for (let it = 0; it < 200; it++) {
			u = times(u);
			v = times(v);
			// Gram-Schmidt, u first
			const nu = Math.sqrt(dot(u, u));
			u = u.map(x => x / nu);
			const p = dot(u, v);
			v = v.map((x, i) => x - p * u[i]);
			const nv = Math.sqrt(dot(v, v));
			v = v.map(x => x / nv);
			if (Math.abs(nu + nv - last) < 1e-12 * (nu + nv)) break;
			last = nu + nv;
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

	// ---- state, and what it computes ----
	// preset is the button pressed, or null once a hand moves any setting off it
	const S = { act: 'tanh', w: 1.761, b: 0.05, orth: false, L: 32, layer: 32, preset: 'edge' };
	let net = null, data = null, took = 0;
	function compute() {
		const t0 = performance.now(), act = ACTS[S.act];
		if (!net || net.orth !== S.orth) net = build(S.orth);
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
		let q = S.w + S.b;
		for (let l = 2; l <= S.L; l++) {
			const [ef, ed] = moments(act, q);
			guide[l] = guide[l - 1] * Math.sqrt(S.w * ed);
			q = S.w * ef + S.b;
		}
		const fp = fixedPoints(act, S.w, S.b);
		// in chaos, the most K points can span: each step √(2q*(1 − c*)) a unit
		const ceiling = fp.c < 0.99 ? K * Math.sqrt(2 * fp.q * (1 - fp.c)) : NaN;
		// the first layer the drawn length falls a third short of √χ, on its way to that ceiling
		const bend = isFinite(ceiling) ? len.findIndex((v, l) => l > 1 && v < guide[l] / 1.5) : -1;
		let reach = 0;
		for (const xy of rings.slice(1)) for (let k = 0; k < K; k++) reach = Math.max(reach, Math.hypot(xy[2 * k], xy[2 * k + 1]));
		data = { rings, share, len, guide, ceiling, bend, reach, sv: jacobian(fp.q), fp };
		took = performance.now() - t0;
	}

	// ---- the ring as a tube, turned by a drag ----
	// the depth across (x), the two components in the ring's plane (y, z); the
	// view turns by yaw about z, then tilts by pitch towards the viewer, and a
	// point projects orthographically to [x, y, depth], depth larger nearer
	const view = { yaw: -0.55, pitch: 0.32 };
	const DEPTH = 1.7, RADIUS = 0.8;
	function project(p, W, H, scale) {
		const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
		const x1 = cy * p[0] - sy * p[1], y1 = sy * p[0] + cy * p[1];
		return [W / 2 + scale * x1, H / 2 + 8 - scale * (p[2] * cp + y1 * sp), -y1 * cp + p[2] * sp];
	}
	const fade = depth => 0.25 + 0.75 * Math.min(1, Math.max(0, (depth + 1.8) / 3.6));
	// a hue round the ring, dark enough to read on white
	const hue = k => `hsl(${Math.round(360 * k / K)}, 70%, 40%)`;
	function drawRing() {
		const { cx, W, H } = fitCanvas($('.ini-ring')), L = S.L, s = RADIUS / data.reach;
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
		for (const l of [1, L / 2, L]) cx.fillText(`l = ${l}`, project([along(l), 0, 0], W, H, scale)[0], H - 8);
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
		cx.textAlign = 'left';
		cx.fillStyle = '#000000';
		cx.font = BOLD;
		cx.fillText(`A ring of ${K} inputs, layer by layer`, 8, 15);
		cx.font = FONT;
		cx.fillStyle = INK.text;
		cx.fillText('each layer on its own top two principal components · drag to turn', 8, 27);
		drawInset(cx, W);
	}
	// the bold layer's ring alone in the corner, scaled to fit, so its shape
	// shows however small it has grown
	function drawInset(cx, W) {
		const SIZE = 94, x0 = W - SIZE - 8, y0 = 36, xy = data.rings[S.layer];
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

	// ---- the ring's length by layer, on a log axis ----
	function drawLength() {
		const { cx, W, H } = fitCanvas($('.ini-len')), L = S.L, x0 = 40, x1 = W - 10, y0 = H - 20, y1 = 46;
		const X = l => x0 + (l - 1) / (L - 1) * (x1 - x0);
		let lo = Infinity, hi = -Infinity;
		for (const arr of [data.len, data.guide]) for (let l = 1; l <= L; l++) {
			const v = arr[l];
			if (v > 0 && isFinite(v)) { lo = Math.min(lo, Math.log10(v)); hi = Math.max(hi, Math.log10(v)); }
		}
		if (isFinite(data.ceiling)) hi = Math.max(hi, Math.log10(data.ceiling));
		lo = Math.floor(lo - 0.05);
		hi = Math.ceil(hi + 0.05);
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
		// the ceiling, dashed, in chaos
		if (isFinite(data.ceiling)) {
			cx.strokeStyle = INK.frame;
			cx.setLineDash([4, 3]);
			cx.beginPath(); cx.moveTo(x0, Y(data.ceiling)); cx.lineTo(x1, Y(data.ceiling)); cx.stroke();
			cx.setLineDash([]);
		}
		// √χ a layer, then the measured dots
		cx.strokeStyle = INK.tail;
		cx.lineWidth = 1.5;
		cx.beginPath();
		let on = false;
		for (let l = 1; l <= L; l++) {
			const v = data.guide[l];
			if (!(v > 0 && isFinite(v))) { on = false; continue; }
			on ? cx.lineTo(X(l), Y(v)) : cx.moveTo(X(l), Y(v));
			on = true;
		}
		cx.stroke();
		cx.fillStyle = INK.ink;
		for (let l = 1; l <= L; l++) {
			const v = data.len[l];
			if (!(v > 0 && isFinite(v))) continue;
			cx.beginPath(); cx.arc(X(l), Y(v), l === S.layer ? 3.6 : 2.2, 0, 2 * Math.PI); cx.fill();
		}
		if (data.bend > 0) {
			const x = X(data.bend);
			cx.strokeStyle = INK.frame;
			cx.lineWidth = 1;
			cx.beginPath(); cx.moveTo(x + 0.5, y1); cx.lineTo(x + 0.5, y0); cx.stroke();
		}
		cx.textAlign = 'left';
		cx.fillStyle = '#000000';
		cx.font = BOLD;
		cx.fillText('The ring’s length', 8, 15);
		cx.font = FONT;
		cx.fillStyle = INK.ink; cx.fillText('● measured', 104, 15);
		cx.fillStyle = INK.tail; cx.fillText('— √χ a layer', 160, 15);
		cx.fillStyle = INK.text;
		if (isFinite(data.ceiling)) cx.fillText(`dashed, the most ${K} points can span, K√(2q*(1 − c*))`, 8, 27);
		if (data.bend > 0) cx.fillText(`from layer ${data.bend} it falls short, as neighbours near any two’s distance`, 8, 39);
	}

	// ---- the Jacobian's singular values, a histogram of log₁₀ σ ----
	function drawJacobian() {
		const { cx, W, H } = fitCanvas($('.ini-jac')), x0 = 30, x1 = W - 10, y0 = H - 20, y1 = 34;
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
		cx.textAlign = 'left';
		cx.fillStyle = '#000000';
		cx.font = BOLD;
		cx.fillText(`The Jacobian ∂hᴸ/∂h¹, its ${N} singular values`, 8, 15);
		cx.font = FONT;
		cx.fillStyle = INK.text;
		cx.fillText(`from one input at q*, ${S.orth ? 'orthogonal' : 'Gaussian'} weights`, 8, 27);
	}

	// ---- the caption and the readings ----
	function caption() {
		if (S.preset) return PRESETS[S.preset].text;
		if (OWN[S.act]) return OWN[S.act];
		return PHASES.find(p => data.fp.chi < p.below).text;
	}
	function readout() {
		const sv = data.sv, ms2 = sv.reduce((s, x) => s + x * x, 0) / sv.length;
		const within = sv.filter(x => x >= 0.5 && x <= 2).length / sv.length;
		const items = [
			['top two components', `${fmt(100 * data.share[S.layer])}% <span>of the variance</span>`],
			['mean σ²', `${fmt(ms2)} <span>measured</span> ${fmt(data.fp.chi ** (S.L - 1))} <span>χ₁ᴸ⁻¹</span>`],
			['σ within ×2 of 1', `${fmt(100 * within)}%`],
		];
		$('[data-out="read"]').innerHTML = items.map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('');
		$('[data-out="caption"]').textContent = caption();
	}
	function draw() {
		drawRing();
		drawLength();
		drawJacobian();
	}

	// ---- one update a frame: a change recomputes, a drag or the layer only redraws ----
	let pending = null;
	function update(recompute) {
		if (pending) { pending.recompute ||= recompute; return; }
		pending = { recompute };
		requestAnimationFrame(() => {
			const { recompute } = pending;
			pending = null;
			if (recompute) compute();
			draw();
			readout();
			sync();
			say(`${ACTS[S.act].label}, ${S.orth ? 'orthogonal' : 'Gaussian'} weights, σw² ${+S.w.toPrecision(4)}, σb² ${fmt(S.b)}, L = ${S.L} · χ₁ = ${fmt(data.fp.chi)} at q* = ${fmt(data.fp.q)} · computed in ${Math.round(took)} ms`);
		});
	}

	// ---- the toolbar ----
	const wIn = $('[data-in="w"]'), bIn = $('[data-in="b"]'), layerIn = $('[data-in="layer"]'), runBtn = $('[data-act="run"]');
	const press = (sel, key, value) => $$(sel).forEach(b => exePress(b, b.dataset[key] === value));
	// the controls as the state is
	function sync() {
		wIn.value = Math.round(S.w * 100);
		bIn.value = vOf(S.b);
		layerIn.max = S.L;
		layerIn.value = S.layer;
		$('[data-out="w"]').textContent = String(+S.w.toPrecision(4));
		$('[data-out="b"]').textContent = fmt(S.b);
		$('[data-out="layer"]').textContent = String(S.layer);
		press('[data-act-f]', 'actF', S.act);
		press('[data-orth]', 'orth', S.orth ? '1' : '0');
		press('[data-preset]', 'preset', S.preset || '');
	}
	// a hand on any setting leaves the preset
	const set = change => { Object.assign(S, change, { preset: null }); update(true); };
	$$('[data-act-f]').forEach(b => b.addEventListener('click', () => set({ act: b.dataset.actF })));
	$$('[data-orth]').forEach(b => b.addEventListener('click', () => set({ orth: b.dataset.orth === '1' })));
	$$('[data-preset]').forEach(b => b.addEventListener('click', () => {
		const { act, w, b: bias, orth } = PRESETS[b.dataset.preset];
		Object.assign(S, { act, w, b: bias, orth, preset: b.dataset.preset });
		update(true);
	}));
	wIn.addEventListener('input', () => set({ w: wIn.value / 100 }));
	bIn.addEventListener('input', () => set({ b: bOf(+bIn.value) }));
	$('[data-in="L"]').addEventListener('change', e => {
		S.L = +e.target.value;
		S.layer = Math.min(S.layer, S.L);
		update(true);
	});
	layerIn.addEventListener('input', () => { S.layer = +layerIn.value; update(false); });

	// ---- Run: the bold layer from 1 to L, a layer a step ----
	let running = 0, last = 0;
	function stop() {
		cancelAnimationFrame(running);
		running = 0;
		exeRunning(runBtn, false);
	}
	function tick(now) {
		if (!root.isConnected) return;
		if (now - last >= STEP_MS) {
			last = now;
			S.layer += 1;
			update(false);
		}
		if (S.layer >= S.L) stop();
		else running = requestAnimationFrame(tick);
	}
	runBtn.addEventListener('click', () => {
		if (running) {
			stop();
			return;
		}
		if (S.layer >= S.L) {
			S.layer = 1;
			update(false);
		}
		exeRunning(runBtn, true);
		last = performance.now();
		running = requestAnimationFrame(tick);
	});

	// ---- the tube turns under one pointer's drag ----
	const ringCv = $('.ini-ring');
	let from = null;
	ringCv.addEventListener('pointerdown', e => {
		if (!e.isPrimary) return;
		from = [e.clientX, e.clientY];
		ringCv.setPointerCapture(e.pointerId);
	});
	ringCv.addEventListener('lostpointercapture', () => { from = null; });
	ringCv.addEventListener('pointermove', e => {
		if (!from || !e.isPrimary) return;
		view.yaw += (e.clientX - from[0]) * 0.01;
		view.pitch = Math.max(-0.2, Math.min(1.45, view.pitch + (e.clientY - from[1]) * 0.01));
		from = [e.clientX, e.clientY];
		update(false);
	});

	exeHelp(root);
	exeResized(root, draw, $('.exe-body'));
	update(true);
})();
