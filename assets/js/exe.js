// What the programs on (D:) share (lil.js, optimiser.js, scheduler.js,
// init.js, device.js): a place in their window's status bar beside the
// note they draw for, canvases drawn at the screen's density and drawn again as
// they resize, the hatching for room set aside that nothing fills, toggles
// pressed, a player's seek bar, transport and Run, and chance and numbers as
// they draw and write them. Declared as functions, as the desktop runs this
// file again for each window. Their notes are What's This? cards
// (whatsthis.js).

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

// fn whenever any of els changes size, as a grip-resize or a maximise does; a
// closed window lets go
function exeResized(root, fn, ...els) {
	const sized = new ResizeObserver(function () {
		if (root.isConnected) fn();
		else sized.disconnect();
	});
	els.forEach(function (el) {
		sized.observe(el);
	});
}

// A fill for a canvas: colour faintly, crossed by a pixel's diagonal every
// six as Windows 98 hatched, drawn at the screen's own pixels so the lines
// stay sharp; back, the other diagonal. Made once a colour and density,
// kept on the function, as the desktop runs this file again for each window
function hatch(colour, back) {
	const dpr = window.devicePixelRatio || 1, key = colour + !!back + dpr;
	const made = hatch.made || (hatch.made = new Map());
	if (!made.has(key)) {
		const tile = document.createElement('canvas'), t = tile.getContext('2d');
		tile.width = tile.height = Math.round(6 * dpr);
		t.scale(dpr, dpr);
		t.fillStyle = colour;
		t.globalAlpha = 0.12;
		t.fillRect(0, 0, 6, 6);
		t.globalAlpha = 0.8;
		for (let i = 0; i < 6; i++) t.fillRect(i, back ? i : 5 - i, 1, 1);
		const pattern = t.createPattern(tile, 'repeat');
		pattern.setTransform(new DOMMatrix().scale(1 / dpr));
		made.set(key, pattern);
	}
	return made.get(key);
}

// A time field as a seek bar: pressed or dragged, `to` is told the share of the
// field under the pointer, from 0 at its left to 1 at its right
function exeSeekBar(field, to) {
	function shareAt(e) {
		const box = field.getBoundingClientRect();
		return Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
	}
	function move(e) {
		to(shareAt(e));
	}
	function up() {
		field.removeEventListener('pointermove', move);
	}
	field.addEventListener('pointerdown', function (e) {
		field.setPointerCapture(e.pointerId);
		move(e);
		field.addEventListener('pointermove', move);
		field.addEventListener('pointerup', up, { once: true });
		field.addEventListener('pointercancel', up, { once: true });
	});
}

// The pixels a wheel, or two fingers on a trackpad, moved, down or right on, a
// line counted as 16; with sideways, only a move across counts, so that the page
// still scrolls past. A move that counts is the program's, not the page's
function exeWheel(e, sideways) {
	const across = Math.abs(e.deltaX) > Math.abs(e.deltaY);
	if (sideways && !across) return 0;
	e.preventDefault();
	return (across ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 16 : 1);
}

// The transport's buttons greyed where they cannot go: back at the run's start,
// on at its end. Returns a setter of the two
function exeEnds(root) {
	const buttons = root.querySelectorAll('.exe-buttons [data-act]');
	return function (first, last) {
		buttons.forEach(function (b) {
			b.disabled = b.dataset.act === 'start' || b.dataset.act === 'back' ? first : last;
		});
	};
}

// Run, or Pause while the run goes; written only when it changes, as a player
// says so every frame
function exeRunning(button, on) {
	const text = on ? '❚❚ Pause' : '▶ Run';
	if (button.textContent !== text) button.textContent = text;
}

// A toggle pressed or not: its look, and its state as a screen reader hears it
function exePress(button, on) {
	button.classList.toggle('on', on);
	button.setAttribute('aria-pressed', on);
}

// A seeded uniform on [0, 1) (mulberry32), so that a draw is the same on every
// visit
function exeRng(seed) {
	let a = seed >>> 0;
	return function () {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
// A standard normal from a uniform, by Box-Muller, one of each pair
function exeNormal(random) {
	return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

// A number with a thousands comma
function exeFmt(v) {
	return v.toLocaleString('en-GB');
}
// To two places, with a true minus sign
function exeSigned(v) {
	return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
}
// An integer in superscript, and that power of ten
function exeSup(k) {
	return String(k).replace(/\d/g, function (d) {
		return '⁰¹²³⁴⁵⁶⁷⁸⁹'[d];
	}).replace('-', '⁻');
}
function exePower(k) {
	return '10' + exeSup(k);
}
