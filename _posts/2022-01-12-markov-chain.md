---
layout: default
title: "212. markov chain"
tags: maths200
use_math: true
---


# Markov Chain
---
A Markov chain forgets its past once its present is known, as tomorrow's weather depends mostly on today's and hardly on the record before it<!-- , and a model that learns from the entire record may be more faithful, but its joint law is impractical to compute -->. Its law is then a starting distribution and a transition matrix, so its long-run behaviour is the linear algebra of that matrix. The post classifies the states, shows that a chain which is irreducible, aperiodic and positive recurrent settles to a unique stationary law from any start, and turns detailed balance into Markov chain Monte Carlo.


## I
---
**Definition.** A process $X = (X\_n)\_{n \in \mathbb{N}}$ with values in a countable set $\mathbb{S}$ is a [Markov chain]() if it has the [Markov property]()

$$
P(X_{n+1} = j \mid X_n = i, X_{n-1} = i_{n-1}, \dots, X_0 = i_0) = P(X_{n+1} = j \mid X_n = i)
$$

whenever the conditioning event has positive probability. It is [time-homogeneous]() if $p\_{ij} = P(X\_{n+1} = j \mid X\_n = i)$ does not depend on $n$, and then its [transition matrix]() $\mathbf{P} = (p\_{ij})$ is a [stochastic matrix](), with $p\_{ij} \geq 0$ and $\sum\_j p\_{ij} = 1$, which with the [initial distribution]() $\pi\_i(0) = P(X\_0 = i)$ fixes every finite-dimensional law, $P(X\_0 = i\_0, \dots, X\_n = i\_n) = \pi\_{i\_0}(0)\,p\_{i\_0 i\_1} \cdots p\_{i\_{n-1} i\_n}$.

**Proposition** ([Chapman-Kolmogorov]())**.** The $n$-step probabilities $p^{(n)}\_{ij} = P(X\_{m+n} = j \mid X\_m = i)$ satisfy $p^{(m+n)}\_{ij} = \sum\_h p^{(m)}\_{ih}\,p^{(n)}\_{hj}$, so $\mathbf{P}^{(n)} = \mathbf{P}^n$, and the law of $X\_n$ is the row vector $\pi(n) = \pi(0)\mathbf{P}^n$.

<details><summary>Proof</summary>
Split on the state $h$ at the intermediate time and apply the Markov property, $P(X_{m+n} = j \mid X_0 = i) = \sum_h P(X_m = h \mid X_0 = i)\,P(X_{m+n} = j \mid X_m = h)$, so $\mathbf{P}^{(m+n)} = \mathbf{P}^{(m)}\mathbf{P}^{(n)}$, and induction from $\mathbf{P}^{(1)} = \mathbf{P}$ gives the powers. &#8718;
</details>

*Remarks.* Every eigenvalue of a stochastic matrix lies in the closed unit disc, since $\mathbf{P}$ maps a bounded vector to one of no larger maximum, and $1$ is one, with right eigenvector $\mathbf{1}$. Yet $\mathbf{P}$ need not be symmetric, and even a symmetric one need not be positive semi-definite, as the swap of two states, $p\_{12} = p\_{21} = 1$, has eigenvalues $1$ and $-1$. When $\mathbf{P}$ is diagonalisable, $\mathbf{P}^n = \mathbf{Q}\Lambda^n\mathbf{Q}^{-1}$ computes its powers, and Harris chains carry much of what follows to uncountable state spaces.


## II
---
**Definition.** A state $j$ is [accessible]() from $i$, written $i \to j$, if $p^{(n)}\_{ij} > 0$ for some $n \geq 0$, and $i$ and $j$ [communicate](), $i \leftrightarrow j$, if $i \to j$ and $j \to i$. Communication is an equivalence relation, as $p^{(m+n)}\_{ik} \geq p^{(m)}\_{ij}\,p^{(n)}\_{jk}$, whose classes are the [communicating classes](), and the chain is [irreducible]() if there is only one. A class is [closed]() if no state outside it is accessible from it, and a state $i$ is [absorbing]() if $p\_{ii} = 1$.

**Definition.** Write $P\_i$ and $\operatorname{E}\_i$ for the chain started at $i$, $T\_i = \inf \lbrace n \geq 1 \mid X\_n = i \rbrace$ for the [return time](), $\mu\_i = \operatorname{E}\_i T\_i$ for the [mean recurrence time]() and $d\_i = \gcd \lbrace n \geq 1 \mid p^{(n)}\_{ii} > 0 \rbrace$ for the [period](). The state $i$ is

$$
\begin{array}{lll}
\text{recurrent} & \text{if } P_i(T_i < \infty) = 1, & \text{and transient otherwise}, \\
\text{positive recurrent} & \text{if it is recurrent with } \mu_i < \infty, & \text{and null recurrent if recurrent with } \mu_i = \infty, \\
\text{aperiodic} & \text{if } d_i = 1, & \text{and periodic if } d_i > 1.
\end{array}
$$

**Theorem** (classification)**.** (i) Under $P\_i$ the number $N\_i$ of returns to $i$ has $P\_i(N\_i \geq k) = f\_i^k$, where $f\_i = P\_i(T\_i < \infty)$, so $i$ is [recurrent]() if and only if $\sum\_{n \geq 1} p^{(n)}\_{ii} = \operatorname{E}\_i N\_i = \infty$, and [transient]() if and only if the sum is finite; (ii) recurrence, transience and the period are shared by all the states of a class; (iii) in a finite chain a class is recurrent if and only if it is closed, and then it is positive recurrent.

<details><summary>Proof</summary>
(i) By the strong Markov property at each return, the chain returns once more with probability $f_i$ whatever happened before, so $N_i$ is geometric, and $\operatorname{E}_i N_i = \sum_{n \geq 1} P_i(X_n = i)$. (ii) If $p^{(r)}_{ij} > 0$ and $p^{(s)}_{ji} > 0$, then $p^{(r+n+s)}_{jj} \geq p^{(s)}_{ji}\,p^{(n)}_{ii}\,p^{(r)}_{ij}$, which carries divergence of the sum from $i$ to $j$, and $d_j$ divides both $r + s$ and $r + n + s$ whenever $p^{(n)}_{ii} > 0$, hence divides $d_i$, and symmetrically. (iii) A class that can be left is left for good with positive probability, so it is transient. From every state of a closed class of $K$ states the chain reaches $i$ within $K$ steps with probability at least some $\delta > 0$, so $P_i(T_i > mK) \leq (1 - \delta)^m$ and $\mu_i < \infty$. &#8718;
</details>

*Remarks.* A transient state is visited finitely often and a recurrent one infinitely often, almost surely from its own start. The symmetric walk on $\mathbb{Z}^d$ has $p^{(2n)}\_{00}$ of order $n^{-d/2}$, so it is recurrent for $d \leq 2$ and transient for $d \geq 3$ (Pólya, 1921), and on $\mathbb{Z}$ it is null recurrent. An irreducible chain is aperiodic as soon as one state has $p\_{ii} > 0$, and $p^{(n)}\_{ii} = 0$ whenever $d\_i$ does not divide $n$.


## III
---
**Definition.** A [stationary distribution]() is a probability row vector $\pi$ with $\pi = \pi\mathbf{P}$, so that $X\_0 \sim \pi$ gives $X\_n \sim \pi$ for every $n$. A chain is [ergodic]() if it is irreducible, aperiodic and positive recurrent, and the [total variation]() distance between laws on $\mathbb{S}$ is $\lVert \mu - \nu \rVert = \frac{1}{2}\sum\_j \lvert \mu\_j - \nu\_j \rvert = \sup\_A \lvert \mu(A) - \nu(A) \rvert$.

**Theorem** (stationary laws)**.** An irreducible chain has a stationary distribution if and only if it is positive recurrent, and then the distribution is unique, $\pi\_j = 1/\mu\_j$, and from any start the fraction of time spent at $j$ converges, $n^{-1}\sum\_{k < n} I\_{\lbrace X\_k = j \rbrace} \to \pi\_j$ almost surely.

<details><summary>Proof</summary>
In the recurrent case the excursions between successive visits to $j$ are i.i.d. by the strong Markov property, so the strong law applied to their lengths gives $n^{-1}\sum_{k < n} I_{\lbrace X_k = j \rbrace} \to 1/\mu_j$ almost surely, and taking means, $n^{-1}\sum_{k < n} p^{(k)}_{ij} \to 1/\mu_j$, which holds with limit $0$ in the transient case too. A stationary $\pi$ then satisfies $\pi_j = \sum_i \pi_i\, n^{-1}\sum_{k < n} p^{(k)}_{ij} \to 1/\mu_j$ by bounded convergence, which forces positive recurrence and uniqueness. Conversely the mean number of visits to each state during one excursion from $j$, divided by $\mu_j$, is a stationary distribution. &#8718;
</details>

**Theorem** ([convergence to equilibrium]())**.** If the chain is ergodic with stationary distribution $\pi$, then $\lVert \pi(0)\mathbf{P}^n - \pi \rVert \to 0$ for every initial distribution $\pi(0)$. If $\mathbb{S}$ is finite, the eigenvalue $\lambda\_2$ of $\mathbf{P}$ of largest modulus other than $1$ has $\lvert \lambda\_2 \rvert < 1$, and the convergence is geometric at the rate $\lvert \lambda\_2 \rvert^n$, up to a polynomial factor.

<details><summary>Proof</summary>
Run $X$ from $\pi(0)$ and $Y$ from $\pi$ independently until the first time $T$ with $X_T = Y_T$, and together afterwards, so that each is still a copy of the chain. Irreducibility and aperiodicity give $p^{(n)}_{ij} > 0$ for all large $n$, so the pair is an irreducible chain with stationary law $\pi \otimes \pi$, hence recurrent, and $T < \infty$ almost surely. As $Y_n \sim \pi$, $\lVert \pi(0)\mathbf{P}^n - \pi \rVert \leq P(X_n \neq Y_n) = P(T > n) \to 0$. For finite $\mathbb{S}$, $(\mathbf{P} - \mathbf{1}\pi)^n = \mathbf{P}^n - \mathbf{1}\pi$, and $\mathbf{P} - \mathbf{1}\pi$ has the eigenvalues of $\mathbf{P}$ with the simple eigenvalue $1$ replaced by $0$, all others lying strictly inside the unit disc by the Perron-Frobenius theorem, so the Jordan form bounds its powers by a polynomial times $\lvert \lambda_2 \rvert^n$. &#8718;
</details>

*Remarks.* Each hypothesis is needed. The swap chain is irreducible and positive recurrent with $\pi = (1/2, 1/2)$, but it has period $2$ and $\lambda\_2 = -1$, so $\pi(n)$ alternates and never settles. Two closed classes give a stationary law each and a limit that depends on the start, and the symmetric walk on $\mathbb{Z}$ has no stationary law at all. A finite chain is ergodic if and only if $\mathbf{P}^N$ has all entries positive for some $N$, as when $\mathbf{P}$ itself does, whereas a chain in which every state has a single successor runs round a cycle in each closed class, so with more than one state it is never ergodic.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#212/tv" width="600" height="226" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The law $\pi(n)$ of a chain started in its first state against $\pi$, left, and $\lVert \pi(n) - \pi \rVert$ on a log scale, right, with the slope $\lvert \lambda_2 \rvert^n$ drawn through it. The swap chain has $\lvert \lambda_2 \rvert = 1$ and stays at distance $1/2$.</div></div>

*Remark.* The proof is [Doeblin's coupling](), and its inequality $\lVert \pi(0)\mathbf{P}^n - \pi \rVert \leq P(T > n)$ holds for any coupling that keeps the two copies together once they meet, so a coupling that meets fast proves fast mixing.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#212/coupling" width="600" height="226" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The coupling for a lazy walk on ten states. $X$ starts at $0$ and $Y$ from the uniform $\pi$, they move independently until they meet at $T$ and together afterwards, and the exact curves, right, show $\lVert \pi(n) - \pi \rVert \leq P(T > n)$.</div></div>


## IV
---
**Definition.** A chain is [reversible]() with respect to a distribution $\pi$ if it satisfies the [detailed balance]() condition $\pi\_i p\_{ij} = \pi\_j p\_{ji}$ for all $i, j \in \mathbb{S}$.

**Proposition.** If $\mathbf{P}$ is reversible with respect to $\pi$, then $\pi$ is stationary, and when $X\_0 \sim \pi$ the reversed path $(X\_n, \dots, X\_0)$ has the law of $(X\_0, \dots, X\_n)$. For a target $\pi$ with every $\pi\_i > 0$ and a symmetric proposal matrix, $q\_{ij} = q\_{ji}$, the [Metropolis]() chain, which proposes $j$ from $i$ with probability $q\_{ij}$, accepts it with probability $\min(1, \pi\_j/\pi\_i)$ and otherwise stays at $i$, is reversible with respect to $\pi$.

<details><summary>Proof</summary>
Summing detailed balance over $i$ gives $\sum_i \pi_i p_{ij} = \pi_j \sum_i p_{ji} = \pi_j$. Applying it $n$ times turns $\pi_{i_0} p_{i_0 i_1} \cdots p_{i_{n-1} i_n}$ into $\pi_{i_n} p_{i_n i_{n-1}} \cdots p_{i_1 i_0}$, which is the law of the reversal. For $i \neq j$ the Metropolis flow $\pi_i q_{ij}\min(1, \pi_j/\pi_i) = q_{ij}\min(\pi_i, \pi_j)$ is symmetric in $i$ and $j$. &#8718;
</details>

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#212/flow" width="600" height="276" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The law of a chain started in state $1$ as water in tanks, each edge as thick as the mass $\pi_i(n)p_{ij}$ it carries in a step, and $\pi$ the orange line in each tank. The birth-death chain settles with every edge balanced, which is detailed balance. The drift cycle settles to uniform tanks but keeps a net $2/15$ a step running round, so it is stationary without being reversible, while the swap chain is reversible but periodic and never settles.</div></div>

*Remarks.* [Markov chain Monte Carlo]() samples a law $\pi$ known only up to a constant, as a posterior $p(\theta \mid x) \propto p(x \mid \theta)\,p(\theta)$ is, by running an ergodic chain with stationary law $\pi$. The Metropolis ratio $\pi\_j/\pi\_i$ never needs the constant, after a [burn-in]() the state is close in law to a draw from $\pi$, and time averages $n^{-1}\sum\_{k < n} f(X\_k)$ converge to $\sum\_j \pi\_j f(j)$ almost surely for $\pi$-integrable $f$. Metropolis et al. (1953) proposed the chain, and Hastings (1970) allowed asymmetric proposals, accepted with probability $\min(1, \pi\_j q\_{ji}/(\pi\_i q\_{ij}))$.

*Remarks.* [Rejection sampling]() gives independent draws but needs an envelope of the target, and its acceptance rate collapses with dimension, whereas MCMC trades independence for local moves<!-- , though MCMC also suffers the curse of dimensionality, as regions of high probability stretch and get lost in a growing volume -->. Random-walk Metropolis must still shrink its step like $d^{-1/2}$ in dimension $d$, with acceptance near $0.234$ at the optimum for product targets (Roberts, Gelman and Gilks, 1997), and Marjoram et al. (2003) ran MCMC without likelihoods at all.

*Remark.* [PageRank]() is the stationary law of a random surfer who follows a uniformly chosen link with probability $0.85$ and jumps to a uniformly chosen page otherwise, so every entry of $\mathbf{P}$ is positive and the law is unique.
