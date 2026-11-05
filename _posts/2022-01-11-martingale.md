---
layout: default
title: "211. martingale"
tags: maths200
use_math: true
---


# Martingale
---
A martingale is the fortune of a gambler in a fair game, a process whose best forecast of any later value is its present value. The name comes from a betting system that doubles the stake after each loss, and the theory explains why no such system beats a fair game on a finite budget. Ville named the notion in 1939, and Doob built it into a framework that now carries much of the study of stochastic processes and of modern probability.


## I
---
**Definition.** An adapted process $X$ on a filtered probability space $(\Omega, \mathcal{F}, \mathbb{F}, P)$ with every $X\_t \in L^1$ is

$$
\begin{array}{ll}
\text{a martingale} & \text{if } \operatorname{E}(X_t \mid \mathcal{F}_s) = X_s, \\
\text{a sub-martingale} & \text{if } \operatorname{E}(X_t \mid \mathcal{F}_s) \geq X_s, \\
\text{a super-martingale} & \text{if } \operatorname{E}(X_t \mid \mathcal{F}_s) \leq X_s,
\end{array}
$$

almost surely for all $s \leq t$ in $T$.

*Remarks.* A [martingale]() models a fair game, a [sub-martingale]() a favourable and a [super-martingale]() an unfavourable one, and $X$ is a super-martingale exactly when $-X$ is a sub-martingale. Taking expectations, a martingale has the constant mean $\operatorname{E}X\_t = \operatorname{E}X\_0$ and the others monotone means. A martingale for $\mathbb{G}$ is one for every coarser filtration to which it is adapted, by the tower property, so the more slowly a filtration grows the easier it is to be a martingale for it, and the natural filtration is the easiest.

**Proposition.** In discrete time an adapted integrable $X$ is a martingale if and only if $\operatorname{E}(X\_{n+1} \mid \mathcal{F}\_n) = X\_n$ for every $n$, and likewise for sub- and super-martingales with the inequalities.

<details><summary>Proof</summary>
For $m > n$ the tower property, applied to $\mathcal{F}_n \subseteq \mathcal{F}_{m-1}$, gives $\operatorname{E}(X_m \mid \mathcal{F}_n) = \operatorname{E}(\operatorname{E}(X_m \mid \mathcal{F}_{m-1}) \mid \mathcal{F}_n) = \operatorname{E}(X_{m-1} \mid \mathcal{F}_n)$, and induction on $m - n$ ends at $\operatorname{E}(X_n \mid \mathcal{F}_n) = X_n$. Inequalities pass through by the monotonicity of conditional expectation. &#8718;
</details>

**Definition.** For $T = \mathbb{N}$ the [martingale differences]() of $X$ are $D\_0 = X\_0$ and $D\_n = X\_n - X\_{n-1}$, so that $X\_n = D\_0 + \dots + D\_n$, and an adapted integrable $D$ is a [martingale difference sequence]() if $\operatorname{E}(D\_n \mid \mathcal{F}\_{n-1}) = 0$ for every $n \geq 1$.

*Remark.* So $X$ is a martingale exactly when its differences form a martingale difference sequence. Those after $D\_0$ have mean zero, and in $L^2$ all of them are uncorrelated, $\operatorname{E}(D\_m D\_n) = \operatorname{E}(D\_m \operatorname{E}(D\_n \mid \mathcal{F}\_{n-1})) = 0$ for $m < n$, so orthogonality takes the place of the independence of a sum of independent terms.

**Examples.** For independent $\xi\_1, \xi\_2, \dots \in L^1$ with $\mathcal{F}\_n = \sigma(\xi\_1, \dots, \xi\_n)$,

- the partial sums $S\_n = \xi\_1 + \dots + \xi\_n$ form a martingale when every $\operatorname{E}\xi\_k = 0$, and a sub- or super-martingale when every $\operatorname{E}\xi\_k \geq 0$ or every $\operatorname{E}\xi\_k \leq 0$, so the walk with steps $\pm 1$ of probabilities $p$ and $q$ is a martingale only for $p = 1/2$, and $S\_n^2 - \sum\_{k \leq n}\operatorname{E}\xi\_k^2$ is a martingale for mean-zero $\xi\_k \in L^2$;
- the products $\xi\_1 \cdots \xi\_n$ form a martingale when every $\operatorname{E}\xi\_k = 1$, as a likelihood ratio of independent observations does under the null hypothesis;
- [Doob's martingale]() $X\_n = \operatorname{E}(Y \mid \mathcal{F}\_n)$ of any $Y \in L^1$, the forecast of $Y$ revised as information arrives, is a martingale for any filtration.

*Remark.* In continuous time Brownian motion $B\_t$, $B\_t^2 - t$ and the compensated Poisson process $N\_t - \lambda t$ are martingales, whereas $N\_t$ itself, with mean $\lambda t$, is a sub-martingale. Martingales in continuous time are taken under the usual conditions, which give every martingale a càdlàg modification, and their paths need not be continuous, as $N\_t - \lambda t$ jumps by $1$ at every arrival.


## II
---
**Proposition.** Martingales for a fixed filtration form a vector space, and sub-martingales a cone closed under sums and non-negative multiples. If $X$ is a martingale and $\varphi$ is convex with every $\varphi(X\_t) \in L^1$, then $\varphi(X)$ is a sub-martingale, and so it is for a sub-martingale $X$ when $\varphi$ is also non-decreasing. Hence $\lvert X \rvert$, and $X^2$ in $L^2$, are sub-martingales for a martingale $X$, and $X^+$ is one for a sub-martingale.

<details><summary>Proof</summary>
Linearity of conditional expectation gives the first sentence. The conditional Jensen inequality gives $\varphi(\operatorname{E}(X_t \mid \mathcal{F}_s)) \leq \operatorname{E}(\varphi(X_t) \mid \mathcal{F}_s)$, whose left side is $\varphi(X_s)$ for a martingale and at least $\varphi(X_s)$ for a sub-martingale when $\varphi$ is non-decreasing. &#8718;
</details>

**Theorem** ([Doob decomposition]())**.** In discrete time an adapted integrable $X$ decomposes uniquely as $X\_n = M\_n + A\_n$ with $M$ a martingale and $A$ a [predictable process]() with $A\_0 = 0$, and $X$ is a sub-martingale if and only if $A$ is almost surely non-decreasing.

<details><summary>Proof</summary>
Put $A_n = \sum_{k=1}^{n}\operatorname{E}(X_k - X_{k-1} \mid \mathcal{F}_{k-1})$, which is predictable, so $M = X - A$ has differences $X_k - X_{k-1} - \operatorname{E}(X_k - X_{k-1} \mid \mathcal{F}_{k-1})$ of zero conditional mean. Two decompositions differ by a predictable martingale $N$ with $N_0 = 0$, and $N_n = \operatorname{E}(N_n \mid \mathcal{F}_{n-1}) = N_{n-1}$ makes it zero. The increments of $A$ are non-negative exactly when $X$ is a sub-martingale. &#8718;
</details>

*Remarks.* For mean-zero independent $\xi\_k \in L^2$ the predictable part of $S\_n^2$ is $\sum\_{k \leq n}\operatorname{E}\xi\_k^2$, the [compensator]() that turns $S\_n^2$ into a martingale, and in continuous time the Doob-Meyer decomposition does the same for right-continuous sub-martingales of class (D). The [Krickeberg decomposition]() writes a martingale bounded in $L^1$ as the difference of two non-negative martingales<!-- , and the Riesz decomposition is another variant -->.


## III
---
**Theorem** ([optional stopping]())**.** Let $X$ be a martingale and $\tau$ a stopping time. The stopped process $X\_{\tau \wedge n}$ is a martingale, and $\operatorname{E}X\_\tau = \operatorname{E}X\_0$ if one of the following holds, (i) $\tau \leq N$ for a constant $N$; (ii) $\tau < \infty$ almost surely and $\lvert X\_{\tau \wedge n} \rvert \leq K$ for every $n$; (iii) $\operatorname{E}\tau < \infty$ and $\operatorname{E}(\lvert X\_{n+1} - X\_n \rvert \mid \mathcal{F}\_n) \leq c$ almost surely for every $n$. For a sub-martingale the same conditions give $\operatorname{E}X\_\tau \geq \operatorname{E}X\_0$.

<details><summary>Proof</summary>
Write $X_{\tau \wedge n} = X_0 + \sum_{k=1}^{n} I_{\lbrace \tau \geq k \rbrace}(X_k - X_{k-1})$, where $\lbrace \tau \geq k \rbrace = \lbrace \tau \leq k - 1 \rbrace^c \in \mathcal{F}_{k-1}$, so each term has zero conditional mean and $\operatorname{E}X_{\tau \wedge n} = \operatorname{E}X_0$. Let $n \to \infty$. Under (i) take $n = N$, under (ii) use bounded convergence, and under (iii) $\lvert X_{\tau \wedge n} \rvert \leq \lvert X_0 \rvert + \sum_{k \geq 1} I_{\lbrace \tau \geq k \rbrace}\lvert X_k - X_{k-1} \rvert$, whose mean is at most $\operatorname{E}\lvert X_0 \rvert + c\operatorname{E}\tau$, so dominated convergence applies. &#8718;
</details>

**Example** (doubling)**.** Bet $1$ on a fair coin, double the stake after each loss and stop at the first win $\tau$. Then $X\_\tau = 1$ almost surely although $\operatorname{E}X\_0 = 0$, while $\operatorname{E}\tau = 2$, so it is the bound on the increments in (iii) that fails, the stake $2^{n-1}$ being unbounded and the credit with it. With at most $m$ bets, by a table limit or a budget of $2^m - 1$, the time $\tau \wedge m$ is bounded and (i) applies, the gambler winning $1$ with probability $1 - 2^{-m}$ and losing $2^m - 1$ with probability $2^{-m}$, a mean gain of $(1 - 2^{-m}) - 2^{-m}(2^m - 1) = 0$.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#211/doubling" width="600" height="236" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">A fair coin played by the doubling system with at most $m$ bets a round. The fortune climbs by $1$ a round and falls by $2^m - 1$ whenever $m$ losses come in a row, and the law of one round, right, has mean $0$ for every $m$.</div></div>

**Theorem** ([Doob's maximal inequality]())**.** Let $M\_n = \max\_{k \leq n} X\_k$. If $X$ is a sub-martingale and $\lambda > 0$, then $\lambda P(M\_n \geq \lambda) \leq \operatorname{E}(X\_n I\_{\lbrace M\_n \geq \lambda \rbrace}) \leq \operatorname{E}X\_n^+$. If $X$ is a non-negative sub-martingale and $p > 1$, then $\operatorname{E}M\_n^p \leq (p/(p - 1))^p \operatorname{E}X\_n^p$, which applies to $\lvert X \rvert$ for a martingale $X$ in $L^p$.

<details><summary>Proof</summary>
Let $\tau$ be the first $k \leq n$ with $X_k \geq \lambda$, and $n$ if there is none. The event $A = \lbrace M_n \geq \lambda \rbrace$ lies in $\mathcal{F}_\tau$, and optional stopping at the bounded times $\tau \leq n$ gives $\lambda P(A) \leq \operatorname{E}(X_\tau I_A) \leq \operatorname{E}(X_n I_A)$. For $p > 1$, integrating this against $p\lambda^{p-1}\,\mathrm{d}\lambda$ gives $\operatorname{E}M_n^p \leq \frac{p}{p-1}\operatorname{E}(X_n M_n^{p-1})$, and Hölder's inequality bounds the right side by $\frac{p}{p-1}\lVert X_n \rVert_p \lVert M_n \rVert_p^{p-1}$, which may be divided out as $M_n \leq X_0 + \dots + X_n \in L^p$. &#8718;
</details>

*Remark.* For independent mean-zero $\xi\_k \in L^2$ the sub-martingale $S\_n^2$ gives [Kolmogorov's inequality]() $P(\max\_{k \leq n}\lvert S\_k \rvert \geq \lambda) \leq \lambda^{-2}\operatorname{Var}S\_n$, which Doob's inequality thus generalises, and the $L^p$ bound is what upgrades almost sure convergence to convergence in $L^p$.


## IV
---
**Lemma** ([upcrossing inequality]())**.** Let $X$ be a sub-martingale, $a < b$, and $U\_n[a, b]$ the number of upcrossings of $[a, b]$ completed by time $n$, the passages from at most $a$ to at least $b$. Then $(b - a)\operatorname{E}U\_n[a, b] \leq \operatorname{E}(X\_n - a)^+$.

<details><summary>Proof</summary>
$Y = (X - a)^+$ is a sub-martingale that crosses $[0, b - a]$ exactly when $X$ crosses $[a, b]$. Holding one unit of $Y$ from each visit to $0$ until the next rise to $b - a$ is a predictable strategy $H \in \lbrace 0, 1 \rbrace$ that earns at least $(b - a)U_n[a, b]$, as an unfinished crossing that starts from $Y = 0$ loses nothing. Holding $1 - H$ earns a sub-martingale transform of non-negative mean, so $(b - a)\operatorname{E}U_n[a, b] \leq \operatorname{E}(Y_n - Y_0) \leq \operatorname{E}Y_n$. &#8718;
</details>

**Theorem** ([martingale convergence]())**.** A sub-martingale with $\sup\_n \operatorname{E}X\_n^+ < \infty$ converges almost surely to some $X\_\infty \in L^1$. For a martingale the following are equivalent, (i) $(X\_n)\_{n \in \mathbb{N}}$ is uniformly integrable; (ii) $X\_n \to X\_\infty$ in $L^1$; (iii) $X\_n = \operatorname{E}(X\_\infty \mid \mathcal{F}\_n)$ for some $X\_\infty \in L^1$ and every $n$. A martingale bounded in $L^p$ for some $p > 1$ converges almost surely and in $L^p$.

<details><summary>Proof</summary>
For rationals $a < b$, monotone convergence and the lemma give $\operatorname{E}U_\infty[a, b] \leq (\sup_n \operatorname{E}X_n^+ + \lvert a \rvert)/(b - a) < \infty$, so almost surely no rational pair is crossed infinitely often, which rules out $\liminf_n X_n < \limsup_n X_n$. Fatou's lemma bounds $\operatorname{E}\lvert X_\infty \rvert$ by $\sup_n \operatorname{E}\lvert X_n \rvert \leq 2\sup_n \operatorname{E}X_n^+ - \operatorname{E}X_0$. For a martingale, (i) gives (ii) by Vitali's theorem, (ii) gives (iii) as $\operatorname{E}(X_m \mid \mathcal{F}_n) = X_n$ passes to the limit in $L^1$, and (iii) gives (i) since the conditional expectations of one integrable variable are uniformly integrable. Doob's $L^p$ inequality dominates $\sup_n \lvert X_n \rvert^p$ by an integrable variable for the last claim. &#8718;
</details>

*Remarks.* A non-negative super-martingale converges almost surely, as $-X$ is a sub-martingale with $(-X\_n)^+ = 0$. The proportion of red balls in [Pólya's urn](), which returns each drawn ball with another of its colour, is a martingale in $[0, 1]$, so it converges, and from one ball of each colour its limit is uniform. Convergence need not hold in $L^1$, as the products of independent factors $0$ or $2$, each with probability $1/2$, have mean $1$ and converge to $0$.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#211/upcrossings" width="600" height="236" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">A path with the band $[a, b]$ and each completed upcrossing in orange, below the exact $\operatorname{E}U_n$ and its bound $\operatorname{E}(X_n - a)^+/(b - a)$. For the walk the bound grows like $\sqrt{n}$ and the crossings go on, whereas for Pólya's urn it stays below $(1 - a)/(b - a)$ and the path settles.</div></div>

*Remarks.* The theorem proves the [Radon-Nikodym theorem]() for countably generated $\sigma$-algebras, the density being the limit of the ratios of the two measures over finer and finer finite partitions. The [martingale central limit theorem]() states that a martingale difference sequence with $n^{-1}\sum\_{k \leq n}\operatorname{E}(D\_k^2 \mid \mathcal{F}\_{k-1}) \xrightarrow{p} \sigma^2$ and $n^{-1}\sum\_{k \leq n}\operatorname{E}(D\_k^2 I\_{\lbrace \lvert D\_k \rvert > \varepsilon\sqrt{n} \rbrace} \mid \mathcal{F}\_{k-1}) \xrightarrow{p} 0$ for every $\varepsilon > 0$, a conditional Lindeberg condition, has $n^{-1/2}\sum\_{k \leq n} D\_k \xrightarrow{d} N(0, \sigma^2)$.
