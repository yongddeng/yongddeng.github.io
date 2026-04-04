---
layout: default
title: "403. multitasking" 
tags: cs400
use_math: true
---


# Multitasking
---
A computer reads process's code line-by-line that resides in RAM and a CPU executes instructions sequentially to ... A single-core, or more explicitly, a process can handle multiple jobs if it can span threads, or the jobs themselves are I/O-bound. A multi-core processors leverage its powerful hardware and several processes perform the exact same job on different data (SIMT).   

The two physically different execution models explore the concept of concurrency involves managing multiple tasks that may interleave execution, while parallelism requires simultaneous execution on multiple processing units. This post explores the theoretical foundations, implementation patterns, and practical trade-offs across different programming paradigms, with particular attention to how language runtimes and operating systems coordinate to achieve efficient concurrent execution.

- **Concurrency**: Logical simultaneity—multiple tasks making progress through interleaved execution on a single or multiple cores. A concurrent system can handle multiple tasks even on a single-core CPU through time-slicing and **context switching**—the process by which the operating system saves the execution state (registers, program counter, stack pointer, memory mappings) of a currently running thread/process and restores the state of another, allowing the CPU to rapidly alternate between different execution contexts. This creates the illusion of simultaneous execution. Key characteristic: tasks start, run, and complete in overlapping time periods, but not necessarily simultaneously.

- **Parallelism**: Physical simultaneity—multiple tasks executing simultaneously on multiple processing units (cores, CPUs, or distributed nodes). Requires hardware support and is a subset of concurrency. True parallelism means tasks execute at the exact same instant across different execution units.

- **Taxonomy**: 
  - Task parallelism: different tasks on different processors (e.g., producer-consumer across cores)
  - Data parallelism: same operation on different data partitions (e.g., SIMD, map-reduce)
  - Pipeline parallelism: stages of computation distributed across processors
  - Hybrid models: combining task and data parallelism

- **Amdahl's Law and Gustafson's Law**: Theoretical limits on speedup from parallelization. Amdahl's Law shows diminishing returns when parallelizing a fixed-size problem with sequential bottlenecks. Gustafson's Law argues that problem size often scales with available processors, making parallelization more effective in practice.

- **Relationship to OS concepts**: Concurrency is achieved through OS scheduling (time-slicing, preemption), while parallelism requires multiple hardware execution contexts. Modern systems combine both: concurrent scheduling of threads/processes across parallel cores.

### **1.2. Execution Models and Memory Models**

<p style="margin-bottom: 12px;"> </p>

- **Shared memory vs message passing**: 
  - **Shared memory**: Threads/processes on the same machine access a common physical address space (fast but requires synchronization). All threads can directly read/write the same memory locations, enabling low-latency communication but requiring careful synchronization to avoid race conditions. This model applies to CPU threads and processes on the same system.
  - **Message passing**: Processes communicate via explicit channels or transfers (slower but better isolation). Data must be explicitly copied or transferred between separate address spaces. This includes: (1) **distributed systems** where processes run on different machines (e.g., **Spark**, Hadoop clusters, distributed databases like Cassandra, MongoDB shards), communicating over the network via message passing, (2) **CPU-GPU communication** where CPU and GPU have separate memory spaces connected via **DMA (Direct Memory Access)**—data must be explicitly transferred from CPU memory to GPU memory (and vice versa) through PCIe bus using DMA transfers, which is fundamentally a message-passing model despite being on the same physical machine, and (3) processes with separate virtual address spaces even on the same machine.
  - Hybrid: distributed shared memory, NUMA architectures, unified memory architectures (UMA) that provide a unified address space but may still require explicit transfers for optimal performance

- **Memory consistency models**: 
  - Sequential consistency: all operations appear to execute in some global order
  - Relaxed consistency: allows reordering for performance (x86-TSO, ARM weak ordering)
  - Happens-before relationships and memory barriers
  - Implications for lock-free programming and data structures

- **Cache coherence protocols**: MESI (Modified, Exclusive, Shared, Invalid) and variants. False sharing: performance degradation when unrelated data shares cache lines. Cache line alignment and padding strategies.

- **NUMA (Non-Uniform Memory Access)**: Memory access latency varies by CPU-memory distance. NUMA-aware scheduling and memory allocation strategies. First-touch policy and explicit NUMA binding.

### **1.3. Synchronization Primitives**

<p style="margin-bottom: 12px;"> </p>

- **Locks and mutexes**: 
  - **Mutex (Mutual Exclusion Lock)**: A synchronization primitive that ensures only one thread can access a shared resource or critical section at a time. When a thread acquires a mutex, it "locks" it, and any other thread attempting to acquire the same mutex will block (wait) until the mutex is released. Mutexes are binary semaphores—they have two states: locked or unlocked. They prevent race conditions by serializing access to shared data structures, ensuring that operations on shared state appear atomic to other threads. Unlike semaphores, mutexes are typically owned by the thread that acquires them and must be released by the same thread.
  - Reentrant locks: allow same thread to acquire multiple times
  - Read-write locks: allow concurrent reads, exclusive writes
  - Lock-free vs wait-free algorithms: progress guarantees

- **Semaphores and condition variables**: 
  - Counting semaphores: control access to N resources
  - Condition variables: wait for predicates, avoid busy-waiting
  - Producer-consumer patterns and bounded buffers

- **Atomic operations**: 
  - Compare-and-swap (CAS), fetch-and-add, load-linked/store-conditional
  - Memory ordering: acquire, release, relaxed, sequentially consistent
  - Lock-free data structures: queues, stacks, hash tables

- **Deadlock, livelock, and starvation**: 
  - **Deadlock**: A situation where two or more threads are permanently blocked, each waiting for a resource held by another thread in a circular dependency. The four necessary conditions (Coffman conditions) must all be present: (1) mutual exclusion—resources cannot be shared, (2) hold-and-wait—threads hold resources while waiting for others, (3) no preemption—resources cannot be forcibly taken away, and (4) circular wait—a circular chain of threads waiting for each other's resources. Deadlocks can cause entire systems to hang and are notoriously difficult to debug because they may only occur under specific timing conditions.
  - Prevention vs detection vs avoidance
  - Lock ordering, timeout mechanisms, deadlock detection algorithms

### **1.4. Threading Models**

<p style="margin-bottom: 12px;"> </p>

- **1:1 (kernel threads)**: Each user thread maps to one kernel thread (Linux NPTL, Windows threads). OS manages scheduling, **context switching** overhead (saving/restoring CPU registers, program counter, stack pointer, memory page tables, and flushing CPU caches—typically 1-10 microseconds per switch), but enables true parallelism across multiple cores.

- **M:1 (user threads)**: Many user threads on one kernel thread (early Java green threads). Lightweight but no true parallelism, blocking I/O blocks all threads.

- **M:N (hybrid)**: Many user threads multiplexed onto fewer kernel threads (Go goroutines, Erlang processes). Work-stealing schedulers, efficient context switching, but complexity in implementation.

- **Cooperative vs preemptive scheduling**: 
  - Cooperative: threads yield control (async/await, coroutines)
  - Preemptive: OS forcibly switches threads (traditional threading)
  - Trade-offs: responsiveness vs control, deadlock risks

- **Thread pools and work-stealing**: 
  - Fixed-size pools vs dynamic sizing
  - Work-stealing queues: idle threads steal from busy threads' queues
  - Load balancing and cache locality considerations

## II
---

### **2.1. Asynchronous Programming and Event Loops**

<p style="margin-bottom: 12px;"> </p>

- **Event-driven architecture**: 
  - **Event loop**: A programming construct that continuously runs in a single thread, repeatedly **polling** for and dispatching events (I/O readiness, timers, callbacks, system signals). The event loop maintains a queue of pending callbacks and uses I/O multiplexing system calls (like epoll/kqueue) to efficiently poll the kernel for which file descriptors are ready for reading or writing. This polling is efficient because the kernel maintains event queues and only notifies the application when events occur, rather than requiring the application to check every descriptor. When I/O becomes ready or a timer expires, the associated callback is invoked. This single-threaded model enables high concurrency for I/O-bound applications without the overhead of thread creation and context switching. The event loop is non-blocking: instead of waiting for I/O to complete, it registers interest in I/O events and continues processing other ready events. This pattern is central to Node.js, Python's asyncio, and many high-performance network servers like Nginx.
  - Callbacks, promises, futures: representing deferred results
  - Reactor pattern: demultiplexing I/O events to handlers

- **Coroutines and generators**: 
  - **Coroutines**: Functions that can suspend their execution at specific points (yield control) and later resume from exactly where they left off, maintaining their local state between suspensions. Unlike threads, which are preemptively scheduled by the OS, coroutines are cooperative—they explicitly yield control using keywords like 'yield' or 'await', allowing other coroutines to run. This cooperative model eliminates the overhead of thread creation, context switching, and synchronization primitives, making coroutines extremely lightweight (often just a few KB of memory). **Coroutine switching is lightweight**—typically taking nanoseconds compared to microseconds for OS thread context switches—because it doesn't require kernel mode transitions, full CPU register saves/restores, TLB flushes, or memory protection changes; it's just a function call that saves minimal state (program counter and local variables). **Stackful coroutines** maintain their own stack (like threads but lighter), while **stackless coroutines** use heap-allocated activation records. Coroutines enable efficient concurrent I/O operations: when a coroutine performs I/O, it yields control, allowing other coroutines to run while waiting for I/O completion. This pattern is fundamental to async/await syntax in modern languages.
  - Suspension points: yield, await keywords
  - Stackful vs stackless coroutines
  - Continuation-passing style (CPS) transformation
  - Generator-based coroutines (Python) vs native coroutines

- **Async/await syntax**: 
  - Syntactic sugar over promises/futures
  - Exception propagation in async contexts
  - Async generators and context managers
  - Composition: async functions calling async functions

- **I/O multiplexing**: 
  - **I/O multiplexing** is a mechanism that allows a single thread to efficiently monitor multiple file descriptors (sockets, pipes, files) simultaneously, determining which ones are ready for I/O operations without blocking on individual descriptors. **I/O polling** refers to checking whether I/O operations are ready, but there are two approaches: (1) **naive polling** (busy-waiting) involves repeatedly checking each descriptor sequentially in a loop, which wastes CPU cycles and doesn't scale; (2) **event-driven polling** uses efficient kernel mechanisms like 'epoll()' (Linux) and 'kqueue()' (BSD/macOS) where the kernel maintains a list of monitored descriptors and notifies the application only when events occur, eliminating the need to check every descriptor. Instead of creating one thread per connection (which doesn't scale) or polling each descriptor sequentially (which is inefficient), multiplexing system calls like 'select()', 'poll()', 'epoll()' (Linux), 'kqueue()' (BSD/macOS), and 'IOCP' (Windows) allow a program to wait on hundreds or thousands of descriptors at once. The kernel notifies the application when any monitored descriptor becomes ready, enabling a single thread to handle many concurrent I/O operations. **Edge-triggered** notifications fire only when a state change occurs (e.g., data arrives), while **level-triggered** notifications fire whenever the condition is true (e.g., data is available). This is the foundation of event-driven, non-blocking I/O architectures.
  - select(), poll(), epoll (Linux), kqueue (BSD/macOS), IOCP (Windows)
  - Edge-triggered vs level-triggered notifications
  - Zero-copy I/O: sendfile(), splice()
  - Performance characteristics and scalability limits

### **2.2. Language-Specific Implementations**

<p style="margin-bottom: 12px;"> </p>

- **Python**: 
  - **Global Interpreter Lock (GIL)**: A mutex in CPython (the standard Python implementation) that protects access to Python objects, preventing multiple native threads from executing Python bytecode simultaneously. The GIL exists primarily to simplify memory management—Python uses reference counting for garbage collection, and the GIL ensures that reference count operations are atomic without requiring fine-grained locking on every object. While this design simplifies C extension development and prevents memory corruption, it severely limits true parallelism for CPU-bound Python code: even on multi-core systems, only one thread can execute Python code at a time. However, I/O-bound operations can still benefit from threading because threads release the GIL during blocking I/O operations (file reads, network requests), allowing other threads to proceed. For CPU-bound parallelism, Python programs must use multiprocessing (separate processes) or GIL-free implementations.
  - **asyncio**: event loop, coroutines, tasks, futures. The asyncio event loop uses epoll/kqueue for efficient I/O multiplexing, enabling high-concurrency web applications.
  - **WSGI (Web Server Gateway Interface) vs ASGI (Asynchronous Server Gateway Interface)**: **WSGI** is the synchronous standard interface between Python web applications and web servers (e.g., Gunicorn, uWSGI). It defines a callable that receives a request and returns a response synchronously—the server blocks waiting for the application to process the request. WSGI works well for traditional synchronous frameworks like Flask and Django but doesn't support async/await or WebSockets natively. **ASGI** is the async evolution of WSGI, designed for async Python web applications. It's an async callable that receives events (HTTP requests, WebSocket messages) and can yield control during I/O operations, allowing the server to handle other requests concurrently. ASGI enables frameworks like **FastAPI**, Starlette, and Django Channels to leverage asyncio for high-concurrency I/O-bound workloads, supporting features like WebSockets, HTTP/2 server push, and long-polling efficiently. ASGI applications run on async servers like Uvicorn or Hypercorn, which use asyncio and I/O multiplexing under the hood. **ASGI deployment architecture**: ASGI servers typically run multiple worker processes (e.g., `uvicorn app:asgi --workers 4`) to utilize multiple CPU cores. Each worker is a separate process (not a thread) to bypass the GIL limitation. Within each worker process: (1) the main thread runs a single asyncio event loop handling thousands of concurrent async I/O operations. The standard practice is **1 thread per worker**—the event loop thread—as ASGI servers are designed for async I/O and additional threads per worker are unnecessary and can cause locking issues. (2) For blocking operations that can't be made async (e.g., CPU-bound work, synchronous database drivers like boto3, the 'requests' library), applications can run them in a thread pool to avoid blocking the event loop. Python 3.9+ provides 'asyncio.to_thread()' as a simple way to execute blocking functions in the default thread pool executor. For more control or shared thread pools (e.g., when using boto3 or legacy DB drivers across multiple async functions), applications may use 'loop.run_in_executor()' with a custom **ThreadPoolExecutor** at the application level (not a server configuration), typically sized based on the expected number of concurrent blocking operations (e.g., 4-16 threads), but this is separate from worker thread configuration. This architecture combines process-level parallelism (multiple workers) with async concurrency (event loop) to maximize both CPU utilization and I/O throughput. **Practical tuning**: Common guidelines suggest matching worker count to CPU cores (or 2× cores for I/O-bound workloads). Since ASGI workers use a single thread per worker, scaling is achieved by increasing the number of worker processes rather than threads. ThreadPoolExecutor sizing (if needed for blocking operations) should be determined through profiling based on the ratio of blocking to async operations in your workload.
  - threading module: OS threads, GIL limitations
  - multiprocessing: separate processes, IPC mechanisms
  - concurrent.futures: ThreadPoolExecutor, ProcessPoolExecutor
  - GIL-free implementations: Jython, IronPython, PyPy with STM
  - PEP 703: no-GIL mode in Python 3.13+

- **JavaScript/Node.js**: 
  - Single-threaded event loop with libuv
  - Worker threads: true parallelism for CPU-bound tasks
  - Cluster module: process-based parallelism
  - Async I/O: non-blocking syscalls, callback queue, microtask queue
  - Promise resolution and async/await

- **Go**: 
  - Goroutines: M:N threading model, work-stealing scheduler
  - Channels: CSP (Communicating Sequential Processes) model
  - Select statement: non-deterministic channel operations
  - GOMAXPROCS: controlling parallelism
  - Memory model: happens-before via channel operations

- **Rust**: 
  - Ownership and Send/Sync traits: compile-time concurrency safety
  - async/await with futures-rs and tokio
  - Arc (Atomically Reference Counted) vs Rc
  - Mutex, RwLock, channels (mpsc, oneshot)
  - Zero-cost abstractions and performance

- **Java**: 
  - JVM threads: 1:1 mapping to OS threads
  - java.util.concurrent: ExecutorService, ForkJoinPool, CompletableFuture
  - Concurrent collections: ConcurrentHashMap, CopyOnWriteArrayList
  - Project Loom: virtual threads (fibers), structured concurrency

- **C++**: 
  - std::thread, std::async, std::future
  - std::atomic: memory ordering semantics
  - Lock-free programming with atomics
  - Thread-local storage (TLS)

### **2.3. I/O-Bound vs CPU-Bound Workloads**

<p style="margin-bottom: 12px;"> </p>

- **I/O-bound**: 
  - Network requests, disk I/O, database queries
  - Async I/O: non-blocking syscalls, event loops
  - Thread pools: limiting thread count to avoid context switching overhead
  - Connection pooling and keep-alive strategies

- **CPU-bound**: 
  - Numerical computation, image processing, encryption
  - True parallelism required: multiprocessing or multiple threads (if GIL-free)
  - Load balancing across cores
  - NUMA awareness for memory-bound workloads

- **Hybrid workloads**: 
  - Pipeline patterns: I/O → CPU → I/O
  - Producer-consumer with bounded queues
  - Backpressure: handling when producers outpace consumers

- **Profiling and optimization**: 
  - Identifying bottlenecks: CPU vs I/O wait
  - Thread dumps, stack traces
  - Performance counters: context switches, cache misses
  - Amdahl's Law application: identifying sequential bottlenecks

### **2.4. Concurrent Data Structures**

<p style="margin-bottom: 12px;"> </p>

- **Lock-based structures**: 
  - Coarse-grained vs fine-grained locking
  - Reader-writer locks for read-heavy workloads
  - Lock contention and scalability limits

- **Lock-free structures**: 
  - Compare-and-swap (CAS) operations
  - ABA problem and solutions (versioning, hazard pointers)
  - Memory reclamation: hazard pointers, epoch-based reclamation
  - Lock-free queues, stacks, hash tables

- **Wait-free structures**: 
  - Guaranteed progress: every operation completes in bounded steps
  - More complex, often with performance trade-offs
  - Applications: real-time systems, high-priority operations

- **Transactional memory**: 
  - Hardware Transactional Memory (HTM): Intel TSX, IBM Power
  - Software Transactional Memory (STM)
  - Optimistic concurrency: rollback on conflict

## III
---

### **3.1. Distributed Concurrency**

<p style="margin-bottom: 12px;"> </p>

- **Distributed systems challenges**: 
  - Network partitions, partial failures
  - CAP theorem: Consistency, Availability, Partition tolerance
  - Eventual consistency and conflict resolution

- **Horizontal vs vertical scaling**: 
  - **Vertical scaling (scale-up)**: Increasing the capacity of a single machine (more CPU cores, more RAM, faster processors). Simpler to implement (no distributed coordination needed) but has physical and cost limits. Amdahl's Law shows diminishing returns as sequential bottlenecks become more significant. Eventually hits hardware limits (maximum CPU cores, memory capacity).
  - **Horizontal scaling (scale-out)**: Adding more machines/nodes to a system (distributed architecture). More complex (requires distributed coordination, load balancing, data partitioning, network communication) but theoretically unlimited capacity. Enables true parallelism across machines. Examples: adding more web servers behind a load balancer, adding more database replicas, expanding Spark/Hadoop clusters. Trade-offs: network latency, data consistency challenges, coordination overhead (consensus algorithms, distributed locks).
  - Modern systems often combine both: vertical scaling within nodes (multi-core processors) and horizontal scaling across nodes (distributed clusters).

- **Consensus algorithms**: 
  - Paxos, Raft: achieving agreement in distributed systems
  - Leader election and log replication
  - Quorum-based decisions

- **Distributed coordination**: 
  - ZooKeeper, etcd: distributed configuration and coordination
  - Distributed locks and leader election
  - Service discovery and health checks

- **Message passing patterns**: 
  - Actor model: Erlang, Akka, Ray
  - Message queues: RabbitMQ, Kafka
  - Publish-subscribe and event sourcing

### **3.2. Parallel Computing Patterns**

<p style="margin-bottom: 12px;"> </p>

- **MapReduce and data parallelism**: 
  - Splitting data, parallel processing, aggregation
  - Hadoop, Spark: distributed data processing
  - Shuffle operations and network overhead

- **Fork-join parallelism**: 
  - Divide-and-conquer algorithms
  - Work-stealing schedulers
  - Load balancing and cache locality

- **Pipeline parallelism**: 
  - Stages of computation across processors
  - Bounded buffers between stages
  - Throughput vs latency trade-offs

- **GPU parallelism**: 
  - SIMT (Single Instruction, Multiple Threads) model
  - CUDA, OpenCL programming models
  - Memory hierarchies: global, shared, local memory
  - Synchronization: barriers, atomic operations

### **3.3. Performance Considerations**

<p style="margin-bottom: 12px;"> </p>

- **Overhead sources**: 
  - Context switching: saving/restoring registers, TLB flushes
  - Lock contention: spinning vs blocking
  - Cache coherence: false sharing, cache line bouncing
  - Memory allocation: contention in allocators

- **Scalability limits**: 
  - Amdahl's Law: sequential bottlenecks
  - Lock contention: fine-grained locking strategies
  - Memory bandwidth: NUMA-aware allocation
  - Network bandwidth: distributed system bottlenecks

- **Optimization strategies**: 
  - Lock-free algorithms: reducing contention
  - Batching: amortizing synchronization overhead
  - Affinity: pinning threads to cores
  - Prefetching: reducing memory latency

- **Profiling tools**: 
  - perf (Linux), Instruments (macOS), VTune (Intel)
  - Thread profilers: identifying contention
  - Memory profilers: detecting false sharing
  - Distributed tracing: understanding system-wide behavior

### **3.4. Common Pitfalls and Best Practices**

<p style="margin-bottom: 12px;"> </p>

- **Race conditions**: 
  - **Race condition**: A bug where the program's correctness depends on the relative timing or interleaving of operations by multiple threads. The outcome varies unpredictably based on which thread executes first or how operations are interleaved. **Data races** occur when multiple threads access the same memory location concurrently without proper synchronization, and at least one access is a write. Data races lead to undefined behavior—results can be incorrect, inconsistent, or cause crashes. **Time-of-check to time-of-use (TOCTOU)** bugs occur when a condition is checked and then used, but another thread modifies the state between the check and use. **Atomicity violations** happen when operations that should be indivisible are interrupted mid-execution, leaving shared state in an inconsistent intermediate condition.

- **Deadlock prevention**: 
  - Lock ordering: consistent acquisition order
  - Timeout mechanisms: avoiding indefinite waits
  - Lock-free alternatives: eliminating locks where possible

- **Resource management**: 
  - Thread leaks: not joining threads
  - Connection pool exhaustion
  - Memory leaks in concurrent contexts

- **Testing concurrent code**: 
  - Deterministic testing challenges
  - Stress testing and race condition detection
  - Model checking and formal verification
  - Fuzzing concurrent systems

- **Design principles**: 
  - Immutability: reducing shared mutable state
  - Message passing: explicit communication
  - Actor model: encapsulation and isolation
  - Functional programming: referential transparency

## IV
---

### **4.1. Real-World Applications**

<p style="margin-bottom: 12px;"> </p>

- **Web servers**: 
  - Event-driven architectures: Nginx, Node.js
  - Thread-per-request vs event loop models
  - Connection handling and keep-alive

- **Database systems**: 
  - Transaction isolation levels
  - MVCC (Multi-Version Concurrency Control)
  - Lock-based vs optimistic concurrency control
  - Distributed databases: consistency models

- **Machine learning frameworks**: 
  - DataLoader parallelism: PyTorch multiprocessing
  - Distributed training: DDP, Horovod
  - Gradient synchronization and communication backends

- **High-frequency trading**: 
  - Low-latency requirements
  - Lock-free data structures
  - CPU affinity and interrupt handling


### **4.2. Wrap-up**

<p style="margin-bottom: 12px;"> </p>

- Concurrency and parallelism are essential for modern software systems
- Understanding the underlying OS and hardware mechanisms is crucial
- Language runtimes provide abstractions, but understanding implementation details enables better decisions

