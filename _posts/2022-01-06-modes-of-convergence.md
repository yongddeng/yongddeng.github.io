---
layout: default
title: "206. mode of convergence"
tags: maths200
use_math: true
---


# Mode of Convergence
---
A random variable is a measurable function on $\Omega$, so a sequence of them converges in as many senses as a sequence of functions does. The five modes below run from strongest to weakest, except that convergence in mean is comparable with neither of the first two, and every implication that fails is witnessed by a function on $[0, 1)$ that can be drawn.


## I
---
**Definition.** For random variables $X, X\_1, X\_2, \dots$, a level $\varepsilon > 0$, the set $A\_n = \lbrace \lvert X\_n - X \rvert > \varepsilon \rbrace$ and its tail $T\_n = \bigcup\_{m \geq n} A\_m$, the sequence $X\_n$ converges to $X$

$$
\begin{array}{lll}
\text{completely, } X_n \xrightarrow{c.c.} X, & \text{if } \sum_n P(A_n) < \infty & \text{for every } \varepsilon > 0, \\
\text{almost surely, } X_n \xrightarrow{a.s.} X, & \text{if } P(T_n) \to 0 & \text{for every } \varepsilon > 0, \\
\text{in probability, } X_n \xrightarrow{p} X, & \text{if } P(A_n) \to 0 & \text{for every } \varepsilon > 0, \\
\text{in } r\text{-th mean, } X_n \xrightarrow{r} X, & \text{if } \operatorname{E}\lvert X_n - X \rvert^r \to 0 & \text{for a given } r > 0, \\
\text{in distribution, } X_n \xrightarrow{d} X, & \text{if } F_{X_n}(x) \to F_X(x) & \text{for every } x \in C(F_X).
\end{array}
$$

*Remarks.* The second reads pointwise as $P(\lim\_n X\_n = X) = 1$ and differs from the third only by the union over the tail, the fourth bounds the size of a deviation and not merely its probability, and the last involves the laws alone, so the $X\_n$ need not share a probability space. Restricting the last to $C(F\_X)$ lets the constants $1/n$ converge in distribution to $0$, as $I\_{[1/n,\infty)} \to I\_{(0,\infty)}$ fails only at $0$, the single discontinuity of $I\_{[0,\infty)}$.

**Theorem** (the chain)**.** For every $r > 0$,

$$
\begin{array}{ccccccc}
X_n \xrightarrow{c.c.} X & \Longrightarrow & X_n \xrightarrow{a.s.} X & \Longrightarrow & X_n \xrightarrow{p} X & \Longrightarrow & X_n \xrightarrow{d} X \\
 & & & & \Big\Uparrow & & \\
 & & & & X_n \xrightarrow{r} X & &
\end{array}
$$

and convergence in $r$-th mean implies convergence in $s$-th mean for every $0 < s < r$.

<details><summary>Proof</summary>
The first arrow is the first Borel-Cantelli lemma for each $\varepsilon = 1/k$, the second is $A_n \subseteq T_n$, and the third follows from $F_X(x - \varepsilon) - P(A_n) \leq F_{X_n}(x) \leq F_X(x + \varepsilon) + P(A_n)$ at every $x \in C(F_X)$. The vertical arrow is Markov's inequality $P(A_n) \leq \varepsilon^{-r}\operatorname{E}\lvert X_n - X \rvert^r$, and the last claim is Lyapunov's inequality $\lVert Y \rVert_s \leq \lVert Y \rVert_r$. &#8718;
</details>

**Examples** (no arrow reverses)**.** On $\Omega = [0, 1)$ with Lebesgue measure,

- *the typewriter* $X\_n = I\_{[j2^{-k}, (j+1)2^{-k})}$, with $n = 2^k + j$ and $0 \leq j < 2^k$, has $P(A\_n) = \operatorname{E}X\_n^r = 2^{-k} \to 0$ but $T\_n = [0, 1)$ for every $n$, so neither convergence in probability nor in mean gives almost sure convergence;
- *the spikes* $X\_n = nI\_{(0, 1/n)}$ have $T\_n = (0, 1/n)$, yet $\sum\_n P(A\_n) = \sum\_n 1/n = \infty$ and $\operatorname{E}X\_n = 1$, so almost sure convergence gives neither complete convergence nor convergence in $r$-th mean for $r \geq 1$, and $e^n I\_{(0, 1/n)}$ does the same for every $r > 0$;
- *the reflection* $X\_n = 1 - X$ of $X(\omega) = \omega$ has the uniform law of $X$, yet $P(A\_n) = 1 - \varepsilon$, so convergence in distribution does not give convergence in probability.
^

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#206/typewriter" width="460" height="232" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The typewriter, $\omega$ up the side and $n$ along. The column $A_n$ shrinks, but its shadow $T_n$ from $n$ on is always the whole of $[0, 1)$.</div></div>

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#206/spikes" width="460" height="232" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The spikes. The shadow $T_n = (0, 1/n)$ shrinks, while $\operatorname{E}X_n$, read below it, stays $1$.</div></div>


## II
---
**Theorem** (partial converses)**.** Each arrow reverses under a further hypothesis.

- If the $X\_n$ are independent and $X\_n \xrightarrow{a.s.} c$, a constant, then $X\_n \xrightarrow{c.c.} c$;
- $X\_n \xrightarrow{p} X$ if and only if every subsequence has a further subsequence converging to $X$ almost surely;
- if $X\_n \xrightarrow{d} c$, a constant, then $X\_n \xrightarrow{p} c$;
- if $X\_n \xrightarrow{p} X$ and $(\lvert X\_n \rvert^r)\_{n\in\mathbb{N}}$ is uniformly integrable, then $X\_n \xrightarrow{r} X$.

<details><summary>Proof</summary>
The first is the second Borel-Cantelli lemma read backwards, since independent $A_n$ with $P(A_n \text{ i.o.}) = 0$ must have $\sum_n P(A_n) < \infty$. For the second, a subsequence chosen with $P(\lvert X_{n_k} - X \rvert > 2^{-k}) < 2^{-k}$ converges almost surely by the first lemma (Riesz), and conversely a sequence whose $P(A_n)$ stays above some $\eta > 0$ along a subsequence has no further subsequence converging in probability. The third holds as $c \pm \varepsilon$ are continuity points of $I_{[c,\infty)}$, and the fourth is Vitali's theorem below. &#8718;
</details>

*Remarks.* The typewriter satisfies the subsequence criterion without converging almost surely, so no topology induces almost sure convergence, whereas $\operatorname{E}\min(\lvert X - Y \rvert, 1)$ metrises convergence in probability and the [Lévy metric]() convergence in distribution. Limits are unique almost surely in the first four modes, and only in law in the last, where $F\_X$ and $F\_Y$ agree on the dense set $C(F\_X) \cap C(F\_Y)$. Sums pass to the limit in the first four, and in the last only through [Slutsky's theorem](), for a constant second limit.

**Definition.** A family $(X\_i)\_{i \in I}$ is [uniformly integrable]() if $\lim\_{b \to \infty} \sup\_i \operatorname{E}(\lvert X\_i \rvert I\_{\lbrace \lvert X\_i \rvert > b \rbrace}) = 0$.

**Proposition.** A finite family of integrable random variables is uniformly integrable, as is a family dominated by some $Y \in L^1$ and one with $\sup\_i \operatorname{E}\lvert X\_i \rvert^{1+\delta} < \infty$ for some $\delta > 0$. A family is uniformly integrable if and only if $\sup\_i \operatorname{E}\lvert X\_i \rvert < \infty$ and $\sup\_i \operatorname{E}(\lvert X\_i \rvert I\_A) \to 0$ as $P(A) \to 0$.

<details><summary>Proof</summary>
Domination gives $\operatorname{E}(\lvert X_i \rvert I_{\lbrace \lvert X_i \rvert > b \rbrace}) \leq \operatorname{E}(Y I_{\lbrace Y > b \rbrace}) \to 0$ by dominated convergence, a finite family being dominated by $\sum_i \lvert X_i \rvert$, and the moment bound gives $\operatorname{E}(\lvert X_i \rvert I_{\lbrace \lvert X_i \rvert > b \rbrace}) \leq b^{-\delta}\operatorname{E}\lvert X_i \rvert^{1+\delta}$. For the equivalence, $\operatorname{E}(\lvert X_i \rvert I_A) \leq bP(A) + \operatorname{E}(\lvert X_i \rvert I_{\lbrace \lvert X_i \rvert > b \rbrace})$ gives one direction, and Markov's inequality $P(\lvert X_i \rvert > b) \leq b^{-1}\sup_i \operatorname{E}\lvert X_i \rvert$ the other. &#8718;
</details>

**Theorem** ([Vitali]())**.** If $X\_n \in L^r$ for some $0 < r < \infty$ and $X\_n \xrightarrow{p} X$, the following are equivalent, (i) $(\lvert X\_n \rvert^r)\_{n\in\mathbb{N}}$ is uniformly integrable; (ii) $X\_n \xrightarrow{r} X$; (iii) $\operatorname{E}\lvert X\_n \rvert^r \to \operatorname{E}\lvert X \rvert^r < \infty$.

<details><summary>Proof</summary>
From (i), Fatou's lemma along an almost surely convergent subsequence puts $X$ in $L^r$, so $(\lvert X_n - X \rvert^r)$ is uniformly integrable, and splitting $\operatorname{E}\lvert X_n - X \rvert^r$ over $A_n$ and its complement bounds it by $\varepsilon^r$ plus a term that vanishes as $P(A_n) \to 0$. (ii) gives (iii) by the triangle inequality in $L^r$, or by $\lvert \lvert a \rvert^r - \lvert b \rvert^r \rvert \leq \lvert a - b \rvert^r$ when $r < 1$. From (iii), a continuous cut-off $\psi_b \leq x$ vanishing beyond $b$ has $\operatorname{E}\psi_b(\lvert X_n \rvert^r) \to \operatorname{E}\psi_b(\lvert X \rvert^r)$ by bounded convergence, and $\operatorname{E}(\lvert X_n \rvert^r I_{\lbrace \lvert X_n \rvert^r > b \rbrace}) \leq \operatorname{E}\lvert X_n \rvert^r - \operatorname{E}\psi_b(\lvert X_n \rvert^r)$ is then small for large $b$ and $n$. &#8718;
</details>

*Remark.* The spikes fail (i), with $\operatorname{E}(X\_n I\_{\lbrace X\_n > b \rbrace}) = 1$ for every $n > b$. On a finite measure space the theorem reads $f\_n \to f$ in $L^p$ if and only if $f\_n \to f$ in measure and $(\lvert f\_n \rvert^p)$ is uniformly integrable, so it generalises dominated convergence, and an infinite measure space needs tightness besides, $\sup\_n \int\_{E\_\varepsilon^c} \lvert f\_n \rvert^p \, \mathrm{d}\mu < \varepsilon$ for some $E\_\varepsilon$ of finite measure.


## III
---
**Theorem** ([Skorokhod]())**.** If $X\_n \xrightarrow{d} X$ on $\mathbb{R}$, there are $Y\_n \overset{d}{=} X\_n$ and $Y \overset{d}{=} X$ on one probability space with $Y\_n \xrightarrow{a.s.} Y$.

<details><summary>Proof</summary>
Take $\Omega = (0, 1)$ with Lebesgue measure and the quantile functions $Y_n(\omega) = \inf \lbrace x \in \mathbb{R} \mid F_{X_n}(x) \geq \omega \rbrace$ and $Y(\omega) = \inf \lbrace x \in \mathbb{R} \mid F_X(x) \geq \omega \rbrace$, which have the right laws as $Y(\omega) \leq x$ if and only if $\omega \leq F_X(x)$. Convergence of $F_{X_n}$ on $C(F_X)$ gives $Y_n(\omega) \to Y(\omega)$ at every continuity point of the monotone $Y$, so off a countable set. Skorokhod (1956) proved the theorem for complete separable metric spaces. &#8718;
</details>

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#206/quantile" width="460" height="232" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The quantile functions of $S_n/\sqrt{n}$ for $n$ fair $\pm 1$ coins closing on $\Phi^{-1}$, the central limit theorem drawn as almost sure convergence on $(0, 1)$.</div></div>

**Corollary.** If $X\_n \xrightarrow{d} X$, then (i) $g(X\_n) \xrightarrow{d} g(X)$ for every $g$ continuous on a set of $P\_X$-measure one; (ii) $\operatorname{E}\lvert X \rvert \leq \liminf\_n \operatorname{E}\lvert X\_n \rvert$; (iii) $\operatorname{E}X\_n \to \operatorname{E}X$ when $(X\_n)\_{n\in\mathbb{N}}$ is uniformly integrable.

<details><summary>Proof</summary>
Apply to the $Y_n$ that almost sure convergence survives a map continuous on a set of full measure and implies convergence in distribution, then Fatou's lemma, then Vitali's theorem, uniform integrability being a property of the laws alone. &#8718;
</details>
