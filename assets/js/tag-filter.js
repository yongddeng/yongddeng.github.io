(function() {
	var tagList = document.querySelector('.tag_list');
	if (!tagList) return;

	var posts = window.searchIndex || [];
	var originalTitle = document.querySelector('.default_title h1').textContent;

	function escapeHtml(text) {
		var div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	function renderPostList(filtered, activeTag) {
		var postListDiv = document.querySelector('.post_list');
		var html = '<ul>';
		for (var i = 0; i < filtered.length; i++) {
			var tagParam = activeTag ? '?tag=' + encodeURIComponent(activeTag) : '';
			html += '<li><a href="' + filtered[i].url + tagParam + '" title="' + escapeHtml(filtered[i].title) + '">'
				+ '<img src="/assets/img/file.ico" title="' + escapeHtml(filtered[i].title) + '" />'
				+ escapeHtml(filtered[i].title) + '</a></li>';
		}
		html += '</ul>';
		postListDiv.innerHTML = html;
	}

	function updateObjectCount(count) {
		var countDiv = document.querySelector('.post_total .left');
		if (countDiv) {
			countDiv.textContent = count + ' object(s)';
		}
	}

	function updateTitleBar(tagName) {
		var titleEl = document.querySelector('.default_title h1');
		if (titleEl) {
			titleEl.textContent = tagName || originalTitle;
		}
	}

	function filterByTag(tagName) {
		var filtered = posts.filter(function(post) {
			for (var i = 0; i < post.tags.length; i++) {
				if (post.tags[i].toLowerCase().replace(/\s+/g, '-') === tagName.toLowerCase()) {
					return true;
				}
			}
			return false;
		});
		renderPostList(filtered, tagName);
		updateObjectCount(filtered.length);
		updateTitleBar(tagName);
	}

	function showAllPosts() {
		renderPostList(posts, null);
		updateObjectCount(posts.length);
		updateTitleBar(null);
	}

	// Save post_list scroll position before navigating away
	var postListDiv = document.querySelector('.post_list');
	postListDiv.addEventListener('click', function(e) {
		var link = e.target.closest('a');
		if (link) {
			sessionStorage.setItem('postListScrollTop', postListDiv.scrollTop);
		}
	});

	// On page load, check for ?tag= param and apply filter
	// (inline script in default.html hides post_list early to prevent flash)
	var params = new URLSearchParams(window.location.search);
	var activeTag = params.get('tag');
	if (activeTag) {
		filterByTag(activeTag);
		postListDiv.style.visibility = 'visible';
	}

	// Restore scroll position
	var savedScroll = sessionStorage.getItem('postListScrollTop');
	if (savedScroll !== null) {
		postListDiv.scrollTop = parseInt(savedScroll, 10);
		sessionStorage.removeItem('postListScrollTop');
	}

	// Swap the title-bar stylesheet to match the page kind. The layout loads
	// 001.css on index/tag pages (default_title = navy) and 002.css on post
	// pages (default_title = grey, post_title = navy). SPA navigation only
	// swaps .content, so without this the post_title would inherit the grey
	// wrapper background.
	function setStylesheet(toPost) {
		var link = document.querySelector('link[href$="/assets/css/001.css"], link[href$="/assets/css/002.css"]');
		if (!link) return;
		var target = toPost ? '/assets/css/002.css' : '/assets/css/001.css';
		if (link.getAttribute('href') !== target) {
			link.setAttribute('href', target);
		}
	}

	// SPA-like navigation: intercept post link clicks to avoid full page reload
	function loadPost(url) {
		fetch(url).then(function(res) { return res.text(); }).then(function(html) {
			var parser = new DOMParser();
			var doc = parser.parseFromString(html, 'text/html');
			var newContent = doc.querySelector('.content');
			var oldContent = document.querySelector('.content');
			if (newContent) {
				if (oldContent) {
					oldContent.replaceWith(newContent);
				} else {
					// Insert before the searchIndex script
					var wrapper = document.querySelector('.wrapper');
					wrapper.parentNode.insertBefore(newContent, wrapper.nextSibling);
				}
				setStylesheet(true);
				// Re-run code highlighting
				newContent.querySelectorAll('pre code').forEach(function(block) {
					hljs.highlightBlock(block);
				});
				// Re-run line numbers (from 002.js)
				try { if (typeof numbers === 'function') numbers(); } catch (e) {}
				// Re-init maximize/minimize buttons (from 001.js)
				var max = newContent.querySelectorAll('.btn')[1];
				var min = newContent.querySelectorAll('.btn')[2];
				if (max) max.addEventListener('click', maximize, false);
				if (min) min.addEventListener('click', minimize, false);
				// Re-render MathJax if present
				function typesetMathJax() {
					if (window.MathJax && MathJax.Hub) {
						MathJax.Hub.Queue(['Typeset', MathJax.Hub, newContent]);
					} else {
						setTimeout(typesetMathJax, 200);
					}
				}
				typesetMathJax();
			} else {
				// Navigated back to an index/tag page: close the open post.
				if (oldContent) oldContent.remove();
				setStylesheet(false);
			}
			// Update page title
			var newTitle = doc.querySelector('title');
			if (newTitle) document.title = newTitle.textContent;
		});
	}

	postListDiv.addEventListener('click', function(e) {
		var link = e.target.closest('a');
		if (!link) return;
		var href = link.getAttribute('href');
		if (!href || href.startsWith('http')) return;
		e.preventDefault();
		history.pushState(null, '', href);
		loadPost(href);
	});

	// Handle browser back/forward
	window.addEventListener('popstate', function() {
		loadPost(location.pathname + location.search);
	});

	tagList.addEventListener('click', function(e) {
		var link = e.target.closest('a');
		if (!link) return;

		var href = link.getAttribute('href');
		if (!href) return;

		if (href.match(/^\/tag\//)) {
			e.preventDefault();
			var tagName = href.replace(/^\/tag\//, '').replace(/\/$/, '');
			filterByTag(tagName);
		} else if (href === '/') {
			e.preventDefault();
			showAllPosts();
		}
	});
})();
