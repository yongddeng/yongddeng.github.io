(function () {
	var startBtn = document.getElementById('task-start');
	var startMenu = document.getElementById('task-menu');
	var desktopBtn = document.getElementById('task-desktop');
	var postBtns = document.getElementById('task-posts');
	var clock = document.getElementById('task-clock');

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
		var explorerOpen = wrapper.style.display !== 'none';
		postBtns.innerHTML = '';
		wins.forEach(function (win) {
			var h1 = win.querySelector('.post_title h1');
			var b = document.createElement('button');
			b.className = 'task-win' + (win.classList.contains('active-win') ? ' active' : '');
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
		desktopBtn.classList.toggle('active', explorerOpen && wrapper.classList.contains('active-win'));
	}
	syncWindows();
	document.addEventListener('content:swapped', syncWindows);
	document.addEventListener('window:focused', syncWindows);

	// content:swapped so that 001.js hands the focus to the window behind
	document.getElementById('desktop-close').addEventListener('click', function () {
		wrapper.style.display = 'none';
		document.dispatchEvent(new CustomEvent('content:swapped'));
	});
	desktopBtn.addEventListener('click', function () {
		wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		wrapper.dispatchEvent(new MouseEvent('mousedown'));
	});
})();
