---
layout: default
title: "205. characteristic function"
tags: maths200
use_math: true
---


# Characteristic Function
---
The characteristic function is the Fourier transform of a law. It exists for every random variable, it determines the law, it turns independent sums into products, and it turns convergence in distribution into pointwise convergence of functions, which is why the limit theorems run through it<!-- , the convolution theorem $\operatorname{FT}\lbrace f \ast g \rbrace = \operatorname{FT}\lbrace f \rbrace \cdot \operatorname{FT}\lbrace g \rbrace$ being its prototype -->.


## I
---
**Definition.** The [characteristic function]() of a random variable $X$ is $\varphi\_X(t) = \operatorname{E}e^{itX} = \operatorname{E}\cos tX + i\operatorname{E}\sin tX$ for $t \in \mathbb{R}$, and that of a random vector $X$ in $\mathbb{R}^d$ is $\varphi\_X(t) = \operatorname{E}e^{i\langle t, X \rangle}$ for $t \in \mathbb{R}^d$. When $X$ has a density $f\_X$, $\varphi\_X(t) = \int\_{\mathbb{R}} e^{itx}f\_X(x)\,\mathrm{d}x$ is the [Fourier transform]() of $f\_X$ with the sign of the exponent reversed, a convention that changes nothing.

**Proposition.** Every characteristic function satisfies (i) $\varphi\_X(0) = 1$ and $\lvert \varphi\_X(t) \rvert \leq 1$; (ii) $\varphi\_X(-t) = \overline{\varphi\_X(t)}$, and $\varphi\_X$ is real if and only if $X \overset{d}{=} -X$; (iii) $\varphi\_X$ is uniformly continuous; (iv) $\varphi\_{aX+b}(t) = e^{itb}\varphi\_X(at)$; (v) $\varphi\_{X+Y} = \varphi\_X\varphi\_Y$ when $X$ and $Y$ are independent.

<details><summary>Proof</summary>
(i) $\lvert \operatorname{E}e^{itX} \rvert \leq \operatorname{E}\lvert e^{itX} \rvert = 1$, as $e^{itx} = \cos tx + i\sin tx$ has modulus $1$. (ii) The conjugate of $e^{itX}$ is $e^{-itX}$, and $\varphi_{-X}(t) = \varphi_X(-t)$, so a real $\varphi_X$ equals $\varphi_{-X}$ and the uniqueness theorem below gives $X \overset{d}{=} -X$. (iii) $\lvert \varphi_X(t + h) - \varphi_X(t) \rvert \leq \operatorname{E}\lvert e^{ihX} - 1 \rvert$, which does not involve $t$ and tends to $0$ as $h \to 0$ by dominated convergence. (iv) is linearity, and (v) is $\operatorname{E}e^{itX}e^{itY} = \operatorname{E}e^{itX}\operatorname{E}e^{itY}$ for independent $X$ and $Y$. &#8718;
</details>

*Remarks.* (v) is the convolution theorem read for laws, since the law of $X + Y$ is the convolution of those of $X$ and $Y$, and by induction $\varphi\_{S\_n}(t) = \prod\_{k=1}^n \varphi\_{X\_k}(a\_k t)$ for $S\_n = \sum\_{k=1}^n a\_k X\_k$ with independent $X\_k$. Where the moment generating function $m\_X(t) = \operatorname{E}e^{tX}$ is finite near $0$, $m\_X(t) = \varphi\_X(-it)$, but unlike $m\_X$ the characteristic function exists for every law.

**Examples.**

- The standard normal law has $\varphi(t) = e^{-t^2/2}$, and $N(\mu, \sigma^2)$ has $e^{i\mu t - \sigma^2 t^2/2}$;
- the exponential law with mean $1$ has $\varphi(t) = 1/(1 - it)$;
- a fair $\pm 1$ coin has $\varphi(t) = \cos t$, and the Bernoulli law with $P(X = 1) = p$ has $1 - p + pe^{it}$;
- the standard Cauchy law has $\varphi(t) = e^{-\lvert t \rvert}$, not differentiable at $0$, so the law has no mean.

**Proposition** (moments)**.** If $\operatorname{E}\lvert X \rvert^n < \infty$, then $\varphi\_X$ is $n$ times continuously differentiable with $\varphi\_X^{(k)}(0) = i^k\operatorname{E}X^k$ for $k \leq n$, and $\varphi\_X(t) = \sum\_{k=0}^n (it)^k\operatorname{E}X^k/k! + o(t^n)$ as $t \to 0$.

<details><summary>Proof</summary>
Differentiate under the expectation, which dominated convergence allows as $\lvert (e^{ihx} - 1)/h \rvert \leq \lvert x \rvert$ makes every difference quotient of $(ix)^{k-1}e^{itx}$ at most $\lvert x \rvert^k$. For the expansion, $\lvert e^{ix} - \sum_{k \leq n} (ix)^k/k! \rvert \leq \min(\lvert x \rvert^{n+1}/(n+1)!, 2\lvert x \rvert^n/n!)$, so the error divided by $t^n$ is bounded by an integrable function of $X$ and tends to $0$ pointwise. &#8718;
</details>

*Remark.* For $\operatorname{E}X = 0$ and $\operatorname{E}X^2 = 1$ this reads $\varphi\_X(t) = 1 - t^2/2 + o(t^2)$, and $\varphi\_X(t/\sqrt{n})^n \to e^{-t^2/2}$ is the central limit theorem for independent copies of $X$ in one line, once the continuity theorem below turns it into convergence of laws.

**Proposition** (decay and lattices)**.** If $X$ has a density, then $\varphi\_X(t) \to 0$ as $\lvert t \rvert \to \infty$, the [Riemann-Lebesgue lemma](). At the other extreme, $\lvert \varphi\_X(t\_0) \rvert = 1$ for some $t\_0 \neq 0$ if and only if $X$ lies almost surely on a [lattice]() $b + (2\pi/t\_0)\mathbb{Z}$, and then $\lvert \varphi\_X \rvert$ is periodic with period $t\_0$.

<details><summary>Proof</summary>
For a step function $f$ the transform is a finite sum of terms $(e^{itd} - e^{itc})/(it)$, which are $O(1/\lvert t \rvert)$, and step functions are dense in $L^1$, while $\lvert \int e^{itx}(f - g)(x)\,\mathrm{d}x \rvert \leq \lVert f - g \rVert_1$. For the lattice, $\varphi_X(t_0) = e^{i\theta}$ means $\operatorname{E}\cos(t_0 X - \theta) = 1$, so $\cos(t_0X - \theta) = 1$ almost surely and $t_0 X \in \theta + 2\pi\mathbb{Z}$. Conversely $e^{it_0X}$ is then constant, so $\varphi_X(t + t_0) = e^{it_0 b}\varphi_X(t)$. &#8718;
</details>

*Remark.* A lattice law therefore never decays, its $\lvert \varphi\_X \rvert$ returning to $1$ in every period, as $\cos t$ does for the coin, and this is why local limit theorems treat lattice and non-lattice sums apart.


## II
---
**Theorem** ([inversion]())**.** For $a < b$,

$$
\lim_{T \to \infty} \frac{1}{2\pi}\int_{-T}^{T} \frac{e^{-ita} - e^{-itb}}{it}\,\varphi_X(t)\,\mathrm{d}t = P(a < X < b) + \tfrac12 P(X = a) + \tfrac12 P(X = b),
$$

which is $F\_X(b) - F\_X(a)$ when $a$ and $b$ lie in the set $C(F\_X)$ of continuity points of $F\_X$. If $\varphi\_X$ is integrable, $X$ has the bounded continuous density $f\_X(x) = \frac{1}{2\pi}\int\_{\mathbb{R}} e^{-itx}\varphi\_X(t)\,\mathrm{d}t$.

<details><summary>Proof</summary>
The integrand is bounded by $b - a$, so Fubini's theorem turns the left side before the limit into the expectation of $\frac{1}{\pi}\int_0^T (\sin t(X - a) - \sin t(X - b))/t\,\mathrm{d}t$. This is bounded in $T$ and $X$ and tends to $\frac12(\operatorname{sgn}(X - a) - \operatorname{sgn}(X - b))$, as $\int_0^\infty \sin(ct)/t\,\mathrm{d}t = \frac{\pi}{2}\operatorname{sgn}c$, and bounded convergence finishes. For integrable $\varphi_X$ the limit is an integral over $\mathbb{R}$, continuous in $a$ and $b$, so $X$ has no atoms, and dividing by $b - a$ and letting $b \downarrow a$ gives $f_X$. &#8718;
</details>

**Corollary** ([uniqueness]())**.** $\varphi\_X = \varphi\_Y$ if and only if $X \overset{d}{=} Y$.

<details><summary>Proof</summary>
The inversion formula recovers $F_X(b) - F_X(a) = F_Y(b) - F_Y(a)$ for $a, b$ in the dense set $C(F_X) \cap C(F_Y)$. Let $a \to -\infty$ and use right-continuity. &#8718;
</details>

*Remark.* With $a = x - h$ and $b = x + h$ in $C(F\_X)$ the formula reads $\frac{F\_X(x + h) - F\_X(x - h)}{2h} = \lim\_{T \to \infty}\frac{1}{2\pi}\int\_{-T}^{T}\frac{\sin ht}{ht}e^{-itx}\varphi\_X(t)\,\mathrm{d}t$, a smoothed density that suits numerical inversion. The formulas extend to $\mathbb{R}^d$ with one such integral per coordinate.

**Theorem** ([Gil-Pelaez]())**.** At every $x \in C(F\_X)$, $F\_X(x) = \frac12 - \frac1\pi\int\_0^\infty \frac{\operatorname{Im}(e^{-itx}\varphi\_X(t))}{t}\,\mathrm{d}t$, the integral taken as the limit of $\int\_\varepsilon^T$ as $\varepsilon \downarrow 0$ and $T \to \infty$.

<details><summary>Proof</summary>
$\operatorname{Im}(e^{-itx}\varphi_X(t)) = \operatorname{E}\sin t(X - x)$. Fubini's theorem on $[\varepsilon, T]$ and bounded convergence, with $\int_0^\infty \sin(ct)/t\,\mathrm{d}t = \frac{\pi}{2}\operatorname{sgn}c$, give $\frac12 - \frac12\operatorname{E}\operatorname{sgn}(X - x) = F_X(x) - \frac12 P(X = x)$. &#8718;
</details>

*Remark.* At an atom the formula returns the midpoint $\frac12(F\_X(x-) + F\_X(x))$ of the jump, and a truncated integral rings around it, as Fourier partial sums do around any jump. Gil-Pelaez (1951) reduced inversion to one real integral over $(0, \infty)$, the form numerical work usually takes.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#205/inversion" width="460" height="226" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">The Gil-Pelaez integral cut off at $T$, for the law $\frac12 N(0, 1) + \frac12 \delta_1$. It closes on $F$ wherever $F$ is continuous and rings around the atom at $1$, settling on the midpoint of the jump.</div></div>

**Theorem** ([Lévy's continuity theorem]())**.** $X\_n \xrightarrow{d} X$ if and only if $\varphi\_{X\_n}(t) \to \varphi\_X(t)$ for every $t$. Moreover, if $\varphi\_{X\_n}$ converges pointwise to a function $\varphi$ that is continuous at $0$, then $\varphi$ is the characteristic function of some $X$ and $X\_n \xrightarrow{d} X$.

<details><summary>Proof</summary>
Forwards, $\cos tx$ and $\sin tx$ are bounded and continuous. For the rest, the bound $P(\lvert X_n \rvert > 2/u) \leq \frac1u\int_{-u}^{u}(1 - \varphi_{X_n}(t))\,\mathrm{d}t$ and continuity of $\varphi$ at $0$ make the laws tight, so every subsequence has a further subsequence converging in distribution by Helly's selection theorem. Each such limit has characteristic function $\varphi$, and uniqueness makes them one law. &#8718;
</details>

*Remarks.* The $X\_n$ need not share a probability space, as only their laws enter. Continuity at $0$ cannot be dropped. For independent standard Cauchy $X\_k$, $S\_n/\sqrt{n}$ has characteristic function $e^{-\sqrt{n}\lvert t \rvert}$, which tends to $I\_{\lbrace t = 0 \rbrace}$, and the mass escapes to infinity.

- <div style="display: inline-block;"><iframe src="../assets/blog/maths.html#205/curve" width="460" height="250" style="border: none; overflow: hidden;" scrolling="no"></iframe> <div style="font-size: 11px; font-style: italic; color: #666; margin-top: 5px;">Left, $\varphi_n(t)$ of a standardised sum for $\lvert t \rvert \leq 8$ in the complex plane. Right, its modulus against $e^{-t^2/2}$. Exponential summands spiral onto the real segment, a lattice coin's modulus returns to $1$ until $n$ pushes the period past the frame, and Cauchy summands over $\sqrt{n}$ collapse to a limit discontinuous at $0$.</div></div>


## III
---
**Definition.** A function $g : \mathbb{R}^d \to \mathbb{C}$ is [positive-definite]() if $\sum\_{j,k=1}^m c\_j \overline{c\_k}\, g(t\_j - t\_k) \geq 0$ for every $m$, every $t\_1, \dots, t\_m \in \mathbb{R}^d$ and every $c\_1, \dots, c\_m \in \mathbb{C}$, that is, if every matrix $(g(t\_j - t\_k))\_{j,k}$ is positive semi-definite.

**Theorem** ([Bochner]())**.** A function $\varphi : \mathbb{R}^d \to \mathbb{C}$ is the characteristic function of a probability measure on $\mathbb{R}^d$ if and only if it is continuous, positive-definite and $\varphi(0) = 1$.

<details><summary>Proof</summary>
Necessity is $\sum_{j,k} c_j \overline{c_k}\,\varphi(t_j - t_k) = \operatorname{E}\lvert \sum_j c_j e^{i\langle t_j, X \rangle} \rvert^2 \geq 0$. For sufficiency, with $d = 1$, positive-definiteness makes $p_T(x) = \frac{1}{2\pi T}\int_0^T\int_0^T \varphi(s - t)e^{-i(s-t)x}\,\mathrm{d}s\,\mathrm{d}t = \frac{1}{2\pi}\int_{-T}^{T}(1 - \lvert t \rvert/T)\varphi(t)e^{-itx}\,\mathrm{d}t$ non-negative, a density with characteristic function $(1 - \lvert t \rvert/T)^+\varphi(t)$. These tend to $\varphi$ as $T \to \infty$, and $\varphi$ is continuous at $0$, so Lévy's continuity theorem supplies the law. &#8718;
</details>

**Proposition** ([random Fourier features]())**.** Let $K(x, y) = \kappa(x - y)$ be a real kernel on $\mathbb{R}^d$ with $\kappa$ continuous, positive-definite and $\kappa(0) = 1$, let $\omega$ have the law with characteristic function $\kappa$, and let $b$ be uniform on $[0, 2\pi]$ and independent of $\omega$. Then $z\_\omega(x) = \sqrt{2}\cos(\langle \omega, x \rangle + b)$ has $\operatorname{E}z\_\omega(x)z\_\omega(y) = K(x, y)$, and for $D$ independent copies the average $\hat{K}(x, y) = D^{-1}\sum\_{j=1}^D z\_{\omega\_j}(x)z\_{\omega\_j}(y)$ satisfies $P(\lvert \hat{K}(x, y) - K(x, y) \rvert \geq \varepsilon) \leq 2e^{-D\varepsilon^2/8}$.

<details><summary>Proof</summary>
$2\cos(A + b)\cos(B + b) = \cos(A - B) + \cos(A + B + 2b)$, the second term has mean $0$ over $b$, and $\operatorname{E}\cos\langle \omega, x - y \rangle = \operatorname{Re}\kappa(x - y) = \kappa(x - y)$ as $\kappa$ is real. Each product lies in $[-2, 2]$, so Hoeffding's inequality with range $4$ gives the bound. &#8718;
</details>

*Remarks.* The Gaussian kernel $\kappa(\Delta) = e^{-\lVert \Delta \rVert^2/2}$ is the characteristic function of $N(0, I\_d)$, so its features use normal $\omega$ (Rahimi and Recht, 2007). Stacking $D$ features of $L$ points into an $L \times D$ matrix $Z$ factorises the kernel matrix approximately as $ZZ^\top/D$, so a kernel machine trains linearly on $Z$<!-- , as OLS, SVM and PCA then do -->, and products with the kernel matrix cost $O(LD)$ in place of $O(L^2)$.

*Remark.* [Performer]() (Choromanski et al., 2020) linearises softmax attention the same way. It writes $e^{\langle q, k \rangle} = e^{\lVert q \rVert^2/2}\kappa(q - k)e^{\lVert k \rVert^2/2}$ for the Gaussian $\kappa$, and replaces the trigonometric features by positive ones, $e^{\langle \omega, x \rangle - \lVert x \rVert^2/2}$ with normal $\omega$, whose estimates of the kernel never change sign.
