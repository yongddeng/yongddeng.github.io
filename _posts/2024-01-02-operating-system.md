---
layout: default
title: "402. operating system"
tags: cs400
use_math: true
---


# Operating System
---
tbd...
<!-- Once the kernel is successfully loaded, it takes over the full control of ...


A quick recap from the undergraduate operating systems course: information is grouped into pages in memory, and sometimes, we need to transfer chunks of information from one page to another. This is another hassle we must contend with when transferring information from the CPU to the GPU or vice-versa.

NVIDIA has a new unified memory feature that does automatic page-to-page transfers between the CPU and GPU for error-free GPU processing when the GPU occasionally runs out of memory. The authors use this feature to allocate paged memory for the optimizer states, which are then automatically evicted to CPU RAM when the GPU runs out of memory and paged back into GPU memory when the memory is needed in the optimizer update step.

- https://wandb.ai/sauravmaheshkar/QLoRA/reports/What-is-QLoRA---Vmlldzo2MTI2OTc5
- https://stackoverflow.com/questions/26891413/diff-between-logical-memory-and-physical-memory

## I
---
Apparently, the maximum utilisation of computer hardware is challenging since a computer is just a set of metal components, each has a unique and complex design, that are being wired up. Only the level of abstraction achieved by the operating system's kernel can free up users because it is relatively easier to communicate with the OS when borrowing compute power from hardware. Thereby we define a modern [operating system]() (OS) as an intermediary program which resides in RAM and manages hardware resources for its users and their applications through its kernel and system programs. 

In the early days, ... || [Batch Processing Systems]() (1950s-60s): The earliest systems handling sequential execution of jobs, leading to concepts of scheduling and resource allocation. || [Time-Sharing Systems]() (1960s-70s): Enabled multiple users to share computer resources interactively, paving the way for multi-user systems. 
- ...
- ...



## II
---
[Unix](), first released in 1971, revolutionised OS design with portability, hierarchical file systems, and modularity.
- ...
- ...

[Linux]() and [macOS](), as the main alternatives to Windows, are all decendants of Unix, and so have common on their structure and conventions. || The prior is an open-source OS that has led to the development of many different [Linux distributions]() (Distros)
- ...
- ...

[Disk operating system]() (DOS) also made a huge impact on personal computing. While DOS provided file systems like FAT12 and FAT16 which users could manage files on disk, directories, and applications through [command-line interfaces]() (CLI), it merely operated on basic hardware components and experienced limitations in memory access (i.e. 640KB), multitasking, and native support for [graphical user interfaces]() (GUI). Microsoft (through acquisition) rebranded it as MS-DOS in 1981, and later introduced a graphical interface with Windows 1.0 layered on top of MS-DOS in 1985. MS-DOS was compatible with IBM PCs in the 1980s, but shortly [Windows]() evolved into a standalone OS in the 1990s.


## III
---
The main responsiblities of modern OS are ...

- [Kernel](): The core of the OS, 디스크에 파일로써 존재하는 프로그램이며 시스템이 기동될 때 bootloader에 의해 구동 후 메모리에 상주, directly interfacing with hardware, managing system calls, and handling memory and task scheduling. || [Monolithic Kernel]() vs. [Microkernel](): Describe how monolithic kernels like Linux include all essential services in one block, while microkernels (like Minix) aim to minimize functionality in the kernel for increased modularity and stability.

- [Memory Management](): Explain how the OS allocates, protects, and releases memory across applications, handling both RAM and virtual memory. || [Paging and Segmentation](): Cunks of memory are called pages. Explain these memory management techniques, their differences, and roles in efficient memory use. || [Virtual Memory](): Describe its role in extending physical memory and how the OS handles page replacement policies (e.g., Least Recently Used).

- [File System](): Structure and manage data storage on drives, handling file creation, access, and organization. || [File Allocation Methods](): Briefly mention methods like contiguous allocation and inode-based systems. || [Journaling](): Discuss how modern file systems like NTFS and ext4 log changes before making them permanent, enhancing data integrity.

- [Process Management](): Define how the OS handles active tasks (processes), assigning resources and CPU time. || [Process Life Cycle](): Introduce process states (e.g., New, Running, Waiting, Terminated). || [Scheduling Algorithms](): Explain scheduling types like Round-Robin, First-Come-First-Served, and Priority-based, emphasizing their impact on performance. || A [thread]() is the smallest unit of ...

- [Device Management and Drivers](): Role of drivers in enabling communication between OS and hardware devices. || [Plug and Play]() (PnP): Describe how modern OSs automatically detect and configure new devices. -->
