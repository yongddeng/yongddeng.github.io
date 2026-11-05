// Statements in the maths posts (_maths.scss): a paragraph that opens with
// a run-in head, as "**Theorem** (Vitali)**.**" or "*Remark.*" do, starts a
// block, and what completes it (a display, a list, a closing clause) joins
// the block, up to the next head, proof, heading or figure.
(function () {

	var KIND = {
		Definition: 'def',
		Theorem: 'thm', Proposition: 'thm', Lemma: 'thm', Corollary: 'thm',
		Example: 'ex', Examples: 'ex',
		Remark: 'rem', Remarks: 'rem'
	};

	// the kind a paragraph's run-in head names, if it opens with one
	function kindOf(n) {
		var head = n.tagName === 'P' && n.firstChild === n.firstElementChild && n.firstElementChild;
		var name = head && (head.tagName === 'STRONG' || head.tagName === 'EM') ? head.textContent.replace(/\.$/, '') : '';
		return KIND.hasOwnProperty(name) ? KIND[name] : undefined;
	}

	// a proof, a heading or a figure (an iframe in its list) ends a block
	function ends(n) {
		return /^(DETAILS|H1|H2|H3|HR)$/.test(n.tagName) || n.querySelector('iframe') !== null;
	}

	function group(cont) {
		var block = null;
		Array.prototype.slice.call(cont.childNodes).forEach(function (n) {
			var kind = n.nodeType === 1 ? kindOf(n) : undefined;
			if (kind) {
				block = document.createElement('div');
				block.className = 'st st-' + kind;
				cont.insertBefore(block, n);
			} else if (n.nodeType === 1 && ends(n)) {
				block = null;
			}
			if (block) block.appendChild(n);
		});
	}

	// for a pane filled later, as xref.js's previews are
	window.groupStatements = group;

	// Re-runnable for SPA-loaded posts, like initFold; each content pane is
	// grouped once
	function initStatements() {
		document.querySelectorAll('.post_content').forEach(function (c) {
			if (c.dataset.st) return;
			c.dataset.st = '1';
			group(c);
		});
	}

	initStatements();
	document.addEventListener('content:swapped', initStatements);
})();
