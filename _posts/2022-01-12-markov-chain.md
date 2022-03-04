---
layout: default
title: "markov chain"
tags: tag1
use_math: true
---


# Markov Chain
---
Unlike a (simple) random walk, markov chain is not a single stochastic process, but rather a collection of stochastic processes whose effect of the past on the further is summarised only by the current. One can see one-dimensional markov chain is an example of random walk. A markov chain is a very unique type of stochastic process as a future value of many stochastic processes are dependent on the whole or at least some of the past values in the process. Due to its unique property, it may be easier to analyse. Reference: A book (3rd edition) written by Leon-Garcia. // Many results for Markov chains with finite state space can be generalised to chains with uncountable state space through Harris chains. // Martingale property states that the future expectation of a stochastic process is equal to the current value, given all known information about the prior events. The Markov property states that a stochastic process essentially has "no memory" (i.e. given the present, the pas and the future are independent).


- Markov process // Markov property // Markov chain
- Classe of states // Recurrence properties 
- Limiting probabilities // 


## I
---
A stochastic process $X = (X_t)_{t \in T}$ which satisfies the [Markov property]() is called a [Markov process]() `(**1)`. Namely, for arbitrary times $t_1<t_2<\dots<t_k \in T$, a Markov process satisfies that $P(X_{t_k} = x_k \,|\, X_{t_{k-1}} = x_{k-1}, \dots, X_{t_1} = x_1) = P(X_{t_k} = x_k \,|\, X_{t_{k-1}} = x_{k-1})$. In fact, we primarly use a discrete-time Markov process on a countable state space $\mathbb{S}$, called a [Markov chain](), and since its joint pmf for $k$ consecutive realisations are provided by $P(X_{t_{k}},X_{t_{k-1}}, \dots, X_{t_1}) = P(X_{t_k}\,|\,X_{t_{k-1}}) P(X_{t_{k-1}}\,|\,X_{t_{k-2}}) \dots P(X_{t_1}) = (\prod_{l=2}^{k}P(X_{t_l}\,|\,X_{t_{l-1}})) P(X_{t_1})$, the focus lies on the initial [state probabilities]() $\pi_j(1) = P(X_{t_1} = j)$ and the subsequent $1$-step [transition probabilities]() $p_{ij}(1) = P(X_{t_k} = j \,|\, X_{t_{k-1}} = i)$, where $i, j \in \mathbb{S}$.

If a state space of a Markov chain is finite with $n$ distinct elements, then we can draw a [transition matrix]() $\mathbf{P} = (p_{ij})$, where $\mathbf{P}$ is an $n \times n$ positive semidefinite matrix whose $\Sigma_{j \in \mathbb{S}}p_{ij} = 1$. If, in addition, it is [time-homogeneous]() by $P(X_{t_k} = i \,|\, X_{t_{k-1}} = j) = P(X_{t_{k-1}} = i \,|\, X_{t_{k-2}} = j)$ for all $k$, then we can apply the [Chapman-Kolmogorov equations]() $\mathbf{P}(k)\mathbf{P}(s) = \mathbf{P}(k+s) = (p_{ij}(k+s))$ for all $k$ and $s$, and the $k$-th power of transition matrices would be equal to the $k$-step transition matrix $\mathbf{P}^k = \mathbf{P}(k) = (p_{ij}(k))$ `(**3)`. More algebraically, for $k=2$, we get $p_{ij}(2) = P(X_{t_k} = j \,|\, X_{t_{k-2}} = i) = \Sigma_{h}P(X_{t_k}=j \,|\, X_{t_{k-1}}=h) P(X_{t_{k-1}}=h \,|\, X_{t_{k-2}}=i) = \Sigma_{h}p_{ih}(1)p_{hj}(1)$, where $h \in \mathbb{S}$ is an intermediate state among $i$ and $j$.

We now examine a [state pmf]() $\pi(k) = (\pi_j(k))$, where $\pi_j(k) = \Sigma_{i}p_{ij}\pi_i(k-1)$. In particular, if $\pi_j(k)\to\pi_j$ and $\pi_i(k-1)\to\pi_i$ as $k\to\infty$, then such states are called a stationary state pmf or [steady state]() $\pi = (\pi_j)$, where $\pi_j = \Sigma_{i}p_{ij}\pi_i$ and $\pi$ is a $1 \times n$ row vector whose $\Sigma_{j}\pi_j = 1$. In fact, its matrix notation $\pi\mathbf{P}=\pi$ is in the form $v^{\top}A = v^{\top}\lambda$, and since the [Perron-Frobenius theorem]() enumerates the eigenvalues of $\mathbf{P}$ by $1=|\lambda_{1}|>|\lambda_{2}|\geq\cdots\geq|\lambda_{n}|$, the left eigenvector $\mathbf{q}_1$ which corresponds to $\lambda_1$ and satisfies $\mathbf{q}_1^{\top}\mathbf{P} = \mathbf{q}^{\top}_1\lambda_1$ is itself a steady state `(**4)`. Although a steady state is not unique in general, a [limiting distribution]() $\pi=\pi(1)P^{\infty}$ of a time-homogeneous Markov chain is always a unique steady state (if exists).


## II
---
Some jargons must be introduced prior to formal statements describing behaviours of a Markov chain and the conditions under which a state pmf becomes stationary. Firstly, if $p_{ij}(k) > 0$ for some $k\geq{1}$, then a state $j$ is [accessible]() from a state $i$, and denoted by $i \rarr j$. Whereas, if $p_{ij}(k) = 0$ for some $k\geq{1}$ and every $j \in \mathbb{S}$, then a state $i$ is [absorbing](). If both $i \rarr j$ and $j \rarr i$, that is, $i \lrarr j$, then we say that $i$ and $j$ [communicate]() with each other. In particular, if $i \lrarr h$ and $h \lrarr j$, then $i \lrarr j$, and $i$ and $j$ being $i \lrarr j$ belong to the same [class](). Hence a collection of every states of a Markov chain consist of one or more disjoint communication classes, and we say a Markov chain that has a single class is [irreducible]() `(**6)`.

For any state $i \in \mathbb{S}$, if a probability of a Markov chain departed from $i$ ever returning to $i$ is given by $f_{ii} = P(X_{t_k} = i,\,k>1 \, |\, X_{t_{1}}=i)$, then $i$ is [recurrent]() if $f_{ii} = 1$, and [transient]() if $f_{ii} < 1$. In other words, $i$ occurs infinitly many times when $f_{ii}=1$, and only finitly many times when $f_{ii}<1$. If occurrences of transient state $i$ is viewed as failures in a Bernoulli trial with $q=f_{ii}$, where the number of returns in which a success terminates transitions is a geometric random variable $\text{Geom}(1-f_{ii})$, and also if the mean number of returns to $i$ is given by $\operatorname{E}[\Sigma_{k=2}^{\infty}I_{i}(X_{t_k})\,|\,X_{t_1}=i] = \Sigma_{k=2}^{\infty}\operatorname{E}[I_i(X_{t_k})\,|\,X_{t_{1}}=i] = \Sigma_{k=2}^{\infty}p_{ii}(k)$ `(**7)`, then $i$ is recurrent if and only if $\Sigma_{k=2}^{\infty}p_{ii}(k) = \infty$, and transient if and only if $\Sigma_{k=2}^{\infty}p_{ii}(k) < \infty$.

In particular, if the initial departure at time $t_1$ is a recurrent state $i$, and $\{t_{ii}(l)\}_{k\geq{l}>1}$ is an i.i.d. sequence of the time elapses between returns, then a proportion of time spent in $i$ after $l$ returns is given by $l/\Sigma_{m=1}^{l}t_{ii}(m)$, and the WLLN leads to $l/\Sigma_{m=1}^{l}t_{ii}(m) \to 1/\mu_{ii} = \pi_i$ as $k\to\infty$. Given the [mean recurrence time]() by $\mu_{ii} = \operatorname{E}t_{ii}$, the state is [positive recurrent]() if $\mu_{ii} < \infty$, and [null recurrent]() if $\mu_{ii} = \infty$. We may also impose a notion of periodicity within a sample path. That is, if $p_{ii}(k) = 0$ whenever $k$ % $d \neq 0$ for any $k > d$, then $i$ has [period]() $d$ `(**8)`. While we say a state $i$ is [periodic]() when $d>1$, or [aperiodic]() when $d=1$, an irreducible Markov chain is aperiodic if the states in the class have period $d=1$. 
  

## III
---
A state $i$ is ergodic if it is aperiodic and positive recurrent. If all states in an irreducible Markov chain are ergodic, then the chain is the ergodic mc. // More generally, a Markov chain is ergodic if there is a number N such that any state can be reached from any other state in any number of steps less or equal to a number $N$. // With a fully connected transition matrix, in which all transitions have a non-zero probability, this condition is fulfilled with $N = 1$. // Assuming irreducibility, the stationary distribution is always unique if it exists, and its existence can be implied by positive recurrence of all states. // 이것을 에르고딕 정리 라고 부르며, ergodic mc는 초기 분포에 관계없이 장기적으로 unique steady state으로 converge한다고 보장합니다.

왜 우리는 에르고딕 정리 (w/ Ergodic Markov Chains Theorem)에 관심을 가져야합니까? // 모든 마르코프 사슬이 장기적으로 우리의 예와 같이 단일 고정 분포로 수렴하지 않을 때, 에르 고딕 마르코프 체인 이라고하는 특별한 유형의 마르코프 체인 만이 이와 같이 단일 분포로 수렴하기 때문입니다. // MCMC는 강력한 머신 러닝 기술의 기초인데, 컴퓨터에서 마르코프 체인 시뮬레이션을 실행하여 정상적으로 풀기에는 너무 어렵거나 심지어 불가능한 복잡한 통계 문제에 대한 답을 얻기 위해 사용됩니다. // 에르 고딕 정리는 convergence을 보장하기 때문에 MCMC 방법을 사용하는 데 기본이됩니다. 우리가 MCMC 시뮬레이션을 설정할 때 Ergodic mc를 사용하는 한, 시뮬레이션에 의해 생성 된 데이터 포인트가 실제로 unique steady state로 converge함을 확신할 수 있습니다. // 다시한번 말하자면, any finite, irreducible, ergodic한 mc는 stationary 합니다.

http://www.scieng.net/tech/12904?page=96


## **
---
`(1)` 마르코프 가정으로 구현한 모델은 이전 모든 상태를 고려한 모델보다 성능이 떨어질 가능성이 높음에도 불구하고, 마르코프 가정 없이 우리가 지금까지 지나온 상태들의 joint distribution를 구하는게 어렵기 때문에 사용한다. // Training phase에서 MLE를 진행할 때 overfitting을 avoid하기 위해서 probability를 smoothing시킨다. `(3)` If possible, we may run eigendecomposition on a trainsion matrix by $\mathbf{P}^k = \mathbf{Q}\mathbf{\Lambda}^k\mathbf{Q}^{-1}$ for make matrix multiplication to be more efficient with diagnoal opeartion. `(4)` $\pi(k) \to \pi$ as $k\to\infty$ with a speed in the order of $\lambda_2/\lambda_1$ exponentially. `(6)` If a Markov chain is irreducible, then all states communicate with each other, and the only class is a state space. `(7)` $\operatorname{E}[I_i(X_{t_k})\,|\,X_{t_{1}}=i] = P(X_{t_k}=i\,|\,X_{t_1}=i) = p_{ii}(k)$, where $I_i(X_{t_k})$ is the indicator function. `(8)` $d= \gcd\{k>1:p_{ii}(k)>0\}$.


The first-order auto-regressive (AR) process (appears in time series modelling) is another example of a Markov chain.

- https://ichi.pro/ko/maleukopeu-chein-ui-jiggwan-124512960433810