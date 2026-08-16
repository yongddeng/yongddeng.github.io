// Carries the open desktop across a page refresh, so F5 reloads the page
// rather than closing everything. Start > Shut Down is the deliberate way
// to clear it. sessionStorage, not localStorage: a new tab opens clean.
(function () {
	var KEY = 'desk-session';
	var desktop = window.desktop;
	if (!desktop) return;

	var wrapper = document.querySelector('.wrapper');
	var restoring = false;

	function read() {
		try {
			var raw = sessionStorage.getItem(KEY);
			return raw ? JSON.parse(raw) : null;
		} catch (e) { return null; }
	}

	function write(state) {
		try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
	}

	function clear() {
		try { sessionStorage.removeItem(KEY); } catch (e) {}
	}

	// Inline styles only: an untouched window has none and should be
	// placed by the usual rules rather than pinned to a stale guess
	function geomOf(el) {
		var s = el.style;
		if (!s.left && !s.top && !s.width && !s.height) return null;
		return {
			left: parseInt(s.left, 10) || 0,
			top: parseInt(s.top, 10) || 0,
			width: parseInt(s.width, 10) || 0,
			height: parseInt(s.height, 10) || 0
		};
	}

	// Post and folder windows are restorable; Settings and the error box
	// are transient chrome and deliberately are not
	function kindOf(win) {
		if (win.classList.contains('settings-win')) return null;
		if (win.dataset.tag) return 'folder';
		if (win.dataset.url) return 'post';
		return null;
	}

	function snapshot() {
		var wins = [];
		Array.prototype.slice.call(document.querySelectorAll('.content'))
			.sort(function (a, b) { return (a.dataset.seq || 0) - (b.dataset.seq || 0); })
			.forEach(function (win) {
				var kind = kindOf(win);
				if (!kind) return;
				wins.push({
					kind: kind,
					id: kind === 'folder' ? win.dataset.tag : win.dataset.url,
					geom: geomOf(win),
					front: win.classList.contains('active-win')
				});
			});
		return {
			explorer: wrapper ? {
				hidden: wrapper.style.display === 'none',
				geom: geomOf(wrapper),
				tag: desktop.explorerTag(),
				front: wrapper.classList.contains('active-win')
			} : null,
			windows: wins
		};
	}

	var pending = null;
	function save() {
		if (restoring) return;
		clearTimeout(pending);
		// coalesce the burst a drag or a window open produces
		pending = setTimeout(function () { write(snapshot()); }, 150);
	}

	// Reopen in saved order so the taskbar buttons come back in that order
	function restore(state) {
		restoring = true;
		if (wrapper && state.explorer) {
			wrapper.style.display = state.explorer.hidden ? 'none' : '';
			if (state.explorer.tag) desktop.filterByTag(state.explorer.tag);
			var g = state.explorer.geom;
			if (g && !state.explorer.hidden) desktop.applyGeom(wrapper, g);
		}

		var chain = Promise.resolve();
		(state.windows || []).forEach(function (w) {
			chain = chain.then(function () {
				if (w.kind === 'folder') {
					desktop.openFolderWindow(w.id, w.geom);
					return;
				}
				// force: the cap counts a session as already-open windows
				return desktop.loadPost(w.id, { geom: w.geom, force: true });
			});
		});

		return chain.then(function () {
			// Raising the saved front window settles the z-order last
			var front = null;
			(state.windows || []).forEach(function (w) {
				if (!w.front) return;
				var sel = w.kind === 'folder'
					? '.folder-win[data-tag="' + w.id + '"]'
					: '.content[data-url="' + w.id + '"]';
				front = document.querySelector(sel) || front;
			});
			if (!front && state.explorer && state.explorer.front && !state.explorer.hidden) {
				front = wrapper;
			}
			if (front) front.dispatchEvent(new MouseEvent('mousedown'));
			restoring = false;
			save();
		});
	}

	// Win95 shutdown box, same chrome as the out-of-memory error
	function confirmShutdown() {
		var old = document.querySelector('.err-win');
		if (old) old.remove();
		var box = document.createElement('div');
		box.className = 'err-win active-win';
		box.innerHTML = '<div class="post_title"><h1>Shut Down Windows</h1></div>'
			+ '<div class="err-body"><span class="err-ic">&#9211;</span>'
			+ '<p>This closes every open window and forgets the desktop.<br>Are you sure?</p></div>'
			+ '<div class="err-btnrow"><button class="sd-yes">Yes</button>'
			+ '<button class="sd-no">No</button></div>';
		document.body.appendChild(box);
		box.querySelector('.sd-no').addEventListener('click', function () { box.remove(); });
		box.querySelector('.sd-yes').addEventListener('click', function () {
			box.remove();
			shutdown();
		});
	}

	function shutdown() {
		restoring = true;
		document.querySelectorAll('.content').forEach(function (win) { win.remove(); });
		if (wrapper) {
			wrapper.style.display = 'none';
			// drop any dragged position so the next open starts fresh
			wrapper.style.position = '';
			wrapper.style.margin = '';
			wrapper.style.left = '';
			wrapper.style.top = '';
			wrapper.style.width = '';
			wrapper.style.height = '';
			wrapper.dispatchEvent(new CustomEvent('win:reset'));
			desktop.showAllPosts();
		}
		document.title = document.body.dataset.site || '';
		if (location.pathname !== '/') history.pushState(null, '', '/');
		clear();
		document.dispatchEvent(new CustomEvent('content:swapped', { detail: {} }));
		restoring = false;
	}

	var menuItem = document.getElementById('menu-shutdown');
	if (menuItem) {
		menuItem.addEventListener('click', function (e) {
			e.preventDefault();
			confirmShutdown();
		});
	}

	document.addEventListener('content:swapped', save);
	document.addEventListener('window:focused', save);
	// catches drags and resizes, which end in a plain mouseup
	document.addEventListener('mouseup', save);
	window.addEventListener('pagehide', function () {
		if (!restoring) write(snapshot());
	});

	var saved = read();
	if (saved && ((saved.windows && saved.windows.length) || (saved.explorer && !saved.explorer.hidden))) {
		restore(saved);
	}
})();
