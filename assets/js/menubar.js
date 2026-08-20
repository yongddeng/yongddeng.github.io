// Win9x menu bar on post windows: File (date, close), Edit (find, select
// all), View (heading outline). Delegated at document level so windows
// restored by session.js get working menus without rebinding.
(function () {

	function closeAll() {
		hideFly();
		document.querySelectorAll('.tb-menu.open').forEach(function (m) {
			m.classList.remove('open');
		});
	}

	// Keyword flyouts are position:fixed so they escape the outline's own
	// scroll and the window's overflow:hidden (windows move via left/top,
	// never transform, so fixed stays viewport-relative).
	var openFly = null, openFlyItem = null;

	function hideFly() {
		if (!openFly) return;
		openFly.style.display = 'none';
		openFlyItem.classList.remove('fly-open');
		openFly = null;
		openFlyItem = null;
	}

	function showFly(item) {
		if (openFly === item._fly) return;
		hideFly();
		var fly = item._fly;
		var drop = item.parentElement;
		fly.style.display = 'block';
		var top = item.getBoundingClientRect().top - 4;
		top = Math.min(top, window.innerHeight - 4 - fly.offsetHeight);
		fly.style.top = Math.max(4, top) + 'px';
		fly.style.left = (drop.getBoundingClientRect().right - 2) + 'px';
		item.classList.add('fly-open');
		openFly = fly;
		openFlyItem = item;
	}

	// The outline is built lazily on first open, one entry per h2/h3
	function buildOutline(win) {
		var drop = win.querySelector('.tb-outline');
		if (!drop || drop.childNodes.length) return;
		var cont = win.querySelector('.post_content');
		var heads = cont ? cont.querySelectorAll('h2, h3') : [];
		if (!heads.length) {
			drop.innerHTML = '<span class="tb-item tb-static">(no headings)</span>';
			return;
		}
		// Bucket each keyword (rendered from [term]() as an empty-href
		// anchor) under its preceding heading, deduped per section
		var buckets = [], cur = -1;
		cont.querySelectorAll('h2, h3, a[href=""]').forEach(function (n) {
			if (n.tagName === 'A') {
				if (cur >= 0) buckets[cur].push(n);
			} else {
				buckets[++cur] = [];
			}
		});
		heads.forEach(function (h, i) {
			var item = document.createElement('button');
			item.type = 'button';
			item.className = 'tb-item' + (h.tagName === 'H3' ? ' tb-sub' : '');
			item.textContent = h.textContent;
			item.addEventListener('click', function () {
				closeAll();
				cont.scrollTop += h.getBoundingClientRect().top - cont.getBoundingClientRect().top - 6;
			});
			drop.appendChild(item);
			var seen = {};
			var terms = (buckets[i] || []).filter(function (a) {
				var t = a.textContent.trim().toLowerCase();
				if (!t || seen[t]) return false;
				seen[t] = true;
				return true;
			});
			if (!terms.length) return;
			var arr = document.createElement('span');
			arr.className = 'tb-arr';
			arr.textContent = '▸';
			item.appendChild(arr);
			var fly = document.createElement('div');
			fly.className = 'tb-fly';
			terms.forEach(function (a) {
				var k = document.createElement('button');
				k.type = 'button';
				k.className = 'tb-item';
				k.textContent = a.textContent;
				k.addEventListener('click', function () {
					closeAll();
					cont.scrollTop += a.getBoundingClientRect().top - cont.getBoundingClientRect().top - 60;
					a.classList.add('kw-flash');
					setTimeout(function () { a.classList.remove('kw-flash'); }, 1600);
				});
				fly.appendChild(k);
			});
			drop.appendChild(fly);
			item._fly = fly;
		});
		drop.addEventListener('scroll', hideFly);
	}

	function openMenu(li) {
		closeAll();
		if (li.querySelector('.tb-outline')) buildOutline(li.closest('.content'));
		li.classList.add('open');
	}

	document.addEventListener('click', function (e) {
		var label = e.target.closest('.tb-label');
		if (label) {
			var li = label.parentElement;
			var wasOpen = li.classList.contains('open');
			closeAll();
			if (!wasOpen) openMenu(li);
			return;
		}
		var act = e.target.closest('.tb-item[data-act]');
		if (act) {
			var win = act.closest('.content');
			closeAll();
			if (act.dataset.act === 'find' && window.openFind) {
				window.openFind(win);
			} else if (act.dataset.act === 'selectall') {
				var range = document.createRange();
				range.selectNodeContents(win.querySelector('.post_content'));
				var sel = window.getSelection();
				sel.removeAllRanges();
				sel.addRange(range);
			}
			return;
		}
		if (!e.target.closest('.tb-drop')) closeAll();
	});

	// Classic behaviour: once a menu is open, hovering a sibling switches to it
	document.addEventListener('mouseover', function (e) {
		var label = e.target.closest('.tb-label');
		if (!label) return;
		var li = label.parentElement;
		if (li.classList.contains('open')) return;
		if (li.parentElement.querySelector('.tb-menu.open')) openMenu(li);
	});

	// Keyword flyout follows the hovered outline row, Start-menu style
	document.addEventListener('mouseover', function (e) {
		if (e.target.closest('.tb-fly')) return;
		var item = e.target.closest('.tb-item');
		if (item && item._fly) {
			showFly(item);
		} else if (item || !e.target.closest('.tb-menu')) {
			hideFly();
		}
	});

	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') closeAll();
	});
})();
