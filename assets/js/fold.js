// Explorer-style folding on post sections (desktop): a [−] box in
// front of every heading folds its body — the sibling nodes up to the
// next heading of the same or higher rank, so an h2 takes its whole
// section. State is ephemeral. _mobile.scss hides the boxes; the
// phone's contents sheet covers this need.
(function () {

	function bodyOf(head) {
		var stop = head.tagName === 'H2' ? ['H2'] : ['H2', 'H3'];
		var nodes = [];
		var n = head.nextElementSibling;
		while (n && stop.indexOf(n.tagName) === -1) {
			nodes.push(n);
			n = n.nextElementSibling;
		}
		return nodes;
	}

	function setFolded(head, folded) {
		head.classList.toggle('folded', folded);
		head.querySelector('.fold-box').setAttribute('aria-expanded', !folded);
		bodyOf(head).forEach(function (n) {
			n.hidden = folded;
			// reopening an h2 reopens the h3s folded inside it
			if (!folded) n.classList.remove('folded');
		});
	}

	// Jumps into a folded region (find.js, menubar.js) reopen it first:
	// of the headings above the target, only the nearest h3 and the
	// section's h2 can be hiding it
	window.unfoldTo = function (el) {
		var cont = el.closest('.post_content');
		var top = el;
		while (top.parentElement && top.parentElement !== cont) top = top.parentElement;
		if (!cont || !top.hidden) return;
		var n = top;
		var pastH3 = top.tagName === 'H3';
		while ((n = n.previousElementSibling)) {
			if (n.tagName === 'H3' && !pastH3) {
				pastH3 = true;
				if (n.classList.contains('folded')) setFolded(n, false);
			} else if (n.tagName === 'H2') {
				if (n.classList.contains('folded')) setFolded(n, false);
				break;
			}
		}
	};

	// Re-runnable for SPA-loaded posts, like initXrefs; each content
	// pane is boxed exactly once. The box is empty — its glyph is CSS
	// content — so heading textContent stays clean for the View menu.
	function initFold() {
		document.querySelectorAll('.post_content').forEach(function (c) {
			if (c.dataset.fold) return;
			c.dataset.fold = '1';
			c.querySelectorAll('h2, h3').forEach(function (h) {
				var box = document.createElement('button');
				box.type = 'button';
				box.className = 'fold-box';
				box.setAttribute('aria-label', 'fold section');
				box.setAttribute('aria-expanded', 'true');
				h.prepend(box);
			});
		});
	}

	document.addEventListener('click', function (e) {
		var box = e.target.closest('.fold-box');
		if (!box) return;
		var head = box.parentElement;
		setFolded(head, !head.classList.contains('folded'));
	});

	initFold();
	document.addEventListener('content:swapped', initFold);
})();
