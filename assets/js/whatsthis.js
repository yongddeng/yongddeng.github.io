// What's This?, as Windows 98 had it, but held down: the ? on a window's
// title bar, or the ? key for the window in front, lights the parts that
// have a card until it is pressed again. Pointing at a lit part opens its
// card, a click keeps the card, and a click anywhere else shuts it. A
// program names its parts with data-wt and keeps their notes, under the same
// names, in its .exe-notes; a note hidden there is left out, as
// optimiser.exe hides the surfaces not on its map. In a maths post the parts
// are the uses of the terms maths200 defines (_plugins/terms.rb), marked the
// first time its ? is pressed, and a term's card is the statement that
// defines it.
(function () {
	// one card at a time, the part it is for, and whether a click kept it
	var card = null, at = null, kept = false, openT = 0, shutT = 0;
	// the terms, [name, post], once a post's ? has fetched them
	var terms = null;

	// Where a card goes: inside its part by the pointer when it fits there,
	// else off the part, beside a pane or under (or over) a row of buttons
	// or a term, so that it covers the part's neighbours rather than the part
	function place(r, w, h, x, y) {
		var m = 8, W = document.documentElement.clientWidth, H = window.innerHeight;
		function clamp(v, lo, hi) { return Math.max(lo, Math.min(v, hi)); }
		if (r.width >= w + 2 * m && r.height >= h + 2 * m) {
			return [clamp(x + 12, r.left + m, r.right - w - m), clamp(y + 16, r.top + m, r.bottom - h - m)];
		}
		var across = clamp(x - 40, m, W - w - m), down = clamp(y - 20, m, H - h - m);
		var sides = {
			below: [across, r.bottom + 6, H - r.bottom - 6 >= h + m],
			above: [across, r.top - h - 6, r.top - 6 >= h + m],
			left: [r.left - w - 6, down, r.left - 6 >= w + m],
			right: [r.right + 6, down, W - r.right - 6 >= w + m]
		};
		var order = r.height > 60 ? ['left', 'right', 'below', 'above'] : ['below', 'above', 'left', 'right'];
		var fit = order.filter(function (k) { return sides[k][2]; })[0] || 'below';
		return [sides[fit][0], Math.max(m, sides[fit][1])];
	}

	function shut() {
		clearTimeout(shutT);
		if (card) card.remove();
		if (at) at.classList.remove('wt-at');
		card = at = null;
		kept = false;
	}

	// a program's card: the notes under the part's name, but those hidden
	function notes(win, part) {
		var html = '';
		win.querySelectorAll('.exe-notes [data-note="' + part.dataset.wt + '"]').forEach(function (n) {
			if (!n.hidden) html += '<p>' + n.innerHTML + '</p>';
		});
		return html;
	}

	// a term as the posts write it and as their text has it, quotes curled
	function key(s) {
		return s.toLowerCase().replace(/’/g, "'");
	}

	// a term's card: the post that defines it, and the statement there,
	// its mark picked out and its links dead, as a § card's are
	function definition(part, fill) {
		var term = terms[part.dataset.wt], url = term[1];
		var post = window.searchIndex.filter(function (p) { return p.url === url; })[0];
		var from = '<div class="wt-from">' + desktop.escapeHtml(post ? post.title : url) + '</div>';
		fill(from + 'Loading...');
		fetchPostContent(url, function (html) {
			var box = document.createElement('div');
			box.innerHTML = html;
			groupStatements(box);
			var mark = [].filter.call(box.querySelectorAll('a[href=""]'), function (a) {
				return key(a.textContent) === key(term[0]);
			})[0];
			var block = mark && (mark.closest('.st') || mark.closest('p'));
			if (!block) return fill(from);
			mark.className = 'wt-mark';
			block.querySelectorAll('a').forEach(function (a) { a.removeAttribute('href'); });
			fill(from + block.outerHTML, true);
		});
	}

	// Each use of a term in a post's text becomes a part: every form of a
	// term, singular and plural, longest first so that a longer name wins
	// over a shorter one inside it, outside links, headings, code, maths and
	// the Lean folds (lean.js)
	function markTerms(body) {
		var forms = {};
		terms.forEach(function (t, i) {
			var k = key(t[0]);
			[k, k + 's', k + 'es', k.replace(/s$/, '')].forEach(function (f) {
				if (!(f in forms)) forms[f] = i;
			});
		});
		var re = new RegExp('\\b(' + Object.keys(forms).sort(function (a, b) { return b.length - a.length; }).map(function (f) {
			return f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]");
		}).join('|') + ')\\b', 'gi');
		var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT), nodes = [];
		while (walker.nextNode()) {
			if (!walker.currentNode.parentElement.closest('a, h1, h2, h3, h4, summary, code, pre, button, .katex, .xref, .comment, .lean')) nodes.push(walker.currentNode);
		}
		nodes.forEach(function (node) {
			var text = node.textContent, last = 0, frag = null, m;
			re.lastIndex = 0;
			while ((m = re.exec(text))) {
				frag = frag || document.createDocumentFragment();
				frag.append(text.slice(last, m.index));
				var span = document.createElement('span');
				span.className = 'wt-term';
				span.dataset.wt = forms[key(m[0])];
				span.textContent = m[0];
				frag.append(span);
				last = re.lastIndex;
			}
			if (!frag) return;
			frag.append(text.slice(last));
			node.replaceWith(frag);
		});
	}

	function open(win, part, x, y) {
		clearTimeout(shutT);
		if (at === part) return;
		shut();
		at = part;
		part.classList.add('wt-at');
		card = document.createElement('div');
		card.addEventListener('mouseenter', function () { clearTimeout(shutT); });
		card.addEventListener('mouseleave', function () { if (!kept) shutT = setTimeout(shut, 250); });
		document.body.appendChild(card);
		var r = part.getBoundingClientRect(), mine = card;
		if (x === undefined) { x = r.left + r.width / 2; y = r.top + Math.min(r.height / 2, 30); }
		function put() {
			var p = place(part.getBoundingClientRect(), mine.offsetWidth, mine.offsetHeight, x, y);
			mine.style.left = p[0] + 'px';
			mine.style.top = p[1] + 'px';
		}
		// a card filled later is placed again, once its maths is set
		function fill(html, maths) {
			if (card !== mine) return;
			mine.innerHTML = html;
			if (maths) typesetMath(mine, put);
			else put();
		}
		if (part.classList.contains('wt-term')) {
			card.className = 'wt-card wt-def';
			definition(part, fill);
		} else {
			card.className = 'wt-card';
			fill(notes(win, part));
		}
	}

	function setup(win, q) {
		var body = win.querySelector('.post_content');
		function light(on) {
			clearTimeout(openT);
			body.classList.toggle('wt-on', on);
			q.setAttribute('aria-pressed', on);
			if (!on && at && body.contains(at)) shut();
		}
		q.addEventListener('click', function () {
			var on = !body.classList.contains('wt-on');
			// a post's terms are marked once, its maths set first so that no
			// TeX is split
			if (on && !body.dataset.terms && !body.querySelector('.exe-notes')) {
				body.dataset.terms = '1';
				fetch('/assets/terms.json').then(function (r) { return r.json(); }).then(function (list) {
					terms = list;
					typesetMath(body, function () {
						markTerms(body);
						light(true);
					});
				});
				return;
			}
			light(on);
		});
		body.addEventListener('mouseover', function (e) {
			var part = body.classList.contains('wt-on') && !kept && e.target.closest('[data-wt]');
			if (!part) return;
			clearTimeout(shutT);
			clearTimeout(openT);
			openT = setTimeout(function () { open(win, part, e.clientX, e.clientY); }, 120);
		});
		body.addEventListener('mouseout', function (e) {
			clearTimeout(openT);
			var to = e.relatedTarget;
			if (kept || !at || (to && to.closest && to.closest('[data-wt]'))) return;
			shutT = setTimeout(shut, 250);
		});
		// on, a click on a part keeps its card instead of doing what the part does
		body.addEventListener('click', function (e) {
			var part = body.classList.contains('wt-on') && e.target.closest('[data-wt]');
			if (!part) return;
			e.preventDefault();
			e.stopPropagation();
			clearTimeout(openT);
			open(win, part, e.clientX, e.clientY);
			kept = true;
		}, true);
	}

	// Re-runnable, like initXrefs: each window with a ? is set up once
	function init() {
		document.querySelectorAll('.content').forEach(function (win) {
			var q = win.querySelector('.btn_help');
			if (!q || win.dataset.whats) return;
			win.dataset.whats = '1';
			setup(win, q);
		});
	}

	document.addEventListener('click', function (e) {
		if (card && !card.contains(e.target)) shut();
	});
	// a card stays with its part, so a scroll under it shuts it
	document.addEventListener('scroll', function (e) {
		if (card && !card.contains(e.target)) shut();
	}, true);
	// the ? key works the ? of the window in front, but in a field
	document.addEventListener('keydown', function (e) {
		if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
		if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
		var q = document.querySelector('.content.active-win .btn_help');
		if (!q) return;
		e.preventDefault();
		q.click();
	});

	init();
	document.addEventListener('content:swapped', init);
})();
