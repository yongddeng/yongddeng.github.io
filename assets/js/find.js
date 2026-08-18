// Per-window find: Ctrl+F on the focused post window opens a Win9x-style
// Find dialogue that highlights matches inside that window's .post_content.
(function () {

	function clearHits(state) {
		state.hits.forEach(function (span) {
			var parent = span.parentNode;
			if (!parent) return;
			parent.replaceChild(document.createTextNode(span.textContent), span);
			parent.normalize();
		});
		state.hits = [];
		state.cur = -1;
	}

	function textNodesIn(root) {
		var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode: function (node) {
				var el = node.parentElement;
				while (el && el !== root) {
					// Leave rendered maths alone; wrapping its text breaks layout
					if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName.indexOf('MJX-') === 0) {
						return NodeFilter.FILTER_REJECT;
					}
					el = el.parentElement;
				}
				return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
			}
		});
		var nodes = [];
		while (walker.nextNode()) nodes.push(walker.currentNode);
		return nodes;
	}

	function highlight(state) {
		clearHits(state);
		var q = state.input.value.toLowerCase();
		if (!q) { updateCount(state); return; }
		textNodesIn(state.cont).forEach(function (node) {
			var text = node.textContent;
			var lower = text.toLowerCase();
			var idx = lower.indexOf(q);
			if (idx === -1) return;
			var frag = document.createDocumentFragment();
			var pos = 0;
			while (idx !== -1) {
				frag.appendChild(document.createTextNode(text.slice(pos, idx)));
				var span = document.createElement('span');
				span.className = 'find-hl';
				span.textContent = text.slice(idx, idx + q.length);
				frag.appendChild(span);
				state.hits.push(span);
				pos = idx + q.length;
				idx = lower.indexOf(q, pos);
			}
			frag.appendChild(document.createTextNode(text.slice(pos)));
			node.parentNode.replaceChild(frag, node);
		});
		if (state.hits.length) jump(state, 0);
		updateCount(state);
	}

	function updateCount(state) {
		state.count.textContent = state.hits.length
			? (state.cur + 1) + '/' + state.hits.length
			: (state.input.value ? '0/0' : '');
	}

	function jump(state, i) {
		if (!state.hits.length) return;
		if (state.cur >= 0) state.hits[state.cur].classList.remove('current');
		state.cur = (i + state.hits.length) % state.hits.length;
		var el = state.hits[state.cur];
		el.classList.add('current');
		// Scroll the post pane itself, not the page
		var cr = state.cont.getBoundingClientRect();
		var r = el.getBoundingClientRect();
		if (r.top < cr.top || r.bottom > cr.bottom) {
			state.cont.scrollTop += r.top - cr.top - state.cont.clientHeight / 3;
		}
		updateCount(state);
	}

	function closeDialog(state) {
		clearHits(state);
		updateCount(state);
		state.dlg.style.display = 'none';
	}

	// Built once per window on first Ctrl+F, then shown/hidden
	function getState(content) {
		if (content.findState) return content.findState;

		var dlg = document.createElement('div');
		dlg.className = 'find-dlg';
		dlg.innerHTML = '<div class="find-dlg-tbar">Find<span class="find-dlg-x">&times;</span></div>'
			+ '<div class="find-dlg-body">'
			+ '<input type="text" aria-label="find in post" />'
			+ '<button type="button" class="find-prev" aria-label="previous match">&#9650;</button>'
			+ '<button type="button" class="find-next" aria-label="next match">&#9660;</button>'
			+ '<span class="find-count"></span>'
			+ '</div>';
		content.appendChild(dlg);

		var state = {
			dlg: dlg,
			cont: content.querySelector('.post_content'),
			input: dlg.querySelector('input'),
			count: dlg.querySelector('.find-count'),
			hits: [],
			cur: -1
		};
		content.findState = state;

		state.input.addEventListener('input', function () { highlight(state); });
		state.input.addEventListener('keydown', function (e) {
			if (e.key === 'Enter') {
				e.preventDefault();
				jump(state, state.cur + (e.shiftKey ? -1 : 1));
			} else if (e.key === 'Escape') {
				closeDialog(state);
			}
		});
		dlg.querySelector('.find-prev').addEventListener('click', function () { jump(state, state.cur - 1); });
		dlg.querySelector('.find-next').addEventListener('click', function () { jump(state, state.cur + 1); });
		dlg.querySelector('.find-dlg-x').addEventListener('click', function () { closeDialog(state); });
		return state;
	}

	function openFind(win) {
		if (!win || !win.querySelector('.post_content')) return false;
		var state = getState(win);
		state.dlg.style.display = '';
		state.input.focus();
		state.input.select();
		return true;
	}
	// Also opened from the Edit menu (menubar.js)
	window.openFind = openFind;

	document.addEventListener('keydown', function (e) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
			if (openFind(document.querySelector('.content.active-win'))) e.preventDefault();
		}
	});
})();
