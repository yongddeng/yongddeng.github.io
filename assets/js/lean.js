// Lean in the maths posts: a fold under a statement's proof that holds the
// statement checked by Lean, its lines on the left and, on the right, Lean's
// goals after the line picked, as an editor's infoview shows them. The Lean
// and its goals, each as Lean printed it, come with the first fold opened.
(function () {
	// the posts with Lean, and the statements it proves there, by the term
	// each marks; assets/lean holds the file each proof is in
	var LEAN = {
		'/20220104/inequality': { url: '/assets/lean/inequality.json', marks: ["Markov's inequality", "Chebyshev's inequality"] }
	};
	var files = {};

	function esc(s) {
		return desktop.escapeHtml(s);
	}

	// Lean's lines as an editor colours them: keywords, the theorem's name,
	// comments, and doc comments across lines
	var KW = /\b(theorem|lemma|by|have|set|calc|fun|open|variable|import|refine|rw|apply|intro|exact|gcongr|rfl)\b/g;
	function colour(src, from, to) {
		var doc = false, out = [];
		for (var n = 1; n <= to; n++) {
			var raw = src[n - 1], html;
			if (raw.indexOf('/--') !== -1) doc = true;
			if (doc) {
				html = '<span class="lean-cm">' + esc(raw) + '</span>';
			} else {
				var c = raw.indexOf('--'), code = c === -1 ? raw : raw.slice(0, c);
				html = esc(code).replace(KW, '<span class="lean-kw">$1</span>')
					.replace(/(<span class="lean-kw">theorem<\/span> )(\w+)/, '$1<span class="lean-nm">$2</span>')
					+ (c === -1 ? '' : '<span class="lean-cm">' + esc(raw.slice(c)) + '</span>');
			}
			if (raw.indexOf('-/') !== -1) doc = false;
			if (n >= from) out.push('<li data-n="' + n + '"><i>' + n + '</i><span>' + (html || ' ') + '</span></li>');
		}
		return out.join('');
	}

	// the goals after line n, or after the nearest line above it that has
	// them, back to the proof's first; a hypothesis or goal over several
	// lines is one entry
	function goals(file, proof, n) {
		var k = n;
		while (k >= proof.lo && !(k in file.states)) k--;
		if (k < proof.lo) return '<div class="lean-h">Pick a line of the proof.</div>';
		var head = '<div class="lean-h">&#9660; ' + file.file + ':' + n + (k !== n ? ' · as after line ' + k : '') + '</div>';
		var gs = file.states[k].trim() ? file.states[k].trim().split(/\n\n+/) : [];
		if (!gs.length) return head + '<div class="lean-done">No goals. Lean accepts the proof.</div>';
		return head + '<div class="lean-h">' + gs.length + ' goal' + (gs.length > 1 ? 's' : '') + '</div>' + gs.map(function (g) {
			var entries = [];
			g.split('\n').forEach(function (l) {
				if (/^\s/.test(l) && entries.length) entries[entries.length - 1] += '\n' + l;
				else entries.push(l);
			});
			return '<div class="lean-goal">' + entries.map(function (l) {
				if (/^case /.test(l)) return '<div class="lean-case">' + esc(l) + '</div>';
				if (/^⊢/.test(l)) return '<div><b>⊢</b>' + esc(l.slice(1)) + '</div>';
				var h = l.match(/^(\S[^:]*?) :(\s.*|)$/);
				return h ? '<div><i>' + esc(h[1]) + '</i> :' + esc(h[2]) + '</div>' : '<div>' + esc(l) + '</div>';
			}).join('') + '</div>';
		}).join('');
	}

	function fill(fold, file, proof) {
		fold.insertAdjacentHTML('beforeend', '<p class="lean-note">' + proof.note + '</p>'
			+ '<div class="lean-pane"><ol class="lean-src">' + colour(file.src, proof.from, proof.to) + '</ol><div class="lean-goals"></div></div>');
		function pick(n) {
			fold.querySelectorAll('.lean-src li').forEach(function (li) { li.classList.toggle('on', +li.dataset.n === n); });
			fold.querySelector('.lean-goals').innerHTML = goals(file, proof, n);
		}
		fold.querySelector('.lean-src').addEventListener('click', function (e) {
			var li = e.target.closest('li');
			if (li) pick(+li.dataset.n);
		});
		pick(proof.pick);
	}

	// a Lean fold under each statement proved, after its proof, filled the
	// first time it opens
	function setup(body, lean) {
		lean.marks.forEach(function (mark) {
			var a = [].filter.call(body.querySelectorAll('a[href=""]'), function (a) {
				return a.textContent.replace(/’/g, "'") === mark;
			})[0];
			var block = a && a.closest('.st');
			if (!block) return;
			var after = block.nextElementSibling && block.nextElementSibling.tagName === 'DETAILS' ? block.nextElementSibling : block;
			after.insertAdjacentHTML('afterend', '<details class="lean"><summary>Lean<span class="lean-ok">&#10003; checked</span></summary></details>');
			var fold = after.nextElementSibling;
			fold.addEventListener('toggle', function () {
				if (!fold.open || fold.dataset.filled) return;
				fold.dataset.filled = '1';
				function go(file) {
					fold.querySelector('summary').title = 'Checked by ' + file.checked;
					fill(fold, file, file.proofs[mark]);
				}
				if (files[lean.url]) return go(files[lean.url]);
				fetch(lean.url).then(function (r) { return r.json(); }).then(function (file) {
					files[lean.url] = file;
					go(file);
				});
			});
		});
	}

	// Re-runnable, like initStatements, whose blocks it hangs from
	function initLean() {
		document.querySelectorAll('.content').forEach(function (win) {
			var lean = LEAN[win.dataset.url], body = win.querySelector('.post_content');
			if (!lean || body.dataset.lean) return;
			body.dataset.lean = '1';
			setup(body, lean);
		});
	}

	initLean();
	document.addEventListener('content:swapped', initLean);
})();
