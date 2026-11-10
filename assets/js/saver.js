// The screen savers (System Properties → Screen Saver, settings.js), each
// from a maths200 post and drawn live: Pólya's urn (211), characteristic
// curves (205), the typewriter (206) and a mixing walk (212). Loaded the
// first time one is wanted. Each draws step by step on a canvas and says when
// it is done, and the runner starts it afresh a while after; big, over the
// whole screen with its caption, or small, in the tab's monitor.
(function () {
	const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
	const betaPdf = (a, b) => {
		const B = fact(a - 1) * fact(b - 1) / fact(a + b - 1);
		return x => x ** (a - 1) * (1 - x) ** (b - 1) / B;
	};
	const FONT = '12px "Helvetica Neue", Arial, sans-serif';
	// two lines along the foot of the screen
	function caption(g, H, lines) {
		g.fillStyle = '#8c8c8c';
		g.font = FONT;
		g.textAlign = 'left';
		g.textBaseline = 'alphabetic';
		lines.forEach((l, i) => g.fillText(l, 30, H - 10 - (lines.length - 1 - i) * 16));
	}

	const SAVERS = {
		// 211: the share of red in hundreds of Pólya urns at once, their paths
		// on the left and where they settle piling up on the right
		polya: {
			name: 'Pólya’s urn, 211',
			about: '211. The share of red balls in Pólya’s urn is a martingale, so it converges, and from a red and b black its limit is Beta(a, b). Hundreds of urns run at once, their paths settling on the left while their limits pile up into that density on the right.',
			make(g, W, H, big, turn) {
				const [a, b] = [[1, 1], [2, 1], [4, 4]][turn % 3];
				const pdf = betaPdf(a, b), K = big ? 260 : 110, N = big ? 1600 : 700, per = big ? 5 : 3, BINS = 18;
				const pad = big ? { l: 30, r: 12, t: 36, b: 52 } : { l: 4, r: 3, t: 6, b: 6 };
				const split = W * 0.8, X = k => pad.l + (split - pad.l) * Math.log(1 + k) / Math.log(1 + N), Y = y => pad.t + (1 - y) * (H - pad.t - pad.b);
				const colour = (y, al) => `hsla(${Math.round(225 - 225 * y)}, 85%, 60%, ${al})`;
				const urns = Array.from({ length: K }, () => ({ r: a, k: a + b }));
				let n = 0;
				g.fillStyle = '#000';
				g.fillRect(0, 0, W, H);
				if (big) {
					caption(g, H, [`Pólya’s urn, ${K} urns from ${a} red and ${b} black, each draw returning the ball with another of its colour.`,
						`The share of red is a martingale, so every path settles. Dashed on the right, Beta(${a}, ${b}), the law of where they settle (211).`]);
					g.fillText('share of red', pad.l, pad.t - 12);
					g.textAlign = 'right';
					g.textBaseline = 'middle';
					g.fillText('0', pad.l - 6, Y(0));
					g.fillText('1', pad.l - 6, Y(1));
				}
				function hist() {
					const x0 = split + (big ? 14 : 6), w = W - pad.r - x0, h = H - pad.t - pad.b;
					g.fillStyle = '#000';
					g.fillRect(x0 - 2, 0, W - x0 + 2, H - (big ? 40 : 0));
					const counts = new Array(BINS).fill(0);
					urns.forEach(u => counts[Math.min(BINS - 1, Math.floor(u.r / u.k * BINS))]++);
					const scale = w / 3.2, bh = h / BINS;
					counts.forEach((c, i) => {
						g.fillStyle = colour((i + 0.5) / BINS, 0.85);
						g.fillRect(x0, pad.t + (BINS - 1 - i) * bh + 1, Math.min(w, c / K * BINS * scale), bh - 2);
					});
					g.strokeStyle = 'rgba(255,255,255,0.9)';
					g.lineWidth = big ? 1.5 : 1;
					g.setLineDash(big ? [5, 4] : [3, 2]);
					g.beginPath();
					for (let i = 0; i <= 60; i++) {
						const y = i / 60, x = x0 + Math.min(w, pdf(y) * scale);
						if (i) g.lineTo(x, Y(y));
						else g.moveTo(x, Y(y));
					}
					g.stroke();
					g.setLineDash([]);
				}
				return () => {
					if (n >= N) return true;
					const paths = Array.from({ length: 16 }, () => new Path2D());
					for (let s = 0; s < per && n < N; s++, n++) {
						const x0 = X(n), x1 = X(n + 1);
						for (const u of urns) {
							const y0 = u.r / u.k;
							if (Math.random() < y0) u.r++;
							u.k++;
							const y1 = u.r / u.k, c = Math.min(15, Math.floor(y1 * 16));
							paths[c].moveTo(x0, Y(y0));
							paths[c].lineTo(x1, Y(y1));
						}
					}
					g.lineWidth = big ? 1 : 0.7;
					paths.forEach((p, c) => {
						g.strokeStyle = colour((c + 0.5) / 16, big ? 0.5 : 0.6);
						g.stroke(p);
					});
					hist();
					return false;
				};
			},
		},
		// 205: φ(t) for a law on the integers, t from 0 to 2π, then the powers
		// of it that the sums of independent copies have
		chf: {
			name: 'Characteristic curves, 205',
			about: '205. A law on the integers has a characteristic function that comes back to 1 at t = 2π, and |φ| < 1 in between once the law spans the lattice. Each curve is φ(t) for t from 0 to 2π, then φ², φ³, φ⁵ and φ⁸ for sums of independent copies, which shrink towards 0.',
			make(g, W, H, big) {
				const m = 3 + Math.floor(Math.random() * 5);
				const w = Array.from({ length: m + 1 }, () => Math.random() ** 1.6 + 0.04), tot = w.reduce((x, y) => x + y, 0), p = w.map(x => x / tot);
				const POW = [1, 2, 3, 5, 8], HUE = [42, 175, 280, 330, 205];
				const R = Math.min(W * (big ? 0.33 : 0.42), H * (big ? 0.4 : 0.44)), cx = big ? W * 0.44 : W / 2, cy = big ? H * 0.46 : H / 2;
				g.fillStyle = '#000';
				g.fillRect(0, 0, W, H);
				g.strokeStyle = '#2c2c2c';
				g.lineWidth = 1;
				g.beginPath();
				g.arc(cx, cy, R, 0, 2 * Math.PI);
				g.stroke();
				g.beginPath();
				g.moveTo(cx - R - 6, cy);
				g.lineTo(cx + R + 6, cy);
				g.moveTo(cx, cy - R - 6);
				g.lineTo(cx, cy + R + 6);
				g.stroke();
				if (big) {
					g.fillStyle = '#8c8c8c';
					g.font = FONT;
					g.textAlign = 'left';
					g.textBaseline = 'middle';
					g.fillText('1', cx + R + 8, cy);
					g.fillText('i', cx + 4, cy - R - 10);
					// the law itself, top right
					const bx = W - 200, by = 60, bw = 150, bh = 70;
					g.fillText(`P(X = k), k = 0, …, ${m}`, bx, by - 14);
					p.forEach((q, k) => {
						const h = q / Math.max(...p) * bh;
						g.fillStyle = '#5f5f5f';
						g.fillRect(bx + k * bw / (m + 1), by + bh - h, bw / (m + 1) - 3, h);
					});
					caption(g, H, [`φ(t) = E exp(itX) for t from 0 to 2π, for X on {0, …, ${m}}, then φ², φ³, φ⁵ and φ⁸, the sums of 2, 3, 5 and 8 independent copies.`,
						'A law on the integers brings every curve back to 1 at t = 2π, and |φ| < 1 in between, so the powers shrink towards 0 (205).']);
				}
				const phi = (t, n) => {
					let re = 0, im = 0;
					p.forEach((q, k) => {
						re += q * Math.cos(k * t);
						im += q * Math.sin(k * t);
					});
					const r = Math.hypot(re, im) ** n, a = Math.atan2(im, re) * n;
					return [cx + R * r * Math.cos(a), cy - R * r * Math.sin(a)];
				};
				const dt = big ? 0.03 : 0.05;
				let c = 0, t = 0;
				return () => {
					if (c >= POW.length) return true;
					g.globalCompositeOperation = 'lighter';
					g.strokeStyle = `hsla(${HUE[c]}, 90%, 62%, 0.9)`;
					g.lineWidth = big ? 1.6 : 1;
					g.beginPath();
					let [x, y] = phi(t, POW[c]);
					g.moveTo(x, y);
					for (let s = 1; s <= 12; s++) {
						[x, y] = phi(Math.min(2 * Math.PI, t + dt * s / 12), POW[c]);
						g.lineTo(x, y);
					}
					g.stroke();
					g.globalCompositeOperation = 'source-over';
					t += dt;
					if (t >= 2 * Math.PI) {
						c++;
						t = 0;
					}
					return false;
				};
			},
		},
		// 206: the typewriter, a band that sweeps [0, 1) once a pass and thins
		// each pass, against one ω it hits every pass
		typewriter: {
			name: 'Typewriter, 206',
			about: '206. Xₙ is 1 on a band of width 2⁻ᵏ that sweeps [0, 1) once a pass, so P(Xₙ = 1) → 0 and Xₙ → 0 in probability. The dotted ω is hit once every pass all the same, so Xₙ(ω) never settles and there is no almost sure convergence.',
			make(g, W, H, big) {
				const K = big ? 9 : 7, pad = big ? { l: 30, r: 20, t: 30, b: 62 } : { l: 4, r: 4, t: 6, b: 6 };
				const pw = (W - pad.l - pad.r) / K, h = H - pad.t - pad.b, omega = 0.06 + Math.random() * 0.88, Yw = pad.t + (1 - omega) * h;
				g.fillStyle = '#000';
				g.fillRect(0, 0, W, H);
				g.strokeStyle = '#5a5a5a';
				g.setLineDash([2, 3]);
				g.lineWidth = 1;
				g.beginPath();
				g.moveTo(pad.l, Yw);
				g.lineTo(W - pad.r, Yw);
				g.stroke();
				g.setLineDash([]);
				g.strokeStyle = '#1f1f1f';
				for (let k = 1; k < K; k++) {
					g.beginPath();
					g.moveTo(pad.l + k * pw, pad.t);
					g.lineTo(pad.l + k * pw, pad.t + h);
					g.stroke();
				}
				if (big) {
					g.fillStyle = '#8c8c8c';
					g.font = FONT;
					g.textAlign = 'center';
					g.textBaseline = 'top';
					const sup = n => String(n).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
					for (let k = 0; k < K; k++) g.fillText(k ? `2⁻${sup(k)}` : '1', pad.l + (k + 0.5) * pw, pad.t + h + 6);
					g.textAlign = 'right';
					g.textBaseline = 'middle';
					g.fillText('ω', pad.l - 8, Yw);
					g.fillText('1', pad.l - 8, pad.t);
					g.fillText('0', pad.l - 8, pad.t + h);
					caption(g, H, ['The typewriter of 206 on Ω = [0, 1), ω up the side and n along, each pass given the same width. Under each pass, P(Xₙ = 1).',
						'The band thins, so Xₙ → 0 in probability, yet the dotted ω is hit once every pass, so Xₙ(ω) never settles.']);
				}
				const per = big ? 60 : 40;
				let k = 0, j = 0, acc = 0, hits = 0;
				return () => {
					if (k >= K) return true;
					acc += (2 ** k) / per;
					while (acc >= 1 && k < K) {
						acc -= 1;
						const cw = pw / 2 ** k, x = pad.l + k * pw + j * cw, y1 = pad.t + (1 - j / 2 ** k) * h, y0 = pad.t + (1 - (j + 1) / 2 ** k) * h;
						const hit = omega >= j / 2 ** k && omega < (j + 1) / 2 ** k;
						g.fillStyle = hit ? '#fff2b0' : `hsla(${38 + k * 3}, 95%, ${58 - k * 2}%, 0.95)`;
						g.fillRect(x, y0, Math.max(cw, 0.6), Math.max(y1 - y0, 0.8));
						if (hit) {
							hits++;
							g.fillStyle = '#ffffff';
							g.beginPath();
							g.arc(x + cw / 2, Yw, big ? 3.5 : 2, 0, 7);
							g.fill();
						}
						if (++j >= 2 ** k) {
							j = 0;
							k++;
						}
					}
					if (big) {
						g.fillStyle = '#000';
						g.fillRect(W - 230, 4, 226, 20);
						g.fillStyle = '#c8c8c8';
						g.font = FONT;
						g.textAlign = 'right';
						g.textBaseline = 'top';
						g.fillText(`ω hit ${hits} times, once a pass`, W - 22, 8);
					}
					return false;
				};
			},
		},
		// 212: the exact law of a lazy random walk on a torus from one cell,
		// settling to the uniform law, with six single walks over it
		mixing: {
			name: 'Mixing, 212',
			about: '212. A lazy random walk on a torus is irreducible and aperiodic, so its law settles to the uniform one from any start, and its total variation distance from it falls to 0. The glow is the exact law after n steps from one cell, and the white dots are single walks.',
			make(g, W, H, big) {
				const gw = big ? 96 : 48, gh = big ? 60 : 30, N = gw * gh;
				let p = new Float64Array(N), q = new Float64Array(N);
				const start = Math.floor(Math.random() * N);
				p[start] = 1;
				const walkers = Array.from({ length: 6 }, () => start);
				const off = document.createElement('canvas');
				off.width = gw;
				off.height = gh;
				const og = off.getContext('2d'), img = og.createImageData(gw, gh);
				const STOPS = [[0, 0, 0, 0], [0.28, 11, 26, 74], [0.5, 0, 122, 124], [0.75, 240, 192, 64], [1, 255, 255, 255]];
				const ramp = t => {
					for (let i = 1; i < STOPS.length; i++) {
						if (t > STOPS[i][0]) continue;
						const a = STOPS[i - 1], b = STOPS[i], u = (t - a[0]) / (b[0] - a[0]);
						return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
					}
					return [255, 255, 255];
				};
				const nb = (i, d) => {
					const x = i % gw, y = (i / gw) | 0;
					return d === 0 ? y * gw + (x + 1) % gw : d === 1 ? y * gw + (x + gw - 1) % gw : d === 2 ? ((y + 1) % gh) * gw + x : ((y + gh - 1) % gh) * gw + x;
				};
				const L = Math.log10(N) + 3, tvs = [], plotH = big ? 52 : 0;
				let n = 0, tv = 1;
				return () => {
					if (tv < (big ? 0.01 : 0.02)) return true;
					// faster as it slows, so the end comes in a minute or so
					const spf = 1 + Math.floor(n / (big ? 200 : 250));
					for (let s = 0; s < spf; s++) {
						for (let y = 0; y < gh; y++) {
							const up = ((y + gh - 1) % gh) * gw, dn = ((y + 1) % gh) * gw, row = y * gw;
							for (let x = 0; x < gw; x++) {
								const i = row + x;
								q[i] = 0.5 * p[i] + 0.125 * (p[row + (x + 1) % gw] + p[row + (x + gw - 1) % gw] + p[up + x] + p[dn + x]);
							}
						}
						[p, q] = [q, p];
						n++;
						for (let w = 0; w < walkers.length; w++) if (Math.random() < 0.5) walkers[w] = nb(walkers[w], Math.floor(Math.random() * 4));
					}
					tv = 0;
					for (let i = 0; i < N; i++) tv += Math.abs(p[i] - 1 / N);
					tv /= 2;
					tvs.push([n, tv]);
					for (let i = 0; i < N; i++) {
						const c = ramp(Math.max(0, Math.min(1, (Math.log10(p[i] * N + 1e-12) + 3) / L)));
						img.data[i * 4] = c[0];
						img.data[i * 4 + 1] = c[1];
						img.data[i * 4 + 2] = c[2];
						img.data[i * 4 + 3] = 255;
					}
					og.putImageData(img, 0, 0);
					g.imageSmoothingEnabled = true;
					g.drawImage(off, 0, 0, W, H - plotH);
					g.fillStyle = '#fff';
					walkers.forEach(i => {
						g.beginPath();
						g.arc(((i % gw) + 0.5) * W / gw, (((i / gw) | 0) + 0.5) * (H - plotH) / gh, big ? 2.5 : 1.4, 0, 7);
						g.fill();
					});
					if (big) {
						g.fillStyle = '#000';
						g.fillRect(0, H - plotH, W, plotH);
						caption(g, H, [`A lazy random walk on a ${gw} × ${gh} torus, its exact law after n steps from one cell. Irreducible and aperiodic, it settles to the uniform law (212).`,
							`Total variation distance to uniform after n = ${n.toLocaleString('en-GB')} steps, ${tv.toFixed(3)}. The white dots are six single walks.`]);
						const px = W - 230, pw = 200, py = H - plotH - 70, ph = 56, nMax = Math.max(400, n);
						g.fillStyle = 'rgba(0,0,0,0.6)';
						g.fillRect(px - 8, py - 18, pw + 16, ph + 26);
						g.fillStyle = '#8c8c8c';
						g.fillText('distance to uniform', px, py - 5);
						g.strokeStyle = '#f0c040';
						g.lineWidth = 1.5;
						g.beginPath();
						tvs.forEach(([k, v], j) => {
							const x = px + pw * k / nMax, y = py + ph * (1 - v);
							if (j) g.lineTo(x, y);
							else g.moveTo(x, y);
						});
						g.stroke();
					}
					return false;
				};
			},
		},
	};

	// Random is one saver, picked each time the saver comes on
	function one(kind) {
		const keys = Object.keys(SAVERS);
		return kind === 'random' ? keys[Math.floor(Math.random() * keys.length)] : kind;
	}

	// Runs a saver on a canvas until stopped or the canvas leaves the page,
	// holding a finished run a few seconds before the next; a reader who asks
	// for less motion gets a finished run every nine seconds instead
	function run(canvas, kind, big) {
		kind = one(kind);
		const g = canvas.getContext('2d');
		let raf = 0, timer = 0, step = null, hold = 0, turn = 0;
		function fresh() {
			const dpr = devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
			canvas.width = Math.round(W * dpr);
			canvas.height = Math.round(H * dpr);
			g.setTransform(dpr, 0, 0, dpr, 0, 0);
			hold = 0;
			step = SAVERS[kind].make(g, W, H, big, turn++);
		}
		function frame() {
			if (!canvas.isConnected) return;
			if (step() && ++hold > 170) fresh();
			raf = requestAnimationFrame(frame);
		}
		function still() {
			if (!canvas.isConnected) return;
			fresh();
			for (let i = 0; i < 20000 && !step(); i++);
			timer = setTimeout(still, 9000);
		}
		if (reduce) still();
		else {
			fresh();
			raf = requestAnimationFrame(frame);
		}
		return () => {
			cancelAnimationFrame(raf);
			clearTimeout(timer);
		};
	}

	// A saver over the whole screen until the reader moves, then done
	let showing = false;
	function show(kind, done) {
		if (showing) return;
		showing = true;
		// the same one again after a resize
		kind = one(kind);
		const cover = document.createElement('div');
		cover.className = 'saver-cover';
		cover.innerHTML = '<canvas></canvas>';
		document.body.appendChild(cover);
		let stop = run(cover.firstChild, kind, true);
		const again = () => {
			stop();
			stop = run(cover.firstChild, kind, true);
		};
		const since = performance.now(), EVENTS = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'];
		let from = null;
		function wake(e) {
			// the click or key that started it, and a hand still settling
			if (performance.now() - since < 700) return;
			if (e.type === 'pointermove') {
				if (!from) return (from = [e.clientX, e.clientY]);
				if (Math.hypot(e.clientX - from[0], e.clientY - from[1]) < 8) return;
			}
			e.preventDefault();
			stop();
			EVENTS.forEach(t => document.removeEventListener(t, wake, true));
			removeEventListener('resize', again);
			cover.remove();
			showing = false;
			if (done) done();
		}
		EVENTS.forEach(t => document.addEventListener(t, wake, { capture: true, passive: false }));
		addEventListener('resize', again);
	}

	window.saver = { SAVERS, run, show };
})();
