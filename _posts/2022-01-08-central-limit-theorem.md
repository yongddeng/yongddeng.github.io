---
layout: default
title: "208. central limit theorem"
tags: maths200
use_math: true
---


# Central Limit Theorem
---
The laws of large numbers send $\bar{X}\_n - \mu$ to $0$. The central limit theorem magnifies the error by $\sqrt{n}$ and finds one shape whatever the summands, $\sqrt{n}(\bar{X}\_n - \mu)/\sigma \xrightarrow{d} N(0, 1)$, as long as the variance is finite and no single summand dominates, and Galton's [quincunx]() builds that shape out of falling balls<!-- , having ingeniously illustrated the fundamental idea behind it -->.


## I
---
**Theorem** ([de Moivre-Laplace]())**.** Let $S\_n \sim \operatorname{Bin}(n, p)$ with $0 < p < 1$, $q = 1 - p$, $\sigma\_n = \sqrt{npq}$ and $x\_h = (h - np)/\sigma\_n$, and let $f\_Z(x) = e^{-x^2/2}/\sqrt{2\pi}$ and $\Phi(z) = \int\_{-\infty}^{z}f\_Z(v)\,\mathrm{d}v$ be the standard normal density and distribution function. Then (i) $\sigma\_n P(S\_n = h)/f\_Z(x\_h) \to 1$ uniformly in the integers $h$ with $\lvert x\_h \rvert \leq C$, for every $C > 0$; (ii) $P(a < (S\_n - np)/\sigma\_n \leq b) \to \Phi(b) - \Phi(a)$ for all $a < b$.

<details><summary>Proof</summary>
For (i), Stirling's formula $m! \sim \sqrt{2\pi m}\,(m/e)^m$ applied to $n!$, $h!$ and $(n - h)!$ leaves $(\sigma_n\sqrt{2\pi})^{-1}e^{-nD}$ up to a factor tending to $1$, where $D = \frac{h}{n}\log\frac{h}{np} + \frac{n-h}{n}\log\frac{n-h}{nq}$ is the relative entropy of $h/n$ from $p$, and expanding the logarithms to second order gives $nD = x_h^2/2 + O(n^{-1/2})$ uniformly in $\lvert x_h \rvert \leq C$. For (ii), $(S_n - np)/\sigma_n$ lives on a lattice of span $1/\sigma_n$, so by (i) the probability is a Riemann sum for $\int_a^b f_Z$. &#8718;
</details>

*Remarks.* De Moivre (1733) proved it for $p = 1/2$, counting heads in fair tosses, and Laplace (1812) for every $p$. De Moivre's own route reads the ratio $P(S\_n = h + 1)/P(S\_n = h) = (n - h)p/((h + 1)q) = 1 - x\_h/\sigma\_n + O(1/n)$ as a discrete form of $f\_Z^{\prime}(x)/f\_Z(x) = -x$. The integral form (ii) is convergence in distribution, so $P((S\_n - np)/\sigma\_n \leq z) \to \Phi(z)$ is a limit of numbers, not a limit in probability.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#208/law" width="600" height="226" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The exact law of the standardised sum $Z_n$ against $f_Z$, with its distance from $\Phi$ and the Berry-Esseen bound. The coins are the theorem above, and one big coin, a summand holding three quarters of the variance, never becomes normal.</div></div>


## II
---
**Definition.** For independent $X\_1, X\_2, \dots$ with means $\mu\_k$, variances $\sigma\_k^2 < \infty$ and $s\_n^2 = \sum\_{k=1}^{n}\sigma\_k^2 > 0$, the conditions of [Lindeberg](), [Lyapunov]() and [Feller]() read

$$
\begin{array}{lll}
\text{Lindeberg,} & s_n^{-2}\sum_{k=1}^{n}\operatorname{E}\big((X_k - \mu_k)^2 I_{\{\lvert X_k - \mu_k \rvert > \varepsilon s_n\}}\big) \to 0 & \text{for every } \varepsilon > 0, \\
\text{Lyapunov,} & s_n^{-(2+\delta)}\sum_{k=1}^{n}\operatorname{E}\lvert X_k - \mu_k \rvert^{2+\delta} \to 0 & \text{for some } \delta > 0, \\
\text{Feller,} & \max_{k \leq n}\sigma_k^2/s_n^2 \to 0. &
\end{array}
$$

**Theorem** ([Lindeberg-Feller]())**.** Under Lindeberg's condition, $Z\_n = (S\_n - \operatorname{E}S\_n)/s\_n \xrightarrow{d} N(0, 1)$. Conversely, under Feller's condition, $Z\_n \xrightarrow{d} N(0, 1)$ implies Lindeberg's condition.

<details><summary>Proof</summary>
Take $\mu_k = 0$ and write $L_n(\varepsilon)$ for the Lindeberg sum. Since $\sigma_k^2 \leq \varepsilon^2 s_n^2 + \operatorname{E}(X_k^2 I_{\{\lvert X_k \rvert > \varepsilon s_n\}})$, Lindeberg's condition implies Feller's. The bound $\lvert e^{iy} - 1 - iy + y^2/2 \rvert \leq \min(\lvert y \rvert^3/6, y^2)$, split at $\lvert X_k \rvert = \varepsilon s_n$, puts $\varphi_{X_k}(t/s_n)$ within $\varepsilon\lvert t \rvert^3\sigma_k^2/6s_n^2 + t^2s_n^{-2}\operatorname{E}(X_k^2 I_{\{\lvert X_k \rvert > \varepsilon s_n\}})$ of $1 - t^2\sigma_k^2/2s_n^2$, itself within $t^4\sigma_k^4/8s_n^4$ of $e^{-t^2\sigma_k^2/2s_n^2}$, and as $\lvert \prod_k a_k - \prod_k b_k \rvert \leq \sum_k \lvert a_k - b_k \rvert$ in the unit disc, $\lvert \varphi_{Z_n}(t) - e^{-t^2/2} \rvert \leq \varepsilon\lvert t \rvert^3/6 + t^2L_n(\varepsilon) + t^4\max_k\sigma_k^2/8s_n^2$. For the converse, Feller's condition turns $\varphi_{Z_n}(t) \to e^{-t^2/2}$ into $\sum_k \operatorname{E}(1 - \cos(tX_k/s_n)) \to t^2/2$, and since $y^2/2 - (1 - \cos y)$ is non-negative and at least $y^2(1/2 - 2/(t\varepsilon)^2)$ where $\lvert y \rvert > \lvert t \rvert\varepsilon$, this gives $(t^2/2 - 2/\varepsilon^2)L_n(\varepsilon) \to 0$ for every $t$. &#8718;
</details>

**Corollary** (Lyapunov)**.** Lyapunov's condition implies Lindeberg's, so under it $Z\_n \xrightarrow{d} N(0, 1)$.

<details><summary>Proof</summary>
For each centred summand $Y$, $\operatorname{E}(Y^2 I_{\{\lvert Y \rvert > \varepsilon s_n\}}) \leq (\varepsilon s_n)^{-\delta}\operatorname{E}\lvert Y \rvert^{2+\delta}$, so the Lindeberg sum is at most $\varepsilon^{-\delta}$ times the Lyapunov one. &#8718;
</details>

*Remarks.* Lindeberg's condition says that no summand contributes to $s\_n^2$ through values comparable with $s\_n$, and uniformly bounded summands with $s\_n \to \infty$ satisfy it, the indicators vanishing once $\varepsilon s\_n$ exceeds twice the bound. Without Feller's condition it is not necessary, for independent $X\_k \sim N(0, \sigma\_k^2)$ with $\sigma\_1^2 = 1$ and $\sigma\_k^2 = 2^{k-2}$ give $Z\_n \sim N(0, 1)$ exactly, while the last summand carries half of $s\_n^2 = 2^{n-1}$.

*Remark.* A summand that keeps a fixed share of the variance and is not normal itself survives in the limit, as the big coin in the figure does. The theorem holds verbatim for [triangular arrays]() $X\_{n,1}, \dots, X\_{n,n}$, independent within each row, which is the form most applications need.


## III
---
**Theorem** ([Lindeberg-Lévy]())**.** If $X\_1, X\_2, \dots$ are i.i.d. with mean $\mu$ and variance $0 < \sigma^2 < \infty$, then $Z\_n = \sqrt{n}(\bar{X}\_n - \mu)/\sigma \xrightarrow{d} N(0, 1)$.

<details><summary>Proof</summary>
It is the Lindeberg-Feller theorem, as $s_n^2 = n\sigma^2$ and the Lindeberg sum is $\sigma^{-2}\operatorname{E}((X_1 - \mu)^2 I_{\{\lvert X_1 - \mu \rvert > \varepsilon\sigma\sqrt{n}\}}) \to 0$ by dominated convergence. Directly, with $Y = (X_1 - \mu)/\sigma$, a finite second moment gives $\varphi_Y(u) = 1 - u^2/2 + o(u^2)$, so $\varphi_{Z_n}(t) = \varphi_Y(t/\sqrt{n})^n = (1 - t^2/2n + o(1/n))^n \to e^{-t^2/2}$, and Lévy's continuity theorem finishes. &#8718;
</details>

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#208/cf" width="600" height="286" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The characteristic function of $Z_n$ as a curve over $t \geq 0$, its real part up and its imaginary part in depth, against $e^{-t^2/2}$ in the real plane. For i.i.d. summands it converges on every bounded interval, while a lattice law among them returns to the unit circle at $t = 2\pi/h$, $h$ the span of $Z_n$, a point that moves off as $n$ grows. The big coin's tends to $\cos(\sqrt{3}t/2)e^{-t^2/8}$ instead. Drag to turn it.</div></div>

*Remarks.* The convergence is uniform in $z$, $\sup\_z \lvert P(Z\_n \leq z) - \Phi(z) \rvert \to 0$, as convergence in distribution to a continuous distribution function always is (Pólya). It underlies [hypothesis tests]() on a population mean, the statistic $\sqrt{n}(\bar{X}\_n - \mu)/\hat{\sigma}\_n$ with the sample standard deviation $\hat{\sigma}\_n$ being asymptotically standard normal by Slutsky's theorem, while a [QQ plot]() or the [Shapiro-Wilk test]() checks normality where it is assumed of the data themselves.

**Theorem** ([Berry-Esseen]())**.** If moreover $\rho = \operatorname{E}\lvert X\_1 - \mu \rvert^3 < \infty$, then $\sup\_z \lvert P(Z\_n \leq z) - \Phi(z) \rvert \leq C\rho/(\sigma^3\sqrt{n})$ for an absolute constant $C$.

<details><summary>Proof</summary>
Esseen's smoothing inequality bounds the distance between the distribution functions by $\pi^{-1}\int_{-T}^{T}\lvert \varphi_{Z_n}(t) - e^{-t^2/2} \rvert\,\lvert t \rvert^{-1}\,\mathrm{d}t + O(1/T)$, and a third-order expansion of $\varphi_{Z_n}$ on $\lvert t \rvert \leq T$, with $T$ a small multiple of $\sigma^3\sqrt{n}/\rho$, makes the integral of the same order. &#8718;
</details>

*Remarks.* The best constant known for i.i.d. summands is $C \leq 0.4748$ (Shevtsova 2011), down from Esseen's $7.59$ (1942), and no $C$ below $0.4097$ works (Esseen 1956). The fair coin's error, about $0.40/\sqrt{n}$ from its central atom, already comes within a sixth of the bound. For a non-lattice law the leading error is the skewness term $\frac{\mu\_3}{6\sigma^3\sqrt{n}}(1 - z^2)f\_Z(z)$, with $\mu\_3$ the third central moment, the first [Edgeworth expansion](), and [Stein's method]() bounds the distance to the normal for many dependent sums as well.

**Theorem** (multivariate)**.** If $\mathbf{X}\_1, \mathbf{X}\_2, \dots$ are i.i.d. in $\mathbb{R}^m$ with mean $\boldsymbol{\mu}$ and a covariance matrix $K = \operatorname{E}(\mathbf{X}\_1 - \boldsymbol{\mu})(\mathbf{X}\_1 - \boldsymbol{\mu})^{\top}$ with finite entries, then $\sqrt{n}(\bar{\mathbf{X}}\_n - \boldsymbol{\mu}) \xrightarrow{d} N(\mathbf{0}, K)$.

<details><summary>Proof</summary>
By the Cramér-Wold device it suffices that $a^{\top}\sqrt{n}(\bar{\mathbf{X}}_n - \boldsymbol{\mu}) \xrightarrow{d} N(0, a^{\top}Ka)$ for every $a \in \mathbb{R}^m$, which is the Lindeberg-Lévy theorem for the i.i.d. scalars $a^{\top}\mathbf{X}_k$, or a point mass when $a^{\top}Ka = 0$. &#8718;
</details>
