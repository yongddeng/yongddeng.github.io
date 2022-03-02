---
layout: default
title: "expectated value"
tags: tag1
use_math: true
---


# Expected Value
---
The primitive idea came up in the mid-17th century during the study of the so-called problem of points. Later, Pafnuty Chebyshev in the mid-19th century systematically established the expected value in terms of random variables. This page contains some definitions, properties, and related thorems, but the finitness (i.e. integrability) will not be the main interest.


## I
---
Suppose $X: \Omega \to \mathbb{R}$ is a random variable. We call the Lebesgue integral $\operatorname{E}X = \int_{\Omega} X\, \mathrm{d}P$ the [expected value](https://en.wikipedia.org/wiki/Expected_value) of $X$, denoted by $\mu_X$, or, simply $\mu$ **(#1)**. Note that $X = X^+ - X^- = \max(X, 0) - \min(X, 0)$ and either one of $\operatorname{E}X = \operatorname{E}X^+ - \operatorname{E}X^-$ should be finite for all $\omega \in \Omega$ to confront having $\infty - \infty$. The expected value can also be defined by $\operatorname{E}X = \int_{\mathbb{R}} x\, dF_X(x)$. If, in particular, $X$ is continuous, then $\operatorname{E}X = \int_{\mathbb{R}} xf_X(x)\, dx$. If $X$ is discrete, then $\operatorname{E}X = \sum_{k=1}^{n} x_k\, p_X(x_k)$. Furthermore, a random variable $Y = g(X)$ being transformed by a Borel function $g: \mathbb{R} \to \mathbb{R}$ has a well-defined $\operatorname{E}Y = \int_{\Omega} g(X)\,\mathrm{d}P$, and a random vector $\boldsymbol{X} = [X_1, \dots, X_n]^{\top}$ also has the vector $\operatorname{E}\boldsymbol{X} = \operatorname{E}[X_1, \dots, X_n]^{\top} = [\operatorname{E}X_1, \dots, \operatorname{E}X_n]^{\top}$.

The definitions suggest that the expecation is the [weighted sum](https://en.wikipedia.org/wiki/Weighted_arithmetic_mean) $\Sigma_{i=1}^{n}x_{i}p_{i} = \mu$ such that $\Sigma_{i=1}^{n}p_i = 1$. That is, the operator $\operatorname{E}$ inherits many useful properties of the operator $\int$ such as (i) non-degeneracy: if $\operatorname{E}\vert X \vert = 0$ then $X=0$; (ii) non-negativity: if $X \geq 0$, then $\operatorname{E}X \geq 0$; (iii) monotonicity: if $X \leq Y$, then $\operatorname{E}X \leq \operatorname{E}Y$; (iv) domination: if $\operatorname{E}X^\beta < \infty$, then $\operatorname{E}X^\alpha < \infty$ for any $0 < \alpha < \beta$; (v) linearity: $\operatorname{E}(aX + Y) = a\operatorname{E}X + \operatorname{E}Y$ for all $a \in \mathbb{R}$; (vi) multiplicativity: if $P(X \cap Y) \neq P(X)P(Y)$, then often $\operatorname{E}XY \neq \operatorname{E}X\operatorname{E}Y$, but if the equality holds, then certainly $\operatorname{E}XY = \operatorname{E}X \operatorname{E}Y$; and so on. We mention that, despite of mathematical convenience of linearity, [Simpson's paradox](https://en.wikipedia.org/wiki/Simpson%27s_paradox) avoids imprudently summing groups of variable.

On the other hand, suppose $(X_n)_{n \in \mathbb{N}}$ is a sequence of non-negative random variables $X_n$ such that $P(X_n \geq 0) = 1$. If $\lim_{n\to\infty}X_n = X$ merely pointwisely, then $\lim_{n\to\infty}\operatorname{E}X_n = \operatorname{E}X$ is not necessarily true, thus we cannot interchange limits and expectations at will. Instead, the followings provide sufficient conditions: (i) [monotone convergence theorem](https://en.wikipedia.org/wiki/Monotone_convergence_theorem): requires the pointwise convergent sequence to be monotonically increasing and bounded, i.e. $X_n \nearrow X$ as $n \to \infty$ and $\vert X \vert < \infty$ **(#2)**; (ii) [dominated convergence theorem](https://en.wikipedia.org/wiki/Dominated_convergence_theorem): requires a random variable $Y$ that dominates every $X_n$, i.e. there exists $Y$ such that $\vert X_n \vert \leq Y$ for all $n \in \mathbb{N}$ and $\operatorname{E}\vert Y \vert < \infty$; If $Y \geq 0$ is a constant, we call it [bounded convergence theorem](https://math.stackexchange.com/questions/235511/explanation-of-the-bounded-convergence-theorem) **(#3)**.


## II
---
A collection of moments of a function can describe the shape of its graph. Thus, we calculate the [$r$-th moment](https://en.wikipedia.org/wiki/Moment_(mathematics)) $\operatorname{E}X^r = \int_{\mathbb{R}} x^r \mathrm{d}F_X(x)$, and the [$r$-th central moment](https://en.wikipedia.org/wiki/Central_moment) $\operatorname{E}(X - \operatorname{E}X)^r = \int_{\mathbb{R}} (x - \mu)^r \mathrm{d}F_X(x)$. The 1st moment is notably the expected value $\mu$. In fact, if we let $\mu_r$ be the $r$-th central moment, then $\mu_2 = \sigma^2$ is the variance, $\mu_3 / \sigma^3$ is the skewness, and $\mu_4 / \sigma^4$ is the kurtosis. These values essentially describe the shape of a pdf or a pmf, but if they do not suffice to approximate a distribution, then we can calculate the [$r$-th absolute moment](https://encyclopediaofmath.org/wiki/Absolute_moment) $\operatorname{E}{\vert X \vert}^r = \int_{\mathbb{R}} {\vert x \vert}^r\, \mathrm{d}F_X(x)$, and the [$r$-th absolute central moment](https://arxiv.org/pdf/1209.4340.pdf) $\operatorname{E}{\vert X - \operatorname{E}X \vert}^r = \int_{\mathbb{R}} {\vert x - \mu \vert}^r\, \mathrm{d}F_X(x)$. We will read soon that the moments are related to a characteristic function.

If we can properly define the [moment generating function](https://en.wikipedia.org/wiki/Moment-generating_function) (mgf) $m: \mathbb{R} \to \mathbb{R}$ as the form $m(t) = \operatorname{E}e^{tX}$ and calculate the $r$-th derivative of $m$ with respect to $x$, then the $r$-th moment equals to the derivative evaluated around $t=0$. Therefore, $F_{X_1} = F_{X_2}$ if and only if $m_{X_1}(t) = m_{X_2}(t)$ for all $t \in (-\varepsilon, \varepsilon)$ with $\varepsilon > 0$. However, whilst $m$ always exists as $e^{tX}$ is a non-negative measurable function, and a collection of all moments (i.e. $r \geq 1$) uniquely determines $F_X$ on a bounded interval (i.e. [Hausdorff moment problem](https://en.wikipedia.org/wiki/Hausdorff_moment_problem)), the same is not true on an unbounded intervals (i.e. [Hamburger moment problem](https://en.wikipedia.org/wiki/Hamburger_moment_problem)) as the integral is infinite **(#4)**. Thus, well-defined moments of $X$ exist if and only if the tails of $F_X$ are exponentially bounded.
  
Nevertheless, if $m$ exists in an interval, it is analytic **(#5)**, and so we can linearly approximate it via the [Taylor (series) expansion](https://en.wikipedia.org/wiki/Taylor_series) which returns a value of function $f$ at a point $x$ as the series $f(x) = \Sigma_{k=0}^{\infty} {f^{k}(x_0)\over{k!}}(x-x_0)^k$. In particular, $f(x) = e^x = e^{x_0} + e^{x_0}(x-x_0) + {1\over{2!}}e^{x_0}(x-x_0)^2 + \dots$, and if we let $x_0 = 0$, then $f(x) = 1 + x + {1\over{2}}x^2 + \dots$. In the same manner, if we approximate $m$ around $x_{0}=0$, then $m(t) = \operatorname{E}[1 + tX + {1\over{2}}t^2X^2 + \dots]$. Subsequently, the linearity of $\operatorname{E}$ leads the expansion to $m(t) = 1 + t\operatorname{E}X + {1\over{2}}t^2\operatorname{E}X^2 + \dots$ such that ${d^{r} \over dx^{r}}m(t)$ at $t=0$ is equal to $\mu_r$, as desired. If the point $x_0 \in \mathbb{S}$ which centres the series is set to $0$, the series $f(x) = \Sigma_{k=0}^{\infty}{1\over{k!}}x^k$ is called the [Maclaurin (series) expansion](https://mathworld.wolfram.com/MaclaurinSeries.html).


## III
---
In advance to read more about $\operatorname{E}X^p < \infty$ (i.e. $X \in L^p$), we suppose $X:\Omega\to\mathbb{R}$ is an $L^1$-convergent random variable, and let $\mathcal{G} \subset \mathcal{F}$ be a [sub $\sigma$-algebra](https://math.stackexchange.com/questions/3029823/intuition-of-sub-sigma-algebra-definition) that contains events $A$ relevant only to the partial information. The [conditional expectation](https://en.wikipedia.org/wiki/Conditional_expectation) of $X$ given $\mathcal{G}$ is any $\mathcal{G}$-measurable function $\operatorname{E}(X \vert \mathcal{G})$ such that $\int_{A}\operatorname{E}(X \vert \mathcal{G})\,\mathrm{d}P = \int_{A}X \,\mathrm{d}P$ for any $A\in\mathcal{G}$ **(#6)**, where $\operatorname{E}(X \vert \mathcal{G})$ differs from $X$ which may fail to get a local average $\operatorname{E}X = \int_{A} X\,\mathrm{d}P\vert_{\mathcal{G}}$. If we suppose $X \in L^2(\Omega, \mathcal{F}, P)$, then $\operatorname{E}(X \vert \mathcal{G})$ is the [orthogonal projection](https://math.libretexts.org/Bookshelves/Linear_Algebra/Interactive_Linear_Algebra_(Margalit_and_Rabinoff)/06%3A_Orthogonality/6.03%3A_Orthogonal_Projection) of $X$ to the subspace $L^2(\Omega, \mathcal{G}, P)$, and thus $\operatorname{E}(X \vert \mathcal{G})$ is the best predictor of $X$ among all $\mathcal{G}$-measurable $Y \in L^2(\Omega, \mathcal{G}, P)$ such that $X-\operatorname{E}(X \vert \mathcal{G}) \perp L^2$; We have the minimum mse $\operatorname{E}(X - \operatorname{E}(X \vert \mathcal{G}))^2$.

The [Radon-Nikodym derivative](https://en.wikipedia.org/wiki/Radon%E2%80%93Nikodym_theorem), which derives the density function of a continuous random variable, underlies the existence of $\operatorname{E}(X\vert\mathcal{G}))$. Suppose $\mu:A \to \int_{A} X\,\mathrm{d}P$ is the new finite measure, and thus $\mu$ and $P$ are on the (absolutely) continuous sample space $(\Omega, \mathcal{F})$, and $\mu$ is continuous with respect to $P$. Subsequently, if $g$ is the [inclusion function](https://en.wikipedia.org/wiki/Inclusion_map) that maps $A$ contained in $\mathcal{G}$ to $\mathcal{F}$, then $\mu \circ g = \mu\vert_{\mathcal{G}}$ and $P \circ g = P\vert_{\mathcal{G}}$ are the restrictions of $\mu$ and $P$ (both on $\mathcal{G}$), respectively, and also $\mu\vert_{\mathcal{G}}$ is continuous with respect to $P\vert_{\mathcal{G}}$. Therefore, the condition $P(g(\mathcal{G})) = 0$ implies $\mu(g(\mathcal{G})) = 0$, and hence we obtain $\operatorname{E}(X\vert\mathcal{G}) = \mathrm{d}\mu\vert_{\mathcal{G}} / \mathrm{d}P\vert_{\mathcal{G}}$. On the other hand, we obtain the uniqueness if the [versions](https://web.ma.utexas.edu/users/gordanz/notes/conditional_expectation.pdf) only differ on the set of zero probability.

As expected, the conditional expectation inherits properties of the unconditional expectation such as linearity, positivity, monotonicity, the Fatou's lemma, and the convergence theorems. In fact, its own properties are fundamental to the study of martingales. These may include (i) stability: if $X$ is $\mathcal{G}$-measurable, then $\operatorname{E}(X\,\vert\,\mathcal{G}) = X$ **(#7)**; (ii) [law of total expecation](https://en.wikipedia.org/wiki/Law_of_total_expectation): $\operatorname{E}(\operatorname{E}(X\vert\mathcal{G})) = \operatorname{E}X$; (iii) [tower properties](https://math.stackexchange.com/questions/41536/intuitive-explanation-of-the-tower-property-of-conditional-expectation) with stability: if $\mathcal{G}_1 \subset \mathcal{G}_2 \subset \mathcal{F}$, then $\operatorname{E}(\operatorname{E}(X\vert\mathcal{G}_2)\vert\mathcal{G}_1) = \operatorname{E}(X\vert\mathcal{G}_1) = \operatorname{E}(\operatorname{E}(X\vert\mathcal{G}_1)\vert\mathcal{G}_2)$, where $\operatorname{E}(X\vert\mathcal{G}_1)$ is $\mathcal{G}_2$-measurable; and so on. Likewise, one can calculate $\operatorname{Var}(X\vert\mathcal{H}) = \operatorname{E}((X-\operatorname{E}(X\vert\mathcal{H}))^2\vert\mathcal{H}) = \operatorname{E}(X\vert\mathcal{H})^2 - (\operatorname{E}(X\vert\mathcal{H}))^2$ and then utilise [the law of total variance](https://en.wikipedia.org/wiki/Law_of_total_variance): $\operatorname{E}(\operatorname{Var}(X\vert\mathcal{H})) + \operatorname{Var}(\operatorname{E}(X\vert\mathcal{H})) = \operatorname{Var}X$ **(#8)**. 


## **
---
**(#1)** For some $A \in \Omega$, the two conditional quantities are related by $P(A) = \operatorname{E}(\boldsymbol{1}_A)$. **(#2)** We refer to the [Dini's Theorem](https://en.wikipedia.org/wiki/Dini%27s_theorem). **(#3)** A sequence must be uniformly convergent for the DCT. **(#4)** I.e. Let $f(x) = x^{-2}$ for all $x>1$, then $m(t) = \int_{1}^{\infty} e^{tx}x^{-2}\,dx$ is divergent. **(#5)** In $\mathbb{R}$, we need $f \in C^{\omega}$, where $C^\omega \coloneqq \{\text{a class of analytic functions}\}$. Whereas, in $\mathbb{C}$, we only need $f \in C^1$, because $C^1 = C^\infty = C^\omega$, where $C^1 \coloneqq \{\text{a class of holomorphic functions}\}$. **(#6)** Discern that $\operatorname{E}(Y \vert X = x)$ is a scalar and $\operatorname{E}(Y \vert X) \coloneqq \operatorname{E}(Y \vert \sigma(X))$ is a random variable. **(#7)** If $X$ is ind. to $\mathcal{G}$, then simply $\operatorname{E}(X \vert \mathcal{G})=\operatorname{E}X$. **(#8)** It underlies the analysis of variance (ANOVA) technique used in statistics (and hypothesis testings).