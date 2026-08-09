---
layout: default
title: "609. netflix rows"
tags: cs600
icon: video.svg
rows:
  - n: 601
    topic: computer
    link: /20260101/computer
    videos:
      - { id: h9Z4oGN89MU, title: "How do Graphics Cards Work? Exploring GPU Architecture" }
      - { id: kKJxzay85Vk, title: "Computer History: Punch Cards" }
      - { id: 16zrEPOsIcI, title: "How do CPUs Work? The Engineering Behind the Digital World" }
  - n: 602
    topic: program
    link: /20260102/program
    videos:
      - { id: 3PcIJKd1PKU, title: "Python vs C/C++ vs Assembly, side by side" }
      - { id: m8G_S5LwlTo, title: "LLVM IR Tutorial: Phis, GEPs and Other Things (EuroLLVM 2019)" }
      - { id: XJC5WB2Bwrc, title: "Why Some Projects Use Multiple Programming Languages" }
      - { id: yOyaJXpAYZQ, title: "Comparing C to machine language" }
  - n: 603
    topic: operating system
    link: /20260103/operating-system
    videos:
      - { id: E0Q9KnYSVLc, title: "The Making of Linux: The First Open-Source OS" }
      - { id: tc4ROCJYbm0, title: "AT&T Archives: The UNIX Operating System" }
  - n: 604
    topic: concurrency
    link: /20260104/concurrency
    videos:
      - { id: IMceN4_rieo, title: "How Hardware Makes Threads Less of a Nightmare" }
---

# Netflix Rows
---

<style>
.nf-page { --nf-gap: 10px; --nf-card-w: 320px; }
.nf-row { margin: 0 0 26px; }
.nf-row h2 { font-size: 18px; font-weight: 700; margin: 20px 0 8px; }
.nf-row h2 a { color: inherit; text-decoration: none; }
.nf-row h2 a:hover { text-decoration: underline; }
.nf-track-wrap { position: relative; }
.nf-nav {
  position: absolute; bottom: 2px; width: 16px; height: 16px; z-index: 3;
  padding: 0; cursor: pointer; color: #000000; font-size: 9px; line-height: 1;
  background: #c0c0c0;
  border: 2px solid; border-color: #fff8ff #000000 #000000 #fff8ff;
}
.nf-nav:active:not(:disabled) { border-color: #000000 #fff8ff #fff8ff #000000; }
.nf-nav:disabled { color: #7f787f; cursor: default; }
.nf-prev { left: 2px; }
.nf-next { right: 2px; }
.nf-track {
  display: flex; gap: var(--nf-gap);
  overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  padding: 8px;
  background: #fff8ff;
  border: 2px solid;
  border-color: #7f787f #fff8ff #fff8ff #7f787f;
}
.nf-track::-webkit-scrollbar { height: 16px; background: #c0c0c0; }
.nf-track::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.nf-track::-webkit-scrollbar-thumb {
  background: #c0c0c0;
  border: 2px solid;
  border-color: #fff8ff #000000 #000000 #fff8ff;
}
.nf-card {
  flex: 0 0 var(--nf-card-w);
  scroll-snap-align: start;
  background: #bfb8bf;
  border: 2px solid;
  border-color: #fff8ff #000000 #000000 #fff8ff;
  padding: 3px;
}
.nf-card .nf-embed { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; cursor: pointer; }
.nf-card .nf-embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.nf-card .nf-thumb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.nf-card .nf-play {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 46px; height: 32px; background: #cc0000; border-radius: 7px;
}
.nf-card .nf-play::after {
  content: ""; position: absolute; left: 51%; top: 50%; transform: translate(-50%, -50%);
  border-style: solid; border-width: 8px 0 8px 14px; border-color: transparent transparent transparent #fff;
}
.nf-card .nf-embed:hover .nf-play { background: #ec0000; }
.nf-card .nf-label {
  font-size: 12px; padding: 4px 6px 2px; color: #000;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
@media (max-width: 640px) {
  .nf-page { --nf-card-w: 240px; }
}
</style>

<div class="nf-page">
{% for row in page.rows %}
  <div class="nf-row">
    <h2><a href="{{ row.link }}">{{ row.n }} &mdash; {{ row.topic }}</a></h2>
    <div class="nf-track-wrap">
      <button class="nf-nav nf-prev" aria-label="scroll left" disabled>&#9668;</button>
      <button class="nf-nav nf-next" aria-label="scroll right">&#9658;</button>
      <div class="nf-track">
      {% for v in row.videos %}
        <div class="nf-card"><div class="nf-embed" data-id="{{ v.id }}"><img class="nf-thumb" src="https://i.ytimg.com/vi/{{ v.id }}/hqdefault.jpg" alt="" loading="lazy"><span class="nf-play"></span></div><div class="nf-label" title="{{ v.title }}">{{ v.title }}</div></div>
      {% endfor %}
      </div>
    </div>
  </div>
{% endfor %}
</div>

<script>
(function () {
  document.querySelectorAll('.nf-embed').forEach(function (el) {
    el.addEventListener('click', function () {
      var id = el.getAttribute('data-id');
      el.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id +
        '?autoplay=1" title="video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    });
  });

  document.querySelectorAll('.nf-track-wrap').forEach(function (wrap) {
    var track = wrap.querySelector('.nf-track');
    var prev = wrap.querySelector('.nf-prev');
    var next = wrap.querySelector('.nf-next');
    function update() {
      var max = track.scrollWidth - track.clientWidth - 2;
      prev.style.display = next.style.display = max > 0 ? '' : 'none';
      prev.disabled = track.scrollLeft <= 0;
      next.disabled = track.scrollLeft >= max;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -track.clientWidth * 0.8, behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: track.clientWidth * 0.8, behavior: 'smooth' }); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
})();
</script>
