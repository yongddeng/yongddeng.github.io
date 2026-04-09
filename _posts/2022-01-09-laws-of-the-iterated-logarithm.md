---
layout: default
title: "209. law of the iterated logarithm"
tags: math200
use_math: true
---


# Law of the Iterated Logarithm
---
For sums of independent random variables we already know two limit theorems: the law of large numbers and the central limit theorem. The LLN describes for large $n \in \mathbb{N}$ the typical behavior, or average value behavior, of sums of $n$ random variables. On the other hand, the CLT quantifies the typical fluctuations about this average value. The goal is to quantify the typical fluctuations of the whole process as $n \to \infty$. The main message is: while for fixed time $n$ the partial sum $S_n$ deviates by approximately $\sqrt{n}$ from its expected value (CLT), the maximal fluctuation up to time $n$ is of order $\sqrt{n \log \log n}$ (LIL) as stated by the Hartman–Wintner theorem.

1. Khintchine (i.i.d.): zero mean and unit variance.
2. Kolmogorov (ind.): zero mean and finite variance.
   - Hartman-Wintner-Strassen (i.i.d.): zero mean and finite variance.
   - Khinchin (i.i.d.): a special case of Hartman-Wintner.


## I
---
Consider i.i.d. random variables $X_k$ with $\operatorname{E}X_k = 0$ and $\operatorname{Var}X_k = 1$, and let the partial sum $S_n = \Sigma_{k=1}^{n} X_k$, then the (Khinchin's) LIL states that $\limsup_{n \to \infty} {S_n \over \sqrt{2n \log \log n}} = 1$ a.s. **(#1)**. On the other hand, the CLT tells us that ${S_n \over \sqrt{n}} \sim \mathcal{N}(0, 1)$. The focus is not a single partial sum $S_n$, but rather a partial sum process $(S_n)_{n \in \mathbb{N}}$ and its overall behaviour through values of $n$. That is, the LIL provides a sharp boundary between which values of $n$ the normalised partial sum $S_n / \sqrt{n}$ oscillates. In particular, for any $\varepsilon > 0$, the event $\lbrace S_n > (1+\varepsilon)\sqrt{2n\log\log n} \rbrace$ occurs finitely often, whereas $\lbrace S_n > (1-\varepsilon)\sqrt{2n\log\log n} \rbrace$ occurs infinitely often **(#2)**.

[Kolmogorov's LIL]() generalises to independent (not necessarily identically distributed) random variables. If $(X\_n)\_{n \in \mathbb{N}}$ consists of ind. random variables with $\operatorname{E}X\_k = 0$, $\operatorname{Var}X\_k = \sigma^2\_k < \infty$, and $\vert X\_k \vert \leq c\_k$ a.s. for some constants $c\_k$ with $c\_k = \mathcal{o}(\sqrt{s^2\_n / \log \log s^2\_n})$ as $n \to \infty$, where $s^2\_n = \Sigma\_{k=1}^{n}\sigma^2\_k \to \infty$, then $\limsup\_{n \to \infty} S\_n / \sqrt{2s^2\_n \log \log s^2\_n} = 1$ a.s. The assumption on the boundedness of $X\_k$ is crucial and reflects that the LIL is sensitive to the tail behavior of the summands.


## II
---
The [Hartman-Wintner theorem]() (1941) establishes the LIL for i.i.d. random variables under the assumption of a finite second moment, without requiring bounded summands. Let $(X\_n)\_{n \in \mathbb{N}}$ be i.i.d. with $\operatorname{E}X\_1 = 0$ and $\operatorname{E}X^2\_1 = \sigma^2 < \infty$. Then $\limsup\_{n \to \infty} S\_n / \sqrt{2n\sigma^2 \log \log n} = 1$ a.s. and $\liminf\_{n \to \infty} S\_n / \sqrt{2n\sigma^2 \log \log n} = -1$ a.s. Conversely, if $(X\_n)\_{n \in \mathbb{N}}$ is i.i.d. with $\operatorname{E}X\_1 = 0$ and $\limsup\_{n \to \infty} \vert S\_n \vert / \sqrt{n \log \log n} < \infty$ a.s., then $\operatorname{E}X^2\_1 < \infty$.

The proof of the upper bound uses the [Borel-Cantelli lemma]() and [exponential bounds](). One considers the subsequence $n\_k = \lfloor \alpha^k \rfloor$ for some $\alpha > 1$ and shows that $P(S\_{n\_k} > (1+\varepsilon)\sqrt{2n\_k \log \log n\_k}) \leq \exp(-(1+\varepsilon)^2 \log \log n\_k)$. Since the sum of these probabilities converges, the first Borel-Cantelli lemma gives the upper bound. The lower bound is more delicate and requires the second Borel-Cantelli lemma for weakly dependent events; one must show $P(\max\_{n\_{k-1} < j \leq n\_k} S\_j - S\_{n\_{k-1}} > (1-\varepsilon)\sqrt{2(n\_k - n\_{k-1}) \log \log n\_k})$ is sufficiently large **(#3)**.

[Strassen's functional LIL]() (1964) strengthens the Hartman-Wintner result. Let $\eta\_n(t) = S\_{\lfloor nt \rfloor} / \sqrt{2n \log \log n}$ for $t \in [0,1]$ and $K = \lbrace f \in C[0,1] : f(0) = 0,\, \int\_0^1 (f^{\prime}(t))^2 \,\mathrm{d}t \leq 1 \rbrace$ be the unit ball in the [Cameron-Martin space](). The theorem states that $\lbrace \eta\_n \rbrace$ is relatively compact in $C[0,1]$ and its set of limit points is exactly $K$, a.s. The Khinchin's LIL follows by evaluating at $t = 1$.


## III
---
A hierarchy of scaling emerges from the three limit theorems. The LLN asserts $S\_n / n \to 0$ a.s., that is, $S\_n = \mathcal{o}(n)$. The CLT refines this to $S\_n / \sqrt{n} \xrightarrow{d} \mathcal{N}(0, \sigma^2)$, indicating fluctuations of order $\sqrt{n}$. The LIL further sharpens the picture: $S\_n$ oscillates between $\pm\sigma\sqrt{2n \log \log n}$ and the envelope $\sqrt{2n \log \log n}$ is exact a.s. In summary, the typical deviation at time $n$ is $\sqrt{n}$ (CLT), but the maximal deviation up to time $n$ is $\sqrt{n \log \log n}$ (LIL).

A collection $\lbrace S\_t \rbrace\_{t \in T}$ which appears in the CLT and LIL is also a [random walk](). In fact, the CLT and LIL describe important aspects of the behavior of simple random walks on $\mathbb{Z}$. The CLT entails that as $n$ increases, the distribution of $S\_n / \sqrt{n}$ approaches a normal distribution. The LIL provides a precise envelope: a simple random walk with i.i.d. increments of zero mean and unit variance satisfies $\limsup\_{n \to \infty} S\_n / \sqrt{2n \log \log n} = 1$ a.s. For [Brownian motion]() $B = (B\_t)\_{t \geq 0}$, the continuous analogue reads $\limsup\_{t \to \infty} B\_t / \sqrt{2t \log \log t} = 1$ a.s. and $\limsup\_{t \to 0^+} B\_t / \sqrt{2t \log \log (1/t)} = 1$ a.s., describing the local regularity of sample paths near the origin **(#4)**.


## **
---
**(#1)** An equivalent statement writes $\limsup\_{n \to \infty} S\_n / \sqrt{2n \log \log n} = \sqrt{2}$ when $\operatorname{Var}X\_k = 1$ is absorbed into the normalisation. **(#2)** This is a consequence of the Borel-Cantelli lemma: convergence of the probability sum implies finitely many occurrences, divergence implies infinitely many. **(#3)** Gut (2005, Ch.9) provides a complete treatment. **(#4)** The local LIL for Brownian motion follows from the scaling property $B\_t \overset{d}{=} \sqrt{t}\,B\_1$.
