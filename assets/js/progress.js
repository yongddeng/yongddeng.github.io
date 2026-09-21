// F1 status bar on post windows: "Ready" plus Win95 progress blocks that
// fill with reading progress. Ratio-based, so grip-resizes, maximise, and
// font-size settings all stay correct.
(function () {

	function init(win) {
		var cont = win.querySelector('.post_content');
		var bar = win.querySelector('.post_total');
		if (!cont || !bar || bar.dataset.progress) return;
		bar.dataset.progress = '1';
		var label = bar.querySelector('.left');
		var blocks = bar.querySelectorAll('.right i');
		var strip = win.querySelectorAll('.read-prog i');

		function update() {
			// On a phone the page is the scroller, not the pane
			var max, r;
			if (phone()) {
				max = document.documentElement.scrollHeight - window.innerHeight;
				r = max > 0 ? Math.min(1, window.scrollY / max) : 1;
			} else {
				max = cont.scrollHeight - cont.clientHeight;
				r = max > 0 ? Math.min(1, cont.scrollTop / max) : 1;
			}
			blocks.forEach(function (b, i) {
				b.className = r > 0 && i / blocks.length <= r ? 'on' : '';
			});
			strip.forEach(function (b, i) {
				b.className = r > 0 && i / strip.length <= r ? 'on' : '';
			});
			label.textContent = r >= 1 ? 'Done' : 'Ready';
		}

		cont.addEventListener('scroll', update);
		// Self-removing: the desktop SPA replaces windows, and a listener
		// on window would otherwise keep each dead one reachable
		window.addEventListener('scroll', function onPage() {
			if (!cont.isConnected) { window.removeEventListener('scroll', onPage); return; }
			update();
		}, { passive: true });
		// Re-sync when the pane is resized without scrolling (grip, maximise)
		if (window.ResizeObserver) new ResizeObserver(update).observe(cont);
		update();
	}

	function initAll() {
		document.querySelectorAll('.content').forEach(init);
	}
	initAll();
	document.addEventListener('content:swapped', initAll);
	// MathJax and images change scrollHeight after first paint
	window.addEventListener('load', function () {
		document.querySelectorAll('.content .post_content').forEach(function (c) {
			c.dispatchEvent(new Event('scroll'));
		});
	});
})();
