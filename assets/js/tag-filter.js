(function() {
	var tagList = document.querySelector('.tag_list');
	if (!tagList) return;

	var posts = window.searchIndex || [];
	var originalTitle = document.querySelector('.default_title h1').textContent;

	var DET_HEAD = '<div class="det-head"><span class="dh-name">Name</span>'
		+ '<span class="dh-type">Type</span><span class="dh-date">Date</span></div>';

	function typeFor(icon) {
		return icon === 'video.svg' ? 'Media Clip' : 'Notepad';
	}

	function itemHtml(post, tagParam) {
		return '<li data-date="' + (post.sortdate || '') + '"><a href="' + post.url + (tagParam || '') + '" title="' + escapeHtml(post.title) + '">'
			+ '<img src="/assets/img/' + (post.icon || 'notepad.png') + '" title="' + escapeHtml(post.title) + '" />'
			+ '<span class="nm">' + escapeHtml(post.title) + '</span>'
			+ '<span class="ty">' + typeFor(post.icon) + '</span>'
			+ '<span class="dt">' + (post.date || '') + '</span></a></li>';
	}

	function escapeHtml(text) {
		var div = document.createElement('div');
		div.textContent = text;
		// innerHTML escaping leaves double quotes intact, which would break
		// out of title="..." attributes in renderPostList
		return div.innerHTML.replace(/"/g, '&quot;');
	}

	function renderPostList(filtered, activeTag) {
		var postListDiv = document.querySelector('.post_list');
		var tagParam = activeTag ? '?tag=' + encodeURIComponent(activeTag) : '';
		var html = DET_HEAD + '<ul>';
		for (var i = 0; i < filtered.length; i++) {
			html += itemHtml(filtered[i], tagParam);
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

	// A tag folder opens as its own window (files only, no drive tree),
	// coexisting with the My Computer explorer
	function openFolderWindow(tagName) {
		var existing = document.querySelector('.folder-win[data-tag="' + tagName + '"]');
		if (existing) {
			existing.dispatchEvent(new MouseEvent('mousedown'));
			return;
		}
		var filtered = posts.filter(function(post) {
			return post.tags.some(function(t) {
				return t.toLowerCase().replace(/\s+/g, '-') === tagName.toLowerCase();
			});
		});
		var items = '';
		for (var i = 0; i < filtered.length; i++) {
			items += itemHtml(filtered[i]);
		}
		var win = document.createElement('div');
		win.className = 'content folder-win';
		win.setAttribute('data-tag', tagName);
		win.innerHTML =
			'<div class="post_title"><img src="/assets/img/folder.ico" /><h1>' + escapeHtml(tagName) + '</h1>'
			+ '<a href="/"><div class="btn"><span class="fa fa-times"></span></div></a></div>'
			+ '<div class="post_content">' + DET_HEAD + '<ul>' + items + '</ul></div>'
			+ '<div class="folder-status">' + filtered.length + ' object(s)</div>'
			+ '<div class="win-grip"></div>';
		document.body.insertBefore(win, document.querySelector('.taskbar'));
		win.querySelector('ul').addEventListener('click', function(e) {
			var link = e.target.closest('a');
			if (!link) return;
			e.preventDefault();
			loadPost(link.getAttribute('href'));
		});
		placeWindow(win);
		// 001.js picks it up (drag/raise/close/resize), taskbar adds a button
		document.dispatchEvent(new CustomEvent('content:swapped', { detail: {} }));
		win.dispatchEvent(new MouseEvent('mousedown'));
	}

	// Explorer-style sorting: clicking the Date header reorders the
	// sibling list, toggling ascending/descending
	document.addEventListener('click', function(e) {
		var head = e.target.closest('.dh-date');
		if (!head) return;
		var list = head.parentNode.nextElementSibling;
		if (!list || list.tagName !== 'UL') return;
		var asc = head.dataset.dir !== 'asc';
		head.dataset.dir = asc ? 'asc' : 'desc';
		Array.prototype.slice.call(list.children).sort(function(a, b) {
			var da = parseInt(a.dataset.date, 10) || 0;
			var db = parseInt(b.dataset.date, 10) || 0;
			return asc ? da - db : db - da;
		}).forEach(function(li) { list.appendChild(li); });
	});

	// Start menu shortcuts behave like desktop icons: tag entries open
	// folder windows, post entries open post windows; external links and
	// the settings row pass through untouched. Delegated on document:
	// this script loads before the taskbar markup exists, so a direct
	// #task-menu lookup here would silently bind to nothing.
	document.addEventListener('click', function(e) {
		var link = e.target.closest('#task-menu a');
		if (!link) return;
		var href = link.getAttribute('href') || '';
		if (href === '#' || href.indexOf('http') === 0) return;
		var tagMatch = href.match(/^\/\?tag=([^&]+)/);
		e.preventDefault();
		if (tagMatch) {
			openFolderWindow(decodeURIComponent(tagMatch[1]));
		} else if (href.charAt(0) === '/' && href.length > 1) {
			loadPost(href);
		}
	});

	// Desktop icons: My Computer opens the full drive view, a tag icon
	// opens that folder's own window
	var desktopIcons = document.querySelector('.desktop-icons');
	if (desktopIcons) {
		desktopIcons.addEventListener('click', function(e) {
			var link = e.target.closest('a');
			if (!link) return;
			var href = link.getAttribute('href');
			var wrapper = document.querySelector('.wrapper');
			var tagMatch = href && href.match(/^\/\?tag=([^&]+)/);
			if (tagMatch) {
				e.preventDefault();
				openFolderWindow(decodeURIComponent(tagMatch[1]));
			} else if (href && href.charAt(0) === '/' && href.length > 1) {
				// Post shortcuts (e.g. 699. videos) open as SPA windows too
				e.preventDefault();
				loadPost(href);
			} else if (href === '/') {
				e.preventDefault();
				var wasHidden = wrapper.style.display === 'none';
				wrapper.style.display = '';
				showAllPosts();
				if (wasHidden) placeWindow(wrapper);
				wrapper.dispatchEvent(new MouseEvent('mousedown'));
			}
		});
	}

	// IE4 "web style" selection: hovering an icon reports its full path
	// in the status bar (the right segment is otherwise a blank placeholder)
	function pathFor(link) {
		var href = (link.getAttribute('href') || '').split('?')[0];
		var post = null;
		for (var i = 0; i < posts.length; i++) {
			if (posts[i].url === href) { post = posts[i]; break; }
		}
		if (!post) return link.getAttribute('title') || '';
		var tag = (post.tags && post.tags[0]) || '';
		var drive = tag === 'open' ? 'D:' : 'C:';
		return drive + '\\' + (tag ? tag + '\\' : '') + post.title;
	}

	var statusRight = document.querySelector('.post_total .right');
	if (statusRight) {
		document.querySelector('.post_list').addEventListener('mouseover', function(e) {
			var link = e.target.closest('a');
			if (link) statusRight.textContent = pathFor(link);
		});
		document.querySelector('.post_list').addEventListener('mouseout', function() {
			statusRight.innerHTML = '&nbsp;';
		});
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

	// Place a freshly opened window like the OS would: try random spots
	// and keep the one overlapping the open windows least (zero if it can)
	function placeWindow(win) {
		var others = [];
		var wrapper = document.querySelector('.wrapper');
		if (wrapper && wrapper !== win && wrapper.style.display !== 'none') others.push(wrapper.getBoundingClientRect());
		document.querySelectorAll('.content').forEach(function(w) {
			if (w !== win) others.push(w.getBoundingClientRect());
		});
		var ww = win.offsetWidth, wh = win.offsetHeight;
		// Never cover the desktop-icon column
		var icons = document.querySelector('.desktop-icons');
		var minX = 0;
		if (icons && getComputedStyle(icons).display !== 'none') {
			minX = icons.getBoundingClientRect().right + 10;
		}
		var maxX = Math.max(minX, window.innerWidth - ww - 20);
		var maxY = Math.max(40, window.innerHeight - wh - 60);
		function overlap(x, y) {
			var area = 0;
			others.forEach(function(r) {
				area += Math.max(0, Math.min(x + ww, r.right) - Math.max(x, r.left)) *
					Math.max(0, Math.min(y + wh, r.bottom) - Math.max(y, r.top));
			});
			return area;
		}
		var best = null;
		for (var i = 0; i < 12; i++) {
			var x = minX + Math.round(Math.random() * (maxX - minX));
			var y = 30 + Math.round(Math.random() * (maxY - 30));
			var a = overlap(x, y);
			if (!best || a < best.a) best = { x: x, y: y, a: a };
			if (a === 0) break;
		}
		win.style.position = 'absolute';
		win.style.margin = '0';
		win.style.left = (best.x + window.scrollX) + 'px';
		win.style.top = (best.y + window.scrollY) + 'px';
	}

	// Post windows only: the explorer, folder windows and dialogs are
	// never counted against, or replaced by, the cap
	function openPosts() {
		return Array.prototype.slice.call(document.querySelectorAll('.content')).filter(function(w) {
			return !w.classList.contains('settings-win') && !w.classList.contains('folder-win');
		});
	}

	// Win95 error box; replaces any previous one
	function showError(message) {
		var old = document.querySelector('.err-win');
		if (old) old.remove();
		var box = document.createElement('div');
		box.className = 'err-win active-win';
		box.innerHTML = '<div class="post_title"><h1>Hikikomori</h1></div>'
			+ '<div class="err-body"><span class="err-ic">&#9888;&#65039;</span><p>' + message + '</p></div>'
			+ '<div class="err-btnrow"><button>OK</button></div>';
		document.body.appendChild(box);
		box.querySelector('button').addEventListener('click', function() { box.remove(); });
	}

	// SPA-like navigation: intercept post link clicks to avoid full page
	// reload. At most three post windows; a fourth is refused, Win95-style.
	function loadPost(url) {
		// One window per post: ?tag= variants of the same URL are the same post
		var key = url.split('?')[0];
		var dup = document.querySelector('.content[data-url="' + key + '"]');
		if (dup) {
			dup.dispatchEvent(new MouseEvent('mousedown'));
			return;
		}
		if (openPosts().length >= 3) {
			showError('There is not enough memory to open another window. '
				+ 'Close one of the open posts, and then try again.');
			return;
		}
		fetch(url).then(function(res) { return res.text(); }).then(function(html) {
			var parser = new DOMParser();
			var doc = parser.parseFromString(html, 'text/html');
			var newContent = doc.querySelector('.content');
			var open = openPosts();
			if (newContent) {
				var anchor = open.length ? open[open.length - 1] : document.querySelector('.wrapper');
				anchor.parentNode.insertBefore(newContent, anchor.nextSibling);
				newContent.setAttribute('data-url', key);
				placeWindow(newContent);
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
				// Navigated back to an index/tag page: close all post windows.
				open.forEach(function(w) { w.remove(); });
				document.dispatchEvent(new CustomEvent('content:swapped', { detail: {} }));
			}
			// Update page title
			var newTitle = doc.querySelector('title');
			if (newTitle) document.title = newTitle.textContent;
		}).catch(function() {
			// Network/parse trouble: fall back to a normal page load
			window.location.href = url;
		});
	}

	// The URL is left untouched on purpose: a refresh always lands on
	// the clean desktop, not whatever windows were open
	postListDiv.addEventListener('click', function(e) {
		var link = e.target.closest('a');
		if (!link) return;
		var href = link.getAttribute('href');
		if (!href || href.startsWith('http')) return;
		e.preventDefault();
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
