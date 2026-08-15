// Start → System Properties: General is the About sheet, Settings holds
// the controls. Persisted in localStorage, applied pre-paint from <head>.
(function () {
	var DEFAULTS = { desk: '#008082', paper: '#fbfafb', text: '13px', clock: '12', font: 'arial' };
	var FONTS = {
		arial: '"Helvetica Neue", Arial, sans-serif',
		georgia: 'Georgia, "Times New Roman", serif',
		courier: '"Courier New", monospace'
	};

	function get(key) {
		try { return localStorage.getItem('set-' + key) || DEFAULTS[key]; }
		catch (e) { return DEFAULTS[key]; }
	}

	function set(key, value) {
		try {
			if (value === DEFAULTS[key]) localStorage.removeItem('set-' + key);
			else localStorage.setItem('set-' + key, value);
		} catch (e) {}
		apply();
	}

	function apply() {
		var root = document.documentElement;
		root.style.setProperty('--desk', get('desk'));
		root.style.setProperty('--paper', get('paper'));
		root.style.setProperty('--text', get('text'));
		root.style.setProperty('--font', FONTS[get('font')] || FONTS.arial);
		document.dispatchEvent(new CustomEvent('settings:changed'));
	}

	var SWATCHES = ['#008082', '#3a6ea5', '#5f9e6e', '#7d5b8e', '#87765c', '#000000'];

	function radio(name, value, label, current) {
		return '<label><input type="radio" name="' + name + '" value="' + value + '"'
			+ (value === current ? ' checked' : '') + '> ' + label + '</label>';
	}

	function generalPane() {
		var postCount = (window.searchIndex || []).length;
		return '<div class="set-sysrow">'
			+ '<img src="/assets/img/mycomputerv2.png" alt="" />'
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
			+ '<a href="/"><div class="btn"><span class="fa fa-times"></span></div></a></div>'
			+ '<div class="post_content">'
			+ '<div class="set-tabs">'
			+ '<span class="set-tab on">General</span>'
			+ '<span class="set-tab">Settings</span>'
			+ '</div>'
			+ '<div class="set-body">'

			+ '<div class="set-pane on">' + generalPane() + '</div>'

			+ '<div class="set-pane">'
			+ '<fieldset><legend>Desktop colour</legend><div class="set-swatches">'
			+ SWATCHES.map(function (c) {
				return '<span class="set-sw' + (c === get('desk') ? ' on' : '') + '" data-c="' + c
					+ '" style="background:' + c + '"></span>';
			}).join('') + '</div></fieldset>'
			+ '<fieldset><legend>Paper</legend><div data-key="paper">'
			+ radio('set-paper', '#fbfafb', 'White', get('paper'))
			+ radio('set-paper', '#fff8ff', 'Pink (classic)', get('paper'))
			+ '</div></fieldset>'
			+ '<fieldset><legend>Text size</legend><div data-key="text">'
			+ radio('set-text', '12px', 'Small', get('text'))
			+ radio('set-text', '13px', 'Medium', get('text'))
			+ radio('set-text', '15px', 'Large', get('text'))
			+ '</div></fieldset>'
			+ '<fieldset><legend>Font</legend><div data-key="font">'
			+ radio('set-font', 'arial', 'Arial', get('font'))
			+ radio('set-font', 'georgia', 'Georgia', get('font'))
			+ radio('set-font', 'courier', 'Courier', get('font'))
			+ '</div></fieldset>'
			+ '<fieldset><legend>Clock</legend><div data-key="clock">'
			+ radio('set-clock', '12', '12-hour', get('clock'))
			+ radio('set-clock', '24', '24-hour', get('clock'))
			+ '</div></fieldset>'
			+ '</div>'

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
			document.dispatchEvent(new CustomEvent('content:swapped', { detail: {} }));
			openSettings();
		});
		win.querySelector('.set-ok').addEventListener('click', function () {
			win.remove();
			document.dispatchEvent(new CustomEvent('content:swapped', { detail: {} }));
		});

		win.style.position = 'absolute';
		win.style.margin = '0';
		win.style.left = Math.max(10, window.scrollX + (window.innerWidth - 400) / 2) + 'px';
		win.style.top = (window.scrollY + 110) + 'px';

		document.dispatchEvent(new CustomEvent('content:swapped', { detail: {} }));
		win.dispatchEvent(new MouseEvent('mousedown'));
	}

	var menuItem = document.getElementById('menu-settings');
	if (menuItem) {
		menuItem.addEventListener('click', function (e) {
			e.preventDefault();
			openSettings();
		});
	}

	apply();
})();
