# Event loops, the GIL, and deploying an LLM agent server

## Event loop basics

- The event loop **is** the main thread. `asyncio.run()` turns the main thread into the loop. There is no separate main thread beside it. One thread total.
- The loop cycle: run every ready coroutine to completion, then, only when none is runnable, call `epoll_wait()` and sleep. Wake on the next ready descriptor and repeat.
- "Block on the kernel's multiplexing interface" means the thread parks in `epoll_wait()` and consumes zero CPU until the kernel signals that one or more watched descriptors are ready, then returns them all in a batch. One syscall watches thousands of sockets.

## Two levels of "wait"

- **Application level** — `await db.read()` does not sleep the thread. It suspends *your* coroutine and hands control to the loop, which runs another request's coroutine. This is where concurrency comes from.
- **Kernel level** — the thread only truly sleeps in `epoll_wait()` when *every* in-flight request is parked on I/O and nothing is runnable. Rare under load.

So while request A waits on the DB, the same thread is running request B. It idles only when all requests wait at once.

## CPU-bound work in an async server

- A CPU-bound handler (e.g. heavy pure-Python compute) never `await`s, so it freezes the single loop thread and stalls every other request. Head-of-line blocking.
- Offload it. The GIL decides how:
  - **Thread pool** frees the loop but does not parallelise pure-Python compute — the GIL serialises bytecode. Only helps for blocking I/O or C extensions (NumPy).
  - **Process pool** gives real multicore compute — each process has its own interpreter and GIL.
- Real CPU parallelism always comes from **multiple processes**, never more threads in one process.

## Cores are a shared budget

- A worker process uses one core. You get multiple cores only by running multiple processes.
- Everything competes for the same physical cores. Do not run N workers *and* an N-process pool on N cores — that is oversubscription and thrashing.
- Constraint: `worker_processes + executor_processes ≈ cores`.

## My case — LLM agent server + Python executor

Two legs on opposite sides of the split:

- **LLM API calls** are I/O-bound — mostly network wait, near-zero CPU. Put them on the event loop (`await`). Hundreds can be in flight cheaply. They compete for memory and connections, not cores.
- **Python executor** is CPU-bound and runs arbitrary code. Must run in **separate processes**, for three reasons:
  - Parallelism (own GIL, real cores).
  - Isolation — a crash, OOM, or memory bomb kills the child, not the server.
  - Cancellation — a subprocess can be killed on timeout, a pure-Python thread cannot be cleanly interrupted.

Because the LLM side barely touches CPU, the executor pool can take almost all the cores. The real bottleneck is the moment many agents hit the compute step at once, so the executor pool needs a queue and a per-task timeout.

### Implementation strategies (cheapest to most robust)

1. **Same box, process pool.** Async server + `ProcessPoolExecutor` (size ≈ cores), `await loop.run_in_executor(pool, run_code, ...)`. Add a queue and timeout.
2. **Same box, sandboxed subprocess per run.** Fresh resource-limited process per execution, killable on timeout/OOM. Bound concurrency with a semaphore. Adds isolation and clean cancellation.
3. **Separate executor service.** Move the executor to its own container/box behind an API or task queue (Celery/RQ). Scale and secure independently. Best under real load.

Start with 1, move to 3 when compute load or security demands it.

### Gunicorn / Uvicorn worker count

- They are not alternatives. **Gunicorn** is the process manager that forks and supervises workers, **Uvicorn** is the ASGI server each worker runs (`-k uvicorn.workers.UvicornWorker`). Gunicorn cannot run async apps alone. You can also skip Gunicorn and use `uvicorn --workers N`, Gunicorn just adds better supervision.
- Default rule is one worker per core. **My case is the exception** — the LLM load is I/O-bound and barely uses CPU, so 1-2 workers suffice and the rest of the cores go to the executor pool.
- On 4 cores, roughly 1 Uvicorn worker + 3 executor processes.

### The stack

`asyncio` (event loop) ← `Uvicorn` (ASGI server, drives the loop, speaks HTTP) ← `FastAPI` (app framework, `async def` endpoints are the coroutines) + `Gunicorn` (process manager, forks one worker per core).

## Deploying on a 4-core instance (mixed I/O + CPU)

The server is mixed. Most requests are I/O-bound (LLM API calls), but a request that spawns a subagent → Python executor becomes CPU-bound. The deployment must serve both without one starving the other.

**Key correction:** the event loop is never the CPU-bound part. Even on a compute request, the loop only `await`s the result — the actual CPU work runs in a separate executor process the OS schedules on any free core. So do **not** pin cores to "loop vs compute" per app. Cores aren't owned by apps; the scheduler load-balances all processes across all four.

### Wrong options

- **Four Uvicorn workers (one per core).** Four event loops is overkill for I/O (one loop already serves hundreds of concurrent `await`s). Worse, a compute burst has no dedicated processes: it either blocks a worker's loop inline (head-of-line stall), or — if you add an executor pool on top — gives 4 loops + N executors > 4 cores → oversubscription and thrashing.
- **2 cores per app, one for the loop + one for compute.** Static pinning wastes capacity. Under pure I/O the "compute cores" sit idle; under a burst, two cores can't absorb it. Let the scheduler decide.

### Right shape (asymmetric)

A few event-loop workers + a separate executor process pool, with total processes ≈ cores.

| Component | Count | Role |
|---|---|---|
| Uvicorn worker (event loop) | 1–2 | I/O orchestration, LLM `await`s |
| Executor processes | 2–3 | the Python-executor compute |
| **Total** | **≈ 4** | matches the core budget |

Because the server leg is nearly pure I/O, spend most of the box on the executor.

```
                          ┌───────────────────────────────┐
   I/O request  ─────────▶│  Uvicorn worker (event loop)  │──▶ hundreds of
   (LLM API call)         │  await api()  ── stays on loop │    concurrent awaits
                          │                               │
  compute request ──────▶│  await run_in_executor(...) ──┼──┐  dispatch
  (subagent → executor)   └───────────────────────────────┘  │
                                                              ▼
                                        ┌──────────────────────────────────┐
                                        │  Executor process pool            │
                                        │  proc 1   proc 2   (own GIL each)  │  real CPU
                                        │  queue + per-task timeout + kill   │  parallelism
                                        └──────────────────────────────────┘

  core budget:  ~2 loop workers  +  ~2 executor procs  ≈  4 cores
  (optional) Nginx in front: TLS termination, buffering slow clients
```

### Concrete

- `gunicorn -k uvicorn.workers.UvicornWorker --workers 2` (2 supervised loops) + `ProcessPoolExecutor(max_workers=2)` with a queue and per-task timeout.
- The executor runs arbitrary code, so prefer a killable subprocess-per-run (isolation, OOM/timeout kill) over a plain pool — strategy 2/3 above.
- Containerised: drop Gunicorn, run 1 Uvicorn worker per container, let K8s replicate. Keep the executor pool inside each pod or as a separate executor service.
- Caveat: `run_in_executor` with a `ProcessPoolExecutor` pickles args/results, so heavy or unpicklable payloads push you toward a dedicated executor service with its own transport.
