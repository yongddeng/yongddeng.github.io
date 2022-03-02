---
layout: default
title: "law of large numbers"
tags: tag1
use_math: true
---


# Law of Large Numbers
---
Emperically, the more a fair dice is rolled, the closer normalised sums get to $3.5 \simeq (1+2+..+6)/6$. We wonder if the mathematical definitions of convergence hold for sums of ind. random variables. That is, we shall elaborate rigorous proof for the laws of large numbers (LLNs), and smear away a wild randomness lies in a small sample which destabilises the relative frequencies.


## I
---
The [weak law of large numbers]() (WLLN) comes with convergence in probability. Suppose $\bar{X}_n = n^{-1}S_n$ is a sample mean, where $S_n = \Sigma_{k=1}^{n}X_k$ is a partial sum of ind. random variables $X_k$ with a constnat mean $\operatorname{E}X_k = \mu$ and a finite variance $\operatorname{Var}X_k = \sigma_k^2$. By the virtue of independence, we obtain $\operatorname{E}\bar{X}_n = n^{-1}\Sigma_{k=1}^{n}\operatorname{E}X_k = \mu$ and $\operatorname{Var}\bar{X}_n = n^{-2}\Sigma_{k=1}^{n}\operatorname{Var}X_k = n^{-2}\Sigma_{k=1}^{n}\sigma_k^2$. Subsequently, because $\operatorname{Var}\bar{X}_n \to 0$ as $n \to \infty$, one has $\bar{X}_n \xrightarrow{L2} \mu$ as $n \to \infty$ based on Chebyshev's inequality, and so $\bar{X}_n \xrightarrow{p} \mu$ as $n \to \infty$. If we instead consider a sequence of i.i.d random variables $X_k \thicksim \delta(\mu, \sigma^2)$ that they have a common probability distribution $\delta$, then $\operatorname{Var}\bar{X}_n =  n^{-1}\sigma^2$ easily suffices the criteria for $L^2$-convergence **(#1)**.

We recall truncation when the WLLN needs to be refined as a summand diverges (i.e. $\sigma^2_k = \infty$). That is, if we have a non-random number $b_n > 0$ in which $b_n \uparrow \infty$ and satisfies (i) $\Sigma_{k=1}^{n}P(\vert X_k \vert >b_n) \to 0$ **(#2)**; (ii) $\operatorname{Var}(b_{n}^{-1}\tilde{S}_n) \to 0$; as both $n \to \infty$, then a sample mean $b_{n}^{-1}S_n \xrightarrow{p} \tilde\mu$ as $n \to \infty$, where $\tilde\mu = \operatorname{E}b_n^{-1}\tilde{S}_n$ is a limiting average, and $\tilde{S}_n = \Sigma_{k=1}^{n}\tilde{X}_k$ consists of a random variable $\tilde{X}_n = X_nI_{\vert X_n \vert \leq b_n}$. Notice that $\{\vert b_{n}^{-1}S_n - \tilde{\mu} \vert > \varepsilon\} \subseteq \{S_n \neq \tilde{S}_n\} \cup \{\vert b_{n}^{-1}\tilde{S}_n - \tilde{\mu} \vert > \varepsilon\}$ and have $P(\vert b_{n}^{-1}S_n - \tilde{\mu} \vert > \varepsilon) \leq P(S_n \neq \tilde{S}_n) + P(\vert b_{n}^{-1}\tilde{S}_n - \tilde{\mu} \vert > \varepsilon) \to 0$ as $n \to \infty$, where $P(S_n \neq \tilde{S}_n) \leq P(\bigcup_{k=1}^{n}\{X_k \neq \tilde{X}_k\}) \leq \Sigma_{k=1}^{n}P(X_k \neq \tilde{X}_k) = \Sigma_{k=1}^{n}P(\vert X_k \vert > b_n) \to 0$ and $P(\vert b_{n}^{-1}\tilde{S}_n - \tilde{\mu} \vert > \epsilon) \leq \epsilon^{-2}\operatorname{Var}(b_{n}^{-1}\tilde{S}_n) \to 0$.

Whilst the uses of trunctation is similar to that of Chebyshev's inequality, we can also use a characteristic function to prove the WLLN under the condition $\operatorname{E}X < \infty$. That is, we recall that $\varphi_{X+Y}(t) = \varphi_{X}(t)\varphi_{Y}(t)$ and $\varphi_{X/n}(t) = \varphi_X(t/n)$, and the Taylor's theorem which yields $\varphi_X(t) = 1 + itX + {(itX)^2 \over 2!} + {(itX)^3 \over 3!} + \dots \simeq 1 + itX + \mathcal{o}(t)$, where $\mathcal{o}(t)$ denotes a "little o notation" for some function that vanishes more rapidly than $t$. Provided that, we can restate that $\varphi_{\bar{X}_n}(t) = \varphi_{\Sigma_{k=1}^{n}n^{-1}X_k}(t) = [\varphi_{X/n}(t)]^n = [\varphi_{X}(t/n)]^n = [1 + {it\operatorname{E}X \over n} + \mathcal{o}({t \over n})]^n = [1 + {it\mu \over n} + \mathcal{o}({t \over n})]^n$, and thus $\varphi_{\bar{X}_n}(t) \to \varphi_\mu(t)$ as $n\to\infty$, where $\varphi_\mu(t) = e^{it\mu}$. The Levy's continuity theorem finally concludes that $F_{\bar{X}} \to \mu$ and $\bar{X} \xrightarrow{p} \mu$ as $n\to\infty$ **(#3)**.


## II
---
The [strong law of large numbers]() (SLLN) comes with a.s. convergence **(#4)**. Suppose $S_n = \Sigma_{k=1}^{n}X_k$ is a partial sum consists of an ind. random variable $X_k$ with unspecified $\mu_k$ and $\sigma_k^2$. 
The [Kolmogorov's two-series theorem]() states that, if $\operatorname{Var}S_\infty = \Sigma_{k=1}^{\infty}\operatorname{E}(X_k - \operatorname{E}X_k)^2$ converges (thus $\operatorname{E}S_\infty = \Sigma_{k=1}^{\infty}\operatorname{E}X_k$ converges), then $\Sigma_{k=1}^{\infty} (X_k - \operatorname{E}X_k)$ converges a.s.. That is, if the sum is finite, then summands which contrbute to the sum converge to zero. Because $\Sigma$ is a linear operator, we can restate that $\Sigma_{k=1}^{n}(X_k - \operatorname{E}X_k) = \Sigma_{k=1}^{n}X_k - \operatorname{E}\Sigma_{k=1}^{n}X_k = S_n - \operatorname{E}S_n \xrightarrow{a.s.} 0$ as $n \to \infty$. In particular, if $\operatorname{E}S_\infty$ converges, then $S_n \xrightarrow{a.s.} \operatorname{E}S_n$ as $n \to \infty$. These can be sufficient criterias for the a.s. convergence of a series.

Kolmogorov's inequality easily assures that $P(\max_{n\leq k\leq m}{\vert (S_k - \operatorname{E}S_k) - (S_n - \operatorname{E}S_n) \vert} > \varepsilon) \leq \varepsilon^{-2}\operatorname{Var}(S_{m} + S_{n}) \to 0$ as $n \to \infty$ relating to that every convergent sequence is a Cauchy sequence. Subsequently, we use the [Kronecker's lemma](), which is proved by [summation by parts]() and the [Cesàro mean](), to link up the SLLN to the Kolmogorov's two-series theorem. The lemma in the context of analysis states the following: Suppose $(x_n)_{n\in\mathbb{N}}$ and $(b_n)_{n\in\mathbb{N}}$ are sequences of reals, where $b_n > 0$ and $b_n \uparrow \infty$. If $\Sigma_{n=1}^{\infty}b^{-1}_nx_n$ converges, then $b_n^{-1}\Sigma_{k=1}^{n}x_k \to 0$ as $n \to \infty$; This shows that, if a series of individually divided real numbers is finite, then the total has to be zero whenever it is divided by some significantly large number.

In the context of probability theory, if $\Sigma_{n=1}^{\infty}n^{-1}(X_n - \operatorname{E}X_n)$ converges a.s., then $n^{-1}\Sigma_{k=1}^{n}(X_n - \operatorname{E}X_n) \xrightarrow{a.s.} 0$ as $n \to \infty$, and thus $\bar{X}_n \xrightarrow{a.s.} \mu$ as $n \to \infty$. In fact, the two-series theorem provides that, if $\Sigma_{n=1}^{\infty}\operatorname{E}(n^{-1}X_n - \operatorname{E}n^{-1}X_n)^2 = \Sigma_{n=1}^{\infty}\operatorname{Var}(n^{-1}X_n) < \infty$, then $\Sigma_{n=1}^{\infty} n^{-1}(X_n - \operatorname{E}X_n)$ converges a.s. **(#5)**. From the outset, if we were given $\sigma^{2}_k < \infty$ for all $k\in\mathbb{N}$, then the preceding statement holds for the SLLN. Whereas, if $\sigma^{2}_k = \infty$ for some $k \in \mathbb{N}$, then we truncate $X_k$ to remove the assumption of finite variances. Notice that if we let $A = \{\omega: \Sigma_{n=1}^{\infty}n^{-1}X_n < \infty\}$ and $B = \{\omega: n^{-1}S_n(\omega) \to 0 \text{ as } n \to \infty\}$, where $A \subset B$, then the assumption yields $P(A) = 1$ and also the lemma says that $P(B) = 1$.


## III
---
By definition, if a sequence $(X_n)_{n\in\mathbb{N}}$ holds the WLLN, then $\vert \bar{X}_n - \mu \vert > \epsilon$ occures infinitely many times (but not necessarily at the equal interval). Whereas if $(X_n)_{n\in\mathbb{N}}$ holds the SLLN, then $\vert \bar{X}_n - \mu \vert = 0$ almost surely, that is, $\vert \bar{X}_n - \mu \vert > \epsilon$ occures only finitely many times, and so also holds $\lim_{n\to\infty}P(\vert \bar{X}_n - \mu \vert \leq \epsilon)=1$ for all $\epsilon > 0$. Even though the SLLN is stronger than the WLLN (i.e. as the name suggests), the latter is easier to prove than the prior as a consequence of Chebyshev's inequality (i.e. under the assumption of finite variance) **(#6)**. Also, in practice, we never use (i.e. have) an infinite sequence of realisations of a random variable. That is, Statistical or empirical implementations of the SLLN is infeasible.

For instance, consider ind. $X_n$ such that $P(X_n = n+1) = P(X_n = -(n+1)) = M_n$ and $P(X_n = 0) = 1 - 2M_n$, where $M_n = 1/2(n+1)\log(n+1)$. Since $\operatorname{E}X_n = (n+1)M_n - (n+1)M_n + 0(1-2M_n) = 0$ and $\operatorname{Var}X_n = \operatorname{E}(X_n-\operatorname{E}X_n)^2 = (n+1)/\log(n+1)$, we can immediately apply Chebyshev's inequality with $\operatorname{E}\bar{X}_n = 0$ and estimate $P(\vert \bar{X}_n \vert \geq \epsilon) \leq \epsilon^{-2}\operatorname{E}\bar{X}^2_n$, where $\epsilon^{-2}\operatorname{E}\bar{X}^2_n = n^{-2}\epsilon^{-2}\Sigma_{k=1}^{\infty}\operatorname{Var}X_k \leq k(k+1)/ n^2\epsilon^2\log(k+1) \to 0$ as $n \to \infty$, to show that $(X_n)_{n\in\mathbb{N}}$ holds the WLLN. However, because $\Sigma_{k=1}^{\infty}P(X_n = n+1) = \infty$ and $\{X_n = n+1\} \subset \{\vert S_n \vert \geq n/2\} \cup \{\vert S_{n-1} \vert \geq n/2\}$, the 2nd Borel-Canteli lemma yields $P(n^{-1}\vert S_n \vert \geq 1/2 \;\,\text{i.o.}) = 1$ and so $P(\lim_{n\to\infty}\bar{X}_n = 0) < 1$.

// (TBD) // It is still timely and costly challenging to obtain a significant number of samples for the WLLN. // Even if we continue sampling procedures to draw the sample distribution at some point, the population distribution remains to unknown. In this case, we can run a Monte Carlo simulation to study if our estimator converges to the expected value of interest. // In particular, assuming that the distribution of error is Gaussian (i.e. $\bar{X}_n - \mu$), we can use the CLT to draw the confidence interval and clarify the convergence rate, that is, sample size needed for the desired accuracy. // Furthermore, it is poosible to sample a random vector from a high dimensional space and observe interesting geometric results **(#7)**.


## **
---
**(#1)** In terms of statistics, $\bar{X}_n$ is an unbiased estimator of $\mu$ if it converges in $L^2$, and $\operatorname{Var}\bar{X}_n$ is the mse. **(#2)** For a i.i.d. sequence $(X_n)_{n\in\mathbb{N}}$, we alter the condition to $\Sigma_{k=1}^{n}P(\vert X_i \vert > x) = xP(\vert X_1 \vert > x) \to 0$ as $n \to \infty$, then $n^{-1}S_n - \mu_n \xrightarrow{p} 0$ as $n \to \infty$, where $\mu_n = \operatorname{E} X_1 I_{\vert X_1 \vert \leq x}$. **(#3)** The implication holds because $\mu$ is constant. **(#4)** Whilst we shall prove it via the convergence of a series, we may attempt to refine relationships between the convergence in probability and almost sure convergence: if $X_{n} \xrightarrow{p} X$, then $\exists$ a subsequence $(k_{n})_{n\in\mathbb{N}}$ such that $X_{k_{n}}\ {\xrightarrow {\text{a.s.}}}\ X$. **(#5)** Refer to the [three-series theorem](). **(#6)** The WLLN was proven by Bernoulli in the 18th century. The SLLN was proven by Borel in the beginning of the 20th century. **(#7)** Whilst a Monte Carlo utilises the LLN (and the CLT), we may use the [variance reduction](https://en.wikipedia.org/wiki/Variance_reduction) to //