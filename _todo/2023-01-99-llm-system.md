---
layout: default
title: "3xx. llm system"
tags: cs300
use_math: true
---


# LLM System
---


## I
---

### **1.1. Accelerators**

<p style="margin-bottom: 12px;"> </p>

NVIDIA dominates the AI accelerator market (~80%, Mizuho Securities) through the combination of GPU hardware and the CUDA software ecosystem — 20 years of development, 4+ million developers, and deep integration with every major framework. Key data centre GPUs include the A100 (Ampere, 2020), H100 (Hopper, 2022), and B200 (Blackwell, 2024). Google's [Tensor Processing Units](https://en.wikipedia.org/wiki/Tensor_Processing_Unit) (TPUs) take a different approach: [systolic arrays]() of multiply-accumulators wired in a fixed dataflow pattern, specialised for matrix operations but unable to run general-purpose software. The TPU v1 (2016, inference-only, 28 nm, 92 TOPS INT8) was secretly operational since 2015 for AlphaGo and Search ranking; TPU v2 (2017) introduced BFloat16 and training support; the latest Ironwood (v7) delivers 4.6 PFLOPS dense FP8 per chip with 192 GB HBM3e.

AWS offers [Inferentia](https://aws.amazon.com/machine-learning/inferentia/) (inference, up to 2.3× throughput vs comparable EC2) and [Trainium](https://aws.amazon.com/machine-learning/trainium/) (training, up to 50% lower cost); Trainium3 (December 2025) reaches 2.52 PFLOPS FP8 per chip. AMD's [Instinct](https://en.wikipedia.org/wiki/AMD_Instinct) series (CDNA architecture, separate from RDNA for gaming) includes the MI300X (2023, CDNA3, 192 GB HBM3) and MI350 (June 2025, 288 GB HBM3E). Apple's [Neural Engine]() (NPU), first introduced in the A11 Bionic (2017), has grown from 600 GOPS to 38 TOPS (M4). As programs targeting specific accelerators are hardware-dependent, they generally support [CPU fallback]() for operations that cannot be accelerated — for example, a custom activation function within a model that has no kernel implementation on the target device.

- <div style="position: relative; display: inline-block;"> <img src="https://miro.medium.com/v2/resize:fit:1400/format:webp/1*TmYUdDB-iCp7bc7fqBQ-Aw.png" width="500"> <a href="https://arxiv.org/abs/2002.03794" target="_blank" style="position: absolute; bottom: -8px; right: 4px; font-size: 12px;">[src]</a> </div>

### **1.2. LLM Training**

<p style="margin-bottom: 12px;"> </p>

[Kaplan et al. (2020)](https://arxiv.org/abs/2001.08361), "Scaling Laws for Neural Language Models" (OpenAI), established that cross-entropy loss scales as a power-law with model size, dataset size, and compute budget — trends spanning seven orders of magnitude. Their analysis implied that compute-efficient training should favour large models trained on relatively modest data and stopped before convergence. [Hoffmann et al. (2022)](https://arxiv.org/abs/2203.15556), "Training Compute-Optimal Large Language Models" (DeepMind, NeurIPS 2022), challenged this by training 400+ models and finding that model size and training tokens should scale equally. They demonstrated that GPT-3 (175B) and Gopher (280B) were undertrained: [Chinchilla]() (70B), trained on 1.4 trillion tokens (4× Gopher's data) with the same compute budget, outperformed all of them — achieving 67.5% on MMLU, a 7-point improvement over Gopher.

[Mixed precision training](https://arxiv.org/abs/1710.03740) ([Micikevicius et al., 2017](https://arxiv.org/abs/1710.03740), ICLR 2018) halves memory and doubles throughput by storing activations and gradients in FP16 while maintaining an FP32 master copy of weights for accumulation accuracy. Loss scaling preserves small gradient magnitudes in FP16's representable range. Scaling to thousands of GPUs requires combining parallelism strategies: [data parallelism]() (DDP) replicates the model and synchronises gradients via all-reduce; [fully sharded data parallelism]() (FSDP) shards optimizer states, gradients, and parameters across GPUs for linear memory savings; [tensor parallelism]() splits individual layer tensors across GPUs (Megatron-LM); [pipeline parallelism]() distributes layers across GPUs with micro-batched gradient accumulation; and DeepSpeed [ZeRO]() provides three stages of sharding (optimizer states → gradients → parameters). Production training typically combines these in "3D parallelism" configurations.

- <img src="https://lh3.googleusercontent.com/Vtu8Zbh3vBA-wAtHIZRKzQeZZBvAfnqLiSrCtK-SwLbs-bBRdH9YXyDRrAxxNrGDJ27XZ2B2wHRigZozDQJIVl0up_cZ9_mR7envmVh7QOS3SCrDGQ=w1232-rw" width="500" height="360" alt="https://irhum.github.io/blog/chinchilla/">

### **1.3. LLM Serving**

<p style="margin-bottom: 12px;"> </p>

During autoregressive generation, each new token attends to all previous tokens. A [KV cache]() stores previously computed key and value tensors so each step only computes projections for the new token, but its memory scales as $\text{batch} \times \text{seq\_len} \times 2 \times \text{layers} \times \text{hidden\_dim} \times \text{bytes}$. For a LLaMA-2 (7B) in FP16 with batch size 1, this requires ~14 GB for weights and ~2 GB for cache — and the cache grows linearly with context length, making large contexts (≥1M tokens) a fundamental memory challenge.

- <img src="https://arxiv.org/html/2312.05516v1/x1.png" width="500" alt="https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/">

The multi-head attention (MHA) layer computes $h_i = \text{Softmax}(X W_i^{(q)} (X W_i^{(k)})^T / \sqrt{d_{\text{head}}}) \, X W_i^{(v)}$. [Shazeer (2019)](https://arxiv.org/abs/1911.02150), "Fast Transformer Decoding: One Write-Head is All You Need," proposed [multi-query attention]() (MQA): all query heads share a single set of K/V projections, shrinking the KV cache by a factor of $h$ at the cost of quality degradation. [Ainslie et al. (2023)](https://arxiv.org/abs/2305.13245), "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints" (Google, EMNLP 2023), introduced [grouped-query attention]() (GQA) as a middle ground: queries are divided into $g$ groups ($1 \leq g \leq h$), each sharing one K/V head, achieving quality close to MHA with speed close to MQA. They showed existing MHA checkpoints can be uptrained to GQA using only 5% of the original pre-training compute. GQA was adopted by LLaMA 2 (July 2023) and Mistral 7B (September 2023).

- <img src="https://miro.medium.com/v2/resize:fit:2000/1*HaRjh9kaK2h92iASlHTeRw.png" width="500" alt="https://towardsdatascience.com/demystifying-gqa-grouped-query-attention-3fb97b678e4a">

[Leviathan et al. (2022)](https://arxiv.org/abs/2211.17192), "Fast Inference from Transformers via Speculative Decoding" (Google, ICML 2023), observed that hard language-modelling tasks often contain simpler subtasks. [Speculative decoding]() uses a smaller, faster draft model to generate $k$ candidate tokens, then the target model verifies all $k$ in a single parallel forward pass using a novel rejection sampling scheme that guarantees the output distribution is identical to the target model — achieving 2–3× acceleration on T5-XXL with no quality loss and no retraining. [Yu et al. (2022)](https://www.usenix.org/conference/osdi22/presentation/yu), "Orca" (Seoul National University, OSDI 2022), introduced [iteration-level scheduling]() (continuous batching): rather than static batching where completed sequences wait for the entire batch, the scheduler determines the batch composition at each decoding iteration, inserting new requests as soon as slots open.

- <img src="https://arxiv.org/html/2307.05908v1/x1.png" width="500" height="140">

[Kwon et al. (2023)](https://arxiv.org/abs/2309.06180), "Efficient Memory Management for Large Language Model Serving with PagedAttention" (UC Berkeley, SOSP 2023), found that existing systems wasted 60–80% of KV cache memory due to fragmentation and over-reservation. Inspired by OS virtual memory, [PagedAttention]() partitions the KV cache into fixed-size blocks (like pages), maps contiguous logical blocks to non-contiguous physical blocks via a block table (like a page table), and allocates physical blocks on-demand as tokens are generated — achieving under 4% memory waste. The authors released [vLLM](https://github.com/vllm-project/vllm), which achieved up to 24× throughput over HuggingFace Transformers and supported the LMSYS Chatbot Arena's deployment (reducing GPU count by 50% for the same traffic).

- <img src="https://lh7-us.googleusercontent.com/docsz/AD_4nXd2ATHxwk9aUwM4C7RNKLPlXTEHSDejWGuPlk8lcHZB15_blcoARNxYFkLQUTg6VbnqPFayeZw7p2TzpnMpQFjaaVfRadEwnwlqRrumWNvqRd2WlGuMXl0b6YLK8KM7wR9fNQ4ZZbPrxblQaFu-Uwcb3lpO?key=jULPpW3gOjPzXuxrraGiJA" width="500" height="225" alt="https://blog.vllm.ai/2023/06/20/vllm.html">

[Dao et al. (2022)](https://arxiv.org/abs/2205.14135), "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness" (Stanford, NeurIPS 2022), identified that standard attention is bottlenecked by memory I/O, not compute. [FlashAttention]() tiles the Q, K, V matrices into blocks, loads them from HBM to on-chip SRAM, computes attention for each tile with an incremental softmax reduction, and never materialises the full $N \times N$ attention matrix in HBM — reducing HBM accesses from $\Theta(Nd + N^2)$ to $\Theta(N^2 d^2 M^{-1})$, where $M$ is SRAM size. FlashAttention-2 (Dao, 2023) rewrote the kernel using CUTLASS 3.x primitives, reaching 230 TFLOPS on A100 (50–73% of theoretical max). FlashAttention-3 (Dao, 2024) leverages the Tensor Memory Accelerator (TMA) on Hopper GPUs for asynchronous data movement and FP8 computation.

- <img src="https://github.com/Dao-AILab/flash-attention/raw/main/assets/flashattn_banner.jpg" width="500" alt="FlashAttention">

[LoRA](https://arxiv.org/abs/2106.09685) (Hu et al., Microsoft, ICLR 2022) freezes pretrained weights $W$ and injects a trainable low-rank decomposition $\Delta W = BA$ where $B \in \mathbb{R}^{d \times r}$, $A \in \mathbb{R}^{r \times k}$, and $r \ll \min(d, k)$. This reduces trainable parameters by 10,000× and GPU memory by 3× versus full fine-tuning of GPT-3 175B, with no additional inference latency since $BA$ can be merged into $W$ at deployment. [QLoRA](https://arxiv.org/abs/2305.14314) (Dettmers et al., U. of Washington, NeurIPS 2023) pushes further by backpropagating through a frozen 4-bit quantised model into LoRA adapters. Its three innovations — the [4-bit NormalFloat]() (NF4) data type (information-theoretically optimal for normally distributed weights), [double quantisation]() (quantising the quantisation constants themselves), and [paged optimisers]() (offloading optimizer states to CPU RAM during memory spikes) — enable fine-tuning a 65B model on a single 48 GB GPU while matching 16-bit fine-tuning quality.

- <img src="https://miro.medium.com/v2/resize:fit:1400/0*6DI_QqYaVqz2QtpG" width="500">
