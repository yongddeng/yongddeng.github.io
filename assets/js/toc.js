// Phone contents sheet: tapping the app-bar title raises the post's
// heading outline (the desktop View menu's job) as a bottom sheet.
// Rebuilt from the live headings on every open, so an SPA-swapped
// post needs no bookkeeping.
(function () {
	var sheet = null;

	function openToc(win) {
		var cont = win.querySelector('.post_content');
		var heads = cont ? cont.querySelectorAll('h2, h3') : [];
		if (!heads.length) return;
		if (!sheet) sheet = makeSheet('toc-sheet');
		sheet.title.textContent = 'Contents';
		sheet.body.innerHTML = '';
		heads.forEach(function (h) {
			var row = document.createElement('button');
			row.type = 'button';
			row.className = 'toc-row' + (h.tagName === 'H3' ? ' sub' : '');
			row.textContent = h.textContent;
			row.addEventListener('click', function () {
				sheet.close();
				// land the heading just under the 48px app bar
				window.scrollBy(0, h.getBoundingClientRect().top - 60);
			});
			sheet.body.appendChild(row);
		});
		sheet.body.scrollTop = 0;
		sheet.root.hidden = false;
	}

	document.addEventListener('click', function (e) {
		var h1 = e.target.closest('.post_title h1');
		if (h1 && phone()) openToc(h1.closest('.content'));
	});
})();
