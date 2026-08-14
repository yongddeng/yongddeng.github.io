// By: h01000110 (hi)
// github.com/h01000110

(function () {
	function numbers () {
		document.querySelectorAll("pre code").forEach(function (code) {
			if (code.classList.contains("numbered")) return;
			var lines = code.innerHTML.split("\n");
			// Markdown fenced blocks end with a trailing newline
			lines.splice(-1, 1);
			code.innerHTML = "";
			lines.forEach(function (line) {
				var span = document.createElement("span");
				span.className = "code-line";
				// Per-line innerHTML so tags left open by a highlight span
				// crossing lines are auto-closed within each line
				span.innerHTML = line;
				code.appendChild(span);
			});
			code.classList.add("numbered");
		});
	}

	window.addEventListener("load", numbers);
	document.addEventListener("content:swapped", numbers);
})();
