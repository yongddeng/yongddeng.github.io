---
layout: default
title: "604. concurrency"
tags: cs600
use_math: true
---


# Concurrency
---
Both [Amdahl's Law](https://en.wikipedia.org/wiki/Amdahl%27s_law) and [Gustafson's Law](https://en.wikipedia.org/wiki/Gustafson%27s_law) formalise the limits on parallel speedup. The former says that if a fraction $f$ of a program is sequential, the maximum speedup is $\lim_{p \to \infty} 1/(f + (1-f)/p) = 1/f$, so even 5% sequential code caps speedup at 20×. The latter counters that problem size often scales with available processors, making parallelisation more effective in practice.

<!-- 
 - 403 teaches what a thread is.
 - 404 §I teaches when threads are the wrong tool (I/O at scale). 
 - 404 §II teaches when threads are the right tool (CPU parallelism). 

Same mechanism, different applications.

Section I's arc (mirrors how MIT 6.S081 / CMU 15-213 build up):
1.1: the problem — why do we need this? threads can't scale for I/O (synchronous, blocking)
1.2: the kernel mechanism — how does the OS solve it? multiplexing + event loops (asynchronous, blocking at epoll_wait)
1.3: the language abstraction — how do higher-level languages wrap it? coroutines, Python specifics (asyncio, GIL, WSGI/ASGI). C developers stop at 1.2 (raw event loops and callbacks).

Both 1.1 and 1.2 are concurrent. The mechanism changed:
Thread-per-connection is concurrent and synchronous (each thread blocks on read()).
Event loops are concurrent and asynchronous (register interest, get notified later).
Concurrency is the goal; sync/async is how you achieve it.

Blocking/non-blocking and sync/async are technically separate dimensions,
but in practice they pair: blocking+sync (thread-per-connection) and
async+blocking (event loops via epoll_wait). The non-blocking column
(O_NONBLOCK busy-polling, io_uring) is less common because the network/disk
is usually the bottleneck, not the epoll_wait call itself.
-->

<!-- - https://www.youtube.com/watch?si=8uSg5V92e4JLOzp6&v=IMceN4_rieo&feature=youtu.be -->
<!-- - https://www.youtube.com/watch?v=M9HHWFp84f0&t=356s -->
<!-- - https://www.youtube.com/watch?v=5sw9XJokAqw -->
<!-- - https://beej.us/guide/bgnet/html/split/ -->
<!--
Problem: Too many customers waiting at the same time

1.1 Thread-per-connection          1.2 I/O Multiplexing           1.3 Coroutines
─────────────────────────          ────────────────────            ──────────────

 Waiter A → Table 1                 One waiter watches             Same as 1.2,
 Waiter B → Table 2                 ALL tables at once             but the waiter's
 Waiter C → Table 3                                                notebook is
 Waiter D → Table 4                 "Anyone need something?"       easier to read
   ...                              → Table 7 says yes!
 Waiter 9999 → Table 9999          → Go serve Table 7
                                    "Anyone else?"
 😰 Too many waiters!               → Table 2 says yes!
 They bump into each other          ...
 and the restaurant is full
 of staff, not food.               One waiter, 10,000 tables.     async/await
                                   select → poll → epoll          = neat handwriting

ELI5:

Imagine a restaurant where every table needs a waiter.

1.1 — You hire one waiter per table. Each waiter stands next to their table doing
nothing until the customer says "I'm ready to order." With 10 tables, fine. With 10,000
tables, your restaurant is packed with idle waiters who cost money and keep bumping
into each other. This is the C10K problem.

1.2 — You fire 9,999 waiters. One waiter stands in the middle and shouts "anyone need
anything?" The kitchen (kernel) tells him which tables are ready. He runs to those
tables, takes orders, comes back to the middle, and asks again. This is the event loop
with epoll. One waiter, thousands of tables.

1.3 — That one waiter's to-do list used to be a mess of sticky notes and callbacks
("when table 7 is ready, do X, then when Y finishes, do Z..."). Coroutines give him a
clean notebook where each page is one table's story from start to finish. He can pause
mid-page, help another table, and come back to the exact line he left off. This is
async/await — same waiter, same event loop, just much easier to read.
-->

## I
---

### **1.1. Thread-per-Connection**

<p style="margin-bottom: 12px;"> </p>

If [concurrency]() is the logical simultaneity of multiple tasks making progress through interleaved executions, and [parallelism]() is their physical simultaneity on different processing units at the same instant, then concurrency predated parallelism, spanning from batch processing and time-sharing (i.e. Multics-UNIX) to GUI responsiveness (i.e. UI thread). <!-- Single-core time-slicing is concurrent but not parallel, while two independent programs running on separate cores with no interaction are parallel but not concurrent. -->Later, two developments led the former into the foreground of software design: i) networked services drove concurrent connections into the tens of thousands, exposing [thread-per-connection]() limits; ii) clock speeds plateaued and the shift to multi-core processors demanded explicit restructuring of programs.

The growth of the [World Wide Web]() in the 90s exposed the first point at scale, while [I/O-bound]() workloads (e.g. network requests, disk reads, database queries) spend most of their time waiting for external resources. The initial solution assigned a thread per connection, but each kernel thread costs 1-8 MB of user-space stack memory and associated kernel [bookkeeping]() (including a 16 KB kernel stack per thread), yet significant portions sit idle in a blocking *read()* syscall. Dan Kegel in 1999 coined the term [C10K problem](): at 10,000 concurrent connections, unbounded thread creation exhausts memory and the OS scheduler spends more time context-switching than doing useful work.

I/O models are sometimes characterised by two orthogonal axes, [blocking]() vs [non-blocking]() (i.e. whether the call suspends the thread or returns immediately) and [synchronous]() vs [asynchronous]() (i.e. whether the I/O operation completes before the call returns or the call returns immediately and completion is signalled later), forming the $2 \times 2$ matrix $M$ below (rows: blocking/non-blocking; columns: synchronous/asynchronous). Given that the thread-per-connection model sits on $M_{00}$ (blocking + synchronous): each thread blocks on its own *read()*, the insight was that threads are the wrong abstraction for waiting, and the solution was to move to $M_{01}$ (blocking + asynchronous), where one thread blocks on a single notification call that watches thousands of file descriptors at once. <!-- making waiting and working no longer compete for the same thread.-->

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/linux_io.png" width="355"> <a href="https://developer.ibm.com/articles/l-async/" target="_blank" style="position: absolute; top: 4px; right: 4px; font-size: 12px;">[src]</a> </div>

<!-- - <iframe width="500" height="285" src="https://www.youtube.com/embed/IMceN4_rieo?si=g-BBn2kbVFYctrXF" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe> -->

<!-- - <div style="position: relative; display: inline-block; background-color: white"> <img src="https://notes.shichao.io/apue/figure_15.1.png" width="500" height="215"> <a href="https://notes.shichao.io/apue/ch15/" target="_blank" style="position: absolute;  bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div> -->

### **1.2. Event Loops**

<p style="margin-bottom: 12px;"> </p>

<!--
General multiplexing:     many consumers → one resource
  TDM:                    many users     → one CPU
  FDM:                    many signals   → one cable
  Statistical:            many packets   → one link

I/O multiplexing:         many fds       → one thread
-->

The shift from thread-per-connection to event-driven architectures required change on both sides: applications restructured around [event loops](), and the kernel evolved new syscalls to make the pattern efficient. An event loop runs in a single thread, blocking efficiently in the kernel's multiplexing interface (*epoll_wait()*, *kevent()*) until one or more file descriptors are ready, then dispatching the corresponding handlers. It registers interest in I/O readiness, timers, and callbacks, enabling high concurrency for I/O-bound workloads without thread-per-connection overhead. A single thread suffices because I/O-bound work spends almost no CPU time per connection, but it is also bound to a single core. Nginx and Uvicorn solve this by spawning multiple worker processes (§2.1), each running its own event loop, so multi-core scaling is achieved through multiprocessing rather than multithreading.

<!-- In practice, production deployments run multiple worker processes (e.g. *uvicorn --workers 4*) to utilise multiple cores, but each worker is still a single-threaded event loop, with multi-core scaling achieved through multiprocessing rather than multithreading. Most application developers never implement the event loop directly; libraries and runtimes (e.g. *asyncio*, *libuv*) wrap the kernel syscalls, and frameworks (e.g. FastAPI, Uvicorn, Node.js) wrap those libraries, so the programmer only writes *async/await* handlers. -->

[I/O multiplexing]() is the kernel-side mechanism that lets many file descriptors share a single thread by letting the kernel watch them on behalf of the application. Its implementations (i.e. syscall API) evolved from *select()* (fixed fd limit, copies entire fd set to kernel on every call) $\to$ *poll()* (dynamic, but still $O(n)$ scanning) $\to$ *epoll()* (Linux 2.5.44, 2002, registers fds once via *epoll_ctl* and returns only ready fds, achieving $O(1)$ per event) and *kqueue()* (BSD/macOS), with [*io_uring*]() (Linux 5.1, 2019) providing fully asynchronous non-blocking I/O for disk, network, and other I/O operations. <!-- via submission and completion queues.--> In particular, *epoll()* supports two notification modes.

[Level-triggered]() (default) reports a file descriptor as ready whenever data is available in its buffer, so the application can read partially and be reminded on the next *epoll_wait* call. [Edge-triggered]() (*EPOLLET*) reports a file descriptor only when its state changes (e.g. new data arrives), requiring the application to drain the entire buffer in a loop until *EAGAIN* or risk missing data. Edge-triggered mode generates fewer notifications under high throughput and is used by [Nginx](https://www.youtube.com/watch?v=L0jMBrCEQNQ), an event-driven reverse proxy and web server<!-- also widely used as a load balancer and TLS terminator due to its event-driven architecture -->, for network I/O. However, regular file reads on Linux do not integrate with epoll (they always report ready, but the actual *read()* blocks on disk latency), so Nginx offloads blocking disk I/O (e.g. serving large video files) to a [thread pool]() (§2.2) to keep the event loop responsive. Level-triggered mode is the default in Python's *selectors* module (underlying *asyncio*) and most event loop libraries (e.g. *libuv*, Go's *netpoller*) for its forgiving semantics.

<!--
┌─────────────────────────────────────────────────────────────┐
│  YOUR CODE (Python)                                         │
│                                                             │
│  async def handle(reader, writer):                          │
│      data = await reader.read(1024)  ──┐                    │
│      writer.write(process(data))       │ "I need data,      │
│                                        │  wake me later"    │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ Dev / asyncio ─ ─┤
│  ASYNCIO (Python library)              │                    │
│                                        ▼                    │
│  while True:                     suspends coroutine,        │
│      ready = epoll.poll()  ◄──── registers fd with epoll    │
│      for fd, event in ready:           │                    │
│          resume_coroutine(fd)  ──► your code continues      │
│                                    at "data = ..."          │
├────────────────────────────────────────┼───── Python / C ───┤
│  select.epoll (Python C extension)     │                    │
│                                        │                    │
│  epoll.poll()  ──► calls epoll_wait() via CPython C API     │
│                          │                                  │
├──────────────────────────┼──────────────────────────────────┤
│  libc (C library)        │                                  │
│                          ▼                                  │
│  epoll_wait()  ──► syscall instruction (trap to kernel)     │
│                          │                                  │
├══════════════════════════╪══════════════════ User / Kernel ═┤
│  KERNEL                  │                                  │
│                          ▼                                  │
│  sys_epoll_wait()                                           │
│  - thread sleeps here (no CPU used)                         │
│  - monitors all registered fds                              │
│  - NIC interrupt arrives → data on socket 47                │
│  - wakes thread, returns: "fd 47 ready"                     │
│  - sysret → back to user space                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
-->

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/event_loop.svg" width="400"> <a href="https://www.pythontutorial.net/python-concurrency/python-event-loop/" target="_blank" style="position: absolute; bottom: -8px; left: 4px; font-size: 12px;">[src]</a> </div>

### **1.3. Coroutines (in Python)**

<p style="margin-bottom: 12px;"> </p>

[Coroutines]() (Conway, 1963), generalised functions that can suspend execution at explicit points (*yield*, *await*) and resume from exactly where they left off, are applied in modern languages as an abstraction over event loops and callbacks. While event loops solved the C10K problem at the cost of raw callbacks, which are error-prone and deeply nested (i.e. [callback hell]()), coroutines restore sequential-looking control flow over the same event loop machinery. Coroutines are also cooperative, yielding control explicitly rather than being interrupted, unlike threads that are preemptively scheduled by the OS. <!-- Coroutine switching is lightweight (nanoseconds vs microseconds for OS thread context switches), because it only saves the coroutine's own registers and stack pointer in user space, avoiding kernel mode transitions and the full register save/restore that thread switches require. [Stackful coroutines]() maintain their own stack (like threads but lighter), while [stackless coroutines]() use heap-allocated activation records. -->

<!--
Coroutines are a general concept, not Python-specific.
Term coined by Melvin Conway (1963), originally implemented in assembly.
  Simula (1967): coroutine-like constructs
  Lua (1993): stackful coroutines
  C# 5.0 (2012): async/await
  Python 3.5 (2015): async/await
  JavaScript ES2017 (2017): async/await
  Kotlin (2018): coroutines
  Rust (2019): async/await
  C++20 (2020): coroutines

The level of abstraction differs by language. In C, the event loop is your code:
you call epoll_wait directly, write the while loop, and dispatch handlers yourself.
In Python, the event loop is buried under layers of abstraction (asyncio, FastAPI),
and it's easy to forget there's a loop calling a kernel syscall underneath.

C programmer sees:               Python programmer sees:

while (1) {                       async def handle(request):
    n = epoll_wait(epfd, ...);        data = await db.fetch()
    for (i = 0; i < n; i++)           return Response(data)
        handle(events[i].fd);
}

Both are event loops. The Python one is just hidden.

Full responsibility stack:
  Kernel devs:      implement epoll
  Runtime devs:     implement coroutine machinery (CPython, V8)
  Library devs:     implement asyncio, libuv (wrap both above)
  Framework devs:   implement FastAPI, Express (wrap libraries)
  You:              write async def and await
-->

The [Global Interpreter Lock]() (GIL), a [mutual exclusion lock]() (mutex) allowing only one thread to execute CPython bytecode at a time, was a reasonable design choice when Python was created (1991) on single-core machines where threads could never run in parallel anyway. With multi-core CPUs (mid-2000s), the GIL became a bottleneck, preventing threads from exploiting multiple cores and making async I/O the primary concurrency model for I/O-bound Python. Python's [asyncio]() module (3.4, 2014) provides an event loop wrapping the kernel's multiplexing interface, initially repurposing generator delegation (*yield from*, PEP 380) as coroutine syntax. Python 3.5 (2015, PEP 492) replaced this with native *async* / *await* keywords, so coroutines were no longer disguised generators.

<!--
import asyncio    # event loop + coroutine scheduler
import aiohttp    # async HTTP client built on asyncio (2014)
import httpx      # sync/async HTTP client (2019) — modern alternative to aiohttp

# Python 3.4 — generator-based coroutine
@asyncio.coroutine
def fetch(url):
    response = yield from aiohttp.request('GET', url)
    body = yield from response.read()
    return body

# Python 3.5 — native coroutine
async def fetch(url):
    response = await aiohttp.request('GET', url)
    body = await response.read()
    return body
-->

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/coroutine.png" width="355"> <a href="https://blog.eiler.eu/posts/20210512/" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div>

The entire arc of Section I is visible in Python web frameworks. [Web Server Gateway Interface]() (WSGI) frameworks (Flask, Django) run on synchronous servers (Gunicorn, uWSGI) that follow the blocking model from 1.1, assigning a thread or process per request. [Asynchronous Server Gateway Interface]() (ASGI) frameworks (FastAPI, Django Channels) run on asynchronous servers (Uvicorn, Hypercorn) that follow the event-loop model from 1.2, running requests on asyncio with the coroutine syntax from 1.3. The choice between them reduces to whether the workload is I/O-bound at scale (ASGI) or low-concurrency and CPU-bound (WSGI).

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/wsgi-vs-asgi.png" width="400"> <a href="https://medium.com/@dynamicy/asgi-vs-wsgi-a-complete-guide-to-their-differences-and-fastapi-applications-9857f13c4521" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div>


## II
---

### **2.1. Multiprocessing**

<p style="margin-bottom: 12px;"> </p>

<!-- Progression: safe approach (multiprocessing) → fast approach (multithreading) → the cost of the fast approach (shared state) → naturally leads to 2.3 Synchronisation -->

[CPU-bound]() workloads (numerical computation, encryption, image processing) saturate the processor and benefit from true parallelism across multiple cores. Event loops solved the waiting problem, but computation needs real CPU time, and when single-core clock speeds plateaued (2004), exploiting multiple cores required distributing work across multiple execution contexts. Two approaches exist: [multiprocessing]() and [multithreading](). Most real systems are hybrid, with I/O stages feeding CPU stages in a pipeline (e.g. fetch data → transform → write), and the bottleneck shifts depending on load and data volume.

[Multiprocessing]() runs parallel work in separate processes, each with its own isolated address space. Because no memory is shared, there are no race conditions by construction, and a crash in one process cannot corrupt another. The trade-off is overhead: each process requires its own page table, file descriptor table, and kernel bookkeeping, and communication between processes requires explicit [IPC](). Python's *multiprocessing* module and *ProcessPoolExecutor* use this approach to bypass the GIL for CPU-bound work, spawning worker processes that communicate results via serialisation (pickle). Fork-based multiprocessing is also how traditional web servers (Apache prefork) and database engines (PostgreSQL) achieve parallelism.

- ...

### **2.2. Multithreading**

<p style="margin-bottom: 12px;"> </p>

[Multithreading]() runs parallel work in threads within the same process. Since all threads share the same [address space](), they read and write the same [heap]() (dynamically allocated memory) and share the process's code, data/BSS segments, and kernel resources (file descriptor table, signal handlers) without any IPC mechanism, making communication fast but demanding synchronisation. [Thread pools]() pre-create a fixed number of threads and reuse them across tasks, avoiding the repeated syscall and stack allocation cost of per-task thread creation while matching thread count to core count. Python 3.13 (2024) introduced an experimental [free-threaded mode]() (PEP 703) that disables the GIL entirely, enabling true multithreaded parallelism for CPU-bound CPython code for the first time.

<!--
Analogy (people = cores, calculators = memory):
Multiprocessing:  2 people, 2 calculators. True parallelism, full isolation.
                  To share a result, write it on a note and pass it (IPC).
Multithreading:   2 people, 1 calculator (shared memory). True parallelism,
                  but must coordinate who presses buttons when (synchronisation).
GIL:              2 people, 1 calculator, but only one is allowed to touch it
                  at a time. The other just waits. You have the cores but can't use them.
-->

A function or data structure is [thread-safe]() if it can be called from multiple threads concurrently without producing incorrect results. Thread safety is achieved either by avoiding shared mutable state entirely (immutability, thread-local storage) or by protecting it with synchronisation primitives. The standard threading API on Unix-like systems is [POSIX Threads]() (*pthreads*), which provides *pthread_create*, *pthread_join*, *pthread_mutex_lock*, and related functions. Most languages wrap pthreads into higher-level APIs (Python's *threading*, Java's *java.lang.Thread*, C++'s *std::thread*).

The [$1 \colon 1$ model]() maps each user thread directly to a kernel thread. The kernel handles scheduling and can place threads on separate cores for true parallelism, but every thread creation requires a syscall and allocates a kernel stack (16 KB on x86-64 since Linux 3.16), making creation and context switching expensive. The [$m \colon 1$ model]() ([green threads](), early Java on Solaris) multiplexes many user threads onto a single kernel thread, so creation and switching happen entirely in user space at negligible cost. The trade-off is that the kernel sees only one thread, so no two user threads can run on different cores simultaneously, and a single blocking syscall (e.g. disk I/O) stalls all of them. The [$m \colon n$ model]() (Go goroutines, Erlang processes) multiplexes $m$ user threads onto $n$ kernel threads ($m \gg n$), combining cheap user-space switching with kernel-level parallelism across cores. A user-space [runtime scheduler]() assigns user threads to kernel threads and migrates them on blocking.


<!--
1:1 Model (pthreads, Java, Python threading)

  Your Program                          OS Kernel
  ┌─────────────────────┐              ┌──────────────────────┐
  │  Thread A ──────────┼──────────────┼→ Kernel Thread 1 ──→ Core 0
  │  Thread B ──────────┼──────────────┼→ Kernel Thread 2 ──→ Core 1
  │  Thread C ──────────┼──────────────┼→ Kernel Thread 3 ──→ Core 2
  │  Thread D ──────────┼──────────────┼→ Kernel Thread 4 ──→ Core 3
  └─────────────────────┘              └──────────────────────┘

  ✓ true parallelism (4 cores)
  ✗ each thread = syscall + 1-8 MB stack + kernel bookkeeping


m:1 Model (green threads, early Java on Solaris)

  Your Program                          OS Kernel
  ┌─────────────────────┐              ┌──────────────────────┐
  │  User Thread A ─┐   │              │                      │
  │  User Thread B ─┤   │              │                      │
  │  User Thread C ─┼───┼──────────────┼→ Kernel Thread 1 ──→ Core 0
  │  User Thread D ─┤   │              │                      │
  │  User Thread E ─┘   │              │                      │
  │                     │              │  Core 1 (idle)       │
  │  [user scheduler    │              │  Core 2 (idle)       │
  │   picks A,B,C,D,E   │              │  Core 3 (idle)       │
  │   one at a time]    │              │                      │
  └─────────────────────┘              └──────────────────────┘

  ✓ cheap creation (no syscall, tiny stack)
  ✗ no parallelism (OS sees 1 thread, uses 1 core)
  ✗ one blocking syscall stalls all threads


m:n Model (Go goroutines, Erlang processes)

  Your Program                          OS Kernel
  ┌─────────────────────┐              ┌──────────────────────┐
  │  Goroutine 1 ─┐     │              │                      │
  │  Goroutine 2 ─┼─────┼──────────────┼→ Kernel Thread 1 ──→ Core 0
  │  Goroutine 3 ─┘     │              │                      │
  │                     │              │                      │
  │  Goroutine 4 ─┐     │              │                      │
  │  Goroutine 5 ─┼─────┼──────────────┼→ Kernel Thread 2 ──→ Core 1
  │  Goroutine 6 ─┘     │              │                      │
  │                     │              │                      │
  │ [runtime scheduler  │              │                      │
  │  assigns goroutines │              │  Core 2 (available)  │
  │  to kernel threads, │              │  Core 3 (available)  │
  │  migrates on block] │              │                      │
  └─────────────────────┘              └──────────────────────┘

  ✓ cheap creation (user space, ~2 KB stack)
  ✓ true parallelism (multiple kernel threads on multiple cores)
  ✓ blocking handled (runtime moves goroutine to another kernel thread)
-->

- ...

### **2.3. Synchronisation**

<p style="margin-bottom: 12px;"> </p>

Multithreading's shared address space makes communication fast but introduces a fundamental problem. A single source-level statement (e.g. *x += 1*) compiles to multiple machine instructions (load, add, store), and a timer interrupt can preempt the thread between any of them. The order of interleaved operations is [non-deterministic](), determined by the OS scheduler and hardware timing rather than the program. Two threads reading and writing the same variable can produce different results on every run, and bugs may only manifest under specific interleavings that are hard to reproduce ([Heisenbugs]()). A [critical section]() is a code region where shared state is accessed and that must execute [atomically]() with respect to other threads. Without proper synchronisation, concurrent access to a critical section produces [race conditions]() where correctness depends on timing, e.g. two threads both reading a balance of 100, then independently writing 150 and 70, losing one update entirely.

Hardware adds a further layer of difficulty. [Memory consistency models]() define ordering guarantees for operations across threads. [Sequential consistency]() ensures a global total order, but most hardware provides relaxed consistency that reorders loads and stores for performance: x86-TSO is relatively strong (only store-load reordering), while ARM weak ordering permits load-load, load-store, and store-store reorderings as well. [Memory barriers]() (fences) are ISA-level instructions (*mfence* on x86, *dmb* on ARM, *fence* on RISC-V) that force ordering, and compilers insert these behind language-level primitives (e.g. *std::atomic* in C++, *volatile* in Java). [Happens-before]() relationships formalise which operations are guaranteed visible to other threads.

<!-- Synchronisation stack (top to bottom):
Application: threading.Lock(), asyncio.Lock(), multiprocessing.Lock()
Language:    std::atomic, synchronized (Java), Send/Sync (Rust)
Library:     pthread_mutex_lock(), pthread_barrier_wait()
Kernel:      futex() (Linux), manages sleep/wake queues
Compiler:    inserts barrier instructions at synchronisation points
ISA:         mfence (x86), dmb (ARM), fence (RISC-V)
Hardware:    CPU flushes/orders its memory pipeline

C barrier APIs (used in OS/kernel development):
  Linux kernel:  smp_mb(), smp_rmb(), smp_wmb(), barrier()
  GCC/Clang:     __sync_synchronize(), __atomic_load_n(&x, __ATOMIC_ACQUIRE)
  C11 standard:  atomic_thread_fence(memory_order_seq_cst)
These macros expand to the appropriate ISA instruction per architecture. -->

- ...

A [mutex]() (mutual exclusion lock) puts a waiting thread to sleep until the lock is released, while a [spinlock]() keeps the thread running in a tight loop checking repeatedly. Spinlocks avoid the overhead of a context switch and are faster when the lock is held briefly on multicore systems (another core can release the lock while the spinner runs), but waste CPU cycles if the holder is slow or on a single core where spinning prevents the holder from running at all. A [reentrant lock]() (recursive mutex) allows the same thread to acquire the lock multiple times without deadlocking against itself, maintaining an acquisition count. [Read-write locks]() allow concurrent reads but exclusive writes, optimising for read-heavy workloads where writers are rare.

[Semaphores]() generalise mutual exclusion with an integer counter that permits up to $N$ threads to enter a critical section simultaneously, where a [binary semaphore]() ($N = 1$) behaves like a mutex. [Condition variables]() allow a thread to atomically release a lock and sleep until another thread signals that a predicate has changed, and the waiting thread must recheck the predicate in a while loop because of [spurious wakeups]() (the thread may be woken without a signal). [Atomic operations]() such as [compare-and-swap]() (CAS), which atomically checks whether a memory location holds an expected value and replaces it only if it does, provide the building blocks for [lock-free]() data structures that bypass locks entirely for higher throughput under contention.

These primitives are best understood through classical synchronisation problems. The [producer-consumer]() (bounded buffer) problem has producers writing to a fixed-size buffer and consumers reading from it, requiring a mutex to protect the buffer and two semaphores (or condition variables) to block producers when the buffer is full and consumers when it is empty. The [readers-writers]() problem allows multiple concurrent readers but requires exclusive access for writers, typically solved with a read-write lock or a pair of mutexes tracking reader count. Both problems illustrate that correct synchronisation requires choosing the right primitive for the access pattern, not simply wrapping every operation in a lock.

[Deadlock]() occurs when threads are permanently blocked in a circular dependency. The four [Coffman conditions]() must all hold simultaneously, namely mutual exclusion, hold-and-wait, no preemption, and circular wait. The [dining philosophers problem]() (Dijkstra, 1965) illustrates all four: five philosophers share forks with neighbours, each grabs one fork and waits for the other, forming a circular dependency that deadlocks. Breaking any single condition prevents it, e.g. always picking up the lower-numbered fork first eliminates circular wait. Prevention strategies include consistent lock ordering, timeout mechanisms, and deadlock detection algorithms. [Livelock]() (threads continuously change state without making progress) and [starvation]() (a thread perpetually denied access) are related failure modes.

- ...

<!-- Scheduling algorithms moved to 403 §3.1 (Process Management) where they naturally belong.
Backpressure and work-stealing are application-level patterns, not OS scheduling. -->


{% comment %}
## III
---

### **3.1. Parallel Patterns**

<p style="margin-bottom: 12px;"> </p>

[MapReduce](), introduced by Dean and Ghemawat at Google (2004), formalises a pattern where input data is split into partitions, each processed independently by a *map* function, and intermediate results are aggregated by a *reduce* function. [Apache Spark]() improves upon Hadoop's MapReduce with in-memory computation and lazy evaluation of RDD transformations, achieving significant speedups for iterative algorithms. The *shuffle* phase, where intermediate key-value pairs are redistributed across nodes, remains the primary bottleneck due to serialisation, network transfer, and disk I/O.

The [fork-join]() model recursively decomposes problems into independent sub-problems (fork), solves them in parallel, and combines results (join). Java's ForkJoinPool and Cilk's spawn/sync implement this with [work-stealing]() schedulers that achieve good load balancing while preserving cache locality. [Pipeline parallelism]() distributes sequential stages across processors, with bounded buffers regulating flow, where throughput is limited by the slowest stage.

In ML, these patterns map onto two axes. [Data parallelism]() replicates the model across devices and partitions the input (e.g. DDP), while [model parallelism]() partitions the model itself. Pipeline parallelism (e.g. GPipe, PipeDream) is a form of model parallelism that distributes layers across GPUs, allowing different micro-batches to occupy different stages simultaneously. [Tensor parallelism]() (e.g. Megatron-LM) splits individual layers across devices for very large models.

### **3.2. Distributed Systems**

<p style="margin-bottom: 12px;"> </p>

Distributed concurrency extends threading and synchronisation primitives across network boundaries, where communication is unreliable and latency is orders of magnitude higher than shared-memory access. Systems must contend with [network partitions]() (where nodes cannot communicate), partial failures (where some nodes crash while others continue), and clock skew. The [CAP theorem]() formalises a fundamental constraint, that a distributed system can guarantee at most two of Consistency, Availability, and Partition tolerance. In practice, partitions are inevitable, so systems choose between CP (e.g. ZooKeeper, etcd) and AP (e.g. Cassandra, DynamoDB) trade-offs. [Eventual consistency]() relaxes strong guarantees, allowing replicas to temporarily diverge and converge over time through conflict resolution strategies such as last-writer-wins, vector clocks, or CRDTs.

[Consensus]() is the problem of getting multiple nodes to agree on a single value or sequence of values in the presence of failures. [Paxos](), proposed by Lamport (1998), was the first provably correct consensus protocol but is notoriously difficult to implement. [Raft]() (2014) was designed as an understandable alternative, decomposing consensus into leader election, log replication, and safety. Both use quorum-based decisions, requiring a majority of nodes to agree before a value is committed. Coordination services like [ZooKeeper]() and [etcd]() build on consensus to provide distributed locks, leader election, and service discovery.

The [actor model](), popularised by Erlang, encapsulates state within actors that communicate exclusively through asynchronous message passing, eliminating shared mutable state by design. Frameworks like Akka (JVM) and Ray (Python) implement this pattern. Message queues such as RabbitMQ and Apache Kafka extend asynchronous communication across services, decoupling producers from consumers for high-throughput stream processing with durability and replay guarantees.

### **3.3. Concurrent Data Structures**

<p style="margin-bottom: 12px;"> </p>

[Lock-based]() concurrent data structures range from coarse-grained locking (a single lock protecting the entire structure, simple but poor scalability) to fine-grained locking (per-node or per-bucket locks, better concurrency but more complex). [Lock-free]() data structures guarantee system-wide progress even if individual threads are delayed. The [ABA problem](), where a value changes from A to B and back to A making CAS believe nothing changed, is addressed through versioning (tagged pointers) or hazard pointers. [Wait-free]() structures provide the strongest guarantee, that every operation completes in bounded steps, while [transactional memory]() (hardware via Intel TSX, or software STM) offers an optimistic alternative that executes speculatively and rolls back on conflict.

Concurrency introduces several categories of overhead. Context switching costs 1-10 microseconds per switch and degrades cache locality. Lock contention arises when threads compete for the same lock, where spinning wastes CPU cycles but avoids scheduling latency, while blocking frees the CPU but incurs wake-up overhead. [False sharing]() causes the MESI coherence protocol to bounce cache lines between cores even when threads access unrelated data, and padding structures to cache-line boundaries mitigates this. Memory allocator contention is another bottleneck, and allocators like jemalloc and tcmalloc use per-thread arenas to reduce it.

Optimisation strategies include lock-free algorithms (reducing contention via CAS), batching (amortising synchronisation cost), CPU affinity (*taskset*, *pthread_setaffinity_np*) to preserve cache warmth, and prefetching (*__builtin_prefetch*) to hide memory latency. Profiling tools such as *perf* (Linux), Instruments (macOS), and Intel VTune provide hardware performance counters. Thread-specific profilers (*py-spy*, *async-profiler*, *pprof*) identify lock contention hotspots, while [ThreadSanitizer]() (TSan) detects data races at runtime. For distributed systems, [Jaeger]() and Zipkin provide distributed tracing across services.

### **3.4. Applications**

<p style="margin-bottom: 12px;"> </p>

Traditional web servers like Apache use a thread-per-request model, spawning a thread for each incoming connection. This scales poorly as each thread consumes ~1 MB of stack memory. Event-driven servers like [Nginx]() and Node.js use a single-threaded event loop with non-blocking I/O multiplexing, handling tens of thousands of concurrent connections with minimal memory overhead. Nginx uses a multi-process architecture where each worker runs an independent event loop, while Node.js delegates CPU-bound work to a thread pool via libuv.

[Database systems]() are among the most complex concurrent systems. [Transaction isolation levels]() (Read Uncommitted, Read Committed, Repeatable Read, and Serialisable) define the degree to which concurrent transactions observe each other's intermediate state. [MVCC]() (Multi-Version Concurrency Control), used by PostgreSQL, MySQL/InnoDB, and Oracle, allows readers and writers to operate concurrently by maintaining multiple row versions, avoiding read-write locks entirely. Distributed databases like CockroachDB and Spanner extend these guarantees across nodes using distributed consensus and synchronised clocks.

In ML, the key concurrency challenge is overlapping computation with communication. DataLoader prefetches batches concurrently with GPU computation, while DDP overlaps backward computation with gradient synchronisation via bucketed [AllReduce](), the primary communication bottleneck in distributed training. High-frequency trading represents the opposite extreme, with sub-microsecond latencies achieved through lock-free data structures (e.g. LMAX Disruptor), CPU affinity and interrupt isolation (*isolcpus*), and kernel bypass techniques (DPDK, RDMA).

<!-- - <div style="position: relative; display: inline-block; background-color: white"> <img src="https://pylessons.com/media/Tutorials/YOLO-tutorials/YOLOv4-TF2-multiprocessing/1.png" width="500" height="220"> <a href="https://pylessons.com/YOLOv4-TF2-multiprocessing" target="_blank" style="position: absolute;  bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div> -->

Common concurrency bugs include [race conditions]() (correctness depends on timing), [data races]() (unsynchronised concurrent access with at least one write), [TOCTOU]() bugs (state changes between check and use), and atomicity violations. Testing is inherently difficult due to non-determinism, and stress testing with randomised scheduling, [model checking]() (e.g. TLA+), and formal verification supplement traditional unit tests. Design principles that prevent these bugs at the architecture level include immutability, message passing, the actor model, and functional programming.

<!--
TODO: revise

Low-level CS knowledge (memory ordering, atomics, memory hierarchy, thread scheduling)
is traditionally the domain of systems programmers working in C/C++, who build OS kernels,
databases, compilers, and runtimes. But the boundary is shifting: Rust is replacing C/C++
for systems work (Linux kernel accepts Rust since 2022), and Go handles concurrency at
scale without manual memory management.

CUDA kernel programmers occupy an unusual position: application-level in purpose (ML
training, inference) but systems-level in practice (managing GPU memory hierarchy, warp
scheduling, shared memory tiling). The concurrency concepts from this post (threads,
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
and configuring DataLoader workers and pinned memory. The depth of concurrency knowledge
needed scales with the layer you work at, but understanding the full stack from
threading.Lock() down to hardware memory barriers makes you a better engineer at any level.

Kernel developers:     OS kernel, drivers, firmware        (C, Rust)
Systems programmers:   databases, compilers, runtimes      (C++, Rust, Go)
CUDA developers:       GPU kernels, custom ops, Triton     (CUDA C++, PTX)
Application engineers: web servers, ML training pipelines  (Python, JS, Java)
-->
{% endcomment %}
