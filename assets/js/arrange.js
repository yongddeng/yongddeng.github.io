// Win95's taskbar verbs, Cascade and Tile, as two glyph buttons by the
// clock. Desktop only — the phone hides the taskbar and its windows
// have no geometry.
(function () {
	var bar = document.querySelector('.taskbar');
	var desktop = window.desktop;
	var btns = {
		cascade: document.getElementById('task-cascade'),
		tile: document.getElementById('task-tile')
	};
	if (!bar || !desktop || !btns.cascade) return;

	// The arrangeable set: the explorer plus post and folder windows.
	// Settings stays put — property sheets are dialogs, not windows.
	function windows() {
		var wins = Array.prototype.slice.call(document.querySelectorAll('.content'))
			.filter(function (w) { return !w.classList.contains('settings-win'); });
		var wrapper = document.querySelector('.wrapper');
		if (wrapper && wrapper.style.display !== 'none') wins.unshift(wrapper);
		return wins;
	}

	// Pressing the same verb twice undoes it: the first arrange keeps
	// each window's inline style, the second puts it back
	var undo = null;

	function restore() {
		undo.saved.forEach(function (s) {
			// gone, or deliberately closed since (the explorer hides
			// rather than leaving the DOM) — an undo must not reopen it
			if (!s.win.isConnected || s.win.style.display === 'none') return;
			s.win.style.cssText = s.css;
			s.win.dispatchEvent(new CustomEvent('win:relayout'));
		});
		undo = null;
	}

	function apply(mode) {
		var wins = windows();
		if (!wins.length) return;
		if (!undo) {
			undo = {
				saved: wins.map(function (win) {
					return { win: win, css: win.style.cssText };
				})
			};
		}
		undo.mode = mode;
		var W = document.documentElement.clientWidth;
		var H = window.innerHeight - bar.offsetHeight;
		var cols = Math.ceil(Math.sqrt(wins.length));
		var rows = Math.ceil(wins.length / cols);
		wins.forEach(function (win, i) {
			// applyGeom sets the content-box; each window's bevel and
			// padding sit outside it (the explorer's frame is wider
			// than a post's), so subtract its own frame from the cell
			var cs = getComputedStyle(win);
			var frameW = win.offsetWidth - parseFloat(cs.width);
			var frameH = win.offsetHeight - parseFloat(cs.height);
			desktop.applyGeom(win, mode === 'cascade' ? {
				left: 24 + i * 28,
				top: 18 + i * 28,
				width: Math.round(W * 0.6),
				height: Math.round(H * 0.7)
			} : {
				left: (i % cols) * Math.floor(W / cols),
				top: Math.floor(i / cols) * Math.floor(H / rows),
				width: Math.floor(W / cols) - frameW,
				height: Math.floor(H / rows) - frameH
			});
		});
	}

	function arrange(mode) {
		if (undo && undo.mode === mode) {
			restore();
		} else {
			apply(mode);
		}
		Object.keys(btns).forEach(function (m) {
			btns[m].classList.toggle('active', !!undo && undo.mode === m);
		});
		// Raising the front window settles z-order and lets session.js
		// snapshot the new geometry, same as a session restore does
		var wins = windows();
		if (wins.length) wins[wins.length - 1].dispatchEvent(new MouseEvent('mousedown'));
	}

	btns.cascade.addEventListener('click', function () { arrange('cascade'); });
	btns.tile.addEventListener('click', function () { arrange('tile'); });
})();
