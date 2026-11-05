---
layout: default
title: "203. expected value"
tags: maths200
use_math: true
---


# Expected Value
---
The expected value is the Lebesgue integral of a random variable against $P$, so it inherits the integral's properties and its convergence theorems. The idea goes back to the problem of points in Pascal and Fermat's letters of 1654 and to Huygens's treatise of 1657, and the post ends with conditional expectation, the integral taken against partial information.


## I
---
**Definition.** The [expected value]() of a random variable $X \geq 0$ is

$$
\operatorname{E}X = \int_\Omega X \, \mathrm{d}P = \sup \Big\lbrace \sum_{i=1}^k a_i P(A_i) \;\Big\vert\; \sum_{i=1}^k a_i I_{A_i} \leq X, \ a_i \geq 0, \ A_i \in \mathcal{F} \Big\rbrace \in [0, \infty],
$$

the supremum over simple random variables below $X$. A general $X = X^+ - X^-$, with $X^+ = \max(X, 0)$ and $X^- = \max(-X, 0)$, has $\operatorname{E}X = \operatorname{E}X^+ - \operatorname{E}X^-$ whenever one of the two is finite, and $X$ is [integrable](), $X \in L^1$, when both are.

*Remark.* $\operatorname{E}I\_A = P(A)$, and the simple $X\_n = \min(n, 2^{-n} \lfloor 2^n X \rfloor)$ increase to $X$, so by monotone convergence the supremum is the limit of $\operatorname{E}X\_n$. These cut the range of $X$ into levels and measure the set where $X$ reaches each, where Riemann cuts the domain into cells, which is why the integral needs nothing of $\Omega$ but its measure.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#203/simple" width="460" height="226" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">A positive $X$ on $\Omega = [0, 1)$ and the simple $X_n$ under it. Lebesgue's levels $k2^{-n}$ and Riemann's cells of width $2^{-n}$ both climb to $\operatorname{E}X$ here, but only the levels make sense on an $\Omega$ with no order.</div></div>

**Theorem** (change of variables)**.** If $g$ is Borel and $g(X)$ is non-negative or integrable, then

$$
\operatorname{E}g(X) = \int_{\mathbb{R}} g \, \mathrm{d}P_X = \int_{\mathbb{R}} g(x) \, \mathrm{d}F_X(x),
$$

which is $\sum\_x g(x) p\_X(x)$ for a discrete $X$ and $\int\_{\mathbb{R}} g(x) f\_X(x) \, \mathrm{d}x$ for an $X$ with a density.

<details><summary>Proof</summary>
It holds for $g = I_B$ by the definition of $P_X$, hence for simple $g$ by linearity, for $g \geq 0$ by monotone convergence and for integrable $g(X)$ by splitting $g = g^+ - g^-$. &#8718;
</details>

*Remark.* The law alone fixes every expectation, which is why one speaks of the mean of a distribution, and a random vector has the mean vector $\operatorname{E}\mathbf{X} = (\operatorname{E}X\_1, \dots, \operatorname{E}X\_n)$.

**Proposition.** For integrable $X, Y$ and $a \in \mathbb{R}$, (i) $\operatorname{E}(aX + Y) = a\operatorname{E}X + \operatorname{E}Y$; (ii) $X \leq Y$ almost surely implies $\operatorname{E}X \leq \operatorname{E}Y$; (iii) $\lvert \operatorname{E}X \rvert \leq \operatorname{E}\lvert X \rvert$; (iv) $\operatorname{E}\lvert X \rvert = 0$ implies $X = 0$ almost surely; (v) $\operatorname{E}\lvert X \rvert^\beta < \infty$ implies $\operatorname{E}\lvert X \rvert^\alpha < \infty$ for $0 < \alpha < \beta$; (vi) if $X$ and $Y$ are independent, $XY$ is integrable and $\operatorname{E}XY = \operatorname{E}X \operatorname{E}Y$.

<details><summary>Proof</summary>
(i) to (iii) pass from simple random variables by monotone convergence. (iv) follows from $P(\lvert X \rvert > 1/k) \leq k\operatorname{E}\lvert X \rvert = 0$ for every $k$, and (v) from $\lvert X \rvert^\alpha \leq 1 + \lvert X \rvert^\beta$, which uses $P(\Omega) = 1$. For (vi), the product rule holds for indicators of $\lbrace X \in A \rbrace$ and $\lbrace Y \in B \rbrace$, hence for simple functions of $X$ and of $Y$, and monotone convergence carries it to $\lvert X \rvert$ and $\lvert Y \rvert$ and then to $X^\pm$ and $Y^\pm$. &#8718;
</details>

*Remarks.* The converse of (vi) fails, as $X$ uniform on $\lbrace -1, 0, 1 \rbrace$ and $Y = X^2$ have $\operatorname{E}XY = \operatorname{E}X^3 = 0 = \operatorname{E}X \operatorname{E}Y$ without being independent, so uncorrelated is weaker than independent. On an infinite measure space (v) fails, as $x^{-1}$ is square integrable on $[1, \infty)$ under Lebesgue measure but not integrable.

**Theorem** (limits under $\operatorname{E}$)**.** For random variables $X\_1, X\_2, \dots$,

- ([monotone convergence]()) if $0 \leq X\_n \uparrow X$, then $\operatorname{E}X\_n \uparrow \operatorname{E}X$;
- ([Fatou's lemma]()) if $X\_n \geq 0$, then $\operatorname{E}\liminf\_n X\_n \leq \liminf\_n \operatorname{E}X\_n$;
- ([dominated convergence]()) if $X\_n \to X$ almost surely and $\lvert X\_n \rvert \leq Y$ with $\operatorname{E}Y < \infty$, then $\operatorname{E}\lvert X\_n - X \rvert \to 0$ and so $\operatorname{E}X\_n \to \operatorname{E}X$, the [bounded convergence theorem]() being the case of a constant $Y$.

<details><summary>Proof</summary>
For monotone convergence, $\operatorname{E}X_n$ increases to some $L \leq \operatorname{E}X$, and for a simple $S \leq X$ and $c < 1$ the events $\lbrace X_n \geq cS \rbrace$ increase to $\Omega$, so $L \geq c\operatorname{E}S$ by continuity of $P$. Fatou's lemma applies it to $\inf_{k \geq n} X_k \uparrow \liminf_n X_n$, and dominated convergence applies Fatou's lemma to $2Y - \lvert X_n - X \rvert \geq 0$. &#8718;
</details>

*Remark.* Without such hypotheses limits and expectations do not commute. On $[0, 1)$ the spikes $X\_n = nI\_{(0, 1/n)}$ tend to $0$ at every $\omega$ while $\operatorname{E}X\_n = 1$, so Fatou's inequality can be strict, and decreasing sequences need $\operatorname{E}X\_1 < \infty$, as $X\_n = \omega^{-1} I\_{(0, 1/n)}$ decrease to $0$ with $\operatorname{E}X\_n = \infty$ throughout.


## II
---
**Definition.** For an integer $r \geq 1$ the [$r$-th moment]() of $X$ is $\operatorname{E}X^r$ and its [central moment]() is $\mu\_r = \operatorname{E}(X - \mu)^r$ about the mean $\mu = \operatorname{E}X$, and for real $r > 0$ its [absolute moment]() is $\operatorname{E}\lvert X \rvert^r$, whenever these exist. The [variance]() is $\sigma^2 = \mu\_2 = \operatorname{E}X^2 - \mu^2$, the [skewness]() $\mu\_3 / \sigma^3$ and the [kurtosis]() $\mu\_4 / \sigma^4$.

*Remark.* A normal law has skewness $0$ and kurtosis $3$, so the excess kurtosis $\mu\_4 / \sigma^4 - 3$ compares the weight of the tails with it.

**Definition.** The [moment generating function]() of $X$ is $m\_X(t) = \operatorname{E}e^{tX}$ at those $t \in \mathbb{R}$ where it is finite, a set that always contains $0$.

**Theorem.** If $m\_X$ is finite on $(-\varepsilon, \varepsilon)$ for some $\varepsilon > 0$, then (i) $X$ has moments of every order and $m\_X(t) = \sum\_{r \geq 0} t^r \operatorname{E}X^r / r!$ there, so $m\_X^{(r)}(0) = \operatorname{E}X^r$; (ii) $P(\lvert X \rvert > x) \leq Ce^{-\delta x}$ for some $C, \delta > 0$, and conversely such a bound makes $m\_X$ finite near $0$; (iii) $m\_X = m\_Y$ on $(-\varepsilon, \varepsilon)$ implies $F\_X = F\_Y$.

<details><summary>Proof</summary>
(i) is dominated convergence with $\sum_r \lvert tX \rvert^r / r! = e^{\lvert tX \rvert} \leq e^{tX} + e^{-tX}$. (ii) Markov's inequality gives $P(\pm X > x) \leq e^{-\delta x} m_X(\pm\delta)$ for $\delta < \varepsilon$, and conversely the bound makes $\operatorname{E}e^{t \lvert X \rvert}$ finite for $t < \delta$. (iii) By (i), $m_X(z) = \operatorname{E}e^{zX}$ is analytic on the strip $\lvert \operatorname{Re} z \rvert < \varepsilon$, so $m_X = m_Y$ there, and on the imaginary axis the characteristic functions agree, which determine the law. &#8718;
</details>

*Remarks.* Every moment can be finite while $m\_X(t) = \infty$ for all $t > 0$, as for the lognormal $e^Z$ with $Z$ standard normal, whose moments $e^{r^2/2}$ are shared by other laws, so on $\mathbb{R}$ moments need not fix a law (the [Hamburger moment problem]()). On a bounded interval they always do (the [Hausdorff moment problem]()), by Weierstrass approximation, and on $\mathbb{R}$ they do under Carleman's condition $\sum\_r (\operatorname{E}X^{2r})^{-1/(2r)} = \infty$.

*Remark.* The density $x^{-2}$ on $(1, \infty)$ has $m\_X(t) = \infty$ for every $t > 0$, and no finite mean either<!-- , a function being analytic at a point when its Taylor series converges to it near that point, the Maclaurin series when the point is 0 -->.


## III
---
**Definition.** For an integrable $X$ and a sub-$\sigma$-algebra $\mathcal{G} \subseteq \mathcal{F}$, a [conditional expectation]() $\operatorname{E}(X \mid \mathcal{G})$ is a $\mathcal{G}$-measurable integrable random variable with $\int\_A \operatorname{E}(X \mid \mathcal{G}) \, \mathrm{d}P = \int\_A X \, \mathrm{d}P$ for every $A \in \mathcal{G}$, and $\operatorname{E}(X \mid Y) = \operatorname{E}(X \mid \sigma(Y))$ for a random variable $Y$.

**Theorem** (existence)**.** $\operatorname{E}(X \mid \mathcal{G})$ exists and is unique up to a null set, and for $X \in L^2$ it is the orthogonal projection of $X$ onto the closed subspace $L^2(\Omega, \mathcal{G}, P)$, the $\mathcal{G}$-measurable $Z$ that minimises $\operatorname{E}(X - Z)^2$.

<details><summary>Proof</summary>
For $X \geq 0$, $\nu(A) = \int_A X \, \mathrm{d}P$ is a finite measure on $\mathcal{G}$ that vanishes where $P$ does, so the Radon-Nikodym theorem gives $\operatorname{E}(X \mid \mathcal{G}) = \mathrm{d}\nu / \mathrm{d}P\vert_{\mathcal{G}}$, and a general $X$ splits as $X^+ - X^-$. Two versions $Z$ and $Z'$ have $\int_A (Z - Z') \, \mathrm{d}P = 0$ on $A = \lbrace Z > Z' \rbrace \in \mathcal{G}$, so $Z \leq Z'$ almost surely, and symmetrically. For $X \in L^2$ the projection $Z$ has $X - Z \perp I_A$ for every $A \in \mathcal{G}$, which is the defining identity. &#8718;
</details>

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#203/condexp" width="460" height="226" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">$\mathcal{G}$ generated by $2^j$ equal cells of $[0, 1)$. $\operatorname{E}(X \mid \mathcal{G})$ is the average of $X$ on each cell, and the dashed steps, one level coarser, average the solid ones, which is the tower property.</div></div>

**Theorem** (properties)**.** For integrable $X, Y$, a real $a$ and sub-$\sigma$-algebras $\mathcal{H} \subseteq \mathcal{G}$, almost surely,

- $\operatorname{E}(aX + Y \mid \mathcal{G}) = a\operatorname{E}(X \mid \mathcal{G}) + \operatorname{E}(Y \mid \mathcal{G})$, and $X \leq Y$ implies $\operatorname{E}(X \mid \mathcal{G}) \leq \operatorname{E}(Y \mid \mathcal{G})$;
- $\operatorname{E}(X \mid \mathcal{G}) = X$ if $X$ is $\mathcal{G}$-measurable, and $\operatorname{E}(X \mid \mathcal{G}) = \operatorname{E}X$ if $X$ is independent of $\mathcal{G}$;
- $\operatorname{E}(YX \mid \mathcal{G}) = Y\operatorname{E}(X \mid \mathcal{G})$ if $Y$ is $\mathcal{G}$-measurable and $YX$ is integrable;
- $\operatorname{E}(\operatorname{E}(X \mid \mathcal{G}) \mid \mathcal{H}) = \operatorname{E}(X \mid \mathcal{H}) = \operatorname{E}(\operatorname{E}(X \mid \mathcal{H}) \mid \mathcal{G})$, the [tower property](), and $\operatorname{E}\operatorname{E}(X \mid \mathcal{G}) = \operatorname{E}X$, the [law of total expectation]().

<details><summary>Proof</summary>
Each right-hand side is measurable for the $\sigma$-algebra on the left and has the integrals over its sets that define the left, so uniqueness applies. In the tower, $\int_A \operatorname{E}(X \mid \mathcal{G}) \, \mathrm{d}P = \int_A X \, \mathrm{d}P$ for $A \in \mathcal{H} \subseteq \mathcal{G}$ gives the first equality and stability the second, while taking out what is known holds for $Y = I_B$ with $B \in \mathcal{G}$ and extends by linearity and limits. &#8718;
</details>

**Corollary** (total variance)**.** For $X \in L^2$ and $\operatorname{Var}(X \mid \mathcal{G}) = \operatorname{E}((X - \operatorname{E}(X \mid \mathcal{G}))^2 \mid \mathcal{G}) = \operatorname{E}(X^2 \mid \mathcal{G}) - \operatorname{E}(X \mid \mathcal{G})^2$, the [law of total variance]() reads $\operatorname{Var}X = \operatorname{E}\operatorname{Var}(X \mid \mathcal{G}) + \operatorname{Var}\operatorname{E}(X \mid \mathcal{G})$.

<details><summary>Proof</summary>
Take expectations of the conditional identity and subtract $(\operatorname{E}X)^2 = (\operatorname{E}\operatorname{E}(X \mid \mathcal{G}))^2$. &#8718;
</details>

*Remark.* For $\mathcal{G}$ generated by a partition into groups the identity splits the variance into its parts within and between the groups, which is the analysis of variance, and $\operatorname{E}(X \mid Y = y)$, a number, is the value at $y$ of the Borel $h$ with $\operatorname{E}(X \mid Y) = h(Y)$.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#203/proj" width="460" height="276" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">Three equally likely outcomes make a random variable a point of $\mathbb{R}^3$, and $L^2(\mathcal{G})$ for $\mathcal{G}$ generated by two cells a plane through $0$. $\operatorname{E}(X \mid \mathcal{G})$ is the foot of the perpendicular from $X$, the constants are the black line inside every such plane, and the right-angled triangle is the law of total variance. Drag to turn it.</div></div>
