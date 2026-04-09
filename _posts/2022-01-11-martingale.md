---
layout: default
title: "211. martingale"
tags: math200
use_math: true
---


# Martingale
---
Originated from gambling, a player will make, on average, no profit with only a limited budget. Paul Lévy proved that the famous martingale strategy is futile. In spirit of Lévy's work, a massive breakthrough was achieved by Joseph Doob. It is a fascinating framework that supports study of stochastic processes, and moreover, a modern probability theory.


## I
---
An adapted stochastic process $X$ on a filtered probability space $(\Omega, \mathcal{F}, F, P)$ is called a [martingale]() if, for all $s, t \in T$ and $s \leq t$, it satisfies both (i) $X\_{t} \in L^1$; (ii) $\operatorname{E}(X_{t} \vert \mathcal{F}\_{s}) = X\_{s}$ a.s.; The slower a filtration $t \to \mathcal{F}_t$ grows, the easier it is for $X$ to be a martingale. In continuous time, the continuity of the sample paths $t \to X\_t$ and the filtration $t \to \mathcal{F}\_t$ must be provided.

The tower property and the stability of $\operatorname{E}$ yields $\operatorname{E}(X\_{t} \,\vert\, \mathcal{F}\_{s}) = \operatorname{E}[\operatorname{E}(X\_{t} \,\vert\, \mathcal{F}\_{t}) \,\vert\, \mathcal{F}\_{s}] = \operatorname{E}[\operatorname{E}(X \,\vert\, \mathcal{F}\_{s}) \,\vert\, \mathcal{F}\_{t}]$. It implies the 2nd martingale property $\operatorname{E}(X\_{t} \,\vert\, \mathcal{F}\_{s}) = \operatorname{E}(\operatorname{E}(X\_{t} \,\vert\, \mathcal{F}\_{t-h}) \,\vert\, \mathcal{F}\_s) = \operatorname{E}(X\_{t-h} \,\vert\, \mathcal{F}\_s) = \dots = \operatorname{E}(X\_{s+h} \,\vert\, \mathcal{F}\_s) = X\_s$ with some $h \geq 0$. In particular, all martingale has a constant mean $\operatorname{E}X\_{t} = \operatorname{E}X\_{0}$ for all $t \in T$. By construction, a martingale may be seen as a probabilistic flat line which can be used to model a fair game. A partial sum process $S = (S\_t)\_{t \in T}$ consists of $S\_{t} = \Sigma\_{s=0}^{t}X_s$ with ind. $X\_s$ whose $\operatorname{E}X\_s = 0$ is a popular example of a discrete-time martingale (i.e. the Poisson process and the [Wiener process/Brownian motion]()).

A few adjustments of definitions induce another martingales. We let the [martingale differences]() (i.e increments) be $D\_{0} = X\_{0}$ and $D\_{t} = X\_{t} - X\_{t-1}$ for all $t \in \mathbb{Z}^{+}$ **(#1)**, so that $X\_{t}$ is the sum of $D\_{s}$ for all $s \leq t$. An adapted stochastic process $D = (D\_{t})\_{t \in T}$ is a [martingale difference sequence]() if, for all $s, t \in T$ and $s \leq t$, it satisfies both (i) $D\_{t} \in L^1$; (ii) $\operatorname{E}(D\_{t} \,\vert\, \mathcal{F}\_{s}) = 0$ a.s.; This is almost trivial that $\operatorname{E}D\_{t} = 0$ and $\operatorname{E}(D\_{t} \,\vert\, \mathcal{F}\_{s}) = 0$ a.s. for all $t, s \in \mathbb{Z}^{\geq}$ with $s<t$. That is, a stochastic process $X$ with ind. increments and a constant mean can be refined as a martingale $D$ with a mean zero, where $X$ and $D$ are adapted to a common filtration $F$.


## II
---
If, for all $0 \leq s \leq t$, the identity is replaced by $\operatorname{E}(X_{t} \,\vert\, \mathcal{F}\_{s}) \geq X\_{s}$ a.s., then $X$ is called a [sub-martingale](). Also, if $\operatorname{E}(X_{t} \,\vert\, \mathcal{F}\_s) \leq X\_s$ a.s., then $X$ is called a [super-martingale]() **(#2)**. For example, $X$ with ind. increments and a constant mean is a martingale, and is a sub-martingale (super-martingale) if its mean is increasing (decreasing). Note that a simple random walk with $p = 1/2$, in which a mean of each summand is given by $2p-1$, is a martingale **(#3)**. That is, a martingale corresponds to fair games, a sub-martingale corresponds to favorable games, and a super-martingale corresponds to unfavorable games.

These three types of stochastic process have the following properties. The martingale properties are preserved under sums of the stochastic processes, and thus the collection of martingales with respect to a fixed filtration $F$ forms a vector space. The sub-martingale and super-martingale properties are preserved under multiplication by a positive constant. Jensen's inequality turns martingales into sub-martingales under appropriate conditions: if $X$ is a martingale and $\varphi$ is a convex function with $\varphi(X\_t) \in L^1$, then $\varphi(X)$ is a sub-martingale.

The [Doob decomposition theorem]() decomposes a discrete-time adapted integrable process $X$ uniquely as $X\_t = M\_t + A\_t$, where $M$ is a martingale and $A$ is a [predictable process]() with $A\_0 = 0$. A process $X = (X\_t)\_{t \in T}$ adapted to $F = (\mathcal{F}\_t)\_{t \in T}$ is predictable if $\sigma(X\_t) \subset \mathcal{F}\_{t-1}$ for all $t \in T$. The proof came up in 1953 and showed both the existence and the uniqueness. In particular, $X$ is a sub-martingale if and only if $A$ is non-decreasing. The [Krickeberg decomposition]() further writes a martingale $M \in L^1$ as the difference of two non-negative super-martingales **(#4)**.


## III
---
The expectation of a stopped martingale is not in general equal to that of the original martingale, as the stopping time $\tau$ may be too large (i.e. $\operatorname{E}\tau = \infty$). The [optional stopping theorem]() (or Doob's optional sampling theorem) provides conditions under which $\operatorname{E}X\_\tau = \operatorname{E}X\_0$. If $X$ is a martingale and $\tau$ is a stopping time with $\operatorname{E}\tau < \infty$, and if there exists $c > 0$ such that $\operatorname{E}[\vert X\_{t+1} - X\_{t} \vert \,\vert\, \mathcal{F}\_t] \leq c$ a.s. for all $t$, then $\operatorname{E}X\_\tau = \operatorname{E}X\_0$. The theorem applies to the doubling strategy in gambling: the condition $\operatorname{E}\tau < \infty$ ensures that one cannot exploit unbounded play to guarantee profit, formalising why the martingale betting system fails **(#5)**.

[Doob's maximal inequality]() generalises [Kolmogorov's inequality]() to sub-martingales. If $X$ is a non-negative sub-martingale, then $P(\max\_{0 \leq k \leq n} X\_k \geq \lambda) \leq \lambda^{-1} \operatorname{E}X\_n$ for any $\lambda > 0$. The $L^p$ variant states that if $X$ is a martingale with $X\_n \in L^p$ for $p > 1$, then $\operatorname{E}(\max\_{0 \leq k \leq n} \vert X\_k \vert^p) \leq (p/(p-1))^p \operatorname{E}\vert X\_n \vert^p$, which is a consequence of the maximal inequality and Hölder's inequality. These bounds are essential for establishing the a.s. convergence of martingales.

[Doob's martingale convergence theorem]() asserts that if $X$ is a sub-martingale with $\sup\_n \operatorname{E}X^{+}\_n < \infty$, then $X\_n \to X\_\infty$ a.s. as $n \to \infty$ for some $X\_\infty \in L^1$ **(#6)**. The proof relies on the [upcrossing inequality](): the expected number of times $X$ crosses from below $a$ to above $b$ is bounded by $\operatorname{E}(X\_n - a)^{+} / (b-a)$, which remains finite under the given condition. Convergence in $L^1$ requires the additional assumption of [uniform integrability](), in which case $X\_n \to X\_\infty$ in $L^1$ and $X\_t = \operatorname{E}(X\_\infty \,\vert\, \mathcal{F}\_t)$ for all $t$. If more analysis-oriented, the martingale convergence theorem provides a natural proof of the [Radon-Nikodym theorem]() for separable $\sigma$-algebras **(#7)**.


## **
---
**(#1)** I.e. a partial sum process associated with ind. sequences is a martingale. **(#2)** Equivalently, $-X$ is a sub-martingale whenever $X$ is a super-martingale. **(#3)** Hence it is a sub-martingale (a super-martingale) for $p > 1/2$ ($p < 1/2$). **(#4)** The Riesz decomposition is another variant. **(#5)** More precisely, the theorem states that the doubling strategy applied to a fair game has expected gain zero, so a gambler cannot beat the house with a finite expected stopping time. **(#6)** If $X$ is a non-negative super-martingale, the condition $\sup\_n \operatorname{E}X^{+}\_n < \infty$ is automatically satisfied. **(#7)** The [martingale CLT]() further states that if $(D\_n)\_{n \in \mathbb{N}}$ is a martingale difference sequence with $n^{-1}\Sigma\_{k=1}^{n}\operatorname{E}(D^2\_k \,\vert\, \mathcal{F}\_{k-1}) \xrightarrow{p} \sigma^2$ and $(D\_n)$ satisfies a Lindeberg-type condition, then $n^{-1/2}S\_n \xrightarrow{d} \mathcal{N}(0, \sigma^2)$.
