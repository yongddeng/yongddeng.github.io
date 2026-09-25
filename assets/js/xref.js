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

  // Fetch and cache a post's content, shared by the desktop tooltip
  // and the phone peek sheet
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

  // Fill a container with a fetched post, links disabled the way a
  // preview wants, scrolled to the referenced section once MathJax
  // has settled the heights
  function fillPreview(body, html, section) {
    body.innerHTML = html;
    var links = body.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].removeAttribute('href');
      links[i].style.cursor = 'default';
    }
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
    if (window.MathJax && MathJax.Hub) {
      MathJax.Hub.Queue(['Typeset', MathJax.Hub, body], scrollToSection);
    } else {
      scrollToSection();
    }
  }

  // Re-runnable: SPA navigation (tag-filter.js loadPost) swaps in fresh
  // post content, so this must be callable again, not run-once. Walks
  // every open post window; each is set up exactly once.
  function initXrefs() {
    document.querySelectorAll('.post_content').forEach(function (c) {
      if (!c.dataset.xref) { c.dataset.xref = '1'; setupContent(c); }
    });
  }

  function setupContent(content) {

    // Phones get links: a 350px hover card has nowhere to sit and nothing
    // to trigger it
    var isPhone = phone();

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
          var ref = document.createElement(isPhone ? 'a' : 'span');
          if (isPhone) ref.href = refs[m[1]].url;
          ref.className = 'xref';
          ref.textContent = '§' + m[1];
          ref.setAttribute('data-ref', m[1]);
          if (m[2]) ref.setAttribute('data-section', m[2]);
          frag.appendChild(ref);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      });
      node.parentNode.replaceChild(frag, node);
    }
    });

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
      fillPreview(body, html, section);
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

  if (!isPhone) {
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
  }

  // Phone peek: tapping a §-ref raises the referenced post as a 70%
  // sheet over the live post instead of navigating away. The <a> href
  // stays as the no-JS fallback.
  var peek = null;

  function buildPeek() {
    peek = makeSheet('xref-peek');
    // post typography for the previewed page, marked so initXrefs
    // never wraps the preview's own §-references
    peek.body.classList.add('post_content');
    peek.body.dataset.xref = '1';
  }

  function openPeek(ref) {
    var id = ref.getAttribute('data-ref');
    var section = ref.getAttribute('data-section');
    if (!id || !refs[id]) return;
    if (!peek) buildPeek();
    peek.title.textContent = '§ ' + refs[id].title + (section ? ' — ' + section : '');
    peek.root.dataset.url = refs[id].url;
    peek.body.textContent = 'Loading...';
    peek.body.scrollTop = 0;
    peek.root.hidden = false;
    fetchPost(id, function (html) {
      // Ignore a fetch that resolves after the sheet moved on or closed
      if (peek.root.hidden || peek.root.dataset.url !== refs[id].url) return;
      fillPreview(peek.body, html, section);
    });
  }

  document.addEventListener('click', function (e) {
    var ref = e.target.closest('a.xref');
    if (!ref || !phone()) return;
    e.preventDefault();
    openPeek(ref);
  });

  initXrefs();
  document.addEventListener('content:swapped', initXrefs);
})();
