// ---- 204. inequality ----

// Markov's inequality, I{|x| ≥ a} under g(x)/g(a), against the law N(0, 1)
FIGS['204/markov'] = el => {
	const W = 460, H = 214;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const top = plotBox(30, 296, 94, 10, [-4, 4], [0, 2]);
	const bot = plotBox(30, 296, 186, 112, [-4, 4], [0, 0.42]);
	// each g as its ratio g(x)/g(a) and the bound E g(X)/g(a) under N(0, 1)
	const KINDS = {
		'|x|': a => ({ ratio: x => Math.abs(x) / a, bound: Math.sqrt(2 / Math.PI) / a, note: 'E|X| = √(2/π)' }),
		'x²': a => ({ ratio: x => x * x / (a * a), bound: 1 / (a * a), note: 'E X² = 1' }),
		'cosh λx': a => {
			// E cosh λX = exp(λ²/2), and the λ that makes the bound least
			let l = 0, bound = 1;
			for (let t = 0.01; t <= 8; t += 0.01) {
				const b = Math.exp(t * t / 2) / Math.cosh(t * a);
				if (b < bound) { bound = b; l = t; }
			}
			return { ratio: x => Math.cosh(l * x) / Math.cosh(l * a), bound, note: `λ = ${l.toFixed(2)}` };
		},
	};
	const num = v => v >= 0.001 ? v.toFixed(4) : v.toExponential(2);
	let kind = 'x²', a = 2;
	function draw() {
		const k = KINDS[kind](a);
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		// the tails under the indicator, then the indicator itself
		c.fillStyle = COL.pale;
		c.fillRect(top.X(-4), top.Y(1), top.X(-a) - top.X(-4), top.Y(0) - top.Y(1));
		c.fillRect(top.X(a), top.Y(1), top.X(4) - top.X(a), top.Y(0) - top.Y(1));
		c.strokeStyle = COL.ink;
		c.lineWidth = 2;
		polyline(c, [[top.X(-4), top.Y(1)], [top.X(-a), top.Y(1)], [top.X(-a), top.Y(0)], [top.X(a), top.Y(0)], [top.X(a), top.Y(1)], [top.X(4), top.Y(1)]]);
		// g(x)/g(a), clipped to the box
		c.strokeStyle = COL.tail;
		c.lineWidth = 1.6;
		const pts = [];
		for (let px = top.x0; px <= top.x1; px++) {
			const x = -4 + 8 * (px - top.x0) / (top.x1 - top.x0);
			pts.push([px, top.Y(Math.min(2, k.ratio(x)))]);
		}
		polyline(c, pts);
		frameBox(c, top);
		label(c, 'I{|x| ≥ a}', top.X(a) + 4, top.Y(1) + 13, 'left', COL.ink);
		label(c, 'g(x)/g(a)', top.X(0), top.Y(1.6), 'center', COL.tail);
		label(c, '1', top.x0 - 5, top.Y(1) + 4, 'right');
		label(c, '0', top.x0 - 5, top.Y(0) + 4, 'right');
		// the law of X, its tails |x| ≥ a filled
		const curve = (x0, x1) => {
			c.beginPath();
			c.moveTo(bot.X(x0), bot.Y(0));
			for (let i = 0; i <= 120; i++) { const x = x0 + (x1 - x0) * i / 120; c.lineTo(bot.X(x), bot.Y(normalPdf(x))); }
			c.lineTo(bot.X(x1), bot.Y(0));
			c.closePath();
		};
		c.fillStyle = COL.pale;
		curve(-a, a);
		c.fill();
		c.fillStyle = COL.ink;
		curve(-4, -a);
		c.fill();
		curve(a, 4);
		c.fill();
		c.strokeStyle = COL.black;
		c.lineWidth = 1;
		const outline = [];
		for (let px = bot.x0; px <= bot.x1; px++) outline.push([px, bot.Y(normalPdf(-4 + 8 * (px - bot.x0) / (bot.x1 - bot.x0)))]);
		polyline(c, outline);
		frameBox(c, bot);
		for (const x of [-4, -2, 0, 2, 4]) label(c, minus(x), bot.X(x), bot.y0 + 13, 'center');
		label(c, 'N(0, 1)', bot.x0 + 6, bot.y1 + 13);
		// the readings
		const tail = 2 * (1 - Phi(a));
		const R = 310;
		label(c, 'P(|X| ≥ a)', R, 26, 'left', COL.ink);
		label(c, num(tail), R, 42, 'left', COL.black, SERIF);
		label(c, '≤ E g(X)/g(a)', R, 72, 'left', COL.tail);
		label(c, num(k.bound), R, 88, 'left', COL.black, SERIF);
		label(c, k.note, R, 106);
		label(c, k.bound >= 1 ? 'trivial, above 1' : `${(k.bound / tail).toFixed(1)} times too large`, R, 122);
	}
	const pick = presets(row, Object.keys(KINDS).map(name => [name, name]), name => { kind = name; draw(); });
	slider(row, 'a', 0.2, 4, a, v => { a = v; draw(); }, { step: 0.05, show: v => v.toFixed(2) });
	pick(kind);
};

// Young's inequality, ab against the areas aᵖ/p under y = x^(p−1) and b^q/q beside it
FIGS['204/young'] = el => {
	const W = 460, H = 200, A = 1.2;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const P = plotBox(34, 294, 184, 10, [0, 2.6], [0, 2.2]);
	// text with one superscript, as in aᵖ/p, drawn by hand
	const sup = (base, exp, rest, x, y, colour) => {
		label(c, base, x, y, 'left', colour, SERIF);
		const w = c.measureText(base).width;
		label(c, exp, x + w, y - 6, 'left', colour, '10px Georgia, serif');
		label(c, rest, x + w + 6, y, 'left', colour, SERIF);
	};
	let p = 2, b = 0.8;
	function draw() {
		const q = p / (p - 1);
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		// the area aᵖ/p under the curve, from 0 to a
		c.fillStyle = 'rgba(0, 0, 128, 0.22)';
		c.beginPath();
		c.moveTo(P.X(0), P.Y(0));
		for (let i = 0; i <= 200; i++) { const x = A * i / 200; c.lineTo(P.X(x), P.Y(x ** (p - 1))); }
		c.lineTo(P.X(A), P.Y(0));
		c.closePath();
		c.fill();
		// the area b^q/q beside it, from 0 to b
		c.fillStyle = 'rgba(194, 91, 0, 0.28)';
		c.beginPath();
		c.moveTo(P.X(0), P.Y(0));
		for (let i = 0; i <= 200; i++) { const y = b * i / 200; c.lineTo(P.X(y ** (q - 1)), P.Y(y)); }
		c.lineTo(P.X(0), P.Y(b));
		c.closePath();
		c.fill();
		// the curve y = x^(p−1) = the curve x = y^(q−1), within the box
		c.strokeStyle = COL.black;
		c.lineWidth = 1.4;
		const pts = [];
		for (let px = P.x0; px <= P.x1; px++) {
			const y = ((px - P.x0) / (P.x1 - P.x0) * 2.6) ** (p - 1);
			if (y > 2.2) break;
			pts.push([px, P.Y(y)]);
		}
		polyline(c, pts);
		// the rectangle ab
		c.setLineDash([4, 3]);
		c.strokeRect(P.X(0), P.Y(b), P.X(A) - P.X(0), P.Y(0) - P.Y(b));
		c.setLineDash([]);
		frameBox(c, P);
		label(c, 'a', P.X(A), P.y0 + 13, 'center', COL.black);
		label(c, 'b', P.x0 - 6, P.Y(b) + 4, 'right', COL.black);
		label(c, '0', P.x0 - 6, P.y0 + 13, 'right');
		// the readings
		const ab = A * b, left = A ** p / p, right = b ** q / q, R = 310;
		sup('a', 'p', `/p = ${left.toFixed(3)}`, R, 30, COL.ink);
		sup('b', 'q', `/q = ${right.toFixed(3)}`, R, 50, COL.tail);
		label(c, `ab = ${ab.toFixed(3)}`, R, 70, 'left', COL.black, SERIF);
		label(c, `spare area ${(left + right - ab).toFixed(3)}`, R, 98);
		label(c, `q = ${q.toFixed(2)}`, R, 116);
		label(c, `equality at b = ${(A ** (p - 1)).toFixed(2)}`, R, 134);
	}
	slider(row, 'p', 1.5, 3.5, p, v => { p = v; draw(); }, { step: 0.05, show: v => v.toFixed(2) });
	slider(row, 'b', 0.1, 1.6, b, v => { b = v; draw(); }, { step: 0.02, show: v => v.toFixed(2) });
	draw();
};

// Jensen's inequality, the chord of a two-point law above a convex curve
FIGS['204/jensen'] = el => {
	const W = 460, H = 200;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const KINDS = {
		'x²': { f: x => x * x, x1: -1.5, x2: 2, dom: [-2, 2.5], range: [-0.5, 6.5] },
		'eˣ': { f: Math.exp, x1: -1.5, x2: 1.5, dom: [-2, 2], range: [-0.4, 7.6] },
		'−log x': { f: x => -Math.log(x), x1: 0.25, x2: 2.5, dom: [0.1, 3], range: [-1.3, 2.5] },
	};
	let kind = 'x²', theta = 0.4;
	function draw() {
		const k = KINDS[kind];
		const P = plotBox(34, 296, 184, 10, k.dom, k.range);
		const mean = (1 - theta) * k.x1 + theta * k.x2;
		const meanF = (1 - theta) * k.f(k.x1) + theta * k.f(k.x2);
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		// the curve φ
		c.strokeStyle = COL.black;
		c.lineWidth = 1.4;
		const pts = [];
		for (let px = P.x0; px <= P.x1; px++) {
			const x = k.dom[0] + (k.dom[1] - k.dom[0]) * (px - P.x0) / (P.x1 - P.x0);
			pts.push([px, P.Y(Math.min(k.range[1], k.f(x)))]);
		}
		polyline(c, pts);
		// the chord, with each value's weight as the area of its dot
		c.strokeStyle = COL.ink;
		c.lineWidth = 1;
		polyline(c, [[P.X(k.x1), P.Y(k.f(k.x1))], [P.X(k.x2), P.Y(k.f(k.x2))]]);
		c.fillStyle = COL.ink;
		for (const [x, w] of [[k.x1, 1 - theta], [k.x2, theta]]) {
			c.beginPath();
			c.arc(P.X(x), P.Y(k.f(x)), 2 + 6 * Math.sqrt(w), 0, 2 * Math.PI);
			c.fill();
		}
		// the gap between E φ(X) on the chord and φ(E X) on the curve
		c.strokeStyle = COL.tail;
		c.lineWidth = 2;
		polyline(c, [[P.X(mean), P.Y(meanF)], [P.X(mean), P.Y(k.f(mean))]]);
		c.fillStyle = COL.ink;
		c.beginPath();
		c.arc(P.X(mean), P.Y(meanF), 4, 0, 2 * Math.PI);
		c.fill();
		c.fillStyle = COL.tail;
		c.beginPath();
		c.arc(P.X(mean), P.Y(k.f(mean)), 4, 0, 2 * Math.PI);
		c.fill();
		frameBox(c, P);
		label(c, 'x₁', P.X(k.x1), P.y0 + 13, 'center');
		label(c, 'x₂', P.X(k.x2), P.y0 + 13, 'center');
		label(c, 'E X', P.X(mean), P.y0 + 13, 'center', COL.black);
		// the readings
		const R = 310;
		label(c, `φ(x) = ${kind}`, R, 26, 'left', COL.black, SERIF);
		label(c, 'E φ(X), on the chord', R, 52, 'left', COL.ink);
		label(c, meanF.toFixed(3), R, 68, 'left', COL.black, SERIF);
		label(c, 'φ(E X), on the curve', R, 94, 'left', COL.tail);
		label(c, k.f(mean).toFixed(3), R, 110, 'left', COL.black, SERIF);
		label(c, `gap ${(meanF - k.f(mean)).toFixed(3)}`, R, 136);
	}
	const pick = presets(row, Object.keys(KINDS).map(name => [name, name]), name => { kind = name; draw(); });
	slider(row, 'θ', 0, 1, theta, v => { theta = v; draw(); }, { step: 0.01, show: v => v.toFixed(2) });
	pick(kind);
};

// the unit ball of ‖x‖ₚ = (Σ|xᵢ|ᵖ)^{1/p} on ℝ³ as a mesh, and that of the dual
// exponent q. The slider runs over s = 1 − 1/p, so q sits at the mirror image
// 1 − s, and below s = 0 lies p < 1, where the ball is no longer convex
FIGS['204/lp'] = el => {
	const W = 460, H = 250;
	const c = canvas(el, W, H);
	const row = figRow(el);
	const view = view3d(c, { W, H, scale: 74, centre: [0, 0, 0.1] }, draw);
	let s = 0.25, dual = false;
	const pOf = s => (s >= 1 ? Infinity : 1 / (1 - s));
	const fmt = p => (p === Infinity ? '∞' : p.toFixed(2));
	// the radius of the ball along a unit direction u
	const radius = (u, p) => (p === Infinity ? 1 / Math.max(...u.map(Math.abs)) : u.reduce((a, x) => a + Math.abs(x) ** p, 0) ** (-1 / p));
	const dir = (th, ph) => [Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)];
	// its meridians and parallels
	function ball(p, colour) {
		const point = (th, ph) => {
			const u = dir(th, ph), r = radius(u, p);
			return u.map(x => r * x);
		};
		for (let k = 0; k < 16; k++) {
			const pts = [];
			for (let j = 0; j <= 48; j++) pts.push(point(k * Math.PI / 8, -Math.PI / 2 + j * Math.PI / 48));
			view.curve(pts, colour, 1);
		}
		for (let k = -5; k <= 5; k++) {
			const pts = [];
			for (let j = 0; j <= 96; j++) pts.push(point(j * Math.PI / 48, k * Math.PI / 12));
			view.curve(pts, colour, 1);
		}
	}
	// Γ by Lanczos, for the volume (2Γ(1 + 1/p))³/Γ(1 + 3/p)
	const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
	function gamma(z) {
		z -= 1;
		let x = 0.99999999999980993;
		LANCZOS.forEach((g, i) => { x += g / (z + i + 1); });
		const t = z + LANCZOS.length - 0.5;
		return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * x;
	}
	const volume = p => (p === Infinity ? 8 : (2 * gamma(1 + 1 / p)) ** 3 / gamma(1 + 3 / p));
	function draw() {
		c.fillStyle = COL.paper;
		c.fillRect(0, 0, W, H);
		for (const e of [[1.4, 0, 0], [0, 1.4, 0], [0, 0, 1.4]]) view.curve([e.map(x => -x), e], COL.grid, 1);
		const p = pOf(s), q = pOf(1 - s);
		// the polar of the ball for p < 1 is that of its convex hull, the octahedron,
		// so it is the cube, though no exponent q names it
		if (dual) ball(s >= 0 ? q : Infinity, COL.tail);
		ball(p, COL.ink);
		label(c, `p = ${fmt(p)} · volume ${volume(p).toFixed(3)}`, 10, 16, 'left', COL.ink);
		if (dual) label(c, s >= 0 ? `q = ${fmt(q)}, so 1/p + 1/q = 1` : 'its polar is the cube, as at p = 1, with no q for p < 1', 10, 30, 'left', COL.tail);
	}
	slider(row, 'p', -1, 1, s, v => { s = v; draw(); }, { step: 0.01, show: v => fmt(pOf(v)) });
	const dualBtn = button(row, 'Dual ball', () => {
		dual = !dual;
		dualBtn.setAttribute('aria-pressed', String(dual));
		draw();
	});
	dualBtn.setAttribute('aria-pressed', 'false');
	draw();
};
