---
layout: default
title: "11. martingale"
tags: tag1
use_math: true
---


# Martingale
---
Originated from gambling // Paul Lévy (who proved that the normalised sum have some asymptotic nomral limit in 1930s) has imposed a concept of martingales to prove that the famous martingale startegy is fool idea. // Joseph Doob has theoretically evolved it // We may actively shift from a discrete time domain to continuous one and vice versa. // The Wiener process and the Poisson process are popular instances of a martingale. // In the context of gambling, a player will make, on average, no profit with only a limited budget. // it is a fascinating framework that supports study of stochastic processes, and moreover, a modern probability theory. // in sprit of Levy's work, a massive breakthrough has been achieved by Doop.

  - I. definitions (predictable mg) // II. examples // III. theorems- 


## I
---
Suppose $(\Omega, \mathcal{F}, P)$ is a probability space, $X = (X_t)_{t \in T}$ is a general stochastic process, and $F = (\mathcal{F}_t)_{t \in T}$ is a [filtration]() which refers a family of sub-$\sigma$-algebras of $\mathcal{F}$ that are monotonically increasing by $\mathcal{F}_0 \subseteq \mathcal{F}_1 \subseteq \dots \subseteq \mathcal{F}_s \subseteq \mathcal{F}_t \subseteq \dots \subseteq \mathcal{F}$. The process $X$ is said to be [adapted to the filtration]() $F$ if the random variable $X_t:\Omega \to \mathbb{R}$ is $\mathcal{F}_t$-measurable for all $t \in T$, and the [natural filtration]() consists of $\sigma$-algebras $\mathcal{F}_t = \sigma(X_s \,|\, s \leq t)$ usually takes in place as the smallest filtration containing information up to time $t$. Such an adapted process $X$ defined on a [filtered probability space]() $(\Omega, \mathcal{F}, F, P)$ is called a [martingale]() if, for all $s, t \in T$ such that $0 \leq s \leq t$, one has both (i) $X_t \in L^1$ and (ii) $\operatorname{E}(X_{t} \,|\, \mathcal{F}_s) = X_s$ a.s. **(#1)**.

Specifically, by the virtue of the law of total expecation and the tower property, we know that $\operatorname{E}(\operatorname{E}(X_t \,|\, \mathcal{F}_t) \,|\, \mathcal{F}_s) = \operatorname{E}(X_t \,|\, \mathcal{F}_s)$, and because the random variable $\operatorname{E}(X_t \,|\, \mathcal{F}_s)$ is $\mathcal{F}_t$-measurable, the stability leads to $\operatorname{E}(X_t \,|\, \mathcal{F}_s) = \operatorname{E}(\operatorname{E}(X \,|\, \mathcal{F}_s) \,|\, \mathcal{F}_t)$. Therefore, the martingale property is held by $\operatorname{E}(X_t \,|\, \mathcal{F}_s) = \operatorname{E}(\operatorname{E}(X_t \,|\, \mathcal{F}_{t-h}) \,|\, \mathcal{F}_s) = \operatorname{E}(X_{t-h} \,|\, \mathcal{F}_s) = \dots = \operatorname{E}(X_{s+h} \,|\, \mathcal{F}_s) = X_s$ for some $h \geq 0$, and, what is more, every martingale has a constant expectation as $\operatorname{E}X_t = \operatorname{E}X_0$ for all $t \in T$. By construction, martingales are the class of flat lines fundamentally used to model a fair game, and a partial sum process $S = (S_t = \Sigma_{s=0}^{t}X_s)_{t \in T}$ consists of ind. $X_t$ whose $\operatorname{E}X_t = 0$ for all $t \in T$ is a popular (discrete-time) instance.

A few adjustment of the definition provides another accessible martingales. In particular, an adapted process $D = (D_t)_{t \in T}$ is called a [martingale difference sequence]() if, for all $s, t \in T$ such that $0 \leq s \leq t$, one has both (i) $D_t \in L^1$ and (ii) $\operatorname{E}(D_{t} \,|\, \mathcal{F}_s) = 0$ a.s.. Given a martingale $X$, if we set the martingale differences (i.e increments) by $D_0 = X_0$ and $D_t = X_{t} - X_{t-1}$ for all $t \in \mathbb{Z}^{+}$ **(#2)**, where $X_t$ is the sum of $D_s$ for all $s \leq t$, then then $X$ and $D$ are adpated to the same $F$. Furthermore, as it is almost trivial that $\operatorname{E}D_t = 0$ for all $t \in \mathbb{Z}^{\geq}$, we can prove that $\operatorname{E}(D_t \,|\, \mathcal{F}_s) = 0$ a.s. for all $t, s \in \mathbb{Z}^{\geq}$ such that $s < t$, and we can have some intuition that a sequence with ind. increments would be a martingale with zero mean.


## II
---
If, for all $0 \leq s \leq t$, the identity is replaced by $\operatorname{E}(X_{t} \,|\, \mathcal{F}_s) \geq X_s$ a.s., then $X$ is called a [submartingale](). Similarly, if $\operatorname{E}(X_{t} \,|\, \mathcal{F}_s) \leq X_s$ a.s., then $X$ is called a [supermartingale](). From the definition, a submartingale (supermartingale) has a monotonically increasing (monotonically decreasing) expectation, and a martingale is both a sub- and a super- martingale **(#3)**. // In continuous time, however, the continuity of the sample paths $t \to X_t$ and the filtration $t \to \mathcal{F}_t$ are necessary. Especially, we assume that $X$ is right continuous (i.e. has left limits), and $F$ is right continuous (i.e. $\mathcal{F}_t$-progressively measurable) and complete. I.e. we say $F$ is complete if (i) $(\Omega, \mathcal{F}, P)$ is complete and (ii) $\{A \in \mathcal{F}: P(A)=0\} \subset \mathcal{F}_0$.

We say a martingale $X$ is square-integrable if $\operatorname{E}X^{2}_{t} < \infty$ for all $t \in T$, and the square of an $L^2$-martingale $X$ has zero mean, uncorrelated differences (i.e. independence => uncorrelation <=> may or may not be orthogonal), and furthermore, admits a decomposition of conditional second moments (p179) **(#4)**. //

More generally, for any stochastic process, we look at the Doob decomposition theorem: any submartingale $X = (X_t)_{t \in T}$ can be uniquely decomposed into the sum of a martingale $M = (X_t)_{t \in T}$ and an predictable process $A = (A_t)_{t \in T}$ starting with $A_0 = 0$. That is, $X_t = M_t + A_t$ for all $t \in T$. // We can further explore the theorem with a submartingale. // The proof came up in 1953 and showed both the existence and the uniqueness. // the Krickeberg decom. (p.490) // the Riesz decom. (p.491) // If the variables are uncorrelated, when summing the individual variances, we can use the linearity of expecation to ease computations. // I.e. Gaussian stochastic processes.


## III
---
Suppose $(\Omega, \mathcal{F}, F, P)$ is a filtered probability space, then a random variable $\tau: \Omega \to T$ with respect to the filtration $F$ is called a [stopping time]() if one has $\{\omega: \tau(\omega) \leq t\} \in \mathcal{F}_t$ for all $t \in T$, and a [stopped $\sigma$-algebra]() $\mathcal{F}_{\tau} = \{A \in \mathcal{F}_{\infty}: A \cap \{\tau \leq t\} \in \mathcal{F}_t, \forall t \in T\}$, where $\mathcal{F}_{\infty} = \sigma(\bigcup_{t} \mathcal{F}_t)$, quantifies amount of information stacked up to $\tau$. For example, the first hitting time $\tau_B = \inf\{t: X_t \in B, \,\text{where } B \in \mathcal{B}_\mathbb{R}\}$ is a stopping time. If we let an event $\{\tau_B = t\} = \{X_0 \notin B, \dots, X_s \notin B, X_t \in B\} = \bigcap_{r=0}^{s} \{X_r \in B\}^c \cap \{X_t \in B\}$, then it is quite clear that $\{\tau_B = t\} \in \mathcal{F}_t$, but $\tau_{B}^{\prime} = \sup\{t: X_t \in B, \,\text{where } B \in \mathcal{B}_\mathbb{R}\}$ is not a stopping time because the full trajectory of $X$ (i.e. on the entire $T$) has to be known `(**5)`.

- stopping time theorem:
Properties of stopping times (w/ sufficient condition for the integrability of a stopping time). // expectation of stopped martingale is not in general equal to that of a given martingale (i.e. the problem is that $\tau$ is too large), in fact, we have $\operatorname{E}\tau = \infty$ // The optional stopping theorem (or Doob's optional sampling theorem) which applies to doubling strategies states that, // Doob's (maximal) inequality generalises Kolmogorov's inequality.

- martingale convergence theorem:
Doob's martingale convergence theorems (If you're more analysis oriented, martingales, provide (IMO) the most natural proof of the Radon-Nikodym theorem (ok, for separable sigma algebras). The proof is an application of the Martingale Convergence Theorem) // martingale clt


## **
---
**(#1)** The slower a filtration $t \to \mathcal{F}_t$ grows, the easier it is for an adapted stochastic process to be a martingale. **(#2)** I.e. A random walk, or, more generally, the partial sum process is a martingale. **(#3)** All results about sub-martingales have dual statements for sup-martingales and vice versa. **(#4)** To be precise, such $X$ is merely a submartingale in general, and one has to compensate the process to exhibit a martingale (p183). The compensation is ___. **(#5)** If $B$ is a closed set then $X$ has continuous sample paths. and an elementary application of first hitting times can be studied in the reflection principle for a Wiener process.


// kolmogorov-doob inequality // doob's maximal inequality // 

// In discrete time, a process $X = (X_t)_{t \in T}$ being adapted to $F = (\mathcal{F}_t)_{t \in T}$ is predictable if $\sigma(X_t) \subset \mathcal{F}_{t-1}$ for all $t \in T$.