# CS400 Series Fix List

Priority order: factual errors → structural gaps → tightening → cross-series dedup.

---

## P0: Factual Errors

### 401. computer
- [x] ENIAC power: 174 kW → ~150 kW
- [x] Tensor core: "4×4 FMA" → "4×4×4 matrix multiply-accumulate"
- [x] InfiniBand next tier: "GDR (1.6 Tbps)" → XDR
- [x] "~354 base instructions for Apple Silicon" → dropped "for Apple Silicon"

### 402. programming
- [x] A-0 system: "first compiler" → "first program called a compiler"
- [x] NVCC: "Clang" → "system compiler (GCC on Linux, MSVC on Windows)"
- [x] Smalltalk: "(1972)" → "(1980)"
- [x] Bohm-Jacopini: "computationally complete" → "sufficient for expressing any flowchart program"
- [x] "Formula Translation" → "Formula Translating System"
- [x] File extensions (.c, .py) removed from Fortran sentence

### 403. operating system
- [x] Syscall entry: split IDT (interrupts) from MSR_LSTAR (syscalls)
- [x] ext4 uses extents: changed to "ext2/ext3" with note that ext4 uses extents
- [ ] ~4 TB max file size ignores ext2's 32-bit i_blocks limit (~2 TB) — deferred, formula is correct for addressing scheme
- [x] "pluggable schedulers ... Kubernetes on GPU clusters" → "containerised workloads (407)"

### 404. concurrency
- [x] Kernel stack size: Linux 3.15 → 3.16
- [x] Conway coroutines: (1963) → (1958)
- [x] Dining philosophers: (1965) → (1971)

### 405. networking
- [x] "1500 KB" → "1500 bytes"
- [x] "TCP, 1974" + "RFC 793" → "RFC 675 1974; RFC 793 1981"
- [x] "RFC 2616" removed from HTTP attribution
- [x] MSL: added "120s per RFC 793; 60s on Linux"
- [x] ISN: noted original mechanism and RFC 6528 supersession
- [x] Missing "iii)" added before "transport"
- [x] ARPANET 1977: clarified as demo, added 1983 Flag Day migration

### 406. database
- [x] PostgreSQL JIT: v12+ → v11+
- [x] Spanner: separated Paxos+TrueTime from CockroachDB/TiDB Raft+HLC
- [x] FAISS: separated as "vector search library" from vector databases
- [x] "LRU with clock sweep" → "clock-sweep, an LRU approximation"
- [x] WAL/journaling: reversed direction, FS journaling adopted WAL principle

### 407. virtualisation
- [x] Popek-Goldberg: "GJ Popek" → "Popek and Goldberg", "He" → "They"
- [x] "sensitive instruction" → "sensitive instructions are privileged"
- [x] VMware: "(1998)" → "(Workstation 1.0, 1999)"
- [x] "AMD AMD-V" → "AMD-V (2006)", separated from VT-x (2005)
- [x] Cgroups: "in 2007" → "in 2008 (Linux 2.6.24)"
- [x] "(i.e. SHA256)" → "(using SHA256)"

---

## P1: Structural Gaps

### 404. concurrency
- [ ] §III entirely commented out. Post is half-finished — deferred to separate session
- [ ] §II ends abruptly after deadlock with placeholder markers — deferred to separate session

### 405. networking
- [x] §2.1 routing paragraph: added motivation (trust/policy within AS vs between ASes)
- [x] §3.4 MCP paragraph: added "a gap REST and gRPC leave to ad-hoc convention"

### 406. database
- [x] Phantom reads: added mechanism (row-level locks cannot prevent inserts matching predicate)
- [x] 2PC blocking: added explanation (participants hold locks awaiting decision that may never arrive)

### 407. virtualisation
- [x] Popek-Goldberg: added forward connection "As §1.2 shows, x86 violated this condition"
- [x] Type 1/2: rewrote KVM description to note it reuses Linux's scheduler/allocator/drivers

---

## P2: Tightening

### 401. computer
- [x] §2.1 CUDA paragraph: trimmed "enabled researchers..." overlap
- [x] §2.1 unified shaders: added "so that no fixed-function stage sat idle when another was saturated"
- [x] Ampere sentence: semicolon → period
- [x] "idle cycles" → "memory stalls, warp divergence, low occupancy, and synchronisation overhead"

### 402. programming
- [x] §1.1 P1: trimmed coreutils/lsd/bat tangent
- [x] §1.2 P4: split long sentence into three separate sentences
- [x] §1.2 P5: Curry-Howard split into its own paragraph
- [x] §1.2 P3: added "so what" (equational reasoning, generic programming, formal verification)
- [x] "All GC variants" → "Most GC variants" with refcounting caveat
- [x] "10-100x slower" → qualified "for CPU-bound logic (the gap narrows for I/O-bound workloads)"
- [x] §2.1 GCC: "monolithic architecture coupled" → "coupled more tightly than necessary (despite GIMPLE and RTL)"

### 403. operating system
- [x] Copy-on-write at line 463: changed to reference "(CoW, §3.1)"
- [x] Page cache: removed duplicate definition at line 621
- [x] §3.2 page table formula: added motivation sentence
- [x] Context switch cost: connected to thread pools, event loops, coroutines (404)
- [x] Hybrid kernels: added specifics (performance-critical services in kernel, others in user space)
- [x] "int 0x2e on older x86" → "int 0x2e on early NT, sysenter from XP onward"

### 404. concurrency
- [x] Thread overhead: clarified 1-8 MB is user-space stack, 16 KB is kernel stack, in same sentence
- [x] I/O model matrix M: added "(rows: blocking/non-blocking; columns: synchronous/asynchronous)"
- [x] x86-TSO vs ARM: distinguished (only store-load vs all four reorderings)

### 405. networking
- [x] UDP §1: removed redundant second sentence
- [x] DNS TCP fallback: removed duplicate in §3.1, kept in §2.3
- [x] Path MTU discovery: §2.3 now references "path MTU discovery (§1.3)"
- [x] "TCP itself still blocked" → named mechanism (transport-layer head-of-line blocking)

### 406. database
- [x] ACID paragraph: condensed from two paragraphs to one dense paragraph
- [x] "The art of database engineering" → merged and cut
- [x] "PostgreSQL uses LRU with clock sweep" → already fixed in P0

### 407. virtualisation
- [ ] §1.1 P1: run-on — deferred, acceptable as-is after KVM rewrite
- [x] §3.1 P2: K8s sentence trimmed (removed verbose parenthetical definitions)
- [x] Popek-Goldberg: "proves" → "showed" (done in P0)
- [x] "depends on or affects" → replaced with control-sensitive/behaviour-sensitive distinction
- [x] "(405 §2.1)" → removed, replaced with "because a bridge operates at L2"

---

## P3: Cross-Series Deduplication

- [x] Copy-on-write: 401 doesn't mention it. 403 line 463 now references §3.1. 407 uses it in domain-specific context (KSM, OverlayFS), fine as-is
- [x] Page cache: 403 duplicate removed (line 621). 406 §1.2 describes buffer pool independently, fine as-is
- [x] fork-exec-wait: 402 only references 403 §3.1 in a comment, does not re-explain. Already clean
- [x] GIL: 402 does not mention GIL at all. 404 owns it. Already clean
- [x] LLVM: 406 reference is lightweight. Already clean
