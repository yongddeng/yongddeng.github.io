// The scrollbar's down arrow, escaped to a corner. One screen into a
// post it appears; a tap lands on the prev/next foot, flips it to an up
// arrow, and a second tap returns to the line the reader left. Phone
// only — the desktop scrolls panes, not the page.
(function () {
	var btn = document.querySelector('.jump-end');
	if (!btn) return;
	var arrow = btn.querySelector('span');
	var mark = null; // scrollY to return to; set means "away at the foot"

	function bottom() {
		return document.documentElement.scrollHeight - window.innerHeight;
	}

	function sync() {
		if (!phone()) { btn.hidden = true; return; }
		// Scrolling a full screen away from the foot forgets the trip
		if (mark !== null && bottom() - window.scrollY > window.innerHeight) mark = null;
		var glyph = mark === null ? '\u25bc' : '\u25b2';
		if (arrow.textContent !== glyph) arrow.textContent = glyph;
		btn.hidden = mark === null && window.scrollY < window.innerHeight;
	}

	btn.addEventListener('click', function () {
		if (mark === null) {
			mark = window.scrollY;
			// Overshoot and let the browser clamp: computing the target from
			// innerHeight undershoots on iOS while the toolbar is collapsing
			window.scrollTo(0, document.documentElement.scrollHeight);
		} else {
			window.scrollTo(0, mark);
			mark = null;
		}
		sync();
	});

	window.addEventListener('scroll', sync, { passive: true });
	// A rotate needs no scroll to hide or re-show the button
	phoneQuery.addEventListener('change', sync);
	sync();
})();
