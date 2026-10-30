// What the programs on (D:) share (quincunx.js, lil.js, optimiser.js): a
// place in their window's status bar beside the note they draw for, canvases
// drawn at the screen's density, and a key to what they draw.

// The note's link moves into the status bar and opens the note in a window of
// its own, as My Computer does. Returns a setter for the bar's first cell, which
// says what the program is doing. A phone hides the bar, so there the link stays
// in the program and the setter does nothing
function exeStatus(root) {
	const link = root.querySelector('.exe-for');
	const win = root.closest('.content'), bar = win && win.querySelector('.post_total');
	link.addEventListener('click', function (e) {
		if (!window.desktop || phone()) return;
		e.preventDefault();
		desktop.loadPost(link.getAttribute('href'));
	});
	if (!bar || phone()) return function () {};
	bar.append(link);
	const cell = bar.querySelector('.left');
	return function (text) { cell.textContent = text; };
}

// Sizes a canvas's bitmap to the box CSS gives it, at the screen's density, and
// returns its context cleared and scaled to CSS pixels, with the box's size
function fitCanvas(cv) {
	const W = cv.clientWidth, H = cv.clientHeight, dpr = window.devicePixelRatio || 1;
	const w = Math.round(W * dpr), h = Math.round(H * dpr);
	if (cv.width !== w || cv.height !== h) {
		cv.width = w;
		cv.height = h;
	}
	const cx = cv.getContext('2d');
	cx.setTransform(dpr, 0, 0, dpr, 0, 0);
	cx.clearRect(0, 0, W, H);
	return { cx: cx, W: W, H: H };
}

// A key from x, y down: a row for each [colour, label], its swatch then its
// label, in the font the context has
function legend(cx, x, y, items) {
	cx.textAlign = 'left';
	items.forEach(function (item, i) {
		cx.fillStyle = item[0];
		cx.fillRect(x, y + i * 14, 9, 9);
		cx.fillText(item[1], x + 14, y + 8 + i * 14);
	});
}
