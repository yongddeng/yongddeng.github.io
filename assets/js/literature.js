// 303. papers: a WinHelp-style reader inside the post window.
// Contents lists venue types and venues as books and papers as pages; the
// right pane shows the overview, one book, or one paper. View ▸ Timeline and View ▸ Lineage
// redraw the current selection laid out by subject shelf; Lineage fetches d3
// on first use. The desktop re-creates a post's scripts when it swaps the
// window in, so this runs once per window and claims it with data-ready.
(function () {
	const root = document.querySelector('.lit:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';
	const win = root.closest('.content') || root;
	const $ = (sel, from) => (from || root).querySelector(sel);
	const $$ = (sel, from) => Array.from((from || root).querySelectorAll(sel));
	const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
	const ico = id => '<svg class="lit-ico" aria-hidden="true"><use href="#' + id + '"/></svg>';

	// ---- data ---------------------------------------------------------------
	// found by type, the one attribute the desktop keeps when it re-creates a swapped window's scripts
	const data = JSON.parse($('script[type="application/json"]', win).textContent);
	const shelves = {}, papers = {};
	data.shelves.forEach(s => { s.subLabel = {}; s.subs.forEach(x => { s.subLabel[x.id] = x.label; }); shelves[s.id] = s; });
	data.papers.forEach(p => { p.by = []; papers[p.id] = p; });
	data.papers.forEach(p => p.builds_on.forEach(o => papers[o].by.push(p.id)));
	const byYear = (a, b) => a.year - b.year || a.name.localeCompare(b.name);
	// Contents books: a venue type holds venues, a venue holds papers (ids by year)
	const books = {};
	data.venue_types.forEach(t => { books[t.id] = { label: t.label, kids: [], ids: [] }; });
	data.venues.forEach(v => {
		const ids = data.papers.filter(p => p.venue === v.id).sort(byYear).map(p => p.id);
		books[v.id] = { label: v.id, meta: v.name, parent: v.type, kids: [], ids };
		books[v.type].kids.push(v.id);
		books[v.type].ids.push(...ids);
	});
	const papersIn = key => (key ? books[key].ids : data.papers.map(p => p.id)).map(id => papers[id]);
	// browse order (<< >>) is Contents order
	const order = [];
	data.venue_types.forEach(t => books[t.id].kids.forEach(v => order.push(...books[v].ids)));
	const index = {};
	order.forEach((id, i) => { index[id] = i; });
	// transitive closure along builds_on (ancestors) or by (descendants)
	function closure(id, key, set) {
		set = set || new Set();
		papers[id][key].forEach(o => { if (!set.has(o)) { set.add(o); closure(o, key, set); } });
		return set;
	}
	const lineage = id => closure(id, 'by', closure(id, 'builds_on')).add(id);
	// what the Timeline and Lineage views show: a selected paper's lineage, else the current book
	const scopeIds = () => (state.paper ? lineage(state.paper) : new Set(papersIn(state.book).map(p => p.id)));

	// ---- state and navigation -------------------------------------------------
	const state = { book: null, paper: null, view: 'page', back: [], fwd: [] };
	let timeline = null;

	function go(book, paper, remember) {
		if (remember !== false && (book !== state.book || paper !== state.paper)) {
			state.back.push([state.book, state.paper]);
			state.fwd = [];
		}
		state.book = book;
		state.paper = paper;
		render();
	}
	const openPaper = id => go(papers[id].venue, id);
	const actions = {
		back() { if (!state.back.length) return; state.fwd.push([state.book, state.paper]); const h = state.back.pop(); go(h[0], h[1], false); },
		fwd() { if (!state.fwd.length) return; state.back.push([state.book, state.paper]); const h = state.fwd.pop(); go(h[0], h[1], false); },
		root() { go(null, null); },
		prev() { step(-1); },
		next() { step(1); },
		// view controls
		oldest() { timeline.scrollTo(0); },
		newest() { timeline.scrollTo(1); },
		links() { timeline.links(); },
		zoomin() { graph.zoomBy(1.3); },
		zoomout() { graph.zoomBy(1 / 1.3); },
		reset() { go(state.book, null); graph.fit(); }
	};
	function step(delta) {
		let i;
		if (state.paper) {
			i = index[state.paper] + delta;
		} else {
			const ids = papersIn(state.book).map(p => index[p.id]).sort((a, b) => a - b);
			i = delta > 0 ? ids[0] : ids[ids.length - 1];
		}
		openPaper(order[(i + order.length) % order.length]);
	}

	function render() {
		const b = state.book, p = state.paper;
		// the Contents and breadcrumb lead to the paper's own venue, which may sit
		// inside a wider book (a paper picked in a type's Lineage keeps that scope)
		const lead = p ? papers[p].venue : b, parent = lead && books[lead].parent;
		$('[data-act=back]').disabled = !state.back.length;
		$('[data-act=fwd]').disabled = !state.fwd.length;
		// Contents: highlight the selection and open its books
		$$('.lit-row').forEach(r => r.classList.toggle('on', p ? r.dataset.paper === p : (!!b && r.dataset.group === b)));
		if (parent) setBook($('li[data-book="' + parent + '"]'), true);
		if (lead) setBook($('li[data-book="' + lead + '"]'), true);
		const on = $('.lit-tree .lit-row.on');
		if (on) on.scrollIntoView({ block: 'nearest' });
		// breadcrumb: every segment but the last is a link, so it does Up's job
		const path = [['papers', 'data-act="root"']];
		if (parent) path.push([books[parent].label, 'data-group="' + esc(parent) + '"']);
		if (lead) path.push([books[lead].label, 'data-group="' + esc(lead) + '"']);
		if (p) path.push([papers[p].name, '']);
		$('.lit-crumb').innerHTML = path.map((seg, i) => i === path.length - 1 ? '<b>' + esc(seg[0]) + '</b>' : '<span class="lit-link" ' + seg[1] + '>' + esc(seg[0]) + '</span>').join(' › ');
		if (state.view === 'page') renderPage();
		if (timeline) timeline.scope();
		if (state.view === 'g') graph.show();
	}
	function setBook(li, open) {
		if (!li) return;
		li.classList.toggle('closed', !open);
		li.querySelector('use').setAttribute('href', open ? '#lit-bookopen' : '#lit-book');
	}

	// one handler for the toolbar buttons, Contents rows, page links, breadcrumb and figure boxes
	root.addEventListener('click', e => {
		const b = e.target.closest('[data-act]');
		if (b) { if (!b.disabled) actions[b.dataset.act](); return; }
		const el = e.target.closest('[data-paper], [data-group]');
		if (!el) return;
		if (el.dataset.paper) { openPaper(el.dataset.paper); return; }
		const li = el.closest('.lit-tree li[data-book]');
		if (li && state.book === el.dataset.group && !state.paper) {
			setBook(li, li.classList.contains('closed')); // second click folds or unfolds the open book
			return;
		}
		go(el.dataset.group, null);
	});

	// ---- pages -------------------------------------------------------------------
	const overview = $('.lit-page').innerHTML;
	const link = id => '<span class="lit-link" data-paper="' + id + '">' + esc(papers[id].name) + '</span> <span class="lit-yv">(' + papers[id].year + ')</span>';
	const links = ids => ids.length ? ids.map(link).join('; ') : '<span class="lit-yv">none in this list</span>';
	const swatch = s => '<i class="lit-sw" style="background:' + s.color + '"></i>';
	const span = ps => ps[0].year + (ps.length > 1 ? ' – ' + ps[ps.length - 1].year : '');

	function renderPage() {
		const pane = $('.lit-page');
		pane.innerHTML = state.paper ? topicPage(papers[state.paper]) : state.book ? bookPage(state.book) : overview;
		$('.lit-text', pane).scrollTop = 0;
	}
	const paperList = ids => '<ul class="lit-list">' + ids.map(id => {
		const p = papers[id];
		return '<li>' + ico('lit-page') + '<span class="lit-link" data-paper="' + p.id + '">' + esc(p.name)
			+ '</span> <span class="lit-yv">' + p.year + ' · ' + swatch(shelves[p.shelf]) + esc(shelves[p.shelf].short || shelves[p.shelf].label) + '</span>'
			+ '<span class="lit-note">' + esc(p.note) + '</span></li>';
	}).join('') + '</ul>';
	function bookPage(key) {
		const b = books[key], ps = papersIn(key);
		const head = b.meta ? b.meta : b.label;
		const meta = (b.parent ? esc(books[b.parent].label) + ' · ' + esc(b.label) : b.kids.length + ' venues') + ' · ' + ps.length + ' paper' + (ps.length > 1 ? 's' : '') + ', ' + span(ps);
		const body = b.kids.length
			? b.kids.map(v => '<p class="lit-h3"><span class="lit-link" data-group="' + esc(v) + '">' + esc(v) + '</span> <span class="lit-yv">' + esc(books[v].meta) + ' (' + books[v].ids.length + ')</span></p>' + paperList(books[v].ids)).join('')
			: paperList(b.ids);
		return '<div class="lit-nsr"><p class="lit-h2">' + esc(head) + '</p><p class="lit-meta">' + meta + '</p></div><div class="lit-text">' + body + '</div>';
	}
	function topicPage(p) {
		const s = shelves[p.shelf];
		const shelfmates = data.papers.filter(q => q.shelf === p.shelf && q.sub === p.sub && q.id !== p.id).sort(byYear).map(q => q.id);
		return '<div class="lit-nsr"><p class="lit-h2">' + esc(p.title) + '</p><p class="lit-meta"><span class="lit-link" data-group="' + esc(p.venue) + '">' + esc(p.venue) + '</span>, ' + p.year
			+ ' &nbsp;·&nbsp; ' + swatch(s) + esc(s.label) + ' › ' + esc(s.subLabel[p.sub]) + ' &nbsp;·&nbsp; topic ' + (index[p.id] + 1) + ' of ' + order.length + '</p></div>'
			+ '<div class="lit-text"><p>' + esc(p.note) + '</p>' + figure(p)
			+ '<p class="lit-h3">Builds on</p><p>' + links(p.builds_on) + '</p>'
			+ '<p class="lit-h3">Followed by</p><p>' + links(p.by) + '</p>'
			+ '<p class="lit-h3">Same shelf</p><p>' + links(shelfmates) + '</p></div>';
	}
	// ancestors on the left, the paper in the middle, descendants on the right
	function figure(p) {
		const L = p.builds_on, R = p.by;
		if (!L.length && !R.length) return '';
		const BW = 150, BH = 22, GY = 8, COL = 200, rows = Math.max(L.length, R.length, 1), H = rows * (BH + GY) + 10, W = 3 * COL - 50;
		const yAt = (i, n) => (H - (n * (BH + GY) - GY)) / 2 + i * (BH + GY);
		const mid = yAt(0, 1) + BH / 2;
		const box = (id, x, y, me) => '<g' + (me ? '' : ' data-paper="' + id + '"') + '><rect class="box' + (me ? ' me' : '') + '" x="' + x + '" y="' + y + '" width="' + BW + '" height="' + BH
			+ '" stroke="' + shelves[papers[id].shelf].color + '"/><text x="' + (x + 8) + '" y="' + (y + 15) + '">' + esc(papers[id].name.length > 22 ? papers[id].name.slice(0, 21) + '…' : papers[id].name)
			+ ' <tspan fill="#55505a">’' + String(papers[id].year).slice(2) + '</tspan></text></g>';
		const arrow = (x1, y1, x2, y2) => '<path class="arr" d="M' + x1 + ',' + y1 + 'C' + (x1 + 25) + ',' + y1 + ' ' + (x2 - 25) + ',' + y2 + ' ' + x2 + ',' + y2 + '" marker-end="url(#lit-arr)"/>';
		let s = '';
		L.forEach((id, i) => { const y = yAt(i, L.length); s += box(id, 0, y, false) + arrow(BW, y + BH / 2, COL - 2, mid); });
		s += box(p.id, COL, yAt(0, 1), true);
		R.forEach((id, i) => { const y = yAt(i, R.length); s += arrow(COL + BW, mid, 2 * COL - 2, y + BH / 2) + box(id, 2 * COL, y, false); });
		return '<figure class="lit-fig"><svg role="img" aria-label="What this paper builds on, left, and what followed it, right" viewBox="-1 -1 ' + (W + 2) + ' ' + (H + 2) + '" width="' + W + '" height="' + H + '">' + s
			+ '</svg><figcaption>Builds on (left) · this paper · followed by (right). Click a box to jump.</figcaption></figure>';
	}

	// ---- views -------------------------------------------------------------------------
	const VIEWS = { page: 'Page', tl: 'Timeline', g: 'Lineage' };
	function setView(id) {
		state.view = id;
		$$('.lit-view').forEach(x => x.classList.toggle('on', x.classList.contains('lit-' + id)));
		$$('[data-view]', win).forEach(b => b.classList.toggle(b.classList.contains('tb-item') ? 'cur' : 'on', b.dataset.view === id));
		if (id === 'page') renderPage();
		if (id === 'tl') { timeline = timeline || makeTimeline(); timeline.scope(); }
		if (id === 'g') graph.show();
	}
	// The window's View menu normally lists headings (menubar.js); filled here, it lists views instead
	const drop = $('.tb-outline', win);
	if (drop) drop.innerHTML = Object.keys(VIEWS).map(id => '<button type="button" class="tb-item' + (id === 'page' ? ' cur' : '') + '" data-view="' + id + '">' + VIEWS[id] + '</button>').join('');
	win.addEventListener('click', e => {
		const b = e.target.closest('[data-view]');
		if (!b) return;
		setView(b.dataset.view);
		const menu = b.closest('.tb-menu');
		if (menu) menu.classList.remove('open');
	});

	// ---- Timeline: one lane per shelf, one column per year ------------------------------
	function makeTimeline() {
		const CW = 100, GW = 36, CHW = 92, CHH = 14, GAP = 3, PAD = 6;
		// one column per year that has a paper; a run of empty years collapses to one narrow gap column
		const years = [...new Set(data.papers.map(p => p.year))].sort((a, b) => a - b), cols = [], colX = {};
		let W = 0;
		years.forEach((yr, i) => {
			if (i && yr - years[i - 1] > 1) { cols.push({ label: '…', x: W, w: GW }); W += GW; }
			cols.push({ label: yr, x: W, w: CW }); colX[yr] = W; W += CW;
		});
		const NS = 'http://www.w3.org/2000/svg';
		const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k])); parent.appendChild(n); return n; };
		const view = $('.lit-tl'), box = $('.lit-tlscroll', view), svg = $('svg', view);
		view.classList.add('nolinks'); // links are off until asked for: chips by year first
		const pos = {}, laneTop = {};
		let y = 0, lanes = '<div class="lit-lane lit-ruler"><button type="button" class="lit-btn" data-act="oldest" title="First year">&#9666;&#9666;</button><button type="button" class="lit-btn" data-act="newest" title="Last year">&#9656;&#9656;</button><button type="button" class="lit-btn" data-act="links" title="Show or hide the builds-on links">links</button></div>'; // the corner cell holds the scroll and link buttons
		data.shelves.forEach(s => {
			const cells = {};
			data.papers.filter(p => p.shelf === s.id).sort(byYear).forEach(p => { (cells[p.year] = cells[p.year] || []).push(p); });
			const rows = Math.max(1, ...Object.values(cells).map(c => c.length));
			const h = PAD * 2 + rows * (CHH + GAP) - GAP;
			Object.values(cells).forEach(c => c.forEach((p, i) => { pos[p.id] = { x: colX[p.year] + (CW - CHW) / 2, y: y + PAD + i * (CHH + GAP) }; }));
			lanes += '<div class="lit-lane" style="height:' + h + 'px"><i class="lit-sw" style="background:' + s.color + '"></i>' + esc(s.short || s.label) + '</div>';
			laneTop[s.id] = y;
			y += h;
		});
		$('.lit-lanes', view).innerHTML = lanes;
		const H = y;
		const rul = cols.map(c => '<span style="left:' + c.x + 'px;width:' + c.w + 'px">' + c.label + '</span>').join('');
		const rulEl = $('.lit-rul', view);
		rulEl.innerHTML = rul;
		rulEl.style.width = W + 'px';
		svg.setAttribute('width', W);
		svg.setAttribute('height', H);
		cols.concat([{ x: W }]).forEach(c => el('line', { class: 'ycol', x1: c.x, x2: c.x, y1: 0, y2: H }, svg));
		Object.values(laneTop).slice(1).forEach(t => el('line', { class: 'ycol', x1: 0, x2: W, y1: t - 0.5, y2: t - 0.5 }, svg));
		const edges = [];
		data.papers.forEach(p => p.builds_on.forEach(o => {
			const a = pos[o], b = pos[p.id], x1 = a.x + CHW, y1 = a.y + CHH / 2, x2 = b.x, y2 = b.y + CHH / 2;
			const d = x2 > x1 + 4
				? 'M' + x1 + ',' + y1 + 'C' + (x1 + x2) / 2 + ',' + y1 + ' ' + (x1 + x2) / 2 + ',' + y2 + ' ' + x2 + ',' + y2
				: 'M' + x1 + ',' + y1 + 'C' + (x1 + 26) + ',' + y1 + ' ' + (x1 + 26) + ',' + y2 + ' ' + (x1 + 1) + ',' + y2; // same year: loop out the right
			edges.push({ s: o, t: p.id, el: el('path', { class: 'lk', d: d, stroke: shelves[papers[o].shelf].color, 'marker-end': 'url(#lit-arr-grey)' }, svg) });
		}));
		const chips = {};
		data.papers.forEach(p => {
			const g = el('g', { class: 'chip', 'data-paper': p.id, transform: 'translate(' + pos[p.id].x + ',' + pos[p.id].y + ')' }, svg);
			el('rect', { width: CHW, height: CHH, stroke: shelves[p.shelf].color }, g);
			el('rect', { class: 'bar', width: 3, height: CHH, fill: shelves[p.shelf].color }, g);
			el('text', { x: 7, y: 10.5 }, g).textContent = p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name;
			el('title', {}, g).textContent = p.title + ' (' + p.venue + ' ' + p.year + ')';
			chips[p.id] = g;
		});
		// hovering a paper lights its whole ancestry and descent
		svg.addEventListener('mouseover', e => {
			const c = e.target.closest('.chip');
			if (!c) return;
			const set = lineage(c.dataset.paper);
			view.classList.add('hl');
			Object.keys(chips).forEach(id => chips[id].classList.toggle('near', set.has(id)));
			edges.forEach(x => x.el.classList.toggle('near', set.has(x.s) && set.has(x.t)));
		});
		svg.addEventListener('mouseout', e => {
			if (e.target.closest('.chip') && !(e.relatedTarget && e.relatedTarget.closest('.chip'))) view.classList.remove('hl');
		});
		svg.addEventListener('dblclick', e => { if (e.target.closest('.chip')) setView('page'); });
		svg.addEventListener('click', e => {
			const c = e.target.closest('.chip');
			if (c && c.dataset.paper === state.paper) { e.stopPropagation(); go(null, null); } // back to the whole chart
		});
		// open on the newest year; the older ones are a scroll to the left
		box.scrollLeft = box.scrollWidth;
		return {
			scrollTo(end) { box.scrollLeft = end ? box.scrollWidth : 0; },
			links() { const off = view.classList.toggle('nolinks'); $('[data-act=links]', view).classList.toggle('on', !off); },
			// a selected paper keeps its lineage lit, as the hover previews it; a book dims to its papers
			scope() {
				const p = state.paper, set = scopeIds();
				// a lineage keeps only its own links; a book keeps every link touching it
				const kept = p ? x => set.has(x.s) && set.has(x.t) : x => set.has(x.s) || set.has(x.t);
				view.classList.toggle('scoped', !!(p || state.book));
				Object.keys(chips).forEach(id => { chips[id].classList.toggle('out', !set.has(id)); chips[id].classList.toggle('me', id === p); });
				edges.forEach(x => x.el.classList.toggle('out', !kept(x)));
				if (p) box.scrollTop = Math.max(0, pos[p].y - box.clientHeight / 2);
			}
		};
	}

	// ---- Lineage: force graph of the selection, clustered by shelf ----------------------
	const graph = (() => {
		const view = $('.lit-g');
		let drawn = null, sim = null, nodeSel = null, pending = null, svgSel = null, zoomB = null, fitT = null;
		function loadD3(cb) {
			if (window.d3) { cb(); return; }
			if (pending) { pending.push(cb); return; }
			pending = [cb];
			const s = document.createElement('script');
			s.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js';
			s.onload = () => { const cbs = pending; pending = null; cbs.forEach(f => f()); };
			s.onerror = () => { pending = null; $('.lit-hint', view).textContent = 'Lineage needs d3, which did not load.'; };
			document.head.appendChild(s);
		}
		// A selected paper is drawn with its whole lineage, ancestors and descendants;
		// with none selected the current book is drawn
		const scopeKey = () => (state.paper ? 'p:' + state.paper : state.book || '*');
		function show() {
			if (!view.classList.contains('on')) return;
			loadD3(() => { if (drawn !== scopeKey()) draw(); });
		}
		function draw() {
			drawn = scopeKey();
			const W = view.clientWidth || 600, H = view.clientHeight || 440;
			const scope = scopeIds(), ctx = new Set();
			// a book shows where its papers link out; a lineage is already complete, so no context
			if (!state.paper) scope.forEach(id => papers[id].builds_on.concat(papers[id].by).forEach(o => { if (!scope.has(o)) ctx.add(o); }));
			const ids = new Set([...scope, ...ctx]);
			const nodes = [...ids].map(id => ({ id, p: papers[id], ctx: !scope.has(id), r: (scope.has(id) ? 4 : 3) + 1.6 * Math.sqrt(papers[id].by.filter(b => ids.has(b)).length) }));
			const links = [];
			data.papers.forEach(p => p.builds_on.forEach(o => { if (ids.has(o) && ids.has(p.id)) links.push({ source: o, target: p.id }); }));
			if (sim) sim.stop();
			// the hovered node goes with the old drawing, so its mouseleave never fires
			view.classList.remove('hl');
			const svg = svgSel = d3.select(view).select('svg');
			svg.selectAll('*').remove();
			svg.attr('viewBox', [0, 0, W, H]);
			svg.append('defs').html('<marker id="lit-garr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#777"/></marker>');
			const g = svg.append('g');
			const zoom = zoomB = d3.zoom().scaleExtent([0.4, 3]).on('zoom', e => g.attr('transform', e.transform));
			svg.call(zoom);
			// each shelf gets a bearing on a ring, so clusters land in the same place every time
			const ring = {};
			data.shelves.forEach((s, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / data.shelves.length; ring[s.id] = { x: W / 2 + Math.cos(a) * W * 0.34, y: H / 2 + Math.sin(a) * H * 0.34 }; });
			const small = scope.size < 30;
			sim = d3.forceSimulation(nodes).randomSource(d3.randomLcg(11))
				.force('link', d3.forceLink(links).id(d => d.id).distance(small ? 48 : 36).strength(0.5))
				.force('charge', d3.forceManyBody().strength(small ? -140 : -95))
				.force('x', d3.forceX(d => ring[d.p.shelf].x).strength(0.1))
				.force('y', d3.forceY(d => ring[d.p.shelf].y).strength(0.1))
				.force('collide', d3.forceCollide(d => d.r + 10));
			const link = g.append('g').selectAll('path').data(links).join('path').attr('class', 'edge').attr('marker-end', 'url(#lit-garr)');
			nodeSel = g.append('g').selectAll('g').data(nodes).join('g')
				.attr('class', d => 'node' + (d.ctx ? ' ctx' : '') + (d.id === state.paper ? ' sel' : ''))
				.attr('data-paper', d => d.id)
				.call(d3.drag()
					.on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
					.on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
					.on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
			nodeSel.append('circle').attr('r', d => d.r).attr('fill', d => shelves[d.p.shelf].color).attr('stroke', d => d.ctx ? shelves[d.p.shelf].color : '#fff');
			nodeSel.append('text').attr('x', d => d.r + 3).attr('y', 3.5).text(d => d.p.name);
			function tick() {
				link.attr('d', d => {
					const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y, L = Math.hypot(dx, dy) || 1;
					return 'M' + (d.source.x + dx / L * d.source.r) + ',' + (d.source.y + dy / L * d.source.r) + 'L' + (d.target.x - dx / L * (d.target.r + 3)) + ',' + (d.target.y - dy / L * (d.target.r + 3));
				});
				nodeSel.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
			}
			sim.on('tick', tick);
			// settle first, then fit everything (labels included) into the pane
			sim.stop();
			for (let i = 0; i < 220; i++) sim.tick();
			tick();
			const xs = nodes.map(d => d.x), ys = nodes.map(d => d.y);
			const x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 90, y0 = Math.min(...ys) - 16, y1 = Math.max(...ys) + 16;
			const HB = H - 28; // keep the hint line clear
			const k = Math.min(W / (x1 - x0), HB / (y1 - y0), 1.4);
			fitT = d3.zoomIdentity.translate((W - k * (x0 + x1)) / 2, (HB - k * (y0 + y1)) / 2).scale(k);
			svg.call(zoom.transform, fitT);
			sim.alpha(0.06).restart();
			nodeSel.on('mouseenter', (e, d) => {
				const near = new Set([d.id, ...d.p.builds_on, ...d.p.by]);
				view.classList.add('hl');
				nodeSel.classed('near', x => near.has(x.id));
				link.classed('near', l => l.source.id === d.id || l.target.id === d.id);
			}).on('mouseleave', () => {
				view.classList.remove('hl');
				nodeSel.classed('near', false);
				link.classed('near', false);
			}).on('click', (e, d) => { e.stopPropagation(); go(state.book, d.id); })
			.on('dblclick', e => { e.stopPropagation(); setView('page'); });
			$('.lit-hint', view).textContent = (state.paper ? 'The lineage of ' + papers[state.paper].name + ': what it builds on and what built on it. '
				: state.book ? 'Hollow nodes are papers outside this book that these link to. ' : 'Drag to pan, wheel to zoom. ')
				+ 'Click a paper to select it, double-click to read it.';
		}
		return {
			show,
			fit() { if (svgSel) svgSel.transition().duration(200).call(zoomB.transform, fitT); },
			zoomBy(k) { if (svgSel) svgSel.transition().duration(150).call(zoomB.scaleBy, k); }
		};
	})();

	render();
})();
