// What's This?, as Windows 98 had it, but held down: the ? on a window's
// title bar, or the ? key for the window in front, lights the parts that
// have a card until it is pressed again. Pointing at a lit part opens its
// card, a click keeps the card, and a click anywhere else shuts it. A
// program names its parts with data-wt and keeps their notes, under the same
// names, in its .exe-notes; a note hidden there is left out, as
// optimiser.exe hides the surfaces not on its map.
(function () {
	// one card at a time, the part it is for, and whether a click kept it
	var card = null, at = null, kept = false, openT = 0, shutT = 0;

	// Where a card goes: inside its part by the pointer when it fits there,
	// else off the part, beside a pane or under (or over) a row of buttons,
	// so that it covers the part's neighbours rather than the part
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

	function open(win, part, x, y) {
		clearTimeout(shutT);
		if (at === part) return;
		shut();
		at = part;
		part.classList.add('wt-at');
		card = document.createElement('div');
		card.className = 'wt-card';
		card.innerHTML = notes(win, part);
		card.addEventListener('mouseenter', function () { clearTimeout(shutT); });
		card.addEventListener('mouseleave', function () { if (!kept) shutT = setTimeout(shut, 250); });
		document.body.appendChild(card);
		var r = part.getBoundingClientRect();
		if (x === undefined) { x = r.left + r.width / 2; y = r.top + Math.min(r.height / 2, 30); }
		var p = place(r, card.offsetWidth, card.offsetHeight, x, y);
		card.style.left = p[0] + 'px';
		card.style.top = p[1] + 'px';
	}

	function setup(win, q) {
		var body = win.querySelector('.post_content');
		q.addEventListener('click', function () {
			clearTimeout(openT);
			var on = body.classList.toggle('wt-on');
			q.setAttribute('aria-pressed', on);
			if (!on && at && body.contains(at)) shut();
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
