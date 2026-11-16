// The videos deck (_includes/videos.html): the screen holds the picked
// video's thumbnail until it is played, the list cues one and the transport
// plays, pauses, stops and steps. Each deck is set up once, here or on the
// run an SPA load repeats, so 399 and 699 can be open together
(function () {
	document.querySelectorAll('.vp:not([data-ready])').forEach(function (vp) {
		vp.dataset.ready = '';
		var screen = vp.querySelector('.vp-screen');
		var titleEl = vp.querySelector('.vp-now b');
		var durEl = vp.querySelector('.vp-now span');
		var playBtn = vp.querySelector('[data-act="play"]');
		var items = Array.prototype.slice.call(vp.querySelectorAll('.vp-item'));
		var current = null;
		var playing = false;
		var paused = false;

		// Pause and resume ride YouTube's postMessage API; enablejsapi=1 on
		// the embed switches it on without loading their script
		function cmd(func) {
			var f = screen.querySelector('iframe');
			if (f) f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: '' }), '*');
		}

		function syncPlayBtn() {
			playBtn.innerHTML = playing && !paused ? '&#10074;&#10074;' : '&#9654;';
			playBtn.setAttribute('aria-label', playing && !paused ? 'pause' : 'play');
		}

		function select(item, autoplay) {
			current = item;
			playing = autoplay;
			paused = false;
			items.forEach(function (i) { i.classList.toggle('on', i === item); });
			titleEl.textContent = item.getAttribute('data-title');
			durEl.textContent = item.getAttribute('data-dur');
			var id = item.getAttribute('data-id');
			if (autoplay) {
				screen.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id +
					'?autoplay=1&enablejsapi=1" title="video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
				// ask the player to report state changes, so the button stays
				// truthful when the reader pauses inside the video itself
				screen.querySelector('iframe').addEventListener('load', function () {
					this.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
				});
			} else {
				screen.innerHTML = '<img class="vp-thumb" src="https://i.ytimg.com/vi/' + id +
					'/hqdefault.jpg" alt="" loading="lazy"><span class="vp-play"></span>';
			}
			syncPlayBtn();
		}

		// only this deck's player, when two decks are open
		window.addEventListener('message', function (e) {
			var f = screen.querySelector('iframe');
			if (e.origin !== 'https://www.youtube.com' || !f || e.source !== f.contentWindow) return;
			var data;
			try { data = JSON.parse(e.data); } catch (err) { return; }
			var st = data.info && data.info.playerState;
			if (st === 1) paused = false;
			else if (st === 2) paused = true;
			else return;
			syncPlayBtn();
		});

		vp.querySelector('.vp-list').addEventListener('click', function (e) {
			var item = e.target.closest('.vp-item');
			if (item) select(item, false);
		});
		screen.addEventListener('click', function () {
			if (!playing && current) select(current, true);
		});

		function step(delta) {
			var i = (items.indexOf(current) + delta + items.length) % items.length;
			select(items[i], true);
		}
		vp.querySelector('[data-act="prev"]').addEventListener('click', function () { step(-1); });
		vp.querySelector('[data-act="next"]').addEventListener('click', function () { step(1); });
		playBtn.addEventListener('click', function () {
			if (!current) return;
			if (!playing) return select(current, true);
			paused = !paused;
			cmd(paused ? 'pauseVideo' : 'playVideo');
			syncPlayBtn();
		});
		vp.querySelector('[data-act="stop"]').addEventListener('click', function () {
			if (current) select(current, false);
		});

		select(items[0], false);
	});
})();
