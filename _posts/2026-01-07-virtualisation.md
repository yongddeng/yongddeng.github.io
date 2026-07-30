---
layout: default
title: "607. virtualisation"
tags: cs600
use_math: true
---


# Virtualisation
---
> Hardware used to dictate what software could do. Virtualisation inverted that relationship. Since IBM CP-40 (1967), the story has been to "abstract the machine away" $\to$ "slice it thinner" $\to$ "pack more workloads onto fewer boxes". Began with hypervisors that virtualise entire computers, then containers that isolate without duplicating the kernel, and now orchestrators that manage thousands of both.

<!-- - https://www.youtube.com/watch?v=zh0OMXg2Kog -->

<!-- Horizontal (within Section I): how to virtualise one resource more completely
  - 1.1 VM concept → 1.2 CPU virtualisation (x86 problem → solutions) → 1.3 all hardware (CPU + memory + storage + network)
Vertical (across sections): moving up the stack
  - Section I: virtualise hardware (full machine emulation)
  - Section II: virtualise OS (share kernel, isolate processes)
  - Section III: orchestrate many containers at scale -->

## I
---

### **1.1. Virtual Machine**

<p style="margin-bottom: 12px;"> </p>

Physical servers historically ran one application each at 10-15% capacity. [Virtualisation]() solved it by executing guest code natively on the same ISA, intercepting only sensitive operations, allowing dozens of isolated workloads per machine. Hence, a [virtual machine]() (VM) is a software abstraction of a physical computer with its own virtualised CPU, RAM, disk, and NIC, where a full guest OS boots and runs unmodified, i.e. a [system VM]() virtualising full hardware, unlike a process VM (e.g. JVM, PVM, §602#3.1) which virtualises only a bytecode ISA for a single program. While virtualisation is distinct from [emulation](), which translates a foreign ISA entirely in software (e.g. QEMU in TCG mode running an ARM guest on an x86 host), it gave rise to cloud computing via server consolidation and multi-tenancy.

A [hypervisor]() (aka. [VM monitor]()) creates and manages VMs. [Type 1 hypervisors]() (bare-metal) run directly on host hardware without an underlying OS, e.g. VMware ESXi, MS Hyper-V (Azure), and KVM (AWS, GCP). [Type 2 hypervisors]() (hosted), e.g. VirtualBox and VMware Workstation, run as applications on a conventional OS, trading performance and isolation for convenience. KVM blurs the boundary: it is a kernel module that turns Linux itself into a Type 1 hypervisor, reusing Linux's scheduler, memory allocator, and device drivers rather than implementing its own.

[Popek and Goldberg (1974)](https://dl.acm.org/doi/10.1145/361011.361073) formalised when this interception can be done purely by hardware privilege. An instruction is i) [sensitive]() if it alters machine configuration or behaves differently depending on it, and ii) [privileged]() if it traps when executed outside the highest privilege level. If sensitive $\subseteq$ privileged, every sensitive operation traps automatically when the guest runs at reduced privilege, and [trap-and-emulate]() suffices. IBM mainframes satisfied this condition, and virtualisation thrived there for decades. x86 did not, as certain sensitive instructions executed silently in user mode instead of trapping, forcing the software workarounds that §1.2 traces.

{% comment %}
1. Guest runs ALL code directly on the CPU at a lower privilege level.
2. Normal instructions (arithmetic, loads, branches) execute at full speed, no intervention.
3. Privileged instructions trap (hardware exception) → hypervisor emulates that one instruction → returns control.
4. 99%+ of instructions never involve the hypervisor.
5. x86 problem: some sensitive instructions don't trap, they silently execute with wrong results, so the hypervisor never gets to intercept them.
{% endcomment %}

{% comment %}
1. 1960s: IBM mainframes virtualised cleanly (CP-40, 1967). P-G formalised why it worked (1974). Trap-and-emulate was sufficient.
2. 1980s-90s: x86 rose to dominance but violated P-G. Nobody cared because mainframes were where virtualisation lived.
3. Late 1990s-2000s: x86 servers needed virtualisation (server consolidation). Software workarounds filled the gap (VMware BT 1999, Xen paravirt 2003).
4. 2005-06: Intel/AMD added hardware support (VT-x, AMD-V). Problem solved at the CPU level.
5. Then: EPT/NPT for memory, SR-IOV for networking, etc.
§I follows logical dependency (theory → CPU problem → all resources) rather than strict chronology.
{% endcomment %}

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/hypervisor.webp" width="300" height="165"> <a href="https://microkerneldude.org/2010/10/14/much-ado-about-type-2/" target="_blank" style="position: absolute; top: 4px; left: 4px; font-size: 12px;">[src]</a> </div>

<!-- - <div style="position: relative; display: inline-block;"> <img src="../assets/blog/trap-and-emulate.webp" width="350"> <br><span style="font-size: 11px; color: #555;">trap-and-emulate on a Type 1 hypervisor</span> <a href="https://dev.to/mdraevich/virtualization-emulation-explained-in-a-top-down-fashion-2of8" target="_blank" style="position: absolute; bottom: 4px; left: 4px; font-size: 12px;">[src]</a> </div> -->

### **1.2. CPU Virtualisation**

<p style="margin-bottom: 12px;"> </p>

On x86, instructions such as *POPF* and *SGDT* are sensitive but not privileged, so they execute silently in user mode instead of trapping. Two software workarounds emerged. VMware (1999) introduced [binary translation](), scanning the guest instruction stream at runtime and rewriting sensitive instructions into safe sequences that trap or emulate correctly. Xen (2003) took the opposite path with [paravirtualisation](), modifying the guest kernel to replace sensitive instructions with explicit [hypercalls]() to the hypervisor.

Intel [VT-x]() (2005) and [AMD-V]() (2006) eliminated both workarounds in hardware. A new non-root execution mode and a [VM control structure]() (VMCS/VMCB) cause sensitive instructions to [VM exit]() to the hypervisor regardless of privilege level, satisfying P-G by hardware extension. The hypervisor handles the exit, adjusts guest state, and executes *VMRESUME* to return control. [KVM]() (2007) exposes this hardware to user space through */dev/kvm*, while [QEMU]() emulates the remaining devices (virtual disks, NICs, display) and manages the guest lifecycle.

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/paravirt.jpeg" width="325"> <a href="https://dgtlinfra.com/server-virtualization/" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div>

<!-- - <div style="position: relative; display: inline-block;"> <img src="../assets/blog/hypercall.png" width="500"> <a href="https://idery-123.tistory.com/74" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div> -->

### **1.3. Resource Virtualisation**

<p style="margin-bottom: 12px;"> </p>

Just as an OS multiplexes processes onto shared hardware, a hypervisor multiplexes VMs one level below: abstract, isolate, overcommit. The hypervisor presents each VM with [virtual CPUs]() (vCPUs) scheduled onto physical cores. [Overcommitment]() allows a host with 64 cores to run 200 vCPUs (~3:1 for general workloads) under the assumption that not all VMs demand full CPU simultaneously, but introduces scheduling complexity: the guest OS scheduler is unaware that its vCPUs are themselves being preempted. [Lock-holder preemption]() is when a guest thread holding a spinlock is descheduled, and other guest threads spin wastefully waiting for a lock whose holder is not running.

Each VM sees its own physical address space, so translation composes two partial functions, the guest's $\pi_g$ (guest-virtual $\rightharpoonup$ guest-physical, §603#3.2) and the hypervisor's $\pi_h$ (guest-physical $\rightharpoonup$ host-physical). Without hardware support, [shadow page tables]() materialised the composition $\pi_h \circ \pi_g$, trapping on every guest page-table update to keep it in sync. [Extended page tables]() (EPT on Intel, NPT on AMD) instead evaluate the composition lazily in hardware, eliminating the traps. Each access of the guest's walk then requires its own EPT walk, so a TLB miss on 4-level paging can cost up to $(4{+}1) \times (4{+}1) - 1 = 24$ memory references, but this nested overhead is far cheaper than shadow tables' constant trap-and-update cost. Memory can also be overcommitted: [memory ballooning]() reclaims pages from underutilising VMs by inflating a balloon driver that forces the guest to surrender physical frames back to the host, and [kernel same-page merging]() (KSM) deduplicates identical pages across VMs via copy-on-write.

Storage follows the same pattern of indirection: virtual disks are files (VMDK, QCOW2, VHD) on the host file system. [Thin provisioning]() allocates physical storage only as the guest writes data rather than reserving the full virtual disk size upfront, so a 100 GB virtual disk might occupy only 20 GB on the host. [Snapshots]() capture the disk state at a point in time by redirecting subsequent writes to a new differencing layer, enabling instant rollback.

Each VM also needs network access. The hypervisor assigns one or more virtual NICs connected through a [virtual switch]() (e.g. Open vSwitch) running on the host. The virtual switch forwards frames between VMs on the same host at memory speed and routes external traffic through the physical NIC. Most cloud VMs use [VirtIO]() devices, a standardised paravirtual interface where the guest cooperates with the hypervisor through shared memory ring buffers, avoiding the overhead of emulating real hardware. For workloads that need bare-metal network performance, [SR-IOV]() (Single Root I/O Virtualisation) allows a single physical NIC to present multiple lightweight [virtual functions]() directly assignable to a VM, bypassing the virtual switch entirely, while an [IOMMU]() such as Intel [VT-d]() isolates each function's DMA to the correct VM's memory.

Because a VM is ultimately CPU/memory state plus virtual disk files, [live migration]() can move a running VM between physical hosts by iteratively copying memory pages while the VM continues executing, then briefly pausing (typically under 100 ms) to transfer the final dirty pages and switch execution to the destination.


## II
---

### **2.1. Container**

<p style="margin-bottom: 12px;"> </p>

[OS-level virtualisation](https://en.wikipedia.org/wiki/OS-level_virtualization) (aka. [containerisation]()) eliminates the per-VM OS overhead by sharing a single host kernel, reducing startup to sub-seconds and memory to megabytes per instance. The tradeoff is weaker isolation because all containers share the same kernel, so a kernel-level escape can compromise the host and every container on it. [MicroVM]() runtimes (e.g. AWS Firecracker, which underpins Lambda and Fargate) and sandboxed runtimes (e.g. gVisor's user-space kernel) occupy the middle ground, restoring per-workload hardware isolation at near-container startup cost. FreeBSD jails (2000) and Solaris Zones (2005) pioneered this model on their own kernel mechanisms, while [LXC](https://linuxcontainers.org/) (2008) and [Docker](https://www.youtube.com/watch?v=ObhdD49AEYw) (2013) brought it to Linux (§603#1.3). Specifically, a [container]() is not a kernel primitive but a user-space abstraction built from two Linux kernel features, i) [namespaces]() that restrict the process's view of the system; and ii) [cgroups]() that limit the hardware resources available.


{% comment %}
Host kernel (single instance)
│
├── Container 1 (namespaces)              Container 2 (namespaces)
│   PID:   1(nginx)  2(worker)            PID:   1(flask)  2(gunicorn)
│   Net:   eth0 172.17.0.2                Net:   eth0 172.17.0.3
│   Mnt:   / → /var/lib/.../ct1           Mnt:   / → /var/lib/.../ct2
│
└── Host view (default namespace)
    PID:   1(systemd) ... 3847(nginx) 3848(worker) 3901(flask) 3902(gunicorn)

Container 1's nginx thinks it is PID 1, but the host sees it as PID 3847.
Same process, different namespace views.
{% endcomment %}


Both are documented in the Linux [man-pages](https://man7.org/linux/man-pages/) project. A namespace (_kernel/nsproxy.c_) wraps a global resource so processes inside see their own isolated instance. Linux provides eight types: pid gives each container a PID tree rooted at 1, net gives it a private network stack, mnt with _pivot\_root()_ swaps the visible root filesystem, and user maps UID 0 inside to an unprivileged host UID for rootless containers. From the host, a container's PID 1 is just another process in the default namespace, assembled by calling _clone()_ with the desired namespace flags.

A cgroup (_kernel/cgroup/_) organises processes into hierarchical groups and caps their hardware resources. Without cgroups a single container could exhaust host memory or monopolise CPU, so the kernel enforces limits on CPU shares, memory (with an OOM killer scoped to the cgroup), I/O bandwidth, and device access. Driven by Google's experience running [Borg](https://research.google/pubs/large-scale-cluster-management-at-google-with-borg/?hl=it) on shared machines, cgroups were merged in 2008 (Linux 2.6.24). Cgroups v2 unified the fragmented v1 hierarchies into a single tree and added per-cgroup [pressure stall information]() (PSI) for observability. Note that cgroups also underpin Kubernetes resource requests and limits. Container isolation is further strengthened by Linux [capabilities](), [seccomp]() filters, and security modules such as AppArmor or SELinux, which restrict the system calls and privileges available to processes inside the container.

- <div style="position: relative; display: inline-block;"> <div style="background: white; display: inline-block;"> <img src="../assets/blog/kernel_features.png" width="350"> </div> <br><span style="font-size: 11px; color: #555;">kernel features underlying containers (5 of 8 namespace types shown)</span> <a href="https://bunny.net/academy/computing/what-is-a-linux-namespace-and-container-isolation/" target="_blank" style="position: absolute; top: 4px; right: 4px; font-size: 12px;">[src]</a> </div>

### **2.2. Docker**

<p style="margin-bottom: 12px;"> </p>


{% comment %}
Image A: FROM ubuntu:22.04, installs flask → 2 layers [ubuntu, flask]
Image B: FROM ubuntu:22.04, installs nginx → 2 layers [ubuntu, nginx]
On disk, Docker stores 3 layers total, not 4. The ubuntu layer exists once
and both images reference it by digest. If you pull image B from a registry
and already have image A locally, Docker only downloads the nginx layer
since the ubuntu layer's digest already exists locally.
{% endcomment %}


{% comment %}
LXC (manual assembly via debootstrap, tarballs, or host copy):
  Full rootfs per container, no sharing
  Container A: /bin /lib /usr /etc ...  (2GB)
  Container B: /bin /lib /usr /etc ...  (2GB)
  Container C: /bin /lib /usr /etc ...  (2GB)
  Total: 6GB, no sharing

Docker (layered declaration):
  Dockerfile:
    FROM ubuntu:22.04        → layer 0 (base rootfs, 80MB)
    RUN apt-get install py3  → layer 1 (diff: +python3, 50MB)
    COPY app.py /app/        → layer 2 (diff: +app.py, 1KB)

  Container A: [layer 0] + [layer 1] + [layer 2] + writable
  Container B: [layer 0] + [layer 1] + [layer 3] + writable
  Container C: [layer 0] + [layer 4] + [layer 5] + writable
                  ↑              ↑
              shared (once     shared (once
              on disk)         on disk)
{% endcomment %}


Namespaces and cgroups isolate a process, but shipping it with its exact dependencies remained manual. Docker built on Linux container primitives but introduced a declarative, layered [image]() model where a [Dockerfile]() builds the rootfs incrementally (FROM, RUN, COPY), each step producing a content-addressed read-only layer that is shared on disk and skipped during pulls. The [open container initiative]() (OCI) standardised the image format and runtime specification, making images portable across any compliant runtime, while registries such as [Docker Hub]() and [Elastic Container Registry]() (ECR) handle distribution.

Docker turns an image into a running container. The [Docker daemon](https://www.youtube.com/watch?v=1UHaR54i3ak) exposes a REST API (§605#4.2) over a Unix socket (§603#3.1, local) or TCP socket (remote) through which the CLI builds, pushes, pulls, and runs containers. On _docker run_, the daemon delegates to [containerd](), whose snapshotter assembles the image layers into a rootfs via OverlayFS (§603#3.3), and [runc]() (i.e. the OCI reference runtime) then isolates and starts the process in it using _clone()_ and cgroup limits. The container lives as long as its PID 1 runs, and so its storage is ephemeral. Notice that on non-Linux hosts (e.g. macOS, Windows), [Docker Desktop]() runs a hidden Linux VM for these underlying kernel features. <!-- A Makefile is often used to wrap common docker and docker compose commands for convenience. -->

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/docker-architecture.png" width="375"> <a href="https://itnext.io/getting-started-with-docker-facts-you-should-know-d000e5815598" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div>

Writes inside a container go to the thin OverlayFS writable layer, a directory on the host that is deleted when the container is removed, and so Docker provides three mount types to outlive the ephemeral writable layer: i) [volumes]() mount a Docker-managed directory (e.g. _/var/lib/docker/volumes/_) at the VFS layer, bypassing OverlayFS entirely; ii) [Bind mounts]() map arbitrary host paths into the container's mount namespace; and iii) [tmpfs]() mounts store files entirely in memory rather than on persistent storage. Volumes suit databases and persistent state, bind mounts enable live code reloading during development, and tmpfs protects secrets that should never touch disk.

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/shared-volume.webp" width="300"> <a href="https://peeknpoke.net/docker-volume-management/" target="_blank" style="position: absolute; top: 4px; left: 4px; font-size: 12px;">[src]</a> </div>

{% comment %}
Host filesystem (ext4/xfs)
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  /var/lib/docker/overlay2/abc123/                       │
│  ┌───────────────────────────────────────────┐          │
│  │  R/W layer (CoW)                          │          │
│  │  nginx writes access.log here             │          │
│  │  ⚠ deleted on docker rm                   │          │
│  ├───────────────────────────────────────────┤          │
│  │  Layer 2  (RO)  COPY nginx.conf          │          │
│  ├───────────────────────────────────────────┤          │
│  │  Layer 1  (RO)  FROM nginx               │          │
│  └───────────────────────────────────────────┘          │
│                         ▲                               │
│                    OverlayFS merges                      │
│                         │                               │
│  ┌──────────────────────┴────────────────────┐          │
│  │         Container sees:                   │          │
│  │         /                                 │          │
│  │         ├── /etc/nginx/nginx.conf         │          │
│  │         ├── /var/log/nginx/access.log     │          │
│  │         ├── /data ──────────────────────┐ │          │
│  │         └── /src ─────────────────────┐ │ │          │
│  └───────────────────────────────────────┼─┼─┘          │
│                                          │ │            │
│         ┌────────────────────────────────┘ │            │
│         │ Volume                           │            │
│         ▼                                  │            │
│  /var/lib/docker/volumes/data/             │            │
│  ┌─────────────────────────┐               │            │
│  │  db files, uploads ...  │               │            │
│  │  ✓ survives docker rm   │               │            │
│  └─────────────────────────┘               │            │
│                                            │            │
│         ┌──────────────────────────────────┘            │
│         │ Bind mount                                    │
│         ▼                                               │
│  /home/user/src/                                        │
│  ┌─────────────────────────┐                            │
│  │  your source code       │                            │
│  │  edit on host →         │                            │
│  │  visible in container   │                            │
│  └─────────────────────────┘                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
{% endcomment %}

### **2.3. Docker Networking**

<p style="margin-bottom: 12px;"> </p>

{% comment %}
External network (internet)
       ↑↓ NAT (iptables)
       ↑↓ DNAT (-p 8080:80)
┌──────────────────────────────────────────┐
│  Host                                    │
│                                          │
│  ┌─────────── docker0 ───────────┐       │
│  │        (bridge, L2)           │       │
│  │                               │       │
│  │  Container A ←──→ Container B │  same bridge: L2 only (no DNS)
│  │  172.17.0.2       172.17.0.3  │
│  └───────────────────────────────┘
│                                          │
│  ┌─────────── demo_net ──────────┐       │
│  │        (bridge, L2)           │       │
│  │                               │       │
│  │  Service A  ←──→  Service B   │  user-defined: L2 + DNS
│  │  172.18.0.2       172.18.0.3  │
│  └───────────────────────────────┘       │
│                                          │
│  docker0 ←✗→ demo_net  different bridges: isolated
└──────────────────────────────────────────┘

Communication paths:
- Container ↔ external: NAT outbound, DNAT (port mapping) inbound
- Container ↔ container:
  - Same bridge: L2 forwarding (+ DNS on user-defined bridges)
  - Different bridges: isolated
{% endcomment %}

Docker connects each container, isolated in its own network namespace, to a [bridge]() (i.e. _docker0_) via a [virtual ethernet]() (veth) pair and assigns a private IP (e.g. 172.17.0.0/16, an RFC 1918 range, §605#2.1). Outbound traffic is NATed (§605#2.1) through iptables, and port mapping (_-p 8080:80_) adds DNAT rules for inbound. Whereas, containers on the same bridge communicate via the bridge's L2 switch (i.e. L2 forwarding within one broadcast domain, §605#1.3). In fact, [user-defined bridge networks]() add their own subnet (e.g. 172.18.0.0/16) with an embedded DNS server (127.0.0.11) for name resolution. Containers on different bridges are fully isolated, and _--network host_ bypasses namespace isolation entirely for direct host-level access.

[Docker Compose]() builds on user-defined bridges to orchestrate multi-service applications from a [YAML]() file, creating containers in dependency order with name-based service discovery. However, this only connects containers on the same host because a bridge operates at L2. [Overlay networks]() tunnel container traffic between hosts via [VXLAN]() (i.e. L2 frames encapsulated in UDP, §605#1.2), so containers on different machines communicate as if co-located. It is where single-host tooling reaches its limit, as managing containers across multiple hosts requires automated scheduling, health checking, and service discovery. §III extends these primitives to cluster-wide orchestration.

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/docker-networking.webp" width="500"> <a href="https://dev.to/nobleman97/docker-networking-101-a-blueprint-for-seamless-container-connectivity-3i5b" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div>


## III
---

### **3.1. Container Orchestration**

<p style="margin-bottom: 12px;"> </p>

Running containers on a single host suffices for development, but production deployments must schedule workloads across a [cluster]() (a set of networked machines), restart failed instances, balance load, and roll out updates without downtime. Container orchestration platforms solve this by treating a pool of machines as a single logical compute surface. The orchestrator maintains a [desired state]() (e.g. "run 5 replicas of this container with 2 CPUs and 4 GB each") and continuously reconciles reality to match it through a [control loop]() that observes the current state, computes the difference, and takes corrective action, i.e. the desired state is a fixed point of the reconcile map, toward which the loop drives the system anew after every disturbance. Declaring the fixed point rather than the path to it is what distinguishes orchestration from imperative commands. <!-- e.g. docker run -->

[Kubernetes](https://kubernetes.io/) (K8s <!-- K + 8 letters (ubernete) + s, same pattern as i18n and l10n -->), developed at Google building on Borg and open-sourced in 2014, separates a cluster into a [control plane]() and [worker nodes](). The control plane runs i) an [API server]() as the single RESTful entry point (§605#4.2); ii) [etcd]() as a distributed key-value store with Raft consensus; iii) a [scheduler]() that filters infeasible nodes then scores the rest; and iv) a [controller manager]() that runs one control loop per resource type. Each worker node runs a [kubelet]() that watches the API server for pod assignments and delegates container creation via the [container runtime interface]() (CRI) to a runtime such as containerd or CRI-O. Managed services (e.g. AWS: [EKS](), GCP: [GKE]()) host the control plane so that users only manage worker nodes and workloads.

A [pod]() is the fundamental scheduling unit, a group of one or more containers that share a network namespace, storage volumes, and a lifecycle. Most pods run a single container, but the abstraction allows co-locating tightly coupled containers as [sidecars]() (e.g. a web server alongside a log collector or service-mesh proxy) that share localhost and are scheduled together. Pods are ephemeral by design, so applications must either be stateless or externalise their state, a constraint that naturally encourages scaling and resilience to node failures.

{% comment %}
K8s manages containers across multiple machines automatically. You tell it what you want (desired state), and it figures out how to make it happen and keeps it that way.

Without K8s, you'd SSH into each server, run docker run manually, check if containers are alive, restart crashed ones, figure out which server has spare CPU, set up networking between them — all by hand or with fragile scripts.

K8s replaces all of that with one loop:
1. You submit a spec: "I want 5 copies of my app, each with 2 CPUs and 4 GB RAM"
2. The scheduler finds nodes with enough resources
3. The kubelet on each chosen node pulls the image and starts the containers (as pods)
4. The controller manager watches continuously — if a pod dies or a node goes down, it creates a replacement
5. A Service gives your pods a stable IP so other apps can find them regardless of which pods are alive

{% endcomment %}

{% comment %}
e.g. Airflow KubernetesExecutor submits a pod spec to the K8s API server, the scheduler picks a node, kubelet starts the container, and when the task finishes, the pod is cleaned up. If the node crashes mid-task, K8s reschedules it elsewhere.

Real-world example: DE hosted Airflow on EC2. I built a separate Airflow project
with a DAG (Python 3.13 + different libs). K8s solved the dependency isolation —
my DAG ran in its own pod with its own image, while DE's DAGs ran on the same
scheduler. The pod itself was lightweight (just API calls), orchestrating:
  Redshift (UNLOAD) → Glue (complex transformation) → PostgreSQL (INSERT)

EC2 Instance
┌──────────────────────────────────────────────┐
│  Airflow Scheduler                           │
│  ┌────────────────────────────────────────┐  │
│  │  DE's DAGs            My DAGs          │  │
│  │  (Python X.X)         (Python 3.13)    │  │
│  │      │                     │           │  │
│  └──────┼─────────────────────┼───────────┘  │
│         │              KubernetesExecutor     │
│         │                     ▼              │
│         │              ┌────────────┐        │
│         │              │ Pod (mine) │        │
│         │              │ py3.13+libs│        │
│         │              └─────┬──────┘        │
└─────────┼────────────────────┼───────────────┘
          │                    │
          ▼                    ▼
  ┌──────────────┐    Redshift → Glue → PostgreSQL
  │  DE's        │
  │  storage     │
  └──────────────┘
{% endcomment %}

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/k8s.svg" width="600"> <a href="https://kubernetes.io/docs/concepts/architecture/" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div>

### **3.2. K8s Workloads**

<p style="margin-bottom: 12px;"> </p>

A pod by itself has no self-healing: if the node it runs on fails, the pod is gone. [Deployments]() solve this for stateless applications by declaring a desired replica count and a pod template. The Deployment finds its pods via [label selectors]() that query [labels](), key-value pairs (e.g. _app: nginx_) attached to K8s resources to express ownership and relationships. The Deployment controller creates a [ReplicaSet]() that ensures the specified number of identical pods are running at all times, automatically replacing any that fail. On an update (e.g. a new container image version), the Deployment performs a [rolling update]() by gradually creating pods with the new template and terminating old ones, and supports rollback to the previous ReplicaSet if the new version fails. The [Horizontal Pod Autoscaler]() (HPA) adjusts the replica count based on CPU, memory, or custom metrics, while the [Cluster Autoscaler]() adds or removes nodes when pods cannot be scheduled.

{% comment %}
Scaling analogy: a bank with 5 identical teller windows. You walk in, take a number,
and get sent to whichever window is free. If one teller goes on break (pod dies),
the system stops sending people there and spins up a replacement. If the queue gets
long (CPU spikes), HPA opens more windows.

The full stack for an API on K8s:
- Deployment — declares replica count + pod template
- HPA — scales replicas by CPU/traffic
- Service — stable IP + load balancing across pods
- Ingress — external HTTP routing, TLS termination
- Cluster Autoscaler — adds/removes nodes as needed

{% endcomment %}

Not all workloads are stateless and interchangeable. [StatefulSets]() manage workloads that require stable network identities (pod-0, pod-1, ...), ordered startup and shutdown, and persistent storage that survives pod rescheduling, making them suited for databases and distributed systems such as Kafka or ZooKeeper. [DaemonSets]() ensure exactly one copy of a pod runs on every eligible node, commonly used for logging agents, monitoring daemons, or device plugins. [Jobs]() run a pod to completion rather than indefinitely, suited for batch processing, and [CronJobs]() schedule Jobs on a cron expression for periodic tasks such as backups or report generation.

Pods also need configuration and persistent storage decoupled from the image. [ConfigMaps]() and [Secrets]() inject environment variables or mounted files, so the same image runs unchanged across development and production. [PersistentVolumeClaims]() (PVCs) request storage from the cluster, and [StorageClasses]() enable dynamic provisioning so that creating a PVC automatically allocates the underlying volume (e.g. an EBS volume on AWS or a GCE persistent disk), keeping workload definitions portable across clusters and cloud providers. K8s [namespaces]() (distinct from Linux namespaces) partition a cluster into logical units (e.g. _dev_, _staging_, _prod_), scoping resource names and access policies. All resources are declared as YAML [manifests]() and applied via [kubectl](), the primary CLI.

{% comment %}
docker CLI → Docker daemon → containers on one host
kubectl CLI → K8s API server → resources across a cluster

docker:
1. docker build -t myapp .          — build image from Dockerfile
2. docker run -p 8080:80 myapp      — start a container
3. docker ps                        — list running containers
4. docker logs <container>          — view container outㅈput
5. docker stop <container>          — stop a container

kubectl:
1. kubectl apply -f deployment.yaml — create/update resources from manifest
2. kubectl get pods                 — list running pods
3. kubectl logs <pod>               — view pod output
4. kubectl describe pod <pod>       — inspect pod details and events
5. kubectl delete pod <pod>         — delete a pod
{% endcomment %}

- <div style="position: relative; display: inline-block;"> <img src="../assets/blog/k8s-deployment.webp" width="300" hieght="300"> <a href="https://dev.to/docker/from-zero-to-kubernetes-a-beginners-guide-to-orchestrating-docker-containers-leg" target="_blank" style="position: absolute; top: 4px; right: 4px; font-size: 12px;">[src]</a> </div>

### **3.3. K8s Networking**

<p style="margin-bottom: 12px;"> </p>

Docker's bridge network is host-local, so containers on different hosts cannot route to each other without additional overlays or port mapping. Kubernetes replaces this with a [flat network]() model: every pod receives a cluster-wide routable IP and pods communicate directly without NAT, preserving the source IP end-to-end. The cluster delegates implementation to [CNI]() (container network interface) plugins such as Flannel (VXLAN overlay), Calico (BGP-based routing with network policy), or Cilium (eBPF-native with L7 visibility).

Pod IPs change on every restart. [Services](https://kubernetes.io/docs/concepts/services-networking/service/) provide a stable virtual IP ([ClusterIP]()) and DNS name that load-balances traffic across pods matching a label selector. On each node, [kube-proxy]() programs iptables or nftables rules to forward packets destined for the ClusterIP to a healthy backend pod. To expose services externally, [NodePort]() opens a static port on every node, [LoadBalancer]() provisions a cloud load balancer that routes to NodePorts, and [Ingress]() (or its successor [Gateway API]()) defines HTTP-level routing (hostname and path matching, TLS termination) implemented by controllers such as Nginx Ingress or Traefik.

From hypervisors that virtualise entire machines, to containers that share a kernel, to orchestrators that schedule across clusters, each layer trades isolation for density and abstracts the one below it. The unit of deployment has moved from a physical server to a VM to a container to a pod, but the underlying goal remains the same: pack more workloads onto fewer boxes.

<!-- ### **3.4. ML Infrastructure** -->
<!---->
<!-- <p style="margin-bottom: 12px;"> </p> -->
<!---->
<!-- GPU scheduling in Kubernetes requires the [NVIDIA device plugin](), a DaemonSet that registers GPU resources (*nvidia.com/gpu*) with the kubelet. When a pod requests a GPU via its resource limits, the scheduler places it on a node with available GPUs, and the device plugin mounts the appropriate */dev/nvidia** device nodes, driver libraries, and CUDA runtime into the container. The [NVIDIA GPU Operator]() automates the full stack, deploying GPU drivers, container toolkit, device plugin, and [DCGM]() (Data Center GPU Manager) for monitoring, as a set of Kubernetes-native resources that adapt to the host's hardware. -->
<!---->
<!-- For distributed training across multiple pods and nodes, [Kubeflow](https://www.kubeflow.org/) and its [Training Operator]() define custom resources (PyTorchJob, TFJob, MPIJob) that coordinate multi-worker training sessions. A PyTorchJob specification declares the number of workers and a master, and the operator handles pod creation, environment variable injection for rank and world size, and failure recovery (restarting failed workers while preserving the training run). -->
<!---->
<!-- Storage for ML workloads involves [PersistentVolumes]() (PVs) backed by network file systems (NFS), cloud block storage (EBS, GCE PD), or parallel file systems (Lustre, GPFS). [PersistentVolumeClaims]() (PVCs) decouple pod specifications from storage provisioning, and [StorageClasses]() enable dynamic provisioning so that requesting a PVC automatically creates the underlying volume. For large-scale training where datasets exceed terabytes, data pipelines often stream directly from object stores (S3, GCS) via FUSE mounts or specialised data loaders rather than pre-staging to persistent volumes. Monitoring and observability at this scale rely on [Prometheus]() for time-series metrics collection, [Grafana]() for visualisation and alerting, and log aggregation systems like [Fluentd]() or [Loki]() for debugging training failures across hundreds of pods. -->
