// scheduler.exe's engine, shared by scheduler.exe (assets/js/scheduler.js) and
// device.exe's serve.py tab (assets/js/device.js): chat requests to
// Llama 3.1 70B over two H100s, a small rewrite of vLLM's v1 scheduler as it
// was in vLLM 0.11, each step timed by the roofline. ServeEngine.simulate(at)
// serves a run to its end and keeps it step by step; at is HOME with any
// setting changed. Nothing here draws: the colours at the end are the two
// programs' shared words for a request, its colour, two tones in turn, and
// which of its states are brief. Declared with var, and kept if already there:
// the desktop runs a window's scripts each time it opens one, and both
// programs load this.
var ServeEngine = ServeEngine || (function () {

	// ---- the hardware, and what a pass costs ----
	// Llama 3.1 70B from its config.json, its context 128k tokens, more than
	// the cache holds, so max_model_len is set lower; tensor parallel over two H100s from
	// NVIDIA's data sheet: the bandwidth and dense BF16 FLOP/s; the memory as
	// CUDA reports it, 79.19 GiB, of which vLLM's gpu_memory_utilization
	// takes its share (nvidia-smi's 81,559 MiB is more). The weights in BF16
	const MODEL = { params: 70.554e9, embed: 128256 * 8192, layers: 80, d: 8192, kvHeads: 8, headDim: 128 };
	const GPU = { bw: 3.35e12, peak: 989.4e12, mem: 79.19 * 2 ** 30 };
	const GPUS = 2, W_BYTES = 2;
	// the bytes of the weights each GPU holds, its half of the model's
	const WEIGHTS = MODEL.params * W_BYTES / GPUS;
	const BLOCK = 16; // vLLM's block_size: tokens a block of the cache
	const UTIL = 0.92; // vLLM's gpu_memory_utilization
	const WAIT = 1; // seconds a static batch waits to fill
	// max_model_len: the longest a request's prompt and answer may run to. The
	// model's 131,072 would need 20 GiB of cache a GPU for one request, and
	// vLLM won't start without room for one; 16,384 is also what prefill first
	// needs, its max_num_batched_tokens being at least max_model_len
	const MAX_LEN = 16384;
	// max_num_batched_tokens, the most tokens a step takes: vLLM's default for
	// its API server on a GPU of 70 GiB or more. Prefill first takes a prompt
	// whole, so there it is max_model_len
	const BUDGET = 8192;
	// bytes a token's keys and values take, at kv bytes a value
	const kvToken = kv => 2 * MODEL.layers * MODEL.kvHeads * MODEL.headDim * kv;
	// Blocks of the cache a GPU holds after its share of the weights, the same
	// count on each GPU of the pair
	const numBlocks = kv => Math.floor((GPU.mem * UTIL - WEIGHTS) / (BLOCK * kvToken(kv) / GPUS));
	// One pass over a batch of items { n, ctx }: n new tokens of a sequence
	// after ctx already cached. It reads the weights once, all but the
	// embedding table's, and each sequence's cache, and does 2 FLOPs a weight
	// a token, the LM head's only for each sequence's last token, where its
	// logits are taken, and 4d a layer for each token a token attends to; its
	// time is the longer of the two at the roofline
	function cost(kv, items) {
		let tokens = 0, cached = 0, attended = 0;
		for (const { n, ctx } of items) {
			tokens += n;
			cached += ctx + n;
			attended += n * ctx + n * (n + 1) / 2;
		}
		// the LM head, untied, the embedding table's shape
		const weights = MODEL.params - MODEL.embed, head = MODEL.embed;
		const weightBytes = weights * W_BYTES, kvBytes = cached * kvToken(kv);
		const matmul = 2 * (weights - head) * tokens + 2 * head * items.length,
			attention = 4 * attended * MODEL.layers * MODEL.d;
		const memory = (weightBytes + kvBytes) / (GPU.bw * GPUS), compute = (matmul + attention) / (GPU.peak * GPUS);
		return { tokens, weightBytes, kvBytes, matmul, attention, memory, compute,
			time: Math.max(memory, compute), bound: memory >= compute ? 'memory' : 'compute' };
	}

	// ---- the workload ----
	// Chat lengths, log-normal about a median: [median, σ, least, most]
	const PROMPT = [600, 0.8, 32, 6144], OUTPUT = [250, 0.7, 16, 2048];
	// Mulberry32
	function rng(seed) {
		let a = seed >>> 0;
		return function () {
			a = (a + 0x6d2b79f5) >>> 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}
	// count requests arriving as a Poisson process of rate a second, each
	// prompt led by the same system prompt of system tokens, each answer cut
	// at max_tokens, cap
	function requests({ rate, count, seed, system, cap }) {
		const r = rng(seed);
		const normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
		const len = ([median, sigma, lo, hi]) => Math.round(Math.min(hi,
			Math.max(lo, median * Math.exp(sigma * normal()))));
		let t = 0;
		return Array.from({ length: count }, (_, id) => {
			t += -Math.log(1 - r()) / rate;
			return { id, arrival: t, prompt: system + len(PROMPT), output: Math.min(cap, len(OUTPUT)), system };
		});
	}

	// ---- the engine ----
	// The settings as they apply: a static batch came before paging, so its
	// cache is contiguous, and prefix caching keys only a paged cache's blocks
	function effective(a) {
		const alloc = a.sched === 'static' ? 'contiguous' : a.alloc;
		return { ...a, alloc, prefix: a.prefix && alloc === 'paged' };
	}
	// What key a block carries, for prefix caching: none, the system prompt's
	// (shared by every request that starts with it), or a request's own
	const KEY = { none: 0, system: 1, own: 2 };
	// Serves list on a cache of opt.blocks blocks, at kv bytes a value, a
	// step at a time, its settings as effective() gives them. opt:
	//   sched   'chunked': vLLM's v1 scheduler, as of vLLM 0.11 (newer ones
	//           admit a request only when its whole prompt fits, and schedule
	//           a step while the last runs). There is no prefill or decode
	//           phase; each step gives each running request, then each waiting
	//           one, tokens towards catching up with its sequence, within a
	//           budget, so prompts go through in chunks beside the decodes
	//           'prefill': vLLM v0 with chunked prefill off, its default for a
	//           context under 32K (v0 went in 0.11). A step takes whole prompts while
	//           any wait and fit, and the decodes stop until they are done
	//           'static': a batch at a time. It starts when the GPU is free,
	//           prompts padded to the longest, and ends with its longest
	//           answer, each row set aside for the longest prompt and the
	//           most tokens, as FasterTransformer's batch tensor is
	//   alloc   'paged': blocks on demand, from anywhere (PagedAttention)
	//           'contiguous': one run of blocks a request, kept for its prompt
	//           and its most tokens, as servers before vLLM reserved
	//   budget  max_num_batched_tokens; seqs, max_num_seqs, the most requests
	//           a step runs, a static batch's size too; reserve, the most
	//           tokens a request may write
	//   prefix  prefix caching: a full block is kept, keyed by the tokens up
	//           to its end, after its requests finish, for the next to reuse
	//   trace   keep every change to a block in S.trace, for a picture of
	//           the cache, for scheduler.exe's map (it changes nothing served)
	function engine(kv, list, opt) {
		const N = opt.blocks;
		const owner = new Int32Array(N).fill(-1), ref = new Int32Array(N), key = new Array(N).fill(null);
		// each block's place in its owner's sequence, its logical block
		const slot = new Int32Array(N);
		const cache = new Map();
		// the free blocks, the longest free first: a list linked through
		// next and prev, N the sentinel, so a cache hit takes one from the
		// middle. vLLM keeps block 0 as its null block, never a request's, so a
		// paged cache's list starts at 1; a contiguous one, before vLLM, has none
		const first = opt.alloc === 'contiguous' ? 0 : 1;
		const next = new Int32Array(N + 1), prev = new Int32Array(N + 1);
		for (let b = first; b < N; b++) {
			next[b] = b + 1;
			prev[b + 1] = b;
		}
		next[N] = first;
		prev[first] = N;
		// the longest a request may run to: vLLM's max_model_len, no more than
		// the blocks a request can be given
		const maxLen = Math.min(MAX_LEN, (N - first) * BLOCK);
		// The cache's counts: free, the free blocks, those still cached among
		// them; cached, those; shared, the system prompt's blocks in use, each
		// once however many share it. A request's: shared, its blocks that are
		// the system prompt's; hit, the tokens of its prompt it found cached
		// when first let in, null till then; batch, its static batch's index
		const S = {
			N, usable: N - first, nullBlock: first ? 0 : -1, maxLen, t: 0, free: N - first, cached: 0, shared: 0,
			future: list.map(r => Object.assign({}, r, {
				computed: 0, generated: 0, blocks: [], shared: 0, status: 'future', times: [],
				segs: [], preempts: 0, hit: null, first: null, capped: false, batch: -1,
			})),
			waiting: [], running: [], batch: null, batches: [],
		};
		S.reqs = S.future.slice();
		// the system prompt's keys, as blockKey gives them, start with an s
		const isSystem = k => k !== null && k[0] === 's';
		// A block as it is now: [block, owner, ref, its KEY, slot]; and the
		// whole cache so, for a keyframe
		S.keyOf = b => key[b] === null ? KEY.none : isSystem(key[b]) ? KEY.system : KEY.own;
		S.trace = opt.trace ? [] : null;
		const mark = b => {
			if (S.trace) S.trace.push([b, owner[b], ref[b], S.keyOf(b), slot[b]]);
		};
		S.snapshot = () => {
			const kind = new Uint8Array(N);
			for (let b = 0; b < N; b++) kind[b] = S.keyOf(b);
			return { owner: Int16Array.from(owner), ref: Uint8Array.from(ref), kind, slot: Int16Array.from(slot) };
		};
		const tokens = r => r.prompt + r.generated;
		const blockKey = (r, i) => i < Math.floor(r.system / BLOCK) ? 's' + i : r.id + ':' + i;

		function unlink(b) {
			next[prev[b]] = next[b];
			prev[next[b]] = prev[b];
			S.free--;
		}
		function append(b) {
			prev[b] = prev[N];
			next[b] = N;
			next[prev[N]] = b;
			prev[N] = b;
			S.free++;
		}
		// k fresh blocks for r from the head of the free list, evicting what
		// they cached
		function grow(r, k) {
			for (let i = 0; i < k; i++) {
				const b = next[N];
				unlink(b);
				if (key[b] !== null) {
					cache.delete(key[b]);
					key[b] = null;
					S.cached--;
				}
				ref[b] = 1;
				owner[b] = r.id;
				slot[b] = r.blocks.length;
				r.blocks.push(b);
				mark(b);
			}
		}
		// r's blocks back, the last first so the tail of a sequence is evicted
		// before its head; cached ones keep their key
		function release(r) {
			for (let i = r.blocks.length - 1; i >= 0; i--) {
				const b = r.blocks[i];
				if (--ref[b] > 0) {
					mark(b);
					continue;
				}
				owner[b] = -1;
				if (opt.alloc === 'contiguous') S.free++;
				else {
					append(b);
					if (key[b] !== null) S.cached++;
					if (isSystem(key[b])) S.shared--;
				}
				mark(b);
			}
			r.blocks = [];
			r.shared = 0;
		}
		// The cached blocks r's tokens start with, leaving one at least to compute
		function hits(r) {
			const out = [];
			if (!opt.prefix) return out;
			for (let i = 0; (i + 1) * BLOCK < tokens(r); i++) {
				const b = cache.get(blockKey(r, i));
				if (b === undefined) break;
				out.push(b);
			}
			return out;
		}
		// The first run of len free blocks, or -1
		function firstRun(len) {
			for (let b = 0, start = 0; b < N; b++) {
				if (owner[b] !== -1) start = b + 1;
				else if (b - start + 1 >= len) return start;
			}
			return -1;
		}
		// the longest run of free blocks
		function longestRun() {
			let best = 0, run = 0;
			for (let b = 0; b < N; b++) {
				run = owner[b] === -1 ? run + 1 : 0;
				best = Math.max(best, run);
			}
			return best;
		}
		// the blocks a run sets aside for a prompt of prompt tokens and the most tokens
		const runOf = prompt => Math.ceil((prompt + opt.reserve) / BLOCK);
		// The free blocks the head of the queue can't use: all of them, when
		// there are enough for its run but no run is that long. External
		// fragmentation; a static batch frees its blocks all at once
		S.stranded = () => {
			if (opt.alloc !== 'contiguous' || opt.sched === 'static' || !S.waiting.length) return 0;
			const len = runOf(S.waiting[0].prompt);
			return S.free >= len && firstRun(len) < 0 ? S.free : 0;
		};

		// Room for n more tokens of running r; false when the cache is full
		function allocate(r, n) {
			if (opt.alloc === 'contiguous') return true;
			const need = Math.ceil((r.computed + n) / BLOCK) - r.blocks.length;
			if (need <= 0) return true;
			if (S.free < need) return false;
			grow(r, need);
			return true;
		}
		// One run of len blocks for r; false when no run is that long
		function reserve(r, len) {
			const start = firstRun(len);
			if (start < 0) return false;
			for (let b = start; b < start + len; b++) {
				owner[b] = r.id;
				ref[b] = 1;
				slot[b] = r.blocks.length;
				r.blocks.push(b);
				mark(b);
			}
			S.free -= len;
			return true;
		}
		// Why admission stopped this step, as the planner found it: for the
		// head of the queue, the scheduler's own reason
		let stop = null;
		// Takes waiting r in with up to budget tokens of its prompt, all of
		// it unless chunking; the tokens it took, or 0 if it doesn't fit, and
		// why not in stop: the step's budget, or the cache, under paging the
		// blocks its first chunk needs against those free less the cached ones
		// it would take back, contiguous a run as long as its prompt and its
		// most tokens
		function admit(r, budget, whole) {
			if (opt.alloc === 'contiguous') {
				const n = Math.min(tokens(r), budget);
				if (whole && n < tokens(r)) return refuse('budget', { tokens: tokens(r), left: budget });
				if (!reserve(r, runOf(r.prompt))) {
					return refuse('cache', { run: runOf(r.prompt), free: S.free, longest: longestRun() });
				}
				return n;
			}
			const got = hits(r), computed = got.length * BLOCK;
			const left = tokens(r) - computed, n = Math.min(left, budget);
			if (n <= 0 || (whole && n < left)) return refuse('budget', { tokens: left, left: budget });
			const need = Math.ceil((computed + n) / BLOCK) - got.length,
				room = S.free - got.filter(b => ref[b] === 0).length;
			if (room < need) return refuse('cache', { need, room, hits: got.length, chunk: n, tokens: left });
			for (const b of got) {
				if (ref[b]++ === 0) {
					unlink(b);
					owner[b] = r.id;
					S.cached--;
					if (isSystem(key[b])) S.shared++;
				}
				slot[b] = r.blocks.length;
				r.blocks.push(b);
				mark(b);
			}
			r.computed = computed;
			// the hits the system prompt's blocks first, then any of its own
			// kept from before it gave way
			r.shared = Math.min(got.length, Math.floor(r.system / BLOCK));
			if (r.hit === null) r.hit = computed;
			grow(r, need);
			return n;
		}
		function refuse(reason, facts) {
			stop = { reason, ...facts };
			return 0;
		}
		function preempt(r, events) {
			release(r);
			events.push({ kind: 'preempt', r });
			r.computed = 0;
			r.status = 'waiting';
			r.preempts++;
			S.waiting.unshift(r);
		}
		// Room for n more tokens of running r, the newest running giving way
		// till there is, FCFS; false when r itself gave way
		function makeRoom(r, n, events) {
			while (!allocate(r, n)) {
				const victim = S.running.pop();
				preempt(victim, events);
				if (victim === r) return false;
			}
			return true;
		}
		function join(r, events) {
			S.waiting.shift();
			S.running.push(r);
			r.status = 'running';
			events.push({ kind: 'admit', r });
		}

		// ---- a step's plan: [{ r, n, ctx }] ----
		function planChunked(events) {
			const plan = [], before = events.length;
			let budget = opt.budget;
			// the running first, in order, a token each or the next chunk of a prompt
			for (let i = 0; i < S.running.length && budget > 0; i++) {
				const r = S.running[i], n = Math.min(tokens(r) - r.computed, budget);
				if (!makeRoom(r, n, events)) break;
				plan.push({ r, n, ctx: r.computed });
				budget -= n;
			}
			// then the waiting, while the budget and the cache last, unless
			// this step preempted someone, in vLLM's order of reasons
			const preempted = events.length > before;
			while (!preempted && S.waiting.length && budget > 0 && S.running.length < opt.seqs) {
				const r = S.waiting[0], n = admit(r, budget, false);
				if (!n) break;
				join(r, events);
				plan.push({ r, n, ctx: r.computed });
				budget -= n;
			}
			if (S.waiting.length && !stop) {
				stop = preempted ? { reason: 'preempted' }
					: budget <= 0 ? { reason: 'budget', left: 0 } : { reason: 'seqs' };
			}
			return plan;
		}
		function planPrefill(events) {
			const plan = [];
			let budget = opt.budget;
			while (S.waiting.length && S.running.length < opt.seqs) {
				const r = S.waiting[0], n = admit(r, budget, true);
				if (!n) break;
				join(r, events);
				plan.push({ r, n, ctx: r.computed });
				budget -= n;
			}
			if (S.waiting.length && !stop) stop = { reason: 'seqs' };
			if (plan.length) return plan;
			// no prompt joined, so the decodes run, the newest giving way
			// should their tokens need blocks; why no prompt joined kept, its
			// request with it, as the preempted go to the head of the queue
			const refused = S.waiting.length ? { id: S.waiting[0].id, ...stop } : null, before = events.length;
			for (let i = 0; i < S.running.length; i++) {
				const r = S.running[i];
				if (!makeRoom(r, 1, events)) break;
				plan.push({ r, n: 1, ctx: r.computed });
			}
			if (events.length > before) stop = { reason: 'preempted', refused };
			return plan;
		}
		// A static batch: its prompts padded to the longest and its sequences
		// all kept till the longest answer ends, every row a run of blocks set
		// aside for the longest prompt and the most tokens
		function planStatic(events) {
			// those not in the batch wait for it to end
			stop = { reason: 'batch' };
			if (!S.batch) {
				// the oldest waiting, as many as fit at the longest prompt among them
				const rows = [];
				let len = 0;
				for (const r of S.waiting) {
					const longest = Math.max(len, r.prompt);
					if (rows.length === opt.seqs || (rows.length + 1) * runOf(longest) > S.free) break;
					rows.push(r);
					len = longest;
				}
				// a batch with room to spare waits to fill, a second at most, while more are coming
				if (rows.length === S.waiting.length && rows.length < opt.seqs
					&& S.future.length && S.t < S.waiting[0].arrival + WAIT) {
					return [];
				}
				if (!rows.length) return [];
				// the batch as the run keeps it, and as it runs, k its tokens so far
				const batch = { len, longest: Math.max(...rows.map(r => r.output)), rows: rows.length };
				S.batch = { ...batch, id: S.batches.length, k: 0 };
				S.batches.push(batch);
				for (const r of rows) {
					reserve(r, runOf(len));
					join(r, events);
					r.batch = S.batch.id;
				}
				return rows.map(r => ({ r, n: len, ctx: 0 }));
			}
			const b = S.batch;
			return S.running.map(r => ({ r, n: 1, ctx: b.len + b.k - 1 }));
		}

		// Extends r's last segment of kind, or starts one
		function seg(r, kind, t0, t1) {
			const s = r.segs[r.segs.length - 1];
			if (s && s.kind === kind && Math.abs(s.t1 - t0) < 1e-12) s.t1 = t1;
			else r.segs.push({ kind, t0, t1 });
		}
		// r's next token, as the step ends; its last finishes it, its blocks
		// kept till the next step begins
		function emit(r, events) {
			r.generated++;
			r.times.push(S.t);
			if (r.first === null) r.first = S.t;
			if (r.generated < r.output) return;
			r.status = 'done';
			events.push({ kind: 'finish', r });
		}
		// The requests come by now join the queue. Paged, as vLLM: a prompt of
		// max_model_len tokens or more is rejected, and an answer cut at
		// max_model_len, its max_tokens clamped. Contiguous, as before vLLM: a
		// request's prompt and max_tokens are set aside whole, so one longer
		// than every block can't be taken
		function arrive() {
			while (S.future.length && S.future[0].arrival <= S.t) {
				const r = S.future.shift();
				if (opt.alloc === 'contiguous' ? runOf(r.prompt) > N : r.prompt >= maxLen) {
					r.status = 'refused';
					seg(r, 'refused', r.arrival, r.arrival);
					continue;
				}
				if (opt.alloc !== 'contiguous' && r.prompt + r.output > maxLen) {
					r.output = maxLen - r.prompt;
					r.capped = true;
				}
				r.status = 'waiting';
				S.waiting.push(r);
				seg(r, 'wait', r.arrival, S.t);
			}
		}
		// The requests the last step finished leave, their blocks given back
		// as their users have their last tokens; a static batch's all at once,
		// when its longest answer is out. Whether any left. Each step begins
		// with it; simulate calls it as a step ends, to keep the cache as it
		// stands till the next, which then finds no one to let go
		S.leave = function () {
			if (S.batch) {
				if (S.batch.k < S.batch.longest) return false;
				S.running.forEach(release);
				S.batch = null;
				S.running = [];
				return true;
			}
			if (!S.running.some(r => r.status === 'done')) return false;
			for (const r of S.running) if (r.status === 'done') release(r);
			S.running = S.running.filter(r => r.status === 'running');
			return true;
		};

		// One step: those finished leave, those arrived join the queue, the
		// plan runs as one pass, and every request it touched moves on.
		// Returns the step's record: ids, the running requests as the pass
		// runs them, oldest first; a static batch's index and its tokens so
		// far, into; or null when every request is done
		S.step = function (events = []) {
			S.leave();
			arrive();
			if (!S.running.length && !S.waiting.length) {
				if (!S.future.length) return null;
				S.t = S.future[0].arrival;
				return S.step();
			}
			stop = null;
			const plan = opt.sched === 'static' ? planStatic(events)
				: opt.sched === 'prefill' ? planPrefill(events) : planChunked(events);
			if (!plan.length) {
				// everyone running gave way: try again with the queue let in,
				// the preemptions kept for the step that runs
				if (events.length) return S.step(events);
				// nothing fits, or a batch is filling: on to the next arrival,
				// or to the batch's time to go, the queue waiting all the while
				const next = S.future.length ? S.future[0].arrival : Infinity;
				const due = opt.sched === 'static' && S.waiting.length ? S.waiting[0].arrival + WAIT : Infinity;
				if (next === Infinity && due === Infinity) return null;
				const t = Math.min(next, due);
				for (const r of S.waiting) seg(r, r.preempts ? 'preempted' : 'wait', S.t, t);
				S.t = t;
				return S.step();
			}
			const ids = S.running.map(r => r.id), batch = S.batch ? S.batch.id : -1, into = S.batch ? S.batch.k : 0;
			const c = cost(kv, plan), t0 = S.t;
			S.t += c.time;
			const touched = new Set();
			for (const p of plan) {
				const r = p.r;
				touched.add(r);
				if (opt.sched === 'static') {
					if (r.generated >= r.output) {
						seg(r, 'pad', t0, S.t);
						continue;
					}
					seg(r, S.batch.k ? 'decode' : 'prefill', t0, S.t);
					r.computed = S.batch.k ? r.computed + 1 : r.prompt;
					emit(r, events);
					continue;
				}
				const before = r.computed;
				seg(r, !r.generated ? 'prefill' : before === tokens(r) - 1 ? 'decode' : 'recompute', t0, S.t);
				r.computed += p.n;
				if (opt.prefix) {
					for (let i = Math.floor(before / BLOCK); i < Math.floor(r.computed / BLOCK); i++) {
						const b = r.blocks[i], k = blockKey(r, i);
						if (key[b] === null && !cache.has(k)) {
							cache.set(k, b);
							key[b] = k;
							mark(b);
							if (isSystem(k)) {
								r.shared++;
								S.shared++;
							}
						}
					}
				}
				if (r.computed === tokens(r)) emit(r, events);
			}
			if (S.batch) S.batch.k++;
			for (const r of S.running) if (!touched.has(r)) seg(r, 'stall', t0, S.t);
			for (const r of S.waiting) seg(r, r.preempts ? 'preempted' : 'wait', t0, S.t);
			// The head of the queue and why it waits: the reason admission
			// stopped; or, with no one waiting, the first to come while the
			// step ran, at its arrival, the scheduler seeing it at the next
			const late = !S.waiting.length && S.future.length && S.future[0].arrival < S.t;
			const head = S.waiting.length ? { id: S.waiting[0].id, ...stop }
				: late ? { id: S.future[0].id, reason: 'arrived', at: S.future[0].arrival } : null;
			return { t0, t1: S.t, plan, ids, batch, into, cost: c, events, head };
		};
		return S;
	}

	// ---- numbers, and the colours the two programs share ----
	// a count as the window writes it, with a thousands comma; one formatter,
	// made once, as making one a call is the cost
	const NUMBER = new Intl.NumberFormat('en-GB');
	const fmt = v => NUMBER.format(v);
	// q of the way through xs, as numpy's percentile takes it, which vllm
	// bench serve uses: straight between the two nearest ranks; xs as they
	// are when sorted says they are in order already
	function quantile(xs, q, sorted = false) {
		const s = sorted ? xs : Float64Array.from(xs).sort(), h = (s.length - 1) * q, i = Math.floor(h);
		return i + 1 < s.length ? s[i] + (h - i) * (s[i + 1] - s[i]) : s[i];
	}
	// Round steps for an axis from a to b
	function ticks(a, b) {
		const raw = (b - a) / 6, mag = 10 ** Math.floor(Math.log10(raw));
		const step = [1, 2, 5, 10].map(f => f * mag).find(s => s >= raw);
		const out = [];
		for (let t = Math.ceil(a / step) * step; t <= b + 1e-9; t += step) out.push(t);
		return out;
	}
	// A request's colour: two tones in turn by its number, indigo and aqua,
	// so that requests side by side in the cache, and on the wall, part.
	// Cool, apart from the purple prompt, the red recompute and the gold
	// system prompt, and apart for colour-blind readers too (OKLab ΔE 29 at
	// the worst, deuteranopia)
	const TONES = ['#3c4baf', '#1baf7a'];
	const hue = id => TONES[id % TONES.length];
	const KEYED = TONES[1]; // a request's colour in a figure
	// a request's states too short to see beside the long ones, drawn over
	// them, a pixel and a half at least
	const BRIEF = new Set(['prefill', 'stall', 'recompute', 'refused']);

	// ---- the run ----
	const COUNT = 24;
	const VALUES = {
		// request_rate, a second; inf, all at once, is vllm bench serve's default
		rate: [1, 2, 4, 8, Infinity],
		system: [0, 256, 1024, 4096],
		reserve: [512, 1024, 2048, 4096, 8192],
		seqs: [4, 8, 16, 32, 64, 1024],
		cache: [1, 0.5, 0.25],
		seed: [1, 2, 3, 4, 5, 6, 7, 8, 9],
		// seconds of the run a second, which each program opens at its own
		speed: [0.1, 0.25, 0.5, 1, 2, 4, 8],
	};
	const SHOW = { rate: v => v === Infinity ? 'inf' : String(v), system: fmt, reserve: fmt,
		seqs: fmt, cache: v => v === 1 ? 'all' : '÷' + 1 / v, seed: String, speed: v => '×' + v };
	// vLLM's defaults, and the workload's
	const HOME = { sched: 'chunked', alloc: 'paged', prefix: true, kv: 2,
		rate: 2, system: 1024, reserve: 2048, seqs: 1024, cache: 1, seed: 1 };
	// a traced run keeps the whole cache every KEYFRAME steps, for blocksAt
	// to play on from
	const KEYFRAME = 64;

	// Serves the requests to the end, keeping for each step its cache as it
	// runs (its bands, slots, blocks in use, those free but cached, those
	// stranded), its batch (a sequence's new tokens, those it had cached,
	// what it was doing), who joined, finished and gave way, the head of the
	// queue and why it waits; and, after, the cache once the requests it
	// finished have left, as it stands till the next step, or null when
	// none did. A static batch's index on each of its steps
	function simulate(at) {
		const a = effective(at);
		// at.count, vllm bench serve's --num-prompts: COUNT unless a take sets fewer
		const reqs = requests({ rate: a.rate, count: a.count || COUNT,
			seed: a.seed, system: a.system, cap: a.reserve });
		const budget = a.sched === 'prefill' ? MAX_LEN : BUDGET;
		const S = engine(a.kv, reqs,
			{ sched: a.sched, alloc: a.alloc, budget, seqs: a.seqs, reserve: a.reserve,
				prefix: a.prefix, blocks: Math.round(numBlocks(a.kv) * a.cache), trace: !!a.trace });
		// with at.trace, each step's changes to the cache's blocks, and the
		// whole cache every KEYFRAME steps, from before the first
		const keyframes = a.trace ? [[-1, S.snapshot()]] : null;
		// A running request's band: its blocks and those of the system prompt
		// it shares, then its slots as Kwon et al. (2023) divide them, in the
		// order they fill: token states; reserved, for its tokens still to
		// come; and, the rest, internal fragmentation, which no token reaches.
		// Its tokens end one short of its answer, the last never fed back. A
		// static batch pads too: its prompt on the left to the longest, then,
		// once its answer ends, its row till the longest answer does; a row
		// finished before this step is padding to the batch's end
		const band = (r, ending) => {
			const held = r.blocks.length, shared = r.shared, last = r.prompt + r.output - 1;
			if (!S.batch) {
				return { id: r.id, held, shared, tokens: r.computed,
					reserved: Math.max(0, Math.min(last, held * BLOCK) - r.computed), pad: 0, tail: 0 };
			}
			const { len, longest } = S.batch;
			if (r.status === 'done' && !ending.has(r.id)) {
				return { id: r.id, held, shared: 0, tokens: 0, reserved: 0, pad: len + longest - 1, tail: 0 };
			}
			return { id: r.id, held, shared: 0, tokens: r.computed,
				reserved: last - r.computed, pad: len - r.prompt, tail: longest - r.output };
		};
		// The cache as it is now: each running request's band; its slots by
		// what they hold, the system prompt's shared blocks once, under every
		// band, each band's own tokens, its slots reserved, its padding and
		// its internal fragmentation, the free blocks still cached and,
		// stranded, external fragmentation; and the blocks in use, as vLLM's
		// kv_cache_usage counts them; ending, the ids whose last token this
		// step makes
		function cacheNow(ending = new Set()) {
			const bands = S.running.map(r => band(r, ending)), stranded = S.stranded();
			const slots = { system: S.shared * BLOCK, tokens: 0, reserved: 0, padding: 0,
				internal: 0, cached: S.cached * BLOCK, external: stranded * BLOCK };
			for (const b of bands) {
				const own = b.tokens - b.shared * BLOCK;
				slots.tokens += own;
				slots.reserved += b.reserved;
				slots.padding += b.pad + b.tail;
				slots.internal += (b.held - b.shared) * BLOCK - b.pad - own - b.reserved - b.tail;
			}
			return { bands, slots, used: S.usable - S.free, cached: S.cached, stranded };
		}
		// the trace since it was last taken
		const changes = () => {
			const out = S.trace;
			S.trace = [];
			return out;
		};
		const steps = [], preempts = [];
		let rec;
		while ((rec = S.step())) {
			const did = new Map(rec.plan.map(p => [p.r.id, p]));
			const seqs = rec.ids.map(id => {
				const r = S.reqs[id], p = did.get(id);
				return [id, p ? p.n : 0, p ? p.ctx : r.computed, r.segs[r.segs.length - 1].kind];
			});
			const joined = [], left = [], out = [];
			for (const e of rec.events) {
				if (e.kind === 'admit') joined.push(e.r.id);
				else if (e.kind === 'finish') left.push(e.r.id);
				else {
					out.push(e.r.id);
					preempts.push(rec.t0);
				}
			}
			const step = { t0: rec.t0, t1: rec.t1, cost: rec.cost, seqs,
				joined, left, out, head: rec.head, ...cacheNow(new Set(left)) };
			if (rec.batch >= 0) Object.assign(step, { batch: rec.batch, into: rec.into });
			steps.push(step);
			if (S.trace) {
				step.blocks = changes();
				if (steps.length % KEYFRAME === 0) keyframes.push([steps.length - 1, S.snapshot()]);
			}
			step.after = S.leave() ? { ...cacheNow(), blocks: S.trace && changes() } : null;
		}
		const served = S.reqs.filter(r => r.status === 'done');
		return {
			S, alloc: a.alloc, budget, steps, batches: S.batches, preempts, refused: S.reqs.length - served.length,
			N: S.N, usable: S.usable, nullBlock: S.nullBlock, maxLen: S.maxLen, bytes: BLOCK * kvToken(a.kv), keyframes,
		};
	}
	// The step under way at t, or the last to end before it; -1 before the first
	function stepAt(run, t) {
		let lo = 0, hi = run.steps.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (run.steps[mid].t0 <= t) lo = mid + 1;
			else hi = mid;
		}
		return lo - 1;
	}
	// The cache at t as the run kept it, its bands, slots, used, cached and
	// stranded: the step under way's; between steps, the last's once those
	// it finished have left; null before the first
	function cacheAt(run, t) {
		const s = run.steps[stepAt(run, t)];
		return !s ? null : t >= s.t1 && s.after ? s.after : s;
	}
	// The cache's blocks played on, as S.snapshot gives them: cells as they
	// were at step from, its finished gone too with fromAfter, to step k,
	// its own gone with after. Each step's changes as it began, then those
	// as its finished left; onChange(b, owner, kind, s) told of each block's
	// before it is made, s the step it is part of
	function playOn(run, cells, from, fromAfter, k, after, onChange) {
		const apply = (list, s) => {
			for (const [b, owner, ref, kind, slot] of list) {
				if (onChange) onChange(b, owner, kind, s);
				cells.owner[b] = owner;
				cells.ref[b] = ref;
				cells.kind[b] = kind;
				cells.slot[b] = slot;
			}
		};
		for (let j = Math.max(0, from); j <= k; j++) {
			const s = run.steps[j];
			if (j > from) apply(s.blocks, s);
			if (s.after && (j > from || !fromAfter) && (j < k || after)) apply(s.after.blocks, s);
		}
	}
	// The cache at step k of a run simulated with at.trace, with after once
	// its finished have left: from the keyframe at or before k, played on.
	// into, a snapshot to write over, saves allocating
	function blocksAt(run, k, into, after = false) {
		let i = run.keyframes.length - 1;
		while (run.keyframes[i][0] > k) i--;
		const [from, frame] = run.keyframes[i];
		const out = into
			|| { owner: new Int16Array(run.N), ref: new Uint8Array(run.N),
				kind: new Uint8Array(run.N), slot: new Int16Array(run.N) };
		for (const f of ['owner', 'ref', 'kind', 'slot']) out[f].set(frame[f]);
		playOn(run, out, from, false, k, after);
		return out;
	}
	// The requests waiting at t, the head of the queue first: those preempted,
	// the oldest first, then the rest as they came. Each with its kind
	function queueAt(run, t) {
		const back = [], rest = [];
		for (const r of run.S.reqs) {
			if (r.arrival > t) break;
			const s = r.segs.find(s => s.t0 <= t && t < s.t1);
			if (s && s.kind === 'preempted') back.push([r, s.kind]);
			else if (s && s.kind === 'wait') rest.push([r, s.kind]);
		}
		return back.concat(rest);
	}

return {
	MODEL, GPU, GPUS, W_BYTES, WEIGHTS, BLOCK, UTIL, kvToken, numBlocks, rng, effective, KEY,
	fmt, quantile, ticks, TONES, hue, KEYED, BRIEF,
	VALUES, SHOW, HOME, simulate, stepAt, cacheAt, playOn, blocksAt, queueAt,
};
})();
