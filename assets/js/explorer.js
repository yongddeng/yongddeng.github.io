// My Computer, as Windows 98 opened it: the place itself, with the Folders bar
// down the left a toolbar button away. My Computer and its drives show
// large icons, with a drive's General tab and its pie beneath; a folder lists
// its posts in Details, and (D:) holds the programs (_programs), each opening
// in a window of its own. Resting the pointer on an item gives its infotip. A
// click selects and a double-click opens, as on the desktop it imitates. On
// a phone the window is the page: the chips pick a folder, and each row
// carries its post's opening sentence. The facts come from _plugins/explorer.rb.
(function () {
	const win = document.querySelector('.wrapper');
	if (!win) return;
	const posts = window.searchIndex || [], programs = window.programs || [];
	const $ = sel => win.querySelector(sel);
	const side = $('.xp-side'), pane = $('.post_list'), combo = $('.xp-combo'), places = $('.xp-places');
	const esc = desktop.escapeHtml, kb = desktop.sizeValue;
	const fmtKB = k => (k >= 1024 ? (k / 1024).toFixed(1) + 'MB' : Math.round(k) + 'KB');
	const many = (n, one) => n.toLocaleString('en-GB') + ' ' + one + (n === 1 ? '' : 's');
	const hasTex = s => /\$[^$]+\$/.test(s || '');

	// ---- the places: My Computer, its drives, the folders, the posts and the programs ----
	// Every tag is a course on (C:); (D:) holds the programs. A post or a
	// program is a leaf: it opens at its URL, and carries its own icon, type,
	// size and date
	const N = {};
	const add = (id, o) => { N[id] = Object.assign({ id: id, kids: [] }, o); };
	const tags = Array.from(new Set(posts.map(p => p.tags[0]).filter(Boolean))).sort();
	add('mc', { name: 'My Computer', kind: 'root', addr: 'My Computer', kids: ['C', 'D'] });
	add('C', { name: '(C:)', kind: 'drive', addr: 'C:\\', up: 'mc', kids: tags });
	add('D', { name: '(D:)', kind: 'drive', addr: 'D:\\', up: 'mc', kids: programs.map(x => x.url) });
	tags.forEach(t => add(t, { name: t, kind: 'folder', addr: 'C:\\' + t, up: 'C' }));
	posts.forEach(p => {
		add(p.url, { name: p.title, kind: 'file', up: p.tags[0], post: p, url: p.url, icon: p.icon, type: p.type, size: p.size, created: p.xp.created });
		if (N[p.tags[0]]) N[p.tags[0]].kids.push(p.url);
	});
	programs.forEach(x => add(x.url, { name: x.name, kind: 'exe', up: 'D', exe: x, url: x.url, icon: x.icon, large: x.large, type: 'Application', size: x.size, created: x.created }));
	// Each place's own order, which its list keeps until Arrange picks another:
	// a folder's posts by name, as (C:)'s folders are; (D:)'s programs as they
	// were made, the newest last
	const byName = (a, b) => a.localeCompare(b, 'en', { numeric: true });
	tags.forEach(t => N[t].kids.sort((a, b) => byName(N[a].name, N[b].name)));
	const isBox = n => n.kind !== 'file' && n.kind !== 'exe';
	const TYPE = { drive: 'Local Disk', folder: 'File Folder' };
	// Windows 98's own icons: 16px drawings, and for the large icons its 48px
	// ones shown at 24 (_explorer.scss); a leaf keeps its own, a program one
	// of each size
	const SMALL = { root: 'mycomputer-16.png', drive: 'disk-16.png', folder: 'folder-16.png' };
	const LARGE = { drive: 'disk-48.png', folder: 'folder-48.png' };
	const icon = (n, large) => '/assets/img/' + (isBox(n) ? (large ? LARGE : SMALL)[n.kind] : (large && n.large) || n.icon);
	const typeOf = n => n.type || TYPE[n.kind];
	const hrefOf = n => n.url || (n.kind === 'folder' ? '/?tag=' + n.id : '/');
	// one view for each place: a folder lists its posts, the rest show icons
	const listsPosts = n => n.kind === 'folder';

	// what a place holds, all the way down: its posts and programs, and so its
	// size and date; and of those, its posts
	const leaves = n => (isBox(n) ? n.kids.flatMap(k => leaves(N[k])) : [n]);
	const files = n => leaves(n).filter(m => m.kind === 'file').map(m => m.post);
	const kbOf = n => leaves(n).reduce((a, m) => a + kb(m.size), 0);
	// when a place was created: its own date, or a folder's first
	const madeOf = n => leaves(n).reduce((a, m) => (!a || m.created < a ? m.created : a), '');
	// whether a place shows when it was created: a post, a program or a folder, not a drive
	const dated = n => n.kind !== 'drive';

	// what a post holds, for its infotip
	function inside(p) {
		const x = p.xp;
		if (x.about) return x.about.slice();
		const out = [];
		if (x.parts) out.push(x.sections ? many(x.parts, 'part') + ', ' + many(x.sections, 'section') : many(x.parts, 'part') + (x.notes ? ' and notes' : ''));
		const bits = [];
		if (x.figures) bits.push(many(x.figures, 'figure'));
		if (x.formulas) bits.push(many(x.formulas, 'formula'));
		if (bits.length) out.push(bits.join(' · '));
		return out;
	}
	// "12 notes, 201 to 212"
	function span(ps) {
		const kind = ps.every(p => p.xp.about) ? 'program' : ps.some(p => p.xp.about) ? 'file' : 'note';
		const ns = ps.map(p => p.title.slice(0, 3)).sort();
		return many(ps.length, kind) + ', ' + (ns.length === 1 ? ns[0] : ns[0] + ' to ' + ns[ns.length - 1]);
	}

	// an element marked data-tex stays unshown until it is typeset (mathjax.html)
	function typeset(el, then) {
		typesetMath(el, () => {
			el.querySelectorAll('[data-tex]').forEach(t => t.removeAttribute('data-tex'));
			if (then) then();
		});
	}

	// ---- state ----
	// the folder the page names, by its tag page or its ?tag= (default.html)
	const start = win.dataset.at;
	const S = { at: N[start] ? start : 'mc', sel: null, back: [], fwd: [], folders: false, sort: { k: null, asc: true }, open: new Set(['mc', 'C']) };
	// what the place holds, in its own order or as Arrange sorts it
	function kids() {
		const k = S.sort.k, dir = S.sort.asc ? 1 : -1, own = N[S.at].kids.map(id => N[id]);
		if (!k) return own;
		const val = m => (k === 'size' ? kbOf(m) : k === 'type' ? typeOf(m) : k === 'made' ? madeOf(m) : m.name);
		return own.sort((a, b) => {
			if (isBox(a) !== isBox(b)) return isBox(a) ? -1 : 1;
			const x = val(a), y = val(b);
			return dir * (typeof x === 'number' ? x - y : byName(String(x), String(y)));
		});
	}

	// ---- the side: the Folders bar, on Windows 98's grid ----
	// A row is its connector cells, the icon and the name, so a child's icon
	// starts where its parent's name does. lead holds, for each ancestor below
	// the root, whether its line runs on past this row
	function treeLi(id, lead, last, depth) {
		const n = N[id], sub = n.kids.filter(k => isBox(N[k])), shown = sub.length > 0 && S.open.has(id), here = S.at === id;
		let cells = lead.map(on => '<i class="tv-c' + (on ? ' i' : '') + '"></i>').join('');
		if (depth) cells += '<i class="tv-c ' + (last ? 'l' : 't') + '">' + (sub.length ? '<b class="tv-pm' + (shown ? '' : ' shut') + '"></b>' : '') + '</i>';
		// the folder the window is in is drawn open, as Windows 98's was
		const img = here && n.kind === 'folder' ? '/assets/img/folder-open-16.png' : icon(n);
		return '<li data-id="' + id + '"><div class="tv-r' + (here ? ' on' : '') + '">' + cells + '<img src="' + img + '" alt="" /><span class="tv-l">' + esc(n.name) + '</span></div>'
			+ (shown ? '<ul>' + sub.map((k, i) => treeLi(k, depth ? lead.concat(!last) : lead, i === sub.length - 1, depth + 1)).join('') + '</ul>' : '') + '</li>';
	}
	function tree() {
		side.innerHTML = '<div class="tv-head"><span>All Folders</span><button type="button" class="tv-x" data-act="folders" aria-label="Close"><span class="cap-x"></span></button></div>'
			+ '<ul class="tv">' + treeLi('mc', [], true, 0) + '</ul>';
	}

	// ---- a drive's General tab: on (C:) what each folder holds, and the pie; on (D:) the programs ----
	// Windows 98's pie, here the drive's posts by folder, its depth drawn as
	// the same slices stacked in a darker shade; the selected folder's slice
	// pulls out. Posts, not bytes: 699's clip alone would fill the pie
	const PIE = [['#000080', '#00004a'], ['#008080', '#004a4a'], ['#800080', '#4a004a'], ['#808000', '#4a4a00'],
		['#800000', '#4a0000'], ['#008000', '#004a00'], ['#0000ff', '#000094'], ['#808080', '#4a4a4a']];
	const shade = (i, dark) => PIE[i % PIE.length][dark ? 1 : 0];
	function pie(values, hl) {
		const total = values.reduce((a, v) => a + v, 0);
		const cx = 60, cy = 30, rx = 54, ry = 25, depth = 10;
		let at = -Math.PI / 2;
		const arcs = values.map(v => { const a = at; at += (v / total) * 2 * Math.PI; return [a, at]; });
		const slice = (i, y, dark, edge) => {
			const [a, b] = arcs[i], m = (a + b) / 2;
			const pt = t => (cx + rx * Math.cos(t)).toFixed(2) + ' ' + (y + ry * Math.sin(t)).toFixed(2);
			// a whole pie has no wedge to draw: two half arcs instead
			const d = b - a > 2 * Math.PI - 1e-9 ? 'M' + pt(a) + 'A' + rx + ' ' + ry + ' 0 1 1 ' + pt(a + Math.PI) + 'A' + rx + ' ' + ry + ' 0 1 1 ' + pt(a) + 'Z'
				: 'M' + cx + ' ' + y + 'L' + pt(a) + 'A' + rx + ' ' + ry + ' 0 ' + (b - a > Math.PI ? 1 : 0) + ' 1 ' + pt(b) + 'Z';
			return '<path' + (i === hl ? ' transform="translate(' + (7 * Math.cos(m)).toFixed(2) + ' ' + (4 * Math.sin(m)).toFixed(2) + ')"' : '')
				+ ' d="' + d + '" fill="' + shade(i, dark) + '"' + (edge ? ' stroke="#000" stroke-width=".5"' : '') + '/>';
		};
		let svg = '<svg class="dp-pie" viewBox="-6 -4 132 78" aria-hidden="true">';
		for (let d = depth; d > 0; d--) values.forEach((v, i) => { if (v) svg += slice(i, cy + d, true, d === depth); });
		values.forEach((v, i) => { if (v) svg += slice(i, cy, false, true); });
		return svg + '</svg>';
	}
	function props(id) {
		const n = N[id], kids = n.kids.map(k => N[k]), hl = n.kids.indexOf(S.sel);
		const head = '<div class="dp-head"><img src="' + icon(n, true) + '" alt="" /><div><b>' + esc(n.name) + '</b><span>' + TYPE.drive + '</span></div></div>';
		if (!leaves(n).length) return '<section class="dp">' + head + '<p>Empty.</p></section>';
		// a row: the item's mark and name, what it holds or is for, and its size
		const row = (m, i, mark, what) => '<tr' + (i === hl ? ' class="on"' : '') + '><td>' + mark + '<span>' + esc(m.name) + '</span></td><td>' + what + '</td><td>' + fmtKB(kbOf(m)) + '</td></tr>';
		const table = (rows, total, cls) => '<table class="dp-table' + (cls ? ' ' + cls : '') + '"><tbody>' + rows.join('')
			+ '<tr class="dp-total"><td>Total</td><td>' + total + '</td><td>' + fmtKB(kbOf(n)) + '</td></tr></tbody></table>';
		const body = isBox(kids[0])
			? table(kids.map((f, i) => row(f, i, '<i style="background:' + shade(i) + '"></i>', many(files(f).length, 'file'))), many(files(n).length, 'file'))
				+ '<figure>' + pie(kids.map(f => files(f).length), hl) + '<figcaption>Drive ' + n.name[1] + '</figcaption></figure>'
			: table(kids.map((x, i) => row(x, i, '<img src="' + icon(x) + '" alt="" />', 'for ' + esc(x.exe.note))), many(kids.length, 'program'), 'dp-progs');
		return '<section class="dp">' + head + '<div class="dp-body">' + body + '</div></section>';
	}
	// the drive the tab describes: the window's own, or at My Computer the selected one
	const tabFor = () => (S.at === 'mc' ? (S.sel === 'D' ? 'D' : 'C') : N[S.at].kind === 'drive' ? S.at : null);

	// ---- the list: Large Icons over the tab, or a folder's Details ----
	function list() {
		const items = kids();
		const a = (n, inner) => '<a href="' + hrefOf(n) + '" data-id="' + n.id + '"' + (n.id === S.sel ? ' class="sel"' : '') + '>' + inner + '</a>';
		if (!listsPosts(N[S.at])) {
			const tab = tabFor();
			pane.innerHTML = '<div class="xp-icons">' + items.map(n => a(n, '<span class="xi"><img src="' + icon(n, true) + '" alt="" /></span><span class="nm">' + esc(n.name) + '</span>')).join('') + '</div>'
				+ (tab ? props(tab) : '');
			return;
		}
		const th = (k, label, cls) => '<span class="' + cls + '" data-k="' + k + '"' + (S.sort.k === k ? ' data-dir="' + (S.sort.asc ? 'asc' : 'desc') + '"' : '') + '>' + label + '</span>';
		pane.innerHTML = '<div class="det-head">' + th('name', 'Name', 'dh-name') + th('size', 'Size', 'dh-size') + th('type', 'Type', 'dh-type') + th('made', 'Created', 'dh-date') + '</div><ul>'
			+ items.map(n => '<li>' + a(n, '<img src="' + icon(n) + '" alt="" /><span class="nm">' + esc(n.name) + '</span><span class="sz">' + (isBox(n) ? '' : n.size)
				+ '</span><span class="ty">' + typeOf(n) + '</span><span class="dt">' + (dated(n) && madeOf(n) ? madeOf(n) : '') + '</span>') + '</li>').join('') + '</ul>';
	}

	// ---- the chrome: title, address, buttons, menus and status bar ----
	function chrome() {
		const at = N[S.at];
		$('.default_title img').src = icon(at);
		$('.default_title h1').textContent = at.name;
		combo.querySelector('img').src = icon(at);
		combo.querySelector('span').textContent = at.addr;
		const can = { back: S.back.length, fwd: S.fwd.length, up: at.up, open: S.sel };
		win.querySelectorAll('[data-act]').forEach(b => {
			const a = b.dataset.act;
			if (a in can) b.disabled = !can[a];
			if (a === 'folders') b.classList.toggle('on', S.folders);
			if (a === 'sort') b.classList.toggle('on', b.dataset.k === S.sort.k);
		});
		// Windows 98 put the selection's type and date where the count goes
		const sel = S.sel && N[S.sel], items = kids();
		const k = sel ? kbOf(sel) : items.filter(n => !isBox(n)).reduce((t, n) => t + kbOf(n), 0);
		$('.post_total .left').textContent = sel ? 'Type: ' + typeOf(sel) + (dated(sel) ? '   Created: ' + madeOf(sel) : '') : items.length + ' object(s)';
		$('.post_total .right').textContent = k ? fmtKB(k) : '';
	}

	function render() {
		if (phone()) return rows();
		win.classList.toggle('xp-folders', S.folders);
		if (S.folders) tree();
		list();
		chrome();
		pane.style.visibility = '';
	}
	function select(id) {
		S.sel = id;
		list();
		chrome();
		const it = id && pane.querySelector('[data-id="' + id + '"]');
		if (it) it.scrollIntoView({ block: 'nearest' });
	}
	function go(id, how) {
		if (how === 'back') { S.fwd.push(S.at); S.at = S.back.pop(); }
		else if (how === 'fwd') { S.back.push(S.at); S.at = S.fwd.pop(); }
		else if (id !== S.at) { S.back.push(S.at); S.fwd = []; S.at = id; }
		S.sel = null;
		// the tree opens down to wherever the window has gone
		for (let n = N[S.at]; n; n = N[n.up]) S.open.add(n.id);
		hideTip();
		render();
	}
	function open(id) {
		const n = N[id];
		if (isBox(n)) return go(id);
		// the infotip would stay over the window that opens
		hideTip();
		desktop.loadPost(n.url);
	}
	function act(a, el) {
		if (a === 'back') go(null, 'back');
		else if (a === 'fwd') go(null, 'fwd');
		else if (a === 'up') go(N[S.at].up);
		else if (a === 'home') go('mc');
		else if (a === 'open') open(S.sel);
		else if (a === 'close') document.getElementById('desktop-close').click();
		else if (a === 'folders') { S.folders = !S.folders; render(); }
		else if (a === 'sort') { S.sort = { k: el.dataset.k, asc: true }; render(); }
	}
	win.addEventListener('click', e => {
		const b = e.target.closest('[data-act]');
		if (b && !b.disabled) act(b.dataset.act, b);
	});

	// ---- the address box drops down every place the window can go ----
	combo.addEventListener('click', () => {
		if (!places.hidden) { places.hidden = true; return; }
		const out = [];
		(function walk(id, d) {
			const n = N[id];
			if (!isBox(n)) return;
			out.push('<button type="button" role="option" data-go="' + id + '" style="--d:' + d + '"><img src="' + icon(n) + '" alt="" />' + esc(n.name) + '</button>');
			n.kids.forEach(k => walk(k, d + 1));
		})('mc', 0);
		places.innerHTML = out.join('');
		places.hidden = false;
	});
	places.addEventListener('click', e => {
		const b = e.target.closest('[data-go]');
		if (!b) return;
		places.hidden = true;
		go(b.dataset.go);
	});
	document.addEventListener('click', e => {
		if (!places.hidden && !e.target.closest('.xp-addr')) places.hidden = true;
	});

	// ---- the tree: a box folds, a name goes there ----
	side.addEventListener('click', e => {
		const li = e.target.closest('.tv li');
		if (!li) return;
		const id = li.dataset.id;
		if (e.target.closest('.tv-pm')) {
			S.open.has(id) ? S.open.delete(id) : S.open.add(id);
			return tree();
		}
		if (e.target.closest('.tv-r')) go(id);
	});

	// ---- the list: select, open, sort, keys ----
	// The items are links, so a new-tab click still opens the page itself.
	// The first click redraws the list, so the browser fires no dblclick:
	// the second click carries the count instead
	pane.addEventListener('click', e => {
		if (phone()) return;
		const head = e.target.closest('.det-head [data-k]');
		if (head) {
			const k = head.dataset.k;
			S.sort = { k: k, asc: S.sort.k === k ? !S.sort.asc : true };
			return render();
		}
		const it = e.target.closest('[data-id]');
		if (it && (e.metaKey || e.ctrlKey || e.shiftKey)) return;
		e.preventDefault();
		if (it && e.detail === 2) return open(it.dataset.id);
		select(it ? it.dataset.id : null);
	});
	win.addEventListener('keydown', e => {
		if (phone() || e.target.closest('.xp-addr, .topbar')) return;
		if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); return S.back.length && go(null, 'back'); }
		if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); return S.fwd.length && go(null, 'fwd'); }
		if (e.key === 'Backspace') { e.preventDefault(); return N[S.at].up && go(N[S.at].up); }
		if (e.key === 'Enter' && S.sel) { e.preventDefault(); return open(S.sel); }
		const items = kids();
		if (!items.length || !/^(Arrow(Up|Down|Left|Right)|Home|End)$/.test(e.key)) return;
		e.preventDefault();
		const i = items.findIndex(n => n.id === S.sel), grid = !listsPosts(N[S.at]);
		const first = pane.querySelector('[data-id]');
		const cols = grid && first ? Math.max(1, Math.floor(pane.clientWidth / first.offsetWidth)) : 1;
		const step = { ArrowDown: cols, ArrowUp: -cols, ArrowRight: grid ? 1 : 0, ArrowLeft: grid ? -1 : 0 }[e.key];
		const j = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : i < 0 ? 0 : i + step;
		select(items[Math.max(0, Math.min(items.length - 1, j))].id);
		pane.focus();
	});

	// ---- infotips: what an item is and holds, after half a second ----
	let tip = null, tipTimer = null;
	function hideTip() {
		clearTimeout(tipTimer);
		if (tip) tip.remove();
		tip = null;
	}
	function tipFor(n) {
		if (n.kind === 'file') {
			const p = n.post;
			return (p.xp.lead ? '<p class="ld"' + (hasTex(p.xp.lead) ? ' data-tex' : '') + '>' + esc(p.xp.lead) + '</p>' : '')
				+ inside(p).map(f => '<div>' + esc(f) + '</div>').join('')
				+ '<div class="k">Created: ' + n.created + ' · Size: ' + n.size + '</div>';
		}
		if (n.kind === 'exe') {
			return '<p class="ld">' + esc(n.exe.about) + '</p><div>For ' + esc(n.exe.note) + '</div>'
				+ '<div class="k">Created: ' + n.created + ' · Size: ' + n.size + '</div>';
		}
		// a folder; the drives have none
		const ps = files(n);
		if (!ps.length) return '<div>Empty.</div>';
		return '<div>' + esc(span(ps)) + '</div><div class="k">Created: ' + madeOf(n) + '</div>';
	}
	pane.addEventListener('mousemove', e => {
		if (phone()) return;
		const it = e.target.closest('[data-id]'), id = it && it.dataset.id;
		if (tip && tip.dataset.id === id) return;
		hideTip();
		if (!id || N[id].kind === 'drive') return;
		const x = e.clientX, y = e.clientY;
		tipTimer = setTimeout(() => {
			tip = document.createElement('div');
			tip.className = 'xp-tip';
			tip.dataset.id = id;
			tip.innerHTML = tipFor(N[id]);
			document.body.appendChild(tip);
			const el = tip;
			const place = () => {
				const r = el.getBoundingClientRect();
				el.style.left = Math.max(4, Math.min(x + 12, innerWidth - r.width - 8)) + 'px';
				el.style.top = (y + 20 + r.height > innerHeight ? y - r.height - 8 : y + 20) + 'px';
				el.style.visibility = 'visible';
			};
			el.querySelector('[data-tex]') ? typeset(el, place) : place();
		}, 500);
	});
	pane.addEventListener('mouseleave', hideTip);
	pane.addEventListener('scroll', hideTip);

	// ---- phones: the folder the URL names, or every folder in turn ----
	function rows() {
		const tag = win.dataset.at;
		win.querySelectorAll('.drive-chips a').forEach(chip => {
			const q = new URLSearchParams((chip.getAttribute('href') || '').split('?')[1] || '');
			chip.classList.toggle('on', (q.get('tag') || '') === (tag || ''));
		});
		const groups = tag && N[tag] ? [tag] : N.C.kids;
		pane.innerHTML = groups.map(t => (tag ? '' : '<div class="xp-group">' + esc(N[t].addr) + ' · ' + N[t].kids.length + '</div>') + '<ul>'
			+ N[t].kids.map(id => N[id].post).map(p => {
				const lead = p.xp.lead || (p.xp.about || []).join('. ') + '.';
				return '<li><a href="' + p.url + '"><img src="/assets/img/' + p.icon + '" alt="" /><span class="tx"><span class="nm">' + esc(p.title) + '</span>'
					+ '<span class="ld"' + (hasTex(p.xp.lead) ? ' data-tex' : '') + '>' + esc(lead) + '</span>'
					+ '<span class="mt">' + p.type + ' · ' + p.size + ' · ' + p.xp.created + '</span></span></a></li>';
			}).join('') + '</ul>').join('');
		pane.style.visibility = '';
		// MathJax loads only once a row with TeX scrolls near
		const tex = pane.querySelectorAll('[data-tex]');
		if (!tex.length || !window.IntersectionObserver) return;
		const io = new IntersectionObserver(seen => {
			if (!seen.some(s => s.isIntersecting)) return;
			io.disconnect();
			typeset(pane);
		}, { rootMargin: '200px' });
		tex.forEach(t => io.observe(t));
	}

	// session.js saves and restores the place; Shut Down and the desktop
	// icon come home
	window.explorer = {
		at: () => S.at,
		folders: () => S.folders,
		go: (id, folders) => {
			if (folders != null) S.folders = folders;
			S.back = [];
			S.fwd = [];
			go(N[id] ? id : 'mc');
		},
		home: () => window.explorer.go('mc', false),
	};
	phoneQuery.addEventListener('change', render);
	for (let n = N[S.at]; n; n = N[n.up]) S.open.add(n.id);
	render();
})();
