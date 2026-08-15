(function () {
	var startBtn = document.getElementById('task-start');
	var startMenu = document.getElementById('task-menu');
	var desktopBtn = document.getElementById('task-desktop');
	var postBtns = document.getElementById('task-posts');
	var clock = document.getElementById('task-clock');
	if (!startBtn) return;

	function tick() {
		var d = new Date();
		var h = d.getHours();
		var mm = ('0' + d.getMinutes()).slice(-2);
		var h24;
		try { h24 = localStorage.getItem('set-clock') === '24'; } catch (e) { h24 = false; }
		clock.textContent = h24
			? ('0' + h).slice(-2) + ':' + mm
			: (h % 12 || 12) + ':' + mm + (h >= 12 ? ' PM' : ' AM');
	}
	tick();
	setInterval(tick, 30000);
	document.addEventListener('settings:changed', tick);

	function closeSubs() {
		startMenu.querySelectorAll('.has-sub.open').forEach(function (s) { s.classList.remove('open'); });
	}
	startBtn.addEventListener('click', function (e) {
		e.stopPropagation();
		startMenu.classList.toggle('open');
		closeSubs();
	});
	// touch fallback: tapping a cascade row toggles its submenu
	startMenu.addEventListener('click', function (e) {
		var sub = e.target.closest('.has-sub');
		if (sub && !e.target.closest('a')) {
			e.stopPropagation();
			var wasOpen = sub.classList.contains('open');
			closeSubs();
			if (!wasOpen) sub.classList.add('open');
		}
	});
	document.addEventListener('click', function () {
		startMenu.classList.remove('open');
		closeSubs();
	});

	// One taskbar button per open window, in opening order
	var wrapper = document.querySelector('.wrapper');
	function syncWindows() {
		var wins = Array.prototype.slice.call(document.querySelectorAll('.content'))
			.sort(function(a, b) { return (a.dataset.seq || 0) - (b.dataset.seq || 0); });
		var explorerOpen = wrapper && wrapper.style.display !== 'none';
		var front = null, frontZ = -1;
		if (explorerOpen) { frontZ = parseInt(wrapper.style.zIndex, 10) || 0; front = wrapper; }
		wins.forEach(function (win) {
			var z = parseInt(win.style.zIndex, 10) || 0;
			if (z >= frontZ) { frontZ = z; front = win; }
		});
		postBtns.innerHTML = '';
		wins.forEach(function (win) {
			var h1 = win.querySelector('.post_title h1');
			if (!h1) return;
			var b = document.createElement('button');
			b.className = 'task-win' + (win === front ? ' active' : '');
			var icon = win.querySelector('.post_title img');
			var emoji = win.querySelector('.post_title .t-emoji');
			if (icon) {
				var i = document.createElement('img');
				i.src = icon.getAttribute('src');
				i.alt = '';
				b.appendChild(i);
			} else if (emoji) {
				var s = document.createElement('span');
				s.className = 't-emoji';
				s.textContent = emoji.textContent;
				b.appendChild(s);
			}
			b.appendChild(document.createTextNode(h1.textContent));
			b.addEventListener('click', function () {
				win.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
				win.dispatchEvent(new MouseEvent('mousedown'));
			});
			postBtns.appendChild(b);
		});
		desktopBtn.hidden = !explorerOpen;
		desktopBtn.classList.toggle('active', explorerOpen && front === wrapper);
	}
	syncWindows();
	document.addEventListener('content:swapped', syncWindows);
	document.addEventListener('window:focused', syncWindows);

	var desktopClose = document.getElementById('desktop-close');
	if (desktopClose) {
		desktopClose.addEventListener('click', function () {
			wrapper.style.display = 'none';
			syncWindows();
		});
	}
	desktopBtn.addEventListener('click', function () {
		wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		wrapper.dispatchEvent(new MouseEvent('mousedown'));
	});
})();
