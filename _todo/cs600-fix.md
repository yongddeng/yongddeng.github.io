# cs600 series fix list

Scores calibrated: 7 = solid, 8 = differentiated, 9 = reference-grade.
Current: 607 (8.5), 602/603/604 (7.5), 601/605 (7), 606 (6), 699 (5.5), 608 (2.5).
Roughly half of 602-605 is invisible (HTML/Liquid comments) — promotion beats new writing.

---

## 604. concurrency (7.5 → 9) — best return

- [ ] Promote comment material into visible text: waiter/restaurant ELI5, pizza-shop 2x2, user/kernel stack trace diagram, C-vs-Python event-loop code, synchronisation-primitives ladder (~400-500 words)
- [ ] §3.2 memory model: expand to ~4 paragraphs with one litmus test (store buffering with actual values), acquire/release semantics
- [ ] §2.1 multiprocessing: +2 paragraphs on IPC mechanics and fork-vs-spawn (CUDA + pickling cost, the DS/MLE pain points)
- [ ] Fill the two `- ...` figure placeholders (§3.2, §3.3)
- [ ] Fix: CGI/mod_python portability inversion; "3.15 converges on free-threaded default" (no PEP commits to this); C# 5.0 "before the rest" (F# 2007 first); Gunicorn "once per core" → per configured worker

## 602. program (7.5 → 8)

- [ ] Write linking/loading subsection: symbol resolution, relocation, GOT/PLT, execve load path (~5 paragraphs)
- [ ] Write a closing paragraph returning to the intent-vs-execution thesis (post currently ends mid-topic on GraalPy)
- [ ] Fix: Info.plist/Resources live under Contents/, not bundle root; Triton is 2019 (Tillet), OSS 2021, MLIR backend ~2022

## 603. operating system (7.5 → 8)

- [ ] §2.2 syscall: +1-2 paragraphs and a §II closer (section ends mid-air)
- [ ] Fill the two `- ...` placeholders (§1.1, §3.1)
- [ ] Add FHS organising principle to §3.3: code (/usr) / config (/etc) / data (/var) split
- [ ] Fix wording: "shares the process's address space and fd" → fd table; "preserve scheduling, IPC, and memory management privileged" ungrammatical; "HFS" abbreviation collides with Apple's HFS

## 606. database (6 → ceiling 9) — separate track, in progress

- [ ] Finish §IV: uncomment and write distribution, LSM trees, NoSQL/NewSQL, vector search (~4 subsections, vector search is the differentiator)
- [ ] Lift front half (§1.1, §2.1) from Wikipedia-level to argued
- [ ] Remove three `- ...` placeholders and the bare pasted URL (line ~384)
- [ ] Fix: t_ctid points to newest version in update chain (text inverts this); HikariCP "~9 connections" dressed as empirical (benchmark was 2048 → 96); 2PL from Eswaran et al. 1976, not "introduced in System R"; USL β forward-reference before definition

## Deferred / lower priority

- 605, 601: at 7; ceiling ~7.5 without new empirical material (traces, measurements) — not worth editing further
- 608: rewrite from outline, treat existing paragraphs as scaffolding (Paxos "first provably correct", DynamoDB-as-AP, MVCC "avoids locks entirely" all wrong)
- All posts: empty `[term]()` links — decide fill vs strip (house convention, left alone)
