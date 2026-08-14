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
		var m = (h >= 12 ? ' PM' : ' AM');
		clock.textContent = (h % 12 || 12) + ':' + ('0' + d.getMinutes()).slice(-2) + m;
	}
	tick();
	setInterval(tick, 30000);

	startBtn.addEventListener('click', function (e) {
		e.stopPropagation();
		startMenu.classList.toggle('open');
	});
	document.addEventListener('click', function () {
		startMenu.classList.remove('open');
	});

	// One button per open window: the explorer (closable) and up to two
	// post windows (SPA swaps included)
	var wrapper = document.querySelector('.wrapper');
	function syncWindows() {
		var wins = document.querySelectorAll('.content');
		var explorerOpen = wrapper && wrapper.style.display !== 'none';
		// Only the front window's button renders pressed
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
			b.textContent = h1.textContent;
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
	postBtn.addEventListener('click', function () {
		var content = document.querySelector('.content');
		if (content) content.scrollIntoView({ behavior: 'smooth' });
	});
})();
