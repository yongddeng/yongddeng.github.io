---
layout: default
title: "209. law of the iterated logarithm"
tags: math200
use_math: true
---


# (TBD) Law of the Iterated Logarithm
---
For sums of independent random variables we already know two limit theorems: the law of large numbers and the central limit theorem. The LLN describes for large $n \in \mathbb{N}$ the typical behavior, or average value behavior, of sums of $n$ random variables. On the other hand, the CLT quantifies the typical fluctuations about this average value. // We will study atypically large deviations from the average value in greater detail. The goal is to quantify the typical fluctuations of the whole process as $n \to \infty$. The main message is: While for fixed time $n$ the partial sum $S_n$ deviates by approximately $\sqrt{n}$ from its expected value (CLT), the maximal fluctuation up to time $n$ is of order $\sqrt{n \log \log n}$ (LIL) as stated by the Hartman–Wintner's theorem.

1. Khintchine (i.i.d.): zero mean and unit variance.
2. Kolmogorov (ind.): zero mean and finite variance.
   - Hartman-Wintner-Strassen (i.i.d.): zero mean and finite variance.
   - Khinchin (i.i.d.): a special case of Hartman-Wintner.


## I
--- 
Consider i.i.d. random variables $X_k$ with $\operatorname{E}X_k = 0$ and $\operatorname{Var}X_k = 1$, and let the partial sum $S_n = \Sigma_{k=1}^{n} X_k$, then the (Khinchin's) LIL states that $\limsup_{n \to \infty} {S_n \over \sqrt{n \log \log n}} = \sqrt{2}$ a.s. On the other hand, the CLT tells us that ${S_n \over \sqrt{n}} \sim \mathcal{N}(0, 1)$. The focus is not a single partial sum $S_n$, but rather a partial sum process $(S_n)_{n \in \mathbb{N}}$ and its overall behaviour through values of $n$. 


## **
--- 
A collection $\{S_t\}_{t \in T}$ which appears in the CLT and LIL is also a random walk (other kinds of partial sum processes include ____). In fact, the CLT and LIL describe important aspects of the behavior of simple random walks on $\mathbb{Z}$. The former entails that as n increases, the probabilities (proportional to the numbers in each row) approach a normal distribution. The latter provides insight when the CLT is applied to a random walk (or stochastic process), that is, the rate of convergence (book.page.88) can be understood when the sample mean converges to the population mean within a boundary of the Gaussian.