---
layout: default
title: "302. blocks"
tags: cs300
icon: cardfile.png
winclass: wb-win
no_comment: true
---

{%- assign db = site.data.decoder_block -%}
<div class="wb">
<div class="lit-tool">
<button type="button" class="lit-btn lit-arr" data-act="back" title="Back" disabled>&#9668;</button>
<button type="button" class="lit-btn lit-arr" data-act="fwd" title="Forward" disabled>&#9658;</button>
<span class="lit-sep"></span>
<button type="button" class="lit-btn" data-act="prev" title="Earlier model">&lt;&lt;</button>
<button type="button" class="lit-btn" data-act="next" title="Later model">&gt;&gt;</button>
<span class="lit-crumb"></span>
<span class="wb-see">see also <a href="https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison" title="Sebastian Raschka, The Big LLM Architecture Comparison">Raschka</a> &middot; <a href="https://jalammar.github.io/illustrated-transformer/" title="Jay Alammar, The Illustrated Transformer">Alammar</a></span>
</div>
<div class="wb-body">
<div class="wb-left">
<div class="lit-pane wb-tree"></div>
<div class="wb-sheet"><div class="wb-tabs"></div><div class="wb-tabbody"></div></div>
</div>
<div class="lit-pane wb-right">
<div class="wb-head"><b></b><span></span></div>
<div class="wb-sch"></div>
<div class="wb-legend"><i></i>changed from the parent model &middot; tokens enter at the bottom and leave at the top as a distribution</div>
<p class="wb-foot"></p>
</div>
</div>
</div>
<p class="wb-phone">The workbench needs a wide screen.</p>
<script type="application/json">{{ db | jsonify }}</script>
<script src="/assets/js/decoder.js"></script>
