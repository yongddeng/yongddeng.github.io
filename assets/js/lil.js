// lil.exe, for 209: five simple random walks, steps of ±1 with equal chance, set
// against the two scales of 209: ±√n, where the CLT keeps Sₙ at any one n, and
// ±√(2n log log n), the envelope the LIL says a walk's records trace. The
// second view divides through by the envelope, on a log axis from n = 100, so
// it becomes the lines ±1 and the CLT's scale closes in on 0. The desktop
// re-creates a window's scripts when it swaps the window in, so this runs once
// per window and claims it with data-ready.
(function () {
	const root = document.querySelector('.lil:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';
	const $ = sel => root.querySelector(sel), $$ = sel => [...root.querySelectorAll(sel)];
	const cv = $('.lil-plot'), records = $('[data-out="records"]');
	const say = exeStatus(root);
	const fmt = v => v.toLocaleString('en-GB');
	// a number with a true minus sign: as it comes for the axes, to two places for the records
	const num = v => (v < 0 ? '−' : '') + fmt(Math.abs(v));
	const signed = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
	const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
	const power = k => '10' + String(k).split('').map(d => SUP[d]).join('');

	const COLOURS = ['#000080', '#008080', '#800080', '#808000', '#008000'];
	const FROM = 100; // the normalised view and the records start here
	// √(2n log log n), from n = 16, where log log n is past 1
	const envelope = n => (n >= 16 ? Math.sqrt(2 * n * Math.log(Math.log(n))) : NaN);
	let N = 100000, view = 'raw', walks = [], env, peak;

	// The walks, and how far any strays, for the raw view's axis; to n = N, the
	// envelope at every n, so the normalised view and the records divide by a
	// lookup; each walk's records past FROM
	function walk() {
		env = Float64Array.from({ length: N + 1 }, (_, n) => envelope(n));
		peak = 0;
		walks = COLOURS.map(() => {
			const S = new Int32Array(N + 1);
			for (let n = 1; n <= N; n++) {
				S[n] = S[n - 1] + (Math.random() < 0.5 ? 1 : -1);
				peak = Math.max(peak, Math.abs(S[n]));
			}
			return S;
		});
		const rec = walks.map(S => {
			let hi = -Infinity, lo = Infinity;
			for (let n = FROM; n <= N; n++) {
				const v = S[n] / env[n];
				if (v > hi) hi = v;
				if (v < lo) lo = v;
			}
			return [hi, lo];
		});
		records.innerHTML = rec.map(([hi, lo], w) => '<div><dt><i class="exe-sw" style="background:' + COLOURS[w] + '"></i>walk ' + (w + 1)
			+ '</dt><dd><span>max</span> ' + signed(hi) + ' <span>min</span> ' + signed(lo) + '</dd></div>').join('');
		say(COLOURS.length + ' walks to n = ' + fmt(N));
		draw();
	}

	// ---- drawing ----
	const INK = { grid: '#e8e5ec', text: '#55505a', clt: '#9a96a0', env: '#b00000', key: 'rgba(255, 255, 255, 0.9)' };
	const FONT = '11px ' + getComputedStyle(root).fontFamily;
	// about eight gridlines over ±m, at 1, 2 or 5 times a power of ten
	function ticks(m) {
		const raw = m / 4, pow = Math.pow(10, Math.floor(Math.log10(raw)));
		const step = [1, 2, 5, 10].map(k => k * pow).find(s => s >= raw), out = [];
		for (let y = -Math.floor(m / step) * step; y <= m; y += step) out.push(y);
		return out;
	}
	function draw() {
		const { cx, W, H } = fitCanvas(cv), L = 50, R = 12, T = 10, B = 22;
		const raw = view === 'raw', n0 = raw ? 1 : FROM, lo10 = Math.log10(n0), hi10 = Math.log10(N), span = W - L - R;
		// n across: linear for Sₙ, logarithmic for the ratio
		const nAt = px => (raw ? (px - L) / span * N : Math.pow(10, lo10 + (px - L) / span * (hi10 - lo10)));
		const X = n => L + (raw ? n / N : (Math.log10(n) - lo10) / (hi10 - lo10)) * span;
		// the raw axis holds the envelope's end and the walks' furthest reach
		const ymax = raw ? Math.max(envelope(N) * 1.12, peak * 1.05) : 1.6;
		const Y = y => T + (ymax - y) / (2 * ymax) * (H - T - B);
		cx.font = FONT;
		cx.lineWidth = 1;
		cx.strokeStyle = INK.grid;
		cx.fillStyle = INK.text;
		cx.textAlign = 'right';
		(raw ? ticks(ymax) : [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]).forEach(y => {
			cx.beginPath();
			cx.moveTo(L, Y(y));
			cx.lineTo(W - R, Y(y));
			cx.stroke();
			cx.fillText(num(y), L - 6, Y(y) + 4);
		});
		const xs = raw ? [0, 0.25, 0.5, 0.75, 1].map(k => Math.round(k * N)) : Array.from({ length: hi10 - lo10 + 1 }, (_, k) => Math.pow(10, lo10 + k));
		xs.forEach((n, i) => {
			cx.textAlign = i === 0 ? 'left' : i === xs.length - 1 ? 'right' : 'center';
			cx.fillText(raw ? fmt(n) : power(Math.log10(n)), X(Math.max(n, n0)), H - 6);
		});

		// a curve through every pixel column
		const curve = (y, colour, dash) => {
			cx.strokeStyle = colour;
			cx.lineWidth = 1.6;
			cx.setLineDash(dash);
			cx.beginPath();
			let on = false;
			for (let px = L; px <= W - R; px++) {
				const v = y(nAt(px));
				if (!isFinite(v)) continue;
				if (on) cx.lineTo(px, Y(v));
				else cx.moveTo(px, Y(v));
				on = true;
			}
			cx.stroke();
			cx.setLineDash([]);
		};
		[1, -1].forEach(sign => {
			curve(raw ? n => sign * Math.sqrt(n) : n => sign * Math.sqrt(n) / envelope(n), INK.clt, [5, 4]);
			curve(raw ? n => sign * envelope(n) : () => sign, INK.env, []);
		});

		// each walk, as the span of its values over the n a pixel column covers
		walks.forEach((S, w) => {
			cx.strokeStyle = COLOURS[w];
			cx.lineWidth = 1.1;
			cx.beginPath();
			for (let px = L; px < W - R; px++) {
				const a = Math.max(n0, Math.round(nAt(px))), b = Math.min(N, Math.max(a, Math.round(nAt(px + 1))));
				let lo = Infinity, hi = -Infinity;
				for (let n = a; n <= b; n++) {
					const v = raw ? S[n] : S[n] / env[n];
					if (v < lo) lo = v;
					if (v > hi) hi = v;
				}
				cx.moveTo(px + 0.5, Y(hi) - 0.5);
				cx.lineTo(px + 0.5, Y(lo) + 0.5);
			}
			cx.stroke();
		});

		cx.fillStyle = INK.key;
		cx.fillRect(L + 6, T + 4, 214, 34);
		legend(cx, L + 12, T + 10, raw ? [[INK.env, '±√(2n log log n), the envelope'], [INK.clt, '±√n, the CLT’s scale']]
			: [[INK.env, '±1, the envelope'], [INK.clt, '±1/√(2 log log n), the CLT’s scale']]);
	}

	// ---- the toolbar: new walks, how far they go, and which view ----
	$('[data-act="walk"]').addEventListener('click', walk);
	$$('[data-n]').forEach(b => b.addEventListener('click', () => {
		N = +b.dataset.n;
		$$('[data-n]').forEach(o => o.classList.toggle('on', o === b));
		say('Walking…');
		// a frame for the status bar to show it before a million steps
		setTimeout(walk, 20);
	}));
	$$('[data-view]').forEach(b => b.addEventListener('click', () => {
		view = b.dataset.view;
		$$('[data-view]').forEach(o => o.classList.toggle('on', o === b));
		draw();
	}));
	// a grip-resize or a maximise redraws the pane at its new size
	new ResizeObserver(() => { if (walks.length) draw(); }).observe($('.exe-body'));
	walk();
})();
