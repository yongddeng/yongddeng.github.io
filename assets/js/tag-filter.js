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
		// quotes escaped too: titles land inside title="..." attributes
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

	function postsForTag(tagName) {
		return posts.filter(function(post) {
			return post.tags.some(function(t) {
				return t.toLowerCase().replace(/\s+/g, '-') === tagName.toLowerCase();
			});
		});
	}

	function filterByTag(tagName) {
		var filtered = postsForTag(tagName);
		renderPostList(filtered, tagName);
		updateObjectCount(filtered.length);
		updateTitleBar(tagName);
	}

	function showAllPosts() {
		renderPostList(posts, null);
		updateObjectCount(posts.length);
		updateTitleBar(null);
	}

	// A tag folder is its own window: files only, no drive tree
	function openFolderWindow(tagName) {
		var existing = document.querySelector('.folder-win[data-tag="' + tagName + '"]');
		if (existing) {
			existing.dispatchEvent(new MouseEvent('mousedown'));
			return;
		}
		var filtered = postsForTag(tagName);
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
		// 001.js adds drag/raise/close/resize, taskbar adds a button
		document.dispatchEvent(new CustomEvent('content:swapped', { detail: {} }));
		win.dispatchEvent(new MouseEvent('mousedown'));
	}

	// Date header sorts the sibling list, toggling direction
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

	// Tag shortcuts open folder windows, post shortcuts open post windows
	function openShortcut(href) {
		var tagMatch = href && href.match(/^\/\?tag=([^&]+)/);
		if (tagMatch) {
			openFolderWindow(decodeURIComponent(tagMatch[1]));
			return true;
		}
		if (href && href.charAt(0) === '/' && href.length > 1) {
			loadPost(href);
			return true;
		}
		return false;
	}

	// Delegated: this script loads before the taskbar markup exists
	document.addEventListener('click', function(e) {
		var link = e.target.closest('#task-menu a');
		if (!link) return;
		var href = link.getAttribute('href') || '';
		if (href === '#' || href.indexOf('http') === 0) return;
		e.preventDefault();
		openShortcut(href);
	});

	var desktopIcons = document.querySelector('.desktop-icons');
	if (desktopIcons) {
		desktopIcons.addEventListener('click', function(e) {
			var link = e.target.closest('a');
			if (!link) return;
			var href = link.getAttribute('href');
			if (openShortcut(href)) {
				e.preventDefault();
			} else if (href === '/') {
				e.preventDefault();
				var wrapper = document.querySelector('.wrapper');
				var wasHidden = wrapper.style.display === 'none';
				wrapper.style.display = '';
				showAllPosts();
				if (wasHidden) placeWindow(wrapper);
				wrapper.dispatchEvent(new MouseEvent('mousedown'));
			}
		});
	}

	// Hovering a file reports its full path in the status bar
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

	// Apply the ?tag= filter (default.html hides the list pre-render)
	var postListDiv = document.querySelector('.post_list');
	var activeTag = new URLSearchParams(window.location.search).get('tag');
	if (activeTag) {
		filterByTag(activeTag);
		postListDiv.style.visibility = 'visible';
	}

	// Random spot overlapping the open windows least (zero if possible)
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

	// Windows that count against the cap: posts only, not chrome
	function openPosts() {
		return Array.prototype.slice.call(document.querySelectorAll('.content')).filter(function(w) {
			return !w.classList.contains('settings-win') && !w.classList.contains('folder-win');
		});
	}

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

	// Opens a post as a window; at most three, a fourth is refused
	function loadPost(url) {
		// ?tag= variants of the same URL are the same post
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
				// DOMParser scripts are inert; recreate them so they run
				newContent.querySelectorAll('script').forEach(function(old) {
					var s = document.createElement('script');
					if (old.src) { s.src = old.src; } else { s.textContent = old.textContent; }
					old.replaceWith(s);
				});
				// highlight before the swap event: 002.js splits this markup
				newContent.querySelectorAll('pre code').forEach(function(block) {
					hljs.highlightBlock(block);
				});
				document.dispatchEvent(new CustomEvent('content:swapped', { detail: { content: newContent } }));
				function typesetMathJax() {
					if (window.MathJax && MathJax.Hub) {
						MathJax.Hub.Queue(['Typeset', MathJax.Hub, newContent]);
					} else {
						setTimeout(typesetMathJax, 200);
					}
				}
				typesetMathJax();
			} else {
				// navigated to an index page: close all post windows
				open.forEach(function(w) { w.remove(); });
				document.dispatchEvent(new CustomEvent('content:swapped', { detail: {} }));
			}
			var newTitle = doc.querySelector('title');
			if (newTitle) document.title = newTitle.textContent;
		}).catch(function() {
			window.location.href = url;
		});
	}

	// URL stays untouched: a refresh always lands on a clean desktop
	postListDiv.addEventListener('click', function(e) {
		var link = e.target.closest('a');
		if (!link) return;
		var href = link.getAttribute('href');
		if (!href || href.startsWith('http')) return;
		e.preventDefault();
		loadPost(href);
	});

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
