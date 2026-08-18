// By: h01000110 (hi)
// github.com/h01000110

(function () {
	var zTop = 10;
	var openSeq = 0;

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
			content.style.width = "810px";
			cont.style.width = "98.5%";
		}
	}

	// Click anywhere brings the window to the front; only the front
	// window's title bar renders navy
	function focusEl (el) {
		el.style.zIndex = ++zTop;
		document.querySelectorAll(".wrapper, .content").forEach(function (w) {
			w.classList.toggle("active-win", w === el);
		});
		document.dispatchEvent(new CustomEvent("window:focused", { detail: { el: el } }));
	}

	// The address bar tracks the front window: a post's permalink when a
	// post is in front, "/" otherwise (explorer, folder windows). Replace,
	// not push: focus clicks must not pile up history entries.
	document.addEventListener("window:focused", function (e) {
		var url = e.detail.el.dataset.url || "/";
		if (location.pathname + location.search !== url) {
			history.replaceState(null, "", url);
		}
	});

	function raisable (el) {
		el.addEventListener("mousedown", function () {
			focusEl(el);
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

	// Resize from the corner grip; onResize (optional) runs per move.
	// Double-clicking the grip restores the window's default size.
	function resizable (el, onResize, onReset) {
		var grip = el.querySelector(".win-grip");
		if (!grip) return;
		// A session restore sets the size directly, skipping the drag
		el.addEventListener("win:relayout", function () {
			if (onResize) onResize();
		});
		// Shut Down restores the default size, like the grip's double-click
		el.addEventListener("win:reset", function () {
			if (onReset) onReset();
		});
		grip.addEventListener("dblclick", function () {
			el.style.width = "";
			el.style.height = "";
			if (onReset) onReset();
		});
		grip.addEventListener("mousedown", function (e) {
			var sw = el.offsetWidth, sh = el.offsetHeight;
			var sx = e.clientX, sy = e.clientY;
			function move (ev) {
				el.style.width = Math.max(420, sw + ev.clientX - sx) + "px";
				el.style.height = Math.max(300, sh + ev.clientY - sy) + "px";
				if (onResize) onResize();
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
		// The tree and file panes stretch to fill the resized window
		resizable(wrapper, function () {
			var chrome = wrapper.querySelector(".default_title").offsetHeight +
				wrapper.querySelector(".post_total").offsetHeight + 14;
			var h = Math.max(120, wrapper.clientHeight - chrome);
			wrapper.querySelectorAll(".tag_list, .post_list").forEach(function (p) {
				p.style.minHeight = h + "px";
				p.style.maxHeight = h + "px";
			});
		}, function () {
			wrapper.querySelectorAll(".tag_list, .post_list").forEach(function (p) {
				p.style.minHeight = "";
				p.style.maxHeight = "";
			});
		});
	}

	function initWindow (content) {
		if (content.dataset.win) return;
		content.dataset.win = "1";
		// Taskbar buttons keep opening order, not DOM order
		content.dataset.seq = ++openSeq;
		content.style.zIndex = ++zTop;

		var tbar = content.querySelector(".post_title");
		var max = content.querySelector(".btn_max");
		var min = content.querySelector(".btn_min");
		var close = tbar ? tbar.querySelector("a") : null;

		if (max) max.addEventListener("click", function () { maximize(content); });
		if (min) min.addEventListener("click", function () { minimize(content); });

		// X closes just this window; when the last one goes, restore the
		// desktop title and (only off "/") a clean URL
		if (close) close.addEventListener("click", function (e) {
			e.preventDefault();
			content.remove();
			if (!document.querySelector(".content")) {
				if (location.pathname !== "/") history.pushState(null, "", "/");
				// Tab title carries the site name, not the window title
				document.title = document.body.dataset.site || "";
			}
			document.dispatchEvent(new CustomEvent("content:swapped", { detail: {} }));
		});

		raisable(content);
		if (tbar) dragify(content, tbar);
		resizable(content);
	}

	function init () {
		initWrapper();
		document.querySelectorAll(".content").forEach(initWindow);
		// Focus whichever window is in front (highest z), so closing a
		// background window never steals focus
		var front = null, frontZ = -1;
		document.querySelectorAll(".wrapper, .content").forEach(function (w) {
			var z = parseInt(w.style.zIndex, 10) || 0;
			if (w.style.display !== "none" && z >= frontZ) { frontZ = z; front = w; }
		});
		if (front) focusEl(front);
	}

	init();
	document.addEventListener("content:swapped", init);
})();
