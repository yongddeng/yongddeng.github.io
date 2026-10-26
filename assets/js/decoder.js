// 302. blocks: a workbench inside the post window. The tree on the left
// picks a model; the pane on the right draws its block with the parts that
// changed from the parent lit, or the diff, the model against its parent (or
// any other) part by part. The menus above find models by their parts: tick
// techniques and the tree marks the models that use all of them. The card
// under the tree lists the shown model's parts. Data comes from
// _data/decoder_block.yml via the JSON script in the post. The desktop
// re-creates a post's scripts when it swaps the window in, so this runs once
// per window and claims it with data-ready.
(function () {
	const root = document.querySelector('.wb:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';
	const win = root.closest('.content') || root;
	const $ = (sel, from) => (from || root).querySelector(sel);
	const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
	const n = x => Number(x).toLocaleString('en-US');

	// ---- data ---------------------------------------------------------------
	const data = JSON.parse($('script[type="application/json"]', win).textContent);
	const M = data.models, byId = {};
	M.forEach(m => { byId[m.id] = m; });
	const chrono = M.slice(); // the file is in date order
	const idx = id => chrono.indexOf(byId[id]);
	const kids = {};
	M.forEach(m => { if (m.parent) (kids[m.parent] = kids[m.parent] || []).push(m.id); });
	const year = m => m.date.split(' ')[1];
	const gcd = (a, b) => (b ? gcd(b, a % b) : a);
	const fmtB = b => (b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB');
	const fmtP = p => (p >= 1000 ? (p / 1000).toFixed(2).replace(/\.?0+$/, '') + 'T' : p >= 1 ? (Number.isInteger(p) ? p : p.toFixed(1)) + 'B' : Math.round(p * 1000) + 'M');
	// what follows a mixture's parameter count: ", 37B active"
	const activeP = m => (m.active ? `, ${fmtP(m.active)} active` : '');
	// KV cache written per token, two bytes a value: layers × KV heads × head size × (K and V)
	const kv = m => (m.attn === 'mla' ? m.layers * (m.mla.dc + m.mla.dr) * 2 : m.attn === 'hybrid' ? m.full_layers * m.kv_heads * m.head_dim * 4 : m.layers * m.kv_heads * m.head_dim * 4);
	const NORMN = { LN: 'LayerNorm', RMS: 'RMSNorm', RMS0: 'RMSNorm, zero-centred' };
	const KINDOF = m => (m.attn === 'hybrid' ? `${m.state} + ${m.gate ? 'gated ' : ''}attention` : KIND[m.attn]);
	const KIND = { mha: 'multi-head', mqa: 'multi-query', gqa: 'grouped-query', window: 'grouped-query · sliding window', mla: 'multi-head latent' };
	const ATT = m => ({
		mha: () => `multi-head, ${m.heads} heads of ${m.head_dim}`,
		mqa: () => `multi-query: ${m.heads} query heads share 1 KV head`,
		gqa: () => `grouped-query: ${m.heads} query heads, ${m.kv_heads} KV heads`,
		window: () => `grouped-query ${m.heads}/${m.kv_heads}, sliding window of ${n(m.win)}`,
		mla: () => `multi-head latent: ${m.heads} heads; K and V rebuilt from a ${m.mla.dc}-d latent plus ${m.mla.dr} RoPE dims`,
		hybrid: () => `${m.state} in ${m.layers - m.full_layers} of ${m.layers} layers; attention, ${m.heads}/${m.kv_heads} heads of ${m.head_dim}, in the rest`
	})[m.attn]();
	const NORM = m => (m.pre ? 'pre-' : m.norm_after ? 'inside-' : 'post-') + NORMN[m.norm] + (m.pre && m.norm_after ? ' and after' : '') + (m.par ? ', parallel branches' : '') + (m.qk ? ' + QK-norm' : '');
	const FFN = m => (m.ffn.kind === 'dense' ? `${m.ffn.act}, d_ff = ${n(m.ffn.dff)} (${m.ffn.ratio}×)` : `${m.ffn.n} ${m.ffn.act} experts, each ${n(m.ffn.ed)} wide`);
	const EXP = m => (m.ffn.kind === 'dense' ? 'none' : `${m.ffn.n} routed${m.ffn.sh ? ' + ' + m.ffn.sh + ' shared' : ''}, top-${m.ffn.k}`);
	// what the attention box says on its right: how position enters, and the extras
	const attnTags = m => [m.pos === 'rope-dec' ? 'RoPE · 64 dims' : m.pos === 'rope-partial' ? 'RoPE · ¼ of dims' : m.pos.indexOf('rope') === 0 ? 'RoPE on Q, K' : '', m.qk ? 'QK-norm' : '', m.gate ? 'gated output' : ''].filter(Boolean);
	function changes(m, p) {
		if (!p) return {};
		const f = fn => fn(m) !== fn(p);
		return { embed: f(x => x.vocab.n + x.vocab.tok), pos: f(x => x.pos), norm: f(NORM), attn: f(x => ATT(x) + x.pos + !!x.qk + !!x.sinks + !!x.gate), ffn: f(x => FFN(x) + EXP(x)), layers: f(x => x.layers) };
	}

	// ---- parts: techniques, each listing the models that use it (introducer first) ----------------
	// the FFN glyphs follow the token: in on the left, through a router (the diamond) and the experts, out on the right.
	// Idle experts keep a faint wire; a shared expert is wired straight past the router; LOAD shows equal load with the bias on the router.
	const ROUTER = (x, y, lab) => `<path d="M${x - 4},${y}L${x},${y - 4}L${x + 4},${y}L${x},${y + 4}Z" class="g-rt"/>` + (lab ? `<text x="${x}" y="${y - 6}" font-size="7" text-anchor="middle">${lab}</text>` : '');
	const WIRE = (n, lit, h, shared, lab) => {
		const top = (22 - (n * h + (n - 1)) - (shared ? 6 : 0)) / 2;
		let s = '<path d="M0,11H10" class="g-ln"/>' + ROUTER(14, 11, lab);
		for (let i = 0; i < n; i++) { const y = top + i * (h + 1), cy = y + h / 2, k = lit.includes(i) ? 'g-ln' : 'g-hint'; s += `<path d="M18,11C24,11 24,${cy} 30,${cy}" class="${k}"/><rect x="30" y="${y}" width="16" height="${h}" class="${lit.includes(i) ? 'g-on' : 'g-off'}"/><path d="M46,${cy}C52,${cy} 52,11 58,11" class="${k}"/>`; }
		if (shared) { const y = top + n * (h + 1) + 2; s += `<path d="M10,11V${y + 2}H30" class="g-ln"/><rect x="30" y="${y}" width="16" height="4" class="g-sh"/><path d="M46,${y + 2}H54V11" class="g-ln"/>`; }
		return s + '<path d="M58,11H64" class="g-ln"/>';
	};
	const LOAD = () => { let s = '<path d="M0,11H10" class="g-ln"/>' + ROUTER(14, 11, '+b'); for (let i = 0; i < 4; i++) { const y = 1 + i * 5; s += `<path d="M18,11C24,11 24,${y + 2} 30,${y + 2}" class="g-hint"/><rect x="30" y="${y}" width="20" height="4" class="g-off"/><rect x="30" y="${y}" width="14" height="4" class="g-on"/><path d="M50,${y + 2}C56,${y + 2} 56,11 58,11" class="g-hint"/>`; } return s + '<path d="M58,11H64" class="g-ln"/>'; };
	// the attention glyphs wire eight query heads (top) to the key-value heads they use (bottom);
	// the reach glyphs wire the current token (top right) back to the past tokens it can see
	const QROW = () => { let s = ''; for (let i = 0; i < 8; i++) s += `<rect x="${2 + i * 8}" y="0" width="5" height="5" class="g-q"/>`; return s; };
	const HEADS = kvx => { let s = QROW(); const g = 8 / kvx.length; kvx.forEach((x, j) => { s += `<rect x="${x - 2.5}" y="17" width="5" height="5" class="g-k"/>`; for (let i = 0; i < g; i++) s += `<path d="M${4.5 + (j * g + i) * 8},5L${x},17" class="g-ln"/>`; }); return s; };
	const LATENT = () => { let s = QROW(); for (let i = 0; i < 8; i++) s += `<path d="M${4.5 + i * 8},5L${20 + i * 3.4},17" class="g-ln"/>`; return s + '<rect x="18" y="17" width="28" height="5" class="g-lat"/><path d="M20,22L25,17M27,22L32,17M34,22L39,17M41,22L46,17" class="g-lat"/>'; };
	const REACH = sees => { let s = '<rect x="57" y="0" width="5" height="5" class="g-cur"/>'; for (let i = 0; i < 14; i++) { const x = 2 + i * 4, on = sees(i); s += `<rect x="${x}" y="17" width="3" height="5" class="${on ? 'g-see' : 'g-off'}"/>`; if (on) s += `<path d="M59.5,5L${x + 1.5},17" class="g-ln"/>`; } return s; };
	const STATE = () => { let s = '<rect x="57" y="0" width="5" height="5" class="g-cur"/>'; for (let i = 0; i < 9; i++) s += `<rect x="${14 + i * 4}" y="17" width="3" height="5" class="g-off"/>`; return s + '<path d="M14,19.5H6" class="g-hint"/><rect x="1" y="15" width="9" height="7" class="g-k"/><path d="M59.5,5L5.5,15" class="g-ln"/>'; };
	// PE glyphs: the token's dims as a row of cells. Sinusoidal and learned add something on top; RoPE rotates pairs (the arcs)
	const CELLS = (n, x0, k) => { let s = ''; for (let i = 0; i < n; i++) s += `<rect x="${x0 + i * 5}" y="15" width="4" height="7" class="${k}"/>`; return s; };
	const ARCS = (n, x0) => { let s = ''; for (let i = 0; i < n; i++) { const x = x0 + i * 10; s += `<path d="M${x + 0.5},13a4,4 0 0,1 8,0" class="g-ln"/><path d="M${x + 7},11.5l1.5,1.5l-1.8,1" class="g-ln"/>`; } return s; };
	const SLOTS = () => { let s = ''; for (let i = 0; i < 9; i++) s += `<rect x="${2 + i * 6.5}" y="1" width="5.5" height="7" class="${i === 3 ? 'g-k' : 'g-dim'}"/>`; return s + '<path d="M24.5,8V13M22.5,11l2,2l2,-2" class="g-ln"/>'; };
	// activation glyphs: the FFN the activation sits in, drawn as on the FFN tab: up, the nonlinearity in a circle, down
	const UP = (x, y, h) => `<path d="M${x},${y + h * 0.3}L${x + 10},${y}V${y + h}L${x},${y + h * 0.7}Z" class="g-dd"/>`;
	const DOWN = (x, y, h) => `<path d="M${x},${y}L${x + 10},${y + h * 0.3}V${y + h * 0.7}L${x},${y + h}Z" class="g-dd"/>`;
	const ACT = (cx, cy, curve, rr) => `<circle cx="${cx}" cy="${cy}" r="${rr || 7}" class="g-rt"/>` + curve(cx, cy, (rr || 7) / 7);
	const C_RELU = (cx, cy, k) => `<path d="M${cx - 5 * k},${cy + 2.5 * k}H${cx}L${cx + 4.5 * k},${cy - 3.5 * k}" class="g-wave"/>`;
	const C_GELU = (cx, cy, k) => `<path d="M${cx - 5 * k},${cy + 2.5 * k}C${cx - 1.5 * k},${cy + 2.5 * k} ${cx - 1.5 * k},${cy + 4 * k} ${cx},${cy + 2.5 * k}S${cx + 2.5 * k},${cy - 3.5 * k} ${cx + 4.5 * k},${cy - 3.5 * k}" class="g-wave"/>`;
	// tokeniser glyphs: a box per token around "the cat" and one rare character, which is unknown or spelt as two bytes
	const TBOX = (x, w, t) => `<rect x="${x}" y="5" width="${w}" height="12" class="g-bx"/><text x="${x + w / 2}" y="14" font-size="7" text-anchor="middle">${t}</text>`;
	const BYTES = x => `<rect x="${x}" y="5" width="9" height="12" class="g-bx"/><rect x="${x + 11}" y="5" width="9" height="12" class="g-bx"/><text x="${x + 4.5}" y="14" font-size="5.5" text-anchor="middle">C3</text><text x="${x + 15.5}" y="14" font-size="5.5" text-anchor="middle">A9</text>`;
	// norm glyphs: left to right as the FFN tab; the sub-block is a grey box, the add a circle, the norm a lilac box
	const ADD = x => `<circle cx="${x}" cy="11" r="2.5" class="g-rt"/><path d="M${x - 1.5},11h3M${x},9.5v3" class="g-ln"/>`;
	const BARS = (x, hs) => hs.map((h, i) => `<rect x="${x + i * 3}" y="${19 - h}" width="2" height="${h}" class="g-q"/>`).join('');
	// context glyphs: positions as a ruler whose tick spacing is the rotation speed; the trained length is the dashed line
	const RULER = (x0, x1, ticks, y = 14) => `<path d="M${x0},${y}H${x1}" class="g-ln"/>` + ticks.map(([x, big]) => `<path d="M${x},${y}v${big ? -6 : -3}" class="g-ln"/>`).join('');
	const EVEN = (x0, x1, n) => { const a = []; for (let i = 0; i <= n; i++) a.push([x0 + (x1 - x0) * i / n, i % 4 === 0]); return a; };
	const TRAINED = x => `<path d="M${x},2V21" class="g-ghost"/>`;
	const CURTOK = x => `<rect x="${x - 2.5}" y="16" width="5" height="5" class="g-cur"/>`;
	// attention sinks: the current token can also attend to an empty slot (the outlined square); a gated output: a sigmoid of the input scales what leaves the block
	const SINKS = () => { let s = '<rect x="57" y="0" width="5" height="5" class="g-cur"/><rect x="2" y="17" width="4" height="5" class="g-bx"/><path d="M59.5,5L4,17" class="g-ln"/>'; for (let i = 0; i < 12; i++) { const x = 10 + i * 4; s += `<rect x="${x}" y="17" width="3" height="5" class="g-see"/><path d="M59.5,5L${x + 1.5},17" class="g-ln"/>`; } return s; };
	const GATED = () => '<path d="M0,11H4" class="g-ln"/><rect x="4" y="5" width="24" height="12" class="g-off"/><text x="16" y="13.5" font-size="6.5" text-anchor="middle">attention</text><path d="M28,11H35" class="g-ln"/><path d="M2,11V20H38V14.4" class="g-hint"/><text x="40" y="21.5" font-size="5.5">\u03c3(input)</text><circle cx="38" cy="11" r="3.4" class="g-rt"/><path d="M36,9l4,4M40,9l-4,4" class="g-ln"/><path d="M41.4,11H64" class="g-ln"/>';
	// a sub-block on a branch, with a norm before it, after it, or both; an MLP glyph with its nonlinearity; a gated one
	const FLOW = (before, after) => { let x = 10, s = '<path d="M0,11H6" class="g-ln"/><path d="M6,11V4H10" class="g-ln"/>'; const seg = (w, k) => { s += `<rect x="${x}" y="1" width="${w}" height="6" class="${k}"/>`; x += w; s += `<path d="M${x},4H${x + 2}" class="g-ln"/>`; x += 2; }; if (before) seg(10, 'g-norm'); seg(12, 'g-off'); if (after) seg(10, 'g-norm'); const a = x + 6; s = s.replace(`M${x - 2},4H${x}`, `M${x - 2},4H${a}V8.5`); return `<path d="M6,11H${a - 2.5}" class="g-hint"/>` + s + ADD(a) + `<path d="M${a + 2.5},11H64" class="g-ln"/>`; };
	const MLP = curve => '<path d="M0,11H12" class="g-ln"/>' + UP(12, 2, 18) + '<path d="M22,11H25" class="g-ln"/>' + ACT(32, 11, curve) + '<path d="M39,11H42" class="g-ln"/>' + DOWN(42, 2, 18) + '<path d="M52,11H64" class="g-ln"/>';
	const GLU = label => (label ? `<text x="0" y="8" font-size="5.5">${label}</text>` : '') + '<path d="M0,11H8V5H12M8,11V17H12" class="g-ln"/>' + UP(12, 1, 8) + UP(12, 13, 8) + '<path d="M22,5H24" class="g-ln"/>' + ACT(28.5, 5, C_GELU, 5.5) + '<path d="M33,5H38V9M22,17H38V13" class="g-ln"/><circle cx="38" cy="11" r="2.4" class="g-rt"/><path d="M36.6,9.6l2.8,2.8M39.4,9.6l-2.8,2.8" class="g-ln"/><path d="M40.4,11H44" class="g-ln"/>' + DOWN(44, 2, 18) + '<path d="M54,11H64" class="g-ln"/>';
	const GLYPH = {
		tok: { wbpe: TBOX(1, 16, 'the') + TBOX(20, 16, 'cat') + '<rect x="40" y="5" width="12" height="12" class="g-bad"/><text x="46" y="14.5" font-size="8" text-anchor="middle">?</text>', bbpe: TBOX(1, 16, 'the') + TBOX(18, 19, '\u00b7cat') + BYTES(40), spm: TBOX(1, 18, '\u2581the') + TBOX(20, 18, '\u2581cat') + BYTES(41) },
		pos: { sin: '<path d="M2,5c3,-6 6,-6 9,0s6,6 9,0s6,-6 9,0s6,6 9,0s6,-6 9,0s6,6 9,0" class="g-wave"/><path d="M32,8V13M30,11l2,2l2,-2" class="g-ln"/>' + CELLS(12, 2, 'g-tint'), learned: SLOTS() + CELLS(12, 2, 'g-tint'), rope: CELLS(12, 2, 'g-q') + ARCS(6, 2), rope_dec: CELLS(10, 2, 'g-dim') + CELLS(2, 54, 'g-q') + ARCS(1, 54), rope_part: CELLS(3, 2, 'g-q') + CELLS(9, 17, 'g-dim') + ARCS(1, 2) + '<path d="M12.5,13a2.5,2.5 0 0,1 2,-2" class="g-ln"/>', nope: CELLS(12, 2, 'g-dim') + '<text x="2" y="9" font-size="7">nothing added</text>' },
		norm: { post: '<path d="M0,11H6" class="g-ln"/><path d="M6,11H27.5" class="g-hint"/><path d="M6,11V4H12" class="g-ln"/><rect x="12" y="1" width="12" height="6" class="g-off"/><path d="M24,4H30V8.5" class="g-ln"/>' + ADD(30) + '<path d="M32.5,11H38" class="g-ln"/><rect x="38" y="7" width="14" height="8" class="g-norm"/><path d="M52,11H64" class="g-ln"/>', pre: FLOW(true, false), inside: FLOW(false, true), sandwich: FLOW(true, true), rms: BARS(4, [6, 14, 9, 17, 4]) + '<path d="M22,11H26" class="g-ln"/><rect x="26" y="6" width="12" height="10" class="g-norm"/><path d="M38,11H42" class="g-ln"/>' + BARS(44, [3, 7, 4.5, 8.5, 2]) + '<path d="M4,19H19M44,19H59" class="g-ax"/>', qk: '<path d="M0,6H10M0,16H10" class="g-ln"/><rect x="0" y="4" width="6" height="4" class="g-q"/><rect x="0" y="14" width="6" height="4" class="g-k"/><rect x="10" y="3" width="12" height="6" class="g-norm"/><rect x="10" y="13" width="12" height="6" class="g-norm"/><path d="M22,6H30V9M22,16H30V13" class="g-ln"/><circle cx="30" cy="11" r="3" class="g-rt"/><circle cx="30" cy="11" r="0.8" class="g-cur"/><path d="M33,11H40" class="g-ln"/><text x="42" y="13.5" font-size="6">softmax</text>', zero: '<rect x="2" y="4" width="24" height="14" class="g-norm"/><path d="M6,11H22" class="g-ax"/><path d="M14,8V14" class="g-ln"/><circle cx="14" cy="11" r="2.2" class="g-rt"/><text x="32" y="13" font-size="7">\u03b3 \u2248 0</text>' },
		attn: { mha: HEADS([4.5, 12.5, 20.5, 28.5, 36.5, 44.5, 52.5, 60.5]), mqa: HEADS([32.5]), gqa: HEADS([16.5, 48.5]), window: REACH(i => i >= 9), mla: LATENT(), linear: STATE(), sinks: SINKS(), gated: GATED() },
		act: { relu: MLP(C_RELU), gelu: MLP(C_GELU), swiglu: GLU(), geglu: GLU('GELU') },
		ffn: { dense: '<path d="M0,11H18" class="g-ln"/><path d="M18,7L30,1H36L48,7V15L36,21H30L18,15Z" class="g-dw"/><path d="M48,11H64" class="g-ln"/>', moe: WIRE(4, [1], 4, false), shared: WIRE(5, [1, 3], 2, true), auxfree: LOAD(), sigmoid: WIRE(4, [1], 4, false, '\u03c3') },
		ctx: { interleave: '<path d="M2,7H40" class="g-hint"/>' + RULER(40, 62, EVEN(40, 62, 8), 7) + RULER(2, 62, EVEN(2, 62, 16), 17) + CURTOK(62), full: RULER(2, 34, EVEN(2, 34, 16)) + TRAINED(34) + CURTOK(34), base: RULER(2, 62, EVEN(2, 62, 16)) + TRAINED(34) + CURTOK(62), yarn: RULER(2, 62, [0, 1, 2, 3].map(i => [2 + i * 20, true]).concat([1, 2, 3].flatMap(i => [[2 + i * 20 - 6, false], [2 + i * 20 - 11, false], [2 + i * 20 - 15, false]]))) + TRAINED(34) + CURTOK(62), window: '<path d="M2,14H40" class="g-hint"/>' + RULER(40, 62, EVEN(40, 62, 8)) + CURTOK(62), linear: '<path d="M14,14H56" class="g-hint"/><rect x="2" y="8" width="11" height="11" class="g-k"/><path d="M56,14H14" class="g-ln"/><path d="M16,12l-3,2l3,2" class="g-ln"/>' + CURTOK(60) },
	};
	const uses = (part, m) => part.techniques.filter(t => t.models.includes(m.id));
	const partById = {};
	data.parts.forEach((p, i) => { p.no = i + 1; partById[p.id] = p; });

	// ---- the drawing kit, shared by the block and the opened views ----------------------
	// Everything is pushed into one array of SVG strings; box takes an optional animation key (data-k) so the same box
	// can slide between models. up and left are the red arrowheads. svg wraps the result with the marker and hatch defs.
	function pen(o) {
		const T = x => o.push(x);
		const box = (x, y, w, h, k, t, s, chg, key) => { T(`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="bx ${k}${chg ? ' chg' : ''}"${key ? ' data-k="' + key + '"' : ''}/>`); if (t) T(`<text x="${x + w / 2}" y="${y + (s ? h / 2 - 2 : h / 2 + 4)}" class="bt" text-anchor="middle">${esc(t)}</text>`); if (s) T(`<text x="${x + w / 2}" y="${y + h / 2 + 10}" class="bs" text-anchor="middle">${esc(s)}</text>`); };
		const ln = d => T(`<path d="${d}" class="ln"/>`);
		const up = (x, y) => T(`<polygon points="${x - 4},${y + 7} ${x + 4},${y + 7} ${x},${y}" class="arr"/>`), left = (x, y) => T(`<polygon points="${x + 7},${y - 4} ${x + 7},${y + 4} ${x},${y}" class="arr"/>`);
		const txt = (x, y, t, k, a) => T(`<text x="${x}" y="${y}" class="${k || ''}" text-anchor="${a || 'start'}">${esc(t)}</text>`);
		const cells = (x, y, cnt, k) => { for (let i = 0; i < cnt; i++) T(`<rect x="${x + i * 6}" y="${y}" width="5" height="7" class="${k}"/>`); return x + cnt * 6; };
		const vec = (x, y, label) => { const e = cells(x, y, 16, 'c-off'); T(`<rect x="${e - 6}" y="${y}" width="5" height="7" class="c-cur"/>`); txt(e + 4, y + 7, label, 'bs'); };
		const chrome = (title, sub, kind) => { T(`<rect x="4" y="4" width="512" height="564" class="bx ${kind}-open" data-k="${kind}"/>`); T('<g data-act="close" class="openable" tabindex="0" role="button" aria-label="Back to the block"><rect x="12" y="10" width="54" height="16" class="btn"/><text x="39" y="21" class="btnt" text-anchor="middle">◂ block</text></g>'); txt(74, 21, title, 'ttl'); txt(74, 33, sub, 'io'); };
		const svg = label => `<svg viewBox="0 0 520 572" role="img" aria-label="${esc(label)}"><defs><marker id="wb-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#000"/></marker><pattern id="wb-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="#d18a3c"/></pattern></defs>${o.join('')}</svg>`;
		return { T, box, ln, up, left, txt, cells, vec, chrome, svg };
	}

	// ---- the block ----------------------------------------------------------------
	function schematic(m, p) {
		const c = changes(m, p), o = [], { box, ln, up, left, txt, svg } = pen(o);
		const TX = 80, BX = 165, BR = 505, BW = BR - BX, post = !m.pre && !m.norm_after;
		const plus = (x, y) => { o.push(`<circle cx="${x}" cy="${y}" r="8" class="plus"/><text x="${x}" y="${y + 4}" class="plust" text-anchor="middle">+</text>`); up(x, y + 10); left(x + 10, y); };
		const sq = (x0, yy, cnt, k) => { for (let i = 0; i < cnt; i++) o.push(`<rect x="${x0 + i * 11}" y="${yy - 8}" width="9" height="9" class="${k}"/>`); return x0 + cnt * 11; };
		const meter = (x, y, fr) => o.push(`<rect x="${x}" y="${y}" width="80" height="4" class="mt"/><rect x="${x}" y="${y}" width="${Math.max(2, 80 * Math.min(1, Math.max(0, fr)))}" height="4" class="mf"/>`);
		function attnBox(x, y, w, h, compact) {
			// the box opens into the second level (opened below): the whole group is the click target
			o.push('<g class="openable" data-open="attn" tabindex="0" role="button" aria-label="Open the attention box">');
			box(x, y, w, h, 'attn', '', '', c.attn, 'attn');
			// the narrow box (PaLM's parallel block) stacks every line: cache and meter, Q, KV, what it sees, tags, note
			const small = h < 92, yT = y + 15, yQ = y + (compact ? 54 : small ? 34 : 40), yK = yQ + 24, yC = yK + (compact ? 22 : small ? 18 : 22);
			o.push(`<text x="${x + 8}" y="${yT}" class="bt">Attention <tspan class="bs2">${esc(KINDOF(m))}</tspan></text>`);
			const b = kv(m), fr = (Math.log10(b) - 4) / (Math.log10(5e6) - 4);
			if (!compact) { txt(x + w - 8, yT, `KV cache ${fmtB(b)} / token`, 'bs', 'end'); meter(x + w - 88, yT + 5, fr); } else { txt(x + 8, yT + 12, `KV cache ${fmtB(b)} / token`, 'bs'); meter(x + 8, yT + 17, fr); }
			const cap = compact ? 8 : (m.qk || m.gate) ? 12 : 16, qn = Math.min(m.heads, cap); // two tags on the right need the room
			txt(x + 8, yQ, 'Q', 'lab'); const e = sq(x + 30, yQ, qn, 'q'); txt(e + 5, yQ, `${m.heads} heads`, 'bs');
			txt(x + 8, yK, 'KV', 'lab');
			const wire = (qx, kx) => o.push(`<path d="M${qx},${yQ + 1}L${kx},${yK - 8}" class="hw"/>`);
			if (m.attn === 'mla') { o.push(`<rect x="${x + 30}" y="${yK - 8}" width="70" height="9" class="lat"/>`); for (let i = 0; i < qn; i++) wire(x + 34.5 + i * 11, x + 30 + (i + 0.5) * 70 / qn); txt(x + 105, yK, `latent, ${m.mla.dc}-d`, 'bs'); sq(x + 176, yK, 1, 'k'); txt(x + 190, yK, `RoPE part, ${m.mla.dr}-d`, 'bs'); }
			else if (m.attn === 'hybrid') { for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) o.push(`<rect x="${x + 30 + i * 4}" y="${yK - 8 + j * 3}" width="3" height="2" class="st"/>`); const gg = gcd(m.layers, m.layers - m.full_layers); txt(x + 50, yK, `state in ${(m.layers - m.full_layers) / gg} of ${m.layers / gg} layers`, 'bs'); const per = qn / m.kv_heads; for (let i = 0; i < qn; i++) wire(x + 34.5 + i * 11, x + 174.5 + Math.floor(i / per) * 11); const e2 = sq(x + 170, yK, m.kv_heads, 'k'); txt(e2 + 5, yK, `${m.kv_heads} KV heads`, 'bs'); }
			else {
				// one key-value square under the middle of the query heads that share it
				const kn = Math.min(m.kv_heads, cap), per = qn / kn;
				for (let i = 0; i < kn; i++) { const kx = x + 30 + (i * per + (per - 1) / 2) * 11; o.push(`<rect x="${kx}" y="${yK - 8}" width="9" height="9" class="k"/>`); }
				for (let i = 0; i < qn; i++) wire(x + 34.5 + i * 11, x + 34.5 + (Math.floor(i / per) * per + (per - 1) / 2) * 11);
				txt(x + 30 + qn * 11 + 5, yK, m.kv_heads === 1 ? (compact ? '1, shared' : '1 head, shared by all queries') : m.kv_heads === m.heads ? `${m.kv_heads} heads` : `${m.kv_heads} heads · ${m.heads / m.kv_heads} queries each`, 'bs');
			}
			const tags = attnTags(m);
			if (!compact) tags.forEach((s, i) => o.push(`<text x="${x + w - 8}" y="${yQ + i * 14}" class="tag" text-anchor="end">${esc(s)}</text>`));
			txt(x + 8, yC, 'sees', 'lab');
			const N = compact ? 12 : 20, cw = 7;
			for (let i = 0; i < N; i++) { const k = i === N - 1 ? 'c-cur' : m.attn === 'window' && i < N - 7 ? 'c-off' : 'c-on'; o.push(`<rect x="${x + 30 + i * (cw + 1)}" y="${yC - 7}" width="${cw}" height="7" class="${k}"/>`); }
			const note = m.sinks ? `last ${n(m.win)}, or a sink` : m.attn === 'window' ? `the last ${n(m.win)} tokens` : m.attn === 'hybrid' ? 'all, or a fixed state' : 'every earlier token';
			if (compact) { txt(x + 8, yC + 14, note, 'bs'); txt(x + 8, yC + 28, tags.join(' · '), 'tag'); } else txt(x + 30 + N * (cw + 1) + 6, yC, note, 'bs');
			txt(x + w - 8, y + h - 6, 'open ▸', 'opn', 'end');
			o.push('</g>');
		}
		function ffnBox(x, y, w, h, compact) {
			o.push('<g class="openable" data-open="ffn" tabindex="0" role="button" aria-label="Open the feed-forward box">');
			box(x, y, w, h, 'ffn', '', '', c.ffn, 'ffn');
			const yT = y + 15, f = m.ffn;
			o.push(`<text x="${x + 8}" y="${yT}" class="bt">Feed-forward <tspan class="bs2">${esc(f.kind === 'dense' ? f.act : 'mixture of experts')}</tspan></text>`);
			if (f.kind === 'dense') {
				if (!compact) txt(x + w - 8, yT, `${n(m.width)} → ${n(f.dff)} → ${n(m.width)}`, 'bs', 'end'); else txt(x + 8, yT + 12, `${n(m.width)} → ${n(f.dff)} → ${n(m.width)}`, 'bs');
				const yc = y + (compact ? 60 : (h + 18) / 2), wh = Math.min(44, h - 34), x1 = x + 14, x2 = x + 48, x3 = x2 + (compact ? 54 : 100), sw = /GLU$/.test(f.act);
				o.push(`<rect x="${x1}" y="${yc - 7}" width="${x2 - x1 - 10}" height="14" class="dd"/><polygon points="${x2 - 10},${yc - 7} ${x2},${yc - wh / 2} ${x2},${yc + wh / 2} ${x2 - 10},${yc + 7}" class="dd"/>`);
				if (sw) { o.push(`<rect x="${x2}" y="${yc - wh / 2}" width="${x3 - x2}" height="${wh / 2 - 1}" class="dw"/><rect x="${x2}" y="${yc + 1}" width="${x3 - x2}" height="${wh / 2 - 1}" class="dw"/>`); txt((x2 + x3) / 2, yc - wh / 4 + 3, f.act === 'GeGLU' ? 'gate · GELU' : 'gate · SiLU', 'bs', 'middle'); txt((x2 + x3) / 2, yc + wh / 4 + 3, 'up', 'bs', 'middle'); txt(x3 + 5, yc + 4, '⊗', 'bt'); }
				else { o.push(`<rect x="${x2}" y="${yc - wh / 2}" width="${x3 - x2}" height="${wh}" class="dw"/>`); txt((x2 + x3) / 2, yc + 3, f.act, 'bs', 'middle'); }
				const x5 = sw ? x3 + 18 : x3;
				o.push(`<polygon points="${x5},${yc - wh / 2} ${x5 + 10},${yc - 7} ${x5 + 10},${yc + 7} ${x5},${yc + wh / 2}" class="dd"/><rect x="${x5 + 10}" y="${yc - 7}" width="${x2 - x1 - 10}" height="14" class="dd"/>`);
				txt(x1 + (x2 - x1 - 10) / 2, yc + 3, 'd', 'bs', 'middle'); txt(x5 + 10 + (x2 - x1 - 10) / 2, yc + 3, 'd', 'bs', 'middle');
				if (!compact) txt(x5 + (x2 - x1) + 8, yc + 3, `${f.ratio}× wide in the middle`, 'bs');
			} else {
				txt(x + w - 8, yT, `${fmtP(m.active)} of ${fmtP(m.params)} active per token`, 'bs', 'end'); meter(x + w - 88, yT + 5, m.active / m.params);
				// the card's wiring at full size: in, the router, a fan to the bank of experts (up to 56, to scale), the chosen ones on
				// solid wires and the rest on faint ones, a merge back out; shared experts take a wire of their own past the router
				const cy = y + 52, shown = Math.min(f.n, 56), R = shown > 8 ? 7 : shown, C = Math.ceil(shown / R), lit = Math.max(1, Math.round(f.k * shown / f.n));
				const gx = x + 100, top = cy - (R * 7 - 1) / 2, ox = gx + C * 7 + 16;
				o.push(`<path d="M${x + 8},${cy}H${x + 22}" class="ln"/><rect x="${x + 22}" y="${cy - 10}" width="46" height="20" class="rt"/>`); txt(x + 45, cy + 4, 'router', 'bs', 'middle');
				for (let r = 0; r < R; r++) {
					const ry = top + r * 7 + 3, on = r < lit, k = on ? 'ln' : 'wf';
					o.push(`<path d="M${x + 68},${cy}C${x + 84},${cy} ${x + 84},${ry} ${gx},${ry}" class="${k}"/><path d="M${gx + C * 7 - 1},${ry}C${ox - 8},${ry} ${ox - 8},${cy} ${ox},${cy}" class="${k}"/>`);
				}
				for (let i = 0; i < shown; i++) { const col = Math.floor(i / R), r = i % R; o.push(`<rect x="${gx + col * 7}" y="${top + r * 7}" width="6" height="6" class="${col === 0 && r < lit ? 'e-on' : 'e-off'}"/>`); }
				if (f.sh) {
					const sy = cy + 25, sx = x + 34;
					o.push(`<path d="M${x + 15},${cy}V${sy}H${sx}" class="ln"/>`);
					for (let i = 0; i < f.sh; i++) o.push(`<rect x="${sx + i * 8}" y="${sy - 3}" width="6" height="6" class="e-sh"/>`);
					o.push(`<path d="M${sx + f.sh * 8 - 2},${sy}H${ox - 4}V${cy + 1}" class="ln"/>`);
				}
				o.push(`<path d="M${ox},${cy}H${ox + 12}" class="ln" marker-end="url(#wb-arr)"/>`);
				txt(x + 10, y + h - 9, `${f.n} routed · top-${f.k}${f.sh ? ' · ' + f.sh + ' shared' : ''} · each ${n(f.ed)} wide${f.n > 56 ? ' · 56 drawn to scale' : ''}`, 'bs');
			}
			txt(x + w - 8, y + h - 6, 'open ▸', 'opn', 'end');
			o.push('</g>');
		}
		const normName = NORMN[m.norm].replace(', zero-centred', ' (0-centred)');
		o.push(`<path d="M${TX},556V${post ? 34 : 42}" class="trunk"/>`);
		txt(TX, 566, 'tokens in', 'io', 'middle'); txt(TX + 70, 12, 'next-token distribution →', 'io', 'start');
		box(22, 512, 116, 26, 'emb', 'Embedding', `V = ${n(m.vocab.n)}`, c.embed, 'emb');
		if (m.pos === 'sin' || m.pos === 'learned') box(22, 472, 116, 26, 'pos', '+ position', m.pos === 'sin' ? 'sinusoidal' : `learned, ${n(m.ctx)} slots`, c.pos, 'pos');
		else { o.push(`<rect x="22" y="472" width="116" height="26" class="bx ghost${c.pos ? ' chg' : ''}" data-k="pos"/>`); txt(80, 483, m.pos === 'none' ? 'no position encoding' : 'no position added here', 'gs', 'middle'); txt(80, 494, m.pos === 'none' ? 'the state layers carry order' : 'RoPE acts inside attention', 'gs', 'middle'); }
		const fy0 = post ? 44 : 92;
		o.push(`<rect x="14" y="${fy0}" width="496" height="${452 - fy0}" class="frame" data-k="frame"/>`);
		// the two axes every norm sits on: the residual stream (trunk) and the branch into each sub-block
		txt(TX + 6, 464, 'residual stream', 'axis'); txt(BX + 43, 464, 'branch', 'axis', 'middle');
		o.push(`<text x="502" y="${fy0 + 14}" class="fl${c.layers ? ' chgt' : ''}" text-anchor="end">× ${m.layers} layers${m.full_layers ? `, ${m.full_layers} of them with full attention` : ''}${m.dense_first ? ` · the first ${m.dense_first} with a dense FFN` : ''}${m.moe_every ? ' · experts in every other layer' : ''}</text>`);
		if (m.par) {
			ln(`M${TX},432H${BX}`); box(BX, 422, 86, 20, 'norm', normName, '', c.norm, 'n1');
			ln(`M${BX + 43},422V412H422V400`); ln(`M${BX + 43},412V400`);
			ln(`M${BX + 43},400V380`); ln(`M422,400V380`);
			attnBox(BX, 250, 165, 130, true); ffnBox(340, 250, 165, 130, true);
			ln(`M${BX + 43},250V230H${TX + 8}`); ln(`M422,250V230`); ln(`M${BX + 43},230H422`); plus(TX, 230);
			box(22, 58, 116, 20, 'norm', 'Final ' + normName, '', c.norm, 'fn'); up(TX, 80);
		} else if (!post) {
			if (m.pre) { ln(`M${TX},432H${BX}`); box(BX, 422, 86, 20, 'norm', normName, '', c.norm, 'n1'); ln(`M${BX + 43},422V410`); } else ln(`M${TX},432H${BX + 43}V410`);
			attnBox(BX, 310, BW, 100, false); ln(`M${BX + 43},310V300H${TX + 8}`); plus(TX, 300);
			if (m.norm_after) box(100, 290, 86, 20, 'norm', normName, '', c.norm, 'na1');
			if (m.pre) { ln(`M${TX},272H${BX}`); box(BX, 262, 86, 20, 'norm', normName, '', c.norm, 'n2'); ln(`M${BX + 43},262V250`); } else ln(`M${TX},272H${BX + 43}V250`);
			ffnBox(BX, 150, BW, 100, false); ln(`M${BX + 43},150V140H${TX + 8}`); plus(TX, 140);
			if (m.norm_after) box(100, 130, 86, 20, 'norm', normName, '', c.norm, 'na2');
			box(22, 58, 116, 20, 'norm', 'Final ' + normName, '', c.norm, 'fn'); up(TX, 80);
		} else if (m.xattn) {
			// the Transformer's decoder: masked self-attention, cross-attention to the encoder, then the MLP, a norm on the trunk after each
			ln(`M${TX},432H${BX + 43}V412`); attnBox(BX, 326, BW, 86, false); ln(`M${BX + 43},326V314H${TX + 8}`); plus(TX, 314); box(TX - 43, 288, 86, 20, 'norm', 'LayerNorm', '', c.norm, 'n1');
			ln(`M${TX},272H${BX + 43}V260`);
			box(BX, 212, BW, 48, 'xattn', 'Cross-attention', 'reads the encoder output', false, 'xa');
			ln(`M${BX + 43},212V200H${TX + 8}`); plus(TX, 200); box(TX - 43, 176, 86, 20, 'norm', 'LayerNorm', '', c.norm, 'nx');
			ln(`M${TX},164H${BX + 43}V152`); ffnBox(BX, 84, BW, 68, false); ln(`M${BX + 43},84V72H${TX + 8}`); plus(TX, 72); box(TX - 43, 48, 86, 20, 'norm', 'LayerNorm', '', c.norm, 'n2');
		} else {
			// post-norm decoder-only (GPT-1): the same two sub-blocks as pre-norm, with the norm on the trunk after each add
			ln(`M${TX},432H${BX + 43}V410`); attnBox(BX, 310, BW, 100, false); ln(`M${BX + 43},310V300H${TX + 8}`); plus(TX, 300); box(TX - 43, 268, 86, 20, 'norm', 'LayerNorm', '', c.norm, 'n1');
			ln(`M${TX},256H${BX + 43}V250`); ffnBox(BX, 150, BW, 100, false); ln(`M${BX + 43},150V140H${TX + 8}`); plus(TX, 140); box(TX - 43, 108, 86, 20, 'norm', 'LayerNorm', '', c.norm, 'n2');
		}
		box(22, post ? 8 : 16, 116, 26, 'head', 'Linear · softmax', 'over the vocabulary', false, 'head');
		if (post) up(TX, 36);
		return svg(`The decoder block of ${m.name}, drawn bottom to top`);
	}

	// ---- the second level: the attention box opened ---------------------------------------
	// One token at position t, bottom to top: the projections with their real shapes, where RoPE and QK-norm act,
	// the scores, the mask as a matrix, softmax, the weighted sum, concat, the output projection, and what is cached.
	function openedAttn(m, p) {
		const o = [], { T, box, ln, up, left, txt, vec, chrome, svg } = pen(o);
		const mla = m.attn === 'mla', W = n(m.width), H = m.heads, Hk = m.kv_heads, hd = m.head_dim;
		const headsChg = p && (p.heads !== H || p.kv_heads !== Hk || p.head_dim !== hd || p.attn !== m.attn), posChg = p && p.pos !== m.pos, cacheChg = p && kv(p) !== kv(m);
		chrome(`Attention, opened · ${m.name}`, m.attn === 'hybrid' ? `one of the ${m.full_layers} attention layers; the ${m.state} layers keep a state instead` : m.attn === 'window' ? `one token at position t; this layer sees the last ${n(m.win)} tokens` : 'one token at position t, bottom to top', 'attn');
		txt(80, 562, 'from the norm', 'io', 'middle'); ln('M80,556V536'); up(80, 536);
		vec(32, 522, `x · ${W} values`); ln('M80,522V500');
		const chip = (x, y, t, chg) => { T(`<rect x="${x - 44}" y="${y}" width="88" height="16" class="bx zop${chg ? ' chg' : ''}"/>`); txt(x, y + 11, t, 'tag', 'middle'); };
		if (!mla) {
			ln('M80,500H420'); [130, 260, 390].forEach(x => { ln(`M${x},500V478`); up(x, 478); });
			box(70, 446, 120, 32, 'zq', 'Wq', `${W} → ${H} heads × ${hd}`, headsChg); box(200, 446, 120, 32, 'zk', 'Wk', `${W} → ${Hk} heads × ${hd}`, headsChg); box(330, 446, 120, 32, 'zv', 'Wv', `${W} → ${Hk} heads × ${hd}`, headsChg);
			ln('M130,446V420'); ln('M260,446V420'); ln('M390,446V237');
			const chips = attnTags(m).filter(t => t !== 'gated output').join(' · '), chipChg = posChg || (p && !p.qk !== !m.qk);
			if (chips) { chip(130, 404, chips, chipChg); chip(260, 404, chips, chipChg); ln('M130,404V376'); ln('M260,404V376'); } else { ln('M130,420V376'); ln('M260,420V376'); }
			// the cache, on the right
			T(`<rect x="396" y="330" width="118" height="92" class="frame${cacheChg ? ' chgf' : ''}"/>`); txt(404, 344, 'cached per token', 'lab');
			T('<rect x="404" y="352" width="40" height="9" class="lat"/>'); txt(450, 360, `K · ${Hk} × ${hd}`, 'bs');
			T('<rect x="404" y="366" width="40" height="9" class="lat"/>'); txt(450, 374, `V · ${Hk} × ${hd}`, 'bs');
			txt(404, 392, `2 bytes → ${Math.round(Hk * hd * 4 / 1024)} KB / layer`, 'bs'); txt(404, 406, m.attn === 'hybrid' ? `× ${m.full_layers} layers = ${fmtB(kv(m))}` : `× ${m.layers} layers = ${fmtB(kv(m))}`, 'bs'); txt(404, 418, m.attn === 'window' ? `only the last ${n(m.win)} kept` : 'read by every later token', 'bs');
			ln('M260,420H396'); ln('M390,340H396');
		} else {
			ln('M80,500H330'); [130, 260, 330].forEach(x => { ln(`M${x},500V478`); up(x, 478); });
			box(60, 446, 140, 32, 'zq', 'down-project q', `${W} → 1,536 (q latent)`, headsChg); box(210, 446, 100, 32, 'zk', 'down-project kv', `${W} → ${m.mla.dc} latent`, headsChg); box(320, 446, 90, 32, 'zk', 'RoPE key', `${W} → ${m.mla.dr} · RoPE`, posChg);
			T('<rect x="214" y="430" width="92" height="8" class="lat"/>'); T('<rect x="324" y="430" width="82" height="8" class="lat"/>');
			T(`<rect x="414" y="368" width="100" height="70" class="frame${cacheChg ? ' chgf' : ''}"/>`); txt(420, 382, 'cached per token', 'lab'); T('<rect x="420" y="389" width="40" height="9" class="lat"/>'); txt(464, 397, `${m.mla.dc} + ${m.mla.dr}`, 'bs'); txt(420, 412, `2 bytes × ${m.layers} layers`, 'bs'); txt(420, 423, `= ${fmtB(kv(m))} a token`, 'bs'); txt(420, 434, 'K and V are not kept', 'bs');
			ln('M130,446V414'); up(130, 414); ln('M260,446V414'); up(260, 414); ln('M365,446V355H290'); left(290, 355);
			box(60, 380, 140, 34, 'zq', 'up-project q · RoPE part', `1,536 → ${H} × (${hd} + ${m.mla.dr})`, headsChg); box(210, 380, 100, 34, 'zk', 'up-project K, V', `${m.mla.dc} → ${H} × ${hd} each`, headsChg);
			ln('M130,380V370'); ln('M260,380V370'); ln('M310,397H330V237H250');
		}
		// per head: scores, the mask, softmax, the weighted sum
		T('<rect x="40" y="150" width="350" height="226" class="frame"/>'); txt(48, 164, mla ? `for each of the ${H} heads` : `for each of the ${H} query heads${Hk < H ? `, sharing ${Hk} K and V heads` : ''}`, 'lab');
		box(100, 340, 190, 30, 'zop', mla ? `[q; q_rope] · [k; k_rope]ᵀ ÷ √${hd + m.mla.dr}` : `q · kᵀ ÷ √${hd}`, 'one score per earlier token', headsChg); up(130, 370); up(260, 370);
		ln('M195,340V318'); up(195, 318);
		txt(48, 236, 'mask', 'lab');
		const sliding = m.attn === 'window', sink = !!m.sinks, x0 = sink ? 57 : 48;
		for (let r = 0; r < 8; r++) { if (sink) T(`<rect x="48" y="${242 + r * 9}" width="8" height="8" class="c-on"/>`); for (let col = 0; col < 8; col++) T(`<rect x="${x0 + col * 9}" y="${242 + r * 9}" width="8" height="8" class="${col > r ? 'c-off' : col === r ? 'c-cur' : (sliding && r - col > 2) ? 'c-dim' : 'c-on'}"/>`); }
		txt(48, 325, sliding ? `row t sees the last ${n(m.win)} columns${sink ? ', or the sink' : ''}` : `row t sees columns ≤ t${sink ? ', or the sink' : ''}`, 'bs');
		box(140, 280, 110, 28, 'zop', 'softmax', 'weights over the past'); ln('M195,280V258'); up(195, 258);
		box(140, 222, 110, 30, 'zop', '× V', `weights · ${hd}-d values`); if (!mla) ln('M390,237H250'); left(250, 237);
		ln('M195,222V200'); up(195, 200);
		box(100, 170, 190, 26, 'zop', 'concat heads', `${H} × ${hd} = ${n(H * hd)}`, headsChg);
		ln('M195,150V128'); up(195, 128);
		if (m.gate) { box(100, 116, 190, 22, 'zop', '× sigmoid gate of x', '', p && !p.gate); ln('M195,116V104'); up(195, 104); box(100, 76, 190, 26, 'zw', 'Wo', `${n(H * hd)} → ${W}`, headsChg); ln('M195,76V62'); up(195, 62); vec(147, 48, `out · ${W} → + residual`); }
		else { box(100, 98, 190, 28, 'zw', 'Wo', `${n(H * hd)} → ${W}`, headsChg); ln('M195,98V76'); up(195, 76); vec(147, 60, `out · ${W} → + residual`); }
		return svg(`Attention in ${m.name}, opened: one token's path, bottom to top`);
	}

	// ---- the second level: the feed-forward box opened ---------------------------------------
	// Dense: up (and gate), the nonlinearity, down, with the real widths and the parameter count. Mixture of experts: the
	// router and its rule, the chosen experts as small MLPs with their gate weights, the shared expert, the weighted sum.
	function openedFfn(m, p) {
		const o = [], { T, box, ln, up, txt, cells, vec, chrome, svg } = pen(o), f = m.ffn, W = n(m.width);
		const glu = /GLU$/.test(f.act), actName = f.act === 'SwiGLU' ? 'SiLU' : f.act === 'GeGLU' ? 'GELU' : f.act;
		const pf = x => (x >= 1e9 ? (x / 1e9).toFixed(x >= 1e10 ? 0 : 1) + 'B' : (x / 1e6).toFixed(0) + 'M');
		const curve = (x, y, k) => T(k === 'ReLU' ? `<path d="M${x - 14},${y + 6}H${x}L${x + 12},${y - 8}" class="wave"/>` : `<path d="M${x - 14},${y + 6}C${x - 4},${y + 6} ${x - 4},${y + 10} ${x},${y + 6}S${x + 6},${y - 8} ${x + 12},${y - 8}" class="wave"/>`);
		const actChg = p && p.ffn.act !== f.act, kindChg = p && p.ffn.kind !== f.kind;
		chrome(`Feed-forward, opened · ${m.name}`, f.kind === 'dense' ? 'one token, bottom to top; every token takes the same path' : `one token, bottom to top; the router picks ${f.k} of ${f.n} experts for it`, 'ffn');
		txt(80, 562, 'from the norm', 'io', 'middle'); ln('M80,556V536'); up(80, 536);
		vec(32, 522, `x · ${W} values`); ln('M80,522V500');
		if (f.kind === 'dense') {
			const wChg = p && (p.ffn.dff !== f.dff || p.width !== m.width), D = n(f.dff), params = (glu ? 3 : 2) * m.width * f.dff;
			if (glu) {
				ln('M80,500H330'); ln('M150,500V478'); ln('M330,500V478'); up(150, 478); up(330, 478);
				box(60, 420, 180, 58, 'zq', 'gate projection', `${W} → ${D}`, wChg || actChg); box(240, 420, 180, 58, 'zw', 'up projection', `${W} → ${D}`, wChg);
				ln('M150,420V392'); up(150, 392); box(90, 352, 120, 40, 'zop', '', '', actChg); txt(120, 376, actName, 'bt', 'middle'); curve(170, 372, actName);
				ln('M150,352V322'); ln('M330,420V322'); up(150, 322); up(330, 322);
				box(100, 262, 280, 60, 'zop', '⊗ elementwise', `gate(x) · up(x): the gate scales each of the ${D} channels`, actChg);
				ln('M240,262V236'); up(240, 236);
			} else {
				ln('M80,500H240'); ln('M240,500V478'); up(240, 478);
				box(100, 420, 280, 58, 'zw', 'up projection', `${W} → ${D}`, wChg);
				ln('M240,420V392'); up(240, 392); box(170, 352, 140, 40, 'zop', '', '', actChg); txt(210, 376, actName, 'bt', 'middle'); curve(265, 372, actName);
				ln('M240,352V322'); up(240, 322);
				box(100, 262, 280, 60, 'zop', 'h', `${D} values, the ones below zero ${f.act === 'ReLU' ? 'cut' : 'nearly cut'}`);
				ln('M240,262V236'); up(240, 236);
			}
			const e = cells(104, 220, 24, 'c-on'); txt(e + 6, 227, `h · ${D} wide, ${f.ratio}× the stream`, 'bs');
			ln('M240,218V196'); up(240, 196);
			box(100, 136, 280, 58, 'zw', 'down projection', `${D} → ${W}`, wChg);
			ln('M240,136V100'); up(240, 100);
			vec(147, 84, `out · ${W} → + residual`);
			T('<rect x="396" y="262" width="118" height="92" class="frame"/>'); txt(404, 276, 'this block', 'lab');
			txt(404, 292, `${glu ? 3 : 2} × (${W} × ${D})`, 'bs'); txt(404, 306, `= ${pf(params)} parameters`, 'bs'); txt(404, 320, `× ${m.layers} layers = ${pf(params * m.layers)}`, 'bs'); txt(404, 340, 'every token uses all of it', 'bs');
		} else {
			const E = n(f.ed), ep = 3 * m.width * f.ed, k = f.k, sh = f.sh || 0, shown = Math.min(k, 3), sig = f.router === 'sigmoid';
			const rChg = p && (p.ffn.n !== f.n || p.ffn.k !== f.k || p.ffn.sh !== f.sh), eChg = p && (p.ffn.ed !== f.ed || p.width !== m.width);
			ln('M80,500H300'); ln('M300,500V478'); up(300, 478); if (sh) ln('M80,500H64V396');
			box(200, 430, 200, 48, 'zop', 'router', `${W} → ${f.n} scores · ${sig ? 'sigmoid' : 'softmax'} · top-${k}${sig ? ' · + a balancing bias' : ''}`, rChg || kindChg);
			const bw = 110, gap = 8, x0 = 300 - ((shown * bw + (shown - 1) * gap) / 2);
			for (let i = 0; i < shown; i++) {
				const x = x0 + i * (bw + gap), cx = x + bw / 2;
				ln(`M300,430V414H${cx}V396`); up(cx, 396);
				box(x, 330, bw, 66, 'zq', i === shown - 1 && k > shown ? `… expert #${k}` : `chosen expert ${i + 1}`, `${W} → ${E} → ${W}`, eChg || kindChg);
				txt(cx, 389, `${f.act}: gate, up, down`, 'bs', 'middle');
				ln(`M${cx},330V312`); T(`<circle cx="${cx}" cy="304" r="7" class="plus"/><text x="${cx}" y="308" class="plust" text-anchor="middle">×</text>`); txt(cx + 10, 300, `g${i + 1}`, 'lab');
				ln(`M${cx},297V282H300`);
			}
			txt(300, 410, `${k > shown ? (k - shown) + ' more chosen like these · ' : ''}${f.n - k} idle experts hold ${pf(ep * (f.n - k))} parameters this token never touches`, 'bs', 'middle');
			if (sh) { box(8, 330, 112, 66, 'zk', sh === 1 ? 'shared expert' : `${sh} shared experts`, `${W} → ${E} → ${W}`, rChg); txt(64, 389, 'always on, no gate', 'bs', 'middle'); ln('M64,330V282H300'); up(64, 396); }
			T('<circle cx="300" cy="270" r="10" class="plus"/><text x="300" y="274" class="plust" text-anchor="middle">Σ</text>'); txt(316, 266, 'weighted sum', 'lab');
			ln('M300,260V214'); up(300, 214);
			vec(207, 200, `out · ${W} → + residual`);
			T('<rect x="396" y="44" width="118" height="100" class="frame"/>'); txt(404, 58, 'this block', 'lab');
			txt(404, 74, `each expert ${pf(ep)}`, 'bs'); txt(404, 88, `${f.n + sh} experts = ${pf(ep * (f.n + sh))}`, 'bs'); txt(404, 102, `per token ${k + sh} = ${pf(ep * (k + sh))}`, 'bs'); txt(404, 116, `× ${m.moe_every ? Math.round(m.layers / m.moe_every) : m.layers - (m.dense_first || 0)} MoE layers`, 'bs');
			txt(404, 134, m.moe_every ? 'in every other layer' : m.dense_first ? `the first ${m.dense_first} are dense` : 'in every layer', 'bs');
		}
		return svg(`The feed-forward block of ${m.name}, opened`);
	}
	// ---- the diff: the model against its parent, or any other model ------------------------------
	// The parts first, by the techniques each uses; then the numbers, through the same helpers the block's labels use.
	// A changed part opens its menu.
	const NUMBERS = [
		['layers', m => n(m.layers)], ['width', m => n(m.width)], ['attention', ATT], ['norm', NORM], ['feed-forward', FFN], ['experts', EXP],
		['context', m => n(m.ctx)], ['vocabulary', m => `${n(m.vocab.n)} · ${m.vocab.tok}`], ['parameters', m => fmtP(m.params) + activeP(m)], ['KV a token', m => fmtB(kv(m))],
	];
	// the model compared with: the one picked in the diff's menu, unless that is the shown model; else the parent (the
	// first model has none, so the second)
	const base = (m, p) => (state.base && state.base !== m.id ? byId[state.base] : p || chrono[1]);
	function diffView(m, p) {
		const b = base(m, p), lines = [];
		const line = (k, sign, label, value, part) => lines.push(`<div class="${k}"${part ? ` data-menu="${part}" title="Open the ${esc(partById[part].name)} menu"` : ''}><b>${sign}</b><i>${esc(label)}</i><span>${esc(value)}</span></div>`);
		const row = (label, x, y, part) => {
			if (x === y) { line('c', '', label, x, part); return; }
			line('d', '−', label, x, part);
			line('a', '+', label, y, part);
		};
		const head = t => lines.push(`<div class="h">${esc(t)}</div>`);
		const techs = (part, q) => uses(part, q).map(t => t.what).join(' + ');
		head(`--- ${b.name} · ${b.date} · ${b.org}`);
		head(`+++ ${m.name} · ${m.date} · ${m.org}`);
		head('@@ parts @@');
		data.parts.forEach(part => row(`${part.no}. ${part.name}`, techs(part, b), techs(part, m), part.id));
		head('@@ numbers @@');
		NUMBERS.forEach(([label, f]) => row(label, f(b), f(m)));
		const changed = data.parts.filter(part => techs(part, b) !== techs(part, m)).length;
		const r = kv(m) / kv(b), cache = r < 1 ? '−' + Math.round((1 - r) * 100) + '%' : r > 1 ? '×' + r.toFixed(1) : 'the same';
		const opts = chrono.filter(q => q !== m).map(q => `<option value="${q.id}"${q === b ? ' selected' : ''}>${esc(q.name)}${q.id === m.parent ? ' (parent)' : ''}</option>`).join('');
		return `<div class="wb-view"><div class="wb-vbar"><label>against <select data-pick="base">${opts}</select></label><span class="sum">${changed} of ${data.parts.length} parts changed · KV a token ${cache} · parameters ×${(m.params / b.params).toFixed(1)}</span></div><div class="wb-diff">${lines.join('')}</div></div>`;
	}

	// draw the current view; between block views, boxes with the same key slide from where they were in the previous model
	const VIEWS = { block: schematic, attn: openedAttn, ffn: openedFfn, diff: diffView };
	function mount(m, p) {
		const pane = $('.wb-sch'), svgOld = pane.querySelector('svg'), old = new Map();
		if (svgOld) svgOld.querySelectorAll('[data-k]').forEach(e => old.set(e.dataset.k, e.getBoundingClientRect()));
		pane.innerHTML = VIEWS[state.view](m, p);
		const svg = pane.querySelector('svg');
		if (!svg || !old.size || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const scale = svg.getBoundingClientRect().width / 520;
		svg.querySelectorAll('[data-k]').forEach(e => {
			const a = old.get(e.dataset.k); if (!a) return;
			const b = e.getBoundingClientRect();
			e.style.transition = 'none';
			e.style.transform = `translate(${(a.left - b.left) / scale}px, ${(a.top - b.top) / scale}px) scale(${a.width / b.width}, ${a.height / b.height})`;
		});
		svg.classList.add('dim');
		requestAnimationFrame(() => requestAnimationFrame(() => { svg.querySelectorAll('[data-k]').forEach(e => { e.style.transition = 'transform 0.55s cubic-bezier(0.2, 0.7, 0.2, 1)'; e.style.transform = ''; }); svg.classList.remove('dim'); }));
	}

	// ---- tree, menus, navigation -------------------------------------------------------
	// the model pane is a rail: one row per model in date order, a rail per branch that forks where a child leaves its
	// parent. A first child inherits its parent's lane; any other child takes the lowest lane with nothing on it between
	// the parent's row and the end of its own branch, so a rail never runs through a dead-end sibling.
	const LAB = { 'Google DeepMind': 'Google', 'Meta AI': 'Meta', 'Mistral AI': 'Mistral', 'AI21 Labs': 'AI21' };
	const lab = m => LAB[m.org] || m.org;
	function railHtml() {
		const RH = 15, rowOf = {}; chrono.forEach((m, i) => rowOf[m.id] = i);
		const last = {}; const span = id => { let r = rowOf[id]; (kids[id] || []).forEach(k => r = Math.max(r, span(k))); last[id] = r; return r; }; span(chrono[0].id);
		const lane = {}, occ = [], taken = {};
		chrono.forEach(m => {
			const r = rowOf[m.id], p = m.parent && byId[m.parent];
			if (p && !taken[p.id]) { taken[p.id] = true; lane[m.id] = lane[p.id]; return; }
			const rp = p ? rowOf[p.id] : r, re = last[m.id];
			let l = 0; while ((occ[l] || []).some(([a, b]) => a <= re && b > rp)) l++;
			lane[m.id] = l; (occ[l] = occ[l] || []).push([rp + 1, re]);
		});
		const X = l => 44 + l * 9, Y = r => 11 + r * RH, o = [];
		chrono.forEach(m => { if (!m.parent) return; const p = byId[m.parent], x0 = X(lane[p.id]), y0 = Y(rowOf[p.id]), x1 = X(lane[m.id]), y1 = Y(rowOf[m.id]);
			o.push(x0 === x1 ? `<path d="M${x0},${y0}V${y1}" class="rail"/>` : `<path d="M${x0},${y0}V${y1 - 8}Q${x0},${y1} ${x0 + 8},${y1}H${x1}" class="rail"/>`); });
		chrono.forEach(m => { const y = Y(rowOf[m.id]);
			o.push(`<g class="rl" data-id="${m.id}" tabindex="0" role="button" aria-label="${esc(m.name)}"><rect x="2" y="${y - RH / 2}" width="100%" height="${RH}" class="bg"/><text x="4" y="${y + 3.5}" class="yr">${year(m)}</text><circle cx="${X(lane[m.id])}" cy="${y}" r="3.2" class="dot"/><text x="110" y="${y + 3.5}" class="nm">${esc(m.name)}<tspan class="lb" dx="6">${esc(lab(m))}</tspan></text>${data.parts.map((p, i) => `<rect x="${i * 8}" y="${y - 5}" width="7" height="10" class="mx pc-${p.id}" data-p="${p.id}"/>`).join('')}</g>`); });
		return `<svg height="${chrono.length * RH + 5}" role="list" aria-label="The models, oldest first, with the lineage drawn as rails">${o.join('')}</svg>`;
	}
	$('.wb-tree').innerHTML = railHtml();
	// at one unit a pixel the names can run past a narrow pane; the rail is as wide as they are, so the pane scrolls.
	// The part cells start after the longest name
	const rail = $('.wb-tree svg'), right = Math.ceil(Math.max(...[...rail.querySelectorAll('.nm')].map(t => { const b = t.getBBox(); return b.x + b.width; })) + 8);
	rail.querySelectorAll('.mx').forEach(c => c.setAttribute('x', +c.getAttribute('x') + right));
	rail.style.minWidth = right + data.parts.length * 8 + 4 + 'px';
	const state = { cur: null, view: 'block', back: [], fwd: [], base: null, ticked: {}, menu: null };

	// ---- finding models by their parts -----------------------------------------------------------
	// Ticking a technique keeps the models that use it, and ticks add up across parts. A part holds one of its
	// alternatives at a time (a block has one kind of attention), so ticking another swaps it; extras add up.
	const techOf = (part, id) => partById[part].techniques.find(t => t.id === id);
	const tickedIn = part => state.ticked[part] || [];
	// one part's ticks against one model: null when the part has none
	const passes = (m, part) => (tickedIn(part).length ? tickedIn(part).every(id => techOf(part, id).models.includes(m.id)) : null);
	// whether a part's ticks are the shown model's techniques there, no more and no fewer
	const isLike = part => { const mine = uses(partById[part], byId[state.cur]), now = tickedIn(part); return mine.length === now.length && mine.every(t => now.includes(t.id)); };
	function tick(part, id) {
		let now = tickedIn(part);
		if (now.includes(id)) now = now.filter(x => x !== id);
		else {
			if (!techOf(part, id).extra) now = now.filter(x => techOf(part, x).extra);
			now = [...now, id];
		}
		state.ticked[part] = now;
		render();
	}
	// the shown model's techniques in a part become that part's ticks; the same click again clears them
	function findLike(part) {
		state.ticked[part] = isLike(part) ? [] : uses(partById[part], byId[state.cur]).map(t => t.id);
		render();
	}
	// one technique as a row: its tick, its name, when it arrived and the model that brought it (a link), how, its glyph
	function techRow(part, t) {
		const intro = byId[t.models[0]], rest = t.models.length - 1, on = tickedIn(part).includes(t.id);
		const cls = [t.models.includes(state.cur) ? 'on' : '', on ? `ticked pc-${part}` : ''].filter(Boolean).join(' ');
		return `<li data-part="${part}" data-tick="${t.id}" role="checkbox" aria-checked="${on}" tabindex="0"${cls ? ` class="${cls}"` : ''}><b class="what"><span class="tk" aria-hidden="true">${on ? '☑' : '☐'}</span>${esc(t.what)}</b>`
			+ `<span class="meta">${year(intro)} · <span class="lit-link" data-id="${intro.id}" title="Show ${esc(intro.name)}, which introduced it">${esc(intro.name)}</span>${rest ? ' +' + rest + ' more' : ''}</span><span class="how">${esc(t.how)}</span><svg viewBox="0 0 64 22" aria-hidden="true">${GLYPH[part][t.id] || ''}</svg></li>`;
	}
	// after any change: the tree marks the models that pass every part's ticks, then the menus, the card and an open
	// drop-down are drawn afresh. The control that had the keys gets them back, or its menu does if its drop-down closed
	function render() {
		const f = document.activeElement, key = root.contains(f) && ['menu', 'like', 'tick'].find(k => f.dataset[k]);
		const any = data.parts.some(p => tickedIn(p.id).length), found = M.filter(m => data.parts.every(p => passes(m, p.id) !== false));
		$('.wb-tree').classList.toggle('filtering', any);
		$('.wb-tree').querySelectorAll('.rl').forEach(r => {
			const m = byId[r.dataset.id];
			r.classList.toggle('hit', any && found.includes(m));
			// a cell a part: its colour where the model passes that part's ticks, grey where it fails, hollow where none
			r.querySelectorAll('.mx').forEach(c => { const ok = passes(m, c.dataset.p); c.dataset.st = ok === null ? 'idle' : ok ? 'pass' : 'fail'; });
		});
		const result = !found.length ? 'no model has all of these' : found.length === 1 ? `1 of ${M.length}: ${esc(found[0].name)}` : `${found.length} of ${M.length}`;
		$('.wb-menus').innerHTML = '<span class="lab">models with</span>' + data.parts.map(p => {
			const ids = tickedIn(p.id), open = state.menu === p.id;
			const now = p.techniques.filter(t => ids.includes(t.id)).map(t => t.short).join(' + ');
			return `<button type="button" class="wb-menu pc-${p.id}${open ? ' open' : ''}${ids.length ? ' set' : ''}" data-menu="${p.id}" aria-expanded="${open}">${esc(p.name)}${now ? ': ' + esc(now) : ''} ▾</button>`;
		}).join('') + (any ? `<span class="res">${result}</span><span class="lit-link" data-act="clear">clear</span>` : '');
		const m = byId[state.cur];
		$('.wb-card').innerHTML = `<div class="wb-cardh">${esc(m.name)}, part by part<span>click a part to find the models that share it</span></div>` + data.parts.map(p => {
			const ts = uses(p, m);
			return `<button type="button" class="wb-part pc-${p.id}${isLike(p.id) ? ' set' : ''}" data-like="${p.id}"><span class="pn">${esc(p.name)}</span><b>${ts.map(t => esc(t.what)).join(' + ')}</b><span class="how">${esc(ts.map(t => t.how).join('; '))}</span></button>`;
		}).join('');
		drop();
		if (key) { const again = $(key === 'tick' && !state.menu ? `[data-menu="${f.dataset.part}"]` : `[data-${key}="${f.dataset[key]}"]`); if (again) again.focus(); }
	}
	// the drop-down under an open menu: that part's techniques. It is fixed, like the window menus' flyouts, so a
	// shrunk window cannot clip it
	function drop() {
		const d = $('.wb-drop'), a = state.menu && $(`[data-menu="${state.menu}"]`, $('.wb-menus'));
		d.hidden = !a;
		if (!a) return;
		const p = partById[state.menu], r = a.getBoundingClientRect();
		d.innerHTML = `<div class="wb-droph pc-${p.id}">${p.no}. ${esc(p.name)}<span>tick to find the models</span></div><ul class="wb-vers">${p.techniques.map(t => techRow(p.id, t)).join('')}</ul>`;
		d.style.left = Math.max(4, Math.min(r.left, window.innerWidth - d.offsetWidth - 4)) + 'px';
		d.style.top = r.bottom + 2 + 'px';
		d.style.maxHeight = Math.max(160, window.innerHeight - r.bottom - 10) + 'px';
	}
	const toggleMenu = part => { state.menu = state.menu === part ? null : part; render(); };
	const LEGEND = {
		block: '<i></i>changed from the parent model &middot; tokens enter at the bottom and leave at the top as a distribution',
		diff: '<i class="lg-d"></i>the model compared with <i class="lg-a"></i>this model &middot; a part opens its menu',
	};
	function go(id, remember, view) {
		view = view || state.view;
		if (remember !== false && state.cur && (id !== state.cur || view !== state.view)) { state.back.push({ id: state.cur, view: state.view }); state.fwd = []; }
		state.cur = id; state.view = view;
		const m = byId[id], p = m.parent ? byId[m.parent] : null, k = idx(id);
		mount(m, p);
		$('.wb-head b').textContent = m.name;
		$('.wb-head span').textContent = `${m.date} · ${m.org} · ${fmtP(m.params)} parameters${activeP(m)} · ${fmtB(kv(m))} KV per token`;
		$('.wb-foot').innerHTML = esc(m.why) + ' <span class="wb-src">' + esc(m.paper) + '</span>';
		const path = []; for (let q = m; q; q = q.parent ? byId[q.parent] : null) path.unshift(q);
		const opened_ = state.view !== 'block', VIEW = { attn: 'attention', ffn: 'feed-forward', diff: `diff with ${esc(base(m, p).name)}` };
		$('.lit-crumb').innerHTML = path.map((q, i) => (i === path.length - 1 && !opened_ ? '<b>' + esc(q.name) + '</b>' : '<span class="lit-link" data-go="' + q.id + '">' + esc(q.name) + '</span>')).join(' › ') + (opened_ ? ' › <b>' + VIEW[state.view] + '</b>' : '');
		$('.wb-tree').querySelectorAll('.rl').forEach(r => r.classList.toggle('on', r.dataset.id === id));
		const shown = view === 'diff' ? 'diff' : 'block';
		win.querySelectorAll('[data-view]').forEach(b => b.classList.toggle(b.classList.contains('tb-item') ? 'cur' : 'on', b.dataset.view === shown));
		$('.wb-legend').innerHTML = LEGEND[shown];
		$('[data-act=prev]').disabled = k === 0; $('[data-act=next]').disabled = k === chrono.length - 1;
		$('[data-act=back]').disabled = !state.back.length; $('[data-act=fwd]').disabled = !state.fwd.length;
		render();
	}
	const actions = {
		back() { if (state.back.length) { state.fwd.push({ id: state.cur, view: state.view }); const e = state.back.pop(); go(e.id, false, e.view); } },
		fwd() { if (state.fwd.length) { state.back.push({ id: state.cur, view: state.view }); const e = state.fwd.pop(); go(e.id, false, e.view); } },
		open(kind) { go(state.cur, true, kind); },
		close() { go(state.cur, true, 'block'); },
		prev() { go(chrono[idx(state.cur) - 1].id); },
		clear() { state.ticked = {}; render(); },
		next() { go(chrono[idx(state.cur) + 1].id); }
	};
	root.addEventListener('click', e => {
		const b = e.target.closest('[data-act]'); if (b) { if (!b.disabled) actions[b.dataset.act](); return; }
		const mn = e.target.closest('[data-menu]'); if (mn) { toggleMenu(mn.dataset.menu); return; }
		const lk = e.target.closest('[data-like]'); if (lk) { findLike(lk.dataset.like); return; }
		const op = e.target.closest('[data-open]'); if (op) { actions.open(op.dataset.open); return; }
		// a breadcrumb segment closes the opened box; a rail row or a technique's model link keeps it
		const pick = e.target.closest('[data-id], [data-go]'); if (pick) { go(pick.dataset.id || pick.dataset.go, true, pick.dataset.go ? 'block' : undefined); return; }
		const tk = e.target.closest('[data-tick]'); if (tk) tick(tk.dataset.part, tk.dataset.tick);
	});
	// the views, from the toolbar or the window's View menu (outside the workbench, so the listener sits on the window)
	win.addEventListener('click', e => {
		const v = e.target.closest('[data-view]'); if (!v) return;
		go(state.cur, true, v.dataset.view);
		const menu = v.closest('.tb-menu'); if (menu) menu.classList.remove('open');
	});
	// the diff's menu: the model it compares with
	root.addEventListener('change', e => {
		if (e.target.matches('[data-pick="base"]')) { state.base = e.target.value; go(state.cur, false); }
	});
	root.addEventListener('keydown', e => {
		if (e.key === 'Escape' && !state.menu && state.view !== 'block') { actions.close(); return; }
		if (e.key !== 'Enter' && e.key !== ' ') return;
		const b = e.target.closest('[data-act]'); if (b && b.tagName !== 'BUTTON') { e.preventDefault(); actions[b.dataset.act](); return; }
		const op = e.target.closest('[data-open]'); if (op) { e.preventDefault(); actions.open(op.dataset.open); return; }
		const tk = e.target.closest('[data-tick]'); if (tk) { e.preventDefault(); tick(tk.dataset.part, tk.dataset.tick); return; }
		const pick = e.target.closest('[data-id]'); if (pick) { e.preventDefault(); go(pick.dataset.id); }
	});
	// arrow keys step through time while this window is in front, unless a drop-down is open, which Escape closes.
	// Pressing anywhere outside an open drop-down and its menus closes it too. Both listeners sit on the document,
	// so once the window is closed they remove themselves and let the window be freed
	function onKey(e) {
		if (!win.isConnected) { document.removeEventListener('keydown', onKey); return; }
		if (e.key === 'Escape' && state.menu) { toggleMenu(state.menu); return; }
		if (state.menu || e.target.matches('input, textarea, select') || !win.classList.contains('active-win')) return;
		if (e.key === 'ArrowRight' && !$('[data-act=next]').disabled) actions.next();
		if (e.key === 'ArrowLeft' && !$('[data-act=prev]').disabled) actions.prev();
	}
	function onPress(e) {
		if (!win.isConnected) { document.removeEventListener('pointerdown', onPress); return; }
		if (state.menu && !e.target.closest('.wb-drop, .wb-menus')) toggleMenu(state.menu);
	}
	document.addEventListener('keydown', onKey);
	document.addEventListener('pointerdown', onPress);
	// The window's View menu normally lists headings (menubar.js); filled here, it lists the two views, as 303's does
	const viewMenu = $('.tb-outline', win);
	if (viewMenu) viewMenu.innerHTML = '<button type="button" class="tb-item cur" data-view="block">Block</button><button type="button" class="tb-item" data-view="diff">Diff</button>';
	go('llama', false);
})();
