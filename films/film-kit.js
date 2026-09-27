// Film kit: the shared machinery for the lesson films.
// A film page provides the stage markup (see any film HTML) and calls
//   FilmKit.run({ DUR, CHAPTERS, SUBS, MATH, draw, mood, chord, penta, events, steppers })
// The kit handles layout, starfield, grain, letterbox, subtitles, math cards, chapter titles,
// controls (play, scrub, chapters, keyboard), sound (a chord that detunes with `mood`) and
// narration (the browser reads each subtitle and the film holds until the line is finished).
(() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => v > b ? b : v >= a ? v : a;   // NaN falls back to a
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const E = (t, a, b) => ease(seg(t, a, b));
  const win = (t, a, b, f = .6) => Math.min(E(t, a, a + f), 1 - E(t, b - f, b));
  const fmt = (v, d = 2) => { const s = Math.abs(v).toFixed(d); return (v < 0 && +s !== 0 ? '−' : '') + s; };
  const paren = (v, d = 3) => v < 0 ? `(${fmt(v, d)})` : fmt(v, d);
  const sqrt0 = v => Math.sqrt(Math.max(0, v));
  const COL = { ink: '#0b1120', bone: '#eee6d6', dim: '#8d93a6', amber: '#f4b860', rose: '#ef8193', star: '#a9d6f5', lilac: '#c4b3ff', mint: '#8fdcae' };
  const hexRGB = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
  const rgba = (hex, a) => { const [r, g, b] = hexRGB(hex); return `rgba(${r},${g},${b},${a})`; };
  const mixHex = (h1, h2, t) => { const a = hexRGB(h1), b = hexRGB(h2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`; };
  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const gaussFrom = rnd => () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd()); };
  const shuffled = (n, rnd) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const util = { TAU, clamp, lerp, ease, seg, E, win, fmt, paren, sqrt0, COL, hexRGB, rgba, mixHex, mulberry32, gaussFrom, shuffled };

  function run(spec) {
    const { DUR, CHAPTERS, SUBS, MATH, draw } = spec;
    const mood = spec.mood || (() => .3);
    const $ = id => document.getElementById(id);
    const stage = $('stage'), cvs = $('film'), ctx = cvs.getContext('2d');
    const g = { ctx, W: 0, H: 0, RM: null, RP: null };
    let DPR = 1, BAR = 24, vig = null;

    function measure() {
      const st = stage.getBoundingClientRect();
      BAR = Math.round(Math.min(44, Math.max(10, st.height * .055)));
      stage.style.setProperty('--bar', BAR + 'px');
      g.W = st.width; g.H = st.height; DPR = Math.min(2, window.devicePixelRatio || 1);
      cvs.width = Math.round(g.W * DPR); cvs.height = Math.round(g.H * DPR);
      const rel = el => { const r = el.getBoundingClientRect(); return { x: r.left - st.left, y: r.top - st.top, w: r.width, h: r.height }; };
      g.RM = rel($('slotPlot')); g.RP = rel($('slotPanel'));
      vig = null;
      if (spec.onResize) spec.onResize(g);
    }
    new ResizeObserver(measure).observe(stage);
    if (document.fonts) document.fonts.ready.then(measure);
    measure();

    const grain = document.createElement('canvas');
    grain.width = grain.height = 160;
    { const gc = grain.getContext('2d'), id = gc.createImageData(160, 160);
      for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      gc.putImageData(id, 0, 0); }
    const grainPat = ctx.createPattern(grain, 'repeat');
    const srnd = mulberry32(99);
    const STARS = Array.from({ length: 170 }, () => ({ x: srnd(), y: srnd(), r: srnd() * 1.1 + .3, a: srnd() * .4 + .08, sp: .4 + srnd() * 1.4, ph: srnd() * TAU, z: srnd() }));

    // ── drawing helpers ──
    g.txt = (s, x, y, o = {}) => {
      ctx.save();
      ctx.globalAlpha *= o.a ?? 1;
      ctx.fillStyle = o.c || COL.dim;
      ctx.font = `${o.it ? 'italic ' : ''}${o.w || 500} ${o.s || 10.5}px ${o.mono ? '"IBM Plex Mono", ui-monospace, monospace' : o.serif ? '"Cormorant Garamond", Georgia, serif' : '"Instrument Sans", system-ui, sans-serif'}`;
      ctx.textAlign = o.al || 'left';
      ctx.textBaseline = o.bl || 'alphabetic';
      if ('letterSpacing' in ctx) ctx.letterSpacing = o.ls || '0px';
      ctx.fillText(s, x, y);
      ctx.restore();
    };
    g.cap = (s, x, y, o = {}) => g.txt(s, x, y, { s: 9.5, w: 600, ls: '2px', ...o });
    g.scaler = (R, xd, yd, p) => {
      const ix = R.x + p.l, iy = R.y + p.t, iw = Math.max(10, R.w - p.l - p.r), ih = Math.max(10, R.h - p.t - p.b);
      const sx = iw / (xd[1] - xd[0]), sy = ih / (yd[1] - yd[0]);
      return { ix, iy, iw, ih, sx, sy, xd, yd, X: v => ix + (v - xd[0]) * sx, Y: v => iy + ih - (v - yd[0]) * sy };
    };
    g.clipTo = S => { ctx.beginPath(); ctx.rect(S.ix, S.iy, S.iw, S.ih); ctx.clip(); };
    g.rrect = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
    g.glowDot = (x, y, r, col, blur = 12) => {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(x, y, r * .45, 0, TAU); ctx.fill(); ctx.restore();
    };
    g.arrow = (x1, y1, x2, y2, col, lw = 2) => {
      const len = Math.hypot(x2 - x1, y2 - y1); if (len < 2) return;
      const a = Math.atan2(y2 - y1, x2 - x1), h = Math.min(7 + lw, len * .6);
      ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * h * .6, y2 - Math.sin(a) * h * .6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(a - .42) * h, y2 - Math.sin(a - .42) * h);
      ctx.lineTo(x2 - Math.cos(a + .42) * h, y2 - Math.sin(a + .42) * h);
      ctx.closePath(); ctx.fill(); ctx.restore();
    };
    g.dashed = (x1, y1, x2, y2, col, lw = 1, dash = [3, 5]) => {
      ctx.save(); ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    };
    g.line = (x1, y1, x2, y2, col, lw = 1) => {
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    };

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function render(t) {
      const { W, H, RM } = g;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalAlpha = 1; ctx.fillStyle = COL.ink; ctx.fillRect(0, 0, W, H);
      const calm = 1 - clamp(mood(t));
      const bloom = ctx.createRadialGradient(RM.x + RM.w / 2, RM.y + RM.h / 2, 0, RM.x + RM.w / 2, RM.y + RM.h / 2, Math.max(RM.w, RM.h) * .8 || 1);
      bloom.addColorStop(0, rgba(COL.amber, clamp(.03 + .06 * calm + .05 * E(t, DUR - 14, DUR - 8), 0, 1)));
      bloom.addColorStop(1, rgba(COL.amber, 0));
      ctx.fillStyle = bloom; ctx.fillRect(0, 0, W, H);
      for (const s of STARS) {
        ctx.globalAlpha = s.a * (.55 + .45 * Math.sin(t * s.sp + s.ph));
        ctx.fillStyle = COL.bone;
        ctx.beginPath(); ctx.arc(((s.x + t * .0012 * (.3 + s.z)) % 1) * W, s.y * H, s.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.save(); draw(t, g); ctx.restore();
      if (!vig) {
        vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .78);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.55)');
      }
      ctx.globalAlpha = 1; ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = .045;
      const ox = reduce ? 0 : (Math.random() * 160) | 0, oy = reduce ? 0 : (Math.random() * 160) | 0;
      ctx.translate(ox, oy); ctx.fillStyle = grainPat; ctx.fillRect(-ox, -oy, W, H); ctx.restore();
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, BAR); ctx.fillRect(0, H - BAR, W, BAR);
    }

    // ── DOM overlays ──
    const el = { title: $('titlecard'), chap: $('chapter'), chapAct: $('chapAct'), chapName: $('chapName'), sub: $('sub'), math: $('math'), end: $('endcard'), time: $('time'), scrub: $('scrub'), play: $('play'), sound: $('sound') };
    el.scrub.max = DUR;
    const setOp = (node, v) => { const s = clamp(v).toFixed(3); if (node._op !== s) { node.style.opacity = s; node._op = s; } };
    const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    let chapIdx = -1, subIdx = -2, mathHTML = '', dragging = false;
    const chapBtns = CHAPTERS.map(c => {
      const b = document.createElement('button'); b.type = 'button';
      b.textContent = c.act ? (c.act.startsWith('Act ') ? `${c.act.replace('Act ', '')} · ${c.name}` : c.name) : c.name;
      b.addEventListener('click', () => { t = c.t + .01; narr.stop(); playing = true; syncPlay(); });
      $('chapters').appendChild(b);
      const tick = document.createElement('span'); tick.style.left = (c.t / DUR * 100) + '%'; $('ticks').appendChild(tick);
      return b;
    });
    function updateDOM(t) {
      setOp(el.title, 1 - E(t, 6, 7.6));
      let ci = 0; CHAPTERS.forEach((c, i) => { if (t >= c.t) ci = i; });
      if (ci !== chapIdx) {
        chapIdx = ci; el.chapAct.textContent = CHAPTERS[ci].act; el.chapName.textContent = CHAPTERS[ci].name;
        chapBtns.forEach((b, i) => b.classList.toggle('on', i === ci));
      }
      const c = CHAPTERS[ci];
      setOp(el.chap, c.act ? win(t, c.t + .3, c.t + 3.4, .5) : 0);
      const si = SUBS.findIndex(s => t >= s[0] && t < s[1]);
      if (si !== subIdx) { subIdx = si; el.sub.textContent = si >= 0 ? SUBS[si][2] : ''; }
      setOp(el.sub, si >= 0 ? win(t, SUBS[si][0], SUBS[si][1], .35) : 0);
      const m = MATH.find(q => t >= q.t0 && t < q.t1);
      const html = m ? m.html(t) : '';
      if (html !== mathHTML) { mathHTML = html; el.math.innerHTML = html; }
      setOp(el.math, m ? win(t, m.t0, m.t1, .6) : 0);
      const ea = E(t, DUR - 4.5, DUR - 2.5);
      el.end.hidden = ea <= .01; setOp(el.end, ea);
      el.time.textContent = `${mmss(t)} / ${mmss(DUR)}`;
      if (!dragging) el.scrub.value = t.toFixed(2);
    }

    // ── sound ──
    let audio = null, soundOn = false;
    const chord = spec.chord || [110, 164.81, 220, 277.18, 329.63];
    const penta = spec.penta || [220, 246.94, 277.18, 329.63, 369.99, 440, 493.88, 554.37, 659.25, 739.99, 880];
    function makeAudio() {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      const ac = new AC();
      const master = ac.createGain(); master.gain.value = 0;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = .4;
      const delay = ac.createDelay(1); delay.delayTime.value = .37;
      const fb = ac.createGain(); fb.gain.value = .33;
      delay.connect(fb); fb.connect(delay);
      lp.connect(master); lp.connect(delay); delay.connect(master); master.connect(ac.destination);
      const signs = [0, 1, -1, 1, -1];
      const voices = chord.map((f, i) => {
        const o = ac.createOscillator(); o.type = i < 2 ? 'sine' : 'triangle'; o.frequency.value = f;
        const gn = ac.createGain(); gn.gain.value = i < 2 ? .16 : .055; o.connect(gn); gn.connect(lp); o.start();
        return { o, sign: signs[i % signs.length] };
      });
      const pluckBus = ac.createGain(); pluckBus.gain.value = 1; pluckBus.connect(master); pluckBus.connect(delay);
      return { ac, master, lp, voices, pluckBus };
    }
    function pluck(freq, vel = .06) {
      if (!audio || !soundOn) return;
      const { ac, pluckBus } = audio, now = ac.currentTime;
      [[freq, 'triangle', 1], [freq * 2, 'sine', .3]].forEach(([f, type, m]) => {
        const o = ac.createOscillator(), gn = ac.createGain(); o.type = type; o.frequency.value = f;
        gn.gain.setValueAtTime(0, now); gn.gain.linearRampToValueAtTime(vel * m, now + .012);
        gn.gain.exponentialRampToValueAtTime(.0001, now + 1.6);
        o.connect(gn); gn.connect(pluckBus); o.start(now); o.stop(now + 1.7);
      });
    }
    const note = u => penta[Math.min(penta.length - 1, Math.max(0, Math.floor(u * penta.length)))];
    function updateAudio(t) {
      if (!audio) return;
      const now = audio.ac.currentTime, dis = clamp(mood(t)) * (1 - E(t, DUR - 16, DUR - 13));
      const level = soundOn && playing ? .2 * (.6 + .4 * E(t, 0, 3)) * (1 + .4 * E(t, DUR - 14, DUR - 10)) * (1 - E(t, DUR - 4, DUR)) : 0;
      audio.master.gain.setTargetAtTime(level * (narr.speaking() ? .45 : 1), now, .25);
      audio.voices.forEach(v => v.o.detune.setTargetAtTime(v.sign * dis * 60, now, .35));
      audio.lp.frequency.setTargetAtTime(420 + 2000 * (1 - dis) * (t > 20 ? 1 : .5), now, .4);
    }
    const EVENTS = (spec.events || []).slice();
    const fin = chord.slice(2).map(f => f * 2).concat([chord[2] * 4]);
    fin.forEach((f, j) => EVENTS.push({ t: DUR - 13.4 + j * .3, fn: () => pluck(f, .08) }));
    function onAdvance(a, b) {
      if (b - a > .25) return;
      EVENTS.forEach(e => { if (a < e.t && e.t <= b) e.fn(pluck, note); });
      (spec.steppers || []).forEach(s => {
        const k0 = Math.floor(s.k(a)), k1 = Math.floor(s.k(b));
        if (k1 > k0 && k1 <= s.steps) pluck(note(k1 / s.steps), s.vel ? s.vel(k1) : .05);
      });
    }

    // ── narration ──
    const narr = (() => {
      const synth = window.speechSynthesis;
      const PREF = [/premium/i, /enhanced/i, /natural/i, /neural/i, /Google UK English Female/i, /Google US English/i, /Samantha/i, /Daniel/i, /Karen/i, /Moira/i];
      let on = false, voice = null, utter = null, spokenIdx = -1, speakingIdx = -1, startedAt = 0, budget = 0;
      function pickVoice() {
        const vs = synth.getVoices().filter(v => /^en/i.test(v.lang));
        for (const re of PREF) { const v = vs.find(v => re.test(v.name)); if (v) return v; }
        return vs.find(v => v.default) || vs[0] || null;
      }
      if (synth) { voice = pickVoice(); synth.addEventListener?.('voiceschanged', () => { voice = pickVoice(); }); }
      const spoken = s => s.replace(/η/g, 'eta').replace(/…/g, '...').replace(/[“”]/g, '').replace(/×/g, 'times');
      function stop() { if (synth) synth.cancel(); utter = null; speakingIdx = -1; spokenIdx = -1; }
      function speak(i) {
        synth.cancel();
        const text = spoken(SUBS[i][2]);
        const u = new SpeechSynthesisUtterance(text);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
        u.rate = .95; u.pitch = 1;
        u.onend = u.onerror = () => { if (utter === u) { utter = null; speakingIdx = -1; } };
        utter = u; speakingIdx = i; spokenIdx = i;
        startedAt = performance.now();
        budget = (text.split(/\s+/).length / 2.4 + 1.5) * 1800 + 2000;
        synth.speak(u);
      }
      return {
        supported: !!synth,
        get on() { return on; },
        set(v) { on = v; if (!on) stop(); else if (synth) synth.speak(new SpeechSynthesisUtterance('')); },
        speaking: () => on && speakingIdx >= 0,
        stop,
        pauseForUser() { if (speakingIdx >= 0) stop(); },
        holdPoint() {
          if (!on || speakingIdx < 0) return Infinity;
          if (performance.now() - startedAt > budget) { speakingIdx = -1; return Infinity; }
          return SUBS[speakingIdx][1] - .4;
        },
        update(t) {
          if (!on || !playing) return;
          const si = SUBS.findIndex(s => t >= s[0] && t < s[1]);
          if (si >= 0 && si !== spokenIdx) speak(si);
        },
      };
    })();

    // ── controls ──
    const startAt = parseFloat(new URLSearchParams(location.search).get('t'));
    let t = Number.isFinite(startAt) ? clamp(startAt, 0, DUR) : 0, playing = !reduce, lastNow = performance.now();
    function syncPlay() { el.play.textContent = playing ? 'Pause' : (t >= DUR ? 'Replay' : 'Play'); }
    el.play.addEventListener('click', () => { if (t >= DUR) { t = 0; narr.stop(); } playing = !playing; if (!playing) narr.pauseForUser(); syncPlay(); });
    $('replay').addEventListener('click', () => { t = 0; narr.stop(); playing = true; syncPlay(); });
    el.scrub.addEventListener('pointerdown', () => dragging = true);
    window.addEventListener('pointerup', () => dragging = false);
    el.scrub.addEventListener('input', () => { t = +el.scrub.value; narr.stop(); syncPlay(); });
    el.sound.addEventListener('click', () => {
      if (!audio) audio = makeAudio();
      if (!audio) { el.sound.textContent = 'No audio'; return; }
      audio.ac.resume();
      soundOn = !soundOn;
      el.sound.textContent = soundOn ? 'Sound on' : 'Sound off';
      el.sound.setAttribute('aria-pressed', String(soundOn));
    });
    const narrBtn = $('narrate');
    if (!narr.supported) { narrBtn.textContent = 'No narration'; narrBtn.disabled = true; }
    narrBtn.addEventListener('click', () => {
      narr.set(!narr.on);
      narrBtn.textContent = narr.on ? 'Narration on' : 'Narration off';
      narrBtn.setAttribute('aria-pressed', String(narr.on));
    });
    document.addEventListener('keydown', e => {
      if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); if (t >= DUR) { t = 0; narr.stop(); } playing = !playing; if (!playing) narr.pauseForUser(); syncPlay(); }
      else if (e.target.tagName !== 'INPUT' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { t = clamp(t + (e.key === 'ArrowRight' ? 5 : -5), 0, DUR); narr.stop(); }
    });
    syncPlay();

    function frame(now) {
      const dt = Math.min(.1, (now - lastNow) / 1000); lastNow = now;
      if (playing) {
        const prev = t; t = Math.min(DUR, t + dt, Math.max(prev, narr.holdPoint()));
        onAdvance(prev, t);
        if (t >= DUR) { playing = false; syncPlay(); }
      }
      narr.update(t);
      try { render(t); } catch (err) { console.error(err); }   // one bad frame must never stop the film
      updateDOM(t); updateAudio(t);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  window.FilmKit = { run, util };
})();
