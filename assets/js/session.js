// Carries the open desktop across a page refresh, so F5 reloads the page
// rather than closing everything. Start > Shut Down is the deliberate way
// to clear it. sessionStorage, not localStorage: a new tab opens clean.
(function () {
	var KEY = 'desk-session';
	var desktop = window.desktop;

	var wrapper = document.querySelector('.wrapper');
	// The post the layout drew is the one the address bar asked for
	var asked = document.querySelector('.content[data-url]');
	var restoring = false;

	function write(state) {
		try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
	}

	function clear() {
		try { sessionStorage.removeItem(KEY); } catch (e) {}
	}

	// Inline styles only: an untouched window has none and should be
	// placed by the usual rules rather than pinned to a stale guess; a
	// maximized one is saved as the spot 001.js keeps in data-premax
	function geomOf(el) {
		var s = el.dataset.premax ? JSON.parse(el.dataset.premax) : el.style;
		if (!s.left && !s.top && !s.width && !s.height) return null;
		return {
			left: parseInt(s.left, 10) || 0,
			top: parseInt(s.top, 10) || 0,
			width: parseInt(s.width, 10) || 0,
			height: parseInt(s.height, 10) || 0
		};
	}

	// Post, folder and System Properties windows are restorable; the error
	// box is transient chrome and deliberately is not
	function kindOf(win) {
		if (win.dataset.tag) return 'folder';
		if (win.dataset.url) return 'post';
		if (win.classList.contains('settings-win')) return 'settings';
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
					// System Properties by the tab it is on
					id: kind === 'folder' ? win.dataset.tag
						: kind === 'post' ? win.dataset.url
						: [].indexOf.call(win.querySelectorAll('.set-tab'), win.querySelector('.set-tab.on')),
					geom: geomOf(win),
					maxed: !!win.dataset.premax,
					front: win.classList.contains('active-win')
				});
			});
		return {
			explorer: {
				hidden: wrapper.style.display === 'none',
				geom: geomOf(wrapper),
				at: window.explorer.at(),
				folders: window.explorer.folders(),
				front: wrapper.classList.contains('active-win')
			},
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
		wrapper.style.display = state.explorer.hidden ? 'none' : '';
		window.explorer.go(state.explorer.at, state.explorer.folders);
		var g = state.explorer.geom;
		if (g && !state.explorer.hidden) desktop.applyGeom(wrapper, g);

		var winOf = function (w) {
			return document.querySelector(w.kind === 'folder' ? '.folder-win[data-tag="' + w.id + '"]'
				: w.kind === 'post' ? '.content[data-url="' + w.id + '"]'
				: '.settings-win');
		};
		// a post saved maximized is maximized again, by its own button
		var remax = function (w) {
			var win = w.maxed && winOf(w);
			if (win) win.querySelector('.btn_max').click();
		};
		var chain = Promise.resolve();
		state.windows.forEach(function (w) {
			chain = chain.then(function () {
				if (w.kind === 'folder') {
					desktop.openFolderWindow(w.id, w.geom);
					return;
				}
				// System Properties by its Start menu item, then moved and
				// turned to its tab
				if (w.kind === 'settings') {
					document.getElementById('menu-settings').click();
					desktop.applyGeom(winOf(w), w.geom);
					winOf(w).querySelectorAll('.set-tab')[w.id].click();
					return;
				}
				// force: the cap counts a session as already-open windows
				return desktop.loadPost(w.id, { geom: w.geom, force: true }).then(function () { remax(w); });
			});
		});

		return chain.then(function () {
			// Raising the saved front window settles the z-order last
			var front = null;
			state.windows.forEach(function (w) {
				if (w.front) front = winOf(w) || front;
			});
			if (!front && state.explorer.front && !state.explorer.hidden) {
				front = wrapper;
			}
			// A link, bookmark or typed URL lands on top. On F5 it already is
			// the saved front, since 001.js keeps the address on that window.
			if (asked) front = asked;
			// raising it titles the tab after it, not after the last post reopened
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
		wrapper.style.display = 'none';
		// drop any dragged position so the next open starts fresh
		wrapper.style.position = '';
		wrapper.style.margin = '';
		wrapper.style.left = '';
		wrapper.style.top = '';
		wrapper.style.width = '';
		wrapper.style.height = '';
		window.explorer.home();
		document.title = document.body.dataset.site || '';
		if (location.pathname !== '/') history.pushState(null, '', '/');
		clear();
		document.dispatchEvent(new CustomEvent('content:swapped'));
		restoring = false;
	}

	document.getElementById('menu-shutdown').addEventListener('click', function (e) {
		e.preventDefault();
		confirmShutdown();
	});

	document.addEventListener('content:swapped', save);
	document.addEventListener('window:focused', save);
	// catches drags and resizes, which end in a plain mouseup
	document.addEventListener('mouseup', save);
	window.addEventListener('pagehide', function () {
		if (!restoring) write(snapshot());
	});

	// Restore is desktop furniture: on a phone it would stack absolutely
	// positioned windows over the unwrapped page. Saving still runs, so a
	// return to desktop width picks the session back up.
	var saved = window.deskSess;
	// a post opened from here on is placed afresh, not where this session had it
	window.deskSess = null;
	if (!phone() && saved && (saved.windows.length || !saved.explorer.hidden)) {
		restore(saved);
	}
})();
