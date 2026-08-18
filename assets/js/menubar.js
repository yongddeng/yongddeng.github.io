// Win9x menu bar on post windows: File (date, close), Edit (find, select
// all), View (heading outline). Delegated at document level so windows
// restored by session.js get working menus without rebinding.
(function () {

	function closeAll() {
		document.querySelectorAll('.tb-menu.open').forEach(function (m) {
			m.classList.remove('open');
		});
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
		heads.forEach(function (h) {
			var item = document.createElement('button');
			item.type = 'button';
			item.className = 'tb-item' + (h.tagName === 'H3' ? ' tb-sub' : '');
			item.textContent = h.textContent;
			item.addEventListener('click', function () {
				closeAll();
				cont.scrollTop += h.getBoundingClientRect().top - cont.getBoundingClientRect().top - 6;
			});
			drop.appendChild(item);
		});
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

	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') closeAll();
	});
})();
