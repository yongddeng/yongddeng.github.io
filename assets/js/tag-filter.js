(function() {
	var tagList = document.querySelector('.tag_list');
	if (!tagList) return;

	var posts = window.searchIndex || [];
	var originalTitle = document.querySelector('.default_title h1').textContent;

	function escapeHtml(text) {
		var div = document.createElement('div');
		div.textContent = text;
		// innerHTML escaping leaves double quotes intact, which would break
		// out of title="..." attributes in renderPostList
		return div.innerHTML.replace(/"/g, '&quot;');
	}

	function renderPostList(filtered, activeTag) {
		var postListDiv = document.querySelector('.post_list');
		var html = '<ul>';
		for (var i = 0; i < filtered.length; i++) {
			var tagParam = activeTag ? '?tag=' + encodeURIComponent(activeTag) : '';
			html += '<li><a href="' + filtered[i].url + tagParam + '" title="' + escapeHtml(filtered[i].title) + '">'
				+ '<img src="/assets/img/' + (filtered[i].icon || 'file.ico') + '" title="' + escapeHtml(filtered[i].title) + '" />'
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

	// Keep the active tag when closing a post: the layout's close (X) button
	// links to "/", which would drop the filter and show all posts.
	function fixCloseLink() {
		var tag = new URLSearchParams(window.location.search).get('tag');
		if (!tag) return;
		var close = document.querySelector('.post_title a[href="/"]');
		if (close) close.setAttribute('href', '/?tag=' + encodeURIComponent(tag));
	}
	fixCloseLink();

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
				fixCloseLink();
				// Scripts inserted via DOMParser are inert; recreate them so
				// per-post scripts (e.g. the video rows) actually run.
				newContent.querySelectorAll('script').forEach(function(old) {
					var s = document.createElement('script');
					if (old.src) { s.src = old.src; } else { s.textContent = old.textContent; }
					old.replaceWith(s);
				});
				// Re-run code highlighting before announcing the swap: the
				// line numbering in 002.js splits the highlighted markup.
				newContent.querySelectorAll('pre code').forEach(function(block) {
					hljs.highlightBlock(block);
				});
				// Let every script re-init itself (xref tooltips, line
				// numbers, window buttons) without this file knowing them.
				document.dispatchEvent(new CustomEvent('content:swapped', { detail: { content: newContent } }));
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
		}).catch(function() {
			// URL is already pushed; fall back to a normal page load
			window.location.href = url;
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
