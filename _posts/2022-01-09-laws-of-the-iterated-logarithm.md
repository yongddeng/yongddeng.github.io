---
layout: default
title: "209. law of the iterated logarithm"
tags: maths200
use_math: true
---


# Law of the Iterated Logarithm
---
Between the strong law, $S\_n = o(n)$ almost surely, and the central limit theorem, $S\_n$ of order $\sqrt{n}$ in distribution, lies the exact almost sure size of the excursions of a sum of independent random variables. It is $\sqrt{2n\log\log n}$, which the path reaches infinitely often and exceeds by any fixed factor only finitely often<!-- , while for fixed time $n$ the partial sum deviates by about $\sqrt{n}$ from its mean -->.


## I
---
**Theorem** ([Hartman-Wintner]())**.** If $X\_1, X\_2, \dots$ are i.i.d. with $\operatorname{E}X\_1 = 0$ and $\operatorname{E}X\_1^2 = \sigma^2 \in (0, \infty)$, and $S\_n = \sum\_{k=1}^{n}X\_k$, then almost surely

$$
\limsup_{n \to \infty}\frac{S_n}{\sqrt{2\sigma^2 n\log\log n}} = 1 \quad \text{and} \quad \liminf_{n \to \infty}\frac{S_n}{\sqrt{2\sigma^2 n\log\log n}} = -1.
$$

<details><summary>Proof</summary>
Skorokhod's embedding writes $S_n = B_{T_n}$ for a standard Brownian motion $B$ and stopping times $T_n$ with i.i.d. increments of mean $\sigma^2$, so $T_n/n \to \sigma^2$ almost surely by the strong law. The oscillation of $B$ between the times $T_n$ and $\sigma^2 n$ is then $o(\sqrt{n\log\log n})$ almost surely, and the law for Brownian motion below transfers to $S_n$, which is how Strassen proved the theorem in 1964. &#8718;
</details>

*Remarks.* Equivalently, for every $\varepsilon > 0$, almost surely $S\_n > (1 + \varepsilon)\sqrt{2\sigma^2 n\log\log n}$ only finitely often and $S\_n > (1 - \varepsilon)\sqrt{2\sigma^2 n\log\log n}$ infinitely often, while with the other common normalisation $\limsup\_n S\_n/\sqrt{\sigma^2 n\log\log n} = \sqrt{2}$. As $S\_n/\sqrt{n}$ is tight, $S\_n/\sqrt{2\sigma^2 n\log\log n} \xrightarrow{p} 0$, a natural sequence that converges in probability and not almost surely.

**Theorem** ([Kolmogorov]())**.** If $X\_1, X\_2, \dots$ are independent with $\operatorname{E}X\_k = 0$, variances $\sigma\_k^2$ with $s\_n^2 = \sum\_{k=1}^{n}\sigma\_k^2 \to \infty$, and $\lvert X\_n \rvert \leq c\_n$ almost surely for constants $c\_n = o(\sqrt{s\_n^2/\log\log s\_n^2})$, then $\limsup\_n S\_n/\sqrt{2s\_n^2\log\log s\_n^2} = 1$ almost surely.

<details><summary>Proof</summary>
Kolmogorov's exponential bounds put $P(S_n > xs_n)$ between $\exp(-\frac{x^2}{2}(1 + \gamma))$ and $\exp(-\frac{x^2}{2}(1 - \gamma))$ for large $x$ with $xc_n/s_n$ small, and the bound on $c_n$ keeps $x = \sqrt{2\log\log s_n^2}$ in that range. They replace the Gaussian tails in the argument for Brownian motion below, along the indices where $s_n^2$ first passes $\alpha^k$. &#8718;
</details>

*Remark.* Khinchin (1924) found the law for coin tossing, Kolmogorov (1929) for bounded independent summands, Hartman and Wintner (1941) for i.i.d. ones with finite variance, and Strassen (1966) the converse, that i.i.d. summands with $\limsup\_n \lvert S\_n \rvert/\sqrt{n\log\log n} < \infty$ on a set of positive probability have $\operatorname{E}X\_1^2 < \infty$ and $\operatorname{E}X\_1 = 0$. The law is sensitive to the tails of single summands, and Marcinkiewicz and Zygmund showed that the $o$ in the bound on $c\_n$ cannot be weakened to $O$.


## II
---
**Theorem** (law of the iterated logarithm for [Brownian motion]())**.** A standard Brownian motion $B$ satisfies, almost surely, (i) $\limsup\_{t \to \infty}B\_t/\sqrt{2t\log\log t} = 1$; (ii) $\limsup\_{t \to 0^+}B\_t/\sqrt{2t\log\log(1/t)} = 1$.

<details><summary>Proof</summary>
Let $h(t) = \sqrt{2t\log\log t}$ and $t_k = \alpha^k$. By the reflection principle $P(\max_{s \leq t_k}B_s > (1 + \varepsilon)h(t_{k-1})) \leq \exp(-(1 + \varepsilon)^2\alpha^{-1}\log\log t_{k-1})$, a constant times $k^{-(1+\varepsilon)^2/\alpha}$, which is summable for $1 < \alpha < (1 + \varepsilon)^2$, so the first Borel-Cantelli lemma bounds $B_t \leq (1 + \varepsilon)h(t)$ for all large $t$. For the lower bound the increments $B_{t_k} - B_{t_{k-1}}$ are independent, the Gaussian tail makes $P(B_{t_k} - B_{t_{k-1}} > (1 - \varepsilon)h(t_k))$ non-summable once $\alpha$ is large, and the second lemma together with $-B_{t_{k-1}} \leq 2h(t_{k-1}) \approx 2\alpha^{-1/2}h(t_k)$ gives $B_{t_k} > (1 - 2\varepsilon)h(t_k)$ infinitely often. Time inversion, $tB_{1/t}$ being again a Brownian motion, turns (i) into (ii). &#8718;
</details>

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#209/clock" width="600" height="246" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">A coin-tossing walk to $n = 10^6$ on a logarithmic clock, $S_n/\sqrt{n}$ against $\log n$, between $\pm\sqrt{2\log\log n}$ in orange and $\pm 1$ in grey, red where it passes the envelope. The walk looks the same in every decade, and the envelope is the slow growth of its records.</div></div>

*Remarks.* On the logarithmic clock $u = \log t$ the process $U\_u = e^{-u/2}B\_{e^u}$ is a stationary [Ornstein-Uhlenbeck process]() with $\operatorname{E}U\_u U\_v = e^{-\lvert u - v \rvert/2}$, so it forgets its past in a fixed time and its maximum over $[0, T]$ grows like $\sqrt{2\log T}$, as for independent standard normals. With $T = \log t$ this is $\sqrt{2\log\log t}$, and the law becomes a statement about extremes.

*Remark.* At a fixed time (ii) makes $B$ fail to be Hölder of order $1/2$, while uniformly over $[0, 1]$ Lévy's modulus governs, $\limsup\_{h \to 0}\sup\_{\lvert t - s \rvert \leq h}\lvert B\_t - B\_s \rvert/\sqrt{2h\log(1/h)} = 1$ almost surely, the supremum over time costing $\log$ in place of $\log\log$.


## III
---
**Theorem** ([Strassen]())**.** Under the hypotheses of the Hartman-Wintner theorem, let $\eta\_n \in C[0, 1]$ interpolate $\eta\_n(k/n) = S\_k/\sqrt{2\sigma^2 n\log\log n}$ linearly, for $n \geq 3$. Almost surely $(\eta\_n)$ is relatively compact in the supremum norm and its set of limit points is $K = \lbrace f \in C[0, 1] \mid f(0) = 0, f \text{ absolutely continuous}, \int\_0^1 f^{\prime}(t)^2\,\mathrm{d}t \leq 1 \rbrace$, the unit ball of the [Cameron-Martin space]().

<details><summary>Proof</summary>
Skorokhod's embedding again reduces it to Brownian motion, where Schilder's large deviations give $P(\lVert B_{n\cdot}/\sqrt{2n\log\log n} - f \rVert_\infty < \varepsilon) \approx (\log n)^{-\int_0^1 f'^2}$ on $C[0, 1]$. Along $n = \alpha^k$ these probabilities are summable for paths outside $K$, which the first Borel-Cantelli lemma excludes, and not summable for $f$ inside $K$, which the second lemma, on nearly independent blocks, reaches. &#8718;
</details>

**Corollary.** Almost surely, (i) the limit points of $S\_n/\sqrt{2\sigma^2 n\log\log n}$ fill $[-1, 1]$; (ii) $\limsup\_n \sum\_{k=1}^{n}S\_k/(n\sqrt{2\sigma^2 n\log\log n}) = 1/\sqrt{3}$.

<details><summary>Proof</summary>
Both are continuous functionals of $\eta_n$, $f \mapsto f(1)$ and, up to a Riemann sum error that equicontinuity removes, $f \mapsto \int_0^1 f$. Their suprema over $K$ are $1$, by Cauchy-Schwarz $f(1)^2 \leq \int_0^1 f'^2$ with equality at $f(t) = t$, and $1/\sqrt{3}$, as $\int_0^1 f = \int_0^1 (1 - s)f'(s)\,\mathrm{d}s \leq (\int_0^1 (1 - s)^2\,\mathrm{d}s)^{1/2}$, and $K$ is convex and symmetric, so every value in between is a limit point. &#8718;
</details>

*Remarks.* The scales interlock. For $0 < p < 2$ a finite $p$-th moment, with mean zero when $p \geq 1$, gives $S\_n = o(n^{1/p})$ almost surely (Marcinkiewicz and Zygmund), the strong law being $p = 1$, while at $p = 2$ the central limit theorem puts $S\_n$ at order $\sqrt{n}$ in distribution and the law of the iterated logarithm at $\sqrt{2\sigma^2 n\log\log n}$ almost surely. The maximum has a lower envelope as well, $\liminf\_n \max\_{k \leq n}\lvert S\_k \rvert/\sqrt{n/\log\log n} = \pi/\sqrt{8}$ almost surely for the simple random walk (Chung 1948).
