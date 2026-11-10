// Start → System Properties: General is the About sheet, Settings holds
// the controls, and Screen Saver the saver and its wait (saver.js).
// Persisted in localStorage, applied pre-paint from <head>.
(function () {
	var DEFAULTS = deskSettings.DEFAULTS, get = deskSettings.get;

	function set(key, value) {
		try {
			if (value === DEFAULTS[key]) localStorage.removeItem('set-' + key);
			else localStorage.setItem('set-' + key, value);
		} catch (e) {}
		deskSettings.apply();
		document.dispatchEvent(new CustomEvent('settings:changed'));
	}

	var SWATCHES = ['#008082', '#3a6ea5', '#5f9e6e', '#7d5b8e', '#87765c', '#000000'];

	function radio(name, value, label, current) {
		return '<label><input type="radio" name="' + name + '" value="' + value + '"'
			+ (value === current ? ' checked' : '') + '> ' + label + '</label>';
	}

	// The reading controls, in the Settings pane and the phone's sheet
	function readingFields(prefix) {
		return '<fieldset><legend>Paper</legend><div data-key="paper">'
			+ radio(prefix + '-paper', '#fbfafb', 'White', get('paper'))
			+ radio(prefix + '-paper', '#fff8ff', 'Pink (classic)', get('paper'))
			+ '</div></fieldset>'
			+ '<fieldset><legend>Text size</legend><div data-key="text">'
			+ radio(prefix + '-text', '12px', 'Small', get('text'))
			+ radio(prefix + '-text', '13px', 'Medium', get('text'))
			+ radio(prefix + '-text', '15px', 'Large', get('text'))
			+ '</div></fieldset>'
			+ '<fieldset><legend>Font</legend><div data-key="font">'
			+ radio(prefix + '-font', 'arial', 'Arial', get('font'))
			+ radio(prefix + '-font', 'georgia', 'Georgia', get('font'))
			+ radio(prefix + '-font', 'courier', 'Courier', get('font'))
			+ '</div></fieldset>';
	}

	// saver.js, fetched the first time it is wanted: by the Screen Saver tab,
	// or by the wait running out
	var saverJs = null;
	function withSaver(then) {
		saverJs = saverJs || new Promise(function (ok) {
			var s = document.createElement('script');
			s.src = '/assets/js/saver.js';
			s.onload = ok;
			document.head.appendChild(s);
		});
		saverJs.then(then);
	}

	// The Screen Saver tab: the saver chosen running in the monitor while the
	// tab is on show, what it draws, a preview and the wait
	function saverPane(pane) {
		withSaver(function () {
			var S = saver.SAVERS;
			pane.innerHTML = '<div class="set-monitor"><canvas></canvas></div>'
				+ '<fieldset><legend>Screen Saver</legend>'
				+ '<div class="set-ssrow"><select><option value="none">(None)</option><option value="random">Random</option>'
				+ Object.keys(S).map(function (k) { return '<option value="' + k + '">' + S[k].name + '</option>'; }).join('')
				+ '</select><button type="button" class="set-preview">Preview</button></div>'
				+ '<p class="set-about"></p>'
				+ '<label>Wait <input type="number" min="1" max="60"> minutes</label>'
				+ '</fieldset>';
			var canvas = pane.querySelector('canvas'), pick = pane.querySelector('select'), wait = pane.querySelector('input');
			var stop = null, seen = false;
			function monitor() {
				if (stop) stop();
				stop = null;
				canvas.width = canvas.width;
				if (seen && pick.value !== 'none') stop = saver.run(canvas, pick.value, false);
			}
			function about() {
				var k = pick.value;
				pane.querySelector('.set-about').textContent = S[k] ? S[k].about : k === 'random' ? 'One of the four, picked each time the saver comes on.' : 'No screen saver.';
				pane.querySelector('.set-preview').disabled = k === 'none';
				monitor();
			}
			pick.value = get('saver');
			wait.value = get('wait');
			pick.addEventListener('change', function () {
				set('saver', pick.value);
				about();
			});
			wait.addEventListener('change', function () {
				var v = parseInt(wait.value, 10);
				wait.value = isNaN(v) ? DEFAULTS.wait : Math.max(1, Math.min(60, v));
				set('wait', wait.value);
			});
			pane.querySelector('.set-preview').addEventListener('click', function () {
				saver.show(pick.value);
			});
			new IntersectionObserver(function (es) {
				seen = es[0].isIntersecting;
				monitor();
			}).observe(canvas);
			about();
		});
	}

	function generalPane() {
		var postCount = window.searchIndex.length;
		return '<div class="set-sysrow">'
			+ '<img src="/assets/img/mycomputer-32.png" alt="" />'
			+ '<div class="set-kv">'
			+ '<b>System:</b> Hikikomori<br>'
			+ '<b>Registered to:</b> Sung Kim<br>'
			+ '<b>Disk:</b> ' + postCount + ' posts installed'
			+ '</div></div>';
	}

	function openSettings() {
		var existing = document.querySelector('.settings-win');
		if (existing) {
			existing.dispatchEvent(new MouseEvent('mousedown'));
			return;
		}
		var win = document.createElement('div');
		win.className = 'content settings-win';
		win.innerHTML =
			'<div class="post_title"><span class="t-emoji">&#9881;&#65039;</span><h1>System Properties</h1>'
			+ '<a href="/"><div class="btn"><span class="cap-x"></span></div></a></div>'
			+ '<div class="post_content">'
			+ '<div class="set-tabs">'
			+ '<span class="set-tab on">General</span>'
			+ '<span class="set-tab">Settings</span>'
			+ '<span class="set-tab">Screen Saver</span>'
			+ '</div>'
			+ '<div class="set-body">'

			+ '<div class="set-pane on">' + generalPane() + '</div>'

			+ '<div class="set-pane">'
			+ '<fieldset><legend>Desktop colour</legend><div class="set-swatches">'
			+ SWATCHES.map(function (c) {
				return '<span class="set-sw' + (c === get('desk') ? ' on' : '') + '" data-c="' + c
					+ '" style="background:' + c + '"></span>';
			}).join('') + '</div></fieldset>'
			+ readingFields('set')
			+ '<fieldset><legend>Clock</legend><div data-key="clock">'
			+ radio('set-clock', '12', '12-hour', get('clock'))
			+ radio('set-clock', '24', '24-hour', get('clock'))
			+ '</div></fieldset>'
			+ '</div>'

			+ '<div class="set-pane"></div>'

			+ '</div>'
			+ '<div class="set-btnrow"><button class="set-reset">Restore defaults</button>'
			+ '<button class="set-ok">OK</button></div>'
			+ '</div>';

		document.body.insertBefore(win, document.querySelector('.taskbar'));

		var tabs = win.querySelectorAll('.set-tab');
		var panes = win.querySelectorAll('.set-pane');
		tabs.forEach(function (tab, i) {
			tab.addEventListener('click', function () {
				tabs.forEach(function (t) { t.classList.remove('on'); });
				panes.forEach(function (p) { p.classList.remove('on'); });
				tab.classList.add('on');
				panes[i].classList.add('on');
			});
		});
		tabs[2].addEventListener('click', function () { saverPane(panes[2]); }, { once: true });

		win.querySelector('.set-swatches').addEventListener('click', function (e) {
			var sw = e.target.closest('.set-sw');
			if (!sw) return;
			this.querySelectorAll('.set-sw').forEach(function (x) { x.classList.remove('on'); });
			sw.classList.add('on');
			set('desk', sw.dataset.c);
		});
		win.querySelectorAll('[data-key]').forEach(function (group) {
			group.addEventListener('change', function (e) {
				set(group.dataset.key, e.target.value);
			});
		});
		win.querySelector('.set-reset').addEventListener('click', function () {
			Object.keys(DEFAULTS).forEach(function (k) { set(k, DEFAULTS[k]); });
			win.remove();
			document.dispatchEvent(new CustomEvent('content:swapped'));
			openSettings();
		});
		win.querySelector('.set-ok').addEventListener('click', function () {
			win.remove();
			document.dispatchEvent(new CustomEvent('content:swapped'));
		});

		win.style.position = 'absolute';
		win.style.margin = '0';
		win.style.left = Math.max(10, window.scrollX + (window.innerWidth - 400) / 2) + 'px';
		win.style.top = (window.scrollY + 110) + 'px';

		document.dispatchEvent(new CustomEvent('content:swapped'));
		win.dispatchEvent(new MouseEvent('mousedown'));
	}

	// The Settings pane recut as a bottom sheet: the taskbar that reaches
	// System Properties is hidden on phones, so the app bar's Aa opens the
	// same three reading controls over the same storage
	function openViewSheet() {
		if (document.querySelector('.view-sheet')) return;
		var wrap = document.createElement('div');
		wrap.className = 'view-sheet';
		wrap.innerHTML =
			'<div class="vs-dim"></div>'
			+ '<div class="vs-box">'
			+ '<div class="vs-title"><span>Display Properties</span>'
			+ '<span class="vs-x">&#10005;</span></div>'
			+ readingFields('vs')
			+ '<div class="vs-ok"><button>OK</button></div>'
			+ '</div>';
		document.body.appendChild(wrap);

		wrap.querySelectorAll('[data-key]').forEach(function (group) {
			group.addEventListener('change', function (e) {
				set(group.dataset.key, e.target.value);
			});
		});
		// The sheet's chrome lives inside the phone media query, so a
		// rotate past the breakpoint closes it rather than leaving bare divs
		function close() {
			wrap.remove();
			phoneQuery.removeEventListener('change', onFlip);
		}
		function onFlip() { if (!phone()) close(); }
		phoneQuery.addEventListener('change', onFlip);
		wrap.querySelector('.vs-dim').addEventListener('click', close);
		wrap.querySelector('.vs-x').addEventListener('click', close);
		wrap.querySelector('.vs-ok button').addEventListener('click', close);
	}

	// Delegated: an SPA-loaded post carries a fresh .btn_view this ran before
	document.addEventListener('click', function (e) {
		if (e.target.closest('.btn_view') && phone()) openViewSheet();
	});

	document.getElementById('menu-settings').addEventListener('click', function (e) {
		e.preventDefault();
		openSettings();
	});

	// The saver chosen comes on after the wait with no key, pointer or wheel,
	// as Windows' did, and only in a tab on show: hiding it stops the wait and
	// showing it starts the wait over. Read once and again on a change, not on
	// every move
	var idleT = 0, chosen = get('saver'), minutes = +get('wait');
	function idle() {
		clearTimeout(idleT);
		if (chosen === 'none' || document.hidden) return;
		idleT = setTimeout(function () {
			withSaver(function () { saver.show(chosen, idle); });
		}, minutes * 60000);
	}
	['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(function (t) {
		document.addEventListener(t, idle, { capture: true, passive: true });
	});
	document.addEventListener('visibilitychange', idle);
	document.addEventListener('settings:changed', function () {
		chosen = get('saver');
		minutes = +get('wait');
		idle();
	});
	idle();
})();
