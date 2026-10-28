// quincunx.exe, for 208: Galton's board. A ball meets n rows of pegs and goes
// right at each with probability p, so its bin is X ~ Bin(n, p). The left pane
// drops the balls; the right rescales the bins to Zₙ = (X − np)/√(npq), exactly
// and as the balls have filled them, against the normal density. Dₙ, the sup
// distance between Zₙ's distribution and Φ, comes from the binomial rather than
// the balls, and is set against the Berry–Esseen bound. The desktop re-creates a
// window's scripts when it swaps the window in, so this runs once per window and
// claims it with data-ready.
(function () {
	const root = document.querySelector('.qx:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';
	const $ = sel => root.querySelector(sel);
	const out = key => $('[data-out="' + key + '"]');
	const board = $('.qx-board'), plot = $('.qx-plot');
	const nIn = $('[data-in="n"]'), pIn = $('[data-in="p"]'), dropBtn = $('[data-act="drop"]');
	const say = exeStatus(root);
	const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const balls = c => c.toLocaleString('en-GB') + (c === 1 ? ' ball' : ' balls');

	// ---- the maths ----
	const C = 0.4748; // Berry–Esseen's constant for i.i.d. summands (Shevtsova, 2011)
	const phi = z => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
	// Φ by Abramowitz and Stegun's 7.1.26 for erf, to within 1.5e-7
	function Phi(z) {
		const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
		const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
		return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
	}
	// P(X = h) for h = 0 to n, by recurrence from P(X = 0) = qⁿ
	function pmf(n, p) {
		const q = 1 - p, f = [Math.pow(q, n)];
		for (let h = 1; h <= n; h++) f.push(f[h - 1] * (n - h + 1) / h * p / q);
		return f;
	}
	// sup |P(Zₙ ≤ z) − Φ(z)|: Φ is continuous and the CDF a step, so the sup
	// sits at a jump, on one side of it or the other
	function distance(n, p, f) {
		const mu = n * p, s = Math.sqrt(n * p * (1 - p));
		let F = 0, D = 0;
		f.forEach((fh, h) => {
			const P = Phi((h - mu) / s);
			D = Math.max(D, Math.abs(F - P), Math.abs(F + fh - P));
			F += fh;
		});
		return D;
	}

	// ---- the state: the board's n and p, its bins, and the balls on their way down ----
	const RATE = 14; // balls a second while dropping
	let n, p, f, bins, total, flying = [], dropping = false, running = false, last = 0, owed = 0;
	const path = () => Array.from({ length: n }, () => (Math.random() < p ? 1 : 0));
	const binOf = steps => steps.reduce((a, b) => a + b, 0);
	function land(h) {
		bins[h]++;
		total++;
	}
	function reset() {
		n = +nIn.value;
		p = +pIn.value / 100;
		f = pmf(n, p);
		bins = new Array(n + 1).fill(0);
		total = 0;
		flying = [];
		out('n').textContent = n;
		out('p').textContent = p.toFixed(2);
		readings();
		filled();
	}
	function readings() {
		const q = 1 - p, D = distance(n, p, f), bound = C * (p * p + q * q) / Math.sqrt(n * p * q);
		out('mu').textContent = (n * p).toFixed(2);
		out('sigma').textContent = Math.sqrt(n * p * q).toFixed(3);
		out('d').textContent = D.toFixed(4);
		out('bound').textContent = bound.toFixed(4);
		out('share').textContent = Math.round(100 * D / bound) + '%';
	}
	// the bins changed: the plot follows, and the status bar counts
	function filled() {
		drawPlot();
		drawBoard();
		say((dropping ? 'Dropping' : 'Ready') + ' · ' + balls(total));
	}

	// ---- drawing ----
	const INK = { peg: '#000080', bin: '#ebe9ee', fill: '#008080', ball: '#b00000', text: '#55505a', grid: '#e2dfe6',
		exact: '#000080', balls: 'rgba(0, 128, 128, 0.45)', normal: '#b00000' };
	const FONT = '10.5px ' + getComputedStyle(root).fontFamily;
	const KEY = [[INK.normal, 'the normal density'], [INK.exact, 'Bin(n, p) rescaled to Zₙ, exact'], [INK.fill, 'the balls so far']];
	function dot(cx, x, y, r) {
		cx.beginPath();
		cx.arc(x, y, r, 0, 2 * Math.PI);
		cx.fill();
	}

	// The board: n rows of pegs dy apart, pegs dx apart, over n + 1 bins. Bin h
	// sits under where peg h of a row n would be
	function geometry(W, H) {
		const top = 14, dy = Math.min(20, H * 0.52 / n), dx = Math.min(30, (W - 24) / (n + 1)), binTop = top + dy * n + 6;
		return { top: top, dy: dy, dx: dx, binTop: binTop, room: H - binTop - 18, mid: W / 2 };
	}
	const pegX = (G, row, k) => G.mid + (k - row / 2) * G.dx;
	function drawBoard() {
		const { cx, W, H } = fitCanvas(board), G = geometry(W, H);
		cx.fillStyle = INK.peg;
		const r = Math.max(1.2, Math.min(2.6, G.dx / 8));
		for (let row = 0; row < n; row++) {
			for (let k = 0; k <= row; k++) dot(cx, pegX(G, row, k), G.top + row * G.dy, r);
		}
		// each bin's height against the fullest one
		const peak = Math.max(1, ...bins), w = Math.max(1.5, G.dx - 2);
		bins.forEach((c, h) => {
			const x = pegX(G, n, h) - w / 2, bh = G.room * c / peak;
			cx.fillStyle = INK.bin;
			cx.fillRect(x, G.binTop, w, G.room);
			cx.fillStyle = INK.fill;
			cx.fillRect(x, G.binTop + G.room - bh, w, bh);
		});
		cx.fillStyle = INK.text;
		cx.font = FONT;
		cx.textAlign = 'center';
		const every = Math.ceil((n + 1) / 10);
		for (let h = 0; h <= n; h += every) cx.fillText(h, pegX(G, n, h), H - 5);
		// a ball between two rows hops from its peg in the one to its peg in the next
		cx.fillStyle = INK.ball;
		const br = Math.max(1.8, Math.min(3.4, G.dx / 5));
		flying.forEach(b => {
			const row = Math.min(n - 1, Math.floor(b.t)), s = b.t - row, k = binOf(b.path.slice(0, row));
			const x0 = pegX(G, row, k), x1 = pegX(G, row + 1, k + b.path[row]), y0 = G.top + row * G.dy - br - 1;
			dot(cx, x0 + (x1 - x0) * s, y0 + G.dy * s - Math.sin(s * Math.PI) * G.dy * 0.4, br);
		});
	}

	// The plot: bin h at z = (h − np)/σ as a bar 1/σ wide, so its area is its
	// share of the balls, or for the outline its probability
	function drawPlot() {
		const { cx, W, H } = fitCanvas(plot), L = 28, R = 8, T = 52, B = 22, TOP = 0.45;
		const X = z => L + (z + 4) / 8 * (W - L - R), Y = d => H - B - Math.min(d, TOP) / TOP * (H - T - B);
		cx.font = FONT;
		cx.lineWidth = 1;
		cx.strokeStyle = INK.grid;
		cx.fillStyle = INK.text;
		cx.textAlign = 'center';
		for (let z = -3; z <= 3; z++) {
			cx.beginPath();
			cx.moveTo(X(z), T);
			cx.lineTo(X(z), H - B);
			cx.stroke();
			cx.fillText(z, X(z), H - B + 13);
		}
		cx.textAlign = 'right';
		[0, 0.2, 0.4].forEach(d => cx.fillText(d.toFixed(1), L - 4, Y(d) + 3));
		const mu = n * p, s = Math.sqrt(n * p * (1 - p)), w = 1 / s;
		f.forEach((fh, h) => {
			const z = (h - mu) / s, a = Math.max(L, X(z - w / 2)), b = Math.min(W - R, X(z + w / 2));
			if (b <= a) return;
			if (total) {
				const y = Y(bins[h] / total / w);
				cx.fillStyle = INK.balls;
				cx.fillRect(a, y, b - a, Y(0) - y);
			}
			const y = Y(fh / w);
			cx.strokeStyle = INK.exact;
			cx.strokeRect(a + 0.5, y + 0.5, b - a - 1, Y(0) - y);
		});
		cx.strokeStyle = INK.normal;
		cx.lineWidth = 1.8;
		cx.beginPath();
		for (let i = 0; i <= 160; i++) {
			const z = -4 + i / 20;
			if (i) cx.lineTo(X(z), Y(phi(z)));
			else cx.moveTo(X(z), Y(phi(z)));
		}
		cx.stroke();
		legend(cx, L, 8, KEY);
	}

	// ---- dropping: RATE balls a second, each crossing 6 + n/4 rows a second ----
	function tick(now) {
		// the window was closed
		if (!root.isConnected) return;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		if (dropping) {
			for (owed += dt * RATE; owed >= 1; owed--) flying.push({ path: path(), t: 0 });
		}
		flying.forEach(b => { b.t += REDUCED ? n : dt * (6 + n / 4); });
		const down = flying.filter(b => b.t >= n);
		flying = flying.filter(b => b.t < n);
		down.forEach(b => land(binOf(b.path)));
		if (down.length) filled();
		else drawBoard();
		running = dropping || flying.length > 0;
		if (running) requestAnimationFrame(tick);
		else filled();
	}
	function play() {
		if (running) return;
		running = true;
		last = performance.now();
		requestAnimationFrame(tick);
	}

	dropBtn.addEventListener('click', () => {
		dropping = !dropping;
		dropBtn.innerHTML = dropping ? '&#10074;&#10074; Pause' : '&#9654; Drop';
		dropBtn.classList.toggle('on', dropping);
		if (dropping) play();
		filled();
	});
	$('[data-act="burst"]').addEventListener('click', () => {
		for (let i = 0; i < 1000; i++) land(binOf(path()));
		filled();
	});
	$('[data-act="reset"]').addEventListener('click', reset);
	nIn.addEventListener('input', reset);
	pIn.addEventListener('input', reset);
	// a grip-resize or a maximise redraws both panes at their new size
	new ResizeObserver(() => { drawBoard(); drawPlot(); }).observe($('.exe-body'));
	reset();
})();
