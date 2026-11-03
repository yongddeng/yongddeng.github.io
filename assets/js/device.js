// device.exe (_programs/device.html): a training script run a line at a time
// in a debugger, VS Code's Dark+ on the left, and on the right the H100
// server it runs on, drawn in 3D, with a timeline floating over its foot.
// Three parts: the machine's links and how long a copy takes on them,
// after copy.exe's engine; the render, which lights the copies a line makes;
// and the program, which runs the scripts and steps through them. A third
// script, serve.py, runs vLLM's engine on the same machine an engine step at
// a time, on scheduler.exe's engine (ServeEngine, loaded before this), in
// sections of its own that the editor, the panels and the timeline ask
// where serve.py differs. All of it runs inside a function, so that a
// window opened again runs it again; three.js 0.160 comes from jsDelivr, its
// add-ons built to share its one copy.
(async function () {
	const THREE_AT = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
	const addon = path => import(THREE_AT + 'examples/jsm/' + path + '/+esm');
	const [THREE, { RoomEnvironment }, { EffectComposer }, { RenderPass }, { GTAOPass },
		{ UnrealBloomPass }, { OutputPass }, { RoundedBoxGeometry }] = await Promise.all([
		import(THREE_AT + '+esm'), addon('environments/RoomEnvironment.js'),
		addon('postprocessing/EffectComposer.js'), addon('postprocessing/RenderPass.js'),
		addon('postprocessing/GTAOPass.js'), addon('postprocessing/UnrealBloomPass.js'),
		addon('postprocessing/OutputPass.js'), addon('geometries/RoundedBoxGeometry.js'),
	]);

	// ---- the machine's links, after copy.exe's engine. A copy streams: every
	// hop of its route runs at once, all at the slowest hop's rate, so its
	// bytes arrive after the latencies at that rate. The units that compute
	// close a route that computes, taking its FLOPs at their peak, so a pass
	// is held by its bytes or its arithmetic: the roofline. Bandwidths are
	// peaks, one way; a latency on the GPU is a load's, in cycles on GH100
	// (Luo et al., 2024) at the 1,830 MHz that the data sheet's 989 TFLOPS
	// imply ----
	const E = (function () {
		const fmt = (v, k = 3) => (+v.toPrecision(k)).toLocaleString('en-GB');
		const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
		function bytes(n) {
			const k = Math.min(UNITS.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(n, 1)) / 10)));
			return fmt(n / 1024 ** k) + ' ' + UNITS[k];
		}
		function time(s) {
			if (s < 1e-6) return fmt(s * 1e9) + ' ns';
			if (s < 1e-3) return fmt(s * 1e6) + ' µs';
			if (s < 1) return fmt(s * 1e3) + ' ms';
			if (s < 120) return fmt(s) + ' s';
			return fmt(s / 60) + ' min';
		}
		const CLOCK = 1.83e9, PEAK = 989.4e12;
		// the DGX H100's host, one Micron 7450 for the SSD, two H100 SXM5s
		// through NVSwitch; and a socket of the host computing for itself,
		// 1,024 bf16 FLOPs a clock a core on AMX (Intel), 56 cores at 2.0 GHz
		const HOPS = {
			nvme: { from: 'ssd', to: 'dram', over: 'PCIe 4.0 ×4', lane: 'SSD', bw: 6.8e9, lat: 80e-6 },
			gds: { from: 'ssd', to: 'hbm', over: 'PCIe, SSD to GPU', lane: 'SSD', bw: 6.8e9, lat: 80e-6 },
			stage: { from: 'dram', to: 'pinned', over: 'CPU copy', lane: 'CPU', bw: 281.6e9 / 2, lat: 107e-9 },
			pcie: { from: 'pinned', to: 'hbm', over: 'PCIe 5.0 ×16', lane: 'PCIe', bw: 63e9, lat: 2e-6 },
			back: { from: 'hbm', to: 'dram', over: 'PCIe 5.0 ×16', lane: 'PCIe', bw: 63e9, lat: 2e-6 },
			nvlink: { from: 'hbm', to: 'hbm1', over: 'NVLink 4', lane: 'NVLink', bw: 450e9, lat: 3e-6 },
			hbm: { from: 'hbm', to: 'l2', over: 'HBM3, 5 stacks', lane: 'HBM', bw: 3.35e12, lat: 479 / CLOCK },
			l2: { from: 'l2', to: 'smem', over: 'L2 to the SMs', lane: 'HBM', bw: 5.5e12, lat: 263 / CLOCK },
			smem: { from: 'smem', to: 'tc', over: 'shared memory',
				lane: 'HBM', bw: 132 * 128 * CLOCK, lat: 29 / CLOCK },
			tc: { from: 'smem', to: 'tc', over: 'bf16 tensor cores', lane: 'Tensor cores', bw: 0, lat: 0 },
			ddr: { from: 'dram', to: 'cores', over: 'DDR5-4400, 8 channels', lane: 'CPU', bw: 281.6e9, lat: 107e-9 },
			amx: { from: 'cores', to: 'amx', over: 'AMX, bf16', lane: 'CPU', bw: 0, lat: 0, peak: 1024 * 56 * 2.0e9 },
		};
		// a copy's hops, each at the slowest's rate, and when it is done; held
		// by the slowest hop, or by its latencies where they take longer
		function lay(c) {
			const ways = key => (typeof c.ways === 'number' ? c.ways : (c.ways || {})[key] || 1);
			const hops = c.route.map(key => ({ key, ways: ways(key),
				bw: HOPS[key].bw * ways(key), lat: HOPS[key].lat }));
			if (c.flops) {
				const on = c.on || 'tc';
				hops.push({ key: on, ways: ways('hbm'),
					bw: (HOPS[on].peak || PEAK) * ways('hbm') * c.n / c.flops, lat: 0 });
			}
			const pace = Math.min(...hops.map(h => h.bw));
			let wait = 0;
			for (const h of hops) {
				wait += h.lat;
				Object.assign(h, { wait, pace, end: wait + c.n / pace });
			}
			const slow = hops.reduce((a, b) => (b.bw < a.bw ? b : a));
			const lat = hops.reduce((a, h) => a + h.lat, 0);
			const held = lat > c.n / slow.pace ? 'latency' : slow.key;
			return { hops, T: hops[hops.length - 1].end, slow, held,
				lane: held === 'latency' ? HOPS[hops[0].key].lane : HOPS[held].lane };
		}
		const copyTime = c => (c.k || 1) * lay(c).T;
		return { HOPS, fmt, bytes, time, lay, copyTime };
	})();

	const H = E.HOPS;
	const root = document.querySelector('.trn');
	const $ = sel => root.querySelector(sel), $$ = sel => [...root.querySelectorAll(sel)];
	const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const view = $('.trn-view'), canvas = $('.trn-gl');

	// ---- the stage ----
	let renderer;
	try {
		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
	} catch (e) {
		view.textContent = 'The render needs WebGL 2, which this browser did not give.';
		throw e;
	}
	renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 0.8;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	// drawn again only as the camera or the line changes, the frame says when:
	// nothing else moves what casts a shadow
	renderer.shadowMap.autoUpdate = false;
	const scene = new THREE.Scene();
	scene.background = new THREE.Color('#08090b');
	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
	const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 10);
	// a low key light, so that the parts a line works stand out of the board
	const KEY = 2.1;
	const key = new THREE.DirectionalLight('#fff3e4', KEY);
	key.castShadow = true;
	key.shadow.mapSize.set(2048, 2048);
	key.shadow.bias = -0.0004;
	const rim = new THREE.DirectionalLight('#9db2ff', 0.45);
	scene.add(key, key.target, rim, rim.target);

	// the colours of the parts, lit, as take 3 lights them on its dark stage
	const ROLE = { CPU: '#e8e8e8', SSD: '#c8b838', PCIe: '#22b8b8',
		NVLink: '#f05a5a', HBM: '#5a7cff', 'Tensor cores': '#e060c8' };
	const roleOf = key => H[key].lane;

	// ---- where things are, in metres: the board's top at y = 0 ----
	const BOARD = { w: 0.62, d: 0.44 };
	const CPU = new THREE.Vector3(-0.17, 0, 0);
	const MODS = [new THREE.Vector3(0.13, 0, -0.1), new THREE.Vector3(0.13, 0, 0.1)];
	const PKG = MODS.map(m => new THREE.Vector3(m.x - 0.015, 0, m.z));
	const SWITCH = new THREE.Vector3(0.262, 0, 0);
	const SSD = new THREE.Vector3(0.03, 0, 0.183); // a 2.5-inch U.3 drive along x, its connector at the left end
	const PSW = new THREE.Vector3(-0.04, 0, 0.13); // the PCIe switch
	const Y = { mod: 0.0061, sub: 0.0077, int: 0.0081, die: 0.0089 };
	const DIE = { w: 0.026, d: 0.031 }; // 806 mm², GH100's 814 near enough
	const HBM = { w: 0.0105, d: 0.0099, x: 0.01945, z: [-0.0105, 0, 0.0105] };
	const STACKS = [[-1, 0], [-1, 1], [-1, 2], [1, 0], [1, 1], [1, 2]]; // the last site unused

	// the die's floorplan, in mm about its centre, x across and z down: HBM
	// PHYs down both sides, I/O along top and foot, L2's two halves across the
	// middle, and eight GPCs of eighteen SMs, four above L2 and four below
	const FLOOR = { phy: 1.8, io: 1.2, l2: 2.0, gap: 0.27, smGap: 0.15 };
	const GPC_W = (DIE.w * 1000 - 2 * FLOOR.phy - 3 * FLOOR.gap) / 4;
	const GPC_D = DIE.d * 500 - FLOOR.io - FLOOR.l2;
	const SM_W = (GPC_W - 2 * FLOOR.smGap) / 3, SM_D = (GPC_D - 5 * FLOOR.smGap) / 6;
	function smRect(g, col, row) {
		const k = g < 4 ? row : 5 - row; // row 5 nearest L2 in both halves
		return {
			x: -DIE.w * 500 + FLOOR.phy + (g % 4) * (GPC_W + FLOOR.gap) + col * (SM_W + FLOOR.smGap),
			z: g < 4 ? -DIE.d * 500 + FLOOR.io + k * (SM_D + FLOOR.smGap) : FLOOR.l2 + k * (SM_D + FLOOR.smGap),
			w: SM_W, d: SM_D,
		};
	}
	// the twelve the H100 SXM5 leaves off, and the one the camera goes into
	const OFF = new Set(['0,0,0', '0,2,5', '1,2,1', '2,0,3', '2,1,5',
		'3,2,2', '4,1,0', '4,0,4', '5,2,3', '6,0,1', '6,2,4', '7,1,2']);
	const PICK = smRect(1, 1, 4);
	const SM = new THREE.Vector3(PKG[0].x + (PICK.x + PICK.w / 2) / 1000,
		Y.die, PKG[0].z + (PICK.z + PICK.d / 2) / 1000);

	// the buses on the board, as polylines in x and z
	const BUS = {
		cpuSw: [[CPU.x + 0.01, 0.03], [CPU.x + 0.01, 0.13], [PSW.x - 0.017, 0.13]],
		swSsd: [[PSW.x, 0.147], [PSW.x, SSD.z], [SSD.x - 0.058, SSD.z]],
		swGpu0: [[PSW.x + 0.017, 0.122], [0.02, 0.122], [0.02, -0.06], [0.04, -0.1], [0.06, -0.1]],
		swGpu1: [[PSW.x + 0.017, 0.14], [0.022, 0.14], [0.048, 0.114], [0.048, 0.1], [0.06, 0.1]],
		nvlink: [[0.2, -0.1], [0.236, -0.1], [SWITCH.x, -0.074], [SWITCH.x, -0.022]],
		nvlink2: [[SWITCH.x, 0.022], [SWITCH.x, 0.074], [0.236, 0.1], [0.2, 0.1]],
	};

	// ---- the textures, drawn on canvases ----
	const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
	function texture(w, h, draw, repeat) {
		const cv = document.createElement('canvas');
		cv.width = w;
		cv.height = h;
		draw(cv.getContext('2d'), w, h);
		const t = new THREE.CanvasTexture(cv);
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = MAX_ANISO;
		if (repeat) {
			t.wrapS = t.wrapT = THREE.RepeatWrapping;
			t.repeat.set(...repeat);
		}
		return t;
	}
	const rand = (() => {
		let s = 7;
		return () => ((s = (s * 16807) % 2147483647) / 2147483647);
	})();
	function grain(cx, w, h, n, light, dark) {
		for (let i = 0; i < n; i++) {
			cx.fillStyle = rand() < 0.5 ? light : dark;
			cx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
		}
	}
	// the board under its solder mask: buses in 45° runs, vias, the planes,
	// and the silkscreen
	const PCB = texture(2480, Math.round(2480 * BOARD.d / BOARD.w), (cx, W, Hh) => {
		const X = x => (x / BOARD.w + 0.5) * W, Z = z => (z / BOARD.d + 0.5) * Hh, S = m => m / BOARD.w * W;
		cx.fillStyle = '#0d3524';
		cx.fillRect(0, 0, W, Hh);
		// copper planes a shade lighter under the mask
		cx.fillStyle = '#10402b';
		for (const [x, z, w, d] of [[-0.29, -0.2, 0.2, 0.08], [0.02, -0.21, 0.27, 0.05],
			[0.02, 0.16, 0.27, 0.05], [-0.06, -0.05, 0.05, 0.1]]) {
			cx.fillRect(X(x), Z(z), S(w), S(d));
		}
		grain(cx, W, Hh, 26000, 'rgba(80,150,110,0.05)', 'rgba(0,0,0,0.08)');
		cx.lineCap = 'round';
		cx.lineJoin = 'round';
		const run = (pts, colour = '#174f37', width = 2.2) => {
			cx.strokeStyle = colour;
			cx.lineWidth = width;
			cx.beginPath();
			cx.moveTo(X(pts[0][0]), Z(pts[0][1]));
			for (const p of pts.slice(1)) cx.lineTo(X(p[0]), Z(p[1]));
			cx.stroke();
		};
		// each DIMM slot fanned out from the socket
		for (const side of [-1, 1]) for (let s = 0; s < 4; s++) {
			const sx = CPU.x + side * (0.062 + s * 0.0105);
			for (let k = 0; k < 14; k++) {
				const z = -0.06 + k * 0.0092, x0 = CPU.x + side * 0.04;
				run([[x0, z * 0.4], [x0 + side * 0.008, z * 0.4], [sx - side * 0.004, z], [sx, z]]);
			}
		}
		// buses, a bundle of traces each
		const bundle = (pts, n, pitch) => {
			for (let k = 0; k < n; k++) {
				const o = (k - (n - 1) / 2) * pitch;
				run(pts.map(([x, z], i) => {
					const [px, pz] = pts[Math.max(0, i - 1)], [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
					const dx = nx - px, dz = nz - pz, L = Math.hypot(dx, dz) || 1;
					return [x - dz / L * o, z + dx / L * o];
				}));
			}
		};
		for (const k of ['cpuSw', 'swGpu0', 'swGpu1']) bundle(BUS[k], 24, 0.0011);
		bundle(BUS.swSsd, 10, 0.001);
		bundle(BUS.nvlink, 30, 0.001);
		bundle(BUS.nvlink2, 30, 0.001);
		// short meanders and stubs in the free board
		for (let i = 0; i < 260; i++) {
			const x = -0.3 + rand() * 0.6, z = -0.21 + rand() * 0.42, L = 0.008 + rand() * 0.03, up = rand() < 0.5;
			run(up ? [[x, z], [x + L, z], [x + L + 0.004, z + 0.004]]
					: [[x, z], [x, z + L], [x + 0.004, z + L + 0.004]], '#13462f', 1.6);
		}
		// vias
		for (let i = 0; i < 2600; i++) {
			const x = rand() * W, z = rand() * Hh, r = 1.6 + rand() * 1.4;
			cx.fillStyle = '#0a2a1c';
			cx.beginPath();
			cx.arc(x, z, r + 1.2, 0, 7);
			cx.fill();
			cx.fillStyle = '#1d5a40';
			cx.beginPath();
			cx.arc(x, z, r * 0.55, 0, 7);
			cx.fill();
		}
		// the silkscreen: outlines and references
		cx.strokeStyle = 'rgba(232, 236, 228, 0.75)';
		cx.fillStyle = 'rgba(232, 236, 228, 0.82)';
		cx.lineWidth = 2;
		cx.font = '600 22px Arial, sans-serif';
		const mark = (x, z, w, d, text) => {
			cx.strokeRect(X(x - w / 2), Z(z - d / 2), S(w), S(d));
			cx.fillText(text, X(x - w / 2), Z(z - d / 2) - 8);
		};
		mark(CPU.x, CPU.z, 0.094, 0.074, 'U1  CPU0');
		MODS.forEach((m, g) => mark(m.x, m.z, 0.146, 0.101, 'J' + (20 + g) + '  GPU' + g));
		mark(SWITCH.x, SWITCH.z, 0.044, 0.044, 'U40 NVSW');
		mark(SSD.x - 0.004, SSD.z, 0.112, 0.078, 'J9 U.3');
		mark(PSW.x, PSW.z, 0.04, 0.04, 'U30 PCIe SW');
		cx.font = '600 15px Arial, sans-serif';
		for (const side of [-1, 1]) {
			for (let s = 0; s < 4; s++) {
				cx.fillText('DIMM ' + 'ABCDEFGH'[(side > 0 ? 4 : 0) + s] + '1',
					X(CPU.x + side * (0.062 + s * 0.0105)) - 22, Z(0.082));
			}
		}
		for (let i = 0; i < 14; i++) cx.fillText('C' + (300 + i * 7), X(-0.29 + rand() * 0.55), Z(-0.2 + rand() * 0.4));
	});
	// silicon as a die shot shows it: PHYs down the sides, I/O top and foot,
	// L2's SRAM across the middle, and the GPCs' SMs, each four partitions over
	// its L1
	const DIE_TEX = texture(1040, 1240, (cx, W, Hh) => {
		const k = W / (DIE.w * 1000), X = x => (x + DIE.w * 500) * k, Z = z => (z + DIE.d * 500) * k;
		cx.fillStyle = '#22242e';
		cx.fillRect(0, 0, W, Hh);
		const lines = (x, z, w, d, step, colour, across) => {
			cx.fillStyle = colour;
			if (across) for (let v = z; v < z + d; v += step) cx.fillRect(X(x), Z(v), w * k, 1);
			else for (let v = x; v < x + w; v += step) cx.fillRect(X(v), Z(z), 1, d * k);
		};
		// HBM PHYs, one block a stack, three a side
		for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
			const x = s < 0 ? -DIE.w * 500 + 0.15 : DIE.w * 500 - FLOOR.phy + 0.15, z = -DIE.d * 500 + 0.6 + i * 10.1;
			cx.fillStyle = '#2d3141';
			cx.fillRect(X(x), Z(z), (FLOOR.phy - 0.3) * k, 9.5 * k);
			lines(x, z, FLOOR.phy - 0.3, 9.5, 0.075, '#3a3f54', true);
		}
		for (const z of [-DIE.d * 500 + 0.15, DIE.d * 500 - FLOOR.io + 0.15]) {
			cx.fillStyle = '#2a2d3b';
			cx.fillRect(X(-11), Z(z), 22 * k, (FLOOR.io - 0.3) * k);
			lines(-11, z, 22, FLOOR.io - 0.3, 0.1, '#353a4c', false);
		}
		// L2: SRAM arrays, a bronze grid either side of the crossbar
		for (const s of [-1, 1]) {
			const x = s < 0 ? -DIE.w * 500 + FLOOR.phy : 0.25, w = DIE.w * 500 - FLOOR.phy - 0.25;
			cx.fillStyle = '#3a3628';
			cx.fillRect(X(x), Z(-FLOOR.l2 + 0.15), w * k, (2 * FLOOR.l2 - 0.3) * k);
			lines(x, -FLOOR.l2 + 0.15, w, 2 * FLOOR.l2 - 0.3, 0.1, '#47422f', true);
			lines(x, -FLOOR.l2 + 0.15, w, 2 * FLOOR.l2 - 0.3, 0.45, '#2a271d', false);
		}
		cx.fillStyle = '#1b1c24';
		cx.fillRect(X(-DIE.w * 500 + FLOOR.phy), Z(-0.25), (DIE.w * 1000 - 2 * FLOOR.phy) * k, 0.5 * k);
		// the SMs
		for (let g = 0; g < 8; g++) for (let col = 0; col < 3; col++) for (let row = 0; row < 6; row++) {
			const r = smRect(g, col, row), nearL2 = g < 4 ? 1 : -1;
			cx.fillStyle = '#2b2f3e';
			cx.fillRect(X(r.x), Z(r.z), r.w * k, r.d * k);
			for (let p = 0; p < 4; p++) {
				const px = r.x + 0.06 + p * (r.w - 0.12) / 4;
				cx.fillStyle = '#353b50';
				cx.fillRect(X(px), Z(r.z + (nearL2 > 0 ? 0.08 : 0.55)),
					((r.w - 0.12) / 4 - 0.05) * k, (r.d - 0.65) * 0.45 * k);
				cx.fillStyle = '#3a3248';
				cx.fillRect(X(px), Z(r.z + (nearL2 > 0 ? 0.08 : 0.55) + (r.d - 0.65) * 0.5),
					((r.w - 0.12) / 4 - 0.05) * k, (r.d - 0.65) * 0.48 * k);
			}
			cx.fillStyle = '#3c382b';
			cx.fillRect(X(r.x + 0.06), Z(nearL2 > 0 ? r.z + r.d - 0.5 : r.z + 0.06), (r.w - 0.12) * k, 0.44 * k);
		}
		grain(cx, W, Hh, 40000, 'rgba(120,130,170,0.06)', 'rgba(0,0,0,0.12)');
	});
	// one SM's blocks: rows of standard cells, and SRAM's finer grid
	const CELLS = texture(256, 256, (cx, W, Hh) => {
		cx.fillStyle = '#5d6478';
		cx.fillRect(0, 0, W, Hh);
		for (let y = 0; y < Hh; y += 8) {
			cx.fillStyle = y % 16 ? '#535a6d' : '#666e84';
			cx.fillRect(0, y, W, 4);
			for (let x = 0; x < W; x += 3 + rand() * 9) {
				cx.fillStyle = rand() < 0.5 ? '#4a5062' : '#717a91';
				cx.fillRect(x, y, 1 + rand() * 4, 4);
			}
		}
	}, [6, 6]);
	const SRAM = texture(256, 256, (cx, W, Hh) => {
		cx.fillStyle = '#6a6250';
		cx.fillRect(0, 0, W, Hh);
		cx.fillStyle = '#5c5545';
		for (let y = 0; y < Hh; y += 3) cx.fillRect(0, y, W, 1);
		for (let x = 0; x < W; x += 4) cx.fillRect(x, 0, 1, Hh);
		cx.fillStyle = '#625a49';
		for (let x = 0; x < W; x += 128) cx.fillRect(x, 0, 3, Hh);
	}, [10, 3]);
	// an HBM stack's side: the base logic die, then eight DRAM dies
	const HBM_SIDE = texture(64, 288, (cx, W, Hh) => {
		for (let i = 0; i < 9; i++) {
			const y = Hh - (i + 1) * 32;
			cx.fillStyle = i === 0 ? '#4b4f5c' : i % 2 ? '#7a7f8c' : '#6c717e';
			cx.fillRect(0, y, W, 32);
			cx.fillStyle = '#2a2c33';
			cx.fillRect(0, y, W, 3);
		}
	});

	// ---- materials ----
	const std = o => new THREE.MeshStandardMaterial(o), phys = o => new THREE.MeshPhysicalMaterial(o);
	const MAT = {
		mask: phys({ map: PCB, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.32, envMapIntensity: 0.2 }),
		edge: std({ color: '#0a1f15', roughness: 0.8 }),
		modMask: phys({ color: '#123a2a', roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
		epoxy: std({ color: '#141519', roughness: 0.5 }),
		plastic: std({ color: '#1e2024', roughness: 0.62 }),
		gold: std({ color: '#d8ab4e', metalness: 1, roughness: 0.24 }),
		nickel: phys({ color: '#c6c9cd', metalness: 1, roughness: 0.22, clearcoat: 0.2 }),
		copper: std({ color: '#c47a4c', metalness: 1, roughness: 0.28 }),
		alu: std({ color: '#cdd1d7', metalness: 1, roughness: 0.45 }),
		substrate: phys({ color: '#2a3329', roughness: 0.46, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
		interposer: phys({ color: '#3d4049', metalness: 0.55, roughness: 0.26 }),
		die: phys({ map: DIE_TEX, metalness: 0.45, roughness: 0.16, clearcoat: 0.5, clearcoatRoughness: 0.08,
			iridescence: 0.85, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 560] }),
		dieSide: std({ color: '#2b2d34', metalness: 0.5, roughness: 0.35 }),
		hbmTop: phys({ color: '#4a4d58', metalness: 0.6, roughness: 0.2, iridescence: 0.5,
			iridescenceIOR: 1.6, emissive: ROLE.HBM, emissiveIntensity: 0 }),
		hbmIdle: phys({ color: '#3b3d46', metalness: 0.6, roughness: 0.28 }),
		hbmSide: std({ map: HBM_SIDE, metalness: 0.45, roughness: 0.38 }),
		cap: std({ color: '#93806a', roughness: 0.55 }),
		inductor: std({ color: '#37393e', roughness: 0.55, metalness: 0.2 }),
		dimm: phys({ color: '#18402d', roughness: 0.5, clearcoat: 0.5 }),
		dram: std({ color: '#141519', roughness: 0.45, emissive: ROLE.CPU, emissiveIntensity: 0 }),
		ssdChip: std({ color: '#16171b', roughness: 0.45, emissive: ROLE.SSD, emissiveIntensity: 0 }),
		tray: std({ color: '#9aa0a7', metalness: 1, roughness: 0.42 }),
		ihs: phys({ color: '#c4c7cb', metalness: 1, roughness: 0.2, emissive: ROLE.CPU, emissiveIntensity: 0 }),
		nvsw: phys({ color: '#3d4049', metalness: 0.55, roughness: 0.24, emissive: ROLE.NVLink, emissiveIntensity: 0 }),
		cells: std({ map: CELLS, roughness: 0.4, metalness: 0.35 }),
		sram: std({ map: SRAM, roughness: 0.35, metalness: 0.45 }),
		core: std({ name: 'core', color: '#4a3b5a', roughness: 0.38,
			metalness: 0.3, emissive: ROLE['Tensor cores'], emissiveIntensity: 0 }),
	};
	// GPU 1's stacks, lit only when it works too
	MAT.hbmTop1 = MAT.hbmTop.clone();

	// ---- building blocks: a box sits on y; many of one shape are instanced ----
	function box(w, h, d, mat, x, y, z, o = {}) {
		const geo = o.round ? new RoundedBoxGeometry(w, h, d, 2, o.round) : new THREE.BoxGeometry(w, h, d);
		const m = new THREE.Mesh(geo, mat);
		m.position.set(x, y + h / 2, z);
		m.castShadow = o.cast !== false;
		m.receiveShadow = true;
		(o.to || scene).add(m);
		return m;
	}
	function many(geo, mat, places, o = {}) {
		const m = new THREE.InstancedMesh(geo, mat, places.length), q = new THREE.Matrix4(),
			r = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
		places.forEach(([x, y, z, ry = 0], i) => m.setMatrixAt(i,
			q.compose(new THREE.Vector3(x, y, z), r.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), s)));
		m.castShadow = o.cast !== false;
		m.receiveShadow = true;
		(o.to || scene).add(m);
		return m;
	}

	// ---- the server board ----
	{
		const top = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.d), MAT.mask);
		top.rotation.x = -Math.PI / 2;
		top.receiveShadow = true;
		scene.add(top);
		box(BOARD.w, 0.0016, BOARD.d, MAT.edge, 0, -0.00162, 0, { cast: false });
		// mounting holes, plated
		many(new THREE.CylinderGeometry(0.0032, 0.0032, 0.0002, 24), MAT.gold,
			[[-0.3, 0.0001, -0.21], [0.3, 0.0001, -0.21], [-0.3, 0.0001, 0.21],
				[0.3, 0.0001, 0.21], [0, 0.0001, -0.21], [0, 0.0001, 0.21]], { cast: false });
	}
	// the CPU: socket, package, lid, retention frame, and its power stages
	box(0.094, 0.003, 0.074, MAT.plastic, CPU.x, 0, CPU.z);
	box(0.0775, 0.0016, 0.0565, MAT.substrate, CPU.x, 0.003, CPU.z);
	box(0.064, 0.0034, 0.05, MAT.ihs, CPU.x, 0.0046, CPU.z, { round: 0.0012 });
	for (const s of [-1, 1]) box(0.006, 0.0042, 0.08, MAT.nickel, CPU.x + s * 0.044, 0, CPU.z);
	many(new RoundedBoxGeometry(0.008, 0.006, 0.008, 2, 0.0008), MAT.inductor,
		[...Array(9)].map((_, i) => [CPU.x - 0.04 + i * 0.01, 0.003, CPU.z - 0.052]));
	many(new THREE.CylinderGeometry(0.003, 0.003, 0.009, 20), MAT.alu,
		[...Array(6)].map((_, i) => [CPU.x - 0.03 + i * 0.012, 0.0045, CPU.z + 0.052]));
	// eight DDR5 RDIMMs flanking it, ten DRAM packages a side, a PMIC each
	const slots = [], dimms = [];
	for (const side of [-1, 1]) for (let s = 0; s < 4; s++) {
		const x = CPU.x + side * (0.062 + s * 0.0105);
		slots.push([x, 0.0035, CPU.z]);
		box(0.0013, 0.031, 0.133, MAT.dimm, x, 0.0042, CPU.z);
		for (const f of [-1, 1]) {
			for (let c = 0; c < 10; c++) {
				dimms.push([x + f * 0.0011, 0.019, CPU.z - 0.058 + c * 0.0118 + (c > 4 ? 0.006 : 0)]);
			}
		}
		for (const l of [-1, 1]) box(0.006, 0.009, 0.004, MAT.plastic, x, 0, CPU.z + l * 0.072);
	}
	many(new THREE.BoxGeometry(0.006, 0.007, 0.142), MAT.plastic, slots);
	many(new RoundedBoxGeometry(0.0009, 0.011, 0.0098, 1, 0.0002), MAT.dram, dimms);
	// the NVMe SSD, a 2.5-inch U.3 drive with its lid off: an aluminium tray, its board,
	// the controller by the connector with its DRAM, and six NAND packages
	box(0.1, 0.0015, 0.07, MAT.tray, SSD.x, 0, SSD.z);
	for (const s of [-1, 1]) {
		box(0.1, 0.011, 0.0015, MAT.tray, SSD.x, 0, SSD.z + s * 0.03425);
		box(0.0015, 0.011, 0.067, MAT.tray, SSD.x + s * 0.04925, 0, SSD.z);
	}
	box(0.094, 0.0012, 0.064, MAT.dimm, SSD.x, 0.0035, SSD.z);
	box(0.008, 0.009, 0.03, MAT.plastic, SSD.x - 0.054, 0, SSD.z);
	box(0.014, 0.0014, 0.014, MAT.ssdChip, SSD.x - 0.03, 0.0047, SSD.z, { round: 0.0003 });
	box(0.006, 0.001, 0.011, MAT.epoxy, SSD.x - 0.03, 0.0047, SSD.z + 0.017, { round: 0.0002 });
	many(new RoundedBoxGeometry(0.016, 0.0014, 0.013, 1, 0.0003), MAT.ssdChip,
		[0, 1, 2].flatMap(i => [-1, 1].map(r => [SSD.x - 0.006 + i * 0.02, 0.0054, SSD.z + r * 0.0125])));
	// the PCIe switch the CPU, the SSD and the GPUs hang off, its own heatsink
	box(0.034, 0.0016, 0.034, MAT.substrate, PSW.x, 0, PSW.z);
	box(0.018, 0.0008, 0.018, MAT.nvsw, PSW.x, 0.0016, PSW.z);
	box(0.028, 0.002, 0.028, MAT.copper, PSW.x, 0.0024, PSW.z);
	many(new THREE.BoxGeometry(0.0006, 0.012, 0.028), MAT.alu,
		[...Array(11)].map((_, i) => [PSW.x - 0.0125 + i * 0.0025, 0.0104, PSW.z]));
	// NVSwitch, its own small heatsink
	box(0.04, 0.0016, 0.04, MAT.substrate, SWITCH.x, 0, SWITCH.z);
	box(0.022, 0.0008, 0.022, MAT.nvsw, SWITCH.x, 0.0016, SWITCH.z);
	box(0.034, 0.002, 0.034, MAT.copper, SWITCH.x, 0.0024, SWITCH.z);
	many(new THREE.BoxGeometry(0.0006, 0.018, 0.034), MAT.alu,
		[...Array(14)].map((_, i) => [SWITCH.x - 0.0156 + i * 0.0024, 0.0134, SWITCH.z]));
	// a dark floor under the board, to cast onto
	{
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8),
			std({ color: '#060708', roughness: 0.95, envMapIntensity: 0.1 }));
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -0.03;
		floor.receiveShadow = true;
		scene.add(floor);
	}
	// small parts strewn as a board has them
	{
		const caps = [];
		for (let i = 0; i < 420; i++) {
			const x = -0.3 + rand() * 0.6, z = -0.21 + rand() * 0.42;
			if (Math.abs(x - CPU.x) < 0.11 && Math.abs(z - CPU.z) < 0.08) continue;
			if (x > 0.05 && x < 0.21 && Math.abs(Math.abs(z) - 0.1) < 0.055) continue;
			if (Math.abs(x - SWITCH.x) < 0.03 && Math.abs(z) < 0.03) continue;
			if (Math.abs(x - PSW.x) < 0.03 && Math.abs(z - PSW.z) < 0.03) continue;
			if (Math.abs(x - SSD.x + 0.004) < 0.06 && Math.abs(z - SSD.z) < 0.042) continue;
			caps.push([x, 0.0003, z, rand() < 0.5 ? 0 : Math.PI / 2]);
		}
		many(new THREE.BoxGeometry(0.0016, 0.0008, 0.0008), MAT.cap, caps, { cast: false });
	}

	// ---- the modules: SXM5 boards on mezzanine connectors, the package
	// toward one end, power stages along the other, and a heatsink that lifts
	// away as the camera comes in ----
	const sinks = [];
	MODS.forEach((m, g) => {
		for (const s of [-1, 1]) box(0.06, 0.0045, 0.012, MAT.plastic, m.x + s * 0.03, 0, m.z + 0.03);
		box(0.14, 0.0016, 0.095, MAT.modMask, m.x, Y.mod - 0.0016, m.z);
		many(new RoundedBoxGeometry(0.0065, 0.0045, 0.0065, 2, 0.0006), MAT.inductor,
			[...Array(7)].map((_, i) => [m.x + 0.05, Y.mod + 0.00225, m.z - 0.039 + i * 0.013]));
		many(new THREE.BoxGeometry(0.0016, 0.0008, 0.0008), MAT.cap,
			[...Array(60)].map((_, i) => [m.x + 0.034 + (i % 4) * 0.0035, Y.mod + 0.0004,
					m.z - 0.04 + Math.floor(i / 4) * 0.0055]), { cast: false });
		const p = PKG[g];
		box(0.068, 0.0016, 0.056, MAT.substrate, p.x, Y.mod, p.z);
		// the substrate's capacitors in rings about the interposer
		const caps = [];
		for (let i = 0; i < 46; i++) {
			for (const s of [-1, 1]) caps.push([p.x - 0.03 + i * 0.0013, Y.sub + 0.0003, p.z + s * 0.0245]);
		}
		for (let i = 0; i < 30; i++) {
			for (const s of [-1, 1]) {
				caps.push([p.x + s * 0.031, Y.sub + 0.0003, p.z - 0.019 + i * 0.0013, Math.PI / 2]);
			}
		}
		many(new THREE.BoxGeometry(0.001, 0.0006, 0.0005), MAT.cap, caps, { cast: false });
		box(0.054, 0.0004, 0.036, MAT.interposer, p.x, Y.sub, p.z);
		box(DIE.w, Y.die - Y.int, DIE.d,
			[MAT.dieSide, MAT.dieSide, MAT.die, MAT.dieSide, MAT.dieSide, MAT.dieSide], p.x, Y.int, p.z);
		STACKS.forEach(([s, i], k) => {
			const top = k === 5 ? MAT.hbmIdle : g ? MAT.hbmTop1 : MAT.hbmTop;
			box(HBM.w, Y.die - Y.int, HBM.d, [MAT.hbmSide, MAT.hbmSide, top, MAT.hbmSide, MAT.hbmSide, MAT.hbmSide],
				p.x + s * HBM.x, Y.int, p.z + HBM.z[i]);
		});
		// the heatsink: a copper vapour chamber, fins over it
		const sink = new THREE.Group();
		box(0.13, 0.004, 0.09, MAT.copper, m.x, Y.die, m.z, { to: sink });
		many(new THREE.BoxGeometry(0.0007, 0.046, 0.088), MAT.alu,
			[...Array(44)].map((_, i) => [m.x - 0.0625 + i * 0.0029, Y.die + 0.004 + 0.023, m.z]), { to: sink });
		scene.add(sink);
		sinks.push(sink);
	});

	// ---- one SM in relief over its place on the die: four partitions, each
	// its register file, its warp scheduler and its tensor core, over the L1
	// and shared memory they share, on the side towards L2 ----
	const smGroup = new THREE.Group();
	{
		const mm = v => v / 1000, w = PICK.w, d = PICK.d, x0 = SM.x, z0 = SM.z;
		box(mm(w), mm(0.012), mm(d), MAT.cells, x0, Y.die, z0, { to: smGroup });
		const pw = (w - 0.16) / 4;
		for (let p = 0; p < 4; p++) {
			const x = x0 + mm(-w / 2 + 0.08 + pw * (p + 0.5));
			box(mm(pw - 0.05), mm(0.03), mm(0.5), MAT.cells, x,
				Y.die + mm(0.012), z0 + mm(-d / 2 + 0.33), { to: smGroup });
			box(mm(pw - 0.05), mm(0.02), mm(0.1), MAT.dieSide, x,
				Y.die + mm(0.012), z0 + mm(-d / 2 + 0.66), { to: smGroup });
			box(mm(pw - 0.05), mm(0.05), mm(0.52), MAT.core, x,
				Y.die + mm(0.012), z0 + mm(-d / 2 + 1.0), { to: smGroup });
		}
		box(mm(w - 0.16), mm(0.04), mm(0.42), MAT.sram, x0, Y.die + mm(0.012), z0 + mm(d / 2 - 0.3), { to: smGroup });
		smGroup.traverse(o => {
			if (!o.material) return;
			o.material = o.material.clone();
			o.material.transparent = true;
		});
		scene.add(smGroup);
	}
	// every SM that is on, a glow over it as busy as the tensor cores are
	const SMS = [];
	for (let g = 0; g < 8; g++) {
		for (let col = 0; col < 3; col++) {
			for (let row = 0; row < 6; row++) if (!OFF.has(g + ',' + col + ',' + row)) SMS.push(smRect(g, col, row));
		}
	}
	const glowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	const smGlow = new THREE.InstancedMesh(glowGeo,
		new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending,
			depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), SMS.length * 2);
	{
		const q = new THREE.Matrix4();
		PKG.forEach((p, g) => SMS.forEach((r, i) => {
			q.makeScale(r.w / 1000, 1, r.d / 1000)
				.setPosition(p.x + (r.x + r.w / 2) / 1000, Y.die + 0.000004, p.z + (r.z + r.d / 2) / 1000);
			smGlow.setMatrixAt(g * SMS.length + i, q);
			smGlow.setColorAt(g * SMS.length + i, new THREE.Color(0, 0, 0));
		}));
		scene.add(smGlow);
	}

	// ---- the links: the buses on the board as copper strips that light, and
	// a path for the bytes on every link at every scale ----
	const lines = {}; // a hop's paths: { curve, size }, second if GPU 1's
	function path(hop, pts, size, o = {}) {
		const v = pts.map(p => new THREE.Vector3(...p));
		let curve;
		if (o.straight) {
			curve = new THREE.CurvePath();
			for (let i = 1; i < v.length; i++) curve.add(new THREE.LineCurve3(v[i - 1], v[i]));
		} else curve = new THREE.CatmullRomCurve3(v, false, 'centripetal');
		(lines[hop] = lines[hop] || []).push({ curve, size, ...o });
	}
	const strips = {}; // a bus's strip material, lit in the colour of the hop on it
	function strip(bus, lanes, pitch, width) {
		const pts = BUS[bus],
			mat = std({ color: '#2a7d58', roughness: 0.35, metalness: 0.6, emissive: '#000000', emissiveIntensity: 0 });
		for (let k = 0; k < lanes; k++) {
			const off = (k - (lanes - 1) / 2) * pitch;
			for (let i = 1; i < pts.length; i++) {
				const [ax, az] = pts[i - 1], [bx, bz] = pts[i],
					L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
				const m = new THREE.Mesh(new THREE.BoxGeometry(L + width, 0.00004, width), mat);
				m.position.set((ax + bx) / 2 + nx * off, 0.00003, (az + bz) / 2 + nz * off);
				m.rotation.y = -Math.atan2(bz - az, bx - ax);
				m.receiveShadow = true;
				scene.add(m);
			}
		}
		strips[bus] = mat;
	}
	for (const bus of ['cpuSw', 'swGpu0', 'swGpu1']) strip(bus, 8, 0.0016, 0.0007);
	strip('swSsd', 4, 0.0016, 0.0007);
	strip('nvlink', 10, 0.0016, 0.0007);
	strip('nvlink2', 10, 0.0016, 0.0007);
	// which buses each hop crosses on the board
	const ON_BUS = { nvme: ['swSsd', 'cpuSw'], pcie: ['cpuSw', 'swGpu0'],
		back: ['cpuSw', 'swGpu0'], gds: ['swSsd', 'swGpu0'], nvlink: ['nvlink', 'nvlink2'] };
	// the board's routes in 3D: a run of straight lines, lifted off the board
	const lift = pts => pts.map(([x, z]) => [x, 0.0012, z]);
	const DIMM = [CPU.x + 0.0725, 0.03, CPU.z - 0.02], CPU_TOP = [CPU.x + 0.01, 0.0095, CPU.z + 0.01],
		SW_TOP = [PSW.x, 0.0045, PSW.z], SSD_CTL = [SSD.x - 0.03, 0.0068, SSD.z],
		SSD_PIN = [SSD.x - 0.054, 0.005, SSD.z];
	const HOST = [DIMM, CPU_TOP, ...lift(BUS.cpuSw), SW_TOP, ...lift(BUS.swGpu0)];
	path('pcie', HOST, 0.0024, { straight: true });
	path('pcie', [DIMM, CPU_TOP, ...lift(BUS.cpuSw), SW_TOP, ...lift(BUS.swGpu1)],
		0.0024, { straight: true, second: true });
	path('back', HOST.slice().reverse(), 0.0024, { straight: true });
	path('nvme',
		[SSD_CTL, SSD_PIN, ...lift(BUS.swSsd.slice().reverse()), SW_TOP,
			...lift(BUS.cpuSw.slice().reverse()), CPU_TOP, DIMM], 0.0024, { straight: true });
	path('gds', [SSD_CTL, SSD_PIN, ...lift(BUS.swSsd.slice().reverse()), SW_TOP, ...lift(BUS.swGpu0)],
		0.0024, { straight: true });
	path('nvlink', lift(BUS.nvlink.concat(BUS.nvlink2)), 0.0024, { straight: true });
	// DRAM to the CPU and back again: a copy the CPU makes in host memory
	for (const side of [-1, 1]) {
		path('stage',
			[[CPU.x + side * 0.065, 0.034, CPU.z - 0.03], [CPU.x + side * 0.03, 0.02, CPU.z],
				[CPU.x + side * 0.065, 0.034, CPU.z + 0.03]], 0.0022);
	}
	// and the cores reading it as they compute: DRAM into the CPU
	for (const side of [-1, 1]) {
		for (const z of [-0.04, 0.04]) {
			path('ddr', [[CPU.x + side * 0.078, 0.034, CPU.z + z], [CPU.x + side * 0.02, 0.016, CPU.z + z / 3]],
				0.0022);
		}
	}
	// on each module, PCIe in from the edge to the die's I/O
	{
		const p = PKG[0],
			IN = [[MODS[0].x - 0.07, Y.mod + 0.0006, MODS[0].z], [p.x - 0.03, Y.mod + 0.0006, p.z - 0.022],
				[p.x - 0.012, Y.sub + 0.0008, p.z - 0.026], [p.x, Y.die + 0.0004, p.z - 0.0158]];
		for (const hop of ['pcie', 'gds']) path(hop, IN, 0.0007);
		path('back', IN.slice().reverse(), 0.0007);
	}
	// HBM: every active stack to its PHYs across the interposer, both GPUs
	PKG.forEach((p, g) => STACKS.slice(0, 5).forEach(([s, i]) => {
		const z = p.z + HBM.z[i];
		path('hbm',
			[[p.x + s * HBM.x, Y.die + 0.0001, z], [p.x + s * 0.0158, Y.die + 0.0009, z],
				[p.x + s * 0.0125, Y.die + 0.0001, z]], 0.00042, { second: g === 1 });
	}));
	// on the die: from the PHYs into L2, and from L2 to the SM
	for (const s of [-1, 1]) for (const i of [0, 1, 2]) {
		const p = PKG[0], z = p.z + HBM.z[i];
		path('l2',
			[[p.x + s * 0.0118, Y.die + 0.00002, z], [p.x + s * 0.0085, Y.die + 0.00012, p.z + (z - p.z) * 0.3],
				[p.x + s * 0.004, Y.die + 0.00004, p.z]], 0.00011);
	}
	for (const s of [-1, 1]) {
		path('l2',
			[[PKG[0].x + s * 0.004, Y.die + 0.00004, PKG[0].z],
				[(PKG[0].x + s * 0.004 + SM.x) / 2, Y.die + 0.0003, (PKG[0].z + SM.z) / 2],
				[SM.x, Y.die + 0.00006, SM.z + PICK.d / 2000]], 0.00009);
	}
	// in the SM: from L1 and shared memory to each tensor core
	for (let p = 0; p < 4; p++) {
		const x = SM.x + (-PICK.w / 2 + 0.08 + (PICK.w - 0.16) / 4 * (p + 0.5)) / 1000;
		path('smem',
			[[x, Y.die + 0.00006, SM.z + (PICK.d / 2 - 0.3) / 1000],
				[x, Y.die + 0.00014, SM.z + (-PICK.d / 2 + 1.35) / 1000],
				[x, Y.die + 0.00007, SM.z + (-PICK.d / 2 + 1.0) / 1000]], 0.000022);
	}

	// ---- the camera: five places, and the distance between them on a log;
	// where it looks, from where, follow from how far it is ----
	const PLACES = [
		{ level: 'server', at: new THREE.Vector3(0.0, 0, 0.03), d: 1.12, az: -0.6, el: 0.82 },
		{ level: 'module', at: new THREE.Vector3(MODS[0].x, 0.006, MODS[0].z), d: 0.3, az: -0.46, el: 0.86 },
		{ level: 'package', at: new THREE.Vector3(PKG[0].x, 0.0084, PKG[0].z), d: 0.095, az: -0.36, el: 0.92 },
		{ level: 'die', at: new THREE.Vector3(PKG[0].x, Y.die, PKG[0].z), d: 0.043, az: -0.26, el: 1.04 },
		{ level: 'sm', at: new THREE.Vector3(SM.x, Y.die, SM.z + 0.0001), d: 0.0042, az: -0.42, el: 0.8 },
	];
	const NEAR = PLACES[PLACES.length - 1].d * 0.55;
	let d = PLACES[0].d, turn = { az: 0, el: 0 }, flight = null;
	// in a pane near square or taller than wide the stage stands upright, the
	// board's long side up the pane, and the server is seen from low off its
	// corner, swung round, the board raised a little and to the right, clear of
	// the panel over its corner; in a wide one it lies across. The server is
	// framed to fill the pane either way
	const UPRIGHT = { az: -(Math.PI / 2 - 0.6), swing: 0.45, el: -0.19, at: new THREE.Vector3(-0.035, 0, -0.045) };
	let upright = 1, uprightTo = 1;
	function frameServer(aspect) {
		uprightTo = aspect < 1.3 ? 1 : 0;
		if (REDUCED) upright = uprightTo;
		const was = PLACES[0].d, to = uprightTo ? Math.max(1.4, 1.0 / aspect) : Math.max(0.95, 1.45 / aspect);
		PLACES[0].d = to;
		if (flight && flight.to === was) flight.to = to;
		else if (!flight && Math.abs(Math.log(d / was)) < 0.08) d = to;
	}
	const smooth = (a, b, v) => {
		const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
		return u * u * (3 - 2 * u);
	};
	function pose(dist) {
		let i = 0;
		while (i < PLACES.length - 2 && dist < PLACES[i + 1].d) i++;
		const p = PLACES[i], q = PLACES[i + 1];
		const lin = Math.min(1, Math.max(0, (p.d - dist) / (p.d - q.d)));
		const log = Math.min(1, Math.max(0, Math.log(p.d / dist) / Math.log(p.d / q.d)));
		const at = p.at.clone().lerp(q.at, smooth(0, 1, lin));
		if (i === 0) at.addScaledVector(UPRIGHT.at, upright * (1 - smooth(0, 1, lin)));
		// the swing and the lower eye are the server's own, gone by the module
		const own = i === 0 ? upright * (1 - log) : 0;
		return { at, az: p.az + (q.az - p.az) * log + upright * UPRIGHT.az + own * UPRIGHT.swing,
			el: p.el + (q.el - p.el) * log + own * UPRIGHT.el };
	}
	const levelOf = dist => PLACES.reduce((a,
		b) => (Math.abs(Math.log(dist / b.d)) < Math.abs(Math.log(dist / a.d)) ? b : a)).level;
	function fly(level) {
		const to = PLACES.find(p => p.level === level).d;
		if (REDUCED) {
			d = to;
			return;
		}
		flight = { from: d, to, t: 0, span: 0.6 + 0.35 * Math.abs(Math.log10(d / to)) };
	}
	const LIGHT = new THREE.Vector3(0.45, 1, 0.32).normalize(), RIM = new THREE.Vector3(-0.6, 0.5, -0.7).normalize();
	const UP = new THREE.Vector3(0, 1, 0), LIT = new THREE.Vector3();
	function aim(dt) {
		upright += (uprightTo - upright) * Math.min(1, dt * 3);
		// settled, so that a still camera is still to the last bit
		if (Math.abs(uprightTo - upright) < 1e-4) upright = uprightTo;
		if (flight) {
			flight.t += dt;
			const u = Math.min(1, flight.t / flight.span), s = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
			d = Math.exp(Math.log(flight.from) + (Math.log(flight.to) - Math.log(flight.from)) * s);
			if (u >= 1) flight = null;
		}
		const v = pose(d), el = Math.min(1.45, Math.max(0.15, v.el + turn.el)), az = v.az + turn.az;
		camera.position.set(v.at.x + d * Math.cos(el) * Math.sin(az),
			v.at.y + d * Math.sin(el), v.at.z + d * Math.cos(el) * Math.cos(az));
		camera.near = d * 0.01;
		camera.far = d * 30;
		camera.updateProjectionMatrix();
		camera.lookAt(v.at);
		// the lights turn with the stage
		key.position.copy(v.at).addScaledVector(LIT.copy(LIGHT).applyAxisAngle(UP, upright * UPRIGHT.az), d * 4);
		key.target.position.copy(v.at);
		// the key light's shadow framed on what is in view
		const sc = key.shadow.camera, r = d * 0.9;
		Object.assign(sc, { left: -r, right: r, top: r, bottom: -r, near: d * 0.5, far: d * 9 });
		sc.updateProjectionMatrix();
		key.shadow.normalBias = d * 0.0012;
		rim.position.copy(v.at).addScaledVector(LIT.copy(RIM).applyAxisAngle(UP, upright * UPRIGHT.az), d * 4);
		rim.target.position.copy(v.at);
		// the heatsinks lift away from the module down; the SM comes up from the die
		const lift = smooth(Math.log(0.6), Math.log(0.28), Math.log(d));
		sinks.forEach((s, g) => {
			// up, and back from the board's middle, out of the camera's way
			s.position.set(0, lift * 0.1, (g ? 1 : -1) * lift * 0.13);
			s.visible = d > 0.03;
			s.traverse(o => { o.castShadow = lift < 0.05; });
		});
		const rise = smooth(Math.log(0.02), Math.log(0.008), Math.log(d));
		smGroup.visible = rise > 0.01;
		smGroup.traverse(o => o.material && (o.material.opacity = rise));
		gtao.updateGtaoMaterial({ radius: d * 0.035 });
	}

	// ---- the labels, each at its place for a span of distances ----
	const tagBox = $('.trn-tags'), tags = [];
	// a label, and what it says while serve.py is the tab: its own words, or
	// nothing where the part plays no part in serving
	function tag(text, sub, pos, near, far, part, serve = [text, sub]) {
		const el = document.createElement('div');
		el.className = 'trn-tag';
		tagBox.append(el);
		tags.push({ el, pos: new THREE.Vector3(...pos), near, far, part, train: [text, sub], serve });
	}
	// the labels as the tab has them
	function relabel(serve) {
		for (const t of tags) {
			const [text, sub] = (serve ? t.serve : t.train) || [];
			t.off = !text;
			if (text) t.el.innerHTML = text + (sub ? '<span>' + sub + '</span>' : '');
		}
	}
	const P0 = PKG[0];
	tag('CPU', 'Xeon 8480C, one of two', [CPU.x, 0.012, CPU.z], 0.4, 2,
		['stage', 'amx', 'ddr'], ['CPU', 'Xeon 8480C: the batching']);
	tag('DDR5 RDIMMs', '281.6 GB/s a socket', [CPU.x - 0.09, 0.04, CPU.z - 0.07], 0.4, 2, ['stage', 'ddr'], null);
	tag('NVMe SSD', 'the files in /data, 6.8 GB/s read', [SSD.x + 0.035, 0.012, SSD.z + 0.022], 0.4, 2, 'nvme', null);
	tag('PCIe switch', 'the CPU, the SSD and the GPUs on it',
		[PSW.x - 0.01, 0.024, PSW.z + 0.012], 0.4, 2, 'gds', null);
	tag('H100 · GPU 0', 'SXM5', [MODS[0].x, 0.065, MODS[0].z], 0.4, 2, null, ['H100 · GPU 0', 'half of every layer']);
	tag('H100 · GPU 1', 'SXM5', [MODS[1].x, 0.065, MODS[1].z], 0.4, 2, null, ['H100 · GPU 1', 'the other half']);
	tag('NVSwitch', 'NVLink 4, 450 GB/s a GPU each way', [SWITCH.x, 0.024, SWITCH.z],
		0.4, 2, 'nvlink', ['NVSwitch', 'the halves summed, 450 GB/s a GPU']);
	tag('PCIe 5.0 ×16', '63 GB/s each way', [0.02, 0.002, 0.03], 0.4, 2, 'pcie', null);
	tag('Power stages', 'the module’s own', [MODS[0].x + 0.05, 0.012, MODS[0].z - 0.035], 0.13, 0.42);
	tag('Heatsink', 'lifted off the module', [MODS[0].x - 0.04, 0.16, MODS[0].z - 0.16], 0.16, 0.42);
	tag('GH100 die', '814 mm², 80 billion transistors', [P0.x, Y.die + 0.0004, P0.z - 0.004], 0.055, 0.14);
	tag('HBM3 stack', '16 GB, eight DRAM dies on a base die', [P0.x - HBM.x, Y.die + 0.0004, P0.z + HBM.z[0]],
		0.055, 0.14, 'hbm', ['HBM3 stack', '16 GB: weights, then the KV cache']);
	tag('Sixth site', 'not used on the SXM5', [P0.x + HBM.x, Y.die + 0.0004, P0.z + HBM.z[2]], 0.055, 0.14);
	tag('Silicon interposer', 'CoWoS', [P0.x + 0.021, Y.int, P0.z - 0.017], 0.055, 0.14);
	tag('Decoupling capacitors', '', [P0.x - 0.022, Y.sub + 0.0006, P0.z + 0.0245], 0.055, 0.16);
	tag('L2 cache', '50 MB in two halves', [P0.x - 0.007, Y.die + 0.0001, P0.z], 0.013, 0.06, 'l2');
	tag('GPC', '18 SMs, 9 TPCs',
		[P0.x + (smRect(2, 1, 0).x + 0.85) / 1000, Y.die + 0.0001, P0.z + smRect(2, 1, 0).z / 1000], 0.013, 0.06);
	tag('HBM PHYs', 'the memory interface', [P0.x - 0.0122, Y.die + 0.0001, P0.z - 0.012], 0.013, 0.06, 'hbm');
	tag('One SM', 'of 132 on, 144 on the full die', [SM.x, Y.die + 0.0001, SM.z - PICK.d / 2000], 0.013, 0.06);
	tag('Tensor core', 'one a partition, four an SM',
		[SM.x + (PICK.w / 2 - 0.08 - (PICK.w - 0.16) / 8) / 1000, Y.die + 0.00007, SM.z + (-PICK.d / 2 + 1.0) / 1000],
		0.0015, 0.012, 'tc');
	tag('Register file', '64 KB a partition',
		[SM.x + (-PICK.w / 2 + 0.08 + (PICK.w - 0.16) / 8) / 1000, Y.die + 0.00005, SM.z + (-PICK.d / 2 + 0.33) / 1000],
		0.0015, 0.012);
	tag('L1 and shared memory', '256 KB, up to 228 KB shared',
		[SM.x, Y.die + 0.00006, SM.z + (PICK.d / 2 - 0.3) / 1000], 0.0015, 0.012, 'smem');
	relabel(false);
	const V = new THREE.Vector3();
	function place() {
		const W = view.clientWidth, Hh = view.clientHeight, ld = Math.log(d), shown = [];
		for (const t of tags) {
			// fully shown inside its span, fading over a fifth of a power of ten past it
			const fade = Math.min(smooth(Math.log(t.near) - 0.45, Math.log(t.near), ld),
				1 - smooth(Math.log(t.far), Math.log(t.far) + 0.45, ld));
			V.copy(t.pos).project(camera);
			const show = !t.off && fade > 0.02 && V.z < 1 && Math.abs(V.x) < 1.1 && Math.abs(V.y) < 1.1;
			t.el.style.visibility = show ? 'visible' : 'hidden';
			if (!show) continue;
			t.el.style.opacity = fade.toFixed(2);
			t.x = (V.x + 1) / 2 * W;
			t.y = (1 - V.y) / 2 * Hh;
			t.el.style.left = t.x.toFixed(1) + 'px';
			t.el.style.top = t.y.toFixed(1) + 'px';
			const part = [].concat(t.part || []).find(p => on.has(p));
			t.el.classList.toggle('lit', !!part);
			if (part) t.el.style.setProperty('--role', ROLE[roleOf(part)]);
			if (fade > 0.3) shown.push(t);
		}
		// a tag that would cover another rises over it on a longer leader, the
		// lowest on the view placed first; all measured before any moves, so
		// that the page is laid out once
		for (const t of shown) [t.w, t.h] = [t.el.offsetWidth, t.el.offsetHeight];
		const boxes = [];
		for (const t of shown.sort((a, b) => b.y - a.y)) {
			const w = t.w, h = t.h, x = Math.min(W - w / 2 - 4, Math.max(w / 2 + 4, t.x)), l = x - w / 2, r = x + w / 2;
			let foot = t.y - 10;
			for (let hit = true; hit;) {
				hit = false;
				for (const b of boxes) if (l < b.r + 4 && r > b.l - 4 && foot > b.top - 3 && foot - h < b.foot + 3) {
					foot = b.top - 3;
					hit = true;
				}
			}
			boxes.push({ l, r, top: foot - h, foot });
			t.el.style.left = x.toFixed(1) + 'px';
			t.el.style.setProperty('--shift', (t.x - x).toFixed(1) + 'px');
			t.el.style.setProperty('--rise', (t.y - 10 - foot).toFixed(1) + 'px');
		}
		// the scale nearest, pressed
		const level = levelOf(d);
		for (const b of crumbs.children) b.classList.toggle('on', b.dataset.level === level);
	}

	// ---- what is shown: the line's copies, each hop lit with the places at
	// either end of it, and how busy it keeps the tensor cores and HBM; a new
	// line marks the frame to be drawn whole again ----
	let busy = { tc: 0, hbm: 0 }, on = new Map(), ends = new Set(), two = false, dirty = true;
	function show(copies) {
		dirty = true;
		on = new Map();
		ends = new Set();
		busy = { tc: 0, hbm: 0 };
		// a copy may say how busy it keeps its link, where that is not its
		// pace, as serve.py's all-reduces fill only some of a step
		for (const c of copies) for (const h of E.lay(c).hops) {
			if (c.util !== undefined) h.util = c.util;
			on.has(h.key) || on.set(h.key, h);
			ends.add(H[h.key].from).add(H[h.key].to);
		}
		// GPU 1 works too when a copy goes to both GPUs
		two = copies.some(c => c.ways > 1);
		const main = copies[0];
		if (!main) return;
		const hops = E.lay(main).hops, pace = hops[0].pace,
			tc = hops.find(h => h.key === 'tc'), hb = hops.find(h => h.key === 'hbm');
		busy = { tc: tc ? pace / tc.bw : 0, hbm: hb ? pace / hb.bw : 0 };
	}
	const crumbs = $('.trn-crumbs');
	// each scale named, and what is in view there on its title
	const SCALE = { server: ['server', 'two GPUs, a CPU, a switch'],
		module: ['module', 'an SXM5 board'], package: ['package', 'the die, six HBM sites'],
		die: ['die', 'GH100, 814 mm²'], sm: ['SM', 'one of 132'] };
	crumbs.innerHTML = PLACES.map(p => '<button type="button" data-level="' + p.level
			+ '" title="' + SCALE[p.level][1] + '">' + SCALE[p.level][0] + '</button>').join('');
	for (const b of crumbs.children) b.addEventListener('click', () => fly(b.dataset.level));

	// ---- the bytes: glowing pellets on the chosen action's paths, as many as
	// each link is busy, bright enough to bloom ----
	const MAXP = 2400;
	const pellets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 10, 8),
		new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAXP);
	pellets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	pellets.frustumCulled = false;
	for (let i = 0; i < MAXP; i++) pellets.setColorAt(i, new THREE.Color(0, 0, 0));
	scene.add(pellets);
	const Q = new THREE.Matrix4(), PT = new THREE.Vector3(), HOT = new THREE.Color(),
		GLOW = new THREE.Color(), TC = new THREE.Color(ROLE['Tensor cores']);
	function flow(t) {
		let n = 0;
		for (const [hop, list] of Object.entries(lines)) {
			const h = on.get(hop);
			if (!h) continue;
			const util = Math.max(0.08, Math.min(1, h.util ?? h.pace / h.bw));
			HOT.set(ROLE[roleOf(hop)]).multiplyScalar(5);
			for (const l of list) {
				if (l.second && h.ways < 2) continue;
				// a pellet shrinks as the camera comes in, to a quarter of its own size
				const size = Math.min(l.size, Math.max(l.size * 0.25, d * 0.004)), count = Math.round(6 + 26 * util);
				for (let j = 0; j < count && n < MAXP; j++, n++) {
					// short of the end: a path of straight runs finds no point past its length
					const u = Math.min(0.9995, (t * 0.32 + j / count) % 1);
					l.curve.getPointAt(u, PT);
					Q.makeScale(size, size, size).setPosition(PT);
					pellets.setMatrixAt(n, Q);
					pellets.setColorAt(n, HOT);
				}
			}
		}
		// the board's buses lit in the colour of the hop that crosses them
		const light = (bus, hop) => {
			const util = on.get(hop).util;
			strips[bus].emissive.set(ROLE[roleOf(hop)]);
			strips[bus].emissiveIntensity = (1.6 + 0.5 * Math.sin(t * 5)) * (util === undefined ? 1
				: Math.max(0.12, Math.min(1, util)));
		};
		for (const m of Object.values(strips)) m.emissiveIntensity = 0;
		for (const [hop, buses] of Object.entries(ON_BUS)) if (on.has(hop)) for (const b of buses) light(b, hop);
		if (two && on.has('pcie')) light('swGpu1', 'pcie');
		pellets.count = n;
		pellets.instanceMatrix.needsUpdate = true;
		pellets.instanceColor.needsUpdate = true;
		// the parts the action holds glow as busy as it keeps them
		const pulse = 0.8 + 0.2 * Math.sin(t * 7);
		MAT.hbmTop.emissiveIntensity = ends.has('hbm') ? 0.25 + 1.05 * busy.hbm * pulse : 0;
		MAT.hbmTop1.emissiveIntensity = two || ends.has('hbm1') ? MAT.hbmTop.emissiveIntensity : 0;
		MAT.ssdChip.emissiveIntensity = ends.has('ssd') ? 1.0 * pulse : 0;
		// pinned memory is DRAM too, page-locked
		MAT.dram.emissiveIntensity = ends.has('dram') || ends.has('pinned') ? 0.9 * pulse : 0;
		MAT.ihs.emissiveIntensity = on.has('stage') || ends.has('cores') ? 0.22 * pulse : 0;
		MAT.nvsw.emissiveIntensity = on.has('nvlink') ? 1.5 * pulse : 0;
		smGroup.traverse(o => o.material && o.material.name === 'core'
			&& (o.material.emissiveIntensity = 0.75 * busy.tc * pulse));
		for (let g = 0; g < 2; g++) SMS.forEach((_, i) => {
			const k = g && !two ? 0 : busy.tc * (0.5 + 0.5 * Math.sin(t * 6 + i * 1.7 + g));
			smGlow.setColorAt(g * SMS.length + i, GLOW.copy(TC).multiplyScalar(0.28 * k));
		});
		smGlow.instanceColor.needsUpdate = true;
	}

	// ---- the working parts lit as on a stage: a pool of light on the board
	// round each end of the line's hops and what they pass through, in the
	// hop's colour, and the key light lowered while they work. Painted on the
	// board, a pool cannot glare on the metal above it; round a GPU it reaches
	// past the module, whose HBM the heatsink hides ----
	const BANKS = [-1, 1].map(s => new THREE.Vector3(CPU.x + s * 0.078, 0, CPU.z));
	const END = { ssd: [[SSD, 1]], dram: BANKS.map(b => [b, 1]), pinned: BANKS.map(b => [b, 1]),
		cores: [[CPU, 1]], hbm: [[MODS[0], 1.8]], hbm1: [[MODS[1], 1.8]] };
	const VIA = { stage: CPU, pcie: PSW, back: PSW, gds: PSW, nvlink: SWITCH };
	const HALO = texture(128, 128, (cx, w, h) => {
		const g = cx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
		g.addColorStop(0, 'rgba(255, 255, 255, 1)');
		g.addColorStop(0.45, 'rgba(255, 255, 255, 0.45)');
		g.addColorStop(1, 'rgba(255, 255, 255, 0)');
		cx.fillStyle = g;
		cx.fillRect(0, 0, w, h);
	});
	const pools = [0, 1, 2, 3, 4].map(() => {
		const m = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17).rotateX(-Math.PI / 2),
			new THREE.MeshBasicMaterial({ map: HALO, transparent: true, opacity: 0,
			blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
		m.position.y = 0.0003;
		m.renderOrder = 1;
		scene.add(m);
		return m;
	});
	let focus = 0;
	const WHITE = new THREE.Color('#ffffff');
	function spot(dt) {
		const at = [];
		const put = (p, k, hop) => {
			if (at.length < pools.length && !at.some(a => a.p === p)) at.push({ p, k, hop });
		};
		for (const hop of on.keys()) {
			const h = H[hop];
			for (const [p, k] of END[h.from] || []) put(p, k, hop);
			if (VIA[hop]) put(VIA[hop], 1, hop);
			for (const [p, k] of END[h.to] || []) put(p, k, hop);
			if (two && (h.from === 'hbm' || h.to === 'hbm')) for (const [p, k] of END.hbm1) put(p, k, hop);
		}
		const goal = at.length ? 1 : 0;
		focus += (goal - focus) * Math.min(1, dt * 4);
		if (Math.abs(goal - focus) < 1e-3) focus = goal;
		// the pools only where the board is in view, the server and the module
		const inView = smooth(Math.log(0.12), Math.log(0.3), Math.log(d));
		pools.forEach((m, i) => {
			m.visible = !!at[i] && inView > 0;
			if (!m.visible) return;
			m.position.x = at[i].p.x;
			m.position.z = at[i].p.z;
			m.scale.setScalar(at[i].k);
			m.material.color.set(ROLE[roleOf(at[i].hop)]).lerp(WHITE, 0.4);
			m.material.opacity = 0.32 * inView;
		});
		key.intensity = KEY * (1 - 0.4 * focus * inView);
	}

	// the studio's light, less on the board's broad surfaces than on its metal
	scene.traverse(o => {
		for (const m of [].concat(o.material || [])) {
			if (m.envMapIntensity === 1) m.envMapIntensity = m.metalness > 0.5 ? 0.45 : 0.3;
		}
	});

	// ---- the post: ambient occlusion, bloom, and the tone mapping ----
	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	const gtao = new GTAOPass(scene, camera, 1, 1);
	gtao.output = GTAOPass.OUTPUT.Default;
	gtao.blendIntensity = 0.85;
	composer.addPass(gtao);
	// the occlusion worked out again only as the camera or the line changes,
	// the frame says when, and between those the last of it laid over the
	// frame as the pass's own output lays it; the bytes in flight, which move
	// every frame, are left out of it
	let stale = true;
	const occlude = gtao.render.bind(gtao), occluded = gtao.overrideVisibility.bind(gtao);
	gtao.overrideVisibility = () => {
		occluded();
		pellets.visible = false;
	};
	gtao.render = (r, writeBuffer, readBuffer) => {
		if (stale) return occlude(r, writeBuffer, readBuffer);
		gtao.copyMaterial.uniforms.tDiffuse.value = readBuffer.texture;
		gtao.copyMaterial.blending = THREE.NoBlending;
		gtao.renderPass(r, gtao.copyMaterial, writeBuffer);
		gtao.blendMaterial.uniforms.intensity.value = gtao.blendIntensity;
		gtao.blendMaterial.uniforms.tDiffuse.value = gtao.pdRenderTarget.texture;
		gtao.renderPass(r, gtao.blendMaterial, writeBuffer);
	};
	const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.38, 1.0);
	composer.addPass(bloom);
	composer.addPass(new OutputPass());
	function resize() {
		const w = view.clientWidth, h = view.clientHeight;
		if (!w || !h) return;
		dirty = true;
		renderer.setSize(w, h, false);
		composer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
		composer.setSize(w, h);
		// the timeline floats over the render's foot, and the camera frames
		// what is above it, the foot showing what lies past its edge
		const top = h - (parseFloat(getComputedStyle(view).getPropertyValue('--foot')) || 0);
		camera.aspect = w / top;
		camera.setViewOffset(w, top, 0, 0, w, h);
		frameServer(w / top);
	}
	const sized = new ResizeObserver(() => (root.isConnected ? resize() : sized.disconnect()));
	sized.observe(view);
	resize();

	// ---- the reader's hands: the wheel zooms, a drag turns, a double-click straightens ----
	canvas.addEventListener('wheel', e => {
		e.preventDefault();
		flight = null;
		d = Math.min(PLACES[0].d * 1.5, Math.max(NEAR, d * Math.exp(e.deltaY * 0.0022)));
	}, { passive: false });
	let drag = null;
	canvas.addEventListener('pointerdown', e => {
		drag = { x: e.clientX, y: e.clientY };
		canvas.setPointerCapture(e.pointerId);
		view.classList.add('drag');
	});
	canvas.addEventListener('pointermove', e => {
		if (!drag) return;
		// no further up or down than the camera goes, so that a drag back turns at once
		const el = pose(d).el;
		turn.az -= (e.clientX - drag.x) * 0.005;
		turn.el = Math.min(1.45 - el, Math.max(0.15 - el, turn.el + (e.clientY - drag.y) * 0.004));
		drag = { x: e.clientX, y: e.clientY };
	});
	for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => {
		drag = null;
		view.classList.remove('drag');
	});
	canvas.addEventListener('dblclick', () => { turn = { az: 0, el: 0 }; });

	// ---- the frame, drawn only when something in it changes: the camera,
	// the line, or the bytes in flight and the light easing after a line. The
	// shadows and the occlusion are drawn again only for the first two; while
	// only the bytes move they stand, and a still render costs nothing ----
	let last = performance.now(), clock = 0;
	const drawn = { at: new THREE.Vector3(), turn: new THREE.Quaternion(), aspect: 0 };
	function frame(now) {
		// a frame's stamp may come before the stamp taken at load
		const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
		last = now;
		clock += REDUCED ? 0 : dt;
		aim(dt);
		spot(dt);
		const moved = !camera.position.equals(drawn.at)
			|| !camera.quaternion.equals(drawn.turn) || camera.aspect !== drawn.aspect;
		const live = (!REDUCED && on.size > 0) || (focus !== 0 && focus !== 1);
		if (ready && view.clientWidth && (moved || dirty || live)) {
			renderer.shadowMap.needsUpdate = stale = moved || dirty;
			flow(clock);
			composer.render(dt);
			// the first frame takes the poster's place
			if (!drawn.aspect) canvas.style.visibility = 'visible';
			// the tags move only with the camera or the line
			if (stale) place();
			drawn.at.copy(camera.position);
			drawn.turn.copy(camera.quaternion);
			drawn.aspect = camera.aspect;
			dirty = false;
		}
		if (root.isConnected) requestAnimationFrame(frame);
		// a closed window lets go of its GPU, of which a browser gives a page only a few contexts
		else {
			composer.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
		}
	}
	// the shaders compiled first, in the background and at once where the
	// browser can (KHR_parallel_shader_compile): a first visit's can take
	// seconds, through which the window and the program's side stay alive and
	// the poster behind the canvas stands in for the render. They are compiled
	// for the composer's buffer, which the scene is drawn into, untoned
	let ready = false;
	renderer.setRenderTarget(composer.readBuffer);
	renderer.compileAsync(scene, camera).then(() => { ready = true; });
	renderer.setRenderTarget(null);
	requestAnimationFrame(frame);

	// ---- the models in /data, from their config.json: Llama 3.2's 1B and 3B,
	// whose output layer shares the embedding's weights, and Llama 3.1's 8B,
	// whose has its own; then the run ----
	const MODELS = {
		'llama-3.2-1b': { params: 1235814400, d: 2048, layers: 16, ffn: 8192, kv: 8 * 64, tied: true, shards: 1 },
		'llama-3.2-3b': { params: 3212749824, d: 3072, layers: 28, ffn: 8192, kv: 8 * 128, tied: true, shards: 2 },
		'llama-3.1-8b': { params: 8030261248, d: 4096, layers: 32, ffn: 14336, kv: 8 * 128, tied: false, shards: 4 },
	};
	const VOCAB = 128256, SEQ = 2048, FILE_TOKENS = 2e9, BATCHES = [1, 48];
	let modelName = 'llama-3.2-1b', M = MODELS[modelName], device = 'cuda', strategy = 'ddp';
	// HBM as CUDA reports it on an H100 SXM5, a little under its 80 GiB, and
	// the host's DRAM, 2 TiB
	const HBM_CAP = 79.19 * 2 ** 30, CAP = { cuda: HBM_CAP, cpu: 2 * 2 ** 40 };
	const GEMM = ['hbm', 'l2', 'smem'];
	let batchSize = 8, ckpt = false;

	// ---- the model's forward pass, abridged, and what each line costs at a
	// batch of B: a matmul streams its weights through to the tensor cores, a
	// norm or a gather only reads and writes HBM ----
	const modelCode = () => [
		'# LlamaForCausalLM.forward, abridged from modeling_llama.py',
		'def forward(self, input_ids):',
		'    x = self.embed_tokens(input_ids)',
		'',
		'    for layer in self.layers:  # ' + M.layers + ' of them',
		'        h = layer.input_layernorm(x)',
		'        q, k, v = layer.q_proj(h), layer.k_proj(h), layer.v_proj(h)',
		'        x = x + layer.o_proj(attention(q, k, v))',
		'',
		'        h = layer.post_attention_layernorm(x)',
		'        gate, up = layer.gate_proj(h), layer.up_proj(h)',
		'        x = x + layer.down_proj(silu(gate) * up)',
		'',
		'    logits = self.lm_head(self.norm(x))' + (M.tied ? '  # tied to embed_tokens' : ''),
		'    return CausalLMOutputWithPast(logits=logits)',
	];
	let MODEL = modelCode();
	const mm = (m, n, k) => 2 * m * n * k;
	const int = n => n.toLocaleString('en-GB');
	// where the arithmetic and the bytes go: on the GPU through HBM to the
	// tensor cores, on the CPU through its DDR5 to its AMX tiles
	const ON = {
		cuda: { mem: ['hbm'], mm: GEMM, units: 'the tensor cores', memName: 'HBM' },
		cpu: { mem: ['ddr'], mm: ['ddr'], on: 'amx', units: 'the CPU’s AMX tiles', memName: 'DDR5' },
	};
	function forwardPass(B) {
		const T = B * SEQ, DM = M.d, LAYERS = M.layers, FFN = M.ffn, KVD = M.kv, at = ON[device];
		const norm = { n: 2 * T * DM * 4, route: at.mem, k: LAYERS };
		const matmul = (n, flops, k) => ({ n, flops, route: at.mm, on: at.on, k });
		// the MLP's share of a layer's matmuls
		const share = 3 * FFN * DM / (DM * (DM + 2 * KVD) + (SEQ + 1) * DM + DM * DM + 3 * FFN * DM);
		return [
			{ line: 2, short: 'embedding',
				text: 'a row of the table for each of ' + int(T) + ' tokens: a gather, held by '
					+ at.memName + ', no arithmetic to speak of',
				copies: [{ n: 2 * T * DM * 4, route: at.mem }] },
			{ line: 4, short: 'for layer', note: true,
				text: 'the next lines run in each of the ' + LAYERS
					+ ' layers; each shows one layer’s time and the sum of all ' + LAYERS },
			{ line: 5, short: 'RMSNorm',
				text: 'reads the fp32 residual stream and writes it normalised: bytes, not FLOPs, so '
					+ at.memName + ' holds it', copies: [norm] },
			{ line: 6, short: 'q, k, v',
				text: 'three matmuls of the layer’s input with its query, key and value weights, cast to bf16 by autocast: '
					+ at.units + ' hold it',
				copies: [matmul(DM * (DM + 2 * KVD) * 4 + T * DM * 2 + T * (DM + 2 * KVD) * 2,
					mm(T, DM + 2 * KVD, DM), LAYERS)] },
			{ line: 7, short: 'attention, o_proj',
				text: 'causal attention, fused so no score matrix is stored, then the output projection: '
					+ at.units + ' hold it',
				copies: [matmul(T * (DM + 2 * KVD) * 2 + 2 * T * DM * 2 + DM * DM * 4,
					4 * B * SEQ * (SEQ + 1) / 2 * DM + mm(T, DM, DM), LAYERS)] },
			{ line: 9, short: 'RMSNorm',
				text: 'the second norm of the layer, held by ' + at.memName + ' like the first', copies: [norm] },
			{ line: 10, last: 11, short: 'MLP',
				text: 'three matmuls with a ' + int(FFN) + '-wide middle: '
					+ Math.round(100 * share) + '% of the layer’s FLOPs, ' + at.units + ' flat out',
				copies: [matmul(3 * DM * FFN * 4 + 2 * T * DM * 2 + 3 * T * FFN * 2, 3 * mm(T, FFN, DM), LAYERS)] },
			{ line: 13, short: 'lm_head',
				text: 'the biggest matmul: every token against all 128,256 rows of the vocabulary, logits out in bf16',
				copies: [matmul(VOCAB * DM * 4 + T * DM * 2 + T * VOCAB * 2, mm(T, VOCAB, DM))] },
		];
	}
	let INSIDE = forwardPass(batchSize);
	const cost = list => list.reduce((a, s) => a + (s.copies || []).reduce((b, c) => b + E.copyTime(c), 0), 0);
	const sum = (list,
		f) => list.reduce((a, s) => a + (s.copies || []).reduce((b, c) => b + (c.k || 1) * (f(c) || 0), 0), 0);
	// the model's parameters in the order model.parameters() gives them, the
	// order AdamW makes its moments in
	function parameters() {
		const d = M.d, list = [['model.embed_tokens.weight', VOCAB * d]];
		for (let l = 0; l < M.layers; l++) {
			const at = 'model.layers.' + l + '.';
			list.push([at + 'self_attn.q_proj.weight', d * d],
				[at + 'self_attn.k_proj.weight', M.kv * d], [at + 'self_attn.v_proj.weight', M.kv * d],
				[at + 'self_attn.o_proj.weight', d * d],
				[at + 'mlp.gate_proj.weight', M.ffn * d], [at + 'mlp.up_proj.weight', M.ffn * d],
				[at + 'mlp.down_proj.weight', d * M.ffn], [at + 'input_layernorm.weight', d],
				[at + 'post_attention_layernorm.weight', d]);
		}
		list.push(['model.norm.weight', d]);
		if (!M.tied) list.push(['lm_head.weight', VOCAB * d]);
		return list;
	}
	// sizes as PyTorch prints them in its errors
	const torchSize = n => (n < 2 ** 30 ? (n / 2 ** 20).toFixed(2) + ' MiB' : (n / 2 ** 30).toFixed(2) + ' GiB');

	// ---- the scripts, train.py with the DataLoader or GPUDirect Storage and
	// train_dist.py, as black formats them, at the batch size and checkpointing
	// set ----
	function script(kind) {
		const load = [
			'device = "' + device + '"',
			'model = AutoModelForCausalLM.from_pretrained(',
			'    "/data/' + modelName + '", torch_dtype=torch.float32',
			')',
			(ckpt ? '' : '# ') + 'model.gradient_checkpointing_enable()',
			'model.to(device)',
			'',
			'optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)',
		];
		// the loop's body in its parts: the batch's inputs and the targets they
		// predict, a token on; the forward pass and the loss; the update; the log
		const loop = [
			'    inputs, targets = ids[:, :-1], ids[:, 1:]',
			'',
			'    with torch.autocast(device, dtype=torch.bfloat16):',
			'        logits = model(inputs).logits.flatten(0, 1)',
			'    loss = F.cross_entropy(logits.float(), targets.flatten())',
			'    del logits  # not held into backward, where memory peaks',
			'',
			'    loss.backward()',
			'    optimizer.step()',
			'    optimizer.zero_grad()',
			'',
			'    if step % 100 == 0:',
			'        print(f"step {step}: loss {loss.item():.3f}")',
		];
		// a script: its imports, then main(), which runs only when the file is
		// the program, not when a DataLoader worker that spawn or forkserver
		// starts imports it; black's two blank lines about the function
		const program = (head, body) => [...head, '', '', 'def main():',
			...body.map(l => (l ? '    ' + l : '')), '', '', 'if __name__ == "__main__":', '    main()'];
		if (kind === 'dist') return program([
			'import os',
			'',
			'import numpy as np',
			'import torch',
			'import torch.distributed as dist',
			'import torch.nn.functional as F',
			'from torch.distributed.fsdp import MixedPrecisionPolicy, fully_shard',
			'from torch.nn.parallel import DistributedDataParallel as DDP',
			'from torch.utils.data import DataLoader, DistributedSampler',
			'from transformers import AutoModelForCausalLM',
			'',
			'from data import Windows  # samples of 2,049 tokens, as int32',
		], [
			'strategy = "' + strategy + '"',
			'',
			'rank = int(os.environ["LOCAL_RANK"])',
			'device = torch.device("cuda", rank)',
			'torch.cuda.set_device(device)',
			'dist.init_process_group("nccl")',
			'',
			...load.slice(1, 5),
			'if strategy == "ddp":',
			'    model = DDP(model.to(device), device_ids=[rank])',
			'else:',
			'    policy = MixedPrecisionPolicy(',
			'        param_dtype=torch.bfloat16,',
			'        reduce_dtype=torch.float32,',
			'    )',
			'    for layer in model.model.layers:',
			'        fully_shard(layer, mp_policy=policy)',
			'    fully_shard(model, mp_policy=policy)',
			'',
			...load.slice(7),
			'tokens = np.memmap("/data/tokens.bin", dtype=np.uint32, mode="r")',
			'data = Windows(tokens, 2049)',
			'loader = DataLoader(',
			'    data,',
			'    batch_size=' + batchSize + ',',
			'    sampler=DistributedSampler(data),',
			'    num_workers=4,',
			'    pin_memory=True,',
			')',
			'',
			'model.train()',
			'for step, ids in enumerate(loader):',
			'    ids = ids.to(device, non_blocking=True).long()',
			...loop.map(l => l.replace('autocast(device', 'autocast("cuda"')
				.replace('if step', 'if rank == 0 and step')),
			'',
			'dist.destroy_process_group()',
		]);
		if (kind === 'loader') return program([
			'import numpy as np',
			'import torch',
			'import torch.nn.functional as F',
			'from torch.utils.data import DataLoader',
			'from transformers import AutoModelForCausalLM',
			'',
			'from data import Windows  # samples of 2,049 tokens, as int32',
		], [
			...load,
			'tokens = np.memmap("/data/tokens.bin", dtype=np.uint32, mode="r")',
			'loader = DataLoader(',
			'    Windows(tokens, 2049),',
			'    batch_size=' + batchSize + ',',
			'    num_workers=4,',
			'    pin_memory=(device == "cuda"),',
			')',
			'',
			'model.train()',
			'for step, ids in enumerate(loader):',
			'    ids = ids.to(device, non_blocking=True).long()',
			...loop,
		]);
		return program([
			'import os',
			'',
			'import kvikio',
			'import torch',
			'import torch.nn.functional as F',
			'from transformers import AutoModelForCausalLM',
		], [
			...load,
			'path = "/data/tokens.bin"',
			'batch_size = ' + batchSize,
			'n = os.path.getsize(path) // (4 * batch_size * 2049)  # int32 ids',
			'',
			'shape = (n, batch_size, 2049)',
			'tokens = torch.empty(shape, dtype=torch.int32, device=device)',
			'with kvikio.CuFile(path, "r") as f:',
			'    f.read(tokens)  # GPUDirect Storage: SSD to HBM',
			'',
			'model.train()',
			'for step in range(n):',
			'    ids = tokens[step].long()',
			...loop,
		]);
	}

	// ---- a run: its stops in order, each with its copies, the timeline's
	// bars it adds, and what it puts in memory or frees. The CPU and the GPU
	// keep a clock each, the GPU's behind the CPU's by the work it has queued ----
	const LANES = ['SSD', 'CPU', 'Workers', 'PCIe', 'HBM', 'Tensor cores'];
	function run(kind) {
		const code = script(kind), at = text => code.findIndex(l => l.trim().startsWith(text));
		const T = batchSize * SEQ, IDS = batchSize * (SEQ + 1), batch = IDS * 4, whole = Math.floor(FILE_TOKENS / IDS);
		const DM = M.d, LAYERS = M.layers, W16 = 2 * M.params, W32 = 4 * M.params;
		// a layer's matmul weights: q, k, v and o, then the MLP's three
		const LINEAR = DM * (2 * DM + 2 * M.kv) + 3 * DM * M.ffn;
		const files = M.shards === 1 ? 'model.safetensors' : 'the ' + M.shards + ' safetensors shards';
		const FWD = { n: sum(INSIDE, c => c.n), flops: sum(INSIDE, c => c.flops) };
		// a layer's lines, which checkpointing runs again in backward
		const layer = INSIDE.slice(2, 7), REDO = { n: sum(layer, c => c.n), flops: sum(layer, c => c.flops) };
		const stops = [], bars = [];
		let cpu = 0, gpu = 0, step = null;
		const stop = s => {
			s.k = stops.length;
			s.step = step;
			s.t = s.t === undefined ? cpu : s.t;
			stops.push(s);
			return s;
		};
		const bar = (s, lane, t0, t1, name) => bars.push({ lane, t0, t1, name, k: s.k });
		const note = (text, short, words) => stop({ line: at(text), short, note: true, text: words, copies: [] });
		const time = c => E.copyTime(c);
		// where the tensors live, HBM or DRAM, and where the batches wait
		const onGpu = device === 'cuda', here = onGpu ? 'hbm' : 'dram', staged = onGpu ? 'pinned' : 'dram';
		// a line's work, taking its copy's time unless told otherwise: on the GPU
		// queued, its clock running behind the CPU's; on the CPU done there and
		// then, the next line waiting for it
		const work = (s, lane, c, name, T = time(c)) => {
			if (!onGpu) {
				bar(s, 'CPU', cpu, cpu + T, name);
				cpu += T;
				return [s.t, cpu];
			}
			const g0 = Math.max(gpu, cpu);
			bar(s, lane, g0, g0 + T, name);
			gpu = g0 + T;
			return [g0, gpu];
		};
		// a copy the CPU waits for, the GPU idle till it lands
		const blocking = (s, lane, c, name) => {
			bar(s, lane, cpu, cpu + time(c), name);
			bar(s, 'CPU', cpu, cpu + time(c), 'waits');
			cpu = gpu = cpu + time(c);
			s.span = [s.t, cpu];
		};
		// on two GPUs each process does the same on its own, so a copy on the GPU
		// is drawn on both, twice the bytes over twice the links in the same time
		const dist = kind === 'dist', fsdp = dist && strategy === 'fsdp';
		const both = c => (dist ? { ...c, n: 2 * c.n, flops: c.flops && 2 * c.flops, ways: 2 } : c);
		// FSDP's halves: the decoder layers', and the root's, the embedding, the
		// final norm and an untied lm_head; each GPU holds half of each, in fp32
		const ROOT = (M.tied ? 1 : 2) * VOCAB * DM + DM, LAYER_P = (M.params - ROOT) / LAYERS;
		const layersHalf = 4 * (M.params - ROOT) / 2, rootHalf = 4 * ROOT / 2;
		const nvlink = n => ({ n, route: ['nvlink'] });
		// python defines main and runs on to the foot of the file, whose guard calls it
		const enter = () => {
			note('def main', 'def main()', 'defines main(); its body runs only when the foot of the file calls it');
			note('if __name__', '__name__ == "__main__"',
				'true, as the file runs as the program, so main() is called; a DataLoader worker that spawn or forkserver starts imports the file instead, and the guard keeps it from training too');
		};

		if (dist) {
			note('import', 'torchrun',
				'torchrun --nproc_per_node=2 starts two processes, one a GPU, each running this file from the top with LOCAL_RANK set; the debugger follows rank 0, and rank 1 does the same on GPU 1');
			note('import torch', 'import torch', 'loads PyTorch in each process; nothing reaches a GPU yet');
			enter();
			note('strategy =', 'strategy = "' + strategy + '"', strategy === 'ddp'
				? 'DistributedDataParallel: each GPU holds the whole model and runs its own batch, and backward averages their gradients'
				: 'FSDP, fully_shard: each GPU holds half of every weight, gradient and moment, and gathers a layer whole, in bf16, only to run it');
			note('rank =', 'LOCAL_RANK',
				'torchrun’s number for this process on this machine, 0 here and 1 in the other');
			note('device =', 'cuda:0', 'this process’s GPU, cuda:0 for rank 0 and cuda:1 for rank 1');
			note('torch.cuda.set_device', 'set_device',
				'makes this GPU the process’s default, so its allocations and NCCL’s land on it');
			note('dist.init_process_group', 'init_process_group',
				'the two processes find each other through torchrun’s rendezvous; NCCL, which moves tensors between the GPUs over NVLink, sets up at the first collective');
		} else {
			note('import', 'python train.py',
				'python starts a process on the CPU and runs the file from the top; the GPU does only what this process asks of it through CUDA');
			note('import torch', 'import torch',
				'loads PyTorch on the CPU; nothing reaches the GPU yet, not even its context, which the first CUDA call makes');
			enter();
			note('device =', 'device = "' + device + '"',
				'names where the work runs, "cuda" for the GPU or "cpu" for the CPU; the model, the batches and autocast all follow it');
		}
		// the weights: bf16 from the SSD into the page cache, widened to fp32 on the CPU
		{
			const read = { n: W16, route: ['nvme'] }, widen = { n: W16 + W32, route: ['stage'] };
			const s = stop({ line: at('model = '), short: 'from_pretrained', waits: true, copies: [read, widen],
				text: files + ', ' + E.fmt(W16 / 1e9)
					+ ' GB of bf16, read from the SSD into DRAM; the CPU then widens every weight to fp32, '
					+ E.fmt(W32 / 1e9) + ' GB'
					+ (dist ? '; rank 1 does the same, its read served from the page cache, its fp32 copy its own'
						: ''),
				mem: { add: [['dram', 'cache', files + ', page cache', W16],
					['dram', 'w', dist ? 'weights, fp32, a copy each process' : 'weights, fp32',
						(dist ? 2 : 1) * W32]] } });
			bar(s, 'SSD', cpu, cpu + time(read), 'read ' + E.fmt(W16 / 1e9) + ' GB');
			bar(s, 'CPU', cpu + time(read), cpu + time(read) + time(widen), 'widen to fp32');
			cpu += time(read) + time(widen);
			s.span = [s.t, cpu];
		}
		if (dist) {
			note('if strategy', 'if strategy == "' + strategy + '"',
				'takes the ' + (fsdp ? 'FSDP' : 'DDP') + ' branch; the other is passed over');
		}
		if (dist && !fsdp) {
			// each process copies its whole model to its GPU; DDP then sends rank
			// 0's weights to rank 1, and makes its buckets
			const c = both({ n: W32, route: ['stage', 'pcie'] }), cast = nvlink(W32);
			const s = stop({ line: at('model = DDP('), short: 'DDP(model.to(device))', waits: true, copies: [c, cast],
				text: 'each process copies its whole model over PCIe into its own GPU; DDP then broadcasts rank 0’s weights over NVLink so both start alike, and makes buckets for the gradients as large again as the weights, which gradient_as_bucket_view=True would spare',
				mem: { add: [['hbm', 'w', 'weights, fp32, all of them', W32],
						['hbm', 'buckets', 'DDP’s gradient buckets', W32]], free: [['dram', 'w']] } });
			bar(s, 'PCIe', cpu, cpu + time(c), 'weights to both GPUs');
			bar(s, 'NVLink', cpu + time(c), cpu + time(c) + time(cast), 'broadcast');
			bar(s, 'CPU', cpu, cpu + time(c) + time(cast), 'waits');
			cpu += time(c) + time(cast);
			gpu = cpu;
			s.span = [s.t, cpu];
		} else if (fsdp) {
			// each process moves its half of each layer, then of the root, to its GPU
			note('policy = MixedPrecisionPolicy', 'MixedPrecisionPolicy',
				'how FSDP will cast: each layer’s weights gathered in bf16, half the bytes over NVLink and in HBM, and its gradients reduced in fp32; the halves it keeps stay fp32');
			note('for layer in model.model.layers', 'for layer',
				'makes each of the ' + LAYERS
					+ ' decoder layers a unit that FSDP gathers whole when it runs and splits again after');
			for (const [text, short, n, key,
				name] of [['fully_shard(layer,', 'fully_shard(layer)', layersHalf,
					'w', 'the layers’ weights, fp32, this GPU’s half'],
				['fully_shard(model,', 'fully_shard(model)', rootHalf,
					'wroot', 'the root’s weights, fp32, this GPU’s half']]) {
				const c = both({ n, route: ['stage', 'pcie'] });
				const s = stop({ line: at(text), short, waits: true, copies: [c],
					text: key === 'w'
						? 'splits each layer’s weights in two along their first dimension and moves this process’s half to its GPU, '
							+ E.fmt(n / 1e9) + ' GB; rank 1 moves the other half to its own'
						: 'the same for what the layers leave, '
							+ (M.tied ? 'the embedding, which lm_head shares, and the final norm'
								: 'the embedding, the final norm and lm_head') + ', '
							+ E.fmt(n / 1e9) + ' GB a GPU; the process’s fp32 copy in DRAM is let go',
					mem: { add: [['hbm', key, name, n]], free: key === 'wroot' ? [['dram', 'w']] : [] } });
				blocking(s, 'PCIe', c, 'halves to both GPUs');
			}
		} else if (!onGpu) note('model.to(', 'model.to("cpu")',
			'the weights are already in DRAM, where the CPU computes: .to returns the model as it is, and nothing moves');
		else {
			const c = { n: W32, route: ['stage', 'pcie'] };
			const s = stop({ line: at('model.to('), short: 'model.to("cuda")', waits: true, copies: [c],
				text: 'the weights from pageable DRAM: the driver copies them through a pinned buffer of its own and over PCIe into HBM, and the CPU waits',
				mem: { add: [['hbm', 'w', 'weights, fp32', W32]], free: [['dram', 'w']] } });
			blocking(s, 'PCIe', c, 'weights to HBM');
		}
		note('optimizer =', 'AdamW()',
			'nothing moves yet: AdamW makes its two moments, 8 bytes a weight, at its first step'
			+ (fsdp ? ', and here only for this GPU’s halves'
				: dist ? ', and here for the whole model on each GPU' : ''));
		if (kind !== 'gds') {
			note('tokens =', 'np.memmap',
				'maps the file into the address space; nothing is read until a page is touched');
			if (dist) note('data =', 'Windows', 'the samples of 2,049 tokens, as a dataset a sampler can index');
			note('loader =', 'DataLoader',
				dist
					? 'nothing starts yet; DistributedSampler hands this rank every other sample and rank 1 the rest, so the GPUs never see the same one'
				: 'nothing starts yet: its four workers' + (onGpu ? ', and the thread that pins their batches,' : '')
					+ ' start when the loop first asks for a batch');
		} else {
			const reserve = whole * IDS * 4;
			note('n = os.path', 'os.path.getsize',
				'a stat call: the file system answers from its metadata, 8 GB, without reading the data; '
				+ int(whole) + ' whole batches of ' + batchSize + ' × 2,049');
			stop({ line: at('tokens = torch.empty'), short: 'torch.empty', note: true,
				text: 'reserves ' + E.fmt(reserve / 1e9) + ' GB of HBM for the whole file; nothing is written to it',
				mem: { add: [['hbm', 'tokens', 'tokens, reserved', reserve]] } });
			note('with kvikio', 'kvikio.CuFile',
				'opens the file for cuFile, which registers it so the SSD can DMA into GPU memory; nothing is read yet');
			const c = { n: reserve, route: ['gds'] };
			const s = stop({ line: at('f.read'), short: 'f.read(tokens)', waits: true, copies: [c],
				text: 'GPUDirect Storage: the SSD DMAs the file through the PCIe switch straight into HBM, DRAM never holding it; without GDS support kvikio falls back to a bounce buffer in host memory',
				mem: { add: [['hbm', 'tokens', 'tokens.bin, all of it', reserve]] } });
			blocking(s, 'SSD', c, 'tokens.bin into HBM');
		}
		note('model.train', 'model.train()',
			'from_pretrained hands the model back in eval mode, and train() puts it in training mode; Llama has no dropout to turn on, but gradient checkpointing acts only in training mode');

		// two steps of the loop, the first of which prints
		for (step = 0; step < 2; step++) {
			if (kind !== 'gds') {
				const read = { n: batch, route: ['nvme'] }, pin = { n: batch, route: ['stage'] },
					fetch = time(read) + (onGpu ? time(pin) : 0);
				if (step === 0) {
					const s = stop({ line: at('for step'), short: 'enumerate(loader)',
						waits: true, copies: onGpu ? [read, pin] : [read],
						text: 'the workers start: each reads its samples’ pages of tokens.bin from the SSD and collates them, '
							+ (onGpu ? 'the pin thread copies the batch into pinned memory, '
								: 'pinning nothing, since nothing goes to a GPU, ')
							+ 'and the loop waits for the first',
						mem: { add: [['dram', 'pages', 'tokens.bin, the pages read', 8 * batch],
							[staged, 'b1', 'batch 0', batch],
							[staged, 'ahead', 'batches 1 to 7, read ahead', 7 * batch]] } });
					bar(s, 'SSD', cpu, cpu + time(read), 'pages of tokens.bin');
					bar(s, 'Workers', cpu, cpu + fetch, onGpu ? 'read, collate, pin' : 'read, collate');
					bar(s, 'CPU', cpu, cpu + fetch, 'waits');
					cpu += fetch;
					// the workers keep eight batches ahead while the step runs
					bar(s, 'Workers', cpu, cpu + 2 * fetch, 'batches 1 to 7');
					s.span = [s.t, cpu];
				} else {
					const s = stop({ line: at('for step'), short: 'enumerate(loader)', copies: [],
						text: 'batch 1 was read'
							+ (onGpu ? ' and pinned while the GPU ran step 0'
								: ' by the workers while the main process ran step 0')
							+ ', so the loop takes it at once; a worker starts on batch 8',
						mem: { add: [[staged, 'b1', 'batch 1', batch],
							[staged, 'ahead', 'batches 2 to 8, read ahead', 7 * batch]] } });
					bar(s, 'Workers', cpu, cpu + fetch, 'batch 8');
					s.span = [s.t, s.t];
				}
				if (!onGpu) {
					const widen = { n: IDS * (4 + 8), route: ['ddr'] };
					const s = stop({ line: at('ids = ids.to'),
						short: '.to("cpu", non_blocking=True)', waits: true, copies: [widen],
						text: '.to(device) hands back the batch itself, already in DRAM; .long() widens it to int64 there, and the CPU does it before going on',
						mem: { add: [['dram', 'ids', 'ids, int64', IDS * 8]], free: [['dram', 'b1']] } });
					s.span = work(s, 'CPU', widen, '.long()');
				} else {
					const c = both({ n: batch, route: ['pcie'] }), widen = both({ n: IDS * (4 + 8), route: ['hbm'] });
					const s = stop({ line: at('ids = ids.to'),
						short: '.to("cuda", non_blocking=True)', copies: [c, widen],
						text: 'the copy engine reads the pinned batch over PCIe, ' + E.bytes(batch)
							+ ' of int32 ids, and the GPU widens them to int64 in HBM; the CPU only queues both',
						mem: { add: [['hbm', 'ids', 'ids, int64', IDS * 8]], free: [['pinned', 'b1']] } });
					const [g0] = work(s, 'PCIe', c, 'ids to HBM');
					s.span = [g0, work(s, 'HBM', widen, '.long()')[1]];
				}
			} else {
				if (step === 0) note('for step', 'range(n)', 'the loop runs on the CPU; the data is already in HBM');
				const widen = { n: IDS * (4 + 8), route: ['hbm'] };
				const s = stop({ line: at('ids = tokens'), short: 'tokens[step].long()', copies: [widen],
					text: 'the batch is a slice of the file already in HBM, widened to int64 there: nothing crosses PCIe',
					mem: { add: [['hbm', 'ids', 'ids, int64', IDS * 8]] } });
				s.span = work(s, 'HBM', widen, '.long()');
			}
			note('inputs, targets', 'inputs, targets',
				'two views of the batch, nothing copied: the first 2,048 ids of each sample go in, and each one’s target is the id after it');
			if (step === 0) note('with torch.autocast', 'autocast',
				fsdp
					? 'nothing moves: FSDP hands each layer its weights in bf16 already, so autocast, there for DDP, has next to nothing to cast'
				: 'nothing moves: inside it the matmuls run in bf16, the fp32 weights cast as each one uses them');
			{
				// what the pass allocates, in order, each with the line of the model
				// it would fail on and how far into the pass the GPU is by then. A
				// layer keeps for backward 30·d + 8·ffn + 4·kv bytes a token, as
				// PyTorch measures a Llama layer under autocast: its norms' fp32
				// inputs and outputs, a bf16 cast of the input for each projection,
				// q, k, v and attention's output, and the MLP's three wide tensors;
				// checkpointed, only its fp32 input. The matmuls keep autocast's bf16
				// copies of the weights too, unless checkpointing remakes them, or
				// FSDP gathers the weights in bf16 already
				const keep = T * (ckpt ? 4 * DM : 30 * DM + 8 * M.ffn + 4 * M.kv), cast = fsdp ? 0 : 2 * LINEAR;
				const embedT = cost(INSIDE.slice(0, 1)),
					layerT = cost(layer) / LAYERS, headT = embedT + LAYERS * layerT;
				const add = fsdp
					? [['hbm', 'root', 'the root gathered whole, bf16, for the step', 2 * ROOT],
						['hbm', 'gather', 'two layers gathered whole, bf16', 2 * 2 * LAYER_P]] : [];
				for (let l = 0; l < LAYERS; l++) {
					if (cast && !ckpt) {
						add.push([here, 'cast', 'weights, bf16, autocast’s copies kept for backward', cast,
							{ what: 'layer ' + l + '’s weights in bf16', line: 6, at: embedT + l * layerT }]);
					}
					add.push([here, 'acts', ckpt ? 'layer inputs, kept to recompute' : 'activations for backward', keep,
						{ what: 'layer ' + l + '’s ' + (ckpt ? 'input' : 'activations'),
							line: ckpt ? 4 : 10, at: embedT + l * layerT }]);
				}
				if (cast) {
					add.push([here, 'cast', 'weights, bf16, autocast’s copies kept for backward',
						2 * VOCAB * DM, { what: 'lm_head’s weight in bf16', line: 13, at: headT }]);
				}
				add.push([here, 'logits', 'logits, bf16', 2 * T * VOCAB, { what: 'the logits', line: 13, at: headT }]);
				const c = both({ n: FWD.n, flops: FWD.flops, route: ON[device].mm, on: ON[device].on }),
					gather = nvlink((layersHalf + rootHalf) / 2);
				const s = stop({ line: at('logits = model'), short: 'forward',
					copies: fsdp ? [c, gather] : [c], into: true,
					text: (onGpu
						? 'the forward pass, queued in a few milliseconds of launches; the GPU runs it, every matmul through the tensor cores'
						: 'the forward pass, run by the CPU itself, every matmul on its AMX tiles; the next line waits for it')
						+ (ckpt
							? ', and each layer keeps only its input for backward, '
								+ E.fmt(LAYERS * keep / 1e9) + ' GB in all'
							: ', and each layer keeps for backward ' + E.fmt(keep / 1e9)
								+ ' GB of activations' + (cast ? ' and a bf16 copy of its weights' : ''))
						+ (fsdp
							? '; FSDP gathers each layer’s other half from GPU 1 over NVLink, in bf16, just before the layer runs, and lets it go after'
							: '')
						+ '; the logits come back in bf16, ' + E.fmt(2 * T * VOCAB / 1e9)
						+ ' GB (F11 steps into it a line at a time)',
					mem: { add, after: [['hbm', 'gather']] } });
				// timed a line at a time, each held by its own bytes or FLOPs, as the
				// lines stepped into are
				s.span = work(s, 'Tensor cores', c, 'forward', cost(INSIDE));
				if (fsdp) bar(s, 'NVLink', s.span[0], s.span[0] + time(gather), 'all-gather');
			}
			{
				// the logits widened to fp32 and log_softmax over the vocabulary,
				// whose output its backward keeps; the fp32 copy goes at the line's end
				const c = both({ n: T * VOCAB * (2 + 4 + 4 + 4), route: ON[device].mem });
				const s = stop({ line: at('loss = F.cross_entropy'), short: 'cross_entropy', copies: [c],
					text: 'the logits widened to fp32, ' + E.fmt(4 * T * VOCAB / 1e9)
						+ ' GB, then log_softmax over the vocabulary and each target’s value averaged: bytes through '
						+ ON[device].memName
						+ ' and next to no arithmetic; the log-probabilities stay for backward, and the fp32 copy goes at the line’s end',
					mem: { add: [[here, 'logits32', 'logits.float()', 4 * T * VOCAB,
						{ what: 'logits.float()', line: null, at: 0 }],
						[here, 'logp', 'log-probabilities, fp32, kept for backward', 4 * T * VOCAB,
							{ what: 'the log-probabilities', line: null, at: time(c) / 2 }]],
					after: [[here, 'logits32']] } });
				s.span = work(s, 'HBM', c, 'loss');
			}
			stop({ line: at('del logits'), short: 'del logits', note: true, copies: [],
				text: 'drops the last reference to the bf16 logits, ' + E.fmt(2 * T * VOCAB / 1e9)
					+ ' GB: lm_head’s backward needs its input, not its output, so they would only sit through backward, adding to its peak at the loss'
					+ (onGpu ? '; the memory goes back to PyTorch’s cache, nothing for the GPU to do' : ''),
				mem: { free: [[here, 'logits']] } });
			{
				const c = both({ n: 2 * FWD.n + (ckpt ? REDO.n : 0),
					flops: 2 * FWD.flops + (ckpt ? REDO.flops : 0), route: ON[device].mm, on: ON[device].on });
				// DDP all-reduces the whole gradient; FSDP gathers each layer again
				// and reduce-scatters its gradient, each GPU keeping its half
				const sync = nvlink(fsdp ? layersHalf / 2 + W32 / 2 : W32);
				// autograd makes each parameter's gradient as backward reaches it,
				// the last layers' first; FSDP keeps this GPU's half of each
				const list = parameters().reverse(), bwdT = 2 * cost(INSIDE) + (ckpt ? cost(layer) : 0);
				const grads = list.map(([name, n], i) => [here, 'grads',
					'gradients, fp32' + (fsdp ? ', this GPU’s half' : ''), 4 * (fsdp ? Math.ceil(n / 2) : n),
					{ what: 'the gradient of ' + name, line: null, at: bwdT * (i + 1) / list.length }]);
				// it begins at the loss: nll_loss's gradient and log_softmax's, fp32
				// over the vocabulary, made beside the log-probabilities while every
				// activation is still held, the most backward holds; then the
				// layers in reverse, each letting its activations go as it writes
				// its gradients
				const head = [[here, 'dlogp', 'the log-probabilities’ gradient, fp32', 4 * T * VOCAB,
					{ what: 'the gradient of the log-probabilities', line: null, at: 0 }],
					[here, 'dlogits', 'the fp32 logits’ gradient', 4 * T * VOCAB,
						{ what: 'the gradient of logits.float()', line: null, at: 0 }]];
				const s = stop({ line: at('loss.backward'), short: 'backward', copies: dist ? [c, sync] : [c],
					text: 'twice the forward’s FLOPs, as a backward pass costs (Kaplan et al., 2020)'
						+ (ckpt ? ', and each layer’s forward again to remake the activations it did not keep' : '')
						+ '; it starts at the loss, two fp32 gradients over the vocabulary, '
						+ E.fmt(8 * T * VOCAB / 1e9)
						+ ' GB, beside the log-probabilities and every activation, the most backward holds at once'
						+ '; the activations are then freed as it goes and the gradients written in fp32'
						+ (fsdp
							? '; each layer is gathered whole again in bf16, and its gradients reduce-scattered in fp32 over NVLink, each GPU keeping the average of its half'
							: dist
							? '; DDP all-reduces them in 25 MB buckets over NVLink as backward makes them, so both GPUs end with the same average'
							: ''),
					mem: [{ add: head, after: [[here, 'logp'], [here, 'dlogp'], [here, 'dlogits']] },
						fsdp
							? { free: [['hbm', 'acts']],
								add: [['hbm', 'gather',
										'a layer gathered whole, bf16, and its gradient before reducing, fp32',
										6 * LAYER_P], ...grads], after: [['hbm', 'gather'], ['hbm', 'root']] }
							: { free: [[here, 'acts'], [here, 'cast']], add: grads }] });
				s.span = work(s, 'Tensor cores', c, 'backward', bwdT);
				// the last bucket's all-reduce runs past backward's end
				if (dist) {
					const tail = fsdp ? 0 : time(nvlink(25e6));
					bar(s, 'NVLink', Math.max(s.span[0], s.span[1] - time(sync)),
						s.span[1] + tail, fsdp ? 'all-gather, reduce-scatter' : 'all-reduce');
					gpu += tail;
					s.span[1] += tail;
				}
			}
			{
				// the first step makes the moments a parameter at a time, as AdamW does
				const c = both({ n: 28 * M.params / (fsdp ? 2 : 1), route: ON[device].mem }), add = [];
				if (step === 0) for (const [name, n] of parameters()) for (const moment of ['exp_avg', 'exp_avg_sq'])
					add.push([here, 'adam', 'AdamW’s two moments, fp32' + (fsdp ? ', this GPU’s half' : ''),
						4 * (fsdp ? Math.ceil(n / 2) : n), { what: moment + ' of ' + name, line: null, at: 0 }]);
				const s = stop({ line: at('optimizer.step'), short: 'optimizer.step()', copies: [c],
					text: (step === 0 ? 'AdamW’s first step makes its two moments, a parameter at a time, then reads'
						: 'reads')
						+ ' weights, gradients and both moments and writes three back'
						+ (fsdp ? ', all of them this GPU’s halves' : '')
						+ ': 28 bytes a weight, held by ' + ON[device].memName,
					mem: { add } });
				s.span = work(s, 'HBM', c, 'AdamW');
			}
			stop({ line: at('optimizer.zero_grad'), short: 'zero_grad()', note: true,
				text: onGpu
					? 'nothing for the GPU to do: the gradients are set to None, their memory back in PyTorch’s cache, still held from the device'
					: 'nothing to compute: the gradients are set to None and their memory freed',
				mem: { free: [[here, 'grads']] } });
			if (!onGpu) {
				if (step === 0) stop({ line: at('print('), short: 'loss.item()', note: true, copies: [],
					text: 'step 0 prints: on the CPU every line ran to its end before the next began, so the loss is already a number in DRAM and .item() reads it at once' });
				else note('if step', 'step % 100',
					'step 1 prints nothing, and on the CPU nothing is left to finish: the step ended with its last line');
			} else if (step === 0) {
				const c = { n: 4, route: ['back'] };
				const s = stop({ line: at('print('), short: 'loss.item()', waits: true, copies: [c],
					text: (dist ? 'rank 0 prints at step 0: its' : 'step 0 prints: the')
						+ ' CPU must have the loss as a number, so .item() waits for everything it queued to finish; then 4 bytes cross PCIe back' });
				bar(s, 'CPU', cpu, gpu + time(c), 'waits for the GPU');
				bar(s, 'PCIe', gpu, gpu + time(c), 'the loss');
				gpu += time(c);
				s.span = [s.t, gpu];
				cpu = gpu;
			} else note(dist ? 'if rank' : 'if step', 'step % 100',
				'step 1 prints nothing, so nothing waits: the CPU has queued all of step 1 and goes on to the next batch while the GPU is still '
				+ E.time(gpu - cpu) + ' from finishing it');
		}
		const files0 = [['ssd:model', { where: 'ssd', key: 'model', name: files + ', bf16', n: W16 }],
			['ssd:tokens',
				{ where: 'ssd', key: 'tokens', name: 'tokens.bin, 2 billion uint32 ids', n: 4 * FILE_TOKENS }]];
		const peak = account(stops, bars, here, new Map(files0), 2 * W32 / (fsdp ? 2 : 1));
		const oom = stops[stops.length - 1].oom ? stops[stops.length - 1] : null;
		return { code, stops, bars, T: Math.max(...bars.map(b => b.t1)), peak, oom, place: here,
			knob: code.findIndex(l => /^\s*batch_size ?=/.test(l)),
			toggle: code.findIndex(l => l.includes('gradient_checkpointing_enable')),
			pick: code.findIndex(l => l.includes('"/data/llama')),
			device: code.findIndex(l => l.trim().startsWith('device = "')),
			strategy: code.findIndex(l => l.trim().startsWith('strategy = ')),
			lanes: kind === 'dist' ? [...LANES.slice(0, 4), 'NVLink', ...LANES.slice(4)] : LANES };
	}

	// ---- what is where after each stop, from what was on the SSD before the
	// first, and what the stop changed: its frees, its allocations, then what
	// it freed before returning, in turn for each phase of a stop that has
	// several, as backward does. The first allocation the device's memory
	// cannot take raises OutOfMemoryError, and the run ends there, its bars cut
	// where it failed. Returns the device's peak ----
	function account(stops, bars, here, held, moments) {
		const onDevice = m => [...m.values()].reduce((a, v) => a + (v.where === here ? v.n : 0), 0);
		let peak = null;
		for (const s of stops) {
			const next = new Map(held), fresh = new Set();
			const free = list => {
				for (const [where, key] of list || []) next.delete(where + ':' + key);
			};
			for (const mem of [].concat(s.mem || {})) {
				free(mem.free);
				for (const [where, key, name, n, fail] of mem.add || []) {
					const id = where + ':' + key, used = onDevice(next);
					if (where === here && used + n > CAP[device]) {
						s.oom = { n, used, what: name, line: null, ...fail };
						break;
					}
					next.set(id, { where, key, name, n: (fresh.has(id) ? next.get(id).n : 0) + n });
					fresh.add(id);
					if (!peak || onDevice(next) > peak.n) peak = { n: onDevice(next), step: s.step, stop: s };
				}
				if (s.oom) break;
				free(mem.after);
			}
			s.held = next;
			held = next;
			if (s.oom) {
				const o = s.oom;
				stops.length = s.k + 1;
				for (let i = bars.length - 1; i >= 0; i--) if (bars[i].k > s.k) bars.splice(i, 1);
				if (o.at !== undefined) {
					for (const b of bars) if (b.k === s.k) {
						b.t1 = Math.min(b.t1, b.t0 + o.at);
						b.name = s.short + ', to the failing allocation';
						b.fail = true;
					}
					s.span = [s.span[0], s.span[0] + o.at];
				}
				s.short += ', out of memory';
				s.into = false;
				s.text = 'the allocator asks HBM for ' + torchSize(o.n) + ' for ' + o.what + ' with '
					+ torchSize(HBM_CAP - o.used)
					+ ' free, and PyTorch raises OutOfMemoryError on the CPU as it queues the op'
					+ (s.step === 1 ? '; step 0 fit, before AdamW’s moments took ' + torchSize(moments) : '');
				break;
			}
		}
		return peak;
	}

	// ---- the program's state: the run, the stop, and inside the forward pass
	// the stop there ----
	const LEVEL = { nvme: 'server', stage: 'server', pcie: 'server', back: 'server', gds: 'server',
		nvlink: 'server', ddr: 'server', amx: 'server', hbm: 'package', l2: 'die', smem: 'sm', tc: 'sm' };
	const HELD = { tc: 'the tensor cores', nvme: 'the NVMe SSD', gds: 'the NVMe SSD', hbm: 'HBM',
		stage: 'the CPU’s copy', ddr: 'DDR5', amx: 'the CPU’s AMX tiles', latency: 'latency, before the first byte' };
	const say = exeStatus(root);
	let kind = 'loader', R = run(kind), k = 0, inside = -1, spans = [], depths = [], want = null;
	// the run again, and the forward pass it steps into, at the batch and on the device set
	function rerun() {
		INSIDE = forwardPass(batchSize);
		R = run(kind);
	}
	const cur = () => (inside >= 0 ? INSIDE[inside] : R.stops[k]);
	const laneOf = s => (s.copies && s.copies.length ? E.lay(s.copies[0]).lane : null);
	function heldBy(s) {
		const plan = E.lay(s.copies[0]);
		return HELD[plan.held] || H[plan.held].over;
	}

	// ---- Python as Dark+ colours it: TextMate's scopes with Pylance's semantic
	// tokens over them, and bracket pairs coloured by how deep they sit ----
	const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
	const TOKEN = /(#.*$)|([rbfRBF]{0,2}"(?:[^"\\]|\\.)*"|[rbfRBF]{0,2}'(?:[^'\\]|\\.)*')|(\b\d[\d_]*(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_]\w*)|([()[\]{}])|(\s+)|(.)/g;
	const CONTROL = new Set(['import', 'from', 'as', 'for', 'in', 'while', 'if', 'elif', 'else',
		'with', 'return', 'yield', 'break', 'continue', 'pass', 'raise', 'try', 'except', 'finally']);
	const STORAGE = new Set(['def', 'class', 'lambda', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'self']);
	const MODULES = new Set(['np', 'torch', 'os', 'kvikio', 'dist']);
	const CLASSES = new Set(['range', 'enumerate', 'int', 'DDP']),
		MEMBER_CLASSES = new Set(['memmap', 'autocast', 'uint32', 'device']);
	const tok = (cls, t) => '<span class="' + cls + '">' + esc(t) + '</span>';
	function hl(line, depth = 0) {
		const out = [], toks = [...line.matchAll(TOKEN)], imports = /^\s*(import|from)\b/.test(line);
		let from = /^\s*from\b/.test(line), last = null;
		toks.forEach((m, i) => {
			const t = m[0], prev = i ? toks[i - 1][0] : '',
				ahead = line.slice(m.index + t.length).match(/^\s*(\S)/), next = ahead && ahead[1];
			if (m[6]) return out.push(t);
			if (m[1]) return out.push(tok('m', t));
			if (m[2]) return out.push(string(t));
			if (m[3]) return out.push(tok('n', t));
			if (m[5]) {
				const open = '([{'.includes(t);
				if (!open) depth = Math.max(0, depth - 1);
				out.push(tok('b' + (depth % 3), t));
				if (open) depth++;
				return;
			}
			if (!m[4]) return out.push(tok('o', t));
			const member = prev === '.';
			let cls;
			if (CONTROL.has(t)) {
				cls = 'k';
				if (t === 'import') from = false;
			} else if (STORAGE.has(t)) cls = 's';
			else if (imports && (from || !/^[A-Z]/.test(t))) cls = 'c';
			else if (!member && MODULES.has(t)) cls = 'c';
			else if (member && last === 'c' && next === '.') cls = 'c';
			else if (/^[A-Z][A-Z0-9_]+$/.test(t) && !CLASSES.has(t)) cls = 'u';
			else if (/^[A-Z]/.test(t) || (member ? MEMBER_CLASSES : CLASSES).has(t)) cls = 'c';
			else cls = next === '(' ? 'f' : 'v';
			last = cls;
			out.push(tok(cls, t));
		});
		return { html: out.join(''), depth };
	}
	// a string, and an f-string's fields as code, their format specs as Dark+ marks them
	function string(t) {
		const q = t.search(/["']/), prefix = t.slice(0, q), body = t.slice(q);
		if (!/f/i.test(prefix)) return (prefix ? tok('s', prefix) : '') + tok('q', body);
		return tok('s', prefix) + body.replace(/\{([^{}]*)\}|[^{]+/g, (whole, field) => {
			if (field === undefined) return tok('q', whole);
			let d = 0, cut = field.length;
			for (let i = 0; i < field.length; i++) {
				if ('([{'.includes(field[i])) d++;
				else if (')]}'.includes(field[i])) d--;
				else if (field[i] === ':' && !d) {
					cut = i;
					break;
				}
			}
			return tok('s', '{') + hl(field.slice(0, cut)).html
				+ (cut < field.length ? tok('s', field.slice(cut)) : '') + tok('s', '}');
		});
	}

	// ---- the editor: train.py, or the model's forward when stepped into; the
	// statement in play shaded, the debugger's arrow at its head. In train.py
	// the batch size is a handle and the checkpointing line a switch ----
	const code = $('.trn-code');
	const KNOB = '<span class="n trn-knob" tabindex="0" data-knob="batch" title="Drag sideways or scroll to change the batch size; ↑ and ↓ step it">';
	// a string that opens a list to choose from: the model in /data, and the device
	const pickable = (what, title) => '<span class="q trn-pick" tabindex="0" data-pick="'
		+ what + '" title="' + title + '">';
	// The editor's page, as the tab has it: the file on top, its tab lit and
	// those stepped into shown, its path, its lines coloured and dressed, and
	// the CodeLens over main()
	function fill() {
		const page = serving() ? servePage() : trainPage(),
			on = page.inside.length ? 'in' + page.inside.length : page.tab;
		for (const t of $$('[data-tab]')) t.classList.toggle('on', t.dataset.tab === on);
		$$('[data-tab^="in"]').forEach((t, i) => {
			t.hidden = i >= page.inside.length;
			t.textContent = page.inside[i] || '';
		});
		$('[data-out="path"]').innerHTML = page.path.join('<i>›</i>');
		// a statement runs on until its brackets close
		let depth = 0;
		const rows = page.lines.map(line => {
			const r = hl(line, depth);
			depth = r.depth;
			return r;
		});
		depths = rows.map(r => r.depth);
		const main = page.lens ? page.lines.findIndex(l => l.startsWith('def main')) : -1;
		code.innerHTML = rows.map((r, i) => (i === main ? page.lens : '') + '<li data-line="'
			+ i + '"' + (page.cls(i) ? ' class="' + page.cls(i) + '"' : '')
			+ '><span>' + (i + 1) + '</span><i></i><code>' + page.dress(i, r.html || ' ') + '</code></li>').join('');
		mark();
	}
	// train.py or train_dist.py, or the model's forward stepped into: in a
	// script the batch size a handle, the model, the device and the strategy
	// picks, and the checkpointing line a switch
	function trainPage() {
		const model = inside >= 0;
		return {
			tab: kind === 'dist' ? 'dist' : 'train',
			inside: model ? ['modeling_llama.py'] : [], lines: model ? MODEL : R.code,
			path: model ? ['transformers', 'models', 'llama', 'modeling_llama.py', 'LlamaForCausalLM', 'forward']
				: ['home', 'you', file()],
			lens: model ? '' : lens(['run', 'batch', kind === 'dist' ? 'strategy' : 'device', 'model', 'ckpt']),
			cls: i => (!model && i === R.toggle ? 'trn-switch' : ''),
			dress: (i, html) => {
				if (model) return html;
				if (i === R.knob) {
					html = html.replace('<span class="n">', KNOB) + '<em class="trn-inline" data-out="peak"></em>';
				}
				if (i === R.pick) {
					html = html.replace('<span class="q">', pickable('model', 'Click to choose the model in /data'));
				}
				if (i === R.device) {
					html = html.replace('<span class="q">', pickable('device', 'Click to choose where it runs'));
				}
				if (i === R.strategy) {
					html = html.replace('<span class="q">',
						pickable('strategy', 'Click to choose how the two GPUs share the work'));
				}
				return html;
			},
		};
	}
	// which lines are stops, and what they say; a drag of the handle changes
	// these and the handle's own number, never the lines under the pointer
	function mark() {
		if (serving()) return serveMark();
		const model = inside >= 0, here = model ? INSIDE : R.stops;
		spans = here.map(s => {
			let end = s.last || s.line;
			while (!s.last && end < depths.length - 1 && depths[end] > 0) end++;
			return [s.line, end];
		});
		const owner = i => spans.findIndex(([a, b]) => i >= a && i <= b);
		for (const li of code.querySelectorAll('[data-line]')) {
			const i = +li.dataset.line, o = owner(i), s = here[o], role = s && laneOf(s);
			if (s) li.dataset.stop = o;
			else delete li.dataset.stop;
			li.title = s ? s.text
				: !model && i === R.toggle
				? 'Click to ' + (ckpt ? 'comment out' : 'uncomment') + ' gradient checkpointing, as Ctrl+/ would' : '';
			li.children[1].style.background = role && i === s.line ? ROLE[role] : '';
		}
		if (model) return;
		code.querySelector('[data-knob]').textContent = batchSize;
		// the debugger's inline value: the run's peak in HBM, or where it fails
		$('[data-out="peak"]').textContent = R.oom ? 'OutOfMemoryError in step ' + R.oom.step
			: 'peak ' + E.bytes(R.peak.n) + ' of ' + E.bytes(CAP[device]) + ', step ' + R.peak.step;
	}
	function edit() {
		if (serving()) return serveEdit();
		const s = cur(), [a, b] = spans[inside >= 0 ? inside : k];
		const lines = inside >= 0 ? MODEL : R.code, text = lines[s.line],
			col = text.length - text.trimStart().length + 1;
		$('[data-out="lncol"]').textContent = 'Ln ' + (s.line + 1) + ', Col ' + col + '    Python 3.12';
		const f = R.stops[k], when = f.step === null ? 'before the loop' : 'step ' + f.step;
		$('[data-out="where"]').textContent = 'Python Debugger  ·  ' + (kind === 'dist' ? 'rank 0, ' : '')
			+ (inside >= 0 ? when + ', in forward from line ' + (f.line + 1) : when)
			+ (s.oom ? '  ·  OutOfMemoryError' : '');
		reveal(a, b, exception(s, b));
		transport();
	}
	// The statement from line a to line b shaded, the debugger's arrow at its
	// head; out of view, it is brought to the middle, as VS Code reveals the
	// line a debugger stops on, and with a widget under it, the widget too
	function reveal(a, b, widget) {
		for (const li of code.querySelectorAll('[data-line]')) {
			const i = +li.dataset.line;
			li.classList.toggle('on', i >= a && i <= b);
			li.classList.toggle('head', i === a);
		}
		const first = code.querySelector('[data-line="' + a + '"]'), box = code.parentElement;
		const bottom = widget ? widget.offsetTop + widget.offsetHeight
			: code.querySelector('[data-line="' + b + '"]').offsetTop + first.offsetHeight;
		if (first.offsetTop < box.scrollTop || bottom > box.scrollTop + box.clientHeight) {
			box.scrollTop = widget ? Math.min(first.offsetTop - 60, bottom - box.clientHeight + 8)
				: first.offsetTop - (box.clientHeight - (bottom - first.offsetTop)) / 2;
		}
	}
	// the debugger's exception widget under the line that raised: PyTorch's
	// message, at this accounting's sizes, and the traceback, abridged
	function exception(s, b) {
		const was = code.querySelector('.trn-exc');
		if (was) was.remove();
		if (!s.oom) return null;
		const o = s.oom, used = torchSize(o.used);
		const frames = [['/home/you/' + file(), s.line, '<module>', R.code[s.line]]];
		if (o.line !== null) {
			frames.push(['/home/you/.venv/lib/python3.12/site-packages/transformers/models/llama/modeling_llama.py',
				o.line, 'forward', MODEL[o.line]]);
		}
		const li = document.createElement('li');
		li.className = 'trn-exc';
		li.innerHTML = '<p><b>Exception has occurred: OutOfMemoryError</b><button type="button" title="Close">×</button></p><p>CUDA out of memory. Tried to allocate '
			+ torchSize(o.n)
			+ '. GPU 0 has a total capacity of ' + torchSize(HBM_CAP) + ' of which '
			+ torchSize(HBM_CAP - o.used) + ' is free. Including non-PyTorch memory, this process has ' + used
			+ ' memory in use. Of the allocated memory ' + used
			+ ' is allocated by PyTorch, and 0 bytes is reserved by PyTorch but unallocated.</p><pre>'
			+ frames.map(([file, line, fn, text]) => '  File "' + file + '", line ' + (line + 1)
					+ ', in ' + esc(fn) + '\n    ' + esc(text.trim())).join('\n') + '</pre>';
		li.querySelector('button').addEventListener('click', () => li.remove());
		code.querySelector('[data-line="' + b + '"]').after(li);
		return li;
	}

	// ---- memory: the device's through the whole run, HBM on the GPU and DRAM
	// on the CPU, a column a line stacked by kind against what it holds, the
	// line in play outlined and the lines to come faint, a line that changes
	// nothing there given a narrow column. A hover lists a column's tensors and
	// a click runs to its line. Beneath it, what the other places hold ----
	// the kinds in the white paper's Figure 2 colours, checked for colour-blind readers
	const KINDS = [['weights', 'Weights', '#2a78d6'], ['adam', 'AdamW', '#eb6834'],
		['grads', 'Gradients', '#6250d6'], ['acts', 'Activations', '#1baf7a'],
		['logits', 'Logits', '#eda100'], ['batch', 'Batch', '#22a6b3'], ['buckets', 'DDP’s buckets', '#9d93e8'],
		['data', 'tokens.bin', '#7d8590'], ['cache', 'Page cache', '#5c636e']];
	const KIND = { w: 'weights', wroot: 'weights', root: 'weights', gather: 'weights', buckets: 'buckets', adam: 'adam',
		grads: 'grads', acts: 'acts', cast: 'weights', logits: 'logits',
		logits32: 'logits', logp: 'logits', dlogp: 'logits', dlogits: 'logits',
		ids: 'batch', b1: 'batch', ahead: 'batch', tokens: 'data', cache: 'cache', pages: 'cache' };
	const PLACES_HELD = [['hbm', 'HBM', 'cuda:0', CAP.cuda], ['pinned', 'pinned DRAM', 'cpu, pinned', CAP.cpu],
		['dram', 'DRAM', 'cpu', CAP.cpu], ['ssd', 'the SSD', '/data', 3.84e12]];
	const area = $('.trn-area'), mtip = $('.trn-mtip');
	const inPlace = (s, where) => [...s.held.values()].filter(v => v.where === where);
	const total = list => list.reduce((a, v) => a + v.n, 0);
	const ofKind = (s, kd) => total(inPlace(s, R.place).filter(v => KIND[v.key] === kd));
	let cols = [];
	// The panel's read-out, its key and what the other places hold, as the tab
	// has them, then the chart
	function memory() {
		const m = serving() ? serveMemory() : trainMemory();
		$('.trn-read').classList.toggle('err', !!m.err);
		$('[data-out="hbm-now"]').textContent = m.now;
		$('[data-out="hbm-of"]').innerHTML = m.of;
		$('.trn-key').innerHTML = m.keys.map(x => '<li' + (x.err ? ' class="err"' : '')
			+ (x.title ? ' title="' + esc(x.title) + '"' : '') + '><i style="background:' + x.colour
			+ (x.hatched ? ';opacity:0.6' : '') + '"></i>' + x.label + '<output>' + E.bytes(x.n) + '</output></li>')
		.join('');
		$('.trn-rest').innerHTML = m.rest.map(([label, n, cap]) => '<li><span>'
			+ label + '</span><output>' + E.bytes(n) + '</output><b><i style="width:'
			+ Math.max(0.5, 100 * n / cap).toFixed(2) + '%"></i></b></li>').join('');
		plot();
	}
	function trainMemory() {
		const s = R.stops[k], [, name, dev] = PLACES_HELD.find(p => p[0] === R.place);
		return {
			err: !!s.oom,
			now: s.oom ? 'out of memory' : E.bytes(total(inPlace(s, R.place))),
			of: esc(s.oom ? torchSize(s.oom.n) + ' asked, ' + torchSize(CAP[device] - s.oom.used) + ' free'
				: 'of ' + E.bytes(CAP[device]) + ' in ' + name + ', ' + dev + (kind === 'dist' ? ', rank 0' : '')),
			keys: KINDS.filter(([kd]) => ofKind(s, kd))
				.map(([kd, label, colour]) => ({ label, colour, n: ofKind(s, kd) }))
				.concat(s.oom ? [{ label: 'Not allocated', colour: '#e5484d', n: s.oom.n, err: true }] : []),
			rest: PLACES_HELD.filter(p => p[0] !== R.place)
				.map(([where, , label, cap]) => [label, total(inPlace(s, where)), cap]),
		};
	}
	// The chart's columns, each a stack of [colour, n] from the foot, a
	// pixel apart, those after the one at faint
	function columns(cx, list, stack, Y, at) {
		list.forEach((c, i) => {
			const w = c.x1 - c.x0 - 1;
			let acc = 0;
			cx.globalAlpha = at !== null && i > at ? 0.22 : 1;
			for (const [colour, n] of stack(i)) {
				if (!n) continue;
				cx.fillStyle = colour;
				cx.fillRect(c.x0, Y(acc + n), w, Y(acc) - Y(acc + n));
				acc += n;
			}
			cx.globalAlpha = 1;
		});
	}
	// a peak dotted across from x0, named beside x where there is room, on
	// the panel's ground; below the line where a capacity's name sits close
	// above it
	function peakLine(cx, W, y, x, label, x0 = 0, below = false) {
		cx.strokeStyle = '#c9ced6';
		cx.lineWidth = 1;
		cx.setLineDash([1, 2]);
		cx.beginPath();
		cx.moveTo(x0, y);
		cx.lineTo(W, y);
		cx.stroke();
		cx.setLineDash([]);
		const lw = cx.measureText(label).width, lx = x - 5 > lw + 4 ? x - 5 : W - 2, ly = below ? y + 10 : y - 3;
		cx.fillStyle = 'rgba(30, 30, 30, 0.85)';
		cx.fillRect(lx - lw - 2, ly - 8, lw + 4, 10);
		cx.fillStyle = '#c9ced6';
		cx.textAlign = 'right';
		cx.fillText(label, lx, ly);
		cx.textAlign = 'left';
	}
	// what the memory holds, dashed across and named at its left
	function capLine(cx, W, y, label) {
		cx.strokeStyle = '#e8eaed';
		cx.lineWidth = 1;
		cx.setLineDash([3, 3]);
		cx.beginPath();
		cx.moveTo(0, Math.round(y) + 0.5);
		cx.lineTo(W, Math.round(y) + 0.5);
		cx.stroke();
		cx.setLineDash([]);
		cx.fillStyle = '#c9ced6';
		cx.fillText(label, 2, y - 3);
	}
	function plot() {
		const { cx, W, H } = fitCanvas(area);
		if (serving()) return servePlot(cx, W, H);
		const m = { t: 8, b: 14 }, used = R.stops.map(t => total(inPlace(t, R.place)));
		// scaled to the run; the capacity drawn where it is in reach, as HBM's is,
		// and only named where it is far above, as 2 TiB of DRAM is
		const top = Math.max(R.peak ? R.peak.n : 0, ...R.stops.map((t, i) => used[i] + (t.oom ? t.oom.n : 0))),
			cap = CAP[device], reach = cap < 4 * top;
		const peak = (reach ? Math.max(cap, top) : top) * 1.08;
		const Y = v => H - m.b - (H - m.t - m.b) * v / peak;
		const wide = R.stops.map((t, i) => (!i || t.oom || used[i] !== used[i - 1] ? 1 : 0.35)),
			unit = W / wide.reduce((a, w) => a + w, 0);
		let x = 0;
		cols = wide.map(w => {
			const c = { x0: x, x1: x + w * unit };
			x = c.x1;
			return c;
		});
		// the steps, step 1 in a band
		cx.font = '9px Menlo, Monaco, monospace';
		cx.textBaseline = 'alphabetic';
		cx.textAlign = 'left';
		for (const st of [0, 1]) {
			const i = R.stops.findIndex(t => t.step === st);
			if (i < 0) continue;
			if (st) {
				cx.fillStyle = 'rgba(255, 255, 255, 0.04)';
				cx.fillRect(cols[i].x0, m.t, W - cols[i].x0, H - m.t - m.b);
			}
			cx.fillStyle = '#6f7680';
			cx.fillText('STEP ' + st, cols[i].x0 + 3, H - 3);
		}
		columns(cx, cols,
			i => KINDS.map(([kd, , c]) => [c, ofKind(R.stops[i], kd)])
				.concat([['#e5484d', R.stops[i].oom ? R.stops[i].oom.n : 0]]), Y, k);
		// the line in play
		cx.strokeStyle = '#ffffff';
		cx.lineWidth = 1.5;
		cx.strokeRect(cols[k].x0 - 0.5, m.t - 2, cols[k].x1 - cols[k].x0, H - m.t - m.b + 2);
		// the run's peak, which a line may reach and free before it ends, as
		// the loss does its logits: what it held only while it ran, hollow
		// above its bar, and the peak across, named on the right and clear of
		// a capacity named far above
		if (R.peak && !R.oom) {
			const i = R.stops.indexOf(R.peak.stop), y = Math.round(Y(R.peak.n)) + 0.5;
			cx.strokeStyle = '#c9ced6';
			cx.lineWidth = 1;
			if (R.peak.n > used[i]) {
				cx.strokeRect(Math.round(cols[i].x0) + 0.5, y, Math.round(cols[i].x1 - cols[i].x0) - 2, Y(used[i]) - y);
			}
			peakLine(cx, W, y, cols[i].x0,
				'peak ' + E.bytes(R.peak.n) + ' in line ' + (R.peak.stop.line + 1) + ', step ' + R.peak.step,
				reach ? 0 : cx.measureText(E.bytes(cap) + ' far above').width + 8, reach && Y(R.peak.n) - Y(cap) < 12);
		}
		cx.fillStyle = '#c9ced6';
		if (!reach) {
			cx.fillText(E.bytes(cap) + ' far above', 2, m.t + 8);
			return;
		}
		capLine(cx, W, Y(cap), E.bytes(cap));
	}
	const column = e => {
		const r = area.getBoundingClientRect(), x = e.clientX - r.left;
		return cols.findIndex(c => x >= c.x0 && x < c.x1);
	};
	// a stop's tensors, largest first; serve.py's span, the kinds of slot
	// as it ends
	function columnTip(i) {
		if (serving()) {
			const sp = SV.spans[i], slots = sp.cache && sp.cache.slots;
			return '<b>' + spanName(sp) + '</b>' + (slots ? KV_KINDS.filter(([key]) => slots[key] > 0)
				.map(([key, label]) => '<p><span>' + label + '</span><output>'
						+ E.bytes(slots[key] * perToken()) + '</output></p>').join('') : '');
		}
		const t = R.stops[i],
			rows = inPlace(t, R.place).sort((a, b) => b.n - a.n)
				.map(v => '<p><span>' + esc(v.name) + '</span><output>' + E.bytes(v.n) + '</output></p>');
		if (t.oom) {
			rows.unshift('<p><span>' + esc(t.oom.what)
				+ ', not allocated</span><output>' + E.bytes(t.oom.n) + '</output></p>');
		}
		return '<b>line ' + (t.line + 1) + (t.step === null ? '' : ', step ' + t.step)
			+ ': ' + esc(t.short) + '</b>' + rows.join('');
	}
	area.addEventListener('mousemove', e => {
		const i = column(e);
		mtip.hidden = i < 0;
		if (i < 0) return;
		mtip.innerHTML = columnTip(i);
		const box = mtip.parentElement.getBoundingClientRect(), r = area.getBoundingClientRect();
		mtip.style.left = Math.min(e.clientX - box.left + 12, box.width - mtip.offsetWidth - 4) + 'px';
		mtip.style.top = Math.max(4, r.top - box.top + 4) + 'px';
	});
	area.addEventListener('mouseleave', () => { mtip.hidden = true; });
	// a click runs to the column's line; serve.py's, to the last step of its span
	area.addEventListener('click', e => {
		const i = column(e), to = i < 0 ? -1 : serving() ? SV.spans[i].last : i;
		if (to < 0) return;
		leave();
		go(to);
	});

	// the panel on the render: the line and how long it takes, and on ? whether
	// the CPU waits, what holds it and what the line does; it stays as the
	// reader left it
	const hudPanel = $('.trn-hud');
	let explaining = false;
	try {
		explaining = localStorage.getItem('device.exe:explain') === 'open';
	} catch (e) {}
	function explain(on = !explaining) {
		explaining = on;
		hudPanel.classList.toggle('open', on);
		$('[data-act="explain"]').setAttribute('aria-expanded', String(on));
		try {
			localStorage.setItem('device.exe:explain', on ? 'open' : 'shut');
		} catch (e) {}
	}
	function hud() {
		const h = serving() ? serveHud() : trainHud();
		hudPanel.classList.toggle('idle', !busy.tc && !busy.hbm);
		$('[data-out="swatch"]').style.background = h.swatch;
		$('[data-out="short"]').textContent = h.short;
		$('[data-out="time"]').textContent = h.time;
		$('[data-out="cpu"]').textContent = h.cpu;
		$('[data-out="held"]').textContent = h.held;
		$('[data-out="tc"]').style.width = (100 * busy.tc).toFixed(1) + '%';
		$('[data-out="hbm"]').style.width = (100 * busy.hbm).toFixed(1) + '%';
		$('[data-out="tcp"]').textContent = Math.round(100 * busy.tc) + '%';
		$('[data-out="hbmp"]').textContent = Math.round(100 * busy.hbm) + '%';
		$('[data-out="text"]').textContent = h.text;
	}
	function trainHud() {
		const s = cur(), role = laneOf(s);
		let time = '';
		if (inside >= 0 && s.copies) {
			const one = s.copies.reduce((a, c) => a + E.lay(c).T, 0), times = (s.copies[0] || {}).k;
			time = s.copies.length ? E.time(one) + (times ? ' a layer, ' + E.time(one * times) + ' in all' : '') : '';
		} else if (s.span && s.span[1] > s.span[0]) time = E.time(s.span[1] - s.span[0]);
		return {
			swatch: role ? ROLE[role] : 'transparent', short: s.short,
			// at the machine's peak rates, so the least the line can take
			time: time && '≥ ' + time,
			cpu: inside >= 0 ? 'on the ' + (device === 'cpu' ? 'CPU' : 'GPU') + ', inside the forward pass'
				: s.oom ? 'raised on the CPU as it queues the op, so the GPU never runs it'
				: s.note ? 'on the CPU; nothing for the GPU to move'
				: device === 'cpu' && s.copies.some(c => c.route.includes('ddr'))
				? 'the CPU does it itself, and the next line waits for it'
				: s.waits ? 'the CPU waits for it'
				: !s.copies.length ? 'ready, so the CPU takes it at once'
				: 'the CPU queues it and moves on; the GPU runs it from ' + E.time(s.span[0]),
			held: s.copies && s.copies.length ? 'held by ' + heldBy(s) : '', text: s.text,
		};
	}

	// ---- the timeline, floating over the render's foot in the stage's own
	// colours: a lane a part, the line's bars lit and the rest faint, the CPU
	// where it is and how far behind it the GPU's queued work runs. The wheel
	// zooms, a click runs the line a bar belongs to, T hides it ----
	const lanes = $('.trn-lanes'), tip = $('.trn-tip');
	const LEFT = 96, TOP = 20;
	let ROW = 17;
	const LANE_HUE = { ...ROLE, Workers: ROLE.CPU };
	const GPU_LANES = new Set(['PCIe', 'HBM', 'Tensor cores']);
	let range = null, geo = null;
	// where the timeline's time runs, for the wheel: its margins and its length
	let laneBox = null;
	function drawLanes() {
		if (root.classList.contains('bare')) return;
		if (serving()) return drawRequests();
		const { cx, W, H } = fitCanvas(lanes);
		laneBox = { left: LEFT, right: 18, T: R.T };
		const [v0, v1] = range || [0, R.T];
		const X = v => LEFT + (W - LEFT - 18) * (v - v0) / (v1 - v0);
		ROW = Math.min(17, (H - TOP - 30) / R.lanes.length);
		const bot = TOP + R.lanes.length * ROW, out = [];
		cx.textBaseline = 'middle';
		cx.font = '9px Menlo, Monaco, monospace';
		R.lanes.forEach((name, i) => {
			const y = TOP + i * ROW;
			cx.fillStyle = 'rgba(232, 235, 231, 0.55)';
			cx.textAlign = 'left';
			cx.fillText(name.toUpperCase(), 12, y + ROW / 2);
			cx.fillStyle = 'rgba(232, 235, 231, 0.07)';
			cx.fillRect(LEFT, y + ROW / 2, W - LEFT - 18, 1);
		});
		cx.save();
		cx.beginPath();
		cx.rect(LEFT, 0, W - LEFT - 18, H);
		cx.clip();
		// the steps: step 0 in a band, each named
		const from = st => (R.stops.find(t => t.step === st) || {}).t;
		if (from(0) !== undefined) {
			cx.fillStyle = 'rgba(232, 235, 231, 0.035)';
			cx.fillRect(X(from(0)), TOP - 6, X(from(1) === undefined ? R.T : from(1)) - X(from(0)), bot - TOP + 6);
		}
		// each named where it begins, a name giving way to the next where they would meet
		cx.fillStyle = 'rgba(232, 235, 231, 0.4)';
		const names = [[0, 'BEFORE THE LOOP'], [from(0), 'STEP 0'],
			[from(1), 'STEP 1']].filter(([t]) => t !== undefined);
		names.forEach(([t, name], i) => {
			const after = names[i + 1];
			if (!after || X(t) + 4 + cx.measureText(name).width + 8 < X(after[0])) cx.fillText(name, X(t) + 4, 9);
		});
		// the bars, the line's lit and the rest faint
		for (const b of R.bars) {
			const i = R.lanes.indexOf(b.lane), y = TOP + i * ROW + 4, x0 = X(b.t0),
				x1 = Math.max(X(b.t1), x0 + 2), mine = b.k === k, hue = LANE_HUE[b.lane];
			cx.save();
			cx.globalAlpha = mine ? 1 : 0.28;
			if (mine) {
				cx.shadowColor = hue;
				cx.shadowBlur = 10;
			}
			// the CPU waiting and the workers' reading drawn open, as time held rather than work done
			if (b.lane === 'Workers' || b.name.startsWith('waits')) {
				cx.strokeStyle = hue;
				cx.lineWidth = 1;
				cx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, ROW - 9);
			} else {
				cx.fillStyle = hue;
				cx.fillRect(x0, y, x1 - x0, ROW - 8);
			}
			cx.restore();
			// a pass cut short by the error ends in red
			if (b.fail) {
				cx.fillStyle = '#e5484d';
				cx.fillRect(x1 - 2, y - 2, 3, ROW - 4);
			}
			out.push({ x0, x1, y: TOP + i * ROW, k: b.k,
				text: R.stops[b.k].short + ': ' + b.name + ', ≥ ' + E.time(b.t1 - b.t0) });
		}
		// inside the forward pass, the line in play's share of it, once a layer
		if (inside >= 0 && INSIDE[inside].copies) {
			const f = R.stops[k], each = s => (s.copies || []).reduce((a, c) => a + E.lay(c).T, 0), order = [INSIDE[0]];
			for (let l = 0; l < M.layers; l++) for (const s of INSIDE.slice(2, 7)) order.push(s);
			order.push(INSIDE[7]);
			let t = f.span[0];
			const y = TOP + R.lanes.indexOf((R.bars.find(b => b.k === k) || { lane: 'Tensor cores' }).lane) * ROW;
			cx.fillStyle = 'rgba(255, 255, 255, 0.85)';
			for (const s of order) {
				const dt = each(s);
				if (s === INSIDE[inside]) cx.fillRect(X(t), y + 2, Math.max(1, X(t + dt) - X(t)), ROW - 4);
				t += dt;
			}
		}
		// the CPU, and the GPU's queued work behind it
		const s = R.stops[k], cpu = X(s.t);
		const gpu = Math.max(0, ...R.bars.filter(b => b.k <= k && GPU_LANES.has(b.lane)).map(b => b.t1)), gx = X(gpu);
		cx.fillStyle = '#ffffff';
		cx.fillRect(Math.round(cpu), TOP - 6, 1, bot - TOP + 8);
		const y = bot + 10;
		cx.font = '10px Menlo, Monaco, monospace';
		cx.textAlign = 'center';
		cx.fillText('CPU', Math.max(LEFT + 12, Math.min(cpu, W - 32)), y);
		if (gpu > s.t + 1e-6) {
			cx.strokeStyle = LANE_HUE['Tensor cores'];
			cx.setLineDash([3, 2]);
			cx.beginPath();
			cx.moveTo(Math.round(gx) + 0.5, TOP - 6);
			cx.lineTo(Math.round(gx) + 0.5, bot + 2);
			cx.stroke();
			cx.setLineDash([]);
			cx.beginPath();
			cx.moveTo(cpu + 14, y);
			cx.lineTo(gx - 2, y);
			cx.stroke();
			// named past the GPU's mark, or before the CPU's where the band ends first
			const text = 'GPU ' + E.time(gpu - s.t) + ' behind', fits = gx + 6 + cx.measureText(text).width < W - 18;
			cx.fillStyle = LANE_HUE['Tensor cores'];
			cx.textAlign = fits ? 'left' : 'right';
			cx.fillText(text, fits ? gx + 6 : cpu - 16, y);
		}
		cx.restore();
		// the time, and how to move along it
		const span = v1 - v0, unit = 10 ** Math.floor(Math.log10(span / 6));
		const tick = unit * [1, 2, 5, 10].find(n => span / (unit * n) <= 8);
		cx.font = '9px Menlo, Monaco, monospace';
		cx.fillStyle = 'rgba(232, 235, 231, 0.4)';
		cx.textAlign = 'center';
		for (let v = Math.ceil(v0 / tick) * tick; v <= v1 + 1e-12; v += tick) {
			cx.fillText(v < 1e-12 ? '0' : E.time(v), X(v), H - 8);
		}
		cx.textAlign = 'left';
		cx.fillText(range ? 'double-click: all' : 'wheel: zoom', 12, H - 8);
		cx.fillText('T: hide', 12, 9);
		geo = out;
	}
	lanes.addEventListener('wheel', e => {
		e.preventDefault();
		const { left, right, T } = laneBox, r = lanes.getBoundingClientRect(), [v0, v1] = range || [0, T];
		const atT = v0 + (v1 - v0) * Math.max(0, (e.clientX - r.left - left) / (r.width - left - right));
		const w = Math.min(T, Math.max(1e-7, (v1 - v0) * (e.deltaY > 0 ? 1.4 : 1 / 1.4)));
		const lo = Math.max(0, Math.min(T - w, atT - (atT - v0) * w / (v1 - v0)));
		range = w >= T ? null : [lo, lo + w];
		drawLanes();
	}, { passive: false });
	lanes.addEventListener('dblclick', () => {
		range = null;
		drawLanes();
	});
	const hit = (x, y) => geo
		&& geo.find(b => x >= b.x0 - 2 && x <= Math.max(b.x1, b.x0 + 3) + 2 && y >= b.y && y <= b.y + ROW);
	lanes.addEventListener('click', e => {
		if (serving()) return requestClick(e);
		const r = lanes.getBoundingClientRect(), b = hit(e.clientX - r.left, e.clientY - r.top);
		if (!b) return;
		leave();
		go(b.k);
	});
	lanes.addEventListener('mousemove', e => {
		if (serving()) return requestHover(e);
		const r = lanes.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, b = hit(x, y);
		tip.hidden = !b;
		if (!b) return;
		tip.textContent = b.text;
		tip.style.left = Math.min(x + 12, r.width - 270) + 'px';
		tip.style.top = Math.max(2, y - 30) + 'px';
	});
	lanes.addEventListener('mouseleave', () => {
		tip.hidden = true;
		if (!serving() || SV.hover < 0) return;
		SV.hover = -1;
		picked();
	});

	// ---- serve.py, the third script: vLLM's engine fed thirty chats and run
	// an engine step at a time. Its run is ServeEngine's, scheduler.exe's
	// engine: Llama 3.1 70B over both H100s, tensor parallel, each step timed
	// by the roofline; served to its end at once and its blocks traced, so
	// that what a step took and freed can be read off it. The machine, the
	// editor, the panels and the timeline are device.exe's own; where serve.py
	// differs they ask these sections. The code for static batches is
	// transformers', whose cache is bf16 here, so static batches run at bf16
	// whatever the dtype set ----
	const SE = ServeEngine, BLOCK = SE.BLOCK;
	// thirty chats, two a second, served first as static batches, the oldest
	// way, so that each newer scheduler picked shows what it makes better; a
	// light load, which keeps the timeline's rows within train.py's lanes;
	// played at two seconds of the run a second
	const SV = { at: { ...SE.HOME, sched: 'static', count: 30, speed: 2 }, run: null, k: 0,
		frames: [{ file: 'serve', at: 0 }], stops: [], file: null,
		spans: [], pick: -1, hover: -1, playing: false, clock: 0, wall: 0 };
	const serving = () => kind === 'serve';
	const FACTS = new Map();
	function serveRun() {
		const at = SV.at;
		SV.run = SE.simulate({ ...at, kv: at.sched === 'static' ? 2 : at.kv, trace: true });
		FACTS.clear();
		SV.rows = null;
	}
	// requests are named as scheduler.exe names them, from 1; the one picked
	// on the timeline, or under the pointer there, is lit wherever it is named
	const lit = () => (SV.hover >= 0 ? SV.hover : SV.pick);
	const ids = list => list.map(id => '<b data-id="' + id + '">#' + (id + 1) + '</b>').join(', ');
	const plural = (n, one, many = one + 's') => int(n) + ' ' + (n === 1 ? one : many);
	const sorted = (list, t) => {
		let lo = 0, hi = list.length - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			if (list[mid] === t) return true;
			if (list[mid] < t) lo = mid + 1;
			else hi = mid - 1;
		}
		return false;
	};
	// Why the head of the queue still waits, as the engine found it when the
	// step's admission stopped, in vLLM 0.11's order of reasons: a step that
	// preempts admits no one; the step's tokens all given out; max_num_seqs
	// running; a static batch takes no one in till it ends; or the cache. One
	// come while the step ran is said nowhere: the scheduler's stops come
	// before it did. Prefill first runs the decodes only when no prompt joins,
	// so a step of its that preempts says why none did
	const WHY = {
		arrived: () => '',
		batch: h => ids([h.id]) + ' waits for the next batch',
		preempted: h => (SV.at.sched !== 'prefill' ? 'none admitted in a step that preempted'
			: h.refused ? WHY[h.refused.reason](h.refused) : ''),
		budget: h => (h.left
			? ids([h.id]) + '’s whole prompt, ' + plural(h.tokens, 'token') + ', is more than the '
				+ int(h.left) + ' left of the budget' : 'the token budget is spent'),
		seqs: () => 'max_num_seqs is reached',
		cache: h => (SV.run.alloc === 'contiguous'
			? ids([h.id]) + ' needs a run of ' + int(h.run) + ' blocks, its prompt and max_tokens, and '
				+ int(h.free) + ' are free' + (h.free >= h.run ? ', but the longest run is ' + int(h.longest) : '')
			: (SV.at.sched === 'prefill' ? '' : 'None: ') + ids([h.id]) + ' needs ' + plural(h.need, 'new block')
				+ (h.chunk < h.tokens ? ' for its first ' + int(h.chunk) + ' tokens' : '')
				+ (h.hits ? ' past its ' + plural(h.hits, 'cached block') : '') + ', and ' + int(h.room) + ' are free'),
	};
	// A step's facts, read once: its rows as the scheduler gave them tokens;
	// the blocks taken fresh, from the trace, a block given an owner, one
	// reference and no key; those freed by preemption, the system prompt's left
	// to the others sharing them; who waited through it, who arrived before it,
	// who had a token from it; and why the waiting stopped where it did
	function facts(i) {
		let f = FACTS.get(i);
		if (f) return f;
		const run = SV.run, s = run.steps[i], before = run.steps[i - 1], reqs = run.S.reqs, joined = new Set(s.joined);
		const rows = s.seqs.map(([id, n, ctx, kind]) => ({ id, n, ctx, kind, joined: joined.has(id) }));
		const of = kind => rows.filter(r => r.kind === kind);
		const taken = new Map();
		for (const [, owner, ref, kd] of s.blocks) {
			if (owner >= 0 && ref === 1 && kd === SE.KEY.none) taken.set(owner, (taken.get(owner) || 0) + 1);
		}
		const own = id => {
			const b = before && before.bands.find(x => x.id === id);
			return b ? b.held - b.shared : 0;
		};
		const running = rows.filter(r => !r.joined), admitted = rows.filter(r => r.joined),
			add = (list, g) => list.reduce((a, r) => a + g(r), 0);
		f = {
			s, rows, running, admitted, tokens: add(rows, r => r.n),
			decodes: of('decode'), prompts: of('prefill').filter(r => r.n > 0),
			again: of('recompute'), stalled: of('stall'), padding: of('pad'),
			takenRunning: add(running, r => taken.get(r.id) || 0),
			takenAdmitted: add(admitted, r => taken.get(r.id) || 0),
			freedOut: s.out.reduce((a, id) => a + own(id), 0), used: s.used,
			queue: SE.queueAt(run, s.t0 + 1e-9).map(([r]) => r.id),
			arrived: reqs.filter(r => r.arrival > (before ? before.t1 : -Infinity) && r.arrival <= s.t0).map(r => r.id),
			emitted: rows.filter(r => sorted(reqs[r.id].times, s.t1)).map(r => r.id),
			firsts: rows.filter(r => reqs[r.id].first === s.t1).map(r => r.id),
			why: s.head ? WHY[s.head.reason](s.head) : '',
		};
		FACTS.set(i, f);
		return f;
	}
	// the step named as its rows make it up
	function stepName(i) {
		const f = facts(i);
		if (SV.at.sched === 'static') {
			if (f.prompts.length) return plural(f.rows.length, 'prompt') + ', padded to ' + int(f.prompts[0].n);
			return plural(f.rows.length, 'row')
				+ (f.padding.length ? ', ' + int(f.padding.length) + ' of them padding' : ', a token each');
		}
		const parts = [];
		if (f.decodes.length) parts.push(plural(f.decodes.length, 'decode'));
		if (f.prompts.length === 1) parts.push('a ' + int(f.prompts[0].n) + '-token prompt chunk');
		else if (f.prompts.length) parts.push(plural(f.prompts.length, 'prompt chunk')
			+ ', ' + int(f.prompts.reduce((a, r) => a + r.n, 0)) + ' tokens');
		if (f.again.length) parts.push(int(f.again.reduce((a, r) => a + r.n, 0)) + ' tokens computed again');
		return parts.join(' + ') || 'nothing';
	}
	// What a step moves, as copies the machine lights: every weight and the
	// batch's cache read from HBM to the tensor cores on both GPUs, which with
	// the step's FLOPs is the roofline ServeEngine times it by; and the two
	// halves of each layer summed over NVLink, twice a layer as Megatron-style
	// tensor parallelism sums them, tokens × d bf16 values from each GPU each
	// time, lit as busy as that keeps the link through the step. The token ids
	// that cross PCIe, a few kilobytes, are left dark
	const NVLINK = H.nvlink.bw;
	const nvBytes = c => 2 * SE.MODEL.layers * c.tokens * SE.MODEL.d * 2;
	function stepCopies(i) {
		const c = SV.run.steps[i].cost;
		return [{ n: c.weightBytes + c.kvBytes, flops: c.matmul + c.attention, route: GEMM, ways: 2 },
			{ n: nvBytes(c), route: ['nvlink'], ways: 2, util: nvBytes(c) / NVLINK / c.time }];
	}
	// the scheduler's line, the CPU's own work over what it keeps in DRAM
	const SCHEDULING = [{ n: 1, route: ['ddr'], util: 0 }];

	// ---- serve.py: the code. serve.py as the scheduler picked has it, the
	// engine core stepped into, and the scheduler under it; for static batches
	// transformers' own generate loop. A line is its text and what it is: a
	// stop, a value shown beside it as the debugger shows one, or a setting on
	// its first value ----
	// why the 70B: its weights leave each GPU a cache that a heavier load fills,
	// where train.py's 8B, alone on a GPU, would leave room for some 474,000
	// tokens, the 92% of CUDA's 79.19 GiB less its bf16 weights, at 128 KiB a token
	const MODEL_TITLE = () => 'Llama 3.1 70B, its weights split over both GPUs, which leaves each '
		+ E.bytes(SE.numBlocks(2) * BLOCK * SE.kvToken(2) / SE.GPUS)
		+ ' for the cache: little enough that a heavier load, or fewer blocks, makes requests wait. train.py’s 8B on one GPU would leave room for about '
		+ int(Math.round((SE.UTIL * SE.GPU.mem
			- 2 * MODELS['llama-3.1-8b'].params) / (2 * 32 * 8 * 128 * 2) / 1000) * 1000)
		+ ' tokens, far more than these chats hold at once';
	function serveFile() {
		const L = [], add = (text, meta = null) => L.push([text, meta]), at = SV.at;
		if (at.sched === 'static') {
			add('# torchrun --nproc_per_node=2 serve.py');
			add('import torch');
			add('from transformers import AutoModelForCausalLM, AutoTokenizer');
			add('');
			add('from chats import chats, take_batch  # one system prompt, then each chat');
			add('');
			add('');
			add('def main():');
			add('    name = "meta-llama/Llama-3.1-70B-Instruct"', { title: MODEL_TITLE() });
			add('    model = AutoModelForCausalLM.from_pretrained(');
			add('        name, dtype=torch.bfloat16, tp_plan="auto")');
			add('    tokenizer = AutoTokenizer.from_pretrained(name, padding_side="left")');
			add('    tokenizer.pad_token = "<|finetune_right_pad_id|>"  # Llama 3.1 has none');
			add('    max_new_tokens = 2048', { knob: 'reserve' });
			add('    queue = chats(');
			add('        num_prompts=' + SV.at.count + ',');
			add('        request_rate=4,', { knob: 'rate' });
			add('        system_tokens=1024,', { knob: 'system' });
			add('        seed=1,', { knob: 'seed' });
			add('    )');
			add('');
			add('    while queue:');
			add('        # the oldest come, as many as fit the cache at the longest prompt');
			add('        # and max_new_tokens a row, given a second to fill');
			add('        batch = take_batch(', { note: 'batch' });
			add('            queue,');
			add('            wait=1.0,');
			add('            max_rows=1024,', { knob: 'seqs' });
			add('            cache_blocks=2927,', { knob: 'cache' });
			add('        )');
			add('        inputs = tokenizer(');
			add('            [c.prompt for c in batch], padding=True, return_tensors="pt").to("cuda")');
			add('        outputs = model.generate(', { stop: 'gen' });
			add('            **inputs,');
			add('            max_new_tokens=max_new_tokens,');
			add('            do_sample=False,  # the model\'s own config samples');
			add('            pad_token_id=tokenizer.pad_token_id,');
			add('            cache_implementation="static",');
			add('        )');
		} else {
			const v0 = at.sched === 'prefill';
			add('import os');
			add('import time');
			add('');
			if (v0) add('os.environ["VLLM_USE_V1"] = "0"  # vllm<=0.10.2; V0 was removed in 0.11');
			// the engine core in this process, so that step() runs it once;
			// otherwise it runs a loop of its own and step() only collects
			else add('os.environ["VLLM_ENABLE_V1_MULTIPROCESSING"] = "0"  # step() runs the engine core here');
			add('');
			add('from vllm import EngineArgs, LLMEngine, SamplingParams');
			add('');
			add('from chats import chats  # one system prompt, then each chat');
			add('');
			add('');
			add('def main():');
			add('    engine = LLMEngine.from_engine_args(EngineArgs(');
			add('        model="meta-llama/Llama-3.1-70B-Instruct",', { title: MODEL_TITLE() });
			add('        tensor_parallel_size=2,');
			// no longer than the blocks a request can be given: vLLM will not
			// start without room for one request of max_model_len
			add('        max_model_len=' + SV.run.maxLen + ',',
				{ value: 'maxLen',
						title: 'The longest a request may run to: vLLM rejects a prompt this long or longer and cuts an answer at it; no more than the blocks can hold, or vLLM will not start' });
			add('        gpu_memory_utilization=0.92,');
			add('        num_gpu_blocks_override=None,', { knob: 'cache' });
			add('        kv_cache_dtype="auto",', { pick: 'kv' });
			if (SV.run.alloc === 'contiguous') {
				add('        # no such choice in vLLM, which pages its cache: here the cache as');
				add('        # servers before it kept it, a run set aside for prompt and max_tokens');
			}
			add('        enable_prefix_caching=True,', { toggle: 'prefix' });
			if (v0) add('        enable_chunked_prefill=False,');
			add('        max_num_batched_tokens=' + SV.run.budget + ',');
			add('        max_num_seqs=1024,', { knob: 'seqs' });
			add('    ))');
			add('    params = SamplingParams(max_tokens=2048)', { knob: 'reserve' });
			add('    arrivals = chats(');
			add('        num_prompts=' + SV.at.count + ',');
			add('        request_rate=4,', { knob: 'rate' });
			add('        system_tokens=1024,', { knob: 'system' });
			add('        seed=1,', { knob: 'seed' });
			add('    )');
			add('');
			add('    start = time.monotonic()');
			add('    while arrivals or engine.has_unfinished_requests():');
			add('        while arrivals and arrivals[0].at <= time.monotonic() - start:');
			add('            chat = arrivals.pop(0)', { note: 'arrivals' });
			add('            engine.add_request(str(chat.id), chat.prompt, params)');
			add('        for out in engine.step():', { stop: 'step' });
			add('            if out.finished:');
			add('                print(out.request_id, len(out.outputs[0].token_ids))', { note: 'finished' });
		}
		add('');
		add('');
		add('if __name__ == "__main__":');
		add('    main()');
		return { tab: 'serve.py', path: ['home', 'you', 'serve.py'], lines: L };
	}
	const SERVE_FILES = {
		core: () => ({ tab: 'core.py', path: ['vllm', 'v1', 'engine', 'core.py', 'EngineCore', 'step'], lines: [
			['# vllm/v1/engine/core.py (vLLM 0.11), abridged: what engine.step()'],
			['# comes to with the engine core in this process. From 0.12 vLLM'],
			['# schedules the next step while this one runs (async scheduling).'],
			['class EngineCore:'],
			[''],
			['    def step(self) -> tuple[dict[int, EngineCoreOutputs], bool]:'],
			['        if not self.scheduler.has_requests():'],
			['            return {}, False'],
			['        scheduler_output = self.scheduler.schedule()', { stop: 'schedule' }],
			['        model_output = self.model_executor.execute_model(', { stop: 'execute' }],
			['            scheduler_output)'],
			['        engine_core_outputs = self.scheduler.update_from_output(', { stop: 'update' }],
			['            scheduler_output, model_output)'],
			['        return (engine_core_outputs,'],
			['                scheduler_output.total_num_scheduled_tokens > 0)'],
		] }),
		core0: () => ({ tab: 'llm_engine.py', path: ['vllm', 'engine', 'llm_engine.py', 'LLMEngine', 'step'], lines: [
			['# vllm/engine/llm_engine.py, v0, abridged'],
			['class LLMEngine:'],
			[''],
			['    def step(self) -> list[RequestOutput]:'],
			['        seq_group_metadata_list, scheduler_outputs, _ = (', { stop: 'schedule' }],
			['            self.scheduler[0].schedule())'],
			['        execute_model_req = ExecuteModelRequest('],
			['            seq_group_metadata_list=seq_group_metadata_list)'],
			['        outputs = self.model_executor.execute_model(', { stop: 'execute' }],
			['            execute_model_req=execute_model_req)'],
			['        self._process_model_outputs(ctx=self.scheduler_contexts[0])', { stop: 'update' }],
			['        return self.scheduler_contexts[0].request_outputs'],
		] }),
		sched: () => ({ tab: 'scheduler.py',
			path: ['vllm', 'v1', 'core', 'sched', 'scheduler.py', 'Scheduler', 'schedule'], lines: [
			['# vllm/v1/core/sched/scheduler.py (vLLM 0.11), abridged: no prefill'],
			['# or decode phase; each request is given tokens towards catching up'],
			['# with its sequence. From 0.19 a waiting request is admitted only'],
			['# when its whole prompt fits.'],
			['class Scheduler:'],
			[''],
			['    def schedule(self) -> SchedulerOutput:'],
			['        token_budget = self.max_num_scheduled_tokens', { stop: 'budget' }],
			['        num_scheduled_tokens: dict[str, int] = {}'],
			['        preempted_reqs: list[Request] = []'],
			[''],
			['        # First, schedule the RUNNING requests.'],
			['        req_index = 0'],
			['        while req_index < len(self.running) and token_budget > 0:', { stop: 'running' }],
			['            request = self.running[req_index]'],
			['            num_new_tokens = (request.num_tokens -'],
			['                              request.num_computed_tokens)'],
			['            num_new_tokens = min(num_new_tokens, token_budget)', { stop: 'tokens' }],
			['            while True:'],
			['                new_blocks = self.kv_cache_manager.allocate_slots(', { stop: 'alloc' }],
			['                    request, num_new_tokens)'],
			['                if new_blocks is None:'],
			['                    # Out of blocks: the newest gives way.'],
			['                    preempted_req = self.running.pop()', { stop: 'preempt' }],
			['                    self.kv_cache_manager.free(preempted_req)'],
			['                    preempted_req.status = RequestStatus.PREEMPTED'],
			['                    preempted_req.num_computed_tokens = 0'],
			['                    self.waiting.prepend_request(preempted_req)'],
			['                    preempted_reqs.append(preempted_req)'],
			['                    if preempted_req == request:'],
			['                        can_schedule = False'],
			['                        break'],
			['                else:'],
			['                    can_schedule = True'],
			['                    break'],
			['            if not can_schedule:'],
			['                break'],
			['            num_scheduled_tokens[request.request_id] = num_new_tokens'],
			['            token_budget -= num_new_tokens'],
			['            req_index += 1'],
			[''],
			['        # Next, schedule the WAITING requests.'],
			['        if not preempted_reqs:', { stop: 'gate' }],
			['            while self.waiting and token_budget > 0:', { stop: 'waiting' }],
			['                if len(self.running) == self.max_num_running_reqs:'],
			['                    break'],
			['                request = self.waiting.peek_request()'],
			['                new_computed_blocks, num_computed_tokens = ('],
			['                    self.kv_cache_manager.get_computed_blocks(request))', { stop: 'hits' }],
			['                num_new_tokens = request.num_tokens - num_computed_tokens'],
			['                num_new_tokens = min(num_new_tokens, token_budget)'],
			['                new_blocks = self.kv_cache_manager.allocate_slots(', { stop: 'walloc' }],
			['                    request, num_new_tokens, num_computed_tokens,'],
			['                    new_computed_blocks)'],
			['                if new_blocks is None:'],
			['                    break'],
			['                request = self.waiting.pop_request()'],
			['                self.running.append(request)', { stop: 'admit' }],
			['                request.num_computed_tokens = num_computed_tokens'],
			['                num_scheduled_tokens[request.request_id] = num_new_tokens'],
			['                token_budget -= num_new_tokens'],
			[''],
			['        return SchedulerOutput(', { stop: 'return' }],
			['            num_scheduled_tokens=num_scheduled_tokens, ...)'],
		] }),
		sched0: () => ({ tab: 'scheduler.py',
			path: ['vllm', 'core', 'scheduler.py', 'Scheduler', '_schedule_default'], lines: [
			['# vllm/core/scheduler.py, v0, abridged: schedule() comes here with'],
			['# chunked prefill off'],
			['class Scheduler:'],
			[''],
			['    def _schedule_default(self) -> SchedulerOutputs:'],
			['        budget = SchedulingBudget(', { stop: 'budget0' }],
			['            token_budget=self.scheduler_config.max_num_batched_tokens,'],
			['            max_num_seqs=self.scheduler_config.max_num_seqs,'],
			['        )'],
			['        # Whole prompts, the oldest first, while the budget and'],
			['        # the blocks hold them.'],
			['        prefills = self._schedule_prefills(', { stop: 'prefills' }],
			['            budget, enable_chunking=False)'],
			['        # Don\'t schedule decodes if prefills are scheduled.'],
			['        if len(prefills.seq_groups) == 0:', { stop: 'gate0' }],
			['            # A token each; out of blocks, the newest is preempted,'],
			['            # to be computed again.'],
			['            running_scheduled = self._schedule_running(', { stop: 'decodes' }],
			['                budget, enable_chunking=False)'],
			['        return SchedulerOutputs(...)', { stop: 'return' }],
		] }),
		sample: () => ({ tab: 'utils.py',
			path: ['transformers', 'generation', 'utils.py', 'GenerationMixin', '_sample'], lines: [
			['# transformers/generation/utils.py, abridged: generate() comes here to'],
			['# decode greedily'],
			['class GenerationMixin:'],
			[''],
			['    def _sample(self, input_ids, logits_processor, stopping_criteria,'],
			['                generation_config, synced_gpus, **model_kwargs):'],
			['        pad_token_id = generation_config._pad_token_tensor'],
			['        this_peer_finished = False'],
			['        unfinished_sequences = torch.ones('],
			['            input_ids.shape[0], dtype=torch.long, device=input_ids.device)'],
			['        while self._has_unfinished_sequences(', { stop: 'rows' }],
			['                this_peer_finished, synced_gpus, device=input_ids.device):'],
			['            model_inputs = self.prepare_inputs_for_generation('],
			['                input_ids, **model_kwargs)'],
			['            outputs = self(**model_inputs, return_dict=True)', { stop: 'pass' }],
			['            next_tokens = torch.argmax(outputs.logits[:, -1, :], dim=-1)'],
			['            # A finished row is given the pad token, and computed'],
			['            # all the same.'],
			['            next_tokens = (next_tokens * unfinished_sequences', { stop: 'pad' }],
			['                           + pad_token_id * (1 - unfinished_sequences))'],
			['            input_ids = torch.cat([input_ids, next_tokens[:, None]], dim=-1)'],
			['            unfinished_sequences = unfinished_sequences & ~stopping_criteria(', { stop: 'ends' }],
			['                input_ids, None)'],
			['            this_peer_finished = unfinished_sequences.max() == 0'],
			['        return input_ids'],
		] }),
	};
	const serveFileOf = key => (key === 'serve' ? serveFile() : SERVE_FILES[key]());
	// The stops, and the values beside lines: what each says of the step in
	// play (value), whether the step takes it at all (skip), where F11 goes from
	// it (into), and whether the GPUs do it (gpu) or the CPU
	const scheduled = f => plural(f.rows.filter(r => r.n > 0).length, 'request') + ', ' + plural(f.tokens, 'token');
	const STOPS = {
		// serve.py
		step: { gpu: true, into: () => (SV.at.sched === 'prefill' ? 'core0' : 'core'),
			value: f => scheduled(f) + ' · ≥ ' + E.time(f.s.cost.time) },
		arrivals: { value: f => (f.arrived.length ? ids(f.arrived) + ' added' : '') },
		finished: { value: f => (f.s.left.length ? ids(f.s.left) + ' done' : '') },
		batch: { value: f => 'batch ' + (f.s.batch + 1) + ', '
			+ plural(SV.run.batches[f.s.batch].rows, 'row') + (f.why ? '; ' + f.why : '') },
		gen: { gpu: true, into: () => 'sample', value: f => stepName(SV.k) + ' · ≥ ' + E.time(f.s.cost.time) },
		// the engine core
		schedule: { into: () => (SV.at.sched === 'prefill' ? 'sched0' : 'sched'), value: scheduled },
		execute: { gpu: true,
			value: f => '≥ ' + E.time(f.s.cost.time) + ' on both GPUs, held by '
				+ (f.s.cost.bound === 'memory' ? 'HBM' : 'the tensor cores') },
		update: { value: f => plural(f.emitted.length, 'token') + ' out'
			+ (f.firsts.length ? ', the first for ' + ids(f.firsts) : '')
			+ (f.s.left.length ? '; ' + ids(f.s.left) + ' done, blocks freed' : '') },
		// the v1 scheduler
		budget: { value: () => int(SV.run.budget) },
		running: { value: f => plural(f.running.length + f.s.out.length, 'request') + ' running'
			+ (f.stalled.length ? ', ' + int(f.stalled.length) + ' given none: the budget ran out' : '') },
		tokens: { skip: f => !f.running.length, value: f => {
			const parts = [], dec = f.running.filter(r => r.kind === 'decode'),
				chunks = f.running.filter(r => r.kind === 'prefill' && r.n > 0);
			if (dec.length) parts.push('1 each for ' + int(dec.length));
			for (const r of chunks) parts.push(ids([r.id]) + ': ' + int(r.n) + ' of its prompt');
			for (const r of f.again) if (!r.joined) parts.push(ids([r.id]) + ': ' + int(r.n) + ' again');
			return parts.join('; ');
		} },
		alloc: { skip: f => !f.running.length && !f.s.out.length,
			value: f => (SV.run.alloc === 'contiguous' ? 'set aside at admission'
					: f.takenRunning ? '+' + plural(f.takenRunning, 'block') : 'room already, no new block')
			+ (f.s.out.length ? '; then None: no block free, so the newest gives way' : '') },
		preempt: { skip: f => !f.s.out.length,
			value: f => ids(f.s.out) + ' to the head of the queue, ' + (f.s.out.length === 1 ? 'its ' : 'their ')
				+ plural(f.freedOut, 'block') + ' freed, to be computed again' },
		gate: { value: f => (f.s.out.length ? 'False: none admitted this step' : 'True') },
		waiting: { skip: f => f.s.out.length > 0, value: f => {
			const n = f.queue.length + f.admitted.length, head = f.admitted.length ? f.admitted[0].id : f.queue[0];
			return n ? int(n) + ' waiting, the head ' + ids([head]) : 'none waiting';
		} },
		hits: { skip: f => f.s.out.length > 0 || !f.admitted.length,
			value: f => f.admitted.map(r => ids([r.id]) + ': '
						+ (r.ctx ? int(r.ctx / BLOCK) + ' blocks cached' : 'none cached')).join('; ') },
		walloc: { skip: f => f.s.out.length > 0 || (!f.admitted.length && !f.queue.length),
			value: f => (f.admitted.length ? '+' + plural(f.takenAdmitted, 'block') : '')
					+ (f.why ? (f.admitted.length ? '; then ' : '') + f.why : '') },
		admit: { skip: f => f.s.out.length > 0 || !f.admitted.length,
			value: f => ids(f.admitted.map(r => r.id)) + ' join, '
					+ f.admitted.map(r => int(r.n)).join(' + ') + ' tokens' },
		return: { value: f => scheduled(f) + ' of ' + int(SV.run.budget) },
		// the v0 scheduler
		budget0: { value: () => int(SV.run.budget) + ' tokens, ' + int(SV.at.seqs) + ' sequences' },
		prefills: { value: f => (f.admitted.length
				? ids(f.admitted.map(r => r.id)) + ': whole prompts, '
					+ plural(f.admitted.reduce((a, r) => a + r.n, 0), 'token') : 'none')
			+ (f.why ? (f.admitted.length ? '; then ' : ': ') + f.why : '') },
		gate0: { value: f => (f.admitted.length ? 'False: the decodes wait this step' : 'True') },
		decodes: { skip: f => f.admitted.length > 0,
			value: f => plural(f.decodes.length + f.again.length, 'decode')
				+ (f.s.out.length ? '; ' + ids(f.s.out) + ' preempted' : '') },
		// transformers' loop
		rows: { value: f => plural(f.rows.length, 'row') + ', '
			+ int(f.rows.length - f.padding.length) + ' unfinished' },
		pass: { gpu: true, value: f => stepName(SV.k) + ' · ≥ ' + E.time(f.s.cost.time) },
		pad: { value: f => (f.padding.length ? int(f.padding.length) + ' done, given padding' : 'none done yet') },
		ends: { value: f => (f.s.left.length ? ids(f.s.left) + ' end' : 'none ends') },
	};

	// ---- serve.py in the editor: the file on top of the frames stepped into;
	// in serve.py the settings, a value to drag, a string to pick, a switch ----
	const servingTop = () => SV.frames[SV.frames.length - 1];
	// The stops a step takes in the file on top: all its stops but those the
	// step skips; serve.py has the one
	const taken = () => SV.stops.filter(s => !(STOPS[s.key].skip && STOPS[s.key].skip(facts(SV.k))));
	const serveStop = () => taken()[servingTop().at] || taken()[0];
	const SERVE_KNOBS = { rate: 'Requests a second, Poisson arrivals, as vllm bench serve’s --request-rate; inf sends all thirty at once, its default',
		system: 'Tokens every prompt starts with, the same for all',
		reserve: 'The most tokens an answer may run to',
		seqs: 'The most requests a step runs; a static batch’s most rows', seed: 'Another draw of the same workload',
		cache: 'Fewer blocks than the memory holds, to see the cache run short' };
	// a setting's value as Python writes it
	const knobText = key => {
		const v = SV.at[key];
		if (key === 'rate' && v === Infinity) return 'float("inf")';
		if (key !== 'cache') return String(v);
		const all = SE.numBlocks(SV.at.sched === 'static' ? 2 : SV.at.kv);
		return v === 1 ? (SV.at.sched === 'static' ? String(all) : 'None') : String(Math.round(all * v));
	};
	function servePage() {
		const file = serveFileOf(servingTop().file);
		SV.file = file;
		SV.stops = file.lines.map(([, meta], line) => (meta && meta.stop ? { line, key: meta.stop } : null))
			.filter(Boolean);
		return {
			tab: 'serve', inside: SV.frames.slice(1).map(f => serveFileOf(f.file).tab),
			path: file.path, lines: file.lines.map(([text]) => text),
			lens: SV.frames.length === 1
				? lens(SV.at.sched === 'static' ? ['run', 'sched'] : ['run', 'sched', 'alloc', 'prefix', 'kv']) : '',
			cls: () => '',
			dress: (i, html) => {
				const meta = file.lines[i][1] || {};
				if (meta.knob) html = html.replace(/<span class="n">[^<]*<\/span>|<span class="s">None<\/span>/,
					'<span class="n trn-knob" tabindex="0" data-knob="' + meta.knob + '" title="'
					+ esc(SERVE_KNOBS[meta.knob] + '. Drag sideways or scroll to change it; ↑ and ↓ step it')
					+ '"></span>');
				if (meta.pick) {
					html = html.replace('<span class="q">',
						'<span class="q trn-pick" tabindex="0" data-pick="' + meta.pick
							+ '" title="Click to choose the cache’s dtype">');
				}
				if (meta.toggle) {
					html = html.replace(/<span class="s">(True|False)<\/span>/,
						'<span class="s trn-toggle" tabindex="0" data-toggle="' + meta.toggle + '"></span>');
				}
				// a value the run sets, kept as the settings change it
				if (meta.value) html = html.replace('<span class="n">',
					'<span class="n" data-value="' + meta.value + '" title="' + esc(meta.title) + '">');
				else if (meta.title) html = html.replace('<span class="q">',
					'<span class="q" title="' + esc(meta.title) + '">');
				return html
					+ (meta.stop || meta.note
						? '<em class="trn-inline" data-inline="' + (meta.stop || meta.note) + '" hidden></em>' : '');
			},
		};
	}
	// The settings as the code now has them, which stops the step takes, and
	// the values beside the lines, none on a line it skips
	function serveMark() {
		for (const el of code.querySelectorAll('[data-knob]')) el.textContent = knobText(el.dataset.knob);
		for (const el of code.querySelectorAll('[data-value]')) el.textContent = SV.run[el.dataset.value];
		const kvPick = code.querySelector('[data-pick="kv"]');
		if (kvPick) kvPick.textContent = SV.at.kv === 1 ? '"fp8"' : '"auto"';
		const prefix = code.querySelector('[data-toggle="prefix"]');
		if (prefix) {
			const off = SV.run.alloc === 'contiguous';
			prefix.textContent = SV.at.prefix && !off ? 'True' : 'False';
			prefix.classList.toggle('trn-off', off);
			prefix.title = off ? 'Prefix caching shares blocks, which a contiguous cache does not have'
				: 'Click to switch prefix caching on or off';
		}
		const f = facts(SV.k), mine = taken(), keys = new Set(mine.map(s => s.key));
		for (const li of code.querySelectorAll('[data-line]')) {
			const i = +li.dataset.line, s = SV.stops.find(x => x.line === i), j = s ? mine.indexOf(s) : -1;
			li.classList.toggle('skip', !!s && !keys.has(s.key));
			if (j >= 0) li.dataset.stop = j;
			else delete li.dataset.stop;
			li.children[1].style.background = j >= 0 && STOPS[s.key].gpu ? ROLE.HBM : '';
		}
		for (const em of code.querySelectorAll('[data-inline]')) {
			const v = em.closest('li').classList.contains('skip') ? '' : STOPS[em.dataset.inline].value(f);
			em.hidden = !v;
			em.innerHTML = v;
		}
		lightIds();
	}
	const lightIds = () => {
		for (const b of code.querySelectorAll('[data-id]')) b.classList.toggle('pick', +b.dataset.id === lit());
	};
	// The stop in play shaded, and its value under it in full, as VS Code's
	// debug hover shows one: beside a long line it would run off the editor
	function serveEdit() {
		const s = serveStop();
		let end = s.line;
		while (end < depths.length - 1 && depths[end] > 0) end++;
		for (const em of code.querySelectorAll('[data-inline]')) {
			em.classList.toggle('here', em.closest('li').dataset.line === String(s.line));
		}
		const was = code.querySelector('.trn-peek');
		if (was) was.remove();
		const value = STOPS[s.key].value(facts(SV.k));
		let peek = null;
		if (value) {
			peek = document.createElement('li');
			peek.className = 'trn-peek';
			peek.innerHTML = '<span></span><i></i><p>' + value + '</p>';
			code.querySelector('[data-line="' + end + '"]').after(peek);
			lightIds();
		}
		const text = SV.file.lines[s.line][0], step = SV.run.steps[SV.k];
		$('[data-out="lncol"]').textContent = 'Ln ' + (s.line + 1) + ', Col '
			+ (text.length - text.trimStart().length + 1) + '    Python 3.12';
		$('[data-out="where"]').textContent = 'Python Debugger  ·  step ' + int(SV.k + 1) + ', ' + E.time(step.t0)
			+ (SV.frames.length > 1 ? '  ·  ' + SV.file.path[SV.file.path.length - 1] + '()' : '');
		reveal(s.line, end, peek);
		transport();
	}

	// ---- serve.py on the render's panel: the step, or what a line of the
	// scheduler decides on the CPU; what holds the step, and what NVLink carries ----
	function serveHud() {
		const s = serveStop(), f = facts(SV.k), c = f.s.cost, gpu = !!STOPS[s.key].gpu, each = n => n / SE.GPUS;
		if (!gpu) return SV.at.sched === 'static'
			? { swatch: ROLE.CPU, short: 'generate()’s loop, on the CPU', time: '',
				cpu: 'its own work, on the host, between the GPUs’ passes', held: '',
				text: 'generate() decides nothing as it goes: every row of the batch takes a token a pass, finished or not, until the longest answer ends; its own time is left out here.' }
			: { swatch: ROLE.CPU, short: 'the scheduler, on the CPU', time: '',
				cpu: 'its own work, on the host, before the GPUs’ pass', held: '',
				text: 'The scheduler picks this step’s requests and their tokens before the GPUs run it; its own time is left out here.' };
		return {
			swatch: ROLE[c.bound === 'memory' ? 'HBM' : 'Tensor cores'],
			short: stepName(SV.k), time: '≥ ' + E.time(c.time),
			cpu: 'on both GPUs, each its half of every layer',
			held: c.bound === 'memory'
				? 'held by HBM: each GPU reads ' + E.bytes(each(c.weightBytes)) + ' of its ' + E.bytes(SE.WEIGHTS)
				+ ' of weights, all but the embedding table, and ' + E.bytes(each(c.kvBytes))
				+ ' of cache, ' + E.time(c.memory) + ' at 3.35 TB/s'
				: 'held by the tensor cores: ' + int(Math.round(each(c.matmul + c.attention) / 1e12))
					+ ' TFLOP a GPU, ' + E.time(c.compute) + ' at 989 TFLOPS',
			text: stepNote(f) + ' Tensor parallelism sums the two halves of every layer over NVLink, twice a layer: '
				+ E.bytes(nvBytes(c)) + ' from each GPU this step, '
				+ E.time(nvBytes(c) / NVLINK) + ' or more at 450 GB/s, which this model does not time.',
		};
	}
	// what the step's rows make of the roofline
	function stepNote(f) {
		const c = f.s.cost;
		if (SV.at.sched === 'static' && f.padding.length) return 'The finished rows are computed all the same: '
			+ int(f.padding.length) + ' of ' + int(f.rows.length)
			+ ' rows write padding, their slots set aside till the batch’s longest answer ends.';
		if (c.bound === 'compute') {
			return 'Its ' + int(c.tokens)
				+ ' tokens make every matmul wide enough that the arithmetic, not the reading, sets the time; any decodes in it ride along almost free.';
		}
		return 'Every step reads all of the weights, whatever the batch: the ' + plural(c.tokens, 'token')
			+ ' share that one read, so the step costs about what a single decode would.';
	}

	// ---- serve.py in the Memory panel: the KV cache on each GPU through the
	// run, each step's slots as the engine divides them by the kinds Kwon et
	// al. (2023) name, out of the blocks 92% of HBM leaves after the weights;
	// the weights, which never change, named rather than drawn ----
	// in the Memory panel's own colours: the tokens' keys and values as the
	// activations they are, the system prompt the logits' amber, padding the
	// buckets' lavender, a free block still caching a prefix the page cache's grey
	const KV_KINDS = [['system', 'System prompt', '#eda100',
		'The system prompt’s blocks, held once and shared by every request that starts with it'],
		['tokens', 'Tokens', '#1baf7a', 'Keys and values of the tokens computed'],
		['reserved', 'Reserved', '#1d5843', 'Slots set aside for tokens still to come'],
		['padding', 'Padding', '#9d93e8',
			'A static batch’s padding: prompts padded on the left, rows kept after their answer ends'],
		['internal', 'Internal fragmentation', '#1baf7a', 'Slots in a request’s blocks that no token will reach'],
		['external', 'External fragmentation', '#7d8590',
			'Free blocks too scattered for the run the next request needs'],
		['cached', 'Cached, free', '#5c636e',
			'Free blocks still holding a prefix, for the next request that starts with it']];
	const HATCHED = new Set(['internal', 'external']);
	// a token's keys and values on one GPU, which holds half the heads
	const perToken = () => SV.run.bytes / BLOCK / SE.GPUS;
	// the blocks a request holds in a record of the cache, a step's as it runs,
	// its finished requests in it, or one once they have left
	const blocksHeld = (id, cache) => (cache.bands.find(b => b.id === id) || { held: 0 }).held;
	function serveMemory() {
		const per = perToken(), v = SV.run.steps[SV.k].slots, all = SV.run.usable * BLOCK * per, id = lit();
		const mine = id >= 0 ? blocksHeld(id, SV.run.steps[SV.k]) : 0;
		return {
			now: E.bytes(facts(SV.k).used * BLOCK * per),
			of: 'of ' + E.bytes(all) + ' of KV cache on each GPU, '
				+ int(SV.run.usable) + ' blocks of ' + E.bytes(BLOCK * per)
				+ (SV.run.nullBlock >= 0 ? ' and block 0, vLLM’s null block' : '')
				+ (id >= 0 ? '; <em>#' + (id + 1) + '</em> holds ' + (mine ? E.bytes(mine * BLOCK * per) : 'none')
					: ''),
			keys: KV_KINDS.filter(([key]) => SV.run.steps.some(st => st.slots[key] > 0))
				.map(([key, label, c, title]) => ({ label, colour: c,
					hatched: HATCHED.has(key), n: v[key] * per, title })),
			// what each GPU holds, the weights and the blocks set aside for the
			// cache, of all its HBM; and the checkpoint on the SSD the weights came from
			rest: [['weights', SE.WEIGHTS, SE.GPU.mem], ['the cache', all, SE.GPU.mem],
				['/data', SE.MODEL.params * SE.W_BYTES, 3.84e12]],
		};
	}
	// The chart, as train.py's is a column a line: a column a span of time, the
	// round span that keeps a column as wide as train.py's narrow ones, each the
	// cache as its span ends, the last step begun in it as it runs or, ended,
	// once its finished have left; the column holding the step in play
	// outlined, those after it faint. Over it the request picked, its blocks
	// column by column; the run's true peak, step by step, dotted across; and
	// the cache's size, dashed
	const COLUMN = 5;
	function timeSpans(T, W) {
		const raw = T * COLUMN / W, mag = 10 ** Math.floor(Math.log10(raw)),
			span = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw);
		const out = [];
		for (let t = 0; t < T; t += span) {
			out.push({ t0: t, t1: t + span, last: SE.stepAt(SV.run, t + span), cache: SE.cacheAt(SV.run, t + span) });
		}
		return out;
	}
	function servePlot(cx, W, Hh) {
		const m = { t: 8, b: 14 }, run = SV.run, steps = run.steps, cap = run.usable * BLOCK, per = perToken();
		const top = cap * 1.08, Y = v => Hh - m.b - (Hh - m.t - m.b) * v / top;
		SV.spans = timeSpans(run.S.t, W);
		const X = t => W * t / SV.spans[SV.spans.length - 1].t1,
			at = Math.min(SV.spans.length - 1, Math.floor(steps[SV.k].t0 / SV.spans[0].t1));
		cols = SV.spans.map(s => ({ x0: X(s.t0), x1: X(s.t1) }));
		columns(cx, cols,
			i => (SV.spans[i].cache
				? KV_KINDS.map(([key, , c]) => [HATCHED.has(key) ? hatch(c) : c, SV.spans[i].cache.slots[key]]) : []),
			Y, at);
		cx.strokeStyle = '#ffffff';
		cx.lineWidth = 1.5;
		cx.strokeRect(cols[at].x0 - 0.5, m.t - 2, cols[at].x1 - cols[at].x0, Hh - m.t - m.b + 2);
		// the time along the foot, as the timeline under the render keeps it
		cx.font = '9px Menlo, Monaco, monospace';
		cx.fillStyle = '#6f7680';
		cx.textBaseline = 'alphabetic';
		for (const t of SE.ticks(0, run.S.t)) {
			cx.textAlign = t ? 'center' : 'left';
			if (X(t) < W - 24) cx.fillText(t ? E.time(t) : '0', X(t), Hh - 3);
		}
		const id = lit();
		if (id >= 0) {
			cx.strokeStyle = '#ffffff';
			cx.lineWidth = 1.25;
			cx.beginPath();
			SV.spans.forEach((s, i) => {
				const y = Y(s.cache ? blocksHeld(id, s.cache) * BLOCK : 0);
				cx.lineTo(cols[i].x0, y);
				cx.lineTo(cols[i].x1, y);
			});
			cx.stroke();
		}
		let peak = 0;
		steps.forEach((s, i) => {
			if (s.used > steps[peak].used) peak = i;
		});
		const most = steps[peak].used * BLOCK,
			held = Math.min(cols.length - 1, Math.floor(steps[peak].t0 / SV.spans[0].t1));
		peakLine(cx, W, Math.round(Y(most)) + 0.5, cols[held].x0,
			'peak ' + E.bytes(most * per) + ' at step ' + int(peak + 1), 0, Y(most) - Y(cap) < 12);
		capLine(cx, W, Y(cap), E.bytes(cap * per) + ', the cache');
	}
	// a column's span, its unit once, and the step whose cache it shows, as it
	// runs or after it
	function spanName(s) {
		const to = E.time(s.t1), unit = to.slice(to.indexOf(' ')),
			from = s.t0 ? E.time(s.t0) : '0', step = 'step ' + int(s.last + 1);
		return (from.endsWith(unit) ? from.slice(0, -unit.length) : from) + '–' + to
			+ (s.last < 0 ? ', before the first step'
				: SV.run.steps[s.last].t1 > s.t1 ? ', as ' + step + ' runs' : ', after ' + step);
	}

	// ---- serve.py on the timeline: a row a request, from its arrival to its
	// last token, waiting, its prompt going through, its answer in its own
	// colour, stalled, preempted and computed again; the step in play a band
	// down every row. The rows are drawn once a run and a zoom; a hover picks a
	// request out everywhere, a click goes to where it points ----
	// the lanes' own margins: the left for the requests' numbers, the top for
	// the key as the lanes name their steps there, the foot for the time
	const RQ = { left: LEFT, top: TOP, foot: 30 };
	// scheduler.exe's kinds, lit for the stage; an answer is its request's
	// colour
	const STAGE = { wait: '#3b3f47', prefill: '#c77dce', stall: '#6c717b',
		pad: '#5d5672', preempted: '#7d3b3b', recompute: '#ff6464', refused: '#ffffff' };
	// the key, the kinds a scheduler can have: a static batch neither stalls
	// nor preempts, and only it pads
	const KEY_ROW = [['wait', 'waiting'], ['prefill', 'prompt'], ['answer', 'answer'], ['stall', 'stalled', false],
		['preempted', 'preempted', false], ['recompute', 'recompute', false], ['pad', 'padding', true]];
	function drawRequests() {
		const { cx, W, H: Hh } = fitCanvas(lanes), run = SV.run, reqs = run.S.reqs, n = reqs.length;
		const [v0, v1] = range || [0, run.S.t],
			X = v => RQ.left + (W - RQ.left - 18) * (v - v0) / (v1 - v0), row = (Hh - RQ.top - RQ.foot) / n;
		const key = W + 'x' + Hh + ':' + v0 + '-' + v1;
		if (!SV.rows || SV.rows.key !== key) {
			const cv = document.createElement('canvas'), dpr = window.devicePixelRatio || 1, p = cv.getContext('2d');
			cv.width = Math.round(W * dpr);
			cv.height = Math.round(Hh * dpr);
			p.scale(dpr, dpr);
			p.save();
			p.beginPath();
			p.rect(RQ.left, 0, W - RQ.left - 18, Hh);
			p.clip();
			// the long kinds first, the brief over them a pixel and a half at least
			for (const brief of [false, true]) for (const r of reqs) for (const sg of r.segs) {
				if (SE.BRIEF.has(sg.kind) !== brief || sg.t1 < v0 || sg.t0 > v1) continue;
				p.fillStyle = sg.kind === 'decode' ? SE.hue(r.id) : STAGE[sg.kind];
				const x0 = X(sg.t0), x1 = Math.max(X(sg.t1), x0 + (brief ? 1.5 : 0.5));
				p.fillRect(x0, RQ.top + r.id * row, x1 - x0, Math.max(1, row - 0.6));
			}
			p.restore();
			// the requests by number down the left, the key across the top, and
			// the time along the foot, in the timeline's own type
			p.font = '9px Menlo, Monaco, monospace';
			p.fillStyle = 'rgba(232, 235, 231, 0.55)';
			p.textBaseline = 'middle';
			p.textAlign = 'right';
			for (let i = 0; i < n; i += 10) p.fillText('#' + (i + 1), RQ.left - 6, RQ.top + (i + 0.5) * row);
			p.textAlign = 'left';
			p.fillText('T: hide', 12, 9);
			let x = RQ.left;
			for (const [kd, label, statics] of KEY_ROW) {
				if (statics !== undefined && statics !== (SV.at.sched === 'static')) continue;
				p.fillStyle = kd === 'answer' ? SE.KEYED : STAGE[kd];
				p.fillRect(x, 6, 8, 6);
				p.fillStyle = 'rgba(232, 235, 231, 0.55)';
				p.fillText(label, x + 11, 9);
				x += 19 + p.measureText(label).width;
			}
			p.fillStyle = 'rgba(232, 235, 231, 0.4)';
			p.textAlign = 'center';
			for (const t of SE.ticks(v0, v1)) p.fillText(t ? E.time(t) : '0', X(t), Hh - 8);
			p.textAlign = 'left';
			p.fillText(range ? 'double-click: all' : 'wheel: zoom', 12, Hh - 8);
			SV.rows = { key, cv };
		}
		cx.drawImage(SV.rows.cv, 0, 0, W, Hh);
		// the step in play, a band down every row, and the request picked, outlined
		const s = run.steps[SV.k], x0 = X(s.t0), x1 = Math.max(X(s.t1), x0 + 1.5);
		if (x1 >= RQ.left && x0 <= W - 18) {
			cx.fillStyle = 'rgba(255, 255, 255, 0.9)';
			cx.fillRect(x0, RQ.top - 3, x1 - x0, n * row + 3);
		}
		const id = lit();
		if (id >= 0) {
			cx.strokeStyle = '#ffffff';
			cx.lineWidth = 1;
			cx.strokeRect(RQ.left - 0.5, RQ.top + id * row - 1.5, W - RQ.left - 18 + 1, row + 2);
		}
		laneBox = { left: RQ.left, right: 18, T: run.S.t, row, W };
	}
	// the request under the pointer, and the time there
	function requestAt(e) {
		const r = lanes.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, b = laneBox;
		if (!b || x < b.left || x > b.W - b.right) return null;
		const [v0, v1] = range || [0, b.T], id = Math.floor((y - RQ.top) / b.row);
		return { id: id >= 0 && id < SV.run.S.reqs.length ? id : -1,
			t: v0 + (x - b.left) / (b.W - b.left - b.right) * (v1 - v0), x, y };
	}
	function requestClick(e) {
		const a = requestAt(e);
		if (!a) return;
		SV.pick = a.id;
		play(false);
		serveLeave();
		serveGo(SE.stepAt(SV.run, a.t));
	}
	function requestTip(id) {
		const r = SV.run.S.reqs[id];
		if (r.status === 'refused') return '#' + (id + 1) + ': refused, '
			+ (SV.run.alloc === 'contiguous' ? 'its prompt and max_tokens, set aside whole, more than every block'
			: 'its prompt max_model_len tokens or more, which vLLM rejects');
		const gaps = r.times.slice(1).map((t, i) => t - r.times[i]);
		return '#' + (id + 1) + ': a prompt of ' + int(r.prompt) + ' tokens'
			+ (r.system ? ' (' + int(r.system) + ' of them the system prompt)' : '') + ', an answer of ' + int(r.output)
			+ (r.capped ? ', cut at max_model_len' : '') + '; ' + (SV.at.sched === 'static'
				? 'its first token computed after ' + E.time(r.first - r.arrival)
					+ ', reaching its user as generate() returns, at its batch’s end, after '
					+ E.time(batchEnd(r) - r.arrival)
				: 'first token after ' + E.time(r.first - r.arrival)
					+ (gaps.length ? ', then one every ' + E.time(SE.quantile(gaps, 0.5)) + ' at the median' : ''))
			+ (r.preempts ? '; preempted ' + plural(r.preempts, 'time') : '')
			+ (r.hit ? '; ' + int(r.hit) + ' tokens of its prompt cached' : '');
	}
	// the end of the static batch r ran in
	const batchEnd = r => SV.run.steps.findLast(s => s.batch === r.batch).t1;
	function requestHover(e) {
		const a = requestAt(e), id = a ? a.id : -1;
		if (id !== SV.hover) {
			SV.hover = id;
			picked();
		}
		tip.hidden = id < 0;
		if (id < 0) return;
		tip.textContent = requestTip(id);
		tip.style.left = Math.min(a.x + 12, lanes.getBoundingClientRect().width - 270) + 'px';
		tip.style.top = Math.max(2, a.y - 44) + 'px';
	}
	// a request picked or let go: lit on the timeline, in the code and the chart
	function picked() {
		lightIds();
		drawRequests();
		if (!$('.trn-panel').classList.contains('shut')) memory();
	}

	// ---- serve.py, moving through the run as a debugger does: over a step,
	// back one, into engine.step() and the scheduler under it and out again,
	// to the first step and the last; Run plays the run on its own clock ----
	function serveEnter(byHand = false) {
		const s = serveStop(), gpu = !!STOPS[s.key].gpu, copies = gpu ? stepCopies(SV.k) : SCHEDULING;
		show(copies);
		// stepped onto the pass by hand, the camera goes to what holds it; a step
		// played or stepped over in serve.py leaves it where the reader put it
		if (byHand && gpu && SV.frames.length > 1) fly(LEVEL[E.lay(copies[0]).held]);
		serveMark();
		serveEdit();
		hud();
		if (!$('.trn-panel').classList.contains('shut')) memory();
		drawRequests();
		say('serve.py, step ' + int(SV.k + 1) + ': ' + stepName(SV.k));
	}
	function serveGo(i, byHand = false) {
		SV.k = Math.max(0, Math.min(SV.run.steps.length - 1, i));
		servingTop().at = Math.min(servingTop().at, taken().length - 1);
		serveEnter(byHand);
	}
	const lastServed = () => SV.run.steps.length - 1;
	// out of every file stepped into, serve.py back in the editor
	function serveLeave() {
		if (SV.frames.length === 1) return;
		SV.frames = [SV.frames[0]];
		fill();
	}
	// at the end of a file stepped into, the next comes back out to the caller
	// and on to the next step
	function serveNext() {
		const f = servingTop();
		if (SV.frames.length > 1 && f.at < taken().length - 1) {
			f.at++;
			return serveEnter(true);
		}
		if (SV.frames.length > 1) {
			SV.frames.pop();
			fill();
			if (SV.frames.length > 1) {
				servingTop().at = Math.min(servingTop().at + 1, taken().length - 1);
				return serveEnter(true);
			}
			if (SV.k === lastServed()) return serveEnter(true);
		}
		if (SV.k < lastServed()) serveGo(SV.k + 1, true);
	}
	function serveBack() {
		const f = servingTop();
		if (SV.frames.length > 1 && f.at > 0) {
			f.at--;
			return serveEnter(true);
		}
		if (SV.frames.length > 1) return serveOut();
		if (SV.k > 0) serveGo(SV.k - 1, true);
	}
	function serveInto() {
		const how = STOPS[serveStop().key];
		if (!how.into) return;
		SV.frames.push({ file: how.into(), at: 0 });
		fill();
		serveEnter(true);
	}
	function serveOut() {
		if (SV.frames.length === 1) return;
		SV.frames.pop();
		fill();
		serveEnter(true);
	}
	function serveEnd() {
		serveLeave();
		serveGo(lastServed());
	}
	function serveReset() {
		SV.frames = [SV.frames[0]];
		SV.k = 0;
		range = null;
		fill();
		serveGo(0);
		fly('server');
	}
	function serveTransport() {
		const first = SV.frames.length === 1 && SV.k === 0, final = SV.frames.length === 1 && SV.k === lastServed();
		return { off: { start: first, back: first, next: final, end: final, run: final && !SV.playing,
			into: !STOPS[serveStop().key].into, out: SV.frames.length === 1 },
			at: 'step ' + int(SV.k + 1) + ' of ' + int(SV.run.steps.length) + ' · ' + E.time(SV.run.steps[SV.k].t0)
				+ (SV.frames.length > 1 ? ' · ' + SV.file.tab + ' ' + (serveStop().line + 1) : '') };
	}
	function servePlay(on) {
		SV.playing = on && SV.k < lastServed();
		if (SV.playing) {
			serveLeave();
			SV.clock = SV.run.steps[SV.k].t0;
			SV.wall = performance.now();
			requestAnimationFrame(serveTick);
		}
		runButton(SV.playing);
	}
	function serveTick(now) {
		if (!SV.playing || !serving() || !root.isConnected) return;
		SV.clock += Math.max(0, now - SV.wall) / 1000 * SV.at.speed;
		SV.wall = now;
		const j = SE.stepAt(SV.run, SV.clock);
		if (j !== SV.k) serveGo(j);
		if (j >= lastServed()) return play(false);
		requestAnimationFrame(serveTick);
	}

	// ---- serve.py's settings, changed in its code: the run is served again and
	// the debugger kept at the same moment of it; a change of scheduler, which
	// changes the code, takes it back out to serve.py ----
	function serveChange(to) {
		if (to.kv !== undefined) to.kv = to.kv === 'fp8' ? 1 : to.kv === 'auto' ? 2 : to.kv;
		const was = SV.run.steps[SV.k].t0, sched = SV.at.sched, alloc = SV.run.alloc;
		SV.at = { ...SV.at, ...to };
		play(false);
		serveRun();
		if (SV.at.sched !== sched) SV.frames = [SV.frames[0]];
		SV.k = Math.max(0, SE.stepAt(SV.run, was));
		// the code rewritten only where its lines change, so that a value dragged
		// keeps its place under the pointer
		if (SV.at.sched !== sched || SV.run.alloc !== alloc) fill();
		serveGo(SV.k);
	}
	// serve.py's request rates: thirty chats never fill the cache, so past four
	// a second only the burst differs; inf, all at once, is vllm bench serve's
	// default
	const SERVE_VALUES = { ...SE.VALUES, rate: [0.5, 1, 2, 4, Infinity] };
	// a setting stepped along its list
	function serveNudge(key, by, from = SERVE_VALUES[key].indexOf(SV.at[key])) {
		const list = SERVE_VALUES[key], j = Math.max(0, Math.min(list.length - 1, from + by));
		if (list[j] !== SV.at[key]) serveChange({ [key]: list[j] });
	}
	const serveToggle = () => SV.run.alloc !== 'contiguous' && serveChange({ prefix: !SV.at.prefix });
	const speed = $('[data-in="speed"]');
	speed.innerHTML = SE.VALUES.speed.map(v => '<option value="' + v + '"'
			+ (v === SV.at.speed ? ' selected' : '') + '>' + SE.SHOW.speed(v) + '</option>').join('');
	speed.addEventListener('change', () => {
		SV.at.speed = +speed.value;
		SV.wall = performance.now();
	});

	// ---- moving through the run, as a debugger does: over a line, back one,
	// into the forward pass and out of it, to the first line and the last ----
	function enter() {
		if (serving()) return serveEnter();
		const s = cur();
		show(s.copies || []);
		if (s.copies && s.copies.length) {
			const plan = E.lay(s.copies[0]);
			fly(LEVEL[plan.held === 'latency' ? plan.hops[0].key : plan.held]);
		}
		edit();
		hud();
		if (inside < 0 && !$('.trn-panel').classList.contains('shut')) memory();
		drawLanes();
		say((inside >= 0 ? 'forward › ' : '') + s.short
			+ (R.stops[k].step !== null ? ', step ' + R.stops[k].step : ''));
	}
	// the line the debugger was taken to, which a change to the script keeps
	function go(i) {
		if (serving()) return serveGo(i);
		if (inside >= 0) inside = Math.max(0, Math.min(INSIDE.length - 1, i));
		else k = Math.max(0, Math.min(R.stops.length - 1, i));
		want = { line: R.stops[k].line, step: R.stops[k].step };
		enter();
	}
	const lastStop = () => R.stops.length - 1;
	// out of the forward pass, train.py back in the editor
	function leave() {
		if (serving()) return serveLeave();
		if (inside < 0) return;
		inside = -1;
		fill();
	}
	// past the forward pass's last line, the next comes back out to backward
	function next() {
		if (serving()) return serveNext();
		if (inside >= 0 && inside < INSIDE.length - 1) return go(inside + 1);
		leave();
		if (k < lastStop()) go(k + 1);
	}
	function back() {
		if (serving()) return serveBack();
		if (inside > 0) return go(inside - 1);
		if (inside === 0) return out();
		if (k > 0) go(k - 1);
	}
	function into() {
		if (serving()) return serveInto();
		if (inside >= 0 || !R.stops[k].into) return;
		inside = 0;
		fill();
		enter();
	}
	function out() {
		if (serving()) return serveOut();
		if (inside < 0) return;
		leave();
		enter();
	}
	function end() {
		if (serving()) return serveEnd();
		leave();
		go(lastStop());
	}
	function reset() {
		if (serving()) return serveReset();
		rerun();
		k = 0;
		want = { line: R.stops[0].line, step: null };
		inside = -1;
		range = null;
		fill();
		enter();
		fly('server');
	}

	// ---- the script changed, the model chosen, the batch dragged or
	// checkpointing switched: the run is rerun and the debugger stays on the
	// line it was taken to, or, where the new run has no such line or fails
	// before it, on the last line it reaches before it ----
	function change(to) {
		if (serving()) return serveChange(to);
		const b = Math.max(BATCHES[0], Math.min(BATCHES[1], to.batch ?? batchSize)), c = to.ckpt ?? ckpt,
			name = to.model ?? modelName, dev = to.device ?? device, how = to.strategy ?? strategy;
		if (b === batchSize && c === ckpt && name === modelName && dev === device && how === strategy) return;
		play(false);
		const relabel = c !== ckpt || name !== modelName || dev !== device || how !== strategy || inside >= 0;
		batchSize = b;
		ckpt = c;
		strategy = how;
		if (name !== modelName) {
			modelName = name;
			M = MODELS[name];
			MODEL = modelCode();
		}
		if (dev !== device) {
			device = dev;
			// GPUDirect Storage reads into a GPU; on the CPU the DataLoader serves
			if (device === 'cpu' && kind === 'gds') dataPath('loader');
			dataButtons();
		}
		rerun();
		inside = -1;
		const i = R.stops.findIndex(s => s.line === want.line && s.step === want.step);
		k = i >= 0 ? i
			: Math.max(0,
				R.stops.findLastIndex(s => (s.step ?? -1) < (want.step ?? -1)
					|| (s.step === want.step && s.line < want.line)));
		if (range && range[1] > R.T) range = null;
		if (relabel) fill();
		else mark();
		enter();
	}
	// the model's path opens the folders of /data, and the device's name the
	// devices, as VS Code suggests a completion: ↑ and ↓ to move, Enter or a
	// click to choose, Esc to close
	const suggest = document.createElement('div');
	suggest.className = 'trn-suggest';
	suggest.setAttribute('role', 'listbox');
	suggest.hidden = true;
	code.parentElement.append(suggest);
	const FOLDER = '<svg viewBox="0 0 16 16"><path d="M1.5 3h4.3l1.4 1.5h7.3v8.5h-13z"/></svg>';
	const CHIP = '<svg viewBox="0 0 16 16"><path d="M4 4h8v8H4zM6 1.5h1v2H6zM9 1.5h1v2H9zM6 12.5h1v2H6zM9 12.5h1v2H9zM1.5 6h2v1h-2zM1.5 9h2v1h-2zM12.5 6h2v1h-2zM12.5 9h2v1h-2z"/></svg>';
	const OPTIONS = {
		model: () => Object.entries(MODELS)
			.map(([name, m]) => [name, E.fmt(m.params / 1e9) + 'B, ' + E.fmt(2 * m.params / 1e9) + ' GB', FOLDER]),
		device: () => [['cuda', 'H100 SXM5, 79.2 GiB of HBM3', CHIP], ['cpu', 'Xeon 8480C, 2 TiB of DDR5', CHIP]],
		strategy: () => [['ddp', 'the whole model on each GPU', CHIP],
			['fsdp', 'half of every tensor on each GPU', CHIP]],
		// serve.py's, each list simplest first
		sched: () => [['static', 'a batch at a time, padded, as before continuous batching', CHIP],
			['prefill', 'vLLM v0, chunked prefill off: whole prompts first, the decodes waiting', CHIP],
			['chunked', 'vLLM v1, chunked prefill always on: prompts in chunks beside the decodes', CHIP]],
		alloc: () => [['contiguous', 'before vLLM: a run set aside for prompt and max_tokens', CHIP],
			['paged', 'PagedAttention: blocks as needed, from anywhere', CHIP]],
		kv: () => [['auto', 'bf16, as the weights', CHIP], ['fp8', 'a byte a value: twice the blocks', CHIP]],
	};
	const current = () => ({ model: modelName, device, strategy, sched: SV.at.sched,
		alloc: SV.at.alloc, kv: SV.at.kv === 1 ? 'fp8' : 'auto' });
	let picking = 'model', choice = 0;
	function choose(open, what = picking) {
		suggest.hidden = !open;
		if (!open) return;
		picking = what;
			// under the string picked, or, for a choice the code has no string for, under its CodeLens
		const list = OPTIONS[what](),
			at = code.querySelector('[data-pick="' + what + '"]') || code.querySelector('[data-lens="' + what + '"]'),
			box = code.parentElement;
		choice = Math.max(0, Math.min(list.length - 1, choice));
		suggest.innerHTML = list.map(([value, detail, icon], i) => '<div role="option" data-value="'
			+ value + '"' + (i === choice ? ' class="on"' : '') + '>' + icon + '<span>' + value
			+ '</span><small>' + detail + '</small></div>').join('');
		const r = at.getBoundingClientRect(), b = box.getBoundingClientRect();
		suggest.style.left = (r.left - b.left + box.scrollLeft) + 'px';
		suggest.style.top = (r.bottom - b.top + box.scrollTop + 2) + 'px';
	}
	function chosen(value) {
		choose(false);
		change({ [picking]: value });
	}
	suggest.addEventListener('mousedown', e => {
		const row = e.target.closest('[data-value]');
		if (!row) return;
		e.preventDefault();
		chosen(row.dataset.value);
	});
	code.addEventListener('focusout', e => {
		if (e.target.closest('[data-pick], [data-lens]')) choose(false);
	});

	// the handle, dragged sideways, scrolled, or stepped with ↑ and ↓; the
	// switch, clicked; the model's path, opened; any other line, run to
	// a handle moved by steps: the batch size by one, a serve.py setting along
	// its list; dragged, a step every nine pixels or sixteen
	function nudge(key, by, from) {
		if (key === 'batch') change({ batch: (from ?? batchSize) + by });
		else serveNudge(key, by, from);
	}
	const knobAt = key => (key === 'batch' ? batchSize : SERVE_VALUES[key].indexOf(SV.at[key]));
	let grab = null, spin = 0;
	code.addEventListener('pointerdown', e => {
		const h = e.target.closest('[data-knob]');
		if (!h) return;
		grab = { x: e.clientX, key: h.dataset.knob, from: knobAt(h.dataset.knob) };
		h.setPointerCapture(e.pointerId);
		h.classList.add('drag');
		h.focus({ preventScroll: true });
		e.preventDefault();
	});
	code.addEventListener('pointermove', e => {
		if (grab) nudge(grab.key, Math.round((e.clientX - grab.x) / (grab.key === 'batch' ? 9 : 16)), grab.from);
	});
	for (const type of ['pointerup', 'pointercancel']) code.addEventListener(type, () => {
		grab = null;
		for (const h of code.querySelectorAll('[data-knob]')) h.classList.remove('drag');
	});
	code.addEventListener('wheel', e => {
		const h = e.target.closest('[data-knob]');
		if (!h) return;
		e.preventDefault();
		spin += e.deltaY;
		const n = Math.trunc(spin / 40);
		spin -= 40 * n;
		if (n) nudge(h.dataset.knob, -n);
	}, { passive: false });
	code.addEventListener('keydown', e => {
		const pick = e.target.closest('[data-pick]');
		if (pick) {
			const open = !suggest.hidden;
			if ((e.key === 'Enter' || e.key === ' ') && open) chosen(OPTIONS[picking]()[choice][0]);
			else if (e.key === 'Enter' || e.key === ' ') choose(true, pick.dataset.pick);
			else if (open && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				choice += e.key === 'ArrowUp' ? -1 : 1;
				choose(true);
			} else if (open && e.key === 'Escape') choose(false);
			else return;
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		// a CodeLens link or a switch, taken by Enter or Space as a click
		if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-lens], [data-toggle]')) {
			e.preventDefault();
			e.stopPropagation();
			return e.target.click();
		}
		const knob = e.target.closest('[data-knob]');
		if (!knob || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
		e.preventDefault();
		nudge(knob.dataset.knob, e.key === 'ArrowUp' ? 1 : -1);
	});
	// the CodeLens above main(), as VS Code puts one over a function: what the
	// script lets you do, each a link that does it
	const LENS = {
		run: ['Run', 'Run on through the lines (Space or F5)', () => play(true)],
		batch: ['Drag batch_size', 'Drag the number sideways, scroll on it, or step it with ↑ and ↓', () => {
			const knob = code.querySelector('[data-knob]');
			knob.scrollIntoView({ block: 'nearest' });
			knob.focus();
			knob.classList.add('drag');
			setTimeout(() => knob.classList.remove('drag'), 900);
		}],
		model: ['Pick the model', 'Llama 3.2 1B or 3B, or Llama 3.1 8B'],
		device: ['Pick the device', '"cuda" or "cpu"'],
		strategy: ['Pick the strategy', '"ddp" or "fsdp"'],
			ckpt: ['Toggle checkpointing', 'Comment gradient_checkpointing_enable() in or out, as Ctrl+/ would',
				() => change({ ckpt: !ckpt })],
		sched: ['Pick the scheduler',
			'Static batches, the oldest way, then what improves on it: prefill first and chunked prefill'],
		alloc: ['Pick the cache', 'Contiguous, as before vLLM, or paged'],
		prefix: ['Toggle prefix caching',
			'Keep full blocks keyed by their tokens for the next request to share', () => serveToggle()],
		kv: ['Pick the dtype', 'The cache in bf16 or fp8'],
	};
	const lens = keys => '<li class="trn-lens"><span></span><i></i><code>' + keys
		.map(key => '<a data-lens="' + key + '" tabindex="0" title="' + esc(LENS[key][1])
				+ '">' + LENS[key][0] + '</a>').join(' | ') + '</code></li>';
	code.addEventListener('click', e => {
		const link = e.target.closest('[data-lens]');
		if (link) {
			const what = link.dataset.lens, [, , act] = LENS[what],
				at = act ? null : code.querySelector('[data-pick="' + what + '"]');
			if (act) return act();
			// a choice the code has no string for opens its list under the link
			if (!at) {
				choice = OPTIONS[what]().findIndex(([value]) => value === current()[what]);
				return choose(suggest.hidden || picking !== what, what);
			}
			// focused as a click on it would, so the list closes as focus leaves
			at.closest('li').scrollIntoView({ block: 'nearest' });
			at.focus();
			return at.click();
		}
		const pick = e.target.closest('[data-pick]');
		if (pick) {
			const what = pick.dataset.pick, open = suggest.hidden || picking !== what;
			choice = OPTIONS[what]().findIndex(([value]) => value === current()[what]);
			return choose(open, what);
		}
		if (e.target.closest('[data-toggle]')) return serveToggle();
		const li = e.target.closest('li');
		if (!li || li.classList.contains('trn-exc') || li.classList.contains('trn-peek')
			|| li.classList.contains('trn-lens') || e.target.closest('[data-knob]')) {
			return;
		}
		if (li.classList.contains('trn-switch')) change({ ckpt: !ckpt });
		// serve.py's stops are the file's, in the step in play
		else if (li.dataset.stop !== undefined && serving()) {
			play(false);
			servingTop().at = +li.dataset.stop;
			serveEnter(true);
		} else if (li.dataset.stop !== undefined) go(+li.dataset.stop);
	});

	// each button of the transport, disabled where it cannot go, and where the
	// run is: the line, the step, and the stop of all of them
	function transport() {
		const t = serving() ? serveTransport() : trainTransport();
		for (const b of $$('[data-act]')) if (b.dataset.act in t.off) b.disabled = t.off[b.dataset.act];
		$('[data-out="at"]').textContent = t.at;
	}
	function trainTransport() {
		const first = inside < 0 && k === 0, final = inside < 0 && k === lastStop(), s = cur(), f = R.stops[k];
		return {
			off: { start: first, back: first, next: final, end: final, run: final && !playing,
				into: !(inside < 0 && R.stops[k].into), out: inside < 0 },
			at: (inside >= 0 ? 'forward line ' + (s.line + 1) : 'line ' + (f.line + 1)) + ' · '
				+ (f.step === null ? 'setup' : 'step ' + f.step) + ' · ' + (k + 1) + ' of ' + R.stops.length,
		};
	}
	// Run: on through the lines, into nothing, to the last line or the one that
	// raises, as the debugger's Continue runs to the end; a line that copies
	// nothing for a moment, and a line that does until the camera has landed
	// where its bytes are held and a while after, to watch them go
	const PACE = 900, WATCH = 2400;
	const dwell = () => ((cur().copies || []).length ? (flight ? (flight.span - flight.t) * 1000 : 0) + WATCH : PACE);
	let playing = null;
	// serve.py plays its run on its own clock
	function play(on = !(serving() ? SV.playing : playing)) {
		if (serving()) return servePlay(on);
		clearTimeout(playing);
		playing = null;
		if (on) {
			const tick = () => {
				if (inside < 0 && k === lastStop()) return play(false);
				next();
				playing = setTimeout(tick, dwell());
			};
			playing = setTimeout(tick, inside < 0 && k === lastStop() ? 0 : PACE / 3);
		}
		runButton(!!playing);
	}
	// Run, or Pause while it runs
	function runButton(on) {
		const b = $('[data-act="run"]');
		b.classList.toggle('on', on);
		b.innerHTML = on ? '&#10074;&#10074; Pause' : '&#9654; Run';
		transport();
	}
	// the field dragged across: a stop every eight pixels
	let scrub = null;
	const at = $('[data-out="at"]');
	at.addEventListener('pointerdown', e => {
		play(false);
		scrub = { x: e.clientX, k: serving() ? SV.k : k };
		at.setPointerCapture(e.pointerId);
		e.preventDefault();
	});
	at.addEventListener('pointermove', e => {
		if (!scrub) return;
		// a stop every eight pixels; of serve.py's steps, which are many, one every four
		const [now, last, px] = serving() ? [SV.k, lastServed(), 4] : [k, lastStop(), 8];
		const to = Math.max(0, Math.min(last, scrub.k + Math.round((e.clientX - scrub.x) / px)));
		if (to === now) return;
		leave();
		go(to);
	});
	for (const type of ['pointerup', 'pointercancel']) at.addEventListener(type, () => { scrub = null; });
	// the Memory panel folded or opened, the editor taking back its room; it
	// stays as the reader left it
	function fold(open = $('.trn-panel').classList.contains('shut')) {
		$('.trn-panel').classList.toggle('shut', !open);
		$('[data-act="fold"]').setAttribute('aria-expanded', String(open));
		try {
			localStorage.setItem('device.exe:memory', open ? 'open' : 'shut');
		} catch (e) {}
		if (open) memory();
	}
	// the timeline put away or brought back, the render taking back its foot
	function timeline(on = root.classList.contains('bare')) {
		root.classList.toggle('bare', !on);
		resize();
		drawLanes();
	}
	const ACT = { start: reset, back, next, end, into, out,
		run: () => play(), explain: () => explain(), fold: () => fold() };
	// a step by hand pauses a run
	for (const b of $$('[data-act]')) b.addEventListener('click', () => {
		if (b.dataset.act !== 'run' && b.dataset.act !== 'explain' && b.dataset.act !== 'fold') play(false);
		ACT[b.dataset.act]();
	});
	root.addEventListener('keydown', e => {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		// a focused button takes its own Space and Enter
		if ((e.key === ' ' || e.key === 'Enter') && e.target.closest('button')) return;
		const act = e.key === ' ' || e.key === 'F5' ? ACT.run
			: e.key === 'ArrowRight' || e.key === 'F10' ? next
			: e.key === 'ArrowLeft' ? back
			: e.key === 'F11' ? (e.shiftKey ? out : into)
			: e.key === 'Home' ? reset
			: e.key === 'End' ? end
			: e.key === 't' || e.key === 'T' ? () => timeline()
			: e.key === '?' ? ACT.explain
			: e.key === 'm' || e.key === 'M' ? ACT.fold
			: null;
		if (!act) return;
		e.preventDefault();
		// a step by hand pauses a run
		if ([next, back, reset, end, into, out].includes(act)) play(false);
		act();
	});
	// the data's way in, the DataLoader's or GPUDirect Storage's, train.py's
	// choice: train_dist.py's DataLoader shares out the samples, and GPUDirect
	// Storage reads only into a GPU
	function dataPath(to) {
		kind = to;
		for (const c of $$('[data-path]')) c.classList.toggle('on', c.dataset.path === to);
	}
	function dataButtons() {
		for (const b of $$('[data-path]')) {
			b.disabled = kind === 'dist' || (b.dataset.path === 'gds' && device === 'cpu');
		}
	}
	// the editor's tabs: train.py, run by python on one device;
	// train_dist.py, run by torchrun on both GPUs, a process each; and
	// serve.py, vLLM's engine on both. The tabs of files stepped into are
	// the debugger's, not ones to open. serve.py has the timeline's foot
	// taller, a row a request, and the machine's labels in its own words
	const file = () => (kind === 'dist' ? 'train_dist.py' : 'train.py');
	const tabOf = () => (kind === 'dist' || kind === 'serve' ? kind : 'train');
	let single = { kind: 'loader', device: 'cuda' };
	function openTab(tab) {
		if (tab.startsWith('in') || tab === tabOf()) return;
		play(false);
		if (tabOf() === 'train') single = { kind, device };
		if (tab === 'train') ({ kind, device } = single);
		else {
			kind = tab;
			device = 'cuda';
		}
		root.classList.toggle('serving', serving());
		relabel(serving());
		$('.trn-panel header small').textContent = serving() ? 'the KV cache on each GPU, as this step runs'
			: 'after this line, estimated';
		dataButtons();
		range = null;
		resize();
		reset();
	}
	for (const t of $$('[data-tab]')) t.addEventListener('click', () => openTab(t.dataset.tab));
	for (const b of $$('[data-path]')) b.addEventListener('click', () => {
		if (b.dataset.path === kind) return;
		play(false);
		dataPath(b.dataset.path);
		reset();
	});
	const timeSized = new ResizeObserver(() => (root.isConnected ? drawLanes() : timeSized.disconnect()));
	timeSized.observe($('.trn-time'));
	const plotSized = new ResizeObserver(() => (root.isConnected ? plot() : plotSized.disconnect()));
	plotSized.observe($('.trn-plot'));
	serveRun();
	explain(explaining);
	// folded until a reader opens it
	let memoryOpen = false;
	try {
		memoryOpen = localStorage.getItem('device.exe:memory') === 'open';
	} catch (e) {}
	fold(memoryOpen);
	reset();
})();
