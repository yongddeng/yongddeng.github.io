---
layout: default
title: "206. mode of convergence"
tags: math200
use_math: true
---


# Mode of Convergence
---
One of the basis of probability theory is the stabilisation of the [relative frequencies](https://www.mathsisfun.com/data/relative-frequency.html). That is, we want to systematically predict an event which may or may not be unchanging as it goes far enough into the sequence.


## I
---

| **Mode**            | **Alias**                                             | **Definition**                                                                                      | **Notation**                   |
| :------------------ | :---------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------: |
| [completely]()      |                                                       | $\Sigma_{n=1}^{\infty} P(\lvert X_n - X \rvert > \varepsilon) < \infty$, for all $\varepsilon > 0$  | $X_n \xrightarrow{c.c.} X$    |
| [almost surely]()   | strong convergence (with reference to the strong LLN) | $P(\lim_{n \to \infty} X_n - X = 0) = 1$                                                            | $X_n \xrightarrow{a.s.} X$    |
| [in Probability]()  | weak convergence (with reference to the weak LLN)     | $\lim_{n \to \infty} P(\lvert X_n - X \rvert \leq \varepsilon) = 1$, for all $\varepsilon > 0$      | $X_n \xrightarrow{p} X$       |
| [in $r$-Mean]()     |                                                       | $\lim_{n \to \infty} \operatorname{E}{\vert X_n - X \rvert}^r = 0$, where $r \geq 1$                | $X_n \xrightarrow{r} X$       |
| [in Distribution]() | weakest convergence (with reference to the CLT)       | $\lim_{n \to \infty} F_{X_n} = F_X$, for all $x \in C(F_X)$                                         | $X_n \xrightarrow{d} X$       |

$\\\\$

A few notes on the modes of convergence: (i) The "complete convergence" can be useful if we work with respect to the Borel-Cantelli lemma; (ii) The terms "almost sure convergence" and "[convergence with probability $1$]()" are used interchangably; (iii) We may rewrite the "convergence in probability" by $\lim_{n\to\infty}P(\vert X_n-X \vert >\varepsilon)=0$; (iv) The "convergence in $r$-mean" means "[convergence in $L^p$-space]()" for every $p = r \geq 1$ and a higher order convergence implies lower order ones; (v) Each element $X_n$ of a sequence need not be defined on the same probability space for the "convergence in distribution" as they are studied only in terms of $F_{X_n}$;

The source of knowledge consented some abuse of notations. In particular, given a limiting random variable $X := X\_{\infty} \sim \mathcal{N}(0,1)$, we are allowed to denote $X_n \xrightarrow{d} X$ rather than explicitly writing $X_n \xrightarrow{d} X$ as $n\to\infty$. We should emphasise that only the continuity points of $F_X$ are taken for the convergence in distribution. For example, if $(X\_n)\_{n\in\mathbb{N}}$ consists of $X_n = n^{-1}$ and $X_n \xrightarrow{p} X := 0$ (i.e. $X$ is [degenerate]()), then $X_n \not\xrightarrow{d} X$ for every $x \notin C(F_X)$. That is, if $(F\_{X_n})\_{n\in\mathbb{N}}$ is a sequence of distribution functions such that $F\_{X\_n}(x)=0$ for $x < n^{-1}$ and $F\_{X\_n}(x)=1$ for $x \geq n^{-1}$, then $F\_{X\_n} \to F_X$ as $n\to\infty$ only when $x\neq0$ in which $P(X=0) = 1$.

If $(X\_n)\_{n\in\mathbb{N}}$ converges completely, almost surely, in probability, in $r$-mean, or in distribution to $X$, then a random variable $X$ is unique. In particular, for the preceding four modes, if $X\_{n} \to X$ and $X\_{n} \to Y$, then $X = Y$ almost surely. Whereas, if $X\_n$ converge in dist. to $X$ and $Y$, then $F\_{X}(x)=F\_{Y}(x)$ for all $x \in C(F\_{X})$. On the other hand, for all $x \in C(F\_{X}) \cap C(F\_{Y})$, the triangle inequality shows that $\vert F\_{X} - F\_{Y} \vert \leq \vert F\_{X} - F\_{X\_n} \vert + \vert F\_{X\_n}-F\_{Y} \vert \to 0$ as $n\to\infty$. If $(X\_{n})\_{n\in\mathbb{N}}$ and $(Y\_{n})\_{n\in\mathbb{N}}$ converge almost surely, in probability, or in $r$-mean to $X$ and $Y$, respectively, then $aX\_{n} + bY\_{n} \to aX + bY$ for all $a,b\in\mathbb{R}$ correspondingly to each mode **(#1)**.


## II
---
$(1) \begin{array}{ccccc} X_n \xrightarrow{c.c.} X & \Longrightarrow & X_n \xrightarrow{a.s.} X & \Longrightarrow & X_n \xrightarrow{p} X & \Longrightarrow & X_n \xrightarrow{d} X \end{array}$

$(2) \begin{array}{ccccc} X_n \xrightarrow{r} X & \Longrightarrow & X_n \xrightarrow{p} X \end{array}$

The first relation in $(1)$ comes by the 1st Borel-Canteli lemma. If $X_n$ are ind. and $X$ is degenerate, then its converse is true due to the 2nd Borel-Canteli lemma. The relation $(2)$ comes by Markov's inequality $P(\vert Y_n \vert > \varepsilon) \leq \varepsilon^{-r}\operatorname{E}{\vert Y_n \vert}^r$, where $Y_n = X_n-X$. The converse $X_n \xrightarrow{p} X \Longrightarrow X_n \xrightarrow{r} X$ holds if a weakly convergent sequence $({\vert X_n \vert}^p)\_{n\in\mathbb{N}}$ is [uniformly integrable]() (u.i.). Formally put, $(X_n)\_{n\in\mathbb{N}}$ is u.i. if for all $\varepsilon > 0$ there exists $B_\varepsilon \in [0, \infty)$ such that $\sup_{n} \operatorname{E}({\vert X_n \vert}I\_{\vert X_n \vert > B_\varepsilon}) \leq \varepsilon$ uniformly in $n\in\mathbb{N}$. We simply denote $\lim\_{b\to\infty} \sup_n \operatorname{E}({\vert X_n \vert}I\_{\vert X_n \vert > b})=0$ **(#2)**. While $X$ is u.i. if and only if $\operatorname{E}\vert X \vert < \infty$, the details of the u.i. of $X$ and $(X\_{n})\_{n\in\mathbb{N}}$ follow.

If we put $\operatorname{E}\vert X \vert = \operatorname{E}({\vert X \vert}I_{\vert X \vert \leq b}) + \operatorname{E}({\vert X \vert}I_{\vert X \vert > b})$, then ${\vert X \vert}I_{\vert X \vert \leq b} \geq 0$ and also ${\vert X \vert}I_{\vert X \vert \leq b} \nearrow \vert X \vert$ as $b\to\infty$. If we apply MCT for $\lim_{a\to\infty}\operatorname{E}({\vert X \vert}I_{\vert X \vert \leq b}) = \operatorname{E}(\lim_{a\to\infty}{\vert X \vert}I_{\vert X \vert \leq b}) = \operatorname{E}{\vert X \vert}$, then $\lim_{a\to\infty}\operatorname{E}({\vert X \vert}I_{\vert X \vert > b}) = 0$ for all $\operatorname{E}{\vert X \vert} < \infty$. Thus, $(X\_n)\_{n\in\mathbb{N}}$ is u.i. if and only if it holds (i) boundness: $\sup_n\operatorname{E}{\vert X_n \vert}<\infty$ **(#3)**; (ii) [uniform continuity](): for all $\varepsilon > 0$ there exists $\delta > 0$. That is, for all $A\in\mathcal{F}$ with $P(A) \leq \delta$ one has $\sup_n \operatorname{E}({\vert X_n \vert} I_A) = \sup_n\int_{A}{\vert X_n \vert}\,\mathrm{d}P \leq \varepsilon$. We put $\sup_n\operatorname{E}{\vert X_n I_A \vert} \to 0$ as $P(A) \to 0$; Since $\operatorname{E}({\vert X_n \vert}I_A) \leq aP(A) + \operatorname{E}({\vert X_n \vert} I\_{\vert X_n \vert >a}) \leq a\delta + \varepsilon/2 < \epsilon$, Markov's inequality on $A_n = \lbrace \vert X_n \vert > a \rbrace$ can show the necessity.

The converse relation under the u.i. is a generalisation of the [Vitali convergence theorem]() (which generalises the DCT). Measure theoretically, the theorem says that $(f\_n)\_{n\in\mathbb{N}} \subset L^p$ on a finite measure space $(X, \Sigma, \mu)$ converges in $L^p$ to $f \in L^p$ if and only if (i) $f_n$ converges in $\mu$-measure to $f$ **(#4)**; (ii) $({\vert f_n \vert}^p)\_{n\in\mathbb{N}}$ is u.i.; $P(\Omega)=1$ is indeed finite by axioms. The finiteness condition can be relaxed if, in addition, (iii) for all $\varepsilon>0$ there exists $E\_{\varepsilon} \in \Sigma$ such that $(F\in\Sigma) \land (F\cap{E_\varepsilon}) = \emptyset$ and $\sup_n\int_{F}{\vert f_n \vert}^p\,\mathrm{d}\mu < \varepsilon^p$. If we suppose $E_\epsilon = X$ whenever $\mu(X)<\infty$, then $F=\emptyset$ is the only element contained in $\Sigma$ such that $E_\varepsilon \cap F =\emptyset$ and $\int_\emptyset {\vert f_n \vert}^p = 0$ **(#5)**.


## III
---
// Skorokhod's representation theorem


## **
---
**(#1)** X_n Y_n \to XY$ correspondingly to each mode of convergence. **(#2)** Measure theoretically, u.i. holds for an uncountable set of functions indexed by $I$, and a sequence is merely a countable set with $I=\mathbb{N}$. **(#3)** $X = (X\_i)\_{i \in I}$ is bounded in norm as a subset of the vector space $L^1$. A finite collection of integrable r.v.s are u.i.. **(#4)** Given $(X,\Sigma,\mu)$, we say $f_n$ converges "globally" in measure to $f$ if $\lim\_{n\to\infty} \mu(\lbrace x \in X: {\vert f(x)-f_n(x) \vert} \geq \varepsilon \rbrace) = 0$, and "locally" if $\lim_{n\to\infty} \mu(\lbrace x \in F: {\vert f(x)-f_n(x) \vert} \geq \varepsilon \rbrace) = 0$, where $F \in \Sigma$ and $\mu(F) < \infty$; **(#5)** If $\mu(X) < \infty$, then the existence of a dominating integrable function $g$ can be replaced by the u.i. of the sequence $(f\_{n})_{n\in\mathbb{N}}$.