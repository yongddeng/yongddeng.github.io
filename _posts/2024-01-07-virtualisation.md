---
layout: default
title: "407. virtualisation"
tags: cs400
use_math: true
---


# Virtualisation
---
Virtualisation abstracts physical computing resources—CPUs, memory, storage, and networks—into isolated, software-defined units that can be independently managed, scaled, and deployed. It emerged from the mainframe era at IBM in the 1960s and has since become the foundation of cloud computing and modern ML infrastructure. This post traces the evolution from hardware-level virtual machines to OS-level containers, and examines how orchestration platforms coordinate these abstractions at scale.

- https://www.youtube.com/watch?v=zh0OMXg2Kog


## I
---
### **1.1. Virtual Machines and Hypervisors**
<p style="margin-bottom: 12px;"> </p>

A [virtual machine]() (VM) is a software emulation of a complete physical computer, running its own operating system (guest OS) on top of virtualised hardware. The key enabling technology is the [hypervisor]() (or virtual machine monitor, VMM), which mediates access to physical resources and provides isolation between VMs. [Type 1 hypervisors]() (bare-metal) run directly on the host hardware without an underlying OS—examples include VMware ESXi, Microsoft Hyper-V, and Xen. [Type 2 hypervisors]() (hosted) run as applications on a conventional OS—examples include VirtualBox and VMware Workstation. Type 1 hypervisors offer better performance and security due to the thinner software layer between VMs and hardware.

Early x86 processors lacked hardware virtualisation support, forcing hypervisors to use [binary translation]() (rewriting privileged guest instructions at runtime) or [paravirtualisation]() (modifying the guest OS to cooperate with the hypervisor, as in Xen's approach). Intel [VT-x]() (2005) and AMD [AMD-V]() introduced hardware-assisted virtualisation by adding a new CPU privilege level (root mode) that allows the hypervisor to intercept privileged operations without binary translation, significantly reducing overhead. [Extended page tables]() (EPT on Intel, NPT on AMD) further accelerate virtualisation by providing hardware support for guest-to-host address translation, eliminating the need for shadow page tables. Modern VMs with hardware-assisted virtualisation achieve near-native CPU performance, with overhead typically under 5% for compute-bound workloads.

### **1.2. Resource Virtualisation**
<p style="margin-bottom: 12px;"> </p>

Each VM is allocated virtual CPUs (vCPUs), memory, storage, and network interfaces by the hypervisor. The hypervisor schedules vCPUs onto physical cores, potentially overcommitting—running more vCPUs than physical cores—by time-slicing, similar to how the OS schedules processes. Memory is virtualised through a two-level address translation: the guest OS manages its own page tables (guest virtual → guest physical), and the hypervisor maintains a second mapping (guest physical → host physical). [Memory ballooning]() allows the hypervisor to reclaim memory from underutilising VMs by inflating a balloon driver inside the guest, forcing it to swap or release pages.

Storage virtualisation presents virtual disks backed by files (e.g. VMDK, QCOW2) on the host file system, enabling features like [snapshots]() (point-in-time copies for rollback), [thin provisioning]() (allocating storage on demand rather than upfront), and [live migration]() (moving a running VM between physical hosts with minimal downtime by iteratively copying memory pages while the VM continues executing). Network virtualisation assigns virtual NICs to each VM, connected through a [virtual switch]() (e.g. Open vSwitch) on the host. [SR-IOV]() (Single Root I/O Virtualisation) allows a physical NIC to present multiple virtual functions directly to VMs, bypassing the hypervisor for near-native network performance—an important capability for bandwidth-intensive ML workloads.


## II
---
### **2.1. Containers and OS-Level Virtualisation**
<p style="margin-bottom: 12px;"> </p>

Unlike VMs, which virtualise the entire hardware stack and run a full guest OS, [containers](https://en.wikipedia.org/wiki/OS-level_virtualization) share the host kernel and isolate processes using OS-level mechanisms. This makes containers far more lightweight: they start in milliseconds (vs seconds for VMs), consume megabytes of memory (vs gigabytes for a full OS), and can run hundreds of instances on a single host. The trade-off is weaker isolation—all containers share the same kernel, so a kernel vulnerability can compromise all containers on the host.

Linux containers rely on two kernel features. [Namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html) provide isolation by giving each container its own view of system resources: PID namespace (separate process trees), network namespace (separate network stacks, interfaces, and routing tables), mount namespace (separate file system views), UTS namespace (separate hostname), IPC namespace (separate inter-process communication), and user namespace (separate user/group IDs). [Cgroups](https://man7.org/linux/man-pages/man7/cgroups.7.html) (control groups) enforce resource limits—CPU shares, memory limits, I/O bandwidth, and device access—preventing any single container from monopolising host resources. Together, namespaces and cgroups provide the illusion of an isolated OS environment while sharing the underlying kernel.

### **2.2. Docker**
<p style="margin-bottom: 12px;"> </p>

[Docker](https://www.docker.com/) (2013) popularised containers by packaging the tooling around Linux namespaces and cgroups into a developer-friendly workflow. A [Dockerfile]() specifies a sequence of instructions (FROM, RUN, COPY, CMD) that build a [container image]()—an immutable, layered file system snapshot containing the application code, runtime, libraries, and dependencies. Images use a [union file system]() (e.g. OverlayFS) where each instruction creates a read-only layer; at runtime, a thin read-write layer is added on top, and copy-on-write semantics ensure that modifications do not affect the underlying image. Layers are cached and shared between images, reducing build times and storage.

The *docker run* command creates a container from an image: it sets up namespaces for isolation, applies cgroup limits, mounts the layered file system, configures networking (typically via a bridge network with NAT), and starts the specified process. [Docker Hub]() and private registries (e.g. AWS ECR, Google GCR) host images for distribution. Multi-stage builds allow compilation in one stage and copying only the artefacts into a minimal runtime image, reducing image size. For ML workflows, Docker containers package model code, framework dependencies (e.g. PyTorch, CUDA libraries), and configuration into reproducible units that can be shipped from development laptops to GPU clusters without dependency conflicts.

### **2.3. Container Networking and Storage**
<p style="margin-bottom: 12px;"> </p>

By default, Docker creates a bridge network (*docker0*) on the host and assigns each container an IP on a private subnet. Containers communicate with each other via the bridge and reach external networks through NAT rules managed by iptables. Port mapping (*-p host:container*) exposes container services to the host network. For multi-host networking, Docker supports overlay networks (via VXLAN) that span multiple hosts, and [Macvlan]() networks that assign containers MAC addresses directly on the physical network. These networking modes interact directly with the OS primitives discussed in 402 (namespaces, virtual interfaces) and the transport concepts from 404 (TCP, port binding, overlay encapsulation).

Container storage is ephemeral by default—data written inside a container is lost when the container is removed. [Volumes]() provide persistent storage by mounting host directories or named storage objects into the container's file system, bypassing the union file system for direct I/O. [Bind mounts]() map specific host paths into the container, useful for development workflows where source code on the host should be reflected inside the container in real time. For ML training, volumes typically hold datasets, model checkpoints, and logs, while the container image holds the immutable runtime environment.


## III
---
### **3.1. Container Orchestration**
<p style="margin-bottom: 12px;"> </p>

Running individual containers with *docker run* suffices for development, but production deployments require automated scheduling, scaling, health monitoring, and service discovery across a cluster of machines. [Container orchestration]() platforms solve this by treating a pool of machines as a single logical compute surface. The orchestrator decides where to place containers based on resource availability, affinity rules, and constraints, then monitors their health and restarts or reschedules failed instances.

[Kubernetes](https://kubernetes.io/) (K8s), originally developed by Google and open-sourced in 2014, has become the dominant orchestration platform. Its architecture separates the [control plane]() (API server, scheduler, controller manager, etcd for state storage) from [worker nodes]() (each running a kubelet agent and a container runtime like containerd or CRI-O). The fundamental unit of deployment is the [pod]()—one or more tightly coupled containers that share a network namespace (and thus an IP address and port space) and storage volumes. Pods are ephemeral and managed by higher-level controllers.

### **3.2. Kubernetes Abstractions**
<p style="margin-bottom: 12px;"> </p>

[Deployments]() manage stateless applications by maintaining a desired number of pod replicas, performing rolling updates (gradually replacing old pods with new ones), and rolling back on failure. [StatefulSets]() manage stateful applications (e.g. databases, distributed ML parameter servers) that require stable network identities (hostname) and persistent storage across restarts. [DaemonSets]() ensure that a specific pod runs on every node in the cluster, commonly used for logging agents, monitoring daemons, or GPU device plugins.

[Services](https://kubernetes.io/docs/concepts/services-networking/service/) provide stable network endpoints for groups of pods. A ClusterIP Service creates a virtual IP accessible only within the cluster, load-balancing across backing pods. NodePort exposes the service on a static port on every node, while LoadBalancer provisions an external cloud load balancer. [Ingress]() resources define HTTP routing rules (hostname, path-based routing) and TLS termination, implemented by controllers like Nginx Ingress or Traefik. [ConfigMaps]() and [Secrets]() inject configuration and credentials into pods without baking them into images. Resource requests and limits (CPU, memory, GPU) inform the scheduler and prevent resource contention, while [Horizontal Pod Autoscaler]() (HPA) adjusts replica count based on observed metrics.

### **3.3. Kubernetes for ML Workloads**
<p style="margin-bottom: 12px;"> </p>

GPU access in Kubernetes requires the [NVIDIA device plugin](), which exposes GPU resources (e.g. *nvidia.com/gpu*) to the scheduler. Pods request GPUs via resource limits, and the device plugin mounts the appropriate device nodes and driver libraries into the container. The [NVIDIA GPU Operator]() automates the deployment of GPU drivers, container toolkit, device plugin, and monitoring on Kubernetes nodes. For distributed training, [Kubeflow]() and its [Training Operator]() manage PyTorchJob, TFJob, and MPIJob custom resources that coordinate multi-pod distributed training sessions, handling worker discovery, rank assignment, and failure recovery.

Storage for ML workloads typically involves [PersistentVolumes]() (PVs) backed by network file systems (NFS), cloud block storage (EBS, GCE PD), or parallel file systems (Lustre, GPFS). [PersistentVolumeClaims]() (PVCs) decouple pod specifications from storage provisioning, and [StorageClasses]() enable dynamic provisioning. For large-scale training, data pipelines often stream from object stores (S3, GCS) via FUSE mounts or specialised data loaders rather than pre-staging data to persistent volumes. Monitoring and observability rely on [Prometheus]() for metrics collection, [Grafana]() for visualisation, and [Fluentd]() or [Loki]() for log aggregation across distributed training jobs.


## IV
---
### **4.1. VMs vs Containers**
<p style="margin-bottom: 12px;"> </p>

VMs and containers occupy different points in the isolation-efficiency trade-off. VMs provide strong isolation through hardware-level separation—each VM runs its own kernel, making it suitable for multi-tenant cloud environments where security boundaries must be strict. The cost is higher resource overhead: each VM requires its own OS image (gigabytes), boot time (seconds to minutes), and dedicated memory reservation. Containers share the host kernel, achieving millisecond startup, minimal overhead, and high density (hundreds per host), but with weaker isolation since a kernel exploit can escape the container boundary.

In practice, modern infrastructure frequently layers both: cloud providers run containers inside VMs ([GKE](https://cloud.google.com/kubernetes-engine), [EKS](https://aws.amazon.com/eks/), [AKS](https://azure.microsoft.com/en-us/products/kubernetes-service)) to combine the security boundary of VMs with the packaging efficiency of containers. [Kata Containers]() and [Firecracker]() (developed by AWS for Lambda and Fargate) take a hybrid approach—running each container inside a lightweight micro-VM that boots in ~125 ms with ~5 MB memory overhead, providing near-container performance with VM-level isolation. [gVisor]() (developed by Google) interposes a user-space kernel between the container and the host kernel, intercepting system calls for sandboxing without the overhead of a full VM.

### **4.2. Infrastructure as Code**
<p style="margin-bottom: 12px;"> </p>

Virtualisation enables [infrastructure as code]() (IaC)—defining compute, storage, and networking resources in declarative configuration files that can be version-controlled, reviewed, and reproducibly applied. [Terraform](https://www.terraform.io/) by HashiCorp provisions cloud resources (VMs, VPCs, load balancers, Kubernetes clusters) across providers via a plugin-based architecture. [Ansible](https://www.ansible.com/) automates configuration management and application deployment through SSH, without requiring agents on managed hosts. [Helm]() packages Kubernetes manifests into reusable charts with templated values, simplifying deployment of complex applications.

For ML teams, IaC enables reproducible infrastructure: a single repository can define the GPU node pools, networking rules, storage classes, and training job templates needed to launch distributed training. CI/CD pipelines (GitHub Actions, GitLab CI, Argo Workflows) can provision infrastructure, build container images, run training jobs, and deploy models to serving endpoints—all triggered by a git push. This infrastructure layer completes the stack: from the hardware and OS primitives of 401–402, through the concurrent execution models of 403 and the networking protocols of 404, virtualisation provides the packaging and orchestration that makes it all deployable, reproducible, and scalable.
