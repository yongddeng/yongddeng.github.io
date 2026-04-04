---
layout: default
title: "404. networking"
tags: cs400
use_math: true
---


# Networking

---

Never wondered how typing a URL or calling an API “just works.” But beneath this apparent simplicity lies a complex orchestration of protocols, addressing schemes, data formats, and layered abstractions. Networking is not merely about sending data—it’s about ensuring it gets there correctly, efficiently, and securely across the globe.

- https://www.youtube.com/watch?v=JDh_lzHO_CA
- https://www.youtube.com/watch?v=p6ASAAMwgd8&sttick=0
- https://www.youtube.com/watch?v=D26sUZ6DHNQ
- https://www.youtube.com/watch?v=5VAM2QAGZIc
- https://www.youtube.com/watch?v=K9L9YZhEjC0&t=951s
- https://www.youtube.com/watch?v=GAyZ_QgYYYo
- ...


## I <!-- Architecture and Protocol Layering -->
---
## 🧩 Topic 1: Architecture and Protocol Layering

### 1.1 Historical Origins of Protocol Design
- Pre-ARPANET communication: telephony and circuit switching
- Rise of packet switching: efficiency, fault tolerance, shared lines
- ARPANET as the first general-purpose packet-switched network
- OSI vs TCP/IP: competing models, simplicity vs purity
- Influence of pragmatism in layered protocol design

### 1.2 TCP/IP Stack and Layer Encapsulation
- Layer abstraction: Link, Internet, Transport, Application
- Role of each layer and their interfaces
- Encapsulation/decapsulation: data wrapped at each layer
- Interoperability and network modularity
- Ethernet, IP, TCP, and protocols like HTTP and SSH

### 1.3 Addressing and Naming
- IP addresses and logical location (IPv4/IPv6)
- MAC addresses and physical NIC identification
- DHCP for dynamic IP allocation; ARP for local resolution
- DNS as a hierarchical namespace — critical for the web
- SSH and HTTP in name-resolution workflows

### 1.4 Protocol Data Units and Flow Example
- Layer-wise example: HTTP request over TCP/IP via Ethernet
- SSH as an encrypted interactive shell over TCP
- From socket to wire to remote process: full packet flow
- Packet framing, headers, payload, MTU considerations

### 1.5 Design Analogies: Filesystems, Syscalls, and Composability
- Networking I/O as generalised system I/O
- Socket API as the "syscall" interface of networking
- Layer isolation → similar to syscall/kernel boundaries
- Modular composition → like chaining Unix tools (e.g. pipes)

---

## 🔌 Topic 2: Sockets, Ports, and OS Abstractions

### 2.1 Sockets and System Calls
- *socket()*, *bind()*, *listen()*, *accept()*
- POSIX vs Windows APIs
- Blocking vs non-blocking modes
- Use in SSH, HTTP server/client patterns

### 2.2 Port Binding and Namespaces
- Port numbers and ranges (0–65535)
- Reserved ports (e.g. 22 for SSH, 80/443 for HTTP/S)
- Ephemeral ports and conflict handling
- ML service port usage and container binding

### 2.3 Multiplexing and Concurrency
- *select()*, *poll()*, *epoll*
- I/O readiness and concurrency models
- async/await and event loops
- ML agent servers and inference APIs

### 2.4 UNIX Domain Sockets and Local IPC
- *AF_UNIX* vs *AF_INET*
- IPC for containerised services (e.g. Docker daemon)
- PyTorch shared-process communication
- File-based addressing and permission semantics

### 2.5 Containerisation and Network Isolation
- Linux namespaces (*netns*), veth, bridges
- Docker port forwarding, Kubernetes Services
- NAT, iptables, and network sandboxing
- Virtual NICs in multi-node training clusters

---

## 🚦 Topic 3: Transport Layer Trade-offs and Performance

### 3.1 TCP and Reliable Byte Streams
- 3-way handshake and reliable delivery
- Sequence numbers, flow control, congestion management
- TCP in SSH, HTTP, and PyTorch DDP
- Latency and throughput characteristics

### 3.2 UDP and Lightweight Messaging
- Connectionless communication
- DNS, VoIP, and real-time systems
- MTU, fragmentation, and application-layer recovery
- UDP in NCCL and cluster broadcasts

### 3.3 ML System Implications: DDP and AllReduce
- PyTorch’s *torch.distributed* backends: TCP, NCCL, Gloo
- Multi-GPU, multi-host collective operations
- Topology-aware scheduling and backend tuning
- Performance impacts of RDMA and TCP congestion

### 3.4 Latency, Throughput, and Window Tuning
- Bandwidth-delay product
- *TCP_NODELAY*, socket buffer sizing
- ML sync delays from network tuning issues
- Diagnosing latency vs throughput bottlenecks

### 3.5 Advanced Transport: QUIC, SCTP, RDMA
- HTTP/3 and QUIC over UDP
- SCTP: multi-streaming and multi-homing
- RDMA for zero-copy GPU/CPU data sharing
- Emerging protocols in high-performance ML infra

---

## 🌐 Topic 4: Discovery, Addressability, and Distributed ML Execution

### 4.1 DNS and Service Discovery
- DNS hierarchy: root → TLD → authoritative
- Caching, TTL, *dig*, */etc/resolv.conf*
- DNS in Kubernetes and service meshes
- HTTP service discovery in container-based APIs

### 4.2 NAT, Firewalls, and Overlay Networks
- NAT traversal and port forwarding
- VPNs, hairpinning, and UPNP
- iptables, firewalls, and security groups
- VXLAN, GRE, and overlay abstractions

### 4.3 Hostname Resolution and Rendezvous Mechanisms
- */etc/hosts*, DNS staleness, *getaddrinfo()*
- PyTorch Elastic, *--rdzv_backend*, and discovery protocols
- Hostname/IP consistency across VMs and containers
- Centralised vs decentralised rendezvous

### 4.4 Multi-node ML Infrastructure in Practice
- Cloud VPCs, subnets, and public IPs
- Kubernetes pod networking and CNI plugins
- Load balancers, Ingress, and TLS termination
- SSH bastion hosts and access gateways

### 4.5 Debugging Distributed Failures
- Tools: *ss*, *netstat*, *lsof*, *tcpdump*, *traceroute*
- Common DNS/IP/port binding failures
- SSH tunnels for secured remote debugging
- Case study: debugging DDP failure across regions

---

## 🔐 Optional Add-On Topic: Security and Encryption (Future)

### TLS, SSH, and Authenticated Channels
- TLS handshake, cert validation, trust models
- SSH tunnels, agent forwarding, and public key auth
- curl vs TLS error debugging (*495 SSL cert*, etc.)
- Securing ML APIs, endpoints, and model deployment
