// By: h01000110 (hi)
// github.com/h01000110

(function () {
	function getWidth () {
		return window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName("body")[0].clientWidth;
	}

	function maximize () {
		var post = document.getElementsByClassName("content")[0];
		var cont = document.getElementsByClassName("post_content")[0];
		var wid = getWidth();

		if (wid > 900) {
			post.style.width = (wid * 0.9) + "px";
			cont.style.width = wid < 1400 ? "99%" : "99.4%";
		}
	}

	function minimize () {
		var post = document.getElementsByClassName("content")[0];
		var cont = document.getElementsByClassName("post_content")[0];

		if (getWidth() > 900) {
			post.style.width = "800px";
			cont.style.width = "98.5%";
		}
	}

	function initButtons () {
		var max = document.querySelector(".post_title .btn_max");
		var min = document.querySelector(".post_title .btn_min");
		if (max) max.addEventListener("click", maximize, false);
		if (min) min.addEventListener("click", minimize, false);
	}

	initButtons();
	document.addEventListener("content:swapped", initButtons);
})();
