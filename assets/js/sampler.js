// sampler.exe: two of generate()'s decoders continue one prompt side by side,
// as scheduler.exe sets a second server beside the first, on one clock counted
// in passes of the target. The runs are real (_data/sampler_runs.json,
// recorded by _tools/sampler_runs.py and checked against generate() itself):
// Pythia-1.4B, the target, continuing four prompts by each decoder, and
// Pythia-160M drafting for it, every step's likeliest tokens kept. Two lanes
// leave room for every round: the draft's proposals as they come, a pass of
// the draft each, then the target's one pass keeping or refusing them; prompt
// lookup's copy and where it was copied from; beam search's beams. A token or
// a proposal, hovered or focused, shows the distribution it came from.
//
// From the top: the program's state and the runs; a decoder's run as rounds
// on the clock, and a lane at a moment; a lane's text, rounds and strip; the
// race said between the lanes; the key and the pair's figures; drawing at the
// clock; the clock and the controls; the cards. The desktop re-creates a
// window's scripts when it swaps the window in, so this runs once per window
// and claims it with data-ready.
(function () {
	const root = document.querySelector('.smp:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';

	// ---- the program's state and the runs ----
	const $ = sel => root.querySelector(sel);
	const status = exeStatus(root);
	const R = JSON.parse($('.smp-runs').textContent), S = R.settings;
	const K = S.num_assistant_tokens, NEW = S.max_new_tokens, EPS = 1e-9;
	const word = id => R.vocab[id] ?? '';
	// a token as the text shows it: its leading space kept, a newline ↵, a
	// tab ⇥
	const shown = id => word(id).replace(/\n/g, '↵').replace(/\t/g, '⇥');
	const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
	const quote = t => `“${esc(shown(t))}”`;
	// what makes a token or a chip take the focus and show its card: h names
	// it, side:kind:i:j, a token of the answer (t), a proposal (p), a beam (b)
	// or a pruned one (d)
	const focusable = (...h) => ` tabindex="0" data-h="${h.join(':')}"`;
	// a token's mark, the colour of where it came from
	const mark = colour => (colour ? ` style="--m: ${colour}"` : '');
	// a number as the readings print it, its minus a minus sign; passes as the
	// race says them, to a hundredth under a tenth
	const fmt = (x, d = 1) => x.toFixed(d).replace('-', '−');
	const places = v => (v < 0.1 ? 2 : 1);
	// An element's HTML or text, written only when it has changed, as
	// scheduler.js's: a frame mostly says what the last one did
	const written = new WeakMap();
	const setHTML = (el, html) => {
		if (written.get(el) === html) return false;
		written.set(el, html);
		el.innerHTML = html;
		return true;
	};
	const setText = (el, s) => {
		if (el.textContent !== s) el.textContent = s;
	};

	// What a pass costs. At batch 1 decoding is bound by memory: a pass reads
	// every weight once, all but the input embedding, of which it reads a row.
	// A draft pass against a target pass is their weights' ratio; a target
	// pass, at the least, the target's weights in bf16 over an H100 SXM's
	// 3.35 TB/s
	const reads = m => m.params - m.embed_in;
	const DRAFT_COST = reads(R.models.draft) / reads(R.models.target);
	const PASS_MS = reads(R.models.target) * 2 / 3.35e12 * 1e3;

	// The decoders, each with its kind (a token a pass, beam search's beams,
	// or proposals the target checks, the draft's or prompt lookup's) and the
	// generate() call that makes it (transformers 5.22; max_new_tokens 40 on
	// every one). The draft's round is set on the draft's own generation
	// config, where AssistedCandidateGenerator reads it, not by generate()'s
	// arguments
	const SAMPLED = `do_sample=True, temperature=${S.temperature}, top_p=${S.top_p}`;
	const ASSIST = 'assistant_model=draft', CONFIG = `  # draft.generation_config: num_assistant_tokens=${K}, `
		+ 'num_assistant_tokens_schedule="constant", assistant_confidence_threshold=0';
	const DECODERS = [
		{ key: 'greedy', label: 'greedy', kind: 'plain', call: 'generate(ids)' },
		{ key: 'beam', label: 'beam search', kind: 'beam', call: `generate(ids, num_beams=${S.num_beams})` },
		{ key: 'sample', label: 'sampling', kind: 'plain', seeded: true, call: `generate(ids, ${SAMPLED})` },
		{ key: 'speculative', label: 'draft model', kind: 'draft', call: `generate(ids, ${ASSIST})${CONFIG}` },
		{ key: 'speculative_sample', label: 'draft model, sampled', kind: 'draft', seeded: true,
			call: `generate(ids, ${SAMPLED}, ${ASSIST})${CONFIG}` },
		{ key: 'lookup', label: 'prompt lookup', kind: 'lookup',
			call: `generate(ids, prompt_lookup_num_tokens=${S.prompt_lookup_num_tokens})` },
	];
	const decoder = key => DECODERS.find(d => d.key === key);

	// Where a token came from, as its mark shows it (the text stays ink): the
	// target's own pick (unmarked, the bonus a full round earns among them), a
	// draft token the target kept, one copied from earlier and kept, and,
	// sampled, a draw from max(0, p − q) after a refused proposal. With a
	// refused proposal's red they pass the dataviz validator on white (OKLab
	// ΔE 9.9 at the worst, gold against aqua, deuteranopia); aqua is under
	// 3:1, so a mark, never text
	const ORIGIN = {
		draft: { colour: '#1baf7a', label: 'a draft token, kept' },
		copy: { colour: '#b8860b', label: 'copied from earlier, kept' },
		residual: { colour: '#3c4baf', label: 'drawn from max(0, p − q), after a refusal' },
		target: { label: 'the target’s pick' },
		bonus: { label: 'the target’s pick, every proposal kept' },
	};
	const REFUSED = '#b00000', PASS = '#5c5760';

	// The settings: the prompt, the pair (the decoder in the upper lane and
	// the one it is compared with), the seed of a sampled one, what a draft
	// pass costs against a target pass (the slider on a log scale from C_LEAST
	// to C_MOST), and how fast Run plays: RATE target passes a second at ×1,
	// at the speeds scheduler.exe offers
	const at = { prompt: R.prompts[0].key, pair: ['greedy', 'speculative'], seed: S.seeds[0], c: DRAFT_COST, speed: 1 };
	const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4, 8], RATE = 5, C_LEAST = 0.02, C_MOST = 1;
	const cOf = v => C_LEAST * (C_MOST / C_LEAST) ** (v / 100);
	const vOf = c => 100 * Math.log(c / C_LEAST) / Math.log(C_MOST / C_LEAST);
	const clock = { t: 0, playing: false, last: 0, looping: false };
	// the two lanes; the clock's span on the strips, the later lane's end in
	// fives; and the steps, the end of any pass of either lane, in order, each
	// once
	let lanes = [], span = 1, steps = [];
	const endOf = () => Math.max(...lanes.map(L => L.end));

	// ---- a decoder's run as rounds on the clock ----
	// A round is what one pass of the target settles: the proposals before it
	// (the draft's, a pass of the draft each, or prompt lookup's, copied for
	// nothing), each kept, refused, discarded (one before it refused; the
	// target scores it all the same) or not needed (prompt lookup's last, past
	// max_new_tokens), and the tokens the pass made, each with the
	// distribution it came from, made at the round's end (time).
	// Beam search's round is a step of its beams, its answer the best beam
	// after the step, which a later step can rewrite
	function laneOf(key) {
		const d = decoder(key), p = R.prompts.find(x => x.key === at.prompt);
		const run = d.seeded ? p[key].find(x => x.seed === at.seed) : p[key];
		const beam = d.kind === 'beam', drafted = d.kind === 'draft', rounds = [];
		let t = 0, made = 0;
		(run.rounds || run.steps).forEach((x, i) => {
			const r = { i, t0: t, props: [], before: made };
			if (beam) {
				const top = b => ({ ...b, top: x.tops[b.parent] });
				Object.assign(r, { beams: x.beams.map(top), pruned: x.pruned.map(top), emit: path(run.steps, i) });
				const prev = i ? rounds[i - 1].emit : [];
				const k = prev.findIndex((e, j) => e.t !== r.emit[j].t);
				r.rewrite = k < 0 ? r.emit.length - 1 : k;
			} else if (d.kind === 'lookup') {
				// the n-gram it matched, where (match) and how long (n), and
				// the candidates that followed, there at the round's start
				Object.assign(r, { match: x.at, n: x.n });
				r.props = x.cand.map((tok, j) => ({ t: tok, kind: 'copy', src: x.at + x.n + j, t1: t, top: x.top[j] }));
				r.emit = x.emit.map((e, j) => ({ ...e, top: x.top[j], src: e.from === 'copy' ? r.props[j].src : null,
					refused: e.from === 'target' && j < x.cand.length ? x.cand[j] : null }));
			} else if (drafted) {
				r.props = x.draft.map((q, j) => ({ ...q, kind: 'draft', t1: t + (j + 1) * at.c, check: x.checks[j] }));
				r.emit = x.emit.map((e, j) => {
					const c = x.checks[j], q = x.draft[j];
					return c ? { ...e, top: c.top, wtop: c.wtop, q: q.q, qtop: q.qtop, pt: c.pt, r: c.r,
						res: e.from === 'residual' ? c.res : null, refused: c.ok ? null : q.t } : { ...e };
				});
				t += r.props.length * at.c;
			} else r.emit = [{ ...x }];
			r.t1 = t += 1;
			const kept = r.emit.filter(e => e.from === 'draft' || e.from === 'copy').length;
			const cut = r.props.length > kept && r.emit.length === kept;
			r.props.forEach((q, j) => {
				q.fate = j < kept ? 'kept' : cut ? 'unused' : j === kept ? 'refused' : 'discarded';
			});
			// those that counted: the kept and the first refused
			Object.assign(r, { kept, decided: cut ? kept : Math.min(r.props.length, kept + 1) });
			r.emit.forEach(e => Object.assign(e, { time: r.t1, round: i }));
			made = beam ? r.emit.length : made + r.emit.length;
			rounds.push(r);
		});
		const tokens = beam ? rounds[rounds.length - 1].emit : rounds.flatMap(r => r.emit);
		// the steps: the end of each of its passes, the draft's and the
		// target's
		const ends = rounds.flatMap(r => [...(drafted ? r.props.map(q => q.t1) : []), r.t1]);
		return { d, p, rounds, tokens, beam, drafted, ends, end: t };
	}
	// beam search's best beam after step k, back to the prompt, each token
	// with the distribution of the beam it grew from
	function path(steps, k) {
		const out = [];
		for (let s = k, j = 0; s >= 0; s--) {
			const x = steps[s].beams[j];
			out.push({ t: x.t, p: x.p, from: 'target', top: steps[s].tops[x.parent], score: x.score });
			j = x.parent;
		}
		return out.reverse();
	}

	// A lane at time t: the rounds the clock has passed, their tokens (beam
	// search's best beam), the counts so far, the round under way and the
	// proposals it has made, and the last round settled
	function stateAt(L, t) {
		const s = { toks: [], target: 0, draft: 0, decided: 0, kept: 0, cur: null, shown: [], last: null };
		for (const r of L.rounds) {
			if (r.t1 <= t + EPS) {
				s.target++;
				if (L.drafted) s.draft += r.props.length;
				s.decided += r.decided;
				s.kept += r.kept;
				s.toks = L.beam ? r.emit : s.toks.concat(r.emit);
				s.last = r;
				continue;
			}
			if (r.t0 <= t + EPS) {
				s.cur = r;
				s.shown = r.props.filter(q => q.t1 <= t + EPS);
				if (L.drafted) s.draft += s.shown.length;
			}
			break;
		}
		return s;
	}
	// tokens made by t (beam search: none until its end), and the clock when
	// the lane has made n
	const madeBy = (L, t) => L.tokens.filter(e => e.time <= t + EPS).length;
	const whenMade = (L, n) => (n ? L.tokens[n - 1].time : 0);

	// ---- the lanes ----
	const lanesEl = $('.smp-lanes'), card = $('.smp-card'), tbody = $('.smp-table tbody');
	const atField = $('[data-out="at"]'), runBtn = $('[data-act="run"]'), ends = exeEnds(root);
	// each lane's parts, and what its text and rounds were last written for
	const views = [0, 1].map(side => {
		const el = document.createElement('div');
		el.className = 'smp-lane';
		el.dataset.side = side;
		el.innerHTML = '<div class="smp-who"><b class="smp-name"></b><code class="smp-call"></code>'
			+ '<span class="smp-flag"></span></div><div class="smp-text"></div>'
			+ '<div class="smp-rounds" aria-label="Its rounds, the newest last"></div><canvas class="smp-strip" '
			+ 'aria-label="Its passes on the clock, the draft’s short ones over the target’s"></canvas>';
		const part = sel => el.querySelector(sel);
		return { el, name: part('.smp-name'), call: part('.smp-call'), flag: part('.smp-flag'), text: part('.smp-text'),
			rounds: part('.smp-rounds'), strip: part('.smp-strip'), sig: '' };
	});
	const gapEl = document.createElement('div');
	gapEl.className = 'smp-gap';
	gapEl.setAttribute('aria-live', 'polite');
	lanesEl.append(views[0].el, gapEl, views[1].el);

	// The text: the prompt faint, then the answer in ink, each token marked
	// by where it came from. While prompt lookup's round shows, the n-gram it
	// matched is boxed, at the text's end and where it matched earlier, and
	// what it copied from after the match is lit. The last round's refused
	// and discarded proposals stand struck before the target's own pick, and
	// the round under way's proposals wait, boxed, after the text
	function textHTML(L, side, s) {
		const r = s.cur || s.last, look = r && r.match != null ? r : null;
		const P = L.p.ids.length, upto = look ? P + look.before : 0;
		const lit = k => look && k >= look.match + look.n && k < look.match + look.n + look.props.length;
		const boxed = k => look && ((k >= look.match && k < look.match + look.n) || (k >= upto - look.n && k < upto));
		const struck = s.last && !L.beam
			? s.last.props.filter(q => q.fate === 'refused' || q.fate === 'discarded') : [];
		const strikeAt = struck.length ? P + s.last.before + s.last.kept : -1;
		// a token's span, its newline after it, so that the text breaks there
		const one = (t, classes, attrs = '') => `<span class="${classes.filter(Boolean).join(' ')}"${attrs}>`
			+ `${esc(shown(t))}</span>${word(t).includes('\n') ? '\n' : ''}`;
		const where = k => [lit(k) && 'smp-src', boxed(k) && 'smp-gram'];
		const refused = () => struck.map(q => {
			return one(q.t, ['smp-x'], focusable(side, 'p', s.last.i, s.last.props.indexOf(q)));
		}).join('');
		let html = L.p.ids.map((t, k) => one(t, ['smp-p', ...where(k)])).join('');
		s.toks.forEach((e, a) => {
			const k = P + a;
			if (k === strikeAt) html += refused();
			const rewritten = L.beam && s.last.i < L.rounds.length - 1 && a >= s.last.rewrite && a < s.toks.length - 1;
			const attrs = mark(ORIGIN[e.from].colour) + focusable(side, 't', a);
			html += one(e.t, ['smp-t', rewritten && 'smp-rw', ...where(k)], attrs);
		});
		if (strikeAt >= P + s.toks.length) html += refused();
		const pending = s.shown.map(q => one(q.t, ['smp-pend'], focusable(side, 'p', s.cur.i, s.cur.props.indexOf(q))));
		return html + pending.join('');
	}

	// The rounds, the newest last: a proposal a chip, ✓ kept, ✗ refused, –
	// discarded or not needed, then → the target's own token; greedy and
	// sampling a token a round; beam search its four beams' newest tokens, the
	// best first, and the four it pruned struck
	const BADGE = { kept: '✓', refused: '✗', discarded: '–', unused: '–', pending: '' };
	// a token on a chip, one of spaces alone showing them as middle dots, with
	// its classes, what makes it take the focus, and its badge
	const chip = (t, classes, attrs, badge = '') => `<span class="smp-chip${classes ? ' ' + classes : ''}"${attrs}>`
		+ `${esc(/^ +$/.test(word(t)) ? '·'.repeat(word(t).length) : shown(t))}${badge}</span>`;
	function roundsHTML(L, side, t, s) {
		return L.rounds.filter(r => r.t0 <= t + EPS).map(r => {
			const done = r.t1 <= t + EPS;
			let chips;
			if (L.beam) {
				chips = r.beams.map((b, j) => chip(b.t, j ? '' : 'smp-best', focusable(side, 'b', r.i, j))).join('')
					+ r.pruned.map((b, j) => chip(b.t, 'smp-dead', focusable(side, 'd', r.i, j))).join('');
			} else {
				const props = done ? r.props : s.shown;
				chips = props.map((q, j) => {
					const fate = done ? q.fate : 'pending', colour = fate === 'kept' ? ORIGIN[q.kind].colour : null;
					const attrs = mark(colour) + focusable(side, 'p', r.i, j);
					return chip(q.t, 'smp-' + fate, attrs, `<i>${BADGE[fate]}</i>`);
				}).join('');
				if (done) {
					const own = r.emit.slice(r.kept);
					if (own.length && props.length) chips += '<span class="smp-arrow">→</span>';
					chips += own.map((e, j) => chip(e.t, '', mark(ORIGIN[e.from].colour)
						+ focusable(side, 't', r.before + r.kept + j))).join('');
				} else chips += '<span class="smp-wait">…</span>';
			}
			return `<span class="smp-round${done ? '' : ' smp-now'}"><b>${r.i + 1}</b>${chips}</span>`;
		}).join('');
	}

	// ---- a lane's strip: its passes on the shared clock ----
	// The draft's passes over the target's: a draft pass c wide, aqua if its
	// proposal was kept, red if refused, pale if discarded; prompt lookup's
	// free candidates as a bar over the pass that checks them, gold for the
	// share kept, the rest red, or grey where not needed. A target pass shows
	// how many tokens it made; what is to come is faint, and the clock a navy
	// line
	const FATE = { kept: ORIGIN.draft.colour, refused: REFUSED, discarded: '#e6a7a7', unused: '#c9c5cb' };
	const STRIP = { draftY: 1, draftH: 6, passY: 8, passH: 11 };
	function drawStrip(L, cv, t) {
		const { cx, W, H } = fitCanvas(cv);
		const x = v => (v / span) * (W - 2), past = v => (v <= t + EPS ? 1 : 0.22);
		cx.font = '9px "Helvetica Neue", Arial, sans-serif';
		cx.textAlign = 'center';
		L.rounds.forEach(r => {
			if (L.drafted) {
				r.props.forEach(q => {
					const x0 = x(q.t1 - at.c), w = Math.max(1, x(q.t1) - x0);
					cx.globalAlpha = past(q.t1);
					cx.fillStyle = FATE[q.fate];
					cx.fillRect(x0, STRIP.draftY, Math.max(1, w - (w > 3 ? 0.5 : 0)), STRIP.draftH);
				});
			}
			const x0 = x(r.t1 - 1), w = Math.max(1, x(r.t1) - x0);
			cx.globalAlpha = past(r.t1);
			cx.fillStyle = PASS;
			cx.fillRect(x0 + 0.5, STRIP.passY, Math.max(1, w - 1), STRIP.passH);
			if (r.match != null) {
				cx.fillStyle = r.props.some(q => q.fate === 'unused') ? FATE.unused : REFUSED;
				cx.fillRect(x0 + 0.5, STRIP.draftY, Math.max(1, w - 1), STRIP.draftH);
				cx.fillStyle = ORIGIN.copy.colour;
				cx.fillRect(x0 + 0.5, STRIP.draftY, (w - 1) * r.kept / r.props.length, STRIP.draftH);
			}
			if (!L.beam && r.emit.length > 1 && w >= 9) {
				cx.fillStyle = '#ffffff';
				cx.fillText(String(r.emit.length), x0 + w / 2, STRIP.passY + 9);
			}
		});
		cx.globalAlpha = 1;
		cx.fillStyle = '#000080';
		cx.fillRect(Math.round(x(Math.min(t, span))), 0, 1.5, H);
	}

	// ---- between the lanes: the race said plainly ----
	// The lane ahead, by how many passes the other needs to make as many
	// tokens, and whether their texts are the same so far or where they part
	function gapText(t, [sA, sB]) {
		const [A, B] = lanes, done = t >= endOf() - EPS;
		const n = Math.min(sA.toks.length, sB.toks.length);
		const k = sA.toks.findIndex((e, j) => j < n && e.t !== sB.toks[j].t);
		const same = k >= 0
			? `their texts part at token ${k + 1}, ${quote(sA.toks[k].t)} against ${quote(sB.toks[k].t)}`
			: n ? `the same text${done ? `, ${n} tokens` : ' so far'}` : '';
		let race;
		if (done) {
			const d = Math.abs(A.end - B.end), [first, second] = A.end <= B.end ? [A, B] : [B, A], dp = places(d);
			race = d < EPS ? `both finish at ${fmt(A.end)} passes` : `${first.d.label} finishes ${fmt(d, dp)} passes `
				+ `sooner, at ${fmt(first.end, dp)} against ${fmt(second.end, dp)}`;
		} else {
			const nA = madeBy(A, t), nB = madeBy(B, t);
			if (nA === nB) race = nA ? `level at ${nA} tokens` : 'both at the start';
			else {
				const [lead, lag, m] = nA > nB ? [A, B, nA] : [B, A, nB];
				const ahead = Math.max(0, whenMade(lag, m) - t);
				race = `${lead.d.label} is ${fmt(ahead, places(ahead))} passes ahead, `
					+ `${m} tokens to ${Math.min(nA, nB)}`;
			}
		}
		return [race, same].filter(Boolean).join(' · ');
	}

	// ---- the key and the pair's figures ----
	// a colour's swatch, or a sample of the text's own mark
	const sw = (colour, classes = '') => `<i class="smp-sw ${classes}" style="background:${colour}"></i>`;
	const like = (classes, text = 'abc') => `<span class="${classes}">${text}</span>`;
	$('[data-out="key"]').innerHTML = [
		[sw(ORIGIN.draft.colour, 'smp-sw-tok'), ORIGIN.draft.label],
		[sw(ORIGIN.copy.colour, 'smp-sw-tok'), ORIGIN.copy.label],
		[sw(ORIGIN.residual.colour, 'smp-sw-tok'), 'drawn from max(0, <i>p</i> − <i>q</i>)'],
		[like('smp-x'), 'refused, or discarded after a refusal'],
		[like('smp-pend'), 'proposed, not yet checked'],
		[`<span>${like('smp-gram', 'ab')}${like('smp-src', 'c')}</span>`, 'matched and copied by prompt lookup'],
		[like('smp-rw'), 'rewritten by beam search'],
		[sw(PASS), 'a pass of the target'],
		[sw(FATE.kept, 'smp-sw-draft'), 'a pass of the draft, kept; red refused, pale discarded'],
	].map(([swatch, label]) => `<span>${swatch}${label}</span>`).join('');

	function repeats(toks) {
		const seen = new Set();
		let n = 0;
		for (let i = 0; i + 4 <= toks.length; i++) {
			const g = toks.slice(i, i + 4).map(e => e.t).join(' ');
			if (seen.has(g)) n++;
			seen.add(g);
		}
		return n;
	}
	// Leviathan et al. (2023): with each proposal kept with probability α,
	// independently, a round of k yields (1 − α^(k+1))/(1 − α) tokens a pass
	const expected = (alpha, k) => (alpha >= 1 ? k + 1 : (1 - alpha ** (k + 1)) / (1 - alpha));
	function tableHTML(t, states) {
		return lanes.map((L, side) => {
			const s = states[side], toks = s.toks;
			const cells = [
				s.target, L.drafted ? s.draft : '–', `${fmt(Math.min(t, L.end) * PASS_MS)} ms`,
				s.target && !L.beam ? fmt(toks.length / s.target, 2) : '–',
				L.drafted && s.decided ? fmt(expected(s.kept / s.decided, K), 2) : '–',
				s.decided ? `${s.kept} of ${s.decided}` : '–',
				toks.length ? fmt(toks.reduce((v, e) => v + Math.log(e.p), 0) / toks.length, 2) : '–',
				repeats(toks),
			];
			return `<tr><th>${esc(L.d.label)}</th>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
		}).join('');
	}

	// ---- drawing it all at the clock ----
	let statusText = '', filled = -1;
	function draw() {
		const t = clock.t, end = endOf(), states = lanes.map(L => stateAt(L, t));
		const k = steps.filter(v => v <= t + EPS).length;
		setText(atField, `${t.toFixed(1)} of ${end.toFixed(1)} passes · step ${k}`);
		paintAt(t);
		setText(runBtn, clock.playing ? '❚❚ Pause' : '▶ Run');
		ends(t <= 0, t >= end);
		// the token or chip with the focus, found again once its lane is
		// written anew, so that the keys and its card stay with it; gone, the
		// window keeps the keys
		const was = document.activeElement;
		const box = root.contains(was) && was.dataset.h ? was.closest('.smp-text, .smp-rounds') : null;
		lanes.forEach((L, side) => {
			const s = states[side], done = t >= L.end - EPS, v = views[side];
			const sig = `${s.target}|${s.draft}|${s.shown.length}|${done}`;
			if (sig !== v.sig) {
				v.sig = sig;
				if (setHTML(v.text, textHTML(L, side, s))) v.text.scrollTop = v.text.scrollHeight;
				v.text.classList.toggle('smp-prov', L.beam && !done);
				setHTML(v.rounds, roundsHTML(L, side, t, s));
				v.rounds.scrollTop = v.rounds.scrollHeight;
				setText(v.flag, done ? `✓ ${L.tokens.length} tokens at ${fmt(L.end)} passes` : '');
			}
			drawStrip(L, v.strip, t);
		});
		if (box && !was.isConnected) {
			const now = box.querySelector(`[data-h="${was.dataset.h}"]`);
			(now || root).focus({ preventScroll: true });
		}
		setText(gapEl, gapText(t, states));
		setHTML(tbody, tableHTML(t, states));
		if (carded) showCard(carded.make, carded.x, carded.y);
		const said = (clock.playing ? 'Playing at ×' + at.speed : t >= end - EPS ? 'The run’s end' : 'Paused')
			+ ' · ' + lanes.map(L => `${L.d.label} ${madeBy(L, t)} of ${NEW} tokens`).join(', ');
		if (said !== statusText) status((statusText = said));
	}
	// the field filled to where the clock is, a pixel at a time, and where
	// each lane finishes ticked at its foot
	function paintAt(t) {
		const px = Math.round((t / endOf()) * atField.clientWidth);
		if (px === filled) return;
		filled = px;
		atField.style.setProperty('--at', px + 'px');
	}
	function tickEnds() {
		atField.style.setProperty('--ticks', lanes.map(L => 'linear-gradient(#000080, #000080) '
			+ (Math.min(L.end / endOf(), 0.998) * 100).toFixed(2) + '% 100% / 1px 4px no-repeat, ').join(''));
		filled = -1;
	}

	// ---- the clock ----
	// The run plays on its own clock, RATE passes a second times the speed;
	// stepping goes from the end of one pass of either lane to the next. A
	// frame's time can come before the press that started it, so a frame
	// never turns the clock back
	function tick(now) {
		if (!root.isConnected) return;
		if (clock.playing) {
			const dt = Math.max(0, Math.min(0.1, (now - clock.last) / 1000));
			clock.t = Math.min(endOf(), clock.t + dt * RATE * at.speed);
			clock.last = now;
			if (clock.t >= endOf()) clock.playing = false;
			draw();
		}
		clock.looping = clock.playing;
		if (clock.looping) requestAnimationFrame(tick);
	}
	function play(on) {
		if (on && clock.t >= endOf() - EPS) clock.t = 0;
		clock.playing = on;
		clock.last = performance.now();
		if (on && !clock.looping) {
			clock.looping = true;
			requestAnimationFrame(tick);
		}
		draw();
	}
	function seek(t) {
		clock.playing = false;
		clock.t = Math.max(0, Math.min(endOf(), t));
		draw();
	}
	function stepBy(dir, times) {
		const ts = [0, ...steps], k = ts.filter(v => v <= clock.t + EPS).length - 1 + dir * times;
		seek(k < 0 ? 0 : k >= ts.length ? endOf() : ts[k]);
	}
	// the time field, a seek bar: pressed or dragged, the clock goes to that
	// share of the run; the wheel moves it a thousandth of the run a pixel
	const SCROLL = 1 / 1000;
	exeSeekBar(atField, share => seek(share * endOf()));
	atField.addEventListener('wheel', e => seek(clock.t + exeWheel(e) * SCROLL * endOf()), { passive: false });

	// ---- the controls ----
	// a select's options, the one chosen selected and the one barred disabled
	const optionsHTML = (values, show, now, barred) => values.map(v => `<option value="${v}"`
		+ `${v === now ? ' selected' : ''}${v === barred ? ' disabled' : ''}>${esc(show(v))}</option>`).join('');
	$('[data-in="speed"]').innerHTML = optionsHTML(SPEEDS, v => '×' + v, at.speed);
	$('[data-in="seed"]').innerHTML = optionsHTML(S.seeds, String, at.seed);
	$('.smp-prompts').innerHTML = R.prompts.map(p => `<button type="button" class="lit-btn" data-prompt="${p.key}"`
		+ ` title="${esc(p.text)}">${p.key}</button>`).join('');
	// the lanes made again for the settings, the clock kept at the same share
	// of the run unless told where
	function retime(t = null) {
		const share = lanes.length ? clock.t / endOf() : 0;
		lanes = at.pair.map(laneOf);
		span = Math.ceil(endOf() / 5) * 5;
		steps = [...new Set(lanes.flatMap(L => L.ends.map(v => +v.toFixed(9))))].sort((a, b) => a - b);
		clock.t = t ?? share * endOf();
		views.forEach(v => (v.sig = ''));
		syncControls();
		tickEnds();
		hideCard();
		draw();
	}
	// the controls as the settings stand: each lane's decoder, the other's
	// barred, its name and call, the prompt, the seed, and c
	function syncControls() {
		['first', 'second'].forEach((name, i) => {
			setHTML($(`[data-in="${name}"]`), optionsHTML(DECODERS.map(d => d.key), key => decoder(key).label,
				at.pair[i], at.pair[1 - i]));
		});
		lanes.forEach((L, side) => {
			setText(views[side].name, L.d.label);
			setText(views[side].call, L.d.call);
			views[side].call.title = L.d.call;
		});
		root.querySelectorAll('[data-prompt]').forEach(b => exePress(b, b.dataset.prompt === at.prompt));
		$('[data-in="seed"]').disabled = !lanes.some(L => L.d.seeded);
		$('[data-in="c"]').value = vOf(at.c);
		setText($('[data-out="c"]'), fmt(at.c, 3));
	}
	// What the buttons and keys do, one table for both, as scheduler.exe's:
	// a button's data-act, a key's name in KEYS; n, ten with Shift
	const ACTS = {
		run: () => play(!clock.playing),
		start: () => seek(0),
		end: () => seek(endOf()),
		back: n => stepBy(-1, n),
		next: n => stepBy(1, n),
		weights: () => {
			at.c = DRAFT_COST;
			retime();
		},
		help: () => help(),
	};
	const KEYS = { ' ': 'run', ArrowLeft: 'back', ArrowRight: 'next', Home: 'start', End: 'end', '?': 'help' };
	root.addEventListener('click', e => {
		const b = e.target.closest('button');
		if (b && b.dataset.prompt) {
			at.prompt = b.dataset.prompt;
			retime(0);
		} else if (b && b.dataset.act) ACTS[b.dataset.act](1);
	});
	// the note, in a balloon from the ? at the second row's end
	const help = exeHelp(root);
	// the keys wherever the focus is in the window but on a control, whose
	// keys are its own
	root.addEventListener('keydown', e => {
		if (e.target.closest('button, select, input') || !KEYS[e.key]) return;
		e.preventDefault();
		ACTS[KEYS[e.key]](e.shiftKey ? 10 : 1);
	});
	// presses keep the keys with the window, as a player's do, but for a
	// select, the slider or a token, which keep the focus they take
	root.addEventListener('pointerdown', e => {
		if (!e.target.closest('select, input, [data-h]')) setTimeout(() => root.focus({ preventScroll: true }));
	});
	$('[data-in="speed"]').addEventListener('change', e => (at.speed = +e.target.value));
	$('[data-in="seed"]').addEventListener('change', e => {
		at.seed = +e.target.value;
		retime();
	});
	['first', 'second'].forEach((name, i) => $(`[data-in="${name}"]`).addEventListener('change', e => {
		at.pair[i] = e.target.value;
		retime(0);
	}));
	$('[data-in="c"]').addEventListener('input', e => {
		at.c = cOf(+e.target.value);
		retime();
	});

	// ---- the cards: the distribution a token or a proposal came from ----
	// The likeliest tokens at that place as bars, the token at issue picked
	// out, those with no probability left out; beside them, columns of the
	// same tokens elsewhere: what the warpers left (the rest cut), or the
	// draft's q. The bars are the target's own p unless said otherwise
	function bars(top, pick, cols = [], label = 'the target’s <i>p</i>') {
		const shownTop = top.filter(([, v]) => v > 0), max = shownTop.length ? shownTop[0][1] : 1;
		let rows = shownTop.map(([id, v], j) => {
			const cells = cols.map(c => c.cell(id, j));
			const classes = [id === pick && 'smp-pick', cells.some(c => c.cut) && 'smp-cut'].filter(Boolean).join(' ');
			return `<tr class="${classes}"><td class="smp-w">${esc(shown(id))}</td>`
				+ `<td class="smp-bar"><i style="width:${(100 * v / max).toFixed(1)}%"></i></td><td>${fmt(v, 3)}</td>`
				+ cells.map(c => `<td>${c.text}</td>`).join('') + '</tr>';
		}).join('');
		if (pick != null && !shownTop.some(([id]) => id === pick)) {
			rows += `<tr class="smp-pick"><td class="smp-w">${esc(shown(pick))}</td>`
				+ `<td colspan="${2 + cols.length}">not among the ${S.top} likeliest</td></tr>`;
		}
		const heads = cols.map(c => `<th>${c.head}</th>`).join('');
		return `<table class="smp-dist"><tr><th></th><th>${label}</th><th></th>${heads}</tr>${rows}</table>`;
	}
	// what the warpers left of each, the likeliest left of them (the warpers
	// keep the order), the rest cut
	const CUT = { text: 'cut', cut: true };
	const warped = (wtop, left) => {
		const w = new Map(wtop);
		return { head: 'warped', cell: (id, j) => (j < left ? { text: fmt(w.get(id) ?? 0, 3) } : CUT) };
	};
	const WARPERS = `temperature ${S.temperature}, top_k ${S.top_k}, top_p ${S.top_p}`;
	// the draft's q of each, where it is among the draft's likeliest
	const draftQ = qtop => {
		const m = new Map(qtop);
		return { head: '<i>q</i>', cell: id => ({ text: m.has(id) ? fmt(m.get(id), 3) : '' }) };
	};
	// the warped p of each, for a sampled check, which sets warped p against q
	const warpedP = wtop => {
		const m = new Map(wtop);
		return { head: 'warped', cell: id => (m.get(id) > 0 ? { text: fmt(m.get(id), 3) } : CUT) };
	};

	function tokenCard(L, a) {
		const e = stateAt(L, clock.t).toks[a];
		if (!e) return '';
		const sampled = L.d.seeded;
		let head = `<p><b>${quote(e.t)}</b>, token ${a + 1} of ${L.d.label}’s answer: `, body;
		if (L.beam) {
			const score = L.rounds[e.round].emit.at(-1).score;
			head += `on the best beam after step ${e.round + 1}, whose log probabilities sum to ${fmt(score, 2)}.`;
			body = bars(e.top, e.t);
		} else if (e.from === 'draft') {
			const ratio = Math.min(1, e.pt / e.q);
			head += sampled
				? `the draft’s, kept: <i>r</i> ${fmt(e.r, 3)} ≤ min(1, <i>p</i>/<i>q</i>) = ${fmt(ratio, 3)}`
					+ `, <i>p</i> ${fmt(e.pt, 3)} warped against the draft’s <i>q</i> ${fmt(e.q, 3)}.`
				: `the draft’s, kept, being the target’s own likeliest too; the draft gave it <i>q</i> ${fmt(e.q, 3)}.`;
			body = bars(e.top, e.t, sampled ? [warpedP(e.wtop), draftQ(e.qtop)] : [draftQ(e.qtop)]);
		} else if (e.from === 'copy') {
			head += `copied from token ${e.src + 1} of the text, after the ${L.rounds[e.round].n}-gram’s first match, `
				+ 'and kept, being the target’s likeliest.';
			body = bars(e.top, e.t);
		} else if (e.from === 'residual') {
			head += 'drawn from max(0, <i>p</i> − <i>q</i>), renormalised, '
				+ `once the draft’s ${quote(e.refused)} was refused: <i>r</i> ${fmt(e.r, 3)} > <i>p</i>/<i>q</i>.`;
			body = bars(e.res, e.t, [], 'max(0, <i>p</i> − <i>q</i>), renormalised');
		} else {
			const instead = L.d.kind === 'lookup' ? 'the copied' : 'the draft’s';
			const why = e.from === 'bonus' ? 'the target’s own, a token more for nothing, every proposal kept'
				: e.refused != null ? `the target’s own, in place of ${instead} ${quote(e.refused)}`
				: 'the target’s own';
			head += sampled ? `${why}, drawn from what the warpers (${WARPERS}) left, ${e.left} tokens.`
				: `${why}, its likeliest.`;
			body = sampled ? bars(e.top, e.t, [warped(e.wtop, e.left)]) : bars(e.top, e.t);
		}
		return head + '</p>' + body + `<p class="smp-sub">${esc(ORIGIN[e.from].label)}; at ${fmt(e.time)} passes</p>`;
	}
	function proposalCard(L, i, j) {
		const r = L.rounds[i], q = r.props[j], done = r.t1 <= clock.t + EPS;
		const fate = done ? q.fate : 'pending', pick = r.emit[r.kept], c = q.check, sampled = L.d.seeded;
		const what = fate !== 'refused' ? {
			kept: 'kept',
			discarded: 'discarded, an earlier proposal refused',
			unused: 'not needed, the answer at max_new_tokens',
			pending: 'waiting on the target’s check',
		}[fate] : sampled ? `refused; the target drew ${quote(pick.t)} from what is left`
			: `refused; the target’s own likeliest here is ${quote(pick.t)}`;
		if (q.kind === 'copy') {
			return `<p><b>${quote(q.t)}</b>, prompt lookup’s candidate ${j + 1} of ${r.props.length} `
				+ `in round ${i + 1}, copied from token ${q.src + 1}, after the ${r.n}-gram’s first match: `
				+ `${what}.</p>`
				+ (done && q.top && (fate === 'kept' || fate === 'refused') ? bars(q.top, q.t) : '');
		}
		let head = `<p><b>${quote(q.t)}</b>, the draft’s proposal ${j + 1} of ${r.props.length} in round ${i + 1}, `
			+ `<i>q</i> ${fmt(q.q, 3)}: ${what}`;
		if (done && sampled && c) {
			head += `; <i>r</i> ${fmt(c.r, 3)} against min(1, <i>p</i>/<i>q</i>) = ${fmt(Math.min(1, c.pt / q.q), 3)}, `
				+ `<i>p</i> ${fmt(c.pt, 3)} warped`;
		}
		head += '.</p>';
		if (!done || !c) return head + bars(q.qtop, q.t, [], 'the draft’s <i>q</i>');
		let body = bars(c.top, q.t, sampled ? [warpedP(c.wtop), draftQ(q.qtop)] : [draftQ(q.qtop)]);
		if (c.res) body += bars(c.res, pick.t, [], 'then max(0, <i>p</i> − <i>q</i>), renormalised');
		return head + body;
	}
	function beamCard(L, i, j, dead) {
		const r = L.rounds[i], b = dead ? r.pruned[j] : r.beams[j];
		const what = dead ? `pruned: only the best ${S.num_beams} run on`
			: j ? `kept as beam ${j + 1}` : 'kept as the best beam';
		return `<p><b>${quote(b.t)}</b>, a continuation of beam ${b.parent + 1} at step ${i + 1}, `
			+ `its log probabilities summing to ${fmt(b.score, 2)}: ${what}.</p>` + bars(b.top, b.t);
	}
	function cardFor(h) {
		const [side, kind, a, b] = h.split(':'), L = lanes[+side];
		if (kind === 't') return tokenCard(L, +a);
		if (kind === 'p') return proposalCard(L, +a, +b);
		return beamCard(L, +a, +b, kind === 'd');
	}
	// a pass on a lane's strip: what it checked and made, or, over the
	// strip's upper row, the draft's proposal
	function passTip(L, v, upper) {
		const r = L.rounds.find(x => v >= x.t0 - EPS && v <= x.t1 + EPS);
		if (!r) return '';
		const q = upper && L.drafted ? r.props.find(x => v >= x.t1 - at.c && v <= x.t1) : null;
		if (q) return proposalCard(L, r.i, r.props.indexOf(q));
		const made = r.emit.slice(L.beam ? -1 : 0).map(e => quote(e.t)).join(' ');
		const lookup = L.d.kind === 'lookup';
		const what = L.beam ? `step ${r.i + 1} of the beams, the best now ending ${made}`
			: !r.props.length ? (lookup ? `nothing to copy, so one token as greedy, ${made}` : `made ${made}`)
			: `kept ${r.kept} of the ${r.props.length} ${lookup ? 'copied candidates' : 'draft’s proposals'}, `
				+ `made ${made}`;
		const prefill = r.i === 0 ? ', with the prompt’s prefill' : '';
		return `<p>A pass of the target, ${fmt(r.t1 - 1, 2)}–${fmt(r.t1, 2)}${prefill}: ${what}.</p>`;
	}
	// The card inside the window, on the side away from the pointer. What it
	// shows (make) is made again as the clock moves, so that it never goes
	// stale, and placed again only when it says something else or the
	// pointer has moved
	let carded = null;
	function showCard(make, x, y) {
		const html = make();
		if (!html) return hideCard();
		const still = carded && carded.x === x && carded.y === y && !card.hidden;
		carded = { make, x, y };
		if (!setHTML(card, html) && still) return;
		card.hidden = false;
		const box = root.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
		card.style.left = (x - box.left < box.width / 2 ? box.width - w - 8 : 8) + 'px';
		card.style.top = Math.max(4, Math.min(box.height - h - 4, y - box.top - h / 2)) + 'px';
	}
	function hideCard() {
		carded = null;
		card.hidden = true;
	}
	root.addEventListener('pointermove', e => {
		const h = e.target.closest('[data-h]');
		if (h) {
			const name = h.dataset.h;
			return showCard(() => cardFor(name), e.clientX, e.clientY);
		}
		const cv = e.target.closest('.smp-strip');
		if (!cv) return hideCard();
		const L = lanes[+cv.closest('.smp-lane').dataset.side], box = cv.getBoundingClientRect();
		const v = ((e.clientX - box.left) / (box.width - 2)) * span, upper = e.clientY - box.top < STRIP.passY;
		showCard(() => passTip(L, v, upper), e.clientX, e.clientY);
	});
	root.addEventListener('pointerleave', hideCard);
	root.addEventListener('focusin', e => {
		const h = e.target.closest('[data-h]');
		if (!h) return hideCard();
		const name = h.dataset.h, box = h.getBoundingClientRect();
		showCard(() => cardFor(name), box.left + box.width / 2, box.top + box.height / 2);
	});

	// A pane resized: the strips drawn again at its width
	const resized = new ResizeObserver(() => {
		if (!root.isConnected) return resized.disconnect();
		filled = -1;
		draw();
	});
	resized.observe(lanesEl);
	// It opens where the first lane to finish has, the other still on its way
	retime(0);
	seek(Math.min(...lanes.map(L => L.end)));
})();
