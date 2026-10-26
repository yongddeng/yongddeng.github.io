---
layout: default
title: "302. blocks"
permalink: /20230102/decoder-block
tags: cs300
icon: defragment.png
winclass: wb-win
no_comment: true
---

{%- assign db = site.data.decoder_block -%}
<div class="wb">
<div class="lit-tool">
<div class="wb-menus"></div>
<span class="lit-views"><button type="button" class="lit-btn on" data-view="block">Block</button><button type="button" class="lit-btn" data-view="diff">Diff</button></span>
<span class="wb-see">see also <a href="https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison" title="Sebastian Raschka, The Big LLM Architecture Comparison">Raschka</a> &middot; <a href="https://jalammar.github.io/illustrated-transformer/" title="Jay Alammar, The Illustrated Transformer">Alammar</a></span>
</div>
<div class="wb-drop" hidden></div>
<div class="wb-body">
<div class="wb-left">
<div class="lit-pane wb-tree"></div>
<div class="wb-card"></div>
</div>
<div class="lit-pane wb-right">
<div class="wb-head"><b></b><span></span></div>
<div class="wb-sch"></div>
<div class="wb-legend"></div>
<p class="wb-foot"></p>
</div>
</div>
</div>
<p class="wb-phone">The workbench needs a wide screen.</p>
<script type="application/json">{{ db | jsonify }}</script>
<script src="/assets/js/decoder.js" defer></script>
