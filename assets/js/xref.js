// Cross-reference tooltips for §-references in CS400 posts
(function () {
  var refs = {
    '601': { title: '601. computer', url: '/20260101/computer' },
    '602': { title: '602. programming', url: '/20260102/program' },
    '603': { title: '603. operating system', url: '/20260103/operating-system' },
    '604': { title: '604. concurrency', url: '/20260104/concurrency' },
    '605': { title: '605. networking', url: '/20260105/networking' },
    '606': { title: '606. database', url: '/20260106/database' },
    '607': { title: '607. virtualisation', url: '/20260107/virtualisation' }
  };

  var cache = {};

  // Re-runnable: SPA navigation (tag-filter.js loadPost) swaps in fresh
  // post content, so this must be callable again, not run-once. Walks
  // every open post window; each is set up exactly once.
  function initXrefs() {
    document.querySelectorAll('.post_content').forEach(function (c) {
      if (!c.dataset.xref) { c.dataset.xref = '1'; setupContent(c); }
    });
  }

  function setupContent(content) {

    // Wrap §4XX and §4XX#section occurrences in <span> elements
    var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(function (node) {
    if (/§\d{3}/.test(node.textContent)) {
      var frag = document.createDocumentFragment();
      var parts = node.textContent.split(/(§\d{3}(?:#[\d.]+)?)/);
      parts.forEach(function (part) {
        var m = part.match(/^§(\d{3})(?:#([\d.]+))?$/);
        if (m && refs[m[1]]) {
          var span = document.createElement('span');
          span.className = 'xref';
          span.textContent = '§' + m[1];
          span.setAttribute('data-ref', m[1]);
          if (m[2]) span.setAttribute('data-section', m[2]);
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      });
      node.parentNode.replaceChild(frag, node);
    }
    });

    // Fetch and cache post content
    function fetchPost(id, cb) {
    if (cache[id]) return cb(cache[id]);
    fetch(refs[id].url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var pc = doc.querySelector('.post_content');
        cache[id] = pc ? pc.innerHTML : '';
        cb(cache[id]);
      });
  }

  // Tooltip
  var tip = null;
  var hideTimer = null;

  function showTip(target) {
    var id = target.getAttribute('data-ref');
    var section = target.getAttribute('data-section');
    if (!id || !refs[id]) return;
    if (tip) tip.remove();
    clearTimeout(hideTimer);

    tip = document.createElement('div');
    tip.className = 'xref-tip';

    var header = document.createElement('div');
    header.className = 'xref-tip-header';
    header.textContent = refs[id].title;
    tip.appendChild(header);

    var body = document.createElement('div');
    body.className = 'xref-tip-body';
    body.textContent = 'Loading...';
    tip.appendChild(body);

    document.body.appendChild(tip);
    positionTip(target);

    tip.addEventListener('mouseenter', function () {
      clearTimeout(hideTimer);
    });
    tip.addEventListener('mouseleave', function () {
      hideTip();
    });

    fetchPost(id, function (html) {
      body.innerHTML = html;

      // Disable links but keep blue styling
      var links = body.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        links[i].removeAttribute('href');
        links[i].style.cursor = 'default';
      }

      // Scroll to section if specified
      function scrollToSection() {
        if (!section) return;
        var headings = body.querySelectorAll('h1, h2, h3, h4');
        for (var j = 0; j < headings.length; j++) {
          if (headings[j].textContent.indexOf(section + '.') !== -1) {
            body.scrollTop = headings[j].offsetTop - 20;
            break;
          }
        }
      }

      // Fetched HTML is pre-MathJax; typeset the $...$ runs, then scroll
      // once heights have settled
      if (window.MathJax && MathJax.Hub) {
        MathJax.Hub.Queue(['Typeset', MathJax.Hub, body], scrollToSection);
      } else {
        scrollToSection();
      }
    });
  }

  function positionTip(target) {
    var r = target.getBoundingClientRect();
    tip.style.left = Math.min(r.left, window.innerWidth - 470) + 'px';
    tip.style.top = (r.bottom + 4 + window.scrollY) + 'px';
  }

  function hideTip() {
    hideTimer = setTimeout(function () {
      if (tip) { tip.remove(); tip = null; }
    }, 200);
  }

  content.addEventListener('mouseover', function (e) {
    if (e.target.classList.contains('xref')) {
      clearTimeout(hideTimer);
      showTip(e.target);
    }
  });

  content.addEventListener('mouseout', function (e) {
    if (e.target.classList.contains('xref')) hideTip();
  });
  }

  initXrefs();
  document.addEventListener('content:swapped', initXrefs);
})();
