---
layout: default
title: "207. law of large numbers"
tags: maths200
use_math: true
---


# Law of Large Numbers
---
Roll a fair die and the running average of the rolls settles at $3.5$. The laws of large numbers make this precise for sums of independent random variables, a weak law in probability and a strong law almost surely, under hypotheses that come down from a finite variance to a finite mean, and a sequence obeying the first and not the second shows that the gap between them is real.


## I
---
**Theorem** ([weak law of large numbers]() in $L^2$)**.** If $X\_1, X\_2, \dots$ are uncorrelated with $\operatorname{E}X\_k = \mu$, $\operatorname{Var}X\_k = \sigma\_k^2 < \infty$ and $n^{-2}\sum\_{k=1}^{n}\sigma\_k^2 \to 0$, then the sample mean $\bar{X}\_n = n^{-1}S\_n$ of the partial sums $S\_n = \sum\_{k=1}^{n}X\_k$ converges to $\mu$ in $L^2$, and hence in probability.

<details><summary>Proof</summary>
The cross terms vanish for uncorrelated summands, so $\operatorname{E}(\bar{X}_n - \mu)^2 = \operatorname{Var}\bar{X}_n = n^{-2}\sum_{k=1}^{n}\sigma_k^2 \to 0$, and Chebyshev's inequality $P(\lvert \bar{X}_n - \mu \rvert > \varepsilon) \leq \varepsilon^{-2}\operatorname{Var}\bar{X}_n$ passes to probability. &#8718;
</details>

*Remarks.* Bounded variances suffice, and i.i.d. summands with variance $\sigma^2$ give $\operatorname{Var}\bar{X}\_n = \sigma^2/n$. In statistics convergence in $L^2$ makes $\bar{X}\_n$ consistent in mean square, whereas unbiasedness is the separate identity $\operatorname{E}\bar{X}\_n = \mu$, which holds for every $n$.

**Theorem** (Khinchin)**.** If $X\_1, X\_2, \dots$ are i.i.d. with $\operatorname{E}\lvert X\_1 \rvert < \infty$ and $\mu = \operatorname{E}X\_1$, then $\bar{X}\_n \xrightarrow{p} \mu$.

<details><summary>Proof</summary>
A finite mean makes the characteristic function $\varphi$ of $X_1$ differentiable at $0$ with $\varphi'(0) = i\mu$, so for each $t$, $\varphi_{\bar{X}_n}(t) = \varphi(t/n)^n = (1 + i\mu t/n + o(1/n))^n \to e^{i\mu t}$, the characteristic function of the constant $\mu$. Lévy's continuity theorem gives $\bar{X}_n \xrightarrow{d} \mu$, and convergence in distribution to a constant is convergence in probability. &#8718;
</details>

**Theorem** (truncation)**.** Let $X\_1, X\_2, \dots$ be independent and $b\_n > 0$, and truncate at level $b\_n$, $\tilde{X}\_{n,k} = X\_k I\_{\lbrace \lvert X\_k \rvert \leq b\_n \rbrace}$, with $\tilde{S}\_n = \sum\_{k=1}^{n}\tilde{X}\_{n,k}$ and $a\_n = \operatorname{E}\tilde{S}\_n$. If (i) $\sum\_{k=1}^{n}P(\lvert X\_k \rvert > b\_n) \to 0$; (ii) $b\_n^{-2}\operatorname{Var}\tilde{S}\_n \to 0$; then $(S\_n - a\_n)/b\_n \xrightarrow{p} 0$.

<details><summary>Proof</summary>
Since $\lbrace S_n \neq \tilde{S}_n \rbrace \subseteq \bigcup_{k=1}^{n}\lbrace \lvert X_k \rvert > b_n \rbrace$, Chebyshev's inequality gives $P(\lvert S_n - a_n \rvert > \varepsilon b_n) \leq \sum_{k=1}^{n}P(\lvert X_k \rvert > b_n) + \varepsilon^{-2}b_n^{-2}\operatorname{Var}\tilde{S}_n$, and both terms vanish. &#8718;
</details>

**Corollary** (Feller)**.** If $X\_1, X\_2, \dots$ are i.i.d. with $xP(\lvert X\_1 \rvert > x) \to 0$ as $x \to \infty$, then $\bar{X}\_n - \mu\_n \xrightarrow{p} 0$, where $\mu\_n = \operatorname{E}(X\_1 I\_{\lbrace \lvert X\_1 \rvert \leq n \rbrace})$.

<details><summary>Proof</summary>
Take $b_n = n$, so (i) reads $nP(\lvert X_1 \rvert > n) \to 0$, while (ii) follows from $n^{-2}\operatorname{Var}\tilde{S}_n \leq n^{-1}\operatorname{E}(X_1^2 I_{\lbrace \lvert X_1 \rvert \leq n \rbrace}) \leq n^{-1}\int_0^n 2yP(\lvert X_1 \rvert > y)\,\mathrm{d}y$, the average over $[0, n]$ of a function tending to $0$. &#8718;
</details>

*Remark.* The condition holds whenever $\operatorname{E}\lvert X\_1 \rvert < \infty$, as $xP(\lvert X\_1 \rvert > x) \leq \operatorname{E}(\lvert X\_1 \rvert I\_{\lbrace \lvert X\_1 \rvert > x \rbrace})$, and then $\mu\_n \to \operatorname{E}X\_1$, which recovers Khinchin's theorem. It also holds for some laws without a mean, such as a symmetric $X\_1$ with $P(\lvert X\_1 \rvert > x) = e/(x\log x)$ for $x \geq e$, whose averages converge in probability to $0$ although $\operatorname{E}\lvert X\_1 \rvert = \infty$, and Feller showed it is also necessary for the existence of some centring $\mu\_n$.


## II
---
**Theorem** (Kolmogorov's convergence criterion)**.** If $X\_1, X\_2, \dots$ are independent with $\sum\_k \operatorname{Var}X\_k < \infty$, then $\sum\_k (X\_k - \operatorname{E}X\_k)$ converges almost surely.

<details><summary>Proof</summary>
Kolmogorov's inequality, applied to the centred summands after $m$, gives $P(\sup_{n > m}\lvert (S_n - \operatorname{E}S_n) - (S_m - \operatorname{E}S_m) \rvert \geq \varepsilon) \leq \varepsilon^{-2}\sum_{k > m}\operatorname{Var}X_k \to 0$ for every $\varepsilon > 0$, so the centred partial sums are almost surely Cauchy. &#8718;
</details>

*Remarks.* Chebyshev's inequality bounds a single $S\_n$, Kolmogorov's the whole path up to $n$ at the same price, which is what an almost sure statement needs. Kolmogorov's [three-series theorem]() completes the criterion, as independent $X\_k$ have an almost surely convergent sum if and only if, for some $c > 0$, the series $\sum\_k P(\lvert X\_k \rvert > c)$, $\sum\_k \operatorname{E}(X\_k I\_{\lbrace \lvert X\_k \rvert \leq c \rbrace})$ and $\sum\_k \operatorname{Var}(X\_k I\_{\lbrace \lvert X\_k \rvert \leq c \rbrace})$ all converge. A convergent series has a finite sum, not the sum $0$, so a strong law needs one step more.

**Lemma** ([Kronecker]())**.** If $b\_n > 0$ increases to $\infty$ and $\sum\_n x\_n/b\_n$ converges, then $b\_n^{-1}\sum\_{k=1}^{n}x\_k \to 0$.

<details><summary>Proof</summary>
With $u_n = \sum_{k=1}^{n}x_k/b_k \to u$ and $u_0 = b_0 = 0$, summation by parts gives $b_n^{-1}\sum_{k=1}^{n}x_k = u_n - \sum_{k=1}^{n}b_n^{-1}(b_k - b_{k-1})u_{k-1}$. The last sum is a weighted Cesàro mean of the $u_{k-1}$, with non-negative weights summing to $1$ and each tending to $0$, so it tends to $u$ as well. &#8718;
</details>

**Theorem** ([strong law of large numbers]())**.** (i) If $X\_1, X\_2, \dots$ are independent with $\sum\_k \sigma\_k^2/k^2 < \infty$, then $(S\_n - \operatorname{E}S\_n)/n \xrightarrow{a.s.} 0$; (ii) if they are i.i.d., then $\bar{X}\_n$ converges almost surely to a finite limit if and only if $\operatorname{E}\lvert X\_1 \rvert < \infty$, and the limit is then $\operatorname{E}X\_1$.

<details><summary>Proof</summary>
For (i) the criterion makes $\sum_k (X_k - \operatorname{E}X_k)/k$ converge almost surely, and Kronecker's lemma with $b_n = n$ finishes. For (ii) truncate at $Y_k = X_k I_{\lbrace \lvert X_k \rvert \leq k \rbrace}$, so $\sum_k P(X_k \neq Y_k) = \sum_k P(\lvert X_1 \rvert > k) \leq \operatorname{E}\lvert X_1 \rvert$ makes $X_k = Y_k$ eventually by the first Borel-Cantelli lemma, while $\sum_k \operatorname{Var}Y_k/k^2 \leq \sum_k k^{-2}\operatorname{E}(X_1^2 I_{\lbrace \lvert X_1 \rvert \leq k \rbrace}) \leq 2\operatorname{E}\lvert X_1 \rvert$ lets (i) apply to the $Y_k$, whose means tend to $\operatorname{E}X_1$ by dominated convergence. Conversely $X_n/n = \bar{X}_n - (1 - 1/n)\bar{X}_{n-1} \to 0$ almost surely, so $\lvert X_n \rvert > n$ only finitely often, and the second Borel-Cantelli lemma forces $\sum_n P(\lvert X_1 \rvert > n) < \infty$, that is $\operatorname{E}\lvert X_1 \rvert < \infty$. &#8718;
</details>

*Remarks.* Etemadi (1981) proved (ii) under pairwise independence alone. Borel's case (1909), the binary digits of $\omega$ on $\Omega = [0, 1)$, says that almost every $\omega$ has digits equal to $1$ with limiting frequency $1/2$. Under a finite fourth moment the law takes one line, as $\operatorname{E}(S\_n - n\mu)^4 \leq 3n^2\operatorname{E}(X\_1 - \mu)^4$ makes $\sum\_n P(\lvert \bar{X}\_n - \mu \rvert > \varepsilon)$ finite, which is complete convergence, and for i.i.d. summands complete convergence of $\bar{X}\_n$ holds if and only if $\operatorname{E}X\_1^2 < \infty$ (Hsu and Robbins 1947, Erdős 1949).


## III
---
**Example** (weak without strong)**.** Let $X\_2, X\_3, \dots$ be independent with $P(X\_n = n) = P(X\_n = -n) = 1/(2n\log n)$ and $P(X\_n = 0) = 1 - 1/(n\log n)$, and $\bar{X}\_n = n^{-1}\sum\_{k=2}^{n}X\_k$. Then $\bar{X}\_n \xrightarrow{p} 0$, yet $\lvert \bar{X}\_n \rvert \geq 1/2$ infinitely often almost surely, so $P(\bar{X}\_n \text{ converges}) = 0$.

<details><summary>Proof</summary>
$\operatorname{Var}X_k = k/\log k$, so splitting the sum at $\sqrt{n}$ gives $\operatorname{Var}\bar{X}_n = n^{-2}\sum_{k=2}^{n}k/\log k \leq 1/(n\log 2) + 2/\log n \to 0$, and the weak law follows by Chebyshev's inequality. On the other hand $\sum_n P(\lvert X_n \rvert = n) = \sum_n 1/(n\log n) = \infty$, so $\lvert X_n \rvert = n$ infinitely often by the second Borel-Cantelli lemma, and each time $\lvert S_n \rvert \geq n/2$ or $\lvert S_{n-1} \rvert \geq n/2$. A subsequence of $\bar{X}_n$ tends to $0$ almost surely, so $\bar{X}_n$ converges on no set of positive probability. &#8718;
</details>

*Remarks.* The weak law bounds each $P(\lvert \bar{X}\_n - \mu \rvert > \varepsilon)$ and the strong law their union over the tail. Here the excursions grow rarer, as the first demands, but never stop. Under the standard Cauchy law neither law holds, since $\varphi(t) = e^{-\lvert t \rvert}$ gives $\varphi(t/n)^n = \varphi(t)$, so every $\bar{X}\_n$ is standard Cauchy again, and indeed $xP(\lvert X\_1 \rvert > x) \to 2/\pi$.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#207/means" width="600" height="246" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">Twelve running means $\bar{X}_n$ against $\log n$, red when they leave the band $\mu \pm \varepsilon$ after $n = 10^3$. The die settles, the jumps $\pm n$ come back ever more rarely, and the Cauchy averages never settle.</div></div>

**Example** ([Monte Carlo method]())**.** If $(U\_k, V\_k)$ are i.i.d. uniform on the square $[-1, 1]^2$, the strong law for the indicators of the disc gives $4s^{-1}\sum\_{k=1}^{s}I\_{\lbrace U\_k^2 + V\_k^2 \leq 1 \rbrace} \xrightarrow{a.s.} \pi$, the disc having area $\pi$ against the square's $4$. The error is of order $s^{-1/2}$, with constant $4\sqrt{p(1 - p)} \approx 1.64$ for $p = \pi/4$, and [variance reduction]() lowers the constant but not the rate.

*Remark.* Bernoulli (1713) proved the weak law for Bernoulli trials and Borel (1909) the strong one, while Markov (1906) showed that independence is not needed for the weak law, which is how Markov chains began.
