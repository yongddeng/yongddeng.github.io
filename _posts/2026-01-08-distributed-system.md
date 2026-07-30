---
layout: default
title: "608. distributed system"
tags: cs600
use_math: true
---


# Distributed System
---
> tbd... A distributed system is many machines with no shared clock and independent failure, and the field is the work of reconstructing the two guarantees a single machine gave for free, a global "now" and all-or-nothing failure.

<!-- Arc (mirrors §604's C10K spine: each section's problem is created by the previous section's answer):
  §I   the break        — leaving one machine costs a global clock and all-or-nothing failure
  §II  agreement        — FLP says perfect agreement is impossible; CAP forces a trade-off; consensus buys "good enough"
  §III systems on top   — replicated data and distributed training built on the above
Pairs with §604: single-machine parallelism and AllReduce mechanics live in §604; §608 adds only what the network boundary forces. -->

<!-- https://tkayyoo.tistory.com/27 -->
<!-- https://docs.nvidia.com/datacenter/tesla/mig-user-guide/#concepts (GPU partitioning, from old parallel-computing stub) -->


## I
---

### **1.1. Beyond One Machine**

<p style="margin-bottom: 12px;"> </p>

<!-- Intent: why distribute at all (scale past one box, survive its failure), then the two inherited costs
that generate the whole post: the network is unreliable and slow (§605), and there is no global clock.
Frame the parallel-vs-distributed line: the boundary is independent failure, not core count. A 4-GPU box
(NVLink, fails together) is parallel computing (§604 §II); a cluster (nodes crash independently) is distributed. -->

tbd...

### **1.2. Time & Causality**

<p style="margin-bottom: 12px;"> </p>

<!-- Intent: with no shared "now," order must be constructed. Logical clocks, vector clocks,
happens-before lifted across machines (callback to §604#3.2). This is the conceptual core. -->

tbd...

### **1.3. Failure & Impossibility**

<p style="margin-bottom: 12px;"> </p>

<!-- Intent: partial failure as the defining trait; crash-stop vs crash-recovery vs Byzantine;
the FLP result (no deterministic consensus in an async network with even one faulty node).
Sets up why §II is hard, not merely engineering. -->

tbd...


## II
---

### **2.1. Communication**

<p style="margin-bottom: 12px;"> </p>

<!-- Intent: how nodes talk, bottom of the mechanism stack. RPC and its fallacies ("RPC is not a
local call"), message passing, then the actor model and queues below. -->

The [actor model](), popularised by Erlang, encapsulates state within actors that communicate exclusively through asynchronous message passing, eliminating shared mutable state by design. Frameworks like Akka (JVM) and Ray (Python) implement this pattern. Message queues such as RabbitMQ and Apache Kafka extend asynchronous communication across services, decoupling producers from consumers for high-throughput stream processing with durability and replay guarantees.

### **2.2. Consistency & CAP**

<p style="margin-bottom: 12px;"> </p>

<!-- Intent: what guarantees are even possible. CAP as the forced trade-off, the sharper PACELC,
strong -> eventual, and the price of "eventual". -->

Distributed concurrency extends threading and synchronisation primitives across network boundaries, where communication is unreliable and latency is orders of magnitude higher than shared-memory access. Systems must contend with [network partitions]() (where nodes cannot communicate), partial failures (where some nodes crash while others continue), and clock skew. The [CAP theorem]() formalises a fundamental constraint, that a distributed system can guarantee at most two of Consistency, Availability, and Partition tolerance. In practice, partitions are inevitable, so systems choose between CP (e.g. ZooKeeper, etcd) and AP (e.g. Cassandra, DynamoDB) trade-offs. [Eventual consistency]() relaxes strong guarantees, allowing replicas to temporarily diverge and converge over time through conflict resolution strategies such as last-writer-wins, vector clocks, or CRDTs.

### **2.3. Consensus**

<p style="margin-bottom: 12px;"> </p>

<!-- Intent: agreeing on one truth despite failure. Paxos -> Raft, quorums, the replicated log;
etcd/ZooKeeper as the practical face. -->

[Consensus]() is the problem of getting multiple nodes to agree on a single value or sequence of values in the presence of failures. [Paxos](), proposed by Lamport (1998), was the first provably correct consensus protocol but is notoriously difficult to implement. [Raft]() (2014) was designed as an understandable alternative, decomposing consensus into leader election, log replication, and safety. Both use quorum-based decisions, requiring a majority of nodes to agree before a value is committed. Coordination services like [ZooKeeper]() and [etcd]() build on consensus to provide distributed locks, leader election, and service discovery.


## III
---

### **3.1. Distributed Data**

<p style="margin-bottom: 12px;"> </p>

<!-- Intent: the payoff. Replication, partitioning/sharding, distributed transactions (2PC),
MapReduce/Spark as fault-tolerant data-parallel execution (not a "parallel pattern"),
Spanner/Cockroach as §606's MVCC stretched across nodes. -->

[MapReduce](), introduced by Dean and Ghemawat at Google (2004), formalises a pattern where input data is split into partitions, each processed independently by a *map* function, and intermediate results are aggregated by a *reduce* function. [Apache Spark]() improves upon Hadoop's MapReduce with in-memory computation and lazy evaluation of RDD transformations, achieving significant speedups for iterative algorithms. The *shuffle* phase, where intermediate key-value pairs are redistributed across nodes, remains the primary bottleneck due to serialisation, network transfer, and disk I/O.

[Database systems]() are among the most complex concurrent systems. [Transaction isolation levels]() (Read Uncommitted, Read Committed, Repeatable Read, and Serialisable) define the degree to which concurrent transactions observe each other's intermediate state. [MVCC]() (Multi-Version Concurrency Control), used by PostgreSQL, MySQL/InnoDB, and Oracle, allows readers and writers to operate concurrently by maintaining multiple row versions, avoiding read-write locks entirely. Distributed databases like CockroachDB and Spanner extend these guarantees across nodes using distributed consensus and synchronised clocks.

### **3.2. Distributed ML**

<p style="margin-bottom: 12px;"> </p>

<!-- Intent: closing application, the series' ML thread. Only what the network boundary ADDS beyond
single-box multi-GPU parallelism (that lives in §604): stragglers, fault tolerance, checkpoint/restart,
elastic training, AllReduce over the wire. -->

In ML, the key concurrency challenge is overlapping computation with communication. DataLoader prefetches batches concurrently with GPU computation, while DDP overlaps backward computation with gradient synchronisation via bucketed [AllReduce](), the primary communication bottleneck in distributed training. High-frequency trading represents the opposite extreme, with sub-microsecond latencies achieved through lock-free data structures (e.g. LMAX Disruptor), CPU affinity and interrupt isolation (*isolcpus*), and kernel bypass techniques (DPDK, RDMA).


<!-- ============================================================================
PARKED — belongs in §604 (single-machine concurrency), not here. Move back or cut.

Parallel patterns (fork-join, work-stealing, pipeline; ML data/model/tensor parallelism on one box):
  The [fork-join]() model recursively decomposes problems into independent sub-problems (fork), solves
  them in parallel, and combines results (join). Java's ForkJoinPool and Cilk's spawn/sync implement
  this with [work-stealing]() schedulers that achieve good load balancing while preserving cache
  locality. [Pipeline parallelism]() distributes sequential stages across processors, with bounded
  buffers regulating flow, where throughput is limited by the slowest stage.

  In ML, these patterns map onto two axes. [Data parallelism]() replicates the model across devices and
  partitions the input (e.g. DDP), while [model parallelism]() partitions the model itself. Pipeline
  parallelism (e.g. GPipe, PipeDream) is a form of model parallelism that distributes layers across
  GPUs, allowing different micro-batches to occupy different stages simultaneously. [Tensor
  parallelism]() (e.g. Megatron-LM) splits individual layers across devices for very large models.

Concurrent data structures (lock-free, ABA, wait-free, transactional memory) — single-machine:
  [Lock-based]() concurrent data structures range from coarse-grained locking (a single lock protecting
  the entire structure, simple but poor scalability) to fine-grained locking (per-node or per-bucket
  locks, better concurrency but more complex). [Lock-free]() data structures guarantee system-wide
  progress even if individual threads are delayed. The [ABA problem](), where a value changes from A to
  B and back to A making CAS believe nothing changed, is addressed through versioning (tagged pointers)
  or hazard pointers. [Wait-free]() structures provide the strongest guarantee, that every operation
  completes in bounded steps, while [transactional memory]() (hardware via Intel TSX, or software STM)
  offers an optimistic alternative that executes speculatively and rolls back on conflict.

Overheads (context switch, false sharing, allocator contention) — single-machine:
  Concurrency introduces several categories of overhead. Context switching costs 1-10 microseconds per
  switch and degrades cache locality. Lock contention arises when threads compete for the same lock,
  where spinning wastes CPU cycles but avoids scheduling latency, while blocking frees the CPU but
  incurs wake-up overhead. [False sharing]() causes the MESI coherence protocol to bounce cache lines
  between cores even when threads access unrelated data, and padding structures to cache-line
  boundaries mitigates this. Memory allocator contention is another bottleneck, and allocators like
  jemalloc and tcmalloc use per-thread arenas to reduce it.

Optimisation & profiling — mostly single-machine (distributed tracing Jaeger/Zipkin could stay in §II):
  Optimisation strategies include lock-free algorithms (reducing contention via CAS), batching
  (amortising synchronisation cost), CPU affinity (*taskset*, *pthread_setaffinity_np*) to preserve
  cache warmth, and prefetching (*__builtin_prefetch*) to hide memory latency. Profiling tools such as
  *perf* (Linux), Instruments (macOS), and Intel VTune provide hardware performance counters.
  Thread-specific profilers (*py-spy*, *async-profiler*, *pprof*) identify lock contention hotspots,
  while [ThreadSanitizer]() (TSan) detects data races at runtime. For distributed systems, [Jaeger]()
  and Zipkin provide distributed tracing across services.

Web servers (Apache/Nginx/Node) — already covered by §604 §I event loops:
  Traditional web servers like Apache use a thread-per-request model, spawning a thread for each
  incoming connection. This scales poorly as each thread consumes ~1 MB of stack memory. Event-driven
  servers like [Nginx]() and Node.js use a single-threaded event loop with non-blocking I/O
  multiplexing, handling tens of thousands of concurrent connections with minimal memory overhead.
  Nginx uses a multi-process architecture where each worker runs an independent event loop, while
  Node.js delegates CPU-bound work to a thread pool via libuv.

Common bugs & testing — single-machine, but model checking (TLA+) is distributed-relevant:
  Common concurrency bugs include [race conditions]() (correctness depends on timing), [data races]()
  (unsynchronised concurrent access with at least one write), [TOCTOU]() bugs (state changes between
  check and use), and atomicity violations. Testing is inherently difficult due to non-determinism, and
  stress testing with randomised scheduling, [model checking]() (e.g. TLA+), and formal verification
  supplement traditional unit tests. Design principles that prevent these bugs at the architecture
  level include immutability, message passing, the actor model, and functional programming.
============================================================================ -->

<!--
TODO: revise — layer/audience framing, keep or cut

Low-level CS knowledge (memory ordering, atomics, memory hierarchy, thread scheduling)
is traditionally the domain of systems programmers working in C/C++, who build OS kernels,
databases, compilers, and runtimes. But the boundary is shifting: Rust is replacing C/C++
for systems work (Linux kernel accepts Rust since 2022), and Go handles concurrency at
scale without manual memory management.

CUDA kernel programmers occupy an unusual position: application-level in purpose (ML
training, inference) but systems-level in practice (managing GPU memory hierarchy, warp
scheduling, shared memory tiling). The concurrency concepts from §604 (threads,
synchronisation, scheduling, memory hierarchy) apply directly to GPU programming, just
on different hardware:

  OS thread         ↔  CUDA thread
  process           ↔  kernel launch
  context switch    ↔  warp scheduling
  shared memory     ↔  SMEM (per-SM)
  L1/L2 cache       ↔  L1/L2 cache (GPU)
  main memory       ↔  HBM (global memory)
  mutex/atomic      ↔  atomicAdd, __syncthreads()

Even Python ML engineers increasingly touch these layers: writing custom CUDA kernels
via PyTorch extensions or Triton, tuning NCCL collectives for distributed training,
and configuring DataLoader workers and pinned memory.

Kernel developers:     OS kernel, drivers, firmware        (C, Rust)
Systems programmers:   databases, compilers, runtimes      (C++, Rust, Go)
CUDA developers:       GPU kernels, custom ops, Triton     (CUDA C++, PTX)
Application engineers: web servers, ML training pipelines  (Python, JS, Java)
-->
