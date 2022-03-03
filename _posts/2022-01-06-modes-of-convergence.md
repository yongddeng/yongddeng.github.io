---
layout: default
title: "mode of convergence"
tags: tag1
use_math: true
---


# Mode of Convergence
---
One of the basis of probability theory is the stabilisation of the relative frequencies. That is, we want to be as systematic as possible to predict an event that is fundamentally unpredictable, based on a sequence of events which may or may not be unchanging when such events go far enough into the sequence.


## I
---

| **Mode**            | **Alias**                                             | **Definition**                                                                                      | **Notation**                   |
| :------------------ | :---------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------: |
| [Completely]()      |                                                       | $\Sigma_{n=1}^{\infty} P(\lvert X_n - X \rvert > \varepsilon) < \infty$, for all $\varepsilon > 0$  | $X_n \xrightarrow{c.c.} X$    |
| [Almost surely]()   | strong convergence (with reference to the strong LLN) | $P(\lim_{n \to \infty} X_n - X = 0) = 1$                                                            | $X_n \xrightarrow{a.s.} X$    |
| [in Probability]()  | weak convergence (with reference to the weak LLN)     | $\lim_{n \to \infty} P(\lvert X_n - X \rvert \leq \varepsilon) = 1$, for all $\varepsilon > 0$      | $X_n \xrightarrow{p} X$       |
| [in $r$-Mean]()     |                                                       | $\lim_{n \to \infty} \operatorname{E}{\vert X_n - X \rvert}^r = 0$, where $r \geq 1$                | $X_n \xrightarrow{r} X$       |
| [in Distribution]() | weakest convergence (with reference to the CLT)       | $\lim_{n \to \infty} F_{X_n} = F_X$, for all $x \in C(F_X)$                                         | $X_n \xrightarrow{d} X$       |

$\\\\$

A few notes on the modes of convergence: (i) Although the "complete convergence" is less common, it is be useful when working with respect to the Borel-Cantelli lemma; (ii) The terms "almost sure convergence" and "[convergence with probability $1$]()" are often used interchangably; (iii) The "convergence in probability" can also be defined by $\lim_{n\to\infty}P(\vert X_n-X \vert >\varepsilon)=0$; (iv) The "convergence in $r$-mean" essentially equals to the "[convergence in $L^p$-space]()" with any $p = r \geq 1$ whilst a convergence in higher order implies a convergence in lower order; (v) Each element $X_n$ of a sequence need not be defined on the same probability space for the "convergence in distribution" since they are taken only in terms of $F_{X_n}$.

The source of knowledge consented some abuse of notation. In particular, given a limiting random variable $X := X\_{\infty} \sim \mathcal{N}(0,1)$, we are allowed to denote $X_n \xrightarrow{d} X$ rather than explicitly writing $X_n \xrightarrow{d} X$ as $n\to\infty$. It however emphasised that only the continuity points of $F_X$ should be considered for the distributional convergence. For instance, if $(X\_n)\_{n\in\mathbb{N}}$ is a sequence consists of $X_n = n^{-1}$ and $X_n \xrightarrow{p} X := 0$ (i.e. $X$ is [degenerate]()), then $X_n \not\xrightarrow{d} X$ for all $x \notin C(F_X)$. That is, if we let $F_{X_n}(x)$ be a sequence of distribution functions such that (i) $F\_{X\_n}(x)=0$ for $x < n^{-1}$; (ii) $F\_{X\_n}(x)=1$ for $x \geq n^{-1}$;, then $F\_{X\_n} \to F_X$ as $n\to\infty$ only when $x\neq0$ (i.e. $P(X=0) = 1$).

If a sequence $(X\_n)\_{n\in\mathbb{N}}$ converges completely, almost surely, in probability, in $r$-mean, or in distribution, then a limiting random variable $X$ holds the uniqueness. In particular, for the preceding four modes, if $X_n \to X$ and $X_n \to Y$, then $X=Y$ a.s., and thus $P(\lbrace \omega: X(\omega) = Y(\omega) \rbrace = 1$. Whereas, if $X_n \to X$ and $X_n \to Y$, then $X=Y$ in distribution, and so $F_X(x)=F_Y(x)$ for all $x \in C(F_X)$. Specifically, the triangle inequality leads $\vert F_X - F_Y \vert \leq \vert F_X - F\_{X\_n} \vert + \vert F\_{X\_n}-F_Y \vert \to 0$ as $n\to\infty$ for all $x \in C(F_X) \cap C(F_Y)$. If a sequence $(X\_n)\_{n\in\mathbb{N}}$ converges almost surely, in probability, or in $r$-mean, for any $a,b\in\mathbb{R}$, one can show that $aX_n + bY_n \to aX + bY$ correspondingly to each mode of convergence **(#1)**.


## II
---
$(1) \begin{array}{ccccc} X_n \xrightarrow{c.c.} X & \Longrightarrow & X_n \xrightarrow{a.s.} X & \Longrightarrow & X_n \xrightarrow{p} X & \Longrightarrow & X_n \xrightarrow{d} X \end{array}$

$(2) \begin{array}{ccccc} X_n \xrightarrow{r} X & \Longrightarrow & X_n \xrightarrow{p} X \end{array}$

The very left implication in the relation $(1)$ follows immediately from the 1st Borel-Canteli lemma. If $X_n$ are ind. and the limiting random variable $X$ is degenerate, then the converse is true due to the 2nd Borel-Canteli lemma. Whereas, the relation $(2)$ follows from Markov's inequality which can bound $P(\vert Y_n \vert > \varepsilon) \leq \varepsilon^{-r}\operatorname{E}{\vert Y_n \vert}^r$, where $Y_n = X_n-X$. If any weakly convergence sequence $({\vert X_n \vert}^p)\_{n\in\mathbb{N}}$ is [uniformly integrable]() (u.i.), then we hold $X_n \xrightarrow{p} X \Longrightarrow X_n \xrightarrow{L^p} X$. Whilst a sequence $(X_n)\_{n\in\mathbb{N}}$ is u.i. if for all $\varepsilon > 0$ there exists $B_\varepsilon \in [0, \infty)$ such that $\sup_{n} \operatorname{E}({\vert X_n \vert}I\_{\vert X_n \vert > B_\varepsilon}) \leq \varepsilon$ uniformly in $n\in\mathbb{N}$, or, equivalently, $\lim\_{b\to\infty} \sup_n \operatorname{E}({\vert X_n \vert}I\_{\vert X_n \vert > b})=0$ **(#2)**, the below are some criteria for uniform integrability of a sequence.

A random variable $X$ is u.i. if and only if $\operatorname{E}\vert X \vert < \infty$. If we let $\operatorname{E}\vert X \vert = \operatorname{E}({\vert X \vert}I_{\vert X \vert \leq b}) + \operatorname{E}({\vert X \vert}I_{\vert X \vert > b})$, then ${\vert X \vert}I_{\vert X \vert \leq b} \geq 0$ and ${\vert X \vert}I_{\vert X \vert \leq b} \nearrow \vert X \vert$ as $b\to\infty$. The MCT yields $\lim_{a\to\infty}\operatorname{E}({\vert X \vert}I_{\vert X \vert \leq b}) = \operatorname{E}(\lim_{a\to\infty}{\vert X \vert}I_{\vert X \vert \leq b}) = \operatorname{E}{\vert X \vert}$, and hence $\lim_{a\to\infty}\operatorname{E}({\vert X \vert}I_{\vert X \vert > b}) = 0$ for any $\operatorname{E}{\vert X \vert} < \infty$. Moreover, $(X\_n)\_{n\in\mathbb{N}}$ is u.i. if and only if $(X\_n)\_{n\in\mathbb{N}}$ holds (i) boundness: $\sup_n\operatorname{E}{\vert X_n \vert}<\infty$ **(#3)**; (ii) [uniform continuity](): for all $\varepsilon > 0$ there exists $\delta > 0$ and so for all $A\in\mathcal{F}$ with $P(A) \leq \delta$ the value $\sup_n \operatorname{E}({\vert X_n \vert} I_A) = \sup_n\int_{A}{\vert X_n \vert}\,\mathrm{d}P \leq \varepsilon$. We may write $\sup_n\operatorname{E}{\vert X_n I_A \vert} \to 0$ as $P(A) \to 0$;. Whilst $\operatorname{E}({\vert X_n \vert}I_A) \leq aP(A) + \operatorname{E}({\vert X_n \vert} I\_{\vert X_n \vert >a}) \leq a\delta + \varepsilon/2 < \epsilon$, we let $A_n = \lbrace \vert X_n \vert > a \rbrace$ and use Markov's inequality for the necessity.

The converse implication under the uniform integrability is a generalisation of the [Vitali convergence theorem]() (that is a generalisation of the DCT). Measure theoretically, it states that on a measure space $(X, \Sigma, \mu)$ with $\mu(X)<\infty$, a sequence $(f\_n)\_{n\in\mathbb{N}} \subset L^p$ converges in $L^p$ to $f \in L^p$ if and only if (i) $f_n$ converges in $\mu$-measure to $f$ **(#4)**; (ii) $({\vert f_n \vert}^p)\_{n\in\mathbb{N}}$ is u.i.; Meanwhile, a class of bability measures $P$ such that $P(\Omega)=1$ is finite. In fact, the finite measure supposition can be relaxed if, in addition, (iii) for all $\varepsilon>0$ there exists $E\_{\varepsilon} \in \Sigma$ such that $(F\in\Sigma) \land (F\cap{E_\varepsilon}) = \emptyset$ and $\sup_n\int_{F}{\vert f_n \vert}^p\,\mathrm{d}\mu < \varepsilon^p$. If we let $E_\epsilon = X$ whenever $\mu(X)<\infty$, then $F=\emptyset \in \Sigma$ is the only set such that $E_\varepsilon \cap F =\emptyset$ and $\int_\emptyset {\vert f_n \vert}^p = 0$ **(#5)**.


## III
---
// Skorokhod's representation theorem


## **
---
**(#1)** If $(X\_n)\_{n\in\mathbb{N}}$ converges a.s., or in probability, then it is true that $X_n Y_n \to XY$ correspondingly to each mode of convergence. **(#2)** In measure theory, uniform integrability holds for an uncountable set of functions indexed by some $I$, whilst a sequence is (only) a countable set with $I=\mathbb{N}$. **(#3)** Given a collection $X = (X\_i)\_{i \in I}$, condition (i) means that $X$ is bounded in norm as a subset of the vector space $L^1$, and so a finite collection of integrable random variables is trivially u.i.. **(#4)** On $(X,\Sigma,\mu)$, we say $f_n$ converges "globally" in measure to $f$ if $\lim\_{n\to\infty} \mu(\lbrace x \in X: {\vert f(x)-f_n(x) \vert} \geq \varepsilon \lbrace) = 0$ and "locally" if $\lim_{n\to\infty} \mu(\lbrace x \in F: {\vert f(x)-f_n(x) \vert} \geq \varepsilon \rbrace) = 0$, where $F \in \Sigma$ and $\mu(F) < \infty$; **(#5)** Whenever $\mu(X) < \infty$, the condition that there is a dominating integrable function $g$ can be relaxed to uniform integrability of the sequence $(f_n)$.