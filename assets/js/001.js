// By: h01000110 (hi)
// github.com/h01000110

(function () {
	var zTop = 10;

	function getWidth () {
		return window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName("body")[0].clientWidth;
	}

	function maximize (content) {
		var cont = content.querySelector(".post_content");
		var wid = getWidth();
		if (wid > 900) {
			content.style.width = (wid * 0.9) + "px";
			cont.style.width = wid < 1400 ? "99%" : "99.4%";
		}
	}

	function minimize (content) {
		var cont = content.querySelector(".post_content");
		if (getWidth() > 900) {
			content.style.width = "800px";
			cont.style.width = "98.5%";
		}
	}

	// Click anywhere brings the window to the front
	function raisable (el) {
		el.addEventListener("mousedown", function () {
			el.style.zIndex = ++zTop;
			document.dispatchEvent(new CustomEvent("window:focused"));
		});
	}

	// Drag by the title bar; the window leaves normal flow on first grab
	function dragify (el, tbar) {
		tbar.style.cursor = "move";
		tbar.addEventListener("mousedown", function (e) {
			if (e.target.closest(".btn") || e.target.closest("a")) return;
			var r = el.getBoundingClientRect();
			var ox = r.left + window.scrollX, oy = r.top + window.scrollY;
			el.style.position = "absolute";
			el.style.margin = "0";
			el.style.left = ox + "px";
			el.style.top = oy + "px";
			var sx = e.clientX, sy = e.clientY;
			function move (ev) {
				el.style.left = (ox + ev.clientX - sx) + "px";
				el.style.top = Math.max(0, oy + ev.clientY - sy) + "px";
			}
			function up () {
				document.removeEventListener("mousemove", move);
				document.removeEventListener("mouseup", up);
			}
			document.addEventListener("mousemove", move);
			document.addEventListener("mouseup", up);
			e.preventDefault();
		});
	}

	function initWrapper () {
		var wrapper = document.querySelector(".wrapper");
		if (!wrapper || wrapper.dataset.win) return;
		wrapper.dataset.win = "1";
		wrapper.style.zIndex = ++zTop;
		raisable(wrapper);
		var tbar = wrapper.querySelector(".default_title");
		if (tbar) dragify(wrapper, tbar);
	}

	function initWindow (content) {
		if (content.dataset.win) return;
		content.dataset.win = "1";
		content.style.zIndex = ++zTop;

		var tbar = content.querySelector(".post_title");
		var max = content.querySelector(".btn_max");
		var min = content.querySelector(".btn_min");
		var close = tbar ? tbar.querySelector("a") : null;
		var grip = content.querySelector(".win-grip");

		if (max) max.addEventListener("click", function () { maximize(content); });
		if (min) min.addEventListener("click", function () { minimize(content); });

		// X closes just this window; navigation only if it was the last one
		if (close) close.addEventListener("click", function (e) {
			e.preventDefault();
			content.remove();
			if (!document.querySelector(".content")) {
				history.pushState(null, "", "/");
				document.title = document.querySelector(".default_title h1").textContent;
			}
			document.dispatchEvent(new CustomEvent("content:swapped", { detail: {} }));
		});

		raisable(content);
		if (tbar) dragify(content, tbar);

		// Resize from the corner grip
		if (grip) grip.addEventListener("mousedown", function (e) {
			var sw = content.offsetWidth, sh = content.offsetHeight;
			var sx = e.clientX, sy = e.clientY;
			function move (ev) {
				content.style.width = Math.max(420, sw + ev.clientX - sx) + "px";
				content.style.height = Math.max(300, sh + ev.clientY - sy) + "px";
			}
			function up () {
				document.removeEventListener("mousemove", move);
				document.removeEventListener("mouseup", up);
			}
			document.addEventListener("mousemove", move);
			document.addEventListener("mouseup", up);
			e.preventDefault();
		});
	}

	function init () {
		initWrapper();
		document.querySelectorAll(".content").forEach(initWindow);
	}

	init();
	document.addEventListener("content:swapped", init);
})();
