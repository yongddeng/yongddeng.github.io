---
layout: default
title: "402. operating system"
tags: cs400
use_math: true
---


# Operating System
---
A computer is ultimately a set of interconnected peripheral. The [operating system](https://www.youtube.com/watch?v=26QPDBe-NB8) (OS) makes it usable by hiding complexity and offering a programmable interface. Though often taken for granted, the OS is less than a century old yet underpins nearly all computing devices today. We inevitably encounter it when moving from high-level code down to low-level hardware instructions

<!-- https://pravin-hub-rgb.github.io/BCA/resources/sem2/operating_sys/index.html -->
<!-- https://www.jmeiners.com/lc3-vm/#:lc3.c -->
<!-- https://www.youtube.com/watch?v=ioJkA7Mw2-U -->
<!-- https://www.youtube.com/watch?v=xFMXIgvlgcY -->
<!-- https://youtu.be/eP_P4KOjwhs?si=gOPQIxLH6cQMk8vq -->

<!-- <iframe width="560" height="315" src="https://www.youtube.com/embed/26QPDBe-NB8?si=J8FBjnS8tE8PHY5k" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe> -->

<!-- round robin, fifo, ... -->

<!-- If data is large or its size varies, we use heap, and in stack, we just maintain a reference (i.e. pointer) to the value.... The *malloc* function in C internally uses *mmap* to free up a dedicated space and reclaim the OS for reusability. *free* does .... By using linked list, we do not need large amounts of contiguous memory, although the this data structure leads to decreased probabilities of cache hits. If our aim is to maintain compactness in our list, what we need is an array list (e.g. an array wrapped in the C struct with relevant metadata) -->


## I
---
### **1.1. The Origin: Punch Card**
<p style="margin-bottom: 12px;"> </p>

In the earliest generation of electronic computers (1940s–50s), machines such as the ENIAC were manually programmed in absolute machine code, with no system software to manage resources or automate tasks. Engineers operated these computers directly using [switches]() and [punch cards](), and programs were executed one at a time. The concept of an operating system began to take shape in the 1950s with the introduction of [batch processing systems](), such as [GM-NAA I/O]() developed by General Motors for the [IBM 701](). These new systems grouped jobs into batches, automated job transitions, and reduced idle time.

The 1960s saw the rise of [multiprogramming]() and [time-sharing systems]() (TSS), enabling [concurrent execution]() of programs in memory by having the CPU rapidly switch between them. This shift supported interactive computing and drove projects like MIT’s [Multics](), which introduced features such as [hierarchical file systems]() (HFS), [segmented memory](), [dynamic linking](), and user-level abstraction. While Multics proved too complex for its time, it directly inspired [Unix](), developed at AT&T Bell Labs in the early 1970s as a simpler system built around modular kernel design, hardware abstraction, and multi-user support. These principles remain central to modern OS design. <!-- The spread of [minicomputers](), including [programmed data processors]() (PDPs), helped popularise OS beyond institutional settings. -->

The 1980s ushered in the era of personal computing, shifting OS development from [command-line interfaces]() (CLI) toward [graphical user interfaces]() (GUI) to enhance accessibility for non-technical users. Microsoft introduced [MS-DOS]() in 1981, a single-tasking CLI-based operating system, followed by successive versions of [Windows]() that adopted cooperative and later pre-emptive multitasking. Around the same time, Apple’s [Macintosh OS]() (macOS) brought the GUI into mainstream. In the 1990s, [Linux](), nspired by Unix, emerged as a free and open-source operating system, driving innovation across servers, mobile devices, and embedded systems.

- <iframe width="500" height="280" src="https://www.youtube.com/embed/kKJxzay85Vk?si=nemG0E7zqsjleTpG" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<!-- - <iframe width="500" height="280" src="https://www.youtube.com/embed/26QPDBe-NB8?si=J8FBjnS8tE8PHY5k" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe> -->

<!-- - <div style="position: relative; display: inline-block;"> <img src="../assets/blog/2024-01-02-punch_card.png" width="500"> <a href="https://www.vbforums.com/showthread.php?900608-Punch-cards" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div> -->

<!-- History of OS... https://pravin-hub-rgb.github.io/BCA/resources/sem2/operating_sys/intro/index.html -->

<!-- In the early days, ... || [Batch Processing Systems]() (1950s-60s): The earliest systems handling sequential execution of jobs, leading to concepts of scheduling and resource allocation. || [Time-Sharing Systems]() (1960s-70s): Enabled multiple users to share computer resources interactively, paving the way for multi-user systems.  -->

<!-- Modern OS are tailored to diverse needs from personal computing to clouding, and balance efficiency, flexibility, and security by managing process scheduling, memory allocation, and device communication. Operating systems simplify interaction via [graphical user interfaces]() (GUIs) while offering powerful tools like [command-line interfaces]() (CLIs) for advanced users. || Mobile OS: Android, iOS || Real-time OS: designed for time-critical tasks, emerged to handle applications like industrial control and aerospace systems. -->


### **1.2. Operating System**
<p style="margin-bottom: 12px;"> </p>

<!-- An operating system is the intermediary between hardware and software, managing system resources and enabling users and programs to interact with the machine efficiently. At a basic level, the OS abstracts (i.e. shields) the raw hardware complexity and provides standardized services such as program execution, memory allocation, file system access, device communication, and network handling. Whether it’s loading a browser or accessing a file, these tasks rely on the operating system to coordinate execution, resource sharing, and access permissions. -->

[Application programs]() are initiated and interacted with directly by the user and are generally unprivileged processes that rely on OS services to function. [System programs](), while also running in user space, provide essential services closer to the OS itself: examples include shells, system utilities, compilers, init systems, and background [daemons](https://en.wikipedia.org/wiki/Daemon_(computing)). These programs often serve as intermediaries between user commands and kernel-level operations. ... That is, an OS is the fundamental software layer that provides an abstraction of hardware resources and defines the execution environment for application programs. It serves as both a resource manager <!--—controlling CPU scheduling, memory allocation, I/O operations, and file systems--> and a virtual machine, exposing high-level, consistent [application program interfaces]() (APIs) for user-space programs to interact with disparate hardware. <!-- Note that it may be best to loosely define an OS due to its diverse roles and responsibilities. -->

<!-- - <div style="position: relative; display: inline-block;"> <img src="https://minnie.tuhs.org/CompArch/Lectures/Figs/1swlayers3.gif" width="500"> <a href="https://minnie.tuhs.org/CompArch/Lectures/week07.html" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div> -->

<!-- - <div style="position: relative; display: inline-block;"> <img src="https://i.namu.wiki/i/XlV7BIE7FBHBVD4Ad8wTobBo2yhfwqwtT1jGEeOKzyFDQwMtQsStlNVva40_P_RoMAgvnXx6SXFFTv33rXwsYoPem4hkvH4FujtBdd9iP_Zp2vlDbm4pIP-tsSAk-v2094NFOldeqqr14KQxyVGg1g.png" width="500"> <a href="https://namu.wiki/w/%EC%9A%B4%EC%98%81%EC%B2%B4%EC%A0%9C" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div> -->

<!-- - <div style="position: relative; display: inline-block;"> <img src="https://429151971640327878.weebly.com/uploads/4/6/9/9/46999663/634347_orig.png" width="500"> <a href="https://429151971640327878.weebly.com/blog/introduction-to-operating-system" target="_blank" style="position: absolute; top: 0px; left: 4px; font-size: 12px;">[src]</a> </div> -->

To interact with hardware or perform privileged operations, user-space software must communicate with the kernel. However, this interaction is mediated by standard libraries (such as *libc*, *glibc*, or language-specific runtimes such as Python's *os* and *sys*), which expose user-friendly APIs, known as [system calls]() (i.e. the entry points to the kernel), that eventually translate into kernel requests (so users no need to invoke the kernel directly). ... This transition from user code to kernel code is safeguarded by the CPU’s dual-mode operation: [user mode]() for regular processes, and kernel mode for the OS. System calls act as controlled gates that trigger a [context switch]() into [kernel mode](). Once the OS completes the requested operation, control returns to the user program. This hardware-enforced [privilege separation]() ensures that application code cannot directly manipulate devices or memory, preserving the system’s stability and security.

Because these interfaces and behaviors vary across operating systems, most programs are OS-specific by default, and so they depend on a particular system’s binary format (e.g., ELF on Linux, PE on Windows), system call conventions, directory structure, and available runtime libraries. Cross-platform compatibility is possible but requires adhering to standardised APIs (such as [Portable Operating System InterFace for Unix](https://velog.io/@bjk1649/POSIX%EB%9E%80) (POSIX)) or using portability layers (e.g. JVM or Python interpreter). As a result, developers often write and compile programs with a specific OS target in mind, reinforcing the OS’s role as the defining execution context for all software.

- <iframe width="500" height="280" src="https://www.youtube.com/embed/H4SDPLiUnv4?si=ml8bT-7fhG9_0xkU" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe> <!-- <p style="margin-bottom: 10px;"> </p> -->

<!-- - <div style="position: relative; display: inline-block;"> <img src="../assets/blog/2024-01-02-dual_mode.png" width="500"> <a href="https://velog.io/@ongddree/%EC%9A%B4%EC%98%81%EC%B2%B4%EC%A0%9C-%EC%9D%B4%EC%A4%91-%EB%8F%99%EC%9E%91-%EB%AA%A8%EB%93%9COS-dual-mode-operation" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div>\ -->
 
 
### **1.3. Shell & Kernel**
<p style="margin-bottom: 12px;"> </p>

The operating system acts as an interface between user-level applications and hardware, and this mediation is chiefly realized through two core components: the shell and the kernel. The [shell]() is the outermost user-facing layer of the OS, providing a command-line or graphical interface through which users interact with the system. When a user issues a command—like listing files, launching a program, or moving data—the shell parses the input, interprets it, and forwards appropriate requests to the kernel. Popular shells include Bash (Bourne Again SHell), Zsh, and Fish for command-line interfaces, and graphical shells like GNOME Shell or Windows Explorer for GUI-based environments. Shells are themselves system programs running in user space, offering convenience and abstraction without requiring users to directly invoke low-level operations.

The [kernel](), in contrast, is the privileged core of the OS. It executes in kernel mode and is solely responsible for managing the system’s hardware resources—CPU, memory, storage, and I/O devices—ensuring secure and efficient operation of all processes. It handles process scheduling, memory management, file systems, device drivers, and inter-process communication (IPC). ... For example, Linux first operates on ...

<!-- - <div style="position: relative; display: inline-block;"> <img src="https://effective-shell.com/assets/images/diagram3-terminal-and-shell-31620f593a4c3838051a5a6dcea17577.png" width="500"> <a href="https://effective-shell.com/part-2-core-skills/what-is-a-shell/" target="_blank" style="position: absolute; top: 0px; left: 4px; font-size: 12px;">[src]</a> </div> -->
<!-- - <div style="position: relative; display: inline-block;"> <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjzbd3THEk91Udium9DfdCeZaqtg1eJ1HTfw&s" width="500"> <a href="http://ibgwww.colorado.edu/~lessem/psyc5112/usail/concepts/anatomy-of-unix/anatomy.html" target="_blank" style="position: absolute; top: 0px; left: 4px; font-size: 12px;">[src]</a> </div> -->

<!-- https://velog.io/@juliejung98/%EC%89%98%EA%B3%BC-%EC%BB%A4%EB%84%90-Shell-Kernel -->

Kernels can be classified into several architectures. A [monolithic kernel]() (e.g., Linux) includes all core services in a single large binary, providing fast performance through tight integration but making modularity more challenging. A [microkernel]() (e.g., MINIX, QNX) keeps only essential services in kernel space (such as scheduling and IPC), delegating others (like drivers and filesystems) to user space, which improves fault tolerance at the cost of performance. There are also [hybrid kernels]() (e.g., Windows NT, XNU in macOS), which blend aspects of both, and exokernels, which expose low-level hardware interfaces to user space for maximum customizability and minimal abstraction.

<!-- https://www.josehu.com/technical/2021/05/24/os-kernel-models.html -->

<!-- When a system boots, the kernel is loaded from the storage drive into memory and remains resident there throughout the system’s uptime. The kernel binary is typically located in a reserved partition on disk—like /boot/vmlinuz in Linux—and is loaded into RAM by a bootloader such as GRUB or Windows Boot Manager. Once loaded, the kernel takes control of the machine, initializes memory and I/O subsystems, mounts the root filesystem, and starts the first user-space process (commonly init or systemd). From this point onward, the kernel remains in kernel space, a protected region of memory that is isolated from unprivileged programs. This privilege separation, enforced by hardware-level mechanisms such as CPU rings or modes, ensures that only trusted kernel code can execute sensitive operations, thereby preserving system integrity and stability. Although it begins its life on disk, the kernel’s operational lifetime is fully in memory, where it orchestrates all software and hardware activity on the system. -->

- <div style="position: relative; display: inline-block;"> <img src="https://kuleuven-diepenbeek.github.io/osc-course/img/OS-structure2.svg" width="500" height="140"> <a href="https://kuleuven-diepenbeek.github.io/osc-course/ch1-introos/intro-os/" target="_blank" style="position: absolute; top: 0px; left: 4px; font-size: 12px;">[src]</a> </div>


### **1.4. System Call**
<p style="margin-bottom: 12px;"> </p>

System calls are the primary interface (i.e. APIs exposed by the kernel) through which user-space programs request services from the kernel. Because user programs run in restricted user mode, they are not permitted to directly access hardware or critical system resources. Instead, when a program needs to perform a privileged operation—such as reading from a file, allocating memory, or creating a new process—it issues a system call. This triggers a controlled context switch into kernel mode, where the requested operation is validated and executed. Once the operation is complete, control is returned to the user process along with any relevant results or error codes. This mechanism ensures both safety (by enforcing privilege boundaries) and consistency (by standardizing access to resources).

To simplify system call usage, most application developers interact with them indirectly through standard libraries like libc, glibc, or language runtimes. For instance, when a C program calls fopen(), the library internally prepares arguments, invokes the lower-level open() system call, and handles return values. This layered abstraction hides architecture-specific details (e.g., syscall numbers, register conventions) from the programmer, enabling portability and maintainability. Behind the scenes, invoking a system call typically involves placing parameters in CPU registers and executing a trap instruction—such as syscall on x86_64 or svc on ARM—that transitions the CPU into kernel mode at a predefined entry point.

System calls can be grouped into several broad categories, reflecting the types of services the OS provides. Process control calls (fork(), exec(), wait()) handle creation and lifecycle management of processes. File operations (read(), write(), open(), close()) enable programs to perform I/O on file descriptors abstracting real or virtual files. Memory management calls (mmap(), brk()) govern the allocation and mapping of address space. Device and network I/O are handled through calls like ioctl() and socket(). There are also informational calls (getpid(), uname()) that report system state. By keeping this interface minimal and stable, the kernel enforces strict control over hardware access while allowing rich functionality in user space, supporting everything from desktop applications to network servers and container runtimes.

- <div style="position: relative; display: inline-block; background-color: white;"> <img src="https://pravin-hub-rgb.github.io/BCA/resources/sem2/images/ker4.svg" width="500"> <a href="https://pravin-hub-rgb.github.io/BCA/resources/sem2/operating_sys/intro/index.html" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div>

<!-- https://pravin-hub-rgb.github.io/BCA/resources/sem2/images/typesc.svg -->

<!-- 
### **1.4. OS Virtualisation**
<p style="margin-bottom: 12px;"> </p>


- https://insights.sei.cmu.edu/blog/virtualization-via-containers/

- https://blog.bytebytego.com/p/what-are-the-differences-between

- https://stackoverflow.com/questions/71955661/what-is-the-difference-between-containers-and-process-vms-not-system-vms  

Virtualization abstracts hardware resources, enabling multiple virtual systems to run on a single physical machine as though each were operating independently. It improves resource utilization, isolation, and scalability, forming the backbone of modern computing environments. Hardware virtualization, achieved through hypervisors, is a key approach. Type 1 hypervisors like VMware ESXi run directly on hardware for high performance, while Type 2 hypervisors like VirtualBox operate atop an existing OS, providing ease of use at the cost of efficiency.

OS-level virtualization, exemplified by containers like Docker, isolates applications within lightweight environments that share the host OS kernel. Containers are faster to deploy and consume fewer resources than virtual machines, making them ideal for microservices and cloud-native applications. However, their reliance on a shared kernel requires robust isolation mechanisms to maintain security.

- <div style="position: relative; display: inline-block;"> <img src="https://insights.sei.cmu.edu/media/images/fourthpost_firstgraphic_092520.max-1280x720.format-webp.webp" width="500"> <a href="https://insights.sei.cmu.edu/blog/virtualization-via-containers/" target="_blank" style="position: absolute; top: 0px; left: 4px; font-size: 12px;">[src]</a> </div> -->

<!-- Containersiation (i.e. OS-level virtualisation using a conainer) is ... || https://blog.bytebytego.com/p/what-are-the-differences-between -->


## II
---

### **2.1. Unix**
todo...
