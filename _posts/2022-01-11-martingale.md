---
layout: default
title: "11. martingale"
tags: tag1
use_math: true
---


# Martingale
---
Originated from gambling, a player will make, on average, no profit with only a limited budget. Paul Lévy proved that the famous martingale startegy is fool. In sprit of Levy's work, a massive breakthrough was achieved by Joseph Doop. It is a fascinating framework that supports study of stochastic processes, and moreover, a modern probability theory.


## I
---
Let $(\Omega, \mathcal{F}, P)$ be a probability space, $X = (X\_t)\_{t \in T}$ be a stochastic process, and $F = (\mathcal{F}\_t)\_{t \in T}$ be a [filtration]() representing monotonically increasing sub-$\sigma$-algebras $\mathcal{F}\_{0} \subseteq \mathcal{F}\_1 \subseteq \dots \subseteq \mathcal{F}\_{s} \subseteq \mathcal{F}\_{t} \subseteq \dots \subseteq \mathcal{F}$. In general, the [natural filtration]() $\mathcal{F}\_{t} = \sigma(X\_{s} \,\vert\, s \leq t)$ is used as the smallest filtration containing all information up to time $t$, and we say $X$ is [adapted to the filtration]() $F$ if $X\_{t}:\Omega \to \mathbb{R}$ is $\mathcal{F}\_{t}$-measurable for all $t \in T$. An adapted stochastic process $X$ on a filtered probability space $(\Omega, \mathcal{F}, F, P)$ is called a [martingale]() if, for all $s, t \in T$ and $s \leq t$, it satisfies both (i) $X\_{t} \in L^1$; (ii) $\operatorname{E}(X_{t} \vert \mathcal{F}\_{s}) = X\_{s}$ a.s.; The slower a filtration $t \to \mathcal{F}_t$ grows, the easier it is for $X$ to be a martingale **(#1)**.

We recall that $\operatorname{E}(X\_{t} \,\vert\, \mathcal{F}\_{s}) = \operatorname{E}[\operatorname{E}(X\_{t} \,\vert\, \mathcal{F}\_{t}) \,\vert\, \mathcal{F}\_{s}] = \operatorname{E}[\operatorname{E}(X \,\vert\, \mathcal{F}\_{s}) \,\vert\, \mathcal{F}\_{t}]$ due to the tower property and the stability of $\operatorname{E}$. This implies the second martingale property $\operatorname{E}(X\_{t} \,\vert\, \mathcal{F}\_{s}) = \operatorname{E}(\operatorname{E}(X\_{t} \,\vert\, \mathcal{F}\_{t-h}) \,\vert\, \mathcal{F}\_s) = \operatorname{E}(X\_{t-h} \,\vert\, \mathcal{F}\_s) = \dots = \operatorname{E}(X\_{s+h} \,\vert\, \mathcal{F}\_s) = X\_s$ with some $h \geq 0$. In particular, every martingale has a constant mean such that $\operatorname{E}X\_{t} = \operatorname{E}X\_{0}$ for all $t \in T$. Also, due to the way a martingale is constructed, it is a probabilistic flat line which can be used to model a fair game. A partial sum process $S = (S\_t)\_{t \in T}$ consists of $S\_{t} = \Sigma\_{s=0}^{t}X_s$ with ind. $X\_s$ whose $\operatorname{E}X\_s = 0$ is a popular example of a discrete-time martingale (i.e. the Poisson process and the [Wiener process/Brownian motion]()).

A few adjustments in the definition induces another accessible martingales. We let the [martingale differences]() (i.e increments) be $D\_{0} = X\_{0}$ and $D\_{t} = X\_{t} - X\_{t-1}$ for all $t \in \mathbb{Z}^{+}$ **(#2)**, so that $X\_{t}$ is the sum of $D\_{s}$ for all $s \leq t$. An adapted stochastic process $D = (D\_{t})\_{t \in T}$ is a [martingale difference sequence]() if, for all $s, t \in T$ and $s \leq t$, it satisfies both (i) $D\_{t} \in L^1$; (ii) $\operatorname{E}(D\_{t} \,\vert\, \mathcal{F}\_{s}) = 0$ a.s.; Preferably, it is almost trivial that $\operatorname{E}D\_{t} = 0$ and also $\operatorname{E}(D\_{t} \,\vert\, \mathcal{F}\_{s}) = 0$ a.s. for all $t, s \in \mathbb{Z}^{\geq}$ with $s<t$. In other words, a stochastic process $X$ with independent increments and a constant mean can be refined as a martingale $D$ with a mean zero, where $X$ and $D$ are adpated to a common filtration $F$.

## II
---
If, for all $0 \leq s \leq t$, the identity is replaced by $\operatorname{E}(X_{t} \,\vert\, \mathcal{F}\_{s}) \geq X\_{s}$ a.s., then $X$ is called a [submartingale](). Similarly, if $\operatorname{E}(X_{t} \,\vert\, \mathcal{F}\_s) \leq X\_s$ a.s., then $X$ is called a [supermartingale](). From the definition, a submartingale (supermartingale) has a monotonically increasing (monotonically decreasing) expectation, and a martingale is both a sub- and a super- martingale **(#3)**. 

- Assume that $X$ has ind. increments:
- If the mean is constant then X is a martingale.
- If the mean is increasing then X is a sub-martingale.
- If the mean is decreasing then X is a super-martingale.

- Each summand of simple random walk has a mean 2p-1:
- A simple random walk with $p = 1/2$ is a martingale.
- A simple random walk with $p > 1/2$ is a sub-martingale.
- A simple random walk with $p < 1/2$ is a super-martingale.

- On the gambler's point of view:
- A martingale corresponds to fair games.
- A sub-margingale corresponds to favorable games.
- A super-margingale corresponds to unfavorable games.

The Doob decomposition theorem: decomposes a basic stochastic process into a martingale and a predictable process (a definition of predictable process will be followed). // The proof came up in 1953 and showed both the existence and the uniqueness. // the Krickeberg decom. (p.490) // the Riesz decom. (p.491) // I.e. Gaussian stochastic processes.

- Properties:
- The martingale properties are preserved under sums of the stochastic processes (thus the collection of martingales with respect to a fixed filtration $F$ forms a vector space).
- The sub-martingale and super-martingale properties are preserved under multiplication by a positive constant.
- Jensen's inequality turns martingales into sub-martingales under appropriate conditions.


## III
---
Given a filtered probability space $(\Omega, \mathcal{F}, F, P)$, a random variable $\tau: \Omega \to T$ with respect to $F$ is called a [stopping time]() if $\lbrace \omega: \tau(\omega) \leq t \rbrace \in \mathcal{F}\_t$ for all $t \in T$. In particular, [stopped $\sigma$-algebra]() $\mathcal{F}\_{\tau} = \lbrace A \in \mathcal{F}\_{\infty}: A \cap \lbrace \tau \leq t \rbrace \in \mathcal{F}\_t, \,\forall t \in T \rbrace$, $\mathcal{F}\_{\infty} = \sigma(\bigcup\_{t} \mathcal{F}\_t)$ quantifies amount of information stacked up to $\tau$. 
  
For example, the first hitting time $\tau\_B = \inf \lbrace t: X\_t \in B, \, B \in \mathcal{B}\_\mathbb{R} \rbrace$ is a stopping time. If we let an event $\lbrace \tau\_B = t \rbrace = \lbrace X\_0 \notin B, \dots, X\_s \notin B, X\_t \in B \rbrace = \bigcap\_{r=0}^{s} {\lbrace X\_r \in B \rbrace}^c \cap \lbrace X\_t \in B \rbrace$, then it is quite clear that $\{\tau\_B = t\} \in \mathcal{F}\_t$, but $\tau\_{B}^{\prime} = \sup \lbrace t: X\_t \in B, \, B \in \mathcal{B}\_\mathbb{R} \rbrace$ is not a stopping time because the full trajectory of $X$ (i.e. on the entire $T$) has to be known **(#5)**.

stopping time theorem::: Properties of stopping times (w/ sufficient condition for the integrability of a stopping time). // expectation of stopped martingale is not in general equal to that of a given martingale (i.e. the problem is that $\tau$ is too large), in fact, we have $\operatorname{E}\tau = \infty$ // The optional stopping theorem (or Doob's optional sampling theorem) which applies to doubling strategies states that, // Doob's (maximal) inequality generalises Kolmogorov's inequality.

martingale convergence theorem::: Doob's martingale convergence theorems (If you're more analysis oriented, martingales, provide (IMO) the most natural proof of the Radon-Nikodym theorem (ok, for separable sigma algebras). The proof is an application of the Martingale Convergence Theorem) // martingale clt


## **
---
**(#1)** In continuous time, the continuity of the sample paths $t \to X\_t$ and the filtration $t \to \mathcal{F}\_t$ must be provided. **(#2)** I.e. A partial sum process associated with ind. sequences is a martingale. **(#3)** All results about sub-martingales have dual statements for sup-martingales and vice versa. **(#5)** If $B$ is a closed set then $X$ has continuous sample paths. and an elementary application of first hitting times can be studied in the reflection principle for a Wiener process.


// kolmogorov-doob inequality // doob's maximal inequality // 

// In discrete time, a process $X = (X\_t)\_{t \in T}$ being adapted to $F = (\mathcal{F}\_t)\_{t \in T}$ is predictable if $\sigma(X\_t) \subset \mathcal{F}\_{t-1}$ for all $t \in T$.