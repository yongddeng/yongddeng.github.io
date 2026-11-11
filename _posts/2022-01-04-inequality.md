---
layout: default
title: "204. inequality"
tags: maths200
use_math: true
---


# Inequality
---
Inequalities are how probability estimates what it cannot compute<!-- , the signs < and > themselves being Thomas Harriot's (1560-1621) -->. The bounds below run from tails, where Markov's inequality in one guise or another does all the work, through moments of sums and products, to Jensen's inequality, and end with medians, which stand in for means when moments fail.


## I
---
**Theorem** ([Markov's inequality]())**.** If $g : \mathbb{R} \to [0, \infty]$ is Borel and $g\_\ast(A) = \inf\_{y \in A} g(y)$ for a Borel set $A$, then $g\_\ast(A)P(X \in A) \leq \operatorname{E}(g(X)I\_{\lbrace X \in A \rbrace}) \leq \operatorname{E}g(X)$.

<details><summary>Proof</summary>
Pointwise $g_\ast(A) I_{\lbrace X \in A \rbrace} \leq g(X) I_{\lbrace X \in A \rbrace} \leq g(X)$, and expectation is monotone. &#8718;
</details>

**Corollary.** For $a > 0$ and $q > 0$, (i) $P(X \geq a) \leq a^{-1}\operatorname{E}X^+$; (ii) $P(\lvert X \rvert \geq a) \leq a^{-q}\operatorname{E}\lvert X \rvert^q$; (iii) [Chebyshev's inequality]() $P(\lvert X - \operatorname{E}X \rvert \geq a) \leq a^{-2}\operatorname{Var}X$ for $X \in L^2$; (iv) the [Chernoff bound]() $P(X \geq a) \leq \inf\_{\lambda > 0} e^{-\lambda a}\operatorname{E}e^{\lambda X}$.

<details><summary>Proof</summary>
Take $g(x) = x^+$ with $A = [a, \infty)$, then $g(x) = \lvert x \rvert^q$ with $A = (-\infty, -a] \cup [a, \infty)$, then the second for $X - \operatorname{E}X$ with $q = 2$, and lastly $g(x) = e^{\lambda x}$ with $A = [a, \infty)$ for each $\lambda > 0$. &#8718;
</details>

*Remarks.* The faster $g$ grows, the faster the bound decays in $a$, at the price of a higher moment. For independent $X\_k$ with $a\_k \leq X\_k \leq b\_k$ almost surely and $S\_n = X\_1 + \dots + X\_n$, the exponential case gives [Hoeffding's inequality]() $P(S\_n - \operatorname{E}S\_n \geq t) \leq \exp(-2t^2 / \sum\_{k=1}^n (b\_k - a\_k)^2)$ for $t > 0$, and Bernstein's and Azuma's inequalities come the same way. Chebyshev's inequality for $S\_n$ needs only $\operatorname{Var}S\_n = \sum\_k \operatorname{Var}X\_k$, so uncorrelated identically distributed summands already give $P(\lvert S\_n - \operatorname{E}S\_n \rvert \geq a) \leq a^{-2}n\operatorname{Var}X\_1$.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#204/markov" width="460" height="240" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The indicator of $\lvert x \rvert \geq a$ lies under $g(x)/g(a)$ for each even $g$ increasing in $\lvert x \rvert$, so $P(\lvert X \rvert \geq a) \leq \operatorname{E}g(X)/g(a)$. Here $X$ is standard normal, and $\cosh \lambda x$ takes the best $\lambda$.</div></div>

**Proposition** ([truncated Chebyshev]())**.** Let $X\_1, \dots, X\_n$ be independent, $b\_1, \dots, b\_n > 0$, $Y\_k = X\_k I\_{\lbrace \lvert X\_k \rvert \leq b\_k \rbrace}$ and $T\_n = \sum\_{k=1}^n Y\_k$. Then $P(\lvert S\_n - \operatorname{E}T\_n \rvert > a) \leq a^{-2}\sum\_{k=1}^n \operatorname{Var}Y\_k + \sum\_{k=1}^n P(\lvert X\_k \rvert > b\_k)$ for every $a > 0$.

<details><summary>Proof</summary>
$S_n = T_n$ off $\bigcup_k \lbrace \lvert X_k \rvert > b_k \rbrace$, so the left side is at most $P(\lvert T_n - \operatorname{E}T_n \rvert > a)$ plus the probability of that union, and Chebyshev's inequality with $\operatorname{Var}T_n = \sum_k \operatorname{Var}Y_k$ bounds the first term. &#8718;
</details>

*Remark.* No moment of $X\_k$ is assumed, since the $Y\_k$ are bounded, and the second sum is the price. Truncation at a level growing with $n$ is the device behind weak laws for summands without variance.

**Theorem** ([Kolmogorov's inequality]())**.** If $X\_1, \dots, X\_n$ are independent with $\operatorname{E}X\_k = 0$ and $\operatorname{E}X\_k^2 < \infty$, then $P(\max\_{1 \leq k \leq n} \lvert S\_k \rvert \geq a) \leq a^{-2}\operatorname{Var}S\_n$ for every $a > 0$.

<details><summary>Proof</summary>
Let $\tau$ be the first $k$ with $\lvert S_k \rvert \geq a$. The event $\lbrace \tau = k \rbrace$ depends on $X_1, \dots, X_k$ alone, and $S_n - S_k$ is independent of it with mean zero, so the cross term vanishes in $\operatorname{E}(S_n^2 I_{\lbrace \tau = k \rbrace}) \geq \operatorname{E}(S_k^2 I_{\lbrace \tau = k \rbrace}) \geq a^2 P(\tau = k)$. Summing over $k \leq n$ gives $\operatorname{E}S_n^2 \geq a^2 P(\tau \leq n)$. &#8718;
</details>

*Remarks.* The maximum costs nothing over Chebyshev's bound for $S\_n$ alone. Applied to the increments after $n$ it reads $P(\max\_{n < k \leq m} \lvert S\_k - S\_n \rvert \geq a) \leq a^{-2}\sum\_{k=n+1}^m \operatorname{Var}X\_k$, which is how series of independent variables are shown to converge almost surely. The proof uses only that $S\_n - S\_k$ is orthogonal to functions of $X\_1, \dots, X\_k$, so the inequality holds for square-integrable martingales as well.

**Theorem** ([Hájek-Rényi inequality]())**.** Under the same hypotheses, for $c\_1 \geq c\_2 \geq \dots \geq c\_n > 0$, $P(\max\_{1 \leq k \leq n} c\_k \lvert S\_k \rvert \geq a) \leq a^{-2}\sum\_{k=1}^n c\_k^2 \operatorname{Var}X\_k$.

<details><summary>Proof</summary>
Run the same argument on $\sum_{k=1}^n (c_k^2 - c_{k+1}^2) S_k^2$ with $c_{n+1} = 0$, whose mean is $\sum_k c_k^2 \operatorname{Var}X_k$ by summation by parts. With $\tau$ now the first $k$ with $c_k \lvert S_k \rvert \geq a$, on $\lbrace \tau = j \rbrace$ each $S_k^2$ with $k \geq j$ has conditional mean at least $S_j^2$, and the weights from $j$ on sum to $c_j^2$, so the mean is at least $a^2 P(\tau \leq n)$. &#8718;
</details>

*Remark.* Constant weights $c\_k = 1$ return Kolmogorov's inequality, and $c\_k = 1/k$ bounds $\max\_k \lvert S\_k \rvert / k$, the quantity a strong law controls.


## II
---
**Proposition** (the [$c\_r$-inequality]())**.** For $r > 0$, $\operatorname{E}\lvert X + Y \rvert^r \leq c\_r(\operatorname{E}\lvert X \rvert^r + \operatorname{E}\lvert Y \rvert^r)$, with $c\_r = 1$ for $r \leq 1$ and $c\_r = 2^{r-1}$ for $r \geq 1$. If $X$ and $Y$ are independent and $\operatorname{E}\lvert X + Y \rvert^r < \infty$, then $\operatorname{E}\lvert X \rvert^r$ and $\operatorname{E}\lvert Y \rvert^r$ are finite.

<details><summary>Proof</summary>
For $r \leq 1$ the concave $t \mapsto t^r$ vanishes at $0$ and is therefore subadditive, so $\lvert x + y \rvert^r \leq (\lvert x \rvert + \lvert y \rvert)^r \leq \lvert x \rvert^r + \lvert y \rvert^r$. For $r \geq 1$ convexity gives $\lvert (x + y)/2 \rvert^r \leq (\lvert x \rvert^r + \lvert y \rvert^r)/2$. For the converse, Fubini's theorem gives $\operatorname{E}\lvert X + Y \rvert^r = \int \operatorname{E}\lvert X + y \rvert^r \, P_Y(\mathrm{d}y)$, so $X + y \in L^r$ for some $y$, and $X = (X + y) - y \in L^r$ by the first part, likewise $Y$. &#8718;
</details>

*Remark.* Independence is needed for the converse, as a Cauchy $X$ and $Y = -X$ have $X + Y = 0$. For $0 < r < 1$ the first part makes $\operatorname{E}\lvert X - Y \rvert^r$ a metric on $L^r$, although $(\operatorname{E}\lvert X \rvert^r)^{1/r}$ is no norm there.

**Lemma** ([Young's inequality]())**.** If $p, q > 1$ with $1/p + 1/q = 1$ and $a, b \geq 0$, then $ab \leq a^p/p + b^q/q$, with equality if and only if $a^p = b^q$.

<details><summary>Proof</summary>
Since $(p - 1)(q - 1) = 1$, the curve $y = x^{p-1}$ is also $x = y^{q-1}$. The area $\int_0^a x^{p-1}\,\mathrm{d}x = a^p/p$ under it and the area $\int_0^b y^{q-1}\,\mathrm{d}y = b^q/q$ beside it do not overlap and together cover the rectangle $[0, a] \times [0, b]$, with room to spare unless $b = a^{p-1}$, that is, unless $b^q = a^p$. &#8718;
</details>

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#204/young" width="460" height="226" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The area $a^p/p$ under $y = x^{p-1}$ and the area $b^q/q$ beside it cover the rectangle $ab$, here with $a = 1.2$. The spare area vanishes when the rectangle's corner sits on the curve.</div></div>

**Theorem** ([Hölder's inequality]())**.** If $p, q \in [1, \infty]$ with $1/p + 1/q = 1$, then $\lvert \operatorname{E}XY \rvert \leq \operatorname{E}\lvert XY \rvert \leq \lVert X \rVert\_p \lVert Y \rVert\_q$, where $\lVert X \rVert\_p = (\operatorname{E}\lvert X \rvert^p)^{1/p}$ and $\lVert X \rVert\_\infty$ is the essential supremum of $\lvert X \rvert$.

<details><summary>Proof</summary>
For $p = 1$ and $q = \infty$ it is $\lvert XY \rvert \leq \lvert X \rvert \lVert Y \rVert_\infty$ almost surely. Otherwise the claim is trivial when a norm is $0$ or $\infty$, and Young's inequality at $a = \lvert X \rvert / \lVert X \rVert_p$ and $b = \lvert Y \rvert / \lVert Y \rVert_q$ gives $\operatorname{E}\lvert XY \rvert / (\lVert X \rVert_p \lVert Y \rVert_q) \leq 1/p + 1/q = 1$. &#8718;
</details>

**Corollary** ([Cauchy-Schwarz]())**.** $\operatorname{E}\lvert XY \rvert \leq \lVert X \rVert\_2 \lVert Y \rVert\_2$. Hence $\lvert \operatorname{Cov}(X, Y) \rvert \leq \sqrt{\operatorname{Var}X \operatorname{Var}Y}$, and for non-degenerate $X$ and $Y$ the [correlation]() $\rho\_{X,Y} = \operatorname{Cov}(X, Y) / \sqrt{\operatorname{Var}X \operatorname{Var}Y}$ lies in $[-1, 1]$, with $\lvert \rho\_{X,Y} \rvert = 1$ if and only if $Y = \alpha + \beta X$ almost surely for some $\beta \neq 0$.

<details><summary>Proof</summary>
Take $p = q = 2$, then apply it to the centred $X' = X - \operatorname{E}X$ and $Y' = Y - \operatorname{E}Y$. The quadratic $\operatorname{E}(Y' - tX')^2 \geq 0$ in $t$ has discriminant $4\operatorname{Cov}(X, Y)^2 - 4\operatorname{Var}X\operatorname{Var}Y \leq 0$, and it vanishes exactly when some $t$ makes $Y' = tX'$ almost surely. &#8718;
</details>

**Theorem** ([Minkowski's inequality]())**.** For $p \geq 1$, $\lVert X + Y \rVert\_p \leq \lVert X \rVert\_p + \lVert Y \rVert\_p$.

<details><summary>Proof</summary>
$X + Y \in L^p$ by the $c_r$-inequality. Then $\operatorname{E}\lvert X + Y \rvert^p \leq \operatorname{E}\lvert X \rvert \lvert X + Y \rvert^{p-1} + \operatorname{E}\lvert Y \rvert \lvert X + Y \rvert^{p-1}$, and Hölder's inequality with $q = p/(p - 1)$ bounds the right side by $(\lVert X \rVert_p + \lVert Y \rVert_p)\lVert X + Y \rVert_p^{p-1}$. Divide. &#8718;
</details>

*Remarks.* Once almost surely equal variables are identified, $\lVert \cdot \rVert\_p$ is a norm on $L^p$, absolutely homogeneous, $\lVert \alpha X \rVert\_p = \lvert \alpha \rvert \lVert X \rVert\_p$, and subadditive, though not linear. $L^p$ is complete for $p \geq 1$ (Riesz-Fischer), so a Banach space, and $L^2$ is a Hilbert space under $\langle X, Y \rangle = \operatorname{E}XY$, in which $\operatorname{Cov}(X, Y)$ is the inner product of the centred variables and $\rho\_{X,Y}$ the cosine of the angle between them.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#204/lp" width="460" height="276" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The unit ball of $\lVert x \rVert_p = (\sum_i \lvert x_i \rvert^p)^{1/p}$ on $\mathbb{R}^3$, the octahedron at $p = 1$, the sphere at $p = 2$ and the cube at $p = \infty$. The dual ball of $q = p/(p - 1)$ is its polar set, as Hölder's inequality and its case of equality show, and the ball is convex exactly when Minkowski's inequality holds, so it caves in for $p < 1$, where its polar is the cube. Drag to turn it.</div></div>


## III
---
**Theorem** ([Jensen's inequality]())**.** If $\varphi$ is convex on an open interval $I$ with $P(X \in I) = 1$, and $X$ and $\varphi(X)$ are integrable, then $\varphi(\operatorname{E}X) \leq \operatorname{E}\varphi(X)$, with equality if and only if $\varphi$ is affine on an interval $A$ with $P(X \in A) = 1$. For a sub-$\sigma$-algebra $\mathcal{G} \subseteq \mathcal{F}$, likewise $\varphi(\operatorname{E}(X \mid \mathcal{G})) \leq \operatorname{E}(\varphi(X) \mid \mathcal{G})$ almost surely.

<details><summary>Proof</summary>
A convex $\varphi$ lies above a supporting line at $\operatorname{E}X \in I$, $\varphi(x) \geq \varphi(\operatorname{E}X) + c(x - \operatorname{E}X)$, and taking expectations gives the inequality. Equality forces $X$ almost surely into the set where $\varphi$ meets that line, an interval on which $\varphi$ is affine, and the converse is direct. Conditionally, $\varphi$ is the supremum of countably many affine $a_n x + b_n$, each with $a_n\operatorname{E}(X \mid \mathcal{G}) + b_n = \operatorname{E}(a_n X + b_n \mid \mathcal{G}) \leq \operatorname{E}(\varphi(X) \mid \mathcal{G})$ almost surely. &#8718;
</details>

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#204/jensen" width="460" height="226" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">$X$ takes $x_1$ and $x_2$ with probabilities $1 - \theta$ and $\theta$. The point $(\operatorname{E}X, \operatorname{E}\varphi(X))$ slides along the chord, never below $\varphi(\operatorname{E}X)$ on the curve.</div></div>

**Corollary.** (i) $\operatorname{Var}X = \operatorname{E}X^2 - (\operatorname{E}X)^2 \geq 0$; (ii) [Lyapunov's inequality]() $\lVert X \rVert\_r \leq \lVert X \rVert\_s$ for $0 < r < s$; (iii) [Gibbs' inequality]() $-\sum\_x p(x)\log p(x) \leq -\sum\_x p(x)\log q(x)$ for probability mass functions $p$ and $q$ on a countable set, so the [Kullback-Leibler divergence]() $D\_{\mathrm{KL}}(p \parallel q) = \sum\_x p(x)\log(p(x)/q(x))$ is non-negative and vanishes only at $p = q$.

<details><summary>Proof</summary>
(i) is $\varphi(x) = x^2$. (ii) is $\varphi(x) = \lvert x \rvert^{s/r}$ applied to $\lvert X \rvert^r$. (iii) is $\varphi = -\log$ on $(0, \infty)$ applied to $Y = q(X)/p(X)$ with $X$ drawn from $p$, since $\operatorname{E}Y = \sum_{p(x) > 0} q(x) \leq 1$ makes $-\log\operatorname{E}Y \geq 0$. Equality needs $Y$ constant and that sum $1$, so $q = p$. &#8718;
</details>

**Proposition** (best linear predictor)**.** For $X, Y \in L^2$ with $\operatorname{Var}X > 0$, the affine function of $X$ closest to $Y$ in mean square is $L(Y \mid X) = \operatorname{E}Y + (X - \operatorname{E}X)\operatorname{Cov}(X, Y)/\operatorname{Var}X$. It is the unique $\alpha + \beta X$ with (i) $\operatorname{E}(Y - \alpha - \beta X) = 0$; (ii) $\operatorname{Cov}(X, Y - \alpha - \beta X) = 0$, and its error is $\operatorname{E}(Y - L(Y \mid X))^2 = \operatorname{Var}Y(1 - \rho\_{X,Y}^2)$.

<details><summary>Proof</summary>
(i) and (ii) say that $Y - L(Y \mid X)$ is orthogonal to $1$ and to $X$, so $L(Y \mid X)$ is the orthogonal projection of $Y$ onto the span of $1$ and $X$ in $L^2$, and Pythagoras gives $\operatorname{E}(Y - U)^2 = \operatorname{E}(Y - L(Y \mid X))^2 + \operatorname{E}(L(Y \mid X) - U)^2$ for every affine $U$ of $X$. The error is $\operatorname{Var}Y - \operatorname{Cov}(X, Y)^2/\operatorname{Var}X$. &#8718;
</details>

*Remark.* The conditional expectation $\operatorname{E}(Y \mid X)$ is the projection onto the whole of $L^2(\Omega, \sigma(X), P)$, so it predicts at least as well, and the two coincide when $(X, Y)$ is jointly normal.


## IV
---
**Definition.** A [median]() of $X$ is any $m \in \mathbb{R}$ with $P(X \leq m) \geq 1/2$ and $P(X \geq m) \geq 1/2$. $X$ is [symmetric]() about $a$ if $X - a \overset{d}{=} a - X$, equivalently $P(X \geq a + x) = P(X \leq a - x)$ for every $x$, and symmetric if it is symmetric about $0$.

**Proposition.** (i) If $P(\lvert X \rvert > a) < 1/2$, every median of $X$ lies in $[-a, a]$; (ii) if $X \in L^1$ and $m$ is a median, $\lvert \operatorname{E}X - m \rvert \leq \operatorname{E}\lvert X - m \rvert \leq \operatorname{E}\lvert X - \operatorname{E}X \rvert \leq \sqrt{\operatorname{Var}X}$; (iii) if $X$ is symmetric about $a$, then $a$ is a median, and the mean when $X \in L^1$.

<details><summary>Proof</summary>
(i) A median $m > a$ would give $1/2 \leq P(X \geq m) \leq P(\lvert X \rvert > a)$, and likewise $m < -a$. (ii) The outer two are Jensen's inequality for $\lvert x \rvert$ and $x^2$. The middle one holds as a median minimises the convex $c \mapsto \operatorname{E}\lvert X - c \rvert$, whose right derivative $P(X \leq c) - P(X > c)$ is non-negative at $m$ and whose left derivative $P(X < c) - P(X \geq c)$ is non-positive there. (iii) $P(X \geq a) = P(X \leq a)$ and the two sum to at least $1$, and $\operatorname{E}(X - a) = \operatorname{E}(a - X)$. &#8718;
</details>

*Remark.* A median always exists and needs no moment, which is why it replaces the mean in bounds for heavy tails. The Cauchy law is symmetric about $0$ with median $0$ and no mean, and a symmetric unimodal law has its centre as a mode as well<!-- , the mode of $X$ being any value that maximises $f\_X$ -->.

**Theorem** ([symmetrisation inequalities]())**.** Let $X' \overset{d}{=} X$ be independent of $X$, so that $X^s = X - X'$ is symmetric, and let $m$ be a median of $X$. For $x > 0$ and every $a \in \mathbb{R}$,

$$
\begin{array}{c}
\tfrac12 P(\lvert X - m \rvert \geq x) \leq P(\lvert X^s \rvert \geq x) \leq 2P(\lvert X - a \rvert \geq x/2), \\
\tfrac12 P(\max_{k \leq n} \lvert X_k - m_k \rvert \geq x) \leq P(\max_{k \leq n} \lvert X_k^s \rvert \geq x) \leq 2P(\max_{k \leq n} \lvert X_k - a_k \rvert \geq x/2),
\end{array}
$$

the second for independent $X\_1, \dots, X\_n$ with medians $m\_k$, symmetrised by independent copies, and any $a\_1, \dots, a\_n$.

<details><summary>Proof</summary>
The upper bounds hold because $\lvert X - X' \rvert \geq x$ forces $\lvert X - a \rvert \geq x/2$ or $\lvert X' - a \rvert \geq x/2$. For the lower, $P(X^s \geq x) \geq P(X - m \geq x)P(X' \leq m) \geq \frac12 P(X - m \geq x)$, likewise for the lower tail, and the two add. For the maxima, split by the first $k$ with $\lvert X_k - m_k \rvert \geq x$, and given it $X_k'$ lies on the far side of $m_k$ with probability at least $1/2$, independently. &#8718;
</details>

**Theorem** ([Lévy's inequality]())**.** If $X\_1, \dots, X\_n$ are independent and symmetric, then $P(\max\_{k \leq n} S\_k \geq x) \leq 2P(S\_n \geq x)$ and $P(\max\_{k \leq n} \lvert S\_k \rvert \geq x) \leq 2P(\lvert S\_n \rvert \geq x)$ for every $x$.

<details><summary>Proof</summary>
Let $\tau$ be the first $k$ with $S_k \geq x$. $S_n - S_k$ is symmetric and independent of $\lbrace \tau = k \rbrace$, so $P(S_n \geq x, \tau = k) \geq P(S_n - S_k \geq 0)P(\tau = k) \geq \frac12 P(\tau = k)$, and summing over $k$ gives the first. The second is the same with $\lvert S_k \rvert$, reflecting on whichever side $S_\tau$ lies. &#8718;
</details>

*Remark.* Symmetrisation passes from a sequence to a symmetric one at the cost of a factor and a median, and Lévy's inequality then bounds the maximum of the partial sums by the last one. Together they play the part of Kolmogorov's inequality with medians in place of means and no moment assumed<!-- , the relation being akin to that of Chebyshev's and Kolmogorov's -->.
