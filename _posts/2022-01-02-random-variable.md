---
layout: default
title: "202. random variable"
tags: maths200
use_math: true
---


# Random Variable
---
A random variable is a measurable map out of $\Omega$, and what probability sees of it is its law, the measure it pushes forward onto the line. The law forgets the map, so many random variables share one, and from single laws the post moves to joint laws, independence and conditioning, and to the tail events that independence makes deterministic.


## I
---
**Definition.** For measurable spaces $(\Omega, \mathcal{F})$ and $(S, \mathcal{S})$, a map $X \colon \Omega \to S$ is an $S$-valued [random variable]() if $\lbrace X \in B \rbrace = X^{-1}(B) \in \mathcal{F}$ for every $B \in \mathcal{S}$, a real one when $(S, \mathcal{S}) = (\mathbb{R}, \mathcal{B}(\mathbb{R}))$ and a [random vector]() when it is $(\mathbb{R}^n, \mathcal{B}(\mathbb{R}^n))$. Its [law]() is the image measure $P\_X = P \circ X^{-1}$ on $\mathcal{S}$, and a real $X$ has the [distribution function]() $F\_X(x) = P(X \leq x) = P\_X((-\infty, x])$.

*Remarks.* The sets $B$ with $X^{-1}(B) \in \mathcal{F}$ form a $\sigma$-algebra, so measurability needs checking only on a generating class, and $\lbrace X \leq x \rbrace \in \mathcal{F}$ for every $x$ is enough for a real $X$. The $\sigma$-algebra $\sigma(X) = \lbrace X^{-1}(B) \mid B \in \mathcal{S} \rbrace$ holds what $X$ reveals about the outcome, and every real $\sigma(X)$-measurable random variable is $g(X)$ for a measurable $g$ (Doob-Dynkin). A Borel $g$ makes $g(X)$ a random variable, since $\lbrace g(X) \in B \rbrace = \lbrace X \in g^{-1}(B) \rbrace$<!-- , and a one-sided p-value is the survival function 1 - F_X(x) = P(X > x) -->.

**Theorem** (distribution functions)**.** A function $F \colon \mathbb{R} \to [0, 1]$ is the distribution function of a random variable if and only if it is non-decreasing and right-continuous with $F(x) \to 0$ as $x \to -\infty$ and $F(x) \to 1$ as $x \to \infty$. Then $X = Q(U)$, for $U$ uniform on $(0, 1)$ and the [quantile function]() $Q(u) = \inf \lbrace x \in \mathbb{R} \mid F(x) \geq u \rbrace$, has $F\_X = F$.

<details><summary>Proof</summary>
Necessity is monotonicity of $P$ and its continuity along $(-\infty, x_n]$ with $x_n \downarrow x$, $x_n \downarrow -\infty$ and $x_n \uparrow \infty$. For sufficiency, right-continuity makes the infimum attained, so $Q(u) \leq x$ if and only if $u \leq F(x)$, and $P(Q(U) \leq x) = P(U \leq F(x)) = F(x)$. &#8718;
</details>

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#202/law" width="560" height="236" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">A random variable on $\Omega = [0, 1)$ with Lebesgue measure. The set $\lbrace X \leq x \rbrace$ is drawn under the axis, and its length is $F_X(x)$, the bar on the right. The identity and the tent share one law, and each monotone map is the quantile function of its law.</div></div>

**Definition.** A real $X$ is [discrete]() if $P(X \in C) = 1$ for a countable $C$, with the [probability mass function]() $p\_X(x) = P(X = x)$, [continuous]() if $F\_X$ is continuous, that is $P(X = x) = 0$ for every $x$, and [absolutely continuous]() if $F\_X(x) = \int\_{-\infty}^x f\_X(t) \, \mathrm{d}t$ for a [density]() $f\_X \geq 0$, which then equals $F\_X'$ almost everywhere.

**Theorem** (Lebesgue decomposition)**.** Every distribution function is $F = aF\_d + bF\_{ac} + cF\_s$ with $a, b, c \geq 0$ and $a + b + c = 1$, where $F\_d$ is discrete, $F\_{ac}$ absolutely continuous and $F\_s$ continuous with $F\_s' = 0$ almost everywhere, each part being unique when its weight is positive.

<details><summary>Proof</summary>
The jumps of $F$ are countable, fewer than $k$ of them exceeding $1/k$, and removing them leaves a continuous non-decreasing part. Its measure splits by the Lebesgue decomposition against Lebesgue measure into an absolutely continuous part, whose density is the Radon-Nikodym derivative, and a part carried by a Lebesgue null set. &#8718;
</details>

*Remark.* The [Cantor function](), which climbs from $0$ to $1$ on the Cantor set alone, is the distribution function of $\sum\_k 2B\_k 3^{-k}$ for independent fair bits $B\_k$. It is continuous, so no point has positive probability, yet its derivative vanishes off a null set and no density exists, so a continuous law need not be absolutely continuous.

**Proposition** (images)**.** For a Borel $g$, $Y = g(X)$ has the law $P\_X \circ g^{-1}$. If $X$ is discrete, then $p\_Y(y) = \sum\_{x \in g^{-1}(\lbrace y \rbrace)} p\_X(x)$, and if $X$ has a density $f\_X$ vanishing off an open interval $I$ on which $g$ is continuously differentiable with $g' \neq 0$, then $f\_Y(y) = f\_X(g^{-1}(y)) \lvert (g^{-1})'(y) \rvert$ on $g(I)$.

<details><summary>Proof</summary>
For increasing $g$, $F_Y(y) = P(X \leq g^{-1}(y)) = F_X(g^{-1}(y))$ and the chain rule gives the density, while a decreasing $g$ gives $1 - F_X(g^{-1}(y))$ and the absolute value. &#8718;
</details>

*Remark.* For a $g$ monotone on finitely many pieces the density is the sum of $f\_X(x) / \lvert g'(x) \rvert$ over the preimages $x$ of $y$. Without such hypotheses the type of the law can change, as the sign of a normal $X$ is discrete, and for a centred normal $X$, $\max(X, 0)$ is a mixture of an atom of $1/2$ at $0$ and a density on $(0, \infty)$.


## II
---
**Definition.** A random vector $\mathbf{X} = (X\_1, \dots, X\_n)$ has the [joint distribution function]() $F\_{\mathbf{X}}(\mathbf{x}) = P(X\_1 \leq x\_1, \dots, X\_n \leq x\_n)$, whose [marginals]() $F\_{X\_k}$ are its limits as the other coordinates tend to $\infty$. Events $(A\_i)\_{i \in I}$ are [independent]() if $P(\bigcap\_{i \in J} A\_i) = \prod\_{i \in J} P(A\_i)$ for every finite $J \subseteq I$, $\sigma$-algebras $(\mathcal{F}\_i)\_{i \in I}$ are independent if this holds for every choice of $A\_i \in \mathcal{F}\_i$, and random variables are independent if their $\sigma(X\_i)$ are.

**Theorem** (factorisation)**.** Real random variables $X\_1, \dots, X\_n$ are independent if and only if $F\_{\mathbf{X}}(\mathbf{x}) = \prod\_k F\_{X\_k}(x\_k)$ for every $\mathbf{x} \in \mathbb{R}^n$. Then (i) discrete ones have $p\_{\mathbf{X}}(\mathbf{x}) = \prod\_k p\_{X\_k}(x\_k)$; (ii) ones with densities have the joint density $f\_{\mathbf{X}}(\mathbf{x}) = \prod\_k f\_{X\_k}(x\_k)$; (iii) $g\_1(X\_1), \dots, g\_n(X\_n)$ are independent for Borel $g\_k$.

<details><summary>Proof</summary>
The half-lines $\lbrace X_k \leq x \rbrace$ together with $\Omega$ form a $\pi$-system generating $\sigma(X_k)$, and the $\pi$-$\lambda$ theorem applied one coordinate at a time extends the product rule from these to the $\sigma(X_k)$. Then (i) and (ii) follow by taking differences and by Fubini's theorem, and (iii) from $\sigma(g_k(X_k)) \subseteq \sigma(X_k)$. &#8718;
</details>

*Remarks.* Pairwise independence is weaker. Independent fair signs $X$ and $Y$ and their product $XY$ are pairwise independent, yet $XY$ is a function of the other two. Disjoint events of positive probability are never independent, as $P(A \cap B) = 0 < P(A)P(B)$, whereas complements of independent events, and functions of disjoint groups of independent random variables, are again independent.

**Definition.** For an event $A$ with $P(A) > 0$, the [conditional probability]() $P(B \mid A) = P(A \cap B) / P(A)$ is a probability measure in $B$.

**Theorem** (total probability)**.** If events $A\_1, A\_2, \dots$ of positive probability partition $\Omega$, then $P(B) = \sum\_n P(B \mid A\_n) P(A\_n)$ for every event $B$, and if $P(B) > 0$, then [Bayes' theorem]() $P(A\_k \mid B) = P(B \mid A\_k) P(A\_k) / \sum\_n P(B \mid A\_n) P(A\_n)$ holds.

<details><summary>Proof</summary>
Countable additivity over the disjoint $B \cap A_n$, then $P(A_k \cap B) = P(B \mid A_k) P(A_k)$ in the numerator. &#8718;
</details>

*Remarks.* Conditioning on a discrete $X$ takes $A\_n = \lbrace X = x\_n \rbrace$ and gives the conditional mass function $p\_{Y \mid X}(y \mid x) = p\_{X,Y}(x, y) / p\_X(x)$. For continuous densities, $f\_{Y \mid X}(y \mid x) = f\_{X,Y}(x, y) / f\_X(x)$ where $f\_X(x) > 0$ is the density of the limit, as $\varepsilon \to 0$, of the laws of $Y$ given $\lvert X - x \rvert < \varepsilon$. Conditioning on a null event in general depends on how it is approached (the Borel-Kolmogorov paradox), which is why conditioning is defined through $\sigma$-algebras.


## III
---
**Definition.** For random variables $X\_1, X\_2, \dots$, the [tail $\sigma$-algebra]() is $\mathcal{T} = \bigcap\_n \sigma(X\_n, X\_{n+1}, \dots)$, and its members are the [tail events](), those decided by every tail of the sequence. The events $\lbrace X\_n \text{ converges} \rbrace$, $\lbrace \sum\_n X\_n \text{ converges} \rbrace$ and $\lbrace X\_n \in B\_n \text{ i.o.} \rbrace$ are tail events, and $\limsup\_n X\_n$ and $\limsup\_n (X\_1 + \dots + X\_n)/n$ are $\mathcal{T}$-measurable.

**Theorem** ([Kolmogorov's zero-one law]())**.** If $X\_1, X\_2, \dots$ are independent, every tail event has probability $0$ or $1$, and every $\mathcal{T}$-measurable random variable with values in $[-\infty, \infty]$ is almost surely constant.

<details><summary>Proof</summary>
$\sigma(X_1, \dots, X_n)$ is independent of $\sigma(X_{n+1}, X_{n+2}, \dots) \supseteq \mathcal{T}$ for every $n$, so $\mathcal{T}$ is independent of the union of the $\sigma(X_1, \dots, X_n)$, a $\pi$-system generating $\sigma(X_1, X_2, \dots) \supseteq \mathcal{T}$. Hence $\mathcal{T}$ is independent of itself, and $P(A) = P(A \cap A) = P(A)^2$. A $\mathcal{T}$-measurable $Y$ then has $P(Y \leq y) \in \lbrace 0, 1 \rbrace$ for every $y$, and equals $\inf \lbrace y \mid P(Y \leq y) = 1 \rbrace$ almost surely. &#8718;
</details>

*Remarks.* The law says which events are deterministic, not which value they take, and for $\lbrace A\_n \text{ i.o.} \rbrace$ the Borel-Cantelli lemmas decide. In independent fair tosses, each of the disjoint blocks of $100$ tosses is all heads with probability $2^{-100}$, independently, so the tail event that such runs occur infinitely often has probability $1$. An almost sure limit of independent $X\_n$, when it exists, is a constant, and so is $\limsup\_n (X\_1 + \dots + X\_n)/n$.

*Remark.* Tail events having probability $0$ or $1$ makes $\mathcal{T}$ trivial under $P$, not equal to $\lbrace \emptyset, \Omega \rbrace$. For independent and identically distributed $X\_n$ the same holds for every event unchanged by permuting finitely many of them (Hewitt-Savage), such as $\lbrace X\_1 + \dots + X\_n > 0 \text{ i.o.} \rbrace$, which is in general no tail event.
