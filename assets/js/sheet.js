// Phone bottom-sheet chrome shared by the §-reference peek (xref.js)
// and the contents sheet (toc.js): dim + navy bar + body, closed by
// the ✕, the dim, or dragging the bar down past a third of the height.
function makeSheet(extraClass) {
	var root = document.createElement('div');
	root.className = 'xp-sheet' + (extraClass ? ' ' + extraClass : '');
	root.hidden = true;
	root.innerHTML = '<div class="xp-dim"></div>'
		+ '<div class="xp-box">'
		+ '<div class="xp-bar"><span class="xp-title"></span><span class="xp-x">&times;</span></div>'
		+ '<div class="xp-body"></div>'
		+ '</div>';
	document.body.appendChild(root);

	function close() { root.hidden = true; }
	root.querySelector('.xp-dim').addEventListener('click', close);
	root.querySelector('.xp-x').addEventListener('click', close);

	// The bar is honest: the sheet follows the finger, closes when
	// dragged past a third of its height, springs back otherwise
	var box = root.querySelector('.xp-box');
	var startY = null;
	function settle(dy) {
		startY = null;
		box.classList.remove('dragging');
		if (dy > box.offsetHeight / 3) close();
		box.style.transform = '';
	}
	root.addEventListener('touchstart', function (e) {
		startY = e.target.closest('.xp-bar') ? e.touches[0].clientY : null;
		if (startY !== null) box.classList.add('dragging');
	}, { passive: true });
	root.addEventListener('touchmove', function (e) {
		if (startY === null) return;
		box.style.transform = 'translateY(' + Math.max(0, e.touches[0].clientY - startY) + 'px)';
	}, { passive: true });
	root.addEventListener('touchend', function (e) {
		if (startY !== null) settle(e.changedTouches[0].clientY - startY);
	});
	root.addEventListener('touchcancel', function () {
		if (startY !== null) settle(0);
	});

	return {
		root: root,
		title: root.querySelector('.xp-title'),
		body: root.querySelector('.xp-body'),
		close: close
	};
}
