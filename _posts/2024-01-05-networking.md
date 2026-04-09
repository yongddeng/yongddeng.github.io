---
layout: default
title: "405. networking"
tags: cs400
use_math: true
---


# Networking

---

Never wondered how typing a URL or calling an API "just works." But beneath this apparent simplicity lies a complex orchestration of protocols, addressing schemes, data formats, and layered abstractions. Networking is not merely about sending data—it's about ensuring it gets there correctly, efficiently, and securely across the globe.

- https://www.youtube.com/watch?v=JDh_lzHO_CA
- https://www.youtube.com/watch?v=p6ASAAMwgd8&t=0
- https://www.youtube.com/watch?v=D26sUZ6DHNQ
- https://www.youtube.com/watch?v=5VAM2QAGZIc
- https://www.youtube.com/watch?v=K9L9YZhEjC0&t=951s
- https://www.youtube.com/watch?v=GAyZ_QgYYYo


## I <!-- Architecture and Protocol Layering -->
---

### 1.1 Historical Origins of Protocol Design

Before computer networks, long-distance communication relied on [circuit switching](https://en.wikipedia.org/wiki/Circuit_switching): telephony systems established dedicated end-to-end circuits for each call, reserving bandwidth even during silence. This model was reliable but wasteful and inflexible. [Packet switching](https://en.wikipedia.org/wiki/Packet_switching), proposed independently by Paul Baran (RAND) and Donald Davies (NPL) in the early 1960s, broke data into discrete packets routed independently through a shared network—achieving better fault tolerance, resource utilisation, and scalability. [ARPANET](https://en.wikipedia.org/wiki/ARPANET), funded by DARPA and first connected in 1969, was the first general-purpose packet-switched network and served as the testbed for the protocols that became the modern internet.

Two competing models emerged for structuring network protocols. The [OSI model](https://en.wikipedia.org/wiki/OSI_model) (1984) defined seven layers with strict separation of concerns, designed for theoretical completeness. The [TCP/IP model](https://en.wikipedia.org/wiki/Internet_protocol_suite), developed pragmatically through working implementations on ARPANET, collapsed this into four layers: Link, Internet, Transport, and Application. TCP/IP won in practice because it shipped working code first and standardised around what worked, rather than designing a complete specification upfront. This pragmatism—favouring simplicity and deployability over architectural purity—continues to shape protocol design today.

### 1.2 TCP/IP Stack and Layer Encapsulation

The TCP/IP stack organises network communication into four layers, each providing services to the layer above and consuming services from the layer below. The **Link layer** (Ethernet, Wi-Fi) handles frame transmission over a physical medium between directly connected nodes. The **Internet layer** ([IP](https://en.wikipedia.org/wiki/Internet_Protocol)) provides logical addressing and routing, enabling packets to traverse multiple networks to reach their destination. The **Transport layer** ([TCP](https://en.wikipedia.org/wiki/Transmission_Control_Protocol), [UDP](https://en.wikipedia.org/wiki/User_Datagram_Protocol)) manages end-to-end communication between processes, offering either reliable byte streams (TCP) or lightweight datagrams (UDP). The **Application layer** (HTTP, SSH, DNS, SMTP) implements user-facing protocols that define the structure and semantics of data exchange.

[Encapsulation](https://en.wikipedia.org/wiki/Encapsulation_(networking)) is the mechanism by which each layer wraps the data from the layer above with its own header (and sometimes trailer). An HTTP request becomes a TCP segment (with source/destination ports and sequence numbers), which becomes an IP packet (with source/destination IP addresses), which becomes an Ethernet frame (with source/destination MAC addresses and a CRC checksum). At the receiving end, each layer strips its header and passes the payload upward—a process called decapsulation. This layered design enables interoperability: any application protocol can run over any transport, over any network technology, without modification.

### 1.3 Addressing and Naming

Network communication requires multiple addressing schemes operating at different layers. [IP addresses](https://en.wikipedia.org/wiki/IP_address) provide logical identification: IPv4 uses 32-bit addresses (e.g. 192.168.1.1) while IPv6 uses 128-bit addresses to accommodate the growth of connected devices. [MAC addresses](https://en.wikipedia.org/wiki/MAC_address) are 48-bit hardware identifiers burned into network interface cards (NICs), used for local link-layer delivery. [DHCP](https://en.wikipedia.org/wiki/Dynamic_Host_Configuration_Protocol) dynamically assigns IP addresses to devices joining a network, while [ARP](https://en.wikipedia.org/wiki/Address_Resolution_Protocol) resolves IP addresses to MAC addresses on a local network segment.

[DNS](https://en.wikipedia.org/wiki/Domain_Name_System) (Domain Name System) provides a hierarchical, distributed namespace that maps human-readable domain names (e.g. google.com) to IP addresses. The resolution process traverses from root servers to TLD (top-level domain) servers to authoritative nameservers, with aggressive caching at each level controlled by TTL (time-to-live) values. DNS is critical infrastructure: virtually every HTTP request and SSH connection begins with a DNS lookup, and misconfigured DNS is a common source of outages in distributed systems.

### 1.4 Protocol Data Units and Flow Example

Each layer defines its own [protocol data unit](https://en.wikipedia.org/wiki/Protocol_data_unit) (PDU): frames at the Link layer, packets at the Internet layer, segments (TCP) or datagrams (UDP) at the Transport layer, and messages at the Application layer. Consider an HTTP GET request: the browser constructs an HTTP message, TCP segments it and adds port numbers and a sequence number, IP wraps it with source and destination addresses and selects a route, and Ethernet frames it with MAC addresses for the next hop. The [MTU](https://en.wikipedia.org/wiki/Maximum_transmission_unit) (Maximum Transmission Unit)—typically 1500 bytes for Ethernet—constrains the maximum payload size at the Link layer; packets exceeding this are either fragmented (IPv4) or dropped with an ICMP "Packet Too Big" response (IPv6 path MTU discovery).

An SSH session follows the same path but adds an encryption layer: after the TCP handshake, SSH negotiates cryptographic algorithms and keys, then encrypts all subsequent traffic within the TCP byte stream. From the perspective of lower layers, SSH traffic is indistinguishable from any other TCP traffic—the encryption is transparent to the network.

### 1.5 Design Analogies: Filesystems, Syscalls, and Composability

Networking I/O can be understood as a specialisation of general system I/O. The [socket API](https://en.wikipedia.org/wiki/Berkeley_sockets) serves as the "syscall" interface of networking: just as *read()* and *write()* operate on file descriptors backed by files or devices, the same calls operate on socket file descriptors backed by network connections. This uniform interface—inherited from Unix's "everything is a file" philosophy—means that tools like *select()*, *epoll*, and async I/O frameworks work identically for files, pipes, and sockets. Layer isolation in the protocol stack mirrors the kernel/userspace boundary: application code interacts with sockets without knowledge of IP routing or Ethernet framing, just as userspace programs use syscalls without managing page tables. This modularity enables composition—HTTP can run over TCP over IP over Ethernet or Wi-Fi, just as Unix pipes chain *grep*, *sort*, and *uniq*.

---

## II <!-- Sockets, Ports, and OS Abstractions -->

### 2.1 Sockets and System Calls

A [socket](https://en.wikipedia.org/wiki/Network_socket) is an OS-managed endpoint for network communication, created via the *socket()* system call with parameters specifying the address family (AF_INET for IPv4, AF_INET6 for IPv6), socket type (SOCK_STREAM for TCP, SOCK_DGRAM for UDP), and protocol. The [Berkeley sockets API](https://en.wikipedia.org/wiki/Berkeley_sockets), standardised as part of POSIX, defines the core workflow: a server calls *socket()*, *bind()* (associate with an address/port), *listen()* (mark as passive), and *accept()* (block until a client connects, returning a new socket for the connection). A client calls *socket()* and *connect()* to initiate a connection. Data is then exchanged via *send()*/*recv()* or the generic *read()*/*write()*. By default, socket operations block the calling thread; non-blocking mode (set via *fcntl()* or *O_NONBLOCK*) returns immediately with EAGAIN/EWOULDBLOCK if the operation cannot complete, enabling event-driven architectures.

### 2.2 Port Binding and Namespaces

[Port numbers](https://en.wikipedia.org/wiki/Port_(computer_networking)) are 16-bit unsigned integers (0–65535) that identify specific processes or services on a host. Well-known ports (0–1023) are reserved for standard services: 22 for SSH, 80 for HTTP, 443 for HTTPS, 53 for DNS. Registered ports (1024–49151) are assigned by IANA for specific applications, while ephemeral ports (49152–65535) are dynamically assigned by the OS for outgoing connections. A connection is uniquely identified by a 5-tuple: (protocol, source IP, source port, destination IP, destination port). Port conflicts arise when two processes attempt to bind the same port; the *SO_REUSEADDR* socket option allows rebinding to a port in TIME_WAIT state, which is common when restarting servers. In containerised environments, Docker maps container ports to host ports (*-p 8080:80*), and Kubernetes Services provide stable virtual IPs that load-balance across pod endpoints.

### 2.3 Multiplexing and Concurrency

Handling thousands of concurrent connections requires I/O multiplexing. *select()* and *poll()* check multiple file descriptors for readiness but scale linearly with the number of descriptors. [epoll](https://man7.org/linux/man-pages/man7/epoll.7.html) (Linux) and [kqueue](https://www.freebsd.org/cgi/man.cgi?query=kqueue) (BSD/macOS) provide O(1) event notification by registering interest once and receiving callbacks only for ready descriptors. These mechanisms underpin event loops in Nginx, Node.js (*libuv*), and Python's *asyncio*. For ML serving, inference APIs (e.g. TorchServe, Triton Inference Server) use these concurrency models to handle concurrent prediction requests while batching inputs for GPU efficiency. The choice between thread-per-connection and event-driven models depends on workload characteristics: event loops excel for I/O-bound workloads with many idle connections, while thread pools are simpler for CPU-bound request processing.

### 2.4 UNIX Domain Sockets and Local IPC

[Unix domain sockets](https://en.wikipedia.org/wiki/Unix_domain_socket) (AF_UNIX) provide IPC between processes on the same host, using filesystem paths (e.g. /var/run/docker.sock) instead of IP addresses and ports. They bypass the TCP/IP stack entirely—no checksumming, no routing, no network header overhead—making them significantly faster than loopback TCP connections. The Docker daemon communicates with the *docker* CLI via a Unix socket, and many database clients (PostgreSQL, MySQL) prefer Unix sockets for local connections. PyTorch's multiprocessing-based DataLoader workers communicate shared tensors through shared memory regions coordinated via Unix domain sockets. File-system permissions on the socket path provide access control: only processes with appropriate read/write permissions can connect.

### 2.5 Containerisation and Network Isolation

Linux [network namespaces](https://man7.org/linux/man-pages/man7/network_namespaces.7.html) (*netns*) provide isolated network stacks—each namespace has its own interfaces, routing tables, iptables rules, and port space. Docker creates a network namespace per container and connects it to the host via a [veth](https://man7.org/linux/man-pages/man4/veth.4.html) (virtual Ethernet) pair: one end in the container namespace, the other on a Linux bridge on the host. [NAT](https://en.wikipedia.org/wiki/Network_address_translation) rules (via iptables) translate between the container's private IP and the host's external IP for outbound traffic, while port forwarding handles inbound connections. Kubernetes extends this with [CNI](https://github.com/containernetworking/cni) (Container Network Interface) plugins (Calico, Flannel, Cilium) that provide pod-to-pod networking across nodes, typically using overlay networks (VXLAN) or BGP-based routing. In multi-node ML training clusters, virtual NICs and overlay networks must be configured to support high-bandwidth collective operations (AllReduce) without excessive encapsulation overhead.

---

## III <!-- Transport Layer Trade-offs and Performance -->

### 3.1 TCP and Reliable Byte Streams

[TCP](https://en.wikipedia.org/wiki/Transmission_Control_Protocol) provides reliable, ordered, byte-stream delivery over an unreliable network. Connection establishment uses a [three-way handshake](https://en.wikipedia.org/wiki/Handshaking#TCP_three-way_handshake) (SYN → SYN-ACK → ACK), adding one round-trip time (RTT) of latency before data transfer begins. Reliability is achieved through sequence numbers, acknowledgements, and retransmissions: the sender maintains a sliding window of unacknowledged segments and retransmits on timeout or duplicate ACKs. [Flow control](https://en.wikipedia.org/wiki/Flow_control_(data)) uses a receiver-advertised window to prevent the sender from overwhelming a slow receiver, while [congestion control](https://en.wikipedia.org/wiki/TCP_congestion_control) algorithms (Reno, CUBIC, BBR) dynamically adjust the sending rate based on network conditions—starting with a slow start phase and probing for available bandwidth. TCP underpins SSH, HTTP/1.1 and HTTP/2, database connections, and PyTorch DDP communication over Gloo.

### 3.2 UDP and Lightweight Messaging

[UDP](https://en.wikipedia.org/wiki/User_Datagram_Protocol) provides connectionless, best-effort delivery with minimal overhead: no handshake, no acknowledgements, no flow or congestion control. Each datagram is independent, and the protocol adds only an 8-byte header (source port, destination port, length, checksum). This makes UDP suitable for latency-sensitive applications where occasional packet loss is acceptable: DNS queries (single request-response), VoIP and video streaming (real-time, tolerance for loss), and online gaming (frequent state updates). UDP's lack of congestion control means applications must implement their own if needed, or risk contributing to network congestion. Packets exceeding the path MTU are silently dropped (if the Don't Fragment flag is set) or fragmented at the IP layer, which is unreliable and should be avoided. In ML infrastructure, NCCL can use UDP-based protocols for certain collective operations, and cluster broadcast mechanisms may prefer UDP multicast for efficiency.

### 3.3 ML System Implications: DDP and AllReduce

PyTorch's [torch.distributed](https://pytorch.org/docs/stable/distributed.html) package supports multiple communication backends: **NCCL** (NVIDIA Collective Communications Library) for GPU-to-GPU communication, **Gloo** for CPU-based or heterogeneous communication, and **MPI** for HPC environments. NCCL is optimised for NVIDIA GPU topologies—it detects NVLink, NVSwitch, and PCIe connectivity to select optimal communication paths and implements ring-allreduce and tree-allreduce algorithms. Multi-GPU training on a single node uses shared memory or NVLink, while multi-host training communicates over TCP/IP or RDMA (InfiniBand). The AllReduce operation—summing gradients across all workers and distributing the result—is the primary communication bottleneck. Bandwidth-optimal ring-allreduce transfers $2(N-1)/N$ times the data volume, where $N$ is the number of workers, asymptotically approaching 2× the model size regardless of worker count.

### 3.4 Latency, Throughput, and Window Tuning

Network performance is characterised by **latency** (time for a single packet to traverse the network) and **throughput** (data volume per unit time). The [bandwidth-delay product](https://en.wikipedia.org/wiki/Bandwidth-delay_product) (BDP = bandwidth × RTT) determines the optimal TCP window size: for a 10 Gbps link with 10 ms RTT, BDP = 12.5 MB, meaning the TCP window must be at least this large to fully utilise the link. The *TCP_NODELAY* socket option disables [Nagle's algorithm](https://en.wikipedia.org/wiki/Nagle%27s_algorithm), which batches small writes into larger segments—essential for latency-sensitive protocols like SSH interactive sessions and RPC calls. Socket buffer sizes (*SO_SNDBUF*, *SO_RCVBUF*) can be tuned to match BDP. In ML training, suboptimal TCP window sizes or congestion control algorithms can cause gradient synchronisation delays, manifesting as GPU idle time between training steps.

### 3.5 Advanced Transport: QUIC, SCTP, RDMA

[QUIC](https://en.wikipedia.org/wiki/QUIC), developed by Google and standardised as HTTP/3, runs over UDP and provides TCP-like reliability with built-in TLS 1.3 encryption and multiplexed streams without head-of-line blocking—a single lost packet only stalls its own stream, not all streams on the connection. Connection establishment requires only a single round-trip (0-RTT for resumed connections). [SCTP](https://en.wikipedia.org/wiki/Stream_Control_Transmission_Protocol) offers multi-streaming (multiple independent message streams within a single connection) and multi-homing (failover across multiple network interfaces). [RDMA](https://en.wikipedia.org/wiki/Remote_direct_memory_access) (Remote Direct Memory Access) bypasses the kernel entirely, allowing one machine to read from or write to another's memory directly via the NIC—achieving single-digit microsecond latencies and near-wire-speed throughput. InfiniBand and RoCE (RDMA over Converged Ethernet) are widely used in HPC and large-scale ML training clusters for zero-copy GPU-to-GPU data transfer.

---

## IV <!-- Discovery, Addressability, and Distributed ML Execution -->

### 4.1 DNS and Service Discovery

[DNS](https://en.wikipedia.org/wiki/Domain_Name_System) resolution follows a hierarchical delegation chain: a recursive resolver queries root servers (13 globally anycast clusters), which delegate to TLD servers (.com, .org, .io), which delegate to authoritative nameservers that hold the actual records. Caching at each level—controlled by TTL values—reduces latency and load. Tools like *dig* and *nslookup* query DNS directly, while */etc/resolv.conf* configures the system resolver. In Kubernetes, [CoreDNS](https://coredns.io/) provides cluster-internal DNS, automatically creating records for Services (e.g. my-service.my-namespace.svc.cluster.local). Service meshes like Istio and Linkerd extend discovery with health-aware routing, retries, and circuit breaking. For containerised ML inference APIs, DNS-based service discovery enables clients to reach model servers by name without hardcoding IP addresses.

### 4.2 NAT, Firewalls, and Overlay Networks

[NAT](https://en.wikipedia.org/wiki/Network_address_translation) (Network Address Translation) maps private IP addresses to public ones, enabling multiple devices to share a single public IP. This introduces complications for inbound connections: port forwarding rules must explicitly map external ports to internal hosts. [Firewalls](https://en.wikipedia.org/wiki/Firewall_(computing)) filter traffic based on rules matching source/destination addresses, ports, and protocols. Linux's *iptables* (and its successor *nftables*) provides stateful packet filtering, NAT, and packet mangling. Cloud security groups (AWS, GCP) provide declarative firewall rules attached to instances or VPCs. [Overlay networks](https://en.wikipedia.org/wiki/Overlay_network) like VXLAN encapsulate layer-2 frames within UDP packets, creating virtual network segments that span physical network boundaries. GRE tunnels provide similar functionality with simpler encapsulation. These overlays enable flat networking across data centre racks and availability zones, which is essential for distributed training clusters where all nodes must communicate directly.

### 4.3 Hostname Resolution and Rendezvous Mechanisms

Before DNS resolution, the system checks */etc/hosts* for static hostname-to-IP mappings—useful for local overrides and environments without DNS. The *getaddrinfo()* function is the standard POSIX API for name resolution, handling both DNS lookups and */etc/hosts* entries, and supporting IPv4/IPv6 transparently. In distributed ML training, a **rendezvous** mechanism allows workers to discover each other and establish communication. PyTorch Elastic uses *--rdzv_backend* (etcd, c10d, or static) to coordinate worker discovery: workers register with a rendezvous endpoint, wait until the expected number of participants join, and exchange connection information (hostnames, ports, ranks). Hostname and IP consistency across VMs and containers is critical—mismatches between */etc/hostname*, DNS records, and the addresses used for NCCL communication are a common source of DDP failures.

### 4.4 Multi-node ML Infrastructure in Practice

Cloud providers organise networking into [VPCs](https://en.wikipedia.org/wiki/Virtual_private_cloud) (Virtual Private Clouds) with subnets, route tables, and internet gateways. Instances in private subnets communicate directly, while public subnets provide internet-facing access via NAT gateways or public IPs. Kubernetes [pod networking](https://kubernetes.io/docs/concepts/cluster-administration/networking/) assigns each pod a unique IP address and ensures pod-to-pod connectivity across nodes via CNI plugins. [Load balancers](https://en.wikipedia.org/wiki/Load_balancing_(computing)) distribute incoming traffic across backend instances—L4 (TCP) load balancers forward connections based on IP/port, while L7 (HTTP) load balancers can route based on URL paths, headers, or cookies. [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) controllers provide HTTP routing and TLS termination for Kubernetes services. SSH [bastion hosts](https://en.wikipedia.org/wiki/Bastion_host) (jump boxes) provide a single hardened entry point into private networks, enabling secure access to training nodes without exposing them directly to the internet.

At the application layer, the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP), open-sourced by Anthropic in November 2024, defines a standard for connecting AI applications to external data sources and tools. MCP follows a client-server architecture over [JSON-RPC 2.0](https://www.jsonrpc.org/specification), reusing the message-flow design of the [Language Server Protocol](https://en.wikipedia.org/wiki/Language_Server_Protocol) (LSP). Two transport mechanisms are supported: **stdio** for local servers running as subprocesses (low latency, no network overhead), and **HTTP with Server-Sent Events** (SSE) for remote servers accessible over the network. MCP servers expose resources (contextual data), tools (executable functions), and prompts (templated interactions) through a capability negotiation handshake, enabling AI agents to discover and invoke external services—such as databases, APIs, or file systems—through a uniform protocol rather than ad-hoc integrations.

### 4.5 Debugging Distributed Failures

Networking failures in distributed systems are notoriously difficult to diagnose because symptoms (timeouts, hangs, partial failures) often manifest far from the root cause. *ss* and *netstat* display active socket connections and their states (ESTABLISHED, TIME_WAIT, CLOSE_WAIT), helping identify connection leaks or stuck connections. *lsof -i* shows which processes hold which sockets. [tcpdump](https://www.tcpdump.org/) and [Wireshark](https://www.wireshark.org/) capture and analyse packets on the wire, essential for diagnosing protocol-level issues. *traceroute* reveals the network path between hosts, identifying routing problems or high-latency hops. Common DDP failure modes include: DNS resolution failures (workers cannot resolve each other's hostnames), port binding conflicts (MASTER_PORT already in use), firewall rules blocking NCCL traffic, and NCCL timeout due to asymmetric network bandwidth. SSH tunnels (*ssh -L* for local forwarding, *ssh -R* for remote forwarding) can bridge network boundaries for debugging, forwarding ports through an encrypted channel to reach otherwise inaccessible services.

---

## V <!-- Security and Encryption -->

### 5.1 TLS, SSH, and Authenticated Channels

[TLS](https://en.wikipedia.org/wiki/Transport_Layer_Security) (Transport Layer Security) provides encryption, authentication, and integrity for TCP connections. The TLS handshake negotiates a cipher suite, authenticates the server (and optionally the client) via X.509 certificates, and establishes a symmetric session key using Diffie-Hellman or ECDH key exchange. TLS 1.3 reduces the handshake to a single round-trip (0-RTT for resumed sessions) and removes support for weak cipher suites. Certificate validation follows a chain of trust: the server's certificate is signed by an intermediate CA, which is signed by a root CA trusted by the client's certificate store. Certificate errors (*SSL: CERTIFICATE_VERIFY_FAILED*, *ERR_CERT_AUTHORITY_INVALID*) typically indicate expired certificates, hostname mismatches, or missing CA certificates—*curl -v* and *openssl s_client* are essential debugging tools.

[SSH](https://en.wikipedia.org/wiki/Secure_Shell) provides encrypted remote shell access and secure tunnelling. Public key authentication—where the client proves possession of a private key corresponding to a public key stored on the server—is more secure than password authentication and enables automated workflows. [SSH agent forwarding](https://en.wikipedia.org/wiki/Ssh-agent) allows authentication credentials to be forwarded through intermediate hosts (bastion servers) without copying private keys. SSH tunnels (*-L* local, *-R* remote, *-D* dynamic SOCKS proxy) create encrypted channels through which arbitrary TCP traffic can be forwarded, enabling access to services behind firewalls or NAT. In ML deployments, securing API endpoints typically involves TLS termination at load balancers or reverse proxies, with internal traffic optionally encrypted via mutual TLS (mTLS) in service mesh architectures.
