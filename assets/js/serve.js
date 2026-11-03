// serve.exe: chat requests served to Llama 3.1 70B over two H100s by
// serve.exe's engine (ServeEngine), seen from both ends at once: by the
// people who sent them, a wall of chat clients each answer streaming in when
// the engine makes its tokens; and in the KV cache that holds them, every
// block vLLM numbers a cell of a map, as Windows 98's Disk Defragmenter drew
// a disk. Two views of one run on one clock, the picked request the same
// in both. Users, as it opens: the wall over a strip of the steps, the
// cache and the latencies, and a second server to compare. Memory: the
// chats a line each, which stand for the scheduler's queue, over the map
// of the cache's blocks and the GPU it is part of, over the river, the
// cache through the run.
//
// From the top: the program's state, type and colours, the chats; the
// servers, searching by time, the cache at the clock (the one model of the
// run's state that both views draw), a chat at a moment and the walls; a
// block's slots, the map and the GPU over it, a request's block table, why
// the head of the queue waits, the river and the key; the strip, a chat's
// cards (Users' thread, Memory's blocks), the pinned chat and the
// tooltips; then the views, the clock and the controls. The desktop
// re-creates a window's scripts when it swaps the window in, so this runs
// once per window and claims it with data-ready.
(function () {
	const root = document.querySelector('.sv:not([data-ready])');
	if (!root) return;
	root.dataset.ready = '1';

	// ---- the program's state ----
	// What the program holds, all of it here: the settings and the servers
	// served from them, the clock, what is picked and what is under the
	// pointer, what is laid out for the panes' sizes, and the window's parts
	const $ = sel => root.querySelector(sel), $$ = sel => [...root.querySelectorAll(sel)];
	const E = ServeEngine, { BLOCK, KEY, KEYED, TONES, fmt } = E;
	const status = exeStatus(root);
	// The settings a server is served with. They open on static batches, the
	// oldest way, so that each technique after it shows what it buys: the
	// rest as vLLM's defaults (HOME), but for the cache, contiguous and
	// without prefix caching, as a static batch has it, so that every change
	// from here is one change. versus, the one thing a second server, in
	// Users, differs by (a key of CHANGES), or none
	const SETTINGS = ['sched', 'alloc', 'prefix', 'kv', 'rate', 'system', 'reserve', 'seqs', 'cache', 'seed'];
	const at = { ...Object.fromEntries(SETTINGS.map(k => [k, E.HOME[k]])),
		sched: 'static', alloc: 'contiguous', prefix: false };
	// the run at ×1, an answer as fast as its user sees it
	let speed = 1, versus = '', view = 'users';
	// the servers as served, the first traced; its run; each server's tiles,
	// built once a wall; the status bar's figures
	let sides = [], run = null, tiles = [], summary = '', statusText = '';
	// the run's clock, speed times real time, and whether a frame is due
	const clock = { t: 0, playing: false, last: 0, looping: false };
	// the picked chat, { side, id }; the first server's request under the
	// pointer; the river's pointer, and whether it is dragged
	let picked = null, hovered = -1, guide = -1, scrubbing = false;
	// The one model of the run at the clock that every view draws (the
	// cache at the clock, below), and the blocks lit a moment ago
	const now = { k: -2, after: false, s: null, cells: null, bands: new Map(), marks: new Map(), stranded: 0 };
	const flashes = new Map(); // block → [colour, until]
	// What is laid out for the panes' sizes, made again when they change:
	// the map's cells, which of them are drawn as what, the river
	let geo = null, drawn = null, river = null;
	const relayout = () => {
		geo = null;
		river = null;
	};
	const body = $('.sv-body'), keyEl = $('[data-out="key"]'), whyEl = $('[data-out="why"]');
	const mapCv = $('.sv-map'), wiresCv = $('.sv-wires'), riverCv = $('.sv-river');
	const stepsCv = $('.sv-steps'), usageCv = $('.sv-usage'), ttftCv = $('.sv-ttft'), itlCv = $('.sv-itl');
	const pin = $('.sv-pin'), pinTitle = $('[data-out="pin-title"]'),
		pinCard = $('[data-out="pin-card"]'), pinTime = $('.sv-pin-time'), tip = $('.sv-tip');
	const atField = $('[data-out="at"]'), runBtn = $('[data-act="run"]');
	const sel = name => $('[data-in="' + name + '"]');
	// the pinned chat's window named by its title bar, an id for this window's
	pinTitle.id = 'sv-pin-title-' + document.querySelectorAll('.sv[data-ready]').length;
	pin.setAttribute('aria-labelledby', pinTitle.id);

	// ---- type and colours ----
	// the site's own: navy, purple, gold, a red for what gives way; the
	// monitor's picture white, as the programs' panes are
	const C = { ink: '#000000', mute: '#4d4852', faint: '#9a949a', grid: '#e6e2e6',
		navy: '#000080', purple: '#800080', gold: '#b8860b', red: '#b00000' };
	const SMALL = '10px "Helvetica Neue", Arial, sans-serif',
		FONT = '11px "Helvetica Neue", Arial, sans-serif', MONO = '10px Menlo, Monaco, Consolas, monospace';
	// the map's: a free block, the gaps between cells, the weights, what
	// vLLM holds back, the null block, a free block still holding a prefix,
	// and free blocks too scattered for the next run, hatched the other way
	const FREE = '#ffffff', GAP = '#e4e0e4', PARAMS = '#5b5562', HELD = '#d9d5d9',
		NULL = '#9a959f', CACHED = '#efdfae', STRANDED = '#808080';
	// What a request is doing, as the walls, the pin and the steps colour
	// it: its own colour while its answer comes out, and these the rest of
	// the time. A static batch's padding is the same grey in the cache
	const STATES = { wait: '#d9d5d9', prefill: C.purple, stall: '#8f8a96',
		pad: '#c9c6d4', preempted: '#f0b8b8', recompute: C.red, refused: C.ink };
	const PADDING = STATES.pad;
	// a colour at a share of its strength over white: two fifths for slots
	// reserved, tokens to come, so they read as the tokens' own
	const tint = (colour, alpha = 0.4) => 'rgba('
		+ [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16)).join(', ') + ', ' + alpha + ')';
	// slots that will never hold a token are hatched (exe.js's hatch), and
	// free blocks the other way, so they part from slots set aside without
	// their colour
	// Text cut to a width, with an ellipsis
	function cut(cx, text, w) {
		if (cx.measureText(text).width <= w) return text;
		while (text && cx.measureText(text + '…').width > w) text = text.slice(0, -1);
		return text + '…';
	}
	// the clock in seconds throughout, so that it reads one way from the start
	const stamp = t => +t.toFixed(2) + ' s';
	const secs = s => s < 1 ? Math.round(s * 1e3) + ' ms' : s.toFixed(s < 10 ? 2 : 1) + ' s';
	const tenths = s => s.toFixed(1) + ' s';
	const gib = b => (b / 2 ** 30).toFixed(1) + ' GiB', mib = b => +(b / 2 ** 20).toFixed(2) + ' MiB';
	const numbered = ids => ids.map(id => '#' + (id + 1)).join(', ');
	const esc = text => text.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
	// An element's HTML, text or attribute, written only when it has
	// changed: a frame mostly says what the last one did, and each write lays
	// the window out again. HTML is kept as written, the browser's own
	// reading of it differing
	const written = new WeakMap();
	function setHTML(el, html) {
		if (written.get(el) === html) return;
		written.set(el, html);
		el.innerHTML = html;
	}
	function setText(el, text) {
		if (el.textContent !== text) el.textContent = text;
	}
	function setAttr(el, name, value) {
		if (el.getAttribute(name) !== value) el.setAttribute(name, value);
	}

	// ---- the chats ----
	// What the users send and what comes back, written for serve.exe in
	// _data/serve_chats.yml, whose head says how a chat is written; the page
	// carries them as JSON, and the site's build checks them
	// (_plugins/check_serve.rb). How long each is and when each token comes
	// are the engine's. Mostly English, some Korean, the rest a spread
	const CHATS = JSON.parse($('.sv-chats').textContent);
	// The shares of the languages: two thirds English, a sixth Korean, the
	// rest spread evenly
	const LANGS = [['en', 4 / 6], ['ko', 1 / 6],
		...['ja', 'zh', 'es', 'fr', 'de', 'pt', 'vi', 'hi'].map(l => [l, 1 / 48])];

	// The rules a chat's items are made by (its make), an item at a time, i
	// from 0, each correct however many are asked for; and the sizes its ask
	// names, given how many (vars), its count {n} unless it says otherwise. A
	// list of numbers (primes, squares, numerals, a table) says so. A rule
	// that draws from lists takes item i of each over its length, at a
	// stride, so that next items differ
	const COUNTED = n => ({ n: fmt(n) });
	const sizesOf = (maker, n) => (maker.vars || COUNTED)(n);
	// the ith prime, the primes found so far kept, as many as an answer asks for
	const PRIMES = [2];
	function prime(i) {
		for (let n = PRIMES[PRIMES.length - 1] + 1; PRIMES.length <= i; n++) {
			let factor = false;
			for (const p of PRIMES) {
				if (p * p > n) break;
				if (n % p === 0) {
					factor = true;
					break;
				}
			}
			if (!factor) PRIMES.push(n);
		}
		return PRIMES[i];
	}
	const isLeap = y => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
	const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
		'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
	const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
	// a number in English words, the British way, with “and” after the hundreds
	function inWords(n) {
		if (n < 20) return ONES[n];
		if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
		if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + inWords(n % 100) : '');
		return inWords(Math.floor(n / 1000)) + ' thousand'
			+ (n % 1000 ? (n % 1000 < 100 ? ' and ' : ' ') + inWords(n % 1000) : '');
	}
	// Sino-Korean and Japanese numerals below ten thousand: a digit before
	// its place, but one before ten, a hundred or a thousand left unsaid
	function numerals(n, digits, places) {
		let out = '';
		[1000, 100, 10].forEach((p, i) => {
			const d = Math.floor(n / p) % 10;
			if (d) out += (d > 1 ? digits[d] : '') + places[i];
		});
		return out + (n % 10 ? digits[n % 10] : '');
	}
	const SINO = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'],
		KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
	const day = i => new Date(Date.UTC(2024, 0, 2 + i)).toISOString().slice(0, 10);
	const comma = (x, k) => x.toFixed(k).replace('.', ',');
	// item i of a list, and of a list i laps through at a time
	const nth = (list, i) => list[i % list.length];
	const lap = (list, i) => Math.floor(i / list.length);
	// the lists the rules draw from
	const CUSTOMERS = {
		first: ['Olivia', 'James', 'Amara', 'Noah', 'Sofia', 'Liam', 'Priya', 'Mateo', 'Chloe', 'Daniel',
			'Yuki', 'Ethan', 'Zara', 'Lucas', 'Hannah', 'Omar', 'Grace', 'Leo', 'Maya', 'Isaac'],
		last: ['Smith', 'Okafor', 'Garcia', 'Chen', 'Patel', 'Novak', 'Kim', 'Rossi', 'Murphy', 'Silva', 'Dubois',
			'Khan', 'Andersen', 'Lopez', 'Nguyen', 'Walsh', 'Ito', 'Haddad', 'Brown', 'Kowalski', 'Moreau'],
		city: ['London', 'Manchester', 'Leeds', 'Bristol', 'Glasgow', 'Cardiff',
			'Belfast', 'Edinburgh', 'Liverpool', 'Brighton', 'York', 'Norwich'],
		plan: ['free', 'basic', 'pro'],
	};
	const PRODUCTS = {
		kind: ['Oak', 'Walnut', 'Linen', 'Ceramic', 'Copper', 'Wool', 'Bamboo', 'Glass',
			'Leather', 'Cotton', 'Marble', 'Steel', 'Cork', 'Rattan', 'Velvet'],
		thing: ['desk', 'lamp', 'mug', 'cushion', 'shelf', 'throw', 'vase', 'stool', 'tray',
			'rug', 'clock', 'mirror', 'basket', 'planter', 'bench', 'kettle', 'bowl'],
	};
	const EMAILS = {
		first: ['alex', 'sam', 'jordan', 'taylor', 'morgan', 'casey', 'riley', 'jamie',
			'robin', 'avery', 'quinn', 'drew', 'jesse', 'kai', 'rowan', 'sage'],
		last: ['reed', 'park', 'hughes', 'moreno', 'tanaka', 'fischer', 'obrien',
			'santos', 'ahmed', 'clarke', 'ivanova', 'lund', 'mensah', 'young'],
	};
	const SALES = {
		region: ['서울', '부산', '대구', '인천', '광주', '대전', '울산'],
		goods: [['무선 이어폰', 89000], ['보조배터리', 32000], ['노트북 거치대', 27000],
			['기계식 키보드', 119000], ['USB-C 케이블', 9900], ['블루투스 스피커', 59000], ['무선 마우스', 24000]],
	};
	const NAMES = {
		surname: ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙'],
		given: ['伟', '芳', '娜', '敏', '静', '磊', '洋', '勇', '艳', '杰', '涛', '明', '超', '霞', '平', '军', '丽'],
	};
	const KUNDEN = {
		first: ['Anna', 'Lukas', 'Mia', 'Jonas', 'Lea', 'Felix', 'Emma',
			'Paul', 'Lena', 'Ben', 'Sophie', 'Max', 'Laura', 'Tim'],
		last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner',
			'Becker', 'Hoffmann', 'Schäfer', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann'],
		city: ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart',
			'Düsseldorf', 'Leipzig', 'Dresden', 'Hannover', 'Nürnberg'],
		plan: ['Basis', 'Plus', 'Premium'],
	};
	const MAKERS = {
		primes: { numbers: true, item: i => (i ? ' ' : '') + prime(i) + ',', last: s => s.replace(/,$/, '.') },
		leap: { item: i => '\nassert is_leap_year(' + (1890 + i) + ') is ' + (isLeap(1890 + i) ? 'True' : 'False'),
			vars: n => ({ a: 1890, b: 1890 + n - 1 }) },
		customers: {
			item: i => {
				const { first, last, city, plan } = CUSTOMERS;
				return '\n' + (1001 + i) + ',' + nth(first, i) + ' ' + nth(last, i * 13 + lap(first, i)) + ','
					+ nth(city, i * 5) + ',' + nth(plan, i * 7) + ','
					+ new Date(Date.UTC(2023, 0, 4 + i * 3)).toISOString().slice(0, 10);
			},
		},
		sino: { numbers: true, item: i => '\n' + (i + 1) + ' ' + numerals(i + 1, SINO, ['천', '백', '십']) },
		inserts: {
			item: i => {
				const { kind, thing } = PRODUCTS, name = nth(kind, i) + ' ' + nth(thing, i * 4 + lap(kind, i));
				return '\nINSERT INTO products (id, name, price) VALUES (' + (i + 1)
					+ ', \'' + name + '\', ' + (9 + (i * 37) % 250) + '.99);';
			},
		},
		// each first name with each surname once, in a shuffled order, then
		// again numbered
		emails: {
			item: i => {
				const { first, last } = EMAILS, pairs = first.length * last.length;
				return '\n' + nth(first, i) + '.' + nth(last, i + lap(first, i))
					+ (i >= pairs ? Math.floor(i / pairs) + 1 : '') + '@example.com';
			},
		},
		sales: {
			item: i => {
				const [what, price] = nth(SALES.goods, i * 3), qty = 1 + (i * 5) % 9;
				return '\n' + day(i) + ',' + nth(SALES.region, i * 2) + ','
					+ what + ',' + price + ',' + qty + ',' + price * qty;
			},
		},
		english: { numbers: true, item: i => '\n' + (i + 1) + ' ' + inWords(i + 1) },
		squaresKo: { numbers: true, item: i => '\n' + (i + 1) + '² = ' + (i + 1) * (i + 1) },
		kanji: { numbers: true, item: i => '\n' + (i + 1) + ' ' + numerals(i + 1, KANJI, ['千', '百', '十']) },
		// a surname and a given name of one character, every pair once, then
		// of two; each surname's run of given names shifted, so that next
		// lines differ
		names: {
			item: i => {
				const { surname, given } = NAMES, pairs = surname.length * given.length;
				const j = i < pairs ? i : i - pairs, s = j % surname.length, a = lap(surname, j);
				return '\n' + surname[s]
					+ (i < pairs ? nth(given, 10 * a + 5 * s)
						: nth(given, a + 7 * s) + nth(given, lap(given, a) + 3 * s));
			},
		},
		miles: { numbers: true,
			item: i => '\n' + (i + 1) + (i ? ' millas' : ' milla') + ' = ' + comma((i + 1) * 1.609344, 2) + ' km' },
		celsius: {
			numbers: true,
			item: i => {
				const c = -40 + i, f = c * 9 / 5 + 32,
					num = x => (x < 0 ? '−' : '') + (Number.isInteger(x) ? String(Math.abs(x)) : comma(Math.abs(x), 1));
				return '\n' + num(c) + ' °C = ' + num(f) + ' °F';
			},
			vars: n => ({ b: String(-40 + n - 1).replace('-', '−') }),
		},
		kunden: {
			item: i => {
				const { first, last, city, plan } = KUNDEN;
				return '\n' + (10001 + i) + ';' + nth(first, i) + ' ' + nth(last, i * 4 + lap(first, i))
					+ ';' + nth(city, i * 3) + ';' + nth(plan, i * 5);
			},
		},
		pounds: { numbers: true, item: i => '\n' + (i + 1) + ' kg = ' + comma((i + 1) * 2.20462262, 2) + ' lb' },
		squaresHi: { numbers: true, item: i => '\n' + (i + 1) + ' का वर्ग = ' + (i + 1) * (i + 1) },
	};

	// A text as the tokens it streams in: a word a token where words are
	// spaced, each with the space before it, a CSV's fields one by one;
	// Chinese and Japanese a character or two a token, Latin runs whole;
	// space before a token goes with it. The tokens put back together are
	// the text, but for the space it ends with
	const SPACED = /\s*\S+/g, FIELD = /(?<=[,;])(?=\S)/;
	const CJK = /\s*(?:[A-Za-z0-9_]+(?:[.'’\-][A-Za-z0-9_]+)*|[、。，．！？「」『』（）：；“”‘’《》【】·…—]|[^\s\x00-\x7f、。，．！？「」『』（）：；“”‘’《》【】·…—]{1,2}|[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e])/g;
	function tokensOf(text, lang) {
		if (lang === 'ja' || lang === 'zh') return text.match(CJK) || [];
		return (text.match(SPACED) || []).flatMap(word => word.split(FIELD));
	}
	// about how many of the model's tokens a text takes, for what its
	// prompt carries beside it: a spaced word is about 1.4 of them
	const PER_WORD = 1.4;
	const estimate = (text,
		lang) => Math.ceil(tokensOf(text, lang).length * (lang === 'ja' || lang === 'zh' ? 1 : PER_WORD));
	const fillIn = (text, vars) => text.replace(/\{(\w)\}/g, (_, k) => vars[k]);

	// A deterministic hash in [0, 1) of a few integers: them folded into one,
	// then the first draw of the engine's own Mulberry32 from it
	const hash = (...xs) => E.rng(xs.reduce((h, x) => Math.imul(h ^ (x >>> 0), 2654435761) >>> 0, 2166136261))();
	// A piece's ways of being said, as [tokens, text]: its words with each
	// set of its ⟨…⟩ left out, and, bracketed, not at all. Each way is
	// counted whole, as a piece starts a fresh token
	function waysOf(piece, vars, lang) {
		const bits = fillIn(Array.isArray(piece) ? piece[0] : piece, vars).split(/[⟨⟩]/), ways = [];
		for (let mask = 0; mask < 1 << (bits.length >> 1); mask++) {
			const text = bits.filter((b, i) => i % 2 === 0 || mask >> (i >> 1) & 1).join('');
			ways.push([tokensOf(text, lang).length, text]);
		}
		if (Array.isArray(piece)) ways.push([0, '']);
		return ways;
	}
	// One way for each piece, their tokens adding up to n, or null. Which,
	// of the sets that would, by the hash: can[j][s] says whether the pieces
	// from j on can add s over their fewest
	function choose(pieces, n, seed, id) {
		const least = pieces.map(ways => Math.min(...ways.map(w => w[0])));
		let need = n - least.reduce((a, b) => a + b, 0);
		if (need < 0 || need > pieces.reduce((a, ways, j) => a + Math.max(...ways.map(w => w[0])) - least[j], 0)) {
			return null;
		}
		const can = [];
		can[pieces.length] = new Uint8Array(need + 1);
		can[pieces.length][0] = 1;
		for (let j = pieces.length - 1; j >= 0; j--) {
			can[j] = new Uint8Array(need + 1);
			for (let s = 0; s <= need; s++) {
				can[j][s] = pieces[j].some(([t]) => t - least[j] <= s && can[j + 1][s - t + least[j]]) ? 1 : 0;
			}
		}
		if (!can[0][need]) return null;
		return pieces.map((ways, j) => {
			const fits = ways.filter(([t]) => t - least[j] <= need && can[j + 1][need - t + least[j]]);
			const [t, text] = fits[Math.floor(hash(seed, id, j) * fits.length)];
			need -= t - least[j];
			return text;
		});
	}
	// the tokens of a made chat's first k items, for k up to the first past n
	const itemSums = new Map();
	function sumsTo(chat, n) {
		let sums = itemSums.get(chat);
		if (!sums) itemSums.set(chat, (sums = [0]));
		while (sums.at(-1) <= n) {
			sums.push(sums.at(-1) + tokensOf(MAKERS[chat.make].item(sums.length - 1), chat.lang).length);
		}
		return sums;
	}
	// A chat's answer at exactly n tokens, or null if it can't come to n.
	// Made: as many items as fit, or else up to FEWER fewer, around the
	// pieces, a written chat's ways worked out once
	const FEWER = 12;
	const writtenWays = new Map();
	function answerOf(chat, n, seed, id) {
		const lang = chat.lang;
		if (!chat.make) {
			if (!writtenWays.has(chat)) writtenWays.set(chat, chat.answer.map(p => waysOf(p, {}, lang)));
			const parts = choose(writtenWays.get(chat), n, seed, id);
			return parts && { text: parts.join(''), ask: chat.ask };
		}
		const maker = MAKERS[chat.make], sums = sumsTo(chat, n);
		const rest = chat.answer.reduce((a, p) => a
				+ (p === '{items}' ? 0 : Math.min(...waysOf(p, sizesOf(maker, 1), lang).map(w => w[0]))), 0);
		for (let k = sums.findLastIndex(s => s <= n - rest), tries = 0; k > 0 && tries < FEWER; k--, tries++) {
			const vars = sizesOf(maker, k),
				pieces = chat.answer.map(p => p === '{items}' ? [[sums[k], '{items}']] : waysOf(p, vars, lang));
			const parts = choose(pieces, n, seed, id);
			if (!parts) continue;
			const items = Array.from({ length: k }, (_, i) => maker.item(i));
			if (maker.last) items[k - 1] = maker.last(items[k - 1]);
			return { text: parts.join('').replace('{items}', items.join('')), ask: fillIn(chat.ask, vars) };
		}
		return null;
	}
	// about how many tokens a chat's ask takes, a made one's sizes as its
	// rule names them for 99 items, worked out once a chat
	const askTokens = new Map();
	function asked(chat) {
		if (!askTokens.has(chat)) {
			askTokens.set(chat,
				estimate(chat.make ? fillIn(chat.ask, sizesOf(MAKERS[chat.make], 99)) : chat.ask, chat.lang));
		}
		return askTokens.get(chat);
	}
	// a prompt's rest under this many tokens goes unmarked
	const MARKED = 8;
	// The chats for a run: each request a language by its hash,
	// then, of that language's chats its prompt fits, the one worn least so
	// far whose answer comes to its count, so that the wall repeats as
	// little as it can. Each with its message as its user wrote it and its
	// tokens, what else its prompt carries (a paste, or the conversation so
	// far as its earlier turns), and its answer as the tokens it streams in
	function chatsFor(run, seed) {
		const used = new Map();
		// a chat answered by a rule asks for a different count each time, so
		// it shows less when used again than a written one does; but a list
		// of numbers reads least like a chat, so it wears as a written one does
		const worn = c => (used.get(c) || 0) / (c.make && !MAKERS[c.make].numbers ? 3 : 1);
		return run.S.reqs.map(r => {
			const own = r.prompt - r.system, u = hash(seed, r.id, 7);
			let upTo = 0, lang = 'en';
			for (const [l, share] of LANGS) if (u < (upTo += share)) { lang = l; break; }
			const fitIn = l => {
				const order = CHATS.filter(c => c.lang === l && asked(c) <= own)
					.sort((x, y) => worn(x) - worn(y)
						|| hash(seed, r.id, CHATS.indexOf(x)) - hash(seed, r.id, CHATS.indexOf(y)));
				for (const c of order) {
					const answer = answerOf(c, r.output, seed, r.id);
					if (answer) return [c, answer];
				}
				return null;
			};
			// that language's, or else English's; and should the data have lost
			// every chat that comes to this count, an answer of dots rather
			// than a window blanked by an error
			let got = fitIn(lang);
			if (!got) got = fitIn((lang = 'en'));
			if (!got) {
				return { lang, ask: '…', asks: own, rest: 0, paste: '', turns: [], tokens: Array(r.output).fill(' …') };
			}
			const [chat, answer] = got;
			used.set(chat, (used.get(chat) || 0) + 1);
			const left = own - estimate(answer.ask, lang), rest = left < MARKED ? 0 : left;
			return { lang, ask: answer.ask, asks: own - rest, rest, paste: rest && chat.paste ? chat.paste : '',
				turns: rest && !chat.paste ? turnsOf(rest, seed, r.id) : [], tokens: tokensOf(answer.text, lang) };
		});
	}
	// The conversation so far, as a chat client sends it with each message:
	// a plausible number of turns for its tokens, each a user's message and
	// the reply, a reply about two and a half times as long; their tokens,
	// by the hash, adding up to rest
	function turnsOf(rest, seed, id) {
		const n = Math.max(1, Math.min(6, Math.round(rest / (200 + 250 * hash(seed, id, 13)))));
		const weights = Array.from({ length: 2 * n },
			(_, i) => (i % 2 ? 2.5 : 1) * (0.6 + 0.8 * hash(seed, id, 20 + i)));
		const sum = weights.reduce((a, w) => a + w, 0), out = weights.map(w => Math.max(1, Math.floor(rest * w / sum)));
		out[out.length - 1] += rest - out.reduce((a, x) => a + x, 0);
		return out;
	}
	// The chats for a run's requests, made again only for requests not seen
	// lately, as most settings change how the requests are served, not what
	// they ask: chatsFor reads a request's own prompt and its answer's length
	const chatsMade = new Map();
	function chatsOf(run, seed) {
		const key = seed + ':' + run.S.reqs.map(r => (r.prompt - r.system) + '/' + r.output).join(',');
		if (!chatsMade.has(key)) {
			if (chatsMade.size >= 8) chatsMade.delete(chatsMade.keys().next().value);
			chatsMade.set(key, chatsFor(run, seed));
		}
		return chatsMade.get(key);
	}
	// a chat's message as a tile shows it, a paste named after it
	const message = c => c.paste ? c.ask + ' + pasted: ' + c.paste + ' (' + fmt(c.rest) + ' tokens)' : c.ask;
	// a chat's answer from token a to token b, as text
	const answerText = (c, a, b) => c.tokens.slice(a, b).join('').replace(/^\s+/, '');


	// ---- the servers ----
	// How each setting reads, in a server's name and in the list of what a
	// second server, compared in Users, can differ by: from the simplest
	// technique to the newest, then all of vLLM's at once, then the load. A
	// change applies where it would change the settings as they apply
	// (E.effective): a static batch's cache is contiguous whatever is set,
	// and prefix caching only a paged cache's
	const SCHED = { static: 'static batches', prefill: 'prefill first', chunked: 'chunked prefill' };
	const ALLOC = { contiguous: 'contiguous', paged: 'paged' };
	const KV = new Map([[2, 'auto'], [1, 'fp8']]);
	const BLOCKS = { 1: 'all the blocks', 0.5: 'half the blocks', 0.25: 'a quarter of the blocks' };
	const WORDS = {
		sched: v => SCHED[v], alloc: v => ALLOC[v] + ' cache',
		prefix: v => (v ? '' : 'no ') + 'prefix caching', kv: v => (v === 1 ? 'fp8' : 'bf16') + ' cache',
		rate: v => 'request_rate ' + E.SHOW.rate(v), system: v => 'system prompt ' + fmt(v),
		reserve: v => 'max_tokens ' + fmt(v), seqs: v => 'max_num_seqs ' + fmt(v),
		cache: v => BLOCKS[v], seed: v => 'seed ' + v,
	};
	const sameAs = (a, b) => SETTINGS.every(k => a[k] === b[k]);
	const change = (key, label, group,
		apply) => ({ key, label, group, apply, applies: a => !sameAs(E.effective(a), E.effective(apply(a))) });
	const sets = (k, v) => a => ({ ...a, [k]: v });
	const CHANGES = [
		...Object.keys(SCHED).map(v => change('sched:' + v, WORDS.sched(v), 'Scheduler', sets('sched', v))),
		change('alloc:contiguous', 'a ' + WORDS.alloc('contiguous'), 'KV cache', sets('alloc', 'contiguous')),
		change('alloc:paged', 'a ' + WORDS.alloc('paged'), 'KV cache', sets('alloc', 'paged')),
		change('prefix:off', WORDS.prefix(false), 'KV cache', sets('prefix', false)),
		change('prefix:on', WORDS.prefix(true), 'KV cache', sets('prefix', true)),
		change('kv:1', 'an ' + WORDS.kv(1), 'KV cache', sets('kv', 1)),
		change('kv:2', 'a ' + WORDS.kv(2), 'KV cache', sets('kv', 2)),
		change('home', 'vLLM’s defaults', 'All of vLLM’s: chunked prefill, paged, prefix caching',
			a => ({ ...a, sched: E.HOME.sched, alloc: E.HOME.alloc, prefix: E.HOME.prefix, kv: E.HOME.kv })),
		...E.VALUES.cache.map(v => change('cache:' + v, WORDS.cache(v), 'Load', sets('cache', v))),
		...E.VALUES.rate.map(v => change('rate:' + v, WORDS.rate(v), 'Load', sets('rate', v))),
	];
	const changeOf = key => CHANGES.find(c => c.key === key);
	// A server named by how it differs from vLLM's defaults, each difference
	// only where the settings before it don't imply it: under static
	// batches, a contiguous cache goes unsaid
	function nameOf(settings) {
		const a = E.effective(settings), out = [];
		SETTINGS.forEach((k, i) => {
			const implied = E.effective({ ...E.HOME, ...Object.fromEntries(SETTINGS.slice(0, i).map(j => [j, a[j]])) });
			if (a[k] !== implied[k]) out.push(WORDS[k](a[k]));
		});
		return out.length ? out.join(' · ') : 'vLLM’s defaults';
	}

	// A run served to its end, and what its users see of it. A static batch
	// returns its rows only when its longest answer ends, as request-level
	// scheduling did before Orca (Yu et al., 2022), so its user's first
	// token comes with the last, all of it at once; any other server
	// streams each token as the step that makes it ends. The first server's
	// run is traced, every change to a block kept, for Memory's map
	function serve(a, traced) {
		const run = E.simulate({ ...a, trace: traced }), whole = a.sched === 'static';
		const users = run.S.reqs.map(r => ({ r, colour: E.hue(r.id), progress: [], outs: [] }));
		run.steps.forEach(s => {
			// a sequence's prompt going through, a step at a time: from the
			// tokens it had computed to those it has after the step, back to
			// none when it gave way, as its step began
			for (const [id, n, ctx, kind] of s.seqs) {
				if (n && (kind === 'prefill' || kind === 'recompute')) {
					users[id].progress.push([s.t0, s.t1, ctx, ctx + n]);
				}
			}
			for (const id of s.out) {
				users[id].progress.push([s.t0, s.t0, 0, 0]);
				users[id].outs.push(s.t0);
			}
		});
		for (const u of users) {
			const segs = u.r.segs;
			u.end = segs.length ? segs[segs.length - 1].t1 : u.r.arrival;
			u.served = u.r.status === 'done';
			u.first = !u.served ? Infinity : whole ? u.end : u.r.first;
		}
		// The users' latencies in the order they came: first tokens as they
		// reached their users, the status bar's and the box's alike; and the
		// gaps between tokens, when each came and how long it was, none for an
		// answer sent whole
		const firsts = users.filter(u => u.served)
			.map(u => [u.first, u.first - u.r.arrival, u.r.id]).sort((x, y) => x[0] - y[0]);
		const gaps = whole ? []
			: users.flatMap(u => u.r.times.slice(1).map((t, i) => [t, t - u.r.times[i]])).sort((x, y) => x[0] - y[0]);
		const gapAt = Float64Array.from(gaps, g => g[0]), gapLen = Float64Array.from(gaps, g => g[1]);
		const made = Float64Array.from(users.flatMap(u => u.r.times)).sort();
		// the run ends with its last step, or with the last request, refused
		const end = Math.max(run.S.t, users[users.length - 1].r.arrival);
		return { at: a, run, whole, users, firsts, gapAt, gapLen,
			made, end, name: nameOf(a), chats: chatsOf(run, a.seed) };
	}
	const lastArrival = () => Math.max(...sides.map(v => v.run.S.reqs[v.run.S.reqs.length - 1].arrival));
	// the servers a view shows, the second only in Users; and the end of the
	// longest, which the clock runs to
	const shown = () => (view === 'users' ? sides : sides.slice(0, 1));
	const endOf = () => Math.max(...shown().map(v => v.end));

	// ---- searching by time ----
	// how many of xs (sorted) are at or before t
	function upto(xs, t, key = x => x) {
		let lo = 0, hi = xs.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (key(xs[mid]) <= t) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	}
	// r's segment at t, or null past its last
	function segAt(r, t) {
		const i = upto(r.segs, t, s => s.t0) - 1;
		return i >= 0 && t < r.segs[i].t1 ? r.segs[i] : null;
	}

	// ---- the cache at the clock ----
	// The one model of the run at the clock that every view draws: the first
	// server's step under way (or last ended), k, and whether the clock is
	// past its end, after, the requests it finished gone; the cache as the
	// engine kept it then, s, its bands, slots and counts; its blocks, kept
	// up to date a step at a time while the clock plays on, so that what
	// changed can be lit, and rebuilt from the run's keyframes on a jump of
	// more than REPLAY steps; and where the kinds of each band's slots
	// change, counted in slots from its sequence's first: a static batch's
	// left padding, its tokens, the slots reserved for tokens still to come,
	// a static batch's padding after its answer, then internal
	// fragmentation, slots no token will reach. A step's blocks are taken as
	// it begins and given back as it ends, as the scheduler takes and frees
	// them, so a join, a preemption and a finish change on the wall and on
	// the map at the same moment. Lit only where the map is drawn, else
	// nothing would let them fade, and not for a reader who asks for less
	// motion
	const REPLAY = 48;
	const FLASH = 700; // ms a change stays lit
	const still = matchMedia('(prefers-reduced-motion: reduce)');
	function settle(t, play) {
		const k = E.stepAt(run, t), s = run.steps[k], after = !!(s && s.after && t >= s.t1);
		if (k === now.k && after === now.after) return;
		const on = k > now.k || (k === now.k && after);
		if (play && now.cells && on && k - now.k <= REPLAY) {
			const t0 = performance.now(), { owner, kind: kinds } = now.cells;
			// a block taken lights navy, or gold when it was evicted for it; a
			// preempted request's blocks red as they are freed
			const light = (b, to, kind, step) => {
				const was = owner[b];
				if (to >= 0 && was < 0) flashes.set(b,
					[kinds[b] !== KEY.none && kind === KEY.none ? C.gold : C.navy, t0 + FLASH]);
				else if (to < 0 && was >= 0 && step.out.includes(was)) flashes.set(b, [C.red, t0 + FLASH * 1.6]);
			};
			E.playOn(run, now.cells, now.k, now.after, k, after, view === 'memory' && !still.matches ? light : null);
		} else {
			now.cells = E.blocksAt(run, k, now.cells || undefined, after);
			flashes.clear();
		}
		now.k = k;
		now.after = after;
		now.s = !s ? null : after ? s.after : s;
		now.stranded = now.s ? now.s.stranded : 0;
		now.bands = new Map(now.s ? now.s.bands.map(b => [b.id, b]) : []);
		// a static batch's finished row has no tokens: its padding runs to
		// the batch's end
		now.marks = new Map([...now.bands].map(([id, b]) => [id,
			[b.pad, b.pad + b.tokens, b.pad + b.tokens + b.reserved, b.pad + b.tokens + b.reserved + b.tail]]));
	}
	// The head of the queue at t and why it waits, as the step under way
	// found it; one come while the step ran only once it has come
	function headAt(t) {
		const s = run.steps[now.k], h = s && s.head;
		return h && (h.reason !== 'arrived' || t >= h.at) ? h : null;
	}
	// The blocks by what they hold at the clock, for the bar and the key, as
	// the engine counted them: the system prompt's, once however many share
	// them; the rest in use; free but still cached; free
	function census() {
		const s = now.s;
		if (!s) return { shared: 0, used: 0, cached: 0, free: run.usable };
		const shared = s.slots.system / BLOCK;
		return { shared, used: s.used - shared, cached: s.cached, free: run.usable - s.used - s.cached };
	}

	// ---- a chat at a moment ----
	// What user u sees at t: st, its state; phase, which of the wall's
	// counts it is in; sent, the tokens come to it; made, those the server
	// has made; shown, those its chat shows, a static batch's made but held;
	// share, how much of a prompt is read; since, when it began to wait
	const PHASE = { future: 'come', wait: 'waiting', preempted: 'waiting', done: 'done', refused: 'refused' };
	function stateAt(v, u, t) {
		const r = u.r;
		const state = (st, sent, made,
			more) => ({ st, phase: PHASE[st] || 'answering', sent, made,
				shown: v.whole && st !== 'done' ? made : sent, ...more });
		if (t < r.arrival) return state('future', 0, 0);
		if (r.status === 'refused') return state('refused', 0, 0);
		const made = upto(r.times, t);
		if (t >= u.end) return state('done', r.generated, made);
		const s = segAt(r, t), sent = v.whole ? 0 : made;
		if (!s) return state('wait', sent, made, { since: r.arrival });
		const kind = s.kind;
		if (kind === 'wait' || kind === 'preempted') return state(kind, sent, made, { since: s.t0 });
		if (kind === 'prefill' || kind === 'recompute') {
			// the prompt read so far, moving on through the step that reads it
			const p = u.progress[upto(u.progress, t, q => q[0]) - 1];
			const done = !p ? 0 : t < p[1] ? p[2] + (p[3] - p[2]) * (t - p[0]) / (p[1] - p[0]) : p[3];
			const of = kind === 'prefill' ? (v.whole ? v.run.batches[r.batch].len : r.prompt) : r.prompt + made;
			return state(kind, sent, made, { share: Math.min(1, done / of) });
		}
		return state(kind, sent, made);
	}
	// tokens a second, from the last few to come
	function pace(r, made) {
		const k = Math.min(made - 1, 8);
		return k > 0 ? k / (r.times[made - 1] - r.times[made - 1 - k]) : 0;
	}
	// A chat's title bar: what it waits on, in the colours serve.exe gives
	// each state; a request's own colour, faintly, while its answer comes
	function bar(v, u, c, t) {
		switch (c.st) {
			case 'future': return ['', 'transparent', C.faint];
			case 'refused': return ['refused', STATES.refused, '#ffffff'];
			case 'wait': return ['waiting ' + tenths(t - c.since), STATES.wait, C.ink];
			case 'preempted': return ['preempted ' + tenths(t - c.since), STATES.preempted, C.ink];
			case 'prefill': return [(v.whole ? 'batch ' + (u.r.batch + 1) + ' · ' : '')
					+ 'reading ' + Math.round(c.share * 100) + '%', STATES.prefill, '#ffffff'];
			case 'recompute': return ['again ' + Math.round(c.share * 100) + '%', STATES.recompute, '#ffffff'];
			case 'stall': return ['stalled', STATES.stall, '#ffffff'];
			case 'pad': return ['batch ' + (u.r.batch + 1) + ' · held', STATES.pad, C.ink];
			case 'done': return ['✓ ' + secs(u.first - u.r.arrival), '#ffffff', C.navy];
		}
		// making its answer: streamed at its pace, or kept for its batch
		if (v.whole) {
			return ['batch ' + (u.r.batch + 1) + ' · ' + Math.round(c.made / u.r.output * 100) + '%',
				tint(u.colour, 0.3), C.ink];
		}
		const rate = pace(u.r, c.made);
		return [rate ? Math.round(rate) + ' tok/s' : 'typing', tint(u.colour, 0.3), C.ink];
	}

	// ---- the walls ----
	// A tile a user, built once a wall; drawn again only when what it shows
	// has changed. A chat a line when two servers are compared or the chats
	// stand over the cache, then with the blocks it holds and, at the head of
	// the queue, a navy edge, and no words: a line there is too short for
	// them. A tile is reached by Tab too, Enter picking it
	const TAIL = { tile: 40, line: 24, tip: 60 }; // tokens of an answer's latest shown
	const compact = () => view === 'memory' || sides.length > 1;
	const pickedId = () => (picked && picked.side === 0 ? picked.id : -1);
	function build() {
		tiles = $$('.sv-side').map((el, i) => {
			const wall = el.querySelector('.sv-wall');
			wall.textContent = '';
			if (i >= sides.length) return [];
			const v = sides[i];
			return v.users.map(u => {
				const tile = document.createElement('div'), talk = v.chats[u.r.id];
				tile.className = 'sv-tile';
				tile.dataset.id = u.r.id;
				tile.tabIndex = 0;
				tile.setAttribute('role', 'button');
				tile.setAttribute('aria-label', '#' + (u.r.id + 1) + ': ' + message(talk));
				tile.style.setProperty('--c', u.colour);
				tile.innerHTML = '<div class="sv-tbar"><b>#' + (u.r.id + 1)
					+ '</b><span></span></div><i class="sv-blk"></i>'
					+ '<p class="sv-ask">' + ask(u.r, talk) + '</p><div class="sv-ans"><span lang="'
					+ talk.lang + '"></span></div><i class="sv-prog"><i></i></i>';
				wall.append(tile);
				return { el: tile, st: tile.querySelector('.sv-tbar span'), blk: tile.querySelector('.sv-blk'),
					ans: tile.querySelector('.sv-ans span'), prog: tile.querySelector('.sv-prog i'), key: '' };
			});
		});
	}
	// The user's turn, two lines of a bubble cut to its width: the message,
	// the paste after it, the chat so far left for the tooltip; under it its
	// tokens, the system prompt every prompt starts with in gold, then its own
	function ask(r, talk) {
		return '<span lang="' + talk.lang + '">' + esc(message(talk)) + '</span>'
			+ '<small>' + (r.system ? '<b>' + fmt(r.system) + ' system</b> + ' : '')
			+ fmt(r.prompt - r.system) + '</small>';
	}
	// The walls of the servers shown at t, each user's state worked out once
	// a frame (states, as draw() has them); in Memory the first's tiles lit
	// where the pointer's request is, its queue's head edged, and each with
	// the blocks it holds. A tile is drawn again only when what it shows
	// has changed
	function drawWalls(t, states) {
		const memory = view === 'memory', tail = memory ? 0 : compact() ? TAIL.line : TAIL.tile,
			head = memory ? headAt(t) : null;
		const els = $$('.sv-side');
		els.forEach((el, i) => {
			if (el.hidden !== i >= shown().length) el.hidden = i >= shown().length;
		});
		shown().forEach((v, i) => {
			const el = els[i], counts = { come: 0, waiting: 0, answering: 0, done: 0, refused: 0 };
			v.users.forEach((u, id) => {
				const c = states[i][id], tile = tiles[i][id];
				counts[c.phase]++;
				const [said, back, ink] = bar(v, u, c, t);
				const band = memory && !i ? now.bands.get(id) : null,
					pinned = !!picked && picked.side === i && picked.id === id;
				const cls = 'sv-tile' + (c.st === 'future' ? ' future' : '')
					+ (v.whole && c.st !== 'done' && c.made ? ' held' : '')
					+ (c.st === 'stall' ? ' stalled' : '')
					+ (c.st === 'preempted' || c.st === 'recompute' ? ' cut' : '')
					+ (pinned ? ' pinned' : '') + (memory && !i && hovered === id ? ' lit' : '')
					+ (head && !i && head.id === id ? ' head' : '');
				const key = cls + said + c.shown + tail + (band ? band.held + ':' + band.shared : '');
				if (key === tile.key) return;
				tile.key = key;
				tile.el.className = cls;
				tile.el.setAttribute('aria-pressed', pinned);
				tile.el.style.setProperty('--bar', back);
				tile.el.style.setProperty('--bar-ink', ink);
				tile.st.textContent = said;
				tile.blk.textContent = band ? band.held : '';
				tile.blk.classList.toggle('shared', !!(band && band.shared));
				tile.ans.textContent = tail ? answerText(v.chats[id], Math.max(0, c.shown - tail), c.shown) : '';
				tile.prog.style.setProperty('--p', (c.shown / u.r.output * 100).toFixed(1) + '%');
			});
			const name = el.querySelector('[data-out="name"]');
			setText(name,
				i ? 'With ' + changeOf(versus).label : shown().length > 1 ? 'This server: ' + v.name : v.name);
			setAttr(name, 'title', v.name);
			setText(el.querySelector('[data-out="count"]'),
				[counts.come && counts.come + ' to come', counts.waiting + ' waiting', counts.answering + ' answering',
				counts.done + ' done', counts.refused && counts.refused + ' refused'].filter(Boolean).join(' · '));
			drawEvent(el.querySelector('[data-out="event"]'), v, t, counts);
		});
	}
	// forget what the tiles show, so that the next draw draws them all
	const redrawTiles = () => tiles.forEach(side => side.forEach(x => (x.key = '')));
	// What the step under way does, in a line over the wall; and when
	// answers stall, why, so a wall that stops at once says what stopped it.
	// A refused request counts on its own, neither served nor waiting
	function drawEvent(el, v, t, counts) {
		const steps = v.run.steps, k = E.stepAt(v.run, t), s = steps[k];
		let text, kind = '';
		if (t >= v.end) {
			const served = v.users.filter(u => u.served).length;
			text = !served ? '<b>Every request refused</b>: ' + refusal(v)
				: '<b>'
					+ (v.run.refused ? served + ' served, ' + v.run.refused + ' refused' : 'All ' + served + ' served')
					+ '</b> in ' + secs(v.end) + ', in ' + fmt(steps.length) + ' steps';
		} else if (k < 0) {
			text = counts.waiting ? 'Waiting for the batch to fill'
				: counts.refused ? counts.refused + ' refused so far: ' + refusal(v) : 'No request has come yet';
		} else if (t >= s.t1) {
			text = v.whole && counts.waiting ? 'A batch filling: it waits a second at most for more to come'
				: 'Nothing to run till the next request comes';
		} else {
			const n = { decode: 0, prefill: 0, recompute: 0, pad: 0, stall: 0 }, chunks = [];
			for (const [id, tokens, , kd] of s.seqs) {
				n[kd] += kd === 'stall' ? 1 : tokens;
				if (kd === 'prefill' && !v.whole) chunks.push('#' + (id + 1));
			}
			const step = 'Step ' + fmt(k + 1),
				took = secs(s.t1 - s.t0) + ', '
					+ (s.cost.bound === 'memory' ? 'held by HBM' : 'held by the tensor cores');
			const what = [];
			if (n.decode) what.push(n.decode + ' answer' + (n.decode > 1 ? 's' : '') + ' a token each');
			if (n.prefill) {
				what.push(fmt(n.prefill) + ' prompt tokens'
					+ (chunks.length ? ' (' + chunks.slice(0, 3).join(', ') + (chunks.length > 3 ? '…' : '') + ')'
						: ''));
			}
			if (n.recompute) what.push(fmt(n.recompute) + ' computed again');
			const news = [...s.joined.map(id => '#' + (id + 1) + ' joined'),
				...s.out.map(id => '#' + (id + 1) + ' preempted'), ...s.left.map(id => '#' + (id + 1) + ' done')];
			if (v.whole) {
				kind = 'batch';
				const b = v.run.batches[s.batch];
				text = '<b>Batch ' + (s.batch + 1) + '</b>, ' + b.rows
					+ ' rows, prompts padded to ' + fmt(b.len) + ' tokens: '
					+ (s.into
						? 'token ' + fmt(s.into) + ' of ' + fmt(b.longest)
							+ ', its longest answer’s; nothing is sent till then' : 'its prompts going through');
			} else if (n.stall) {
				kind = 'stall';
				text = '<b>' + n.stall + ' answer' + (n.stall > 1 ? 's' : '')
					+ ' stalled</b> ' + (v.at.sched === 'prefill'
					? 'while ' + fmt(n.prefill) + ' prompt tokens go through whole, '
						+ secs(s.t1 - s.t0) + ': prefill first'
					: 'this step: its ' + fmt(v.run.budget) + ' tokens went to those ahead')
				+ ' · ' + step + ' · ' + took;
			} else text = '<b>' + step + '</b> · ' + took + (what.length ? ' · ' + what.join(', ') : '')
				+ (news.length ? ' · ' + news.slice(0, 4).join(', ') : '');
		}
		setAttr(el, 'class', 'sv-event' + (kind ? ' ' + kind : ''));
		setHTML(el, text);
	}

	// ---- a block's slots ----
	// What block b shows, as a number that changes when its picture does:
	// the null block; free, cached or stranded; the system prompt's, by how
	// many share it; a request's, by its id and where in its sixteen slots
	// its kinds change, BLOCK + 1 places a mark. Every request holding
	// blocks has a band, the engine keeping one for each until it leaves
	const LOOK = { null: -2, free: 0, cached: 1, stranded: 2, shared: 3, marked: 1e4 };
	const within = (m, base) => Math.max(0, Math.min(BLOCK, m - base));
	function look(b) {
		const { owner, kind, ref, slot } = now.cells, o = owner[b];
		if (b === run.nullBlock) return LOOK.null;
		if (o < 0) return kind[b] !== KEY.none ? LOOK.cached : now.stranded ? LOOK.stranded : LOOK.free;
		if (kind[b] === KEY.system) return LOOK.shared + ref[b];
		const base = slot[b] * BLOCK;
		let n = o;
		for (const m of now.marks.get(o)) n = n * (BLOCK + 1) + within(m, base);
		return LOOK.marked + n;
	}
	// Block b drawn in the box x, y, w × h: its slots left to right as its
	// sequence fills them, in its request's colour
	function drawBlock(cx, b, x, y, w, h) {
		const { owner, kind, ref, slot } = now.cells, o = owner[b];
		// white first: the tints and hatches are translucent, and a cell is
		// drawn again over what it showed before
		cx.fillStyle = FREE;
		cx.fillRect(x, y, w, h);
		if (b === run.nullBlock) return drawNull(cx, x, y, w, h);
		if (o < 0) {
			cx.fillStyle = kind[b] !== KEY.none ? CACHED : now.stranded ? hatch(STRANDED, true) : FREE;
			cx.fillRect(x, y, w, h);
			return;
		}
		if (kind[b] === KEY.system) {
			cx.fillStyle = C.gold;
			cx.fillRect(x, y, w, h);
			if (w >= 13) {
				cx.fillStyle = '#ffffff';
				cx.font = (w >= 17 ? 9 : 8) + 'px Menlo, Monaco, monospace';
				cx.textAlign = 'center';
				cx.fillText(ref[b], x + w / 2, y + h / 2 + 3);
			}
			return;
		}
		const colour = sides[0].users[o].colour, marks = now.marks.get(o), base = slot[b] * BLOCK;
		const along = m => within(m, base) / BLOCK * w;
		const fills = [PADDING, colour, tint(colour), PADDING];
		let from = 0;
		marks.forEach((m, i) => {
			const to = along(m);
			if (to > from) {
				cx.fillStyle = fills[i];
				cx.fillRect(x + from, y, to - from, h);
			}
			from = Math.max(from, to);
		});
		if (from < w) {
			cx.fillStyle = hatch(colour);
			cx.fillRect(x + from, y, w - from, h);
		}
	}
	// vLLM's null block, block 0 of a paged cache, which no request is given:
	// grey, struck through
	function drawNull(cx, x, y, w, h) {
		cx.fillStyle = NULL;
		cx.fillRect(x, y, w, h);
		cx.strokeStyle = '#ffffff';
		cx.lineWidth = 1;
		cx.beginPath();
		cx.moveTo(x + 1, y + h - 1);
		cx.lineTo(x + w - 1, y + 1);
		cx.stroke();
	}
	// a block's slots in words
	function slotsOf(b) {
		const base = now.cells.slot[b] * BLOCK,
			[a, t, r, p] = now.marks.get(now.cells.owner[b]).map(m => within(m, base));
		const parts = [[a, 'padding'], [t - a, 'tokens'], [r - t, 'reserved for tokens to come'],
			[p - r, 'padding'], [BLOCK - p, 'internal fragmentation, no token will reach them']];
		return parts.filter(([n]) => n > 0).map(([n, word]) => n + ' ' + word).join(', ');
	}
	function blockWords(b) {
		const { owner, kind, ref, slot } = now.cells, o = owner[b], id = 'Block ' + fmt(b) + ': ';
		if (b === run.nullBlock) return id + 'vLLM keeps block 0 as its null block; no request is given it';
		if (o < 0 && kind[b] === KEY.system) {
			return id + 'free, but still holding the system prompt’s logical block ' + slot[b]
				+ ', kept for the next request that starts the same way; when blocks run short, the oldest freed is evicted first';
		}
		if (o < 0 && kind[b] === KEY.own) {
			return id
				+ 'free, but still holding a full block of an earlier request’s tokens, keyed by them, kept till it is evicted';
		}
		if (o < 0) {
			return id + 'free'
				+ (now.stranded
					? '; with the others free, enough for the head of the queue, but in gaps too short for the run it needs: external fragmentation'
					: '');
		}
		if (kind[b] === KEY.system) {
			return id + 'the system prompt’s logical block ' + slot[b] + ', one copy shared by '
				+ fmt(ref[b]) + ' request' + (ref[b] > 1 ? 's' : '') + ' (its reference count)';
		}
		return id + 'request ' + (o + 1) + '’s logical block ' + slot[b]
			+ (kind[b] === KEY.own ? ', full and keyed for reuse' : '') + '; its 16 slots: ' + slotsOf(b);
	}

	// ---- the map and the GPU over it ----
	// The blocks in the order vLLM numbers them, row by row, each cell as
	// large as the pane allows them all, as Defrag sized its clusters. Over
	// them one GPU of the two, its memory as a bar: the weights, the cache,
	// what gpu_memory_utilization holds back; the cache's part opened out
	// into the map below it. The room at the cells' sides, over them for the
	// bar and the caption over the zoom, and under them
	const EDGE = 8, TOP = 44, FOOT = 4;
	// cells from as large as this to no smaller than this, should the window
	// be made very small. A pane wider than WIDE has room for longer words
	const MOST_CELL = 24, LEAST_CELL = 2, WIDE = 640;
	// The map as tall as its cells: the largest that leave the chats' rows
	// their least (as serve.css sets them: --rows of --row and their gaps),
	// of the height the rows and the map share, the body's less the gap
	// between the panes, the chats' lines over their rows and the key under
	// the map. The rows take the rest. A window too small for the least of
	// both keeps the rows and lets the map go, from its foot
	function measure() {
		const W = mapCv.clientWidth, dpr = window.devicePixelRatio || 1;
		if (!W) return false;
		const users = $('.sv-users'), wall = $('.sv-side[data-side="0"] .sv-wall'),
			cache = $('.sv-cache'), css = getComputedStyle(root);
		const [rows, row, between] = ['--rows', '--row', '--row-gap'].map(v => parseFloat(css.getPropertyValue(v))),
			least = rows * row + (rows - 1) * between;
		const shared = body.clientHeight - parseFloat(getComputedStyle(body).rowGap)
			- (users.offsetHeight - wall.offsetHeight) - keyEl.offsetHeight - (cache.offsetHeight - cache.clientHeight);
		const w = W - 2 * EDGE, tall = p => Math.ceil(run.N / Math.floor(w / p)) * p;
		let p = MOST_CELL;
		while (p > LEAST_CELL && tall(p) + TOP + FOOT > shared - least) p--;
		const H = Math.max(0, Math.min(tall(p) + TOP + FOOT, shared - least)), cols = Math.floor(w / p);
		mapCv.style.height = H + 'px';
		mapCv.width = Math.round(W * dpr);
		mapCv.height = Math.round(H * dpr);
		const gap = p >= 12 ? 2 : 1;
		geo = { W, H, dpr, p, gap, c: p - gap, cols, rows: Math.ceil(run.N / cols),
			x0: EDGE + Math.floor((w - cols * p) / 2), y0: TOP };
		drawn = null;
		return true;
	}
	const cellAt = b => [geo.x0 + (b % geo.cols) * geo.p, geo.y0 + Math.floor(b / geo.cols) * geo.p];
	function paintMap() {
		if (!geo && !measure()) return;
		const cx = mapCv.getContext('2d');
		cx.setTransform(geo.dpr, 0, 0, geo.dpr, 0, 0);
		if (!drawn) {
			drawn = new Float64Array(run.N).fill(-1);
			geo.barKey = '';
			cx.fillStyle = '#ffffff';
			cx.fillRect(0, 0, geo.W, geo.H);
			cx.fillStyle = GAP;
			cx.fillRect(geo.x0 - geo.gap, geo.y0 - geo.gap, geo.cols * geo.p + geo.gap,
				Math.floor(run.N / geo.cols) * geo.p + geo.gap);
			const tail = run.N % geo.cols;
			if (tail) {
				cx.fillRect(geo.x0 - geo.gap, geo.y0 + Math.floor(run.N / geo.cols) * geo.p,
					tail * geo.p + geo.gap, geo.p);
			}
		}
		// only the blocks whose picture changed
		for (let b = 0; b < run.N; b++) {
			const pic = look(b);
			if (pic === drawn[b]) continue;
			drawn[b] = pic;
			const [x, y] = cellAt(b);
			drawBlock(cx, b, x, y, geo.c, geo.c);
		}
		paintGpu(cx);
	}
	// The GPU's bar, its words, and the cache's part opened out into the
	// map, drawn again only when the blocks it counts have changed
	function paintGpu(cx) {
		const n = census(), key = [n.shared, n.used, n.cached, n.free, now.stranded].join();
		if (key === geo.barKey) return;
		geo.barKey = key;
		const { W } = geo, x0 = EDGE, x1 = W - EDGE, y = 13, h = 11;
		cx.fillStyle = '#ffffff';
		cx.fillRect(0, 0, W, geo.y0 - 1);
		// what gpu_memory_utilization allows the cache, and what it has
		const mem = E.GPU.mem, weights = E.WEIGHTS, allowed = mem * E.UTIL - weights;
		const kv = run.N * run.bytes / E.GPUS, X = v => x0 + v / mem * (x1 - x0);
		const xw = X(weights), xk = X(weights + kv), xb = X(weights + allowed);
		geo.bar = { y1: y + h, xw, xk, xb, x1, weights, allowed };
		cx.fillStyle = PARAMS;
		cx.fillRect(x0, y, xw - x0, h);
		cx.fillStyle = HELD;
		cx.fillRect(xb, y, x1 - xb, h);
		if (xk < xb) {
			cx.fillStyle = hatch('#a09aa6');
			cx.fillRect(xk, y, xb - xk, h);
		}
		// the cache's part as its blocks are now: the system prompt's, in use,
		// still cached, free
		let x = xw;
		for (const [count, fill] of [[n.shared, C.gold], [n.used, KEYED],
			[n.cached, CACHED], [n.free, now.stranded ? hatch(STRANDED, true) : FREE]]) {
			const w = count / run.N * (xk - xw);
			cx.fillStyle = fill;
			cx.fillRect(x, y, w, h);
			x += w;
		}
		cx.strokeStyle = C.ink;
		cx.lineWidth = 1;
		cx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1);
		paintBarWords(cx, { x0, x1, y, h, mem, weights, allowed, kv });
		paintZoom(cx, xw, xk, y + h);
	}
	// the bar's words, the shorter in a narrow pane
	function paintBarWords(cx, { x0, x1, y, h, mem, weights, allowed, kv }) {
		const wide = geo.W > WIDE, line = 10;
		cx.font = FONT;
		cx.textAlign = 'left';
		cx.fillStyle = C.ink;
		cx.fillText('One H100 of the two, ' + gib(mem) + (wide ? ' as CUDA reports it' : ''), x0, line);
		cx.fillStyle = '#ffffff';
		cx.fillText((wide ? 'the weights, half the model’s: ' : 'weights, half: ') + gib(weights), x0 + 5, y + h - 2);
		cx.textAlign = 'right';
		cx.fillStyle = C.ink;
		cx.fillText('KV cache ' + gib(kv) + (at.cache < 1 ? ' of ' + gib(allowed) : '') + '  ·  '
				+ gib(mem * (1 - E.UTIL)) + ' held back' + (wide ? ', gpu_memory_utilization ' + E.UTIL : ''),
			x1, line);
	}
	// The cache's part of the bar, from xw to xk at its foot, opened out to
	// the map's width, and the map's caption over the zoom's edges, on the
	// pane's white, so that they pass behind it even where they run nearly
	// level
	function paintZoom(cx, xw, xk, foot) {
		const gx0 = geo.x0 - geo.gap, gx1 = geo.x0 + geo.cols * geo.p, gy = geo.y0 - geo.gap - 1;
		cx.fillStyle = 'rgba(0, 0, 128, 0.05)';
		cx.beginPath();
		cx.moveTo(xw, foot);
		cx.lineTo(xk, foot);
		cx.lineTo(gx1, gy);
		cx.lineTo(gx0, gy);
		cx.closePath();
		cx.fill();
		cx.strokeStyle = '#808080';
		cx.beginPath();
		cx.moveTo(xw + 0.5, foot);
		cx.lineTo(gx0 + 0.5, gy);
		cx.moveTo(xk - 0.5, foot);
		cx.lineTo(gx1 - 0.5, gy);
		cx.stroke();
		const caption = fmt(run.N) + ' blocks of ' + BLOCK + ' tokens'
			+ (geo.W > WIDE ? ', numbered as vLLM numbers them, ' : ', ')
			+ mib(run.bytes / E.GPUS) + ' a block on each GPU';
		const mid = (gx0 + gx1) / 2, half = cx.measureText(caption).width / 2 + 4;
		cx.fillStyle = '#ffffff';
		cx.fillRect(mid - half, gy - 16, 2 * half, 13);
		cx.textAlign = 'center';
		cx.fillStyle = C.mute;
		cx.fillText(caption, mid, gy - 6);
	}
	// The GPU's bar in words: each part, and what the cache's blocks are
	function barWords(x, y) {
		const g = geo.bar;
		if (!g || y > geo.y0 - geo.gap || x < EDGE || x > g.x1) return '';
		if (y <= g.y1 && x < g.xw) {
			return 'The weights in bf16, ' + gib(g.weights)
				+ ' on each GPU: tensor parallelism over two splits every layer’s matrices between them';
		}
		if (y <= g.y1 && x > g.xb) {
			return 'Held back: the ' + Math.round((1 - E.UTIL) * 100)
				+ '% of the GPU vLLM leaves alone at gpu_memory_utilization ' + E.UTIL;
		}
		if (y <= g.y1 && x > g.xk) {
			return 'Room num_gpu_blocks_override leaves unused, of the ' + gib(g.allowed) + ' the cache could have';
		}
		return 'The KV cache, what gpu_memory_utilization ' + E.UTIL
			+ ' leaves beside the weights, cut into ' + fmt(run.N) + ' blocks of ' + BLOCK + ' tokens'
			+ (run.nullBlock >= 0 ? ', block 0 vLLM’s null block, so ' + fmt(run.usable) + ' for requests' : '')
			+ '. A block id names the same slot on both GPUs, each holding its half of the 8 KV heads, '
			+ mib(run.bytes / E.GPUS) + ' a block' + (at.kv === 1 ? ' in fp8' : ' in bf16')
			+ '; the ids index a tensor, not addresses in DRAM. vLLM’s profiling also sets aside the forward pass’s peak activations, memory outside PyTorch such as the CUDA context and NCCL’s buffers, and in newer versions an estimate for CUDA graphs, '
			+ 'so a real server holds fewer blocks, the count it logs as it starts; this engine leaves them out';
	}
	function blockAt(e) {
		if (!geo) return -1;
		const m = mapCv.getBoundingClientRect(), x = e.clientX - m.left - geo.x0, y = e.clientY - m.top - geo.y0;
		const col = Math.floor(x / geo.p), row = Math.floor(y / geo.p);
		if (x < 0 || y < 0 || col >= geo.cols || x - col * geo.p > geo.c || y - row * geo.p > geo.c) return -1;
		const b = row * geo.cols + col;
		return b < run.N ? b : -1;
	}

	// ---- a request's block table ----
	// A request's sequence, a cell a logical block in its order, each the
	// block that holds it: scattered under paging, one run when contiguous,
	// its first blocks the system prompt's shared copy. tableOf: the
	// request's logical blocks at the step, its own by owner and slot, or the
	// system prompt's shared one at that slot
	function tableOf(id) {
		const band = now.bands.get(id), { owner, kind, slot } = now.cells;
		if (!band) return [];
		const out = new Array(band.held).fill(-1);
		for (let b = 0; b < run.N; b++) if (owner[b] === id && slot[b] < out.length) out[slot[b]] = b;
		for (let b = 0; b < run.N; b++) {
			if (kind[b] === KEY.system && owner[b] >= 0 && slot[b] < out.length && out[slot[b]] < 0) out[slot[b]] = b;
		}
		return out;
	}
	// the logical block its next token goes to, or -1 when it needs a new one
	function nextSlot(id) {
		const marks = now.marks.get(id);
		return marks && marks[2] > marks[1] ? Math.floor(marks[1] / BLOCK) : -1;
	}
	// Why server v refused a request: paged, as vLLM, a prompt of
	// max_model_len or more; contiguous, as before it, a prompt and
	// max_tokens more than every block, set aside whole
	const refusal = v => v.run.alloc === 'contiguous'
		? 'its prompt and max_tokens, set aside whole, are more than all ' + fmt(v.run.N) + ' blocks'
		: 'its prompt is max_model_len, ' + fmt(v.run.maxLen) + ' tokens, or more, which vLLM rejects';
	// What a request holds at the clock, in a line or two of HTML, for its
	// card in Memory: the blocks and where its next token goes, or none,
	// the card's line of its state saying why
	function facts(id) {
		const band = now.bands.get(id);
		if (!band) return 'holds no blocks';
		const marks = now.marks.get(id), i = nextSlot(id), table = tableOf(id);
		const text = 'holds <b>' + fmt(band.held) + '</b> blocks'
			+ (band.shared ? ' (' + fmt(band.shared) + ' the system prompt’s, shared)' : '');
		if (marks[1] === marks[0] && marks[2] === marks[0]) return text + '; done, its row held till the batch ends';
		return text + '<br>'
			+ (i >= 0 && table[i] >= 0
				? 'its next token goes to block <b>' + fmt(table[i]) + '</b>, slot ' + (marks[1] % BLOCK + 1)
				: 'its next token needs a new block');
	}
	// Over the map, on a canvas of its own so that the map's cells need not
	// be drawn again: the blocks lit, those of the request under the pointer
	// or else the picked one, and what changed a moment ago. Cleared only
	// when it shows something
	let wired = false;
	function paintWires() {
		const lit = hovered >= 0 ? hovered : pickedId();
		if (!wired && !flashes.size && lit < 0) return;
		const { cx } = fitCanvas(wiresCv);
		wired = false;
		if (!geo || view !== 'memory') return;
		const box = body.getBoundingClientRect(), m = mapCv.getBoundingClientRect();
		const mx = m.left - box.left, my = m.top - box.top;
		cx.save();
		cx.beginPath();
		cx.rect(mx, my, m.width, m.height);
		cx.clip();
		const t = performance.now();
		for (const [b, [colour, until]] of flashes) {
			if (until < t) {
				flashes.delete(b);
				continue;
			}
			const [x, y] = cellAt(b);
			cx.globalAlpha = Math.min(1, (until - t) / FLASH);
			if (colour === C.red) {
				cx.fillStyle = colour;
				cx.fillRect(mx + x, my + y, geo.c, geo.c);
			} else {
				cx.strokeStyle = colour;
				cx.lineWidth = 1.5;
				cx.strokeRect(mx + x - 0.75, my + y - 0.75, geo.c + 1.5, geo.c + 1.5);
			}
		}
		cx.globalAlpha = 1;
		wired = flashes.size > 0 || lit >= 0;
		if (lit >= 0) {
			const { owner, kind } = now.cells;
			cx.strokeStyle = C.ink;
			cx.lineWidth = 1;
			for (let b = 0; b < run.N; b++) {
				if (owner[b] !== lit || kind[b] === KEY.system) continue;
				const [x, y] = cellAt(b);
				cx.strokeRect(mx + x - 0.5, my + y - 0.5, geo.c + 1, geo.c + 1);
			}
		}
		cx.restore();
	}

	// ---- why the head of the queue waits ----
	// Memory's chats stand for the scheduler's queue; over them, why its head
	// still waits, as the engine found it when the step's admission stopped,
	// in vLLM 0.11's order of reasons: a step that preempts admits no one;
	// the step's tokens all given out; max_num_seqs running; a static batch
	// admits no one till it ends; or the cache, the blocks the head needs
	// for its first chunk against those it may use (from 0.19 vLLM admits a
	// request only when its whole prompt fits). One come while the step ran
	// waits for the next, the scheduler not having seen it yet. Prefill
	// first runs the decodes only when no prompt joins, so a step of its
	// that preempts says why none did
	const WHY = {
		arrived: who => who + ' came while this step ran; the scheduler sees it at the next.',
		// a batch over and the next not yet begun, it fills, while more come
		batch: (who, h, s) => clock.t >= s.t1
			&& (now.k + 1 < run.steps.length ? run.steps[now.k + 1].t0 : Infinity) > s.t1
			? 'The next batch fills, a second at most, while more come.'
			: who + ' waits for the batch to end: a static batch takes no one in till its longest answer is out.',
		preempted: (who, h, s) => at.sched !== 'prefill'
			? 'No one joined: this step preempted ' + numbered(s.out)
				+ ', and the scheduler admits no one in a step that preempts.'
			: (h.refused
				? WHY[h.refused.reason]('Request ' + (h.refused.id + 1), h.refused, s)
					+ ' So no prompt joined: the decodes ran' : 'The decodes ran')
				+ ', and preempted ' + numbered(s.out) + ' for the blocks their tokens need.',
		budget: (who, h) => h.tokens
			? who + '’s prompt, ' + fmt(h.tokens) + ' tokens, goes through whole, and the step had '
				+ fmt(h.left) + ' of its ' + fmt(run.budget) + ' left.'
			: 'The step’s ' + fmt(run.budget) + ' tokens all went to requests ahead of ' + who.toLowerCase() + '.',
		seqs: who => 'max_num_seqs, ' + fmt(at.seqs) + ', are running; ' + who + ' waits for one to finish.',
		cache: (who, h) => run.alloc === 'contiguous'
			? who + ' needs a run of <b>' + fmt(h.run) + '</b> blocks, its prompt and max_tokens; <b>' + fmt(h.free)
				+ '</b> are free'
				+ (h.free >= h.run ? ', but the longest run is ' + fmt(h.longest) + ': external fragmentation.' : '.')
			: who + ' needs <b>' + fmt(h.need) + '</b> new blocks for '
				+ (h.chunk < h.tokens
					? 'its first chunk, ' + fmt(h.chunk) + ' of the ' + fmt(h.tokens)
						+ ' tokens it must compute, what the step’s budget has left'
					: 'the ' + fmt(h.chunk) + ' tokens it must compute')
				+ (h.hits ? ', past its ' + fmt(h.hits) + ' cached blocks' : '')
				+ '; <b>' + fmt(h.room) + '</b> are free.',
	};
	function why() {
		if (!run.steps.length) return 'Every request is refused: ' + refusal(sides[0]) + '.';
		// before the first step the line over the chats says so already
		if (!run.steps[now.k]) return '';
		const h = headAt(clock.t);
		if (!h) return 'No one waits: every request that has come is running or done.';
		return WHY[h.reason]('Request ' + (h.id + 1), h, run.steps[now.k]);
	}

	// ---- the river ----
	// The cache over the run, in blocks, a column a pixel: at its foot the
	// system prompt's shared blocks, then the token states, the slots
	// reserved, padding and internal fragmentation, as Kwon et al. (2023)
	// divide a request's; over them the free blocks still cached, or, when
	// they are stranded, external fragmentation; the rest free. Each step's
	// slots as the engine counts them (its slots). Drawn once a run
	// off-screen; the playhead and the pointer's guide over it
	const R = { top: 16, foot: 19, left: 6, right: 6 };
	const SLOTS = [
		{ key: 'system', label: 'system prompt', fill: C.gold,
			tip: 'The system prompt’s blocks, one copy shared by every request that starts with it' },
		{ key: 'tokens', label: 'tokens', fill: KEYED,
			tip: 'Token states: slots holding the keys and values of a prompt and its answer so far' },
		{ key: 'reserved', label: 'reserved', fill: tint(KEYED),
			tip: 'Reserved: slots set aside for tokens still to come, all used before the request ends' },
		{ key: 'padding', label: 'padding', fill: PADDING,
			tip: 'A static batch’s padding: prompts padded on the left to the longest, answers on the right to the longest' },
		{ key: 'internal', label: 'internal frag.', fill: hatch(KEYED),
			tip: 'Internal fragmentation: slots set aside that no token will reach; under paging, at most the rest of a last block' },
		{ key: 'cached', label: 'free, still cached', fill: CACHED,
			tip: 'Free blocks still holding a prefix, kept, the oldest freed evicted first, for the next request that starts the same way' },
		{ key: 'external', label: 'external frag.', fill: hatch(STRANDED, true),
			tip: 'External fragmentation: free blocks enough for the head of the queue, but in gaps each too short for the run it needs' },
	];
	function riverBox() {
		const W = riverCv.clientWidth, H = riverCv.clientHeight, T0 = endOf() || 1;
		const X = t => R.left + t / T0 * (W - R.left - R.right),
			T = x => Math.max(0, Math.min(T0, (x - R.left) / (W - R.left - R.right) * T0));
		const Y = n => H - R.foot - n / (run.N * BLOCK) * (H - R.top - R.foot);
		return { W, H, X, T, Y };
	}
	function drawRiver() {
		const W = riverCv.clientWidth, H = riverCv.clientHeight, dpr = window.devicePixelRatio || 1;
		if (!W || !H) return;
		river = document.createElement('canvas');
		river.width = Math.round(W * dpr);
		river.height = Math.round(H * dpr);
		const cx = river.getContext('2d');
		cx.scale(dpr, dpr);
		cx.fillStyle = '#ffffff';
		cx.fillRect(0, 0, W, H);
		const { X, T, Y } = riverBox();
		for (let x = R.left; x < W - R.right; x++) {
			// between steps the cache stands as the last left it
			const s = E.cacheAt(run, T(x + 0.5));
			if (!s) continue;
			let n = 0;
			for (const { key, fill } of SLOTS) {
				const v = s.slots[key];
				if (!v) continue;
				cx.fillStyle = fill;
				cx.fillRect(x, Y(n + v), 1, Y(n) - Y(n + v));
				n += v;
			}
		}
		// the frame: the cache's size at the top, the run's seconds at the foot
		cx.strokeStyle = '#c9c5c9';
		cx.strokeRect(R.left - 0.5, Y(run.N * BLOCK) - 0.5, W - R.left - R.right + 1, Y(0) - Y(run.N * BLOCK) + 1);
		cx.font = FONT;
		cx.fillStyle = C.ink;
		cx.textAlign = 'left';
		cx.fillText('The cache over the run: ' + fmt(run.N)
				+ ' blocks, stacked by what their slots hold; preemptions ticked in red', R.left, 11);
		cx.fillStyle = C.red;
		for (const t of run.preempts) cx.fillRect(Math.round(X(t)) - 0.5, Y(run.N * BLOCK) - 4, 1, 4);
		cx.fillStyle = C.mute;
		cx.font = MONO;
		E.ticks(0, endOf()).forEach((t, i) => {
			cx.textAlign = i === 0 ? 'left' : X(t) > W - 30 ? 'right' : 'center';
			cx.fillText(stamp(t), X(t), H - 5);
			cx.fillRect(Math.round(X(t)), Y(0), 1, 3);
		});
	}
	function paintRiver() {
		const W = riverCv.clientWidth, H = riverCv.clientHeight;
		if (!W) return;
		if (!river) drawRiver();
		const { cx } = fitCanvas(riverCv);
		cx.drawImage(river, 0, 0, W, H);
		const { X, Y } = riverBox(), y0 = Y(run.N * BLOCK) - 4, y1 = Y(0);
		if (guide >= 0) {
			cx.fillStyle = 'rgba(0, 0, 0, 0.35)';
			cx.fillRect(Math.round(guide), y0, 1, y1 - y0);
		}
		const x = Math.round(X(clock.t));
		cx.fillStyle = C.navy;
		cx.fillRect(x - 1, y0, 2, y1 - y0);
		cx.beginPath();
		cx.moveTo(x - 5, y0 - 1);
		cx.lineTo(x + 5, y0 - 1);
		cx.lineTo(x, y0 + 5);
		cx.fill();
	}
	// The river's moment under the pointer, in words: the blocks in use by
	// what their slots hold, and the free ones still cached or stranded
	function riverWords(t) {
		const k = E.stepAt(run, t), s = E.cacheAt(run, t);
		if (!s) {
			return stamp(t)
				+ (run.steps.length ? ': before the first step' : ': every request refused, so no step runs');
		}
		const { system, tokens, reserved, padding, internal, cached, external } = s.slots,
			blocks = v => fmt(Math.round(v / BLOCK));
		return stamp(t) + (s === run.steps[k] ? ', step ' : ', after step ') + fmt(k + 1) + ': ' + fmt(s.used)
			+ ' blocks in use ('
			+ [[system, 'the system prompt’s'], [tokens, 'of tokens'], [reserved, 'reserved'],
				[padding, 'padding'], [internal, 'internal fragmentation']]
			.filter(([v]) => v >= BLOCK / 2).map(([v, w]) => blocks(v) + ' ' + w).join(', ') + ')'
			+ (cached ? ', ' + blocks(cached) + ' free still cached' : '')
			+ (external ? ', ' + blocks(external) + ' free but stranded' : '');
	}

	// ---- the key ----
	// The kinds of slot the run has, their swatches drawn as the map draws
	// them, and what the blocks hold at the step
	function paintKey() {
		const has = SLOTS.filter(slot => run.steps.some(s => s.slots[slot.key] > 0));
		// tokens in the requests' two tones
		const items = has.map(slot => slot.key === 'tokens'
			? [slot.label, TONES, slot.tip + ', in the request’s colour, two in turn by its number']
			: [slot.label, slot.fill, slot.tip]);
		items.push(['free', FREE, 'Free blocks, holding nothing']);
		if (run.nullBlock >= 0) {
			items.push(['null block', drawNull, 'vLLM keeps block 0 as its null block; no request is given it']);
		}
		keyEl.innerHTML = '';
		const dpr = window.devicePixelRatio || 1, edge = 11;
		for (const [word, paint, says] of items) {
			const span = document.createElement('span'), sw = document.createElement('canvas');
			span.title = says;
			sw.width = sw.height = Math.round(edge * dpr);
			const cx = sw.getContext('2d');
			cx.scale(dpr, dpr);
			if (typeof paint === 'function') paint(cx, 0, 0, edge, edge);
			else if (Array.isArray(paint)) paint.forEach((c, i) => {
				cx.fillStyle = c;
				cx.fillRect(i * edge / paint.length, 0, edge / paint.length + 0.5, edge);
			});
			else {
				cx.fillStyle = paint;
				cx.fillRect(0, 0, edge, edge);
			}
			span.append(sw, word);
			keyEl.append(span);
		}
		const live = document.createElement('span');
		live.title = 'The blocks at this step: given to requests (the system prompt’s shared ones among them), free but still cached, and free';
		live.dataset.live = '';
		keyEl.append(live);
	}
	function paintCounts() {
		const n = census();
		setHTML($('[data-live]'),
			'in use <b>' + fmt(n.used + n.shared) + '</b> · cached <b>'
				+ fmt(n.cached) + '</b> · free <b>' + fmt(n.free) + '</b>');
	}

	// ---- the strip ----
	// The server's four boxes, two by two. With two servers compared each
	// splits down the middle, the left server's half on the left as its
	// wall is, on the same axes, each half headed by its server's name as
	// its wall's header gives it. What each box shows goes into its label
	// too, for a reader that cannot see it
	const WINDOW = 2; // seconds of steps shown
	const TOP_TOKENS = 65536; // tokens at a box's top: a static batch's padded prompts run past the budget
	const SHARE = { decode: C.navy, prefill: C.purple, recompute: C.red, pad: STATES.pad };
	const GUTTER = 12; // between the halves
	// the spans a box's plot from a to b gives its servers
	function halves(a, b) {
		if (sides.length < 2) return [[a, b]];
		const mid = (a + b) / 2;
		return [[a, mid - GUTTER / 2], [mid + GUTTER / 2, b]];
	}
	const nameOfSide = i => (i ? 'with ' + changeOf(versus).label : sides[0].name);
	// what a half says in a box's label, after its server's name when there are two
	const forSide = (i, text) => (sides.length > 1 ? nameOfSide(i) + ': ' : '') + text;
	// a half's heading, cut to its width
	function heading(cx, i, a, b) {
		cx.font = 'bold ' + SMALL;
		cx.fillStyle = C.ink;
		cx.textAlign = 'left';
		cx.fillText(cut(cx, nameOfSide(i), b - a), a, 10);
		cx.font = SMALL;
	}
	// a box's label, set only when what it says has changed
	const describe = (cv, text) => setAttr(cv, 'aria-label', text);
	// The steps of the last WINDOW seconds: a column a step, as wide as it
	// took and as tall as its tokens on a log scale, split by what they were;
	// the budget dashed, the step under way outlined; then the key
	function drawSteps(t) {
		const two = sides.length > 1, { cx, W, H } = fitCanvas(stepsCv),
			x0 = 30, x1 = W - 6, top = 16, foot = H - 13, labels = [];
		const t1 = Math.max(t, WINDOW), t0 = t1 - WINDOW;
		const Y = n => foot - Math.log10(1 + n) / Math.log10(TOP_TOKENS) * (foot - top);
		cx.font = SMALL;
		cx.textAlign = 'right';
		for (const n of [1, 100, 10000]) {
			const y = Math.round(Y(n));
			cx.fillStyle = C.grid;
			cx.fillRect(x0, y, x1 - x0, 1);
			cx.fillStyle = C.faint;
			cx.fillText(n >= 1000 ? n / 1000 + 'k' : n, x0 - 3, y + 3);
		}
		halves(x0, x1).forEach(([a, b], i) => {
			const v = sides[i], X = s => a + (s - t0) / WINDOW * (b - a);
			if (two) heading(cx, i, a, b);
			let count = 0, tokens = 0;
			for (let k = Math.max(0, E.stepAt(v.run, t0)); k < v.run.steps.length && v.run.steps[k].t0 < t; k++) {
				const s = v.run.steps[k], l = Math.max(a, X(s.t0)), r = Math.min(X(Math.min(s.t1, t)), b);
				if (r <= l) continue;
				const n = stepTokens(v, s), total = n.decode + n.prefill + n.recompute + n.pad, h = foot - Y(total);
				count++;
				tokens += total;
				let y = foot;
				for (const kd of ['decode', 'recompute', 'prefill', 'pad']) {
					if (!n[kd]) continue;
					const part = h * n[kd] / total;
					cx.fillStyle = SHARE[kd];
					cx.fillRect(l, y - part, Math.max(0.6, r - l - 0.6), part);
					y -= part;
				}
				if (t >= s.t0 && t < s.t1) {
					cx.strokeStyle = C.ink;
					cx.strokeRect(l - 0.5, foot - h - 1.5, r - l, h + 2);
				}
			}
			if (!v.whole) {
				const yb = Math.round(Y(v.run.budget)) + 0.5;
				cx.strokeStyle = C.ink;
				cx.setLineDash([3, 3]);
				cx.beginPath();
				cx.moveTo(a, yb);
				cx.lineTo(b, yb);
				cx.stroke();
				cx.setLineDash([]);
				cx.fillStyle = C.ink;
				cx.textAlign = 'right';
				cx.fillText('budget ' + fmt(v.run.budget), b, yb - 3);
			}
			labels.push(forSide(i, fmt(count) + ' steps, ' + fmt(tokens) + ' tokens'));
		});
		drawStepsKey(cx, two, x0, x1, H, t0, t1, t);
		describe(stepsCv, 'The steps of the last ' + WINDOW + ' seconds. ' + labels.join('; '));
	}
	// a step's tokens by what they were; a static batch's prompts padded to
	// the longest, the padding apart
	function stepTokens(v, s) {
		const n = { decode: 0, prefill: 0, recompute: 0, pad: 0 };
		for (const [id, tokens, , kd] of s.seqs) {
			if (kd === 'stall') continue;
			if (v.whole && kd === 'prefill') {
				const real = v.run.S.reqs[id].prompt;
				n.prefill += real;
				n.pad += tokens - real;
			} else n[kd] += tokens;
		}
		return n;
	}
	// the colours' key, over the plot when the box is whole, the window's
	// ends under it; under the halves, whose heads take the top
	function drawStepsKey(cx, two, x0, x1, H, t0, t1, t) {
		const key = [['answers', SHARE.decode], ['prompts', SHARE.prefill],
			['again', SHARE.recompute], ['padding', SHARE.pad]];
		const keyW = key.reduce((w, [word]) => w + cx.measureText(word).width, 0) + 3 * 8;
		let x = Math.max(x0, two ? (x0 + x1 - keyW) / 2 : x1 - keyW);
		cx.textAlign = 'left';
		for (const [word, colour] of key) {
			cx.fillStyle = colour;
			cx.fillText(word, x, two ? H - 2 : 10);
			x += cx.measureText(word).width + 8;
		}
		if (!two) {
			cx.fillStyle = C.mute;
			cx.fillText(secs(t0), x0, H - 2);
			cx.textAlign = 'right';
			cx.fillText(t < WINDOW ? secs(t1) : 'now', x1, H - 2);
		}
	}
	// The blocks in use at the clock, as a share of those a request can be
	// given, vLLM's kv_cache_usage: those held, then those free but still
	// holding a prefix, then the free; and the server's figures so far
	function drawUsage(t, states) {
		const two = sides.length > 1, { cx, W } = fitCanvas(usageCv), labels = [];
		cx.font = SMALL;
		halves(6, W - 6).forEach(([a, b], i) => {
			const v = sides[i], s = E.cacheAt(v.run, t), N = v.run.usable;
			const held = s ? s.used : 0, cached = s ? s.cached : 0;
			const running = states[i].filter(c => c.phase === 'answering').length,
				waiting = states[i].filter(c => c.phase === 'waiting').length;
			const recent = upto(v.made, t) - upto(v.made, t - 1),
				out = upto(v.run.preempts, t), share = Math.round(held / N * 100);
			const y = two ? 17 : 4;
			if (two) heading(cx, i, a, b);
			cx.fillStyle = C.ink;
			cx.textAlign = 'left';
			cx.fillText(cut(cx, share + '% of ' + fmt(N) + ' blocks', b - a), a, y + 9);
			const by = y + 13, bh = 9, X = n => a + n / N * (b - a);
			cx.fillStyle = '#ffffff';
			cx.fillRect(a, by, b - a, bh);
			cx.fillStyle = C.navy;
			cx.fillRect(a, by, X(held) - a, bh);
			cx.fillStyle = CACHED;
			cx.fillRect(X(held), by, X(held + cached) - X(held), bh);
			cx.strokeStyle = C.faint;
			cx.strokeRect(a + 0.5, by + 0.5, b - a - 1, bh - 1);
			const refused = v.run.refused ? ', ' + v.run.refused + ' refused' : '';
			const lines = two
				? [running + ' running, ' + waiting + ' waiting',
					fmt(recent) + ' tokens a second', out + ' preempted' + refused]
				: [running + ' running, ' + waiting + ' waiting',
					fmt(recent) + ' tokens made in the last second', out + ' preempted so far' + refused,
					cached ? fmt(cached) + ' free blocks still hold a prefix' : ''];
			cx.fillStyle = C.mute;
			lines.filter(Boolean).forEach((l, j) => cx.fillText(cut(cx, l, b - a), a, by + bh + 12 + j * 13));
			labels.push(forSide(i,
				share + '% of ' + N + ' blocks in use, ' + running + ' running, '
					+ waiting + ' waiting, ' + out + ' preempted'));
		});
		describe(usageCv, 'KV cache usage. ' + labels.join('; '));
	}
	// Each user's time to first token against when it came, a dot once its
	// first token is with it; the median and the 99th percentile so far
	// ruled across, as vllm bench serve takes them
	function drawTtft(t) {
		const two = sides.length > 1, { cx, W, H } = fitCanvas(ttftCv),
			x0 = 40, x1 = W - 8, y0 = two ? 18 : 6, y1 = H - 14, labels = [];
		const span = lastArrival() * 1.03 || 1;
		const worst = Math.max(1, ...sides.flatMap(v => v.firsts.map(f => f[1])));
		const lo = -2, hi = Math.ceil(Math.log10(worst * 1.2));
		const Y = s => y1 - (Math.log10(Math.max(s, 0.01)) - lo) / (hi - lo) * (y1 - y0);
		cx.font = SMALL;
		for (let e = lo; e <= hi; e++) {
			const y = Math.round(Y(10 ** e));
			cx.fillStyle = C.grid;
			cx.fillRect(x0, y, x1 - x0, 1);
			cx.fillStyle = C.faint;
			cx.textAlign = 'right';
			cx.fillText(e < 0 ? 10 ** (e + 3) + ' ms' : 10 ** e + ' s', x0 - 3, y + 3);
		}
		cx.textAlign = 'left';
		cx.fillText('arrived at', x0, H - 2);
		halves(x0, x1).forEach(([a, b], i) => {
			const v = sides[i], X = s => a + s / span * (b - a);
			if (two) heading(cx, i, a, b);
			cx.fillStyle = C.faint;
			cx.textAlign = 'right';
			cx.fillText(secs(span), b, H - 2);
			const come = v.firsts.slice(0, upto(v.firsts, t, f => f[0]));
			for (const [, ttft, id] of come) {
				cx.beginPath();
				cx.arc(X(v.run.S.reqs[id].arrival), Y(ttft), 3, 0, 2 * Math.PI);
				cx.fillStyle = v.users[id].colour;
				cx.fill();
			}
			if (!come.length) return labels.push(forSide(i, 'none yet'));
			// the median, dashed, its figure under its line; the 99th
			// percentile dotted, its figure over
			const ttfts = come.map(f => f[1]), p50 = E.quantile(ttfts, 0.5), p99 = E.quantile(ttfts, 0.99);
			[[p50, [5, 3], 11, 'p50 '], [p99, [2, 3], -3, 'p99 ']].forEach(([s, dash, dy, word]) => {
				const y = Math.round(Y(s)) + 0.5;
				cx.strokeStyle = C.ink;
				cx.setLineDash(dash);
				cx.beginPath();
				cx.moveTo(a, y);
				cx.lineTo(b, y);
				cx.stroke();
				cx.setLineDash([]);
				cx.fillStyle = C.ink;
				cx.textAlign = 'right';
				cx.fillText(word + secs(s), b, y + dy);
			});
			labels.push(forSide(i, 'p50 ' + secs(p50) + ', p99 ' + secs(p99)));
		});
		describe(ttftCv, 'Time to first token so far. ' + labels.join('; '));
	}
	// The gaps between tokens as they reach their users, every answer's, in
	// bins of a quarter of a decade, as shares of the server's gaps, the
	// median and the 99th percentile marked; two servers on one scale. The
	// gaps come by the clock are kept in order, those come since the last
	// frame sorted and merged in from the back, and counted again from none
	// when the clock goes back
	const BINS = { lo: -3, hi: 1, per: 4 };
	const binOf = g => Math.max(0,
		Math.min((BINS.hi - BINS.lo) * BINS.per - 1, Math.floor((Math.log10(g) - BINS.lo) * BINS.per)));
	function gapsBy(v, t) {
		const k = upto(v.gapAt, t);
		if (!v.come || k < v.come.n) {
			v.come = { n: 0, sorted: new Float64Array(v.gapLen.length),
				bins: new Array((BINS.hi - BINS.lo) * BINS.per).fill(0) };
		}
		const c = v.come, add = v.gapLen.slice(c.n, k).sort();
		for (let i = c.n - 1, j = add.length - 1, w = k - 1; j >= 0; w--) {
			c.sorted[w] = i >= 0 && c.sorted[i] > add[j] ? c.sorted[i--] : add[j--];
		}
		for (const g of add) c.bins[binOf(g)]++;
		c.n = k;
		return { come: c.sorted.subarray(0, k), bins: c.bins };
	}
	function drawItl(t) {
		const two = sides.length > 1, { cx, W, H } = fitCanvas(itlCv), y0 = two ? 34 : 22, y1 = H - 14, labels = [];
		const n = (BINS.hi - BINS.lo) * BINS.per, spans = halves(8, W - 8);
		// each server's bins, then the tallest share of either, for one scale
		const sets = sides.map(v => v.whole ? null : gapsBy(v, t));
		const most = Math.max(1e-9,
			...sets.filter(x => x && x.come.length).map(x => Math.max(...x.bins) / x.come.length));
		cx.font = SMALL;
		spans.forEach(([a, b], i) => {
			const set = sets[i], X = s => a + (Math.log10(s) - BINS.lo) / (BINS.hi - BINS.lo) * (b - a);
			if (two) heading(cx, i, a, b);
			// a decade a line, every other one named when halved
			for (let e = BINS.lo; e <= BINS.hi; e++) {
				const x = Math.round(X(10 ** e));
				cx.fillStyle = C.grid;
				cx.fillRect(x, y0, 1, y1 - y0);
				if (two && (e - BINS.lo) % 2) continue;
				cx.fillStyle = C.faint;
				cx.textAlign = e === BINS.lo ? 'left' : e === BINS.hi ? 'right' : 'center';
				cx.fillText(e < 0 ? 10 ** (e + 3) + ' ms' : 10 ** e + ' s', x, H - 2);
			}
			const textY = two ? 22 : 10;
			cx.fillStyle = C.mute;
			cx.textAlign = 'left';
			if (!set) {
				cx.fillText(two ? 'sent whole: a static' : 'a static batch sends each answer whole', a, textY);
				if (two) cx.fillText('batch has no gaps', a, textY + 12);
				return labels.push(forSide(i, 'a static batch sends each answer whole'));
			}
			if (!set.come.length) return labels.push(forSide(i, 'none yet'));
			const w = (b - a) / n;
			cx.fillStyle = C.navy;
			set.bins.forEach((count, j) => {
				const h = count / set.come.length / most * (y1 - y0 - 4);
				cx.fillRect(a + j * w + 1, y1 - h, w - 2, h);
			});
			const p50 = E.quantile(set.come, 0.5, true), p99 = E.quantile(set.come, 0.99, true);
			cx.fillStyle = C.ink;
			cx.fillText(cut(cx, 'p50 ' + secs(p50) + ' · p99 ' + secs(p99), b - a), a, textY);
			for (const s of [p50, p99]) {
				const x = X(s);
				cx.beginPath();
				cx.moveTo(x - 3, y0 - 6);
				cx.lineTo(x + 3, y0 - 6);
				cx.lineTo(x, y0 - 1);
				cx.fill();
			}
			labels.push(forSide(i, 'p50 ' + secs(p50) + ', p99 ' + secs(p99)));
		});
		describe(itlCv, 'Between tokens so far. ' + labels.join('; '));
	}

	// ---- the chat's cards ----
	// A chat in full, as a card. In Users, in the tooltip and pinned, the
	// thread as a messenger shows it: the system prompt and the turns before
	// folded away, the user's message, the answer coming in; laid out once
	// for its chat (build) and its slots, data-k, filled as the clock moves
	// (fill). In Memory, in the tooltip, the request's tokens as its cache
	// holds them: its logical blocks in rows, each coloured by the part of
	// the request it holds, then the parts in order with their counts. Both
	// read the same facts, the engine's, and call the answer the answer, so
	// that a list of numbers in it reads as what the model wrote, not as
	// token ids
	// What a chat is at t: its state, and its answer so far, from its start
	// in the pinned window (whole), else its latest tokens
	function factsOf(v, u, t, whole) {
		const r = u.r, c = stateAt(v, u, t), talk = v.chats[r.id], from = Math.max(0, c.shown - TAIL.tip);
		const latest = (from ? '… ' : '') + answerText(talk, from, c.shown);
		return { v, u, r, c, t, talk, whole, held: v.whole && c.st !== 'done' && c.made > 0,
			cached: E.effective(v.at).prefix,
			latest, answer: whole ? answerText(talk, 0, c.shown) : latest };
	}
	// its state in plain words; a static batch's answer, made but held, said
	// for what it is
	function stateWords({ v, u, r, c, t }) {
		const share = () => Math.round(c.share * 100) + '%';
		switch (c.st) {
			case 'future': return 'not yet sent';
			case 'refused': return 'refused: ' + refusal(v);
			case 'wait': return 'waiting in the queue, ' + tenths(t - c.since) + ' so far';
			case 'preempted': return 'preempted: its blocks freed, it waits to compute its tokens again';
			case 'prefill': return 'reading its prompt, ' + share()
				+ (v.whole ? ', padded to its batch’s longest' : '');
			case 'recompute': return 'computing its prompt and its answer so far again, ' + share();
			case 'stall': return 'stalled: this step’s tokens went to requests ahead of it';
			case 'pad': return 'done, but held: its batch sends every answer when its longest ends';
			case 'done': return 'done';
		}
		if (v.whole) {
			return 'made but held: a static batch sends every answer whole when its longest ends, so its user has none of it yet';
		}
		const rate = pace(r, c.made);
		return rate ? 'answering, ' + Math.round(rate) + ' tokens a second' : 'answering';
	}
	// how much of the answer there is, made or come
	function countWords({ r, c, held }) {
		if (c.st === 'future' || c.st === 'refused') return 'an answer of ' + fmt(r.output) + ' tokens';
		return held ? fmt(c.made) + ' of its ' + fmt(r.output) + ' tokens made, none sent yet'
			: fmt(c.sent) + ' of its ' + fmt(r.output) + ' tokens';
	}
	// when it came, its first token (a static batch's whole answer), the
	// pace of the rest once it is done, and how often it has given way so far
	function timesWords({ v, u, r, t }) {
		const out = ['arrived at ' + secs(r.arrival)], outs = upto(u.outs, t);
		if (u.served && t >= u.first) {
			out.push((v.whole ? 'all of it after ' : 'first token after ') + secs(u.first - r.arrival));
		}
		if (u.served && t >= u.end && !v.whole && r.output > 1) {
			out.push('a token every ' + secs((r.times[r.output - 1] - r.first) / (r.output - 1)));
		}
		if (outs) out.push('preempted ' + outs + (outs > 1 ? ' times' : ' time'));
		return out.join(' · ');
	}
	// a chat's answer, labelled as the answer
	const answerLabel = f => f.held ? 'the answer, made but held'
		: f.c.shown || f.c.st === 'done' ? 'the answer' : 'the answer, none yet';
	// the conversation so far, as its turns
	const turnsWords = talk => (talk.turns.length / 2) + ' earlier turn' + (talk.turns.length > 2 ? 's' : '');
	const chatCard = {
		build: f => {
			const { r, talk } = f;
			return (r.system
				? '<p class="sv-fold sv-gold"><b>system prompt</b> · ' + fmt(r.system)
					+ ' tokens, <i>the same for every chat, '
					+ (f.cached ? 'cached once and shared' : 'computed again for each') + '</i></p>' : '')
				+ (talk.turns.length
					? '<p class="sv-fold"><b>' + turnsWords(talk) + '</b> · ' + fmt(talk.rest)
						+ ' tokens, <i>sent again with every message, as a chat client sends the whole conversation</i></p>'
					: '')
				+ '<div class="sv-say sv-user"><p lang="' + talk.lang + '">' + esc(talk.ask) + '</p>'
				+ (talk.paste
					? '<p class="sv-paste">+ pasted: ' + esc(talk.paste) + ', ' + fmt(talk.rest) + ' tokens</p>' : '')
				+ '<small>its message, ' + fmt(talk.asks) + ' tokens</small></div>'
				+ '<div class="sv-say sv-bot"><small class="sv-who" data-k="who"></small><p lang="'
				+ talk.lang + '" data-k="answer"></p><small data-k="count"></small></div>'
				+ '<p class="sv-times" data-k="times"></p>';
		},
		fill: f => ({ who: answerLabel(f), answer: f.answer,
			count: countWords(f) + ' · ' + stateWords(f), times: timesWords(f) }),
	};
	// a card's slots filled with their text, the pinned answer kept scrolled
	// to its latest
	function fillCard(el, values, whole) {
		for (const [k, x] of Object.entries(values)) {
			const slot = el.querySelector('[data-k="' + k + '"]');
			if (!slot || slot.textContent === x) continue;
			slot.textContent = x;
			if (k === 'answer' && whole) slot.scrollTop = slot.scrollHeight;
		}
	}
	// a chat's card, built and filled at once, as a tooltip's
	function chatHTML(f) {
		const el = document.createElement('div');
		el.className = 'sv-card' + (f.held ? ' held' : '');
		el.style.setProperty('--c', f.u.colour);
		el.innerHTML = chatCard.build(f);
		fillCard(el, chatCard.fill(f), false);
		return el.outerHTML;
	}
	// The parts of a request's token sequence, in order, as its cache holds
	// them: a static batch's left padding to its longest prompt, the system
	// prompt, the turns before or the paste, the message, the answer made and
	// to come; then a static batch's padding to its longest answer, and the
	// slots a contiguous cache sets aside for the most tokens, unused. Each
	// with its colour in the grid (fill) and as a swatch (css)
	function partsOf(f) {
		const { v, u, r, c, talk } = f, made = f.held ? c.made : c.sent, out = [];
		const part = (key, label, tokens, fill, text = '', lang = '') => tokens > 0
			&& out.push({ key, label, tokens, fill, css: fill, text, lang });
		const batch = v.whole && r.batch >= 0 ? v.run.batches[r.batch] : null;
		if (batch) part('pad', 'padding, to its batch’s longest prompt', batch.len - r.prompt, PADDING);
		part('system', 'system prompt' + (f.cached ? ', cached and shared' : ''),
			r.system, C.gold, 'the same for every chat');
		if (talk.paste) part('rest', 'pasted', talk.rest, tint(C.purple, 0.3), talk.paste);
		else part('rest', turnsWords(talk), talk.rest, tint(C.purple, 0.3), 'the conversation so far');
		part('message', 'its message', talk.asks, tint(C.purple, 0.6), talk.ask, talk.lang);
		part('made', f.held ? 'the answer, made but held' : 'the answer', made,
			f.held ? tint(u.colour, 0.55) : u.colour, f.latest, talk.lang);
		part('tocome', 'the answer, still to come', r.output - made, tint(u.colour, 0.2));
		if (batch) part('tail', 'padding, to its batch’s longest answer', batch.longest - r.output, PADDING);
		if (v.run.alloc === 'contiguous') {
			const row = batch ? batch.len + batch.longest : r.prompt + r.output;
			const aside = Math.ceil(((batch ? batch.len : r.prompt) + v.at.reserve) / BLOCK) * BLOCK - row;
			if (aside > 0) {
				out.push({ key: 'aside', label: 'set aside for max_tokens, never used', tokens: aside,
					fill: hatch(STRANDED),
					css: 'repeating-linear-gradient(135deg, #808080 0 1px, #ffffff 1px 4px)', text: '' });
			}
		}
		return out;
	}
	// The grid of a request's logical blocks, w wide: as many to a row (16,
	// 32 or 64) as gives the largest cells, no taller than the tooltip allows
	const GRID = { x0: 34, h: 150 };
	function gridOf(n, w) {
		const fit = per => Math.min(15, Math.floor((w - GRID.x0) / per), Math.floor(GRID.h / Math.ceil(n / per)));
		const per = [16, 32, 64].reduce((best, k) => fit(k) > fit(best) ? k : best), p = Math.max(2, fit(per));
		return { per, p, rows: Math.ceil(n / per) };
	}
	// Memory's card: what the request holds, the grid, its parts in order
	// with their counts, then its state and times on a line
	function blocksCard(f) {
		const parts = partsOf(f), n = Math.ceil(parts.reduce((a, q) => a + q.tokens, 0) / BLOCK),
			held = (now.bands.get(f.r.id) || { held: 0 }).held;
		return '<p>' + facts(f.r.id) + '</p>'
			+ '<canvas class="sv-grid" role="img" aria-label="' + n + ' logical blocks, ' + held + ' held"></canvas>'
			+ '<div class="sv-parts">'
			+ parts.map(q => '<p><i style="background: ' + q.css + '"></i><b>' + q.label
				+ '</b><span>' + fmt(q.tokens) + '</span><span class="sv-text"'
				+ (q.lang ? ' lang="' + q.lang + '"' : '') + '>' + esc(q.text) + '</span></p>').join('') + '</div>'
			+ '<p class="sv-times">' + stateWords(f) + ' · ' + timesWords(f) + '</p>';
	}
	// The grid drawn on cv, as tall as its rows at the card's width: a cell
	// a logical block, its sixteen slots coloured left to right by the parts
	// they hold, split where a part ends inside it; the blocks the request
	// holds solid, those it will need still to come pale; each row's first
	// token beside it, or every few rows' when they are close; the block its
	// next token goes to marked
	function drawGrid(cv, f) {
		const parts = partsOf(f), n = Math.ceil(parts.reduce((a, q) => a + q.tokens, 0) / BLOCK),
			{ per, p, rows } = gridOf(n, cv.clientWidth);
		cv.style.height = rows * p + 'px';
		const { cx } = fitCanvas(cv), held = (now.bands.get(f.r.id) || { held: 0 }).held, lit = nextSlot(f.r.id);
		const gap = p >= 9 ? 2 : 1, c = p - gap, every = Math.ceil(11 / p), ends = [];
		parts.reduce((a, q) => (ends.push([a, a + q.tokens, q.fill]), a + q.tokens), 0);
		for (let i = 0; i < n; i++) {
			const x = GRID.x0 + (i % per) * p, y = Math.floor(i / per) * p, a = i * BLOCK;
			if (i % (per * every) === 0) {
				cx.font = MONO;
				cx.textAlign = 'right';
				cx.fillStyle = C.mute;
				cx.fillText(fmt(a), GRID.x0 - 4, y + Math.min(c, 10));
			}
			cx.globalAlpha = i < held ? 1 : 0.35;
			for (const [from, to, fill] of ends) {
				const l = Math.max(from, a), r = Math.min(to, a + BLOCK);
				if (r <= l) continue;
				cx.fillStyle = fill;
				cx.fillRect(x + (l - a) / BLOCK * c, y, (r - l) / BLOCK * c, c);
			}
			cx.globalAlpha = 1;
			if (i === lit) {
				cx.strokeStyle = C.navy;
				cx.lineWidth = 2;
				cx.strokeRect(x - 1, y - 1, c + 2, c + 2);
			}
		}
	}

	// ---- the pinned chat ----
	// In Users, a picked chat is pinned: its card, with the whole of its
	// answer so far, and what it did through the run as a strip of its
	// states. Its card is laid out again only for another chat
	function drawPin(t) {
		const hide = !picked || picked.side >= sides.length;
		if (pin.hidden !== hide) pin.hidden = hide;
		if (hide) return;
		const v = sides[picked.side], u = v.users[picked.id], r = u.r, f = factsOf(v, u, t, true);
		setText(pinTitle,
			'#' + (r.id + 1)
				+ (sides.length > 1 ? ' · ' + (picked.side ? 'with ' + changeOf(versus).label : 'this server') : ''));
		const key = picked.side + ' ' + picked.id;
		if (pinCard.dataset.key !== key) {
			pinCard.dataset.key = key;
			pinCard.innerHTML = chatCard.build(f);
			pinCard.style.setProperty('--c', u.colour);
		}
		pinCard.classList.toggle('held', f.held);
		fillCard(pinCard, chatCard.fill(f), true);
		// its states from arrival to its last token, the clock marked
		const { cx, W, H } = fitCanvas(pinTime), x0 = 4, x1 = W - 4, a = r.arrival, b = Math.max(u.end, a + 1e-3);
		const X = s => x0 + (Math.min(b, Math.max(a, s)) - a) / (b - a) * (x1 - x0);
		cx.font = SMALL;
		cx.fillStyle = C.mute;
		cx.textAlign = 'left';
		cx.fillText('its run, ' + secs(a) + ' to ' + secs(b), x0, 10);
		for (const s of r.segs) {
			cx.fillStyle = s.kind === 'decode' ? (v.whole ? tint(u.colour, 0.45) : u.colour)
				: STATES[s.kind] || C.faint;
			cx.fillRect(X(s.t0), 16, Math.max(1, X(s.t1) - X(s.t0)), 14);
		}
		if (t >= a && t <= b) {
			cx.fillStyle = C.ink;
			cx.fillRect(X(t) - 0.5, 13, 2, 20);
		}
		// the key, a swatch a state, its answer in its own colour
		let x = x0;
		for (const [word, colour] of [['waiting', STATES.wait], ['its prompt', STATES.prefill],
			[v.whole ? 'its answer, held' : 'its answer', u.colour], ['stalled', STATES.stall],
			['preempted', STATES.preempted], ['again', STATES.recompute],
			...(v.whole ? [['padding', STATES.pad]] : [])]) {
			cx.fillStyle = colour;
			cx.fillRect(x, H - 11, 9, 9);
			cx.fillStyle = C.mute;
			cx.fillText(word, x + 12, H - 3);
			x += 18 + cx.measureText(word).width;
		}
	}

	// ---- the tooltips ----
	// One tooltip, as Windows 98 showed one, under the pointer: a chat's
	// card in Users; a block of the map; the GPU's bar; the river's moment.
	// then draws into it once it is laid out. Memory's card of a chat's
	// blocks, aside, the larger, goes to the side of the window away from
	// the pointer, from the top of the panes, and no wider than half the
	// window, so that the map by the pointer, and the half its chat is lit
	// on, stay in view
	const ASIDE = 402;
	function showTip(e, html, then, aside = false) {
		tip.hidden = !html;
		if (!html) return;
		const box = root.getBoundingClientRect();
		tip.style.width = aside ? Math.min(ASIDE, box.width / 2 - 4) + 'px' : '';
		tip.innerHTML = html;
		if (then) then(tip);
		const w = tip.offsetWidth, h = tip.offsetHeight, x = e.clientX - box.left, y = e.clientY - box.top;
		if (aside) {
			tip.style.left = (x < box.width / 2 ? box.width - w - 4 : 4) + 'px';
			tip.style.top = Math.max(4, Math.min(body.getBoundingClientRect().top - box.top, box.height - h - 4))
				+ 'px';
			return;
		}
		tip.style.left = Math.min(x + 14, box.width - w - 4) + 'px';
		tip.style.top = (y + 16 + h > box.height - 4 ? Math.max(4, y - h - 10) : y + 16) + 'px';
	}
	// A chat's tooltip: in Users its thread, its answer's latest; in Memory
	// its blocks, the grid drawn in once the tooltip is laid out
	function chatTip(e, v, u) {
		const r = u.r, f = factsOf(v, u, clock.t, false);
		const head = '<p><b>#' + (r.id + 1) + '</b>'
			+ (r.capped ? ', its answer cut where it and its prompt reach max_model_len, ' + fmt(v.run.maxLen) : '')
			+ '</p>';
		if (view === 'memory') {
			return showTip(e, head + '<div class="sv-card sv-blocks">' + blocksCard(f) + '</div>',
				el => drawGrid(el.querySelector('.sv-grid'), f), true);
		}
		showTip(e,
			head + chatHTML(f)
				+ '<p><i>The messages and answers are written for serve.exe; how long each is and when each token comes are the engine’s.</i></p>');
	}
	// the first server's request under the pointer, lit on the map and on
	// its chat; only beside the map, the walls lighting nothing else
	function hover(id) {
		if (view !== 'memory' || id === hovered) return;
		hovered = id;
		paintWires();
		drawWalls(clock.t, statesAt(clock.t));
	}
	function unhover() {
		tip.hidden = true;
		hover(-1);
	}

	// ---- the views ----
	// Which panes the view shows and how the chats are laid; compare only in
	// Users, a second server's chats having no cache drawn, so a clock past
	// the first's end comes back to it. Leaving Memory lets its lit blocks
	// go, as nothing there would fade them
	function setView(name) {
		view = name;
		for (const each of ['users', 'memory']) root.classList.toggle('view-' + each, each === name);
		root.classList.toggle('compact', compact());
		$$('[data-view]').forEach(b => {
			b.classList.toggle('on', b.dataset.view === name);
			b.setAttribute('aria-pressed', b.dataset.view === name);
		});
		const vs = sel('versus');
		vs.disabled = name !== 'users';
		vs.parentElement.title = name === 'users'
			? 'A second server for the same users, the same as this one but for one thing, on the right'
			: 'Two servers are compared in Users, where both walls fit; Memory draws the first server’s cache';
		hovered = -1;
		tip.hidden = true;
		clock.t = Math.min(clock.t, endOf());
		relayout();
		redrawTiles();
		draw();
		if (name !== 'memory') {
			flashes.clear();
			paintWires();
		}
	}
	// each user's state at t, the walls', the pin's and the strip's alike
	const statesAt = t => shown().map(v => v.users.map(u => stateAt(v, u, t)));
	function draw() {
		const t = clock.t, states = statesAt(t);
		settle(t, clock.playing);
		setText(atField,
			stamp(t) + ' of ' + stamp(endOf()) + ' · step '
				+ fmt(Math.max(0, Math.min(E.stepAt(run, t) + 1, run.steps.length))));
		paintAt(t);
		setText(runBtn, clock.playing ? '❚❚ Pause' : '▶ Run');
		drawWalls(t, states);
		if (view === 'users') {
			drawPin(t);
			drawSteps(t);
			drawUsage(t, states);
			drawTtft(t);
			drawItl(t);
		} else {
			paintMap();
			// over the chats in one line, the whole of it in its tooltip
			setHTML(whyEl, why());
			setAttr(whyEl, 'title', whyEl.textContent);
			paintWires();
			paintRiver();
			paintCounts();
		}
		const said = (clock.playing ? 'Playing at ×' + speed : t >= endOf() ? 'The run’s end' : 'Paused')
			+ ' · ' + summary;
		if (said !== statusText) status((statusText = said));
	}

	// ---- the clock ----
	// The run plays on its own clock, speed times real time; every view
	// draws the moment it shows. One chain of frames at a time, run while
	// the clock plays or lit blocks fade. Stepping goes from a step of the
	// servers shown to the next, or the one before, each shown from its
	// start, as the map shows a step's blocks
	function tick(t) {
		if (!root.isConnected) return;
		if (clock.playing) {
			clock.t = Math.min(endOf(), clock.t + Math.min(0.1, (t - clock.last) / 1000) * speed);
			clock.last = t;
			if (clock.t >= endOf()) clock.playing = false;
			draw();
		} else if (flashes.size) paintWires();
		clock.looping = clock.playing || flashes.size > 0;
		if (clock.looping) requestAnimationFrame(tick);
	}
	function loop() {
		if (clock.looping) return;
		clock.looping = true;
		requestAnimationFrame(tick);
	}
	function play(on) {
		if (on && clock.t >= endOf()) clock.t = 0;
		clock.playing = on;
		clock.last = performance.now();
		if (on) loop();
		draw();
	}
	function seek(t) {
		clock.playing = false;
		clock.t = Math.max(0, Math.min(endOf(), t));
		draw();
	}
	// the steps' starts of the servers shown, in order, each once
	const starts = () => [...new Set(shown().flatMap(v => v.run.steps.map(s => s.t0)))].sort((a, b) => a - b);
	function stepBy(dir, times = 1) {
		const ts = starts(), k = upto(ts, clock.t) - 1 + dir * times;
		seek(k < 0 ? 0 : k >= ts.length ? endOf() : ts[k]);
	}
	// the time field, a seek bar: pressed or dragged, the clock goes to that
	// share of the run
	const shareAt = e => {
		const box = atField.getBoundingClientRect();
		return Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
	};
	atField.addEventListener('pointerdown', e => {
		atField.setPointerCapture(e.pointerId);
		const move = ev => seek(shareAt(ev) * endOf());
		move(e);
		atField.addEventListener('pointermove', move);
		atField.addEventListener('pointerup', () => atField.removeEventListener('pointermove', move), { once: true });
	});
	// The wheel, or two fingers on a trackpad, moves the clock a thousandth
	// of the run a pixel, down or right on: over the time field either way,
	// over the river only sideways, so that the page still scrolls past it
	const SCROLL = 1 / 1000, LINE = 16;
	function wheel(e, sideways) {
		const across = Math.abs(e.deltaX) > Math.abs(e.deltaY);
		if (sideways && !across) return;
		e.preventDefault();
		seek(clock.t + (across ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? LINE : 1) * SCROLL * endOf());
	}
	atField.addEventListener('wheel', e => wheel(e, false), { passive: false });
	riverCv.addEventListener('wheel', e => wheel(e, true), { passive: false });
	// the field filled to where the clock is, a pixel at a time, and the
	// preemptions of the servers shown ticked in red at its foot
	let filled = -1;
	function paintAt(t) {
		const px = Math.round((endOf() ? t / endOf() : 0) * atField.clientWidth);
		if (px === filled) return;
		filled = px;
		atField.style.setProperty('--at', px + 'px');
	}
	function tickPreempts() {
		const end = endOf(), ts = shown().flatMap(v => v.run.preempts);
		atField.style.setProperty('--ticks', ts.map(t => 'linear-gradient(' + C.red + ', ' + C.red + ') '
			+ (t / end * 100).toFixed(2) + '% 100% / 1px 4px no-repeat, ').join(''));
		filled = -1;
	}

	// ---- controls ----
	// The selects filled from the tables that name their values, one for
	// each setting but prefix caching, a button; the speed's too
	const OPTIONS = {
		sched: [Object.keys(SCHED), x => SCHED[x]],
		alloc: [Object.keys(ALLOC), x => ALLOC[x]], kv: [[...KV.keys()], x => KV.get(x)],
		...Object.fromEntries(['rate', 'system', 'reserve', 'seqs',
			'cache', 'seed'].map(k => [k, [E.VALUES[k], E.SHOW[k]]])),
	};
	const options = (name, [values, show], value) => {
		sel(name).innerHTML = values.map(x => '<option value="' + x + '"'
				+ (x === value ? ' selected' : '') + '>' + show(x) + '</option>').join('');
	};
	for (const [k, table] of Object.entries(OPTIONS)) options(k, table, at[k]);
	options('speed', [E.VALUES.speed, E.SHOW.speed], speed);
	$('[data-out="window"]').textContent = WINDOW;
	// The controls as the settings apply: a static batch's cache contiguous,
	// prefix caching a paged cache's; and the changes a second server can
	// differ by from these, a group only with one that applies, the one
	// picked dropped if it no longer applies
	function syncControls() {
		const a = E.effective(at), prefix = sel('prefix');
		sel('sched').value = a.sched;
		sel('alloc').value = a.alloc;
		sel('alloc').disabled = a.sched === 'static';
		sel('kv').value = String(a.kv);
		prefix.classList.toggle('on', a.prefix);
		prefix.setAttribute('aria-pressed', a.prefix);
		prefix.disabled = a.alloc !== 'paged';
		if (versus && !changeOf(versus).applies(at)) versus = '';
		const groups = [...new Set(CHANGES.map(c => c.group))].map(g => [g,
				CHANGES.filter(c => c.group === g && c.applies(at))]).filter(([, list]) => list.length);
		sel('versus').innerHTML = '<option value="">nothing</option>'
			+ groups.map(([g, list]) => '<optgroup label="' + g + '">'
			+ list.map(c => '<option value="' + c.key + '"' + (c.key === versus ? ' selected' : '')
					+ '>' + c.label + '</option>').join('') + '</optgroup>').join('');
	}
	// The servers again, after a setting changed: both served, the first
	// traced, the status bar's first tokens as its users had them; then
	// everything drawn from the start, the clock kept
	function serveAll() {
		syncControls();
		sides = [serve({ ...at }, true)];
		if (versus) sides.push(serve(changeOf(versus).apply({ ...at }), false));
		run = sides[0].run;
		if (picked && picked.side >= sides.length) picked = null;
		const ttfts = sides[0].firsts.map(f => f[1]);
		summary = fmt(run.N) + ' blocks · '
			+ (ttfts.length
				? 'first token ' + secs(E.quantile(ttfts, 0.5)) + ' at the median, '
					+ secs(E.quantile(ttfts, 0.99)) + ' at the 99th percentile' : 'none served');
	}
	function drawAll() {
		now.k = -2;
		now.cells = null;
		pinCard.dataset.key = '';
		relayout();
		build();
		root.classList.toggle('compact', compact());
		clock.t = Math.min(clock.t, endOf());
		tickPreempts();
		paintKey();
		draw();
	}
	function rebuild() {
		serveAll();
		drawAll();
	}
	for (const k of SETTINGS) {
		if (k === 'prefix') continue;
		sel(k).addEventListener('change', () => {
			at[k] = typeof at[k] === 'number' ? +sel(k).value : sel(k).value;
			rebuild();
		});
	}
	sel('prefix').addEventListener('click', () => {
		at.prefix = !at.prefix;
		rebuild();
	});
	sel('versus').addEventListener('change', () => {
		versus = sel('versus').value;
		rebuild();
	});
	sel('speed').addEventListener('change', () => {
		speed = +sel('speed').value;
		draw();
	});
	// A chat picked, or let go: the same chat in every view. Picked from
	// the keyboard in Users, its pinned window takes the focus, on its close
	// button; let go from there, the focus goes back to the chat
	function pickChat(side, id, keyed = false) {
		picked = picked && picked.side === side && picked.id === id ? null : { side, id };
		tip.hidden = true;
		redrawTiles();
		draw();
		if (picked && keyed && view === 'users') pin.querySelector('[data-act="unpick"]')
			.focus({ preventScroll: true });
		else if (!picked && pin.contains(document.activeElement)) tiles[side][id].el.focus({ preventScroll: true });
	}
	function unpick() {
		if (picked) pickChat(picked.side, picked.id);
	}
	// What the buttons and keys do, one table for both: a button's data-act,
	// a key's name in KEYS; n, ten with Shift
	const ACTS = {
		run: () => play(!clock.playing),
		start: () => seek(0),
		end: () => seek(endOf()),
		back: n => stepBy(-1, n),
		next: n => stepBy(1, n),
		unpick,
	};
	const KEYS = { ' ': 'run', ArrowLeft: 'back', ArrowRight: 'next', Home: 'start', End: 'end', Escape: 'unpick' };
	const tileOf = el => {
		const tile = el.closest('.sv-tile');
		return tile && !tile.classList.contains('future') ? [+tile.closest('.sv-side').dataset.side, +tile.dataset.id]
			: null;
	};
	root.addEventListener('click', e => {
		const viewBtn = e.target.closest('[data-view]'), act = e.target.closest('[data-act]'), tile = tileOf(e.target);
		if (viewBtn) setView(viewBtn.dataset.view);
		else if (tile) pickChat(...tile);
		else if (act) ACTS[act.dataset.act](1);
	});
	// The keys wherever the focus is in the window, but on a control, whose
	// keys are its own, and Escape anywhere while a chat is picked; a chat
	// reached by Tab picked with Enter or Space
	root.addEventListener('keydown', e => {
		const tile = (e.key === 'Enter' || e.key === ' ') && tileOf(e.target);
		if (tile) pickChat(...tile, true);
		else if ((!e.target.closest('button, select') || (e.key === 'Escape' && picked))
				&& KEYS[e.key]) ACTS[KEYS[e.key]](e.shiftKey ? 10 : 1);
		else return;
		e.preventDefault();
	});
	// a chat under the pointer: its tooltip, and beside the cache its blocks
	// lit; off a chat, gone, but over the map and the river, which have
	// tooltips of their own
	root.addEventListener('pointermove', e => {
		const tile = e.target.closest('.sv-tile');
		if (!tile) {
			if (!e.target.closest('.sv-map, .sv-river')) unhover();
			return;
		}
		const side = +tile.closest('.sv-side').dataset.side, v = sides[side], u = v.users[+tile.dataset.id];
		hover(side ? -1 : u.r.id);
		if (tile.classList.contains('future')) return showTip(e, '');
		chatTip(e, v, u);
	});
	root.addEventListener('pointerleave', unhover);
	// the map: a block's tooltip, its request lit (on the map and on its
	// chat), a click picking it; over the GPU's bar, what each part is
	const ownerAt = b => b >= 0 && now.cells.kind[b] !== KEY.system ? now.cells.owner[b] : -1;
	mapCv.addEventListener('pointermove', e => {
		const b = blockAt(e), m = mapCv.getBoundingClientRect();
		showTip(e, b >= 0 ? blockWords(b) : barWords(e.clientX - m.left, e.clientY - m.top));
		hover(ownerAt(b));
	});
	mapCv.addEventListener('pointerleave', unhover);
	mapCv.addEventListener('click', e => {
		const id = ownerAt(blockAt(e));
		if (id >= 0) pickChat(0, id);
	});
	// the river: press to move the clock there, drag to scrub; the pointer's
	// moment in a tooltip
	const scrub = e => seek(riverBox().T(e.clientX - riverCv.getBoundingClientRect().left));
	riverCv.addEventListener('pointerdown', e => {
		scrubbing = true;
		riverCv.setPointerCapture(e.pointerId);
		scrub(e);
	});
	riverCv.addEventListener('pointermove', e => {
		guide = e.clientX - riverCv.getBoundingClientRect().left;
		if (scrubbing) scrub(e);
		else paintRiver();
		showTip(e, riverWords(riverBox().T(guide)));
	});
	riverCv.addEventListener('pointerup', () => (scrubbing = false));
	riverCv.addEventListener('pointerleave', () => {
		guide = -1;
		tip.hidden = true;
		paintRiver();
	});
	// presses keep the keys with the window, as a player's do, but for one
	// that opened the pinned chat, which keeps them
	root.addEventListener('pointerdown', e => {
		if (!e.target.closest('select')) {
			setTimeout(() => pin.contains(document.activeElement) || root.focus({ preventScroll: true }));
		}
	});
	// A pane resized, or the key under the map, as it takes another line:
	// the map laid out again and everything drawn; let go with the window
	const resized = new ResizeObserver(() => {
		if (!root.isConnected) return resized.disconnect();
		if (!sides.length) return;
		relayout();
		draw();
	});

	// Opened in Users, paused at a telling step of the static batches it
	// opens on: one under way with the most left waiting for it at its
	// middle (those come, less those let in and those refused), and of
	// those the most rows done and held, a row a hundredth of a request
	// waiting. Run plays on from there
	function openingStep() {
		const telling = new Float64Array(run.steps.length).fill(-1), reqs = run.S.reqs, PER_ROW = 1 / 100;
		for (let k = 0, i = 0, come = 0, joined = 0; k < run.steps.length; k++) {
			const s = run.steps[k], mid = (s.t0 + s.t1) / 2;
			for (; i < reqs.length && reqs[i].arrival <= mid; i++) if (reqs[i].status !== 'refused') come++;
			joined += s.joined.length;
			if (s.bands.length) {
				telling[k] = come - joined + PER_ROW * s.bands.filter(b => !b.tokens && !b.reserved).length;
			}
		}
		const k = telling.reduce((best, x, j) => (x > telling[best] ? j : best), 0), s = run.steps[k];
		return s ? (s.t0 + s.t1) / 2 : 0;
	}
	serveAll();
	clock.t = openingStep();
	drawAll();
	for (const el of [body, keyEl]) resized.observe(el);
})();
