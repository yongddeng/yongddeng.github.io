#!/usr/bin/env python3
"""Record sampler.exe's runs (_data/sampler_runs.json): Pythia-1.4B
continuing four prompts by each of generate()'s decoders, Pythia-160M drafting
for it, every step's likeliest tokens kept, so that the program replays the
models rather than imitates them. Each loop is generate()'s own written out
(transformers 5.22): _sample for greedy and sampling, _beam_search, and
_assisted_decoding with the draft (AssistedCandidateGenerator and
_speculative_sampling) or with prompt lookup (PromptLookupCandidateGenerator).
Every pass runs the whole sequence again, with no cache, so that each is the
same computation. --check runs generate() itself on the same models and holds
the record to it: the same tokens, the same passes of each model, the same
warpers. The models come from the Hugging Face Hub, 3.2 GB, the first time:

  uv run --with torch --with transformers python3 _tools/sampler_runs.py
  uv run --with torch --with transformers python3 _tools/sampler_runs.py --check
"""
import json
import math
import os
import sys
import unicodedata

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from transformers.generation.logits_process import (LogitsProcessorList, TemperatureLogitsWarper, TopKLogitsWarper,
                                                    TopPLogitsWarper)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_data", "sampler_runs.json")
TARGET, DRAFT = "EleutherAI/pythia-1.4b-deduped", "EleutherAI/pythia-160m-deduped"
NEW = 40  # max_new_tokens
TOP = 8  # the likeliest kept of each distribution
K = 4  # num_assistant_tokens, held constant
LOOKUP, NGRAM = 10, 2  # prompt_lookup_num_tokens and max_matching_ngram_size, their defaults
BEAMS = 4
# top_k 50 is GenerationConfig's own, and applies whenever do_sample is on
SAMPLING = {"temperature": 0.7, "top_k": 50, "top_p": 0.9}
SEEDS = [1, 2, 3]
EOS = 0
PROMPTS = [
    ("story", "Once upon a time, there was a little girl named Lily. She"),
    ("code", 'def is_prime(n):\n    """Return True if n is a prime number."""\n'),
    ("copy", "def area(width, height):\n    return width * height\n\n\n"
             "# The same function, with type hints\ndef area("),
    ("fact", "The Moon is the only natural satellite of the Earth. It"),
]

torch.set_grad_enabled(False)
DEV = "mps" if torch.backends.mps.is_available() else "cpu"
tok = AutoTokenizer.from_pretrained(TARGET)
target = AutoModelForCausalLM.from_pretrained(TARGET, dtype=torch.float32).to(DEV).eval()
draft = AutoModelForCausalLM.from_pretrained(DRAFT, dtype=torch.float32).to(DEV).eval()
seen = set()
# a probability as the record keeps it, to four figures
fig = lambda x: float(f"{float(x):.4g}")


def rows(model, ids, n=1):
    """The model's logits for the last n positions of ids"""
    return model(torch.tensor([ids], device=DEV)).logits[0, -n:].float().cpu()


def top(p):
    v, i = p.topk(TOP)
    seen.update(i.tolist())
    return [[int(a), fig(b)] for a, b in zip(i, v)]


def warp(logits, temperature, top_k, top_p):
    """The warpers in generate()'s order: TemperatureLogitsWarper, then
    TopKLogitsWarper (ties with the k-th kept), then TopPLogitsWarper"""
    s = logits / temperature
    s = s.masked_fill(s < s.topk(top_k).values[-1], -math.inf)
    order = s.argsort()  # ascending, as TopPLogitsWarper sorts
    drop = s[order].softmax(-1).cumsum(-1) <= 1 - top_p
    drop[-1] = False
    return s.masked_fill(torch.zeros_like(drop).scatter(0, order, drop), -math.inf)


def left(w):
    """How many tokens the warpers left to draw from"""
    return int((w > 0).sum())


def emitted(t, p, origin):
    seen.add(int(t))
    return {"t": int(t), "p": fig(p[t]), "from": origin}


def greedy(ids):
    steps = []
    for _ in range(NEW):
        p = rows(target, ids)[0].softmax(-1)
        t = int(p.argmax())
        steps.append({**emitted(t, p, "target"), "top": top(p)})
        ids = ids + [t]
    return {"steps": steps, "target": NEW, "draft": 0}


def sample(ids, seed):
    g = torch.Generator().manual_seed(seed)
    steps = []
    for _ in range(NEW):
        logits = rows(target, ids)[0]
        p, w = logits.softmax(-1), warp(logits, **SAMPLING).softmax(-1)
        t = int(torch.multinomial(w, 1, generator=g))
        steps.append({**emitted(t, p, "target"), "top": top(p), "wtop": top(w), "left": left(w)})
        ids = ids + [t]
    return {"seed": seed, "steps": steps, "target": NEW, "draft": 0}


def beam(ids):
    """_beam_search with no sampling and length_penalty 1.0: each step the
    2·num_beams best next tokens of every running beam, by the sum of log
    probabilities, the best num_beams of them that are not EOS running on and
    the rest pruned"""
    run, steps = [(ids, 0.0)], []
    for _ in range(NEW):
        logp = target(torch.tensor([s for s, _ in run], device=DEV)).logits[:, -1].float().cpu().log_softmax(-1)
        best = (logp + torch.tensor([score for _, score in run])[:, None]).flatten().topk(2 * BEAMS)
        live = []
        for score, flat in zip(best.values.tolist(), best.indices.tolist()):
            b, t = divmod(flat, logp.shape[1])
            if t != EOS:
                seen.add(t)
                live.append({"parent": b, "t": t, "score": fig(score), "p": fig(math.exp(float(logp[b, t])))})
        steps.append({"tops": [top(lp.exp()) for lp in logp], "beams": live[:BEAMS], "pruned": live[BEAMS:]})
        run = [(run[x["parent"]][0] + [x["t"]], x["score"]) for x in live[:BEAMS]]
    return {"steps": steps, "target": NEW, "draft": 0}


def speculate(ids, seed=None):
    """_assisted_decoding with the draft: it proposes K tokens, a pass each,
    or as many as leave one for the target to make
    (AssistedCandidateGenerator._calculate_new_tokens: none with one left);
    the target scores them all in one pass. Greedy keeps the draft's tokens
    while each is the target's likeliest too, then puts its own; sampled,
    _speculative_sampling keeps each with probability min(1, p/q) and, at the
    first refusal, draws from max(0, p − q) renormalised. A round that keeps
    every proposal ends with the target's own token, the bonus"""
    g = torch.Generator().manual_seed(seed) if seed is not None else None
    pick = (lambda d: int(d.argmax())) if g is None else (lambda d: int(torch.multinomial(d, 1, generator=g)))
    out, rounds, passes = [], [], 0
    while len(out) < NEW:
        cur = ids + [e["t"] for e in out]
        props, qs = [], []
        for _ in range(min(K, NEW - len(out) - 1)):
            logits = rows(draft, cur + [x["t"] for x in props])[0]
            q = logits.softmax(-1) if g is None else warp(logits, **SAMPLING).softmax(-1)
            t = pick(q)
            seen.add(t)
            props.append({"t": t, "q": fig(q[t]), "qtop": top(q)})
            qs.append(q)
        n = len(props)
        logits = rows(target, cur + [x["t"] for x in props], n + 1)
        passes += 1
        ps = [r.softmax(-1) for r in logits]
        ws = ps if g is None else [warp(r, **SAMPLING).softmax(-1) for r in logits]
        checks, emit = [], []
        for i, x in enumerate(props):
            w = ws[i]
            if g is None:
                ok = int(w.argmax()) == x["t"]
                checks.append({"ok": ok, "pt": fig(w[x["t"]]), "top": top(ps[i])})
            else:
                r = float(torch.rand(1, generator=g))
                ok = r <= float(w[x["t"]]) / float(qs[i][x["t"]])
                checks.append({"ok": ok, "r": fig(r), "pt": fig(w[x["t"]]), "top": top(ps[i]), "wtop": top(w)})
            if ok:
                emit.append(emitted(x["t"], ps[i], "draft"))
                continue
            if g is None:
                emit.append(emitted(int(w.argmax()), ps[i], "target"))
            else:
                res = (w - qs[i]).clamp(min=0)
                res = res / res.sum()
                checks[-1]["res"] = top(res)
                emit.append(emitted(int(torch.multinomial(res, 1, generator=g)), ps[i], "residual"))
            break
        else:
            w = ws[n]
            last = {**emitted(pick(w), ps[n], "bonus" if n else "target"), "top": top(ps[n])}
            if g is not None:
                last.update(wtop=top(w), left=left(w))
            emit.append(last)
        out += emit
        rounds.append({"draft": props, "checks": checks, "emit": emit})
    return {"seed": seed, "rounds": rounds, "target": passes, "draft": sum(len(r["draft"]) for r in rounds)}


def candidates(ids, room):
    """PromptLookupCandidateGenerator.get_candidates: the last n-gram, n from
    max_matching_ngram_size down to 1, its first earlier match, and up to
    num_output_tokens that followed it; nothing with one token left"""
    if room > 1:
        for n in range(min(NGRAM, len(ids) - 1), 0, -1):
            for i in range(len(ids) - n):
                if ids[i:i + n] == ids[-n:]:
                    return ids[i + n:i + n + LOOKUP], i, n
    return [], None, 0


def lookup(ids):
    """_assisted_decoding with prompt lookup's candidates, checked as the
    draft's are, greedy; what the round makes past max_new_tokens is cut"""
    out, rounds = [], []
    while len(out) < NEW:
        cur = ids + [e["t"] for e in out]
        cand, at, n = candidates(cur, NEW - len(out))
        ps = [r.softmax(-1) for r in rows(target, cur + cand, len(cand) + 1)]
        emit = []
        for i, c in enumerate(cand):
            pick = int(ps[i].argmax())
            emit.append(emitted(pick, ps[i], "copy" if pick == c else "target"))
            if pick != c:
                break
        else:
            emit.append(emitted(int(ps[len(cand)].argmax()), ps[len(cand)], "bonus" if cand else "target"))
        emit = emit[:NEW - len(out)]
        out += emit
        seen.update(cand)
        rounds.append({"cand": cand, "at": at, "n": n, "emit": emit, "top": [top(p) for p in ps[:len(emit)]]})
    return {"rounds": rounds, "target": len(rounds), "draft": 0}


def bytes_to_unicode():
    """GPT-2's byte-level alphabet: each byte as the character the
    vocabulary writes it with"""
    bs = list(range(ord("!"), ord("~") + 1)) + list(range(ord("¡"), ord("¬") + 1)) + list(range(ord("®"), ord("ÿ") + 1))
    cs, n = bs[:], 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return dict(zip(bs, map(chr, cs)))


BYTE = {c: b for b, c in bytes_to_unicode().items()}


def text(i):
    """A token's text. A token that holds part of a character, which decode()
    would show as U+FFFD, has that part written as its bytes, <0xE2><0x89>,
    and a control character but a tab or a newline as its code, <U+0092>,
    which YAML, as Jekyll reads _data, would refuse; the tokens added as plain
    text (Pythia's runs of spaces) decode as they are"""
    piece = tok.convert_ids_to_tokens(i)
    if any(c not in BYTE for c in piece):
        return tok.decode([i])
    raw, out, at = bytes(BYTE[c] for c in piece), "", 0
    while at < len(raw):
        for n in (4, 3, 2, 1):
            try:
                out += raw[at:at + n].decode("utf-8")
                at += n
                break
            except UnicodeDecodeError:
                pass
        else:
            out += f"<0x{raw[at]:02X}>"
            at += 1
    control = lambda c: unicodedata.category(c) == "Cc" and c not in "\t\n"
    return "".join(f"<U+{ord(c):04X}>" if control(c) else c for c in out)


def record():
    settings = {"max_new_tokens": NEW, "num_assistant_tokens": K, "prompt_lookup_num_tokens": LOOKUP,
                "max_matching_ngram_size": NGRAM, "num_beams": BEAMS, **SAMPLING, "seeds": SEEDS, "top": TOP}
    data = {"models": {}, "settings": settings, "prompts": []}
    for key, name, model in (("target", TARGET, target), ("draft", DRAFT, draft)):
        c = model.config
        data["models"][key] = {"name": name, "params": sum(p.numel() for p in model.parameters()),
                               "embed_in": c.vocab_size * c.hidden_size}
    for key, prompt in PROMPTS:
        ids = tok(prompt).input_ids
        seen.update(ids)
        data["prompts"].append({"key": key, "text": prompt, "ids": ids, "greedy": greedy(ids), "beam": beam(ids),
                                "sample": [sample(ids, s) for s in SEEDS], "speculative": speculate(ids),
                                "speculative_sample": [speculate(ids, s) for s in SEEDS], "lookup": lookup(ids)})
        print(key, file=sys.stderr)
    data["vocab"] = {i: text(i) for i in sorted(seen)}
    with open(OUT, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(OUT, os.path.getsize(OUT), "bytes")


def check():
    """The record against generate() on the same models: greedy, beam search,
    the draft and prompt lookup give the same tokens, the draft and prompt
    lookup each model's same passes (counted by a hook on every forward), and
    the warpers transformers' own probabilities"""
    with open(OUT) as f:
        data, bad = json.load(f), 0
    calls = {"target": 0, "draft": 0}
    target.register_forward_hook(lambda *_: calls.__setitem__("target", calls["target"] + 1))
    draft.register_forward_hook(lambda *_: calls.__setitem__("draft", calls["draft"] + 1))
    # AssistedCandidateGenerator reads these from the draft's own generation
    # config; passed to generate(), they never reach it
    draft.generation_config.num_assistant_tokens = K
    draft.generation_config.num_assistant_tokens_schedule = "constant"
    draft.generation_config.assistant_confidence_threshold = 0.0

    def same(what, ok):
        nonlocal bad
        bad += not ok
        print("  ok  " if ok else "  DIFF", what)

    def generate(ids, **kw):
        calls.update(target=0, draft=0)
        x = torch.tensor([ids], device=DEV)
        out = target.generate(x, attention_mask=torch.ones_like(x), max_new_tokens=NEW, min_new_tokens=NEW,
                              do_sample=False, pad_token_id=EOS, **kw)
        return out[0, len(ids):].tolist()

    tokens = lambda run: [e["t"] for r in run["rounds"] for e in r["emit"]]
    for run in data["prompts"]:
        ids, greedy_ids = run["ids"], [s["t"] for s in run["greedy"]["steps"]]
        print(run["key"])
        same("greedy", greedy_ids == generate(ids))
        best, b = [], 0
        for step in reversed(run["beam"]["steps"]):
            best.append(step["beams"][b]["t"])
            b = step["beams"][b]["parent"]
        same("beam search", best[::-1] == generate(ids, num_beams=BEAMS, early_stopping=False, length_penalty=1.0))
        for key, kw in (("speculative", {"assistant_model": draft}), ("lookup", {"prompt_lookup_num_tokens": LOOKUP,
                                                                                 "max_matching_ngram_size": NGRAM})):
            same(f"{key}, greedy's tokens", tokens(run[key]) == greedy_ids)
            same(f"{key}, generate()'s tokens", tokens(run[key]) == generate(ids, **kw))
            passes = [run[key]["target"], run[key]["draft"]]
            same(f"{key}, passes of each model", passes == [calls["target"], calls["draft"]])
        logits = rows(target, ids)[0]
        warpers = LogitsProcessorList([TemperatureLogitsWarper(SAMPLING["temperature"]),
                                       TopKLogitsWarper(SAMPLING["top_k"]), TopPLogitsWarper(SAMPLING["top_p"])])
        theirs = warpers(torch.tensor([ids]), logits[None].clone())[0].softmax(-1)
        same("the warpers", float((warp(logits, **SAMPLING).softmax(-1) - theirs).abs().max()) < 1e-6)
    print("all match" if not bad else f"{bad} differ")


if __name__ == "__main__":
    check() if sys.argv[1:] == ["--check"] else record()
