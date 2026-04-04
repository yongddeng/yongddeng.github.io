(function() {
	var searchInput = document.getElementById('search-input');
	var searchResults = document.getElementById('search-results');
	
	if (!searchInput || !searchResults) return;
	
	var posts = window.searchIndex || [];
	var currentResults = [];
	var selectedIndex = -1;
	
	function search(query) {
		if (!query || query.length < 2) {
			searchResults.innerHTML = '';
			searchResults.style.display = 'none';
			currentResults = [];
			selectedIndex = -1;
			return;
		}
		
		var results = posts.filter(function(post) {
			var searchText = (post.title + ' ' + post.content + ' ' + post.tags.join(' ')).toLowerCase();
			return searchText.indexOf(query.toLowerCase()) !== -1;
		});
		
		currentResults = results;
		selectedIndex = -1;
		displayResults(results, query);
	}
	
	function escapeHtml(text) {
		var div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
	
	function displayResults(results, query) {
		var html = '<div class="result-header">';
		if (results.length === 0) {
			html += 'No results for "' + escapeHtml(query) + '"</div><ul><li class="empty">Try different keywords</li></ul>';
		} else {
			html += results.length + ' result' + (results.length !== 1 ? 's' : '') + ' found</div><ul>';
			for (var i = 0; i < results.length; i++) {
				html += '<li><a href="' + results[i].url + '" data-index="' + i + '"><img src="/assets/img/file.ico" /><span>' + escapeHtml(results[i].title) + '</span></a></li>';
			}
			html += '</ul>';
		}
		searchResults.innerHTML = html;
		searchResults.style.display = 'block';
		updateHighlight();
	}
	
	function updateHighlight() {
		var links = searchResults.querySelectorAll('a[data-index]');
		for (var i = 0; i < links.length; i++) {
			if (i === selectedIndex) {
				links[i].classList.add('highlighted');
				links[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			} else {
				links[i].classList.remove('highlighted');
			}
		}
	}
	
	function navigateResults(direction) {
		if (currentResults.length === 0) return;
		
		if (direction === 'down') {
			selectedIndex = (selectedIndex + 1) % currentResults.length;
		} else if (direction === 'up') {
			selectedIndex = selectedIndex <= 0 ? currentResults.length - 1 : selectedIndex - 1;
		}
		
		updateHighlight();
	}
	
	function selectResult() {
		if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
			window.location.href = currentResults[selectedIndex].url;
		}
	}
	
	searchInput.addEventListener('input', function(e) {
		search(e.target.value);
	});
	
	searchInput.addEventListener('keydown', function(e) {
		if (searchResults.style.display === 'none') return;
		
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			navigateResults('down');
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			navigateResults('up');
		} else if (e.key === 'Enter') {
			e.preventDefault();
			selectResult();
		} else if (e.key === 'Escape') {
			searchResults.style.display = 'none';
			selectedIndex = -1;
		}
	});
	
	document.addEventListener('click', function(e) {
		if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
			searchResults.style.display = 'none';
			selectedIndex = -1;
		}
	});
})();