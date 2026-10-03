// Learning AI My Way — step-by-step coding lab.
// window.startLab(host, { slug, lab, renderMath, onComplete }) renders an IDE-like panel where the
// learner writes one small piece of code per step, runs its tests in Python (Pyodide, in a worker),
// and unlocks the next step. Passing the last required step calls onComplete().
//
// A lab has guided steps, and may also have exercises (unguided, with a ladder of hints and a
// solution that unlocks after passing or a few tries). Labs with mode: 'project' edit several files
// in tabs instead of one growing file, and download as a runnable folder. Labs with llm: true talk
// to the simulated model; steps marked real: true can use the learner's own Claude API key.
(() => {
  const CM = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/';
  const WORKER_URL = 'assets/js/py-worker.js?v=3';
  const TIMEOUT_MS = 20000, REAL_TIMEOUT_MS = 90000;
  const KEY_STORE = 'anthropic-key';
  const KIND = { fix: 'Fix it', extend: 'Extend it', design: 'Design it' };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const loadCSS = href => new Promise(r => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = l.onerror = r; document.head.appendChild(l); });
  const loadJS = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  let cmPromise = null;
  const loadEditor = () => cmPromise || (cmPromise = (async () => {
    await loadCSS(CM + 'codemirror.min.css');
    await loadJS(CM + 'codemirror.min.js');
    await Promise.all([loadJS(CM + 'mode/python/python.min.js'), loadJS(CM + 'addon/edit/matchbrackets.min.js')]);
  })());

  // ── Python runner: one worker, restarted if code runs too long ──
  class Runner {
    constructor(onStatus) { this.onStatus = onStatus; this.worker = null; this.ready = false; this.pending = null; this.seq = 0; }
    start() {
      if (this.worker) return;
      this.ready = false; this.onStatus('loading');
      let w;
      try { w = new Worker(WORKER_URL); } catch (err) { this.onStatus('error', String(err)); return; }
      this.worker = w;
      w.onmessage = e => {
        const m = e.data;
        if (m.type === 'ready') { this.ready = true; this.onStatus('ready'); if (this.pending) this.arm(); }
        else if (m.type === 'fatal') { this.onStatus('error', m.error); this.finish({ fatal: m.error }); }
        else if (m.type === 'installing' && this.pending && m.id === this.pending.id) {
          clearTimeout(this.pending.timer);        // downloading is not a stuck loop
          this.onStatus('installing', m.names.join(', '));
          if (this.onInstall) this.onInstall(m.names);
        }
        else if (m.type === 'installed' && this.pending && m.id === this.pending.id) { this.onStatus('ready'); this.arm(); }
        else if (m.type === 'result' && this.pending && m.id === this.pending.id) this.finish(m.result);
      };
      w.onerror = e => { this.onStatus('error', e.message || 'Python could not start.'); this.finish({ fatal: e.message || 'Python could not start.' }); };
    }
    arm() {
      clearTimeout(this.pending.timer);
      const ms = this.pending.ms;
      this.pending.timer = setTimeout(() => {
        this.worker.terminate(); this.worker = null; this.ready = false;
        this.finish({ timeout: ms });
        this.start();
      }, ms);
    }
    finish(result) {
      if (!this.pending) return;
      const p = this.pending; this.pending = null; clearTimeout(p.timer); p.resolve(result);
    }
    // job: { src, tests } for one file, or { files, tests } for a project; realKey for real Claude steps.
    run(job) {
      this.start();
      return new Promise(resolve => {
        const id = ++this.seq;
        this.pending = { id, resolve, timer: null, ms: job.realKey ? REAL_TIMEOUT_MS : TIMEOUT_MS };
        this.worker.postMessage({ id, ...job });
        if (this.ready) this.arm();
      });
    }
  }

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const keyStore = {
    get() { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } },
    set(v) { try { v ? localStorage.setItem(KEY_STORE, v) : localStorage.removeItem(KEY_STORE); } catch { /* storage unavailable */ } },
  };

  // ── a zip file, built in the browser (stored, not compressed) ──
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], dir = [];
    let off = 0;
    for (const [name, text] of Object.entries(files)) {
      const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, nm.length, 2], [28, 0, 2]]
        .forEach(([o, v, n]) => n === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, nm.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]]
        .forEach(([o, v, n]) => n === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true));
      parts.push(new Uint8Array(h.buffer), nm, data);
      dir.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + data.length;
    }
    const size = dir.reduce((a, b) => a + b.length, 0), n = Object.keys(files).length;
    const end = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, n, 2], [10, n, 2], [12, size, 4], [16, off, 4], [20, 0, 2]]
      .forEach(([o, v, k]) => k === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true));
    return new Blob([...parts, ...dir, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  window.startLab = async function (host, { slug, lab, renderMath, onComplete }) {
    const KEY = 'lab:' + slug;
    const project = lab.mode === 'project';
    const S = Object.assign({ code: {}, passed: {}, cur: 0, tries: {}, hints: {}, files: null, tab: null, opened: {}, snap: {} }, store.get(KEY) || {});
    const steps = lab.steps.map(s => ({ ...s, kind: 'step' }));
    const exercises = (lab.exercises || []).map(s => ({ ...s, kind: 'exercise' }));
    const items = [...steps, ...exercises];
    const keyOf = it => (it.kind === 'exercise' ? 'ex:' : '') + it.id;
    const required = steps.filter(s => !s.optional);
    const N = steps.length, NE = exercises.length;
    const save = () => store.set(KEY, S);
    const isPassed = it => !!S.passed[keyOf(it)];
    const labDone = () => required.every(isPassed);
    const unlocked = i => {
      const it = items[i];
      if (it.kind === 'exercise') return labDone();
      return steps.slice(0, i).filter(s => !s.optional).every(isPassed);
    };
    const hintsOf = it => it.hints || (it.hint ? [it.hint] : []);
    const unlockAfter = it => it.unlockAfter ?? 3;
    if (!unlocked(S.cur) || S.cur >= items.length) S.cur = 0;
    if (project) {
      S.files = S.files || { ...lab.files };
      if (!S.tab || !(S.tab in S.files)) S.tab = Object.keys(S.files)[0];
    }

    host.innerHTML = `
      <div class="lab-head">
        <div class="eyebrow">${project ? 'Guided project' : 'Build it yourself'}</div>
        <h2 id="build">${esc(lab.title)}</h2>
        <p>${lab.intro}</p>
      </div>
      ${NE ? '<span id="exercises" class="anchor"></span>' : ''}
      <div class="ide${project ? ' ide-project' : ''}">
        <div class="ide-top">
          <span class="ide-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="ide-file">${esc(project ? lab.folder || slug : lab.file)}</span>
          <span class="ide-count" id="lab-count"></span>
          <span class="ide-status" id="lab-status">Python not started</span>
          ${lab.llm ? '<button class="ide-model" id="lab-model" type="button"></button>' : ''}
        </div>
        ${lab.llm ? '<div class="ide-keys" id="lab-keys" hidden></div>' : ''}
        <div class="ide-body">
          <ol class="ide-steps" id="lab-steps"></ol>
          <div class="ide-main">
            <div class="ide-brief" id="lab-brief"></div>
            <div class="ide-prev" id="lab-prev-wrap">
              <div class="ide-prev-label" id="lab-prev-label"></div>
              <div id="lab-prev"></div>
            </div>
            <div class="ide-tabs" id="lab-tabs" role="tablist" ${project ? '' : 'hidden'}></div>
            <div class="ide-editor" id="lab-editor"><p class="ide-loading">Loading the editor…</p></div>
            <div class="ide-bar">
              <button class="ide-run" id="lab-run" type="button">▶ Run tests</button>
              <span class="ide-kbd">Ctrl / ⌘ + Enter</span>
              <span class="ide-spacer"></span>
              <button class="ide-ghost" id="lab-hint" type="button">Hint</button>
              <button class="ide-ghost" id="lab-sol" type="button">Show solution</button>
              <button class="ide-ghost" id="lab-reset" type="button">${project ? 'Reset file' : 'Reset step'}</button>
            </div>
            <div class="ide-help" id="lab-help" hidden></div>
            <div class="ide-console" id="lab-console" aria-live="polite"></div>
          </div>
        </div>
      </div>
      <div class="lab-done" id="lab-done" hidden></div>`;

    const $ = id => host.querySelector('#' + id);
    const statusEl = $('lab-status');
    const runner = new Runner((state, err) => {
      statusEl.dataset.state = state;
      statusEl.textContent = state === 'loading' ? 'Starting Python…' : state === 'installing' ? `Installing ${err}…` : state === 'ready' ? 'Python ready' : 'Python failed to start';
      if (state === 'error' && err) statusEl.title = err;
    });
    runner.onInstall = names => {
      const con = $('lab-console');
      if (con) con.innerHTML = `<div class="muted">Installing ${esc(names.join(', '))} into Python. This happens once and can take 10–30 seconds for scikit-learn…</div>`;
    };
    // Warm up Python once the lab scrolls into view, so the first run is quick.
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { runner.start(); io.disconnect(); } }, { rootMargin: '400px' });
    io.observe(host);

    // ── your own Claude API key (labs that use a model) ──
    function syncModel() {
      if (!lab.llm) return;
      const k = keyStore.get();
      $('lab-model').textContent = k ? 'Model: simulated · real Claude on' : 'Model: simulated';
      $('lab-model').dataset.real = k ? '1' : '';
    }
    function renderKeys() {
      const k = keyStore.get();
      $('lab-keys').innerHTML = `
        <p><strong>Every step runs on a simulated model</strong> inside your browser: free, instant and predictable, so the tests can check your code exactly. Steps marked <em>real Claude</em> can also send the same request to the real Claude API with your own key.</p>
        <p class="warn">Your key is kept only in this browser (localStorage) and is sent only to api.anthropic.com, and only when you run a real-Claude step. Anyone using this browser profile could read it, so use a key with a low spend limit, and remove it when you are done.</p>
        <div class="ide-keyrow">
          ${k ? `<span class="ide-keyset">Key saved: ${esc(k.slice(0, 10))}…${esc(k.slice(-4))}</span><button class="ide-ghost" type="button" id="lab-key-forget">Remove key</button>`
              : `<input id="lab-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" aria-label="Anthropic API key"><button class="ide-ghost" type="button" id="lab-key-save">Save in this browser</button>`}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Get a key ↗</a>
        </div>`;
      $('lab-key-save')?.addEventListener('click', () => {
        const v = $('lab-key').value.trim();
        if (!/^sk-ant-/.test(v)) { $('lab-key').setCustomValidity('An Anthropic key starts with sk-ant-'); $('lab-key').reportValidity(); return; }
        keyStore.set(v); renderKeys(); syncModel(); show(S.cur);
      });
      $('lab-key-forget')?.addEventListener('click', () => { keyStore.set(''); renderKeys(); syncModel(); show(S.cur); });
    }
    if (lab.llm) {
      $('lab-model').addEventListener('click', () => { const p = $('lab-keys'); p.hidden = !p.hidden; if (!p.hidden) renderKeys(); });
      syncModel();
    }

    try { await loadEditor(); }
    catch (err) { $('lab-editor').innerHTML = `<p class="ide-loading">The code editor could not load (${esc(err.message)}). Check your connection and reload.</p>`; return; }

    const cmOpts = { mode: 'python', lineNumbers: true, indentUnit: 4, tabSize: 4, matchBrackets: true, viewportMargin: Infinity };
    const prevCM = window.CodeMirror($('lab-prev'), { ...cmOpts, readOnly: 'nocursor' });
    $('lab-editor').innerHTML = '';
    const ed = window.CodeMirror($('lab-editor'), {
      ...cmOpts,
      extraKeys: {
        Tab: cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.execCommand('insertSoftTab'),
        'Shift-Tab': cm => cm.indentSelection('subtract'),
        'Ctrl-Enter': () => run(), 'Cmd-Enter': () => run(),
      },
    });
    let saveTimer = null, loading = false, shown = false;
    const keep = () => {
      if (loading || !shown) return;   // nothing to keep before the first item is on screen
      if (project) S.files[S.tab] = ed.getValue();
      else S.code[keyOf(items[S.cur])] = ed.getValue();
    };
    ed.on('change', () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { keep(); save(); }, 300); });
    const setEditor = text => { loading = true; ed.setValue(text); ed.clearHistory(); loading = false; shown = true; };

    const codeOf = it => S.code[keyOf(it)] ?? it.starter;
    // Code shown read-only above the editor: earlier steps' code, or an exercise's given code.
    function givenOf(it) {
      if (it.kind === 'step') return steps.slice(0, items.indexOf(it)).map(codeOf).join('\n\n');
      if (!it.given) return '';
      if (Array.isArray(it.given)) return it.given.map(id => steps.find(s => s.id === id).solution).join('\n\n');
      return it.given;
    }

    function renderSteps() {
      const row = (it, i) => {
        const state = isPassed(it) ? 'passed' : unlocked(i) ? 'open' : 'locked';
        const n = it.kind === 'exercise' ? 'E' + (i - N + 1) : i + 1;
        return `<li><button type="button" data-i="${i}" class="${state}${i === S.cur ? ' current' : ''}${it.optional ? ' optional' : ''}" ${state === 'locked' ? 'disabled' : ''}>
          <span class="n">${state === 'passed' ? '✓' : n}</span><span class="t">${esc(it.title)}${it.optional ? ' <em>optional</em>' : ''}</span></button></li>`;
      };
      $('lab-steps').innerHTML = steps.map(row).join('')
        + (NE ? `<li class="ide-group">Exercises${labDone() ? '' : ' · after the lab'}</li>` + exercises.map((it, j) => row(it, N + j)).join('') : '');
      const d = required.filter(isPassed).length, de = exercises.filter(isPassed).length;
      $('lab-count').textContent = `${d} / ${required.length} steps` + (NE ? ` · ${de} / ${NE} exercises` : '');
    }

    function renderTabs() {
      if (!project) return;
      const focus = items[S.cur].file;
      $('lab-tabs').innerHTML = Object.keys(S.files).map(f => `<button type="button" role="tab" data-file="${esc(f)}" aria-selected="${f === S.tab}" class="${f === focus ? 'focus' : ''}">${esc(f)}${f === focus ? ' <i title="Edit this file in this step">●</i>' : ''}</button>`).join('');
    }
    function openTab(f) {
      keep(); S.tab = f; save();
      ed.setOption('firstLineNumber', 1);
      setEditor(S.files[f]);
      renderTabs();
      setTimeout(() => ed.refresh(), 0);
    }

    function show(i) {
      keep();
      S.cur = i; save();
      const it = items[i];
      const ex = it.kind === 'exercise';
      const realOn = it.real && lab.llm && keyStore.get();
      const head = ex ? `Exercise ${i - N + 1} of ${NE} · ${esc(KIND[it.type] || 'Practice')}` : `Step ${i + 1} of ${N}${it.optional ? ' · optional' : ''}`;
      const realNote = it.real ? `<p class="ide-note">${realOn ? 'This step calls the <strong>real Claude API</strong> with your key. It costs a fraction of a cent.' : 'This step runs on the simulated model. Add your own API key with the <em>Model</em> button above to run it against real Claude.'}</p>` : '';
      $('lab-brief').innerHTML = `<div class="ide-step${ex ? ' ex' : ''}">${head}</div><h3>${esc(it.title)}</h3>${it.brief}${realNote}`;
      if (renderMath) renderMath($('lab-brief'));

      if (project) {
        if (!S.opened[keyOf(it)]) {               // a step may add starter code to a file when first opened
          Object.entries(it.add || {}).forEach(([f, text]) => { S.files[f] = (S.files[f] ? S.files[f].replace(/\s*$/, '\n\n') : '') + text; });
          S.opened[keyOf(it)] = true;
          S.snap[keyOf(it)] = { ...S.files };
        }
        $('lab-prev-wrap').hidden = true;
        S.tab = it.file && it.file in S.files ? it.file : S.tab;
        renderTabs();
        ed.setOption('firstLineNumber', 1);
        setEditor(S.files[S.tab]);
      } else {
        const prev = givenOf(it);
        $('lab-prev-wrap').hidden = !prev;
        const prevLines = prev ? prev.split('\n').length : 0;
        $('lab-prev-label').textContent = !prev ? '' : ex ? `Lines 1–${prevLines} · given code (read only)` : `Lines 1–${prevLines} · written in earlier steps (read only)`;
        prevCM.setValue(prev);
        ed.setOption('firstLineNumber', prev ? prevLines + 2 : 1);
        setEditor(codeOf(it));
      }
      $('lab-help').hidden = true; $('lab-help').innerHTML = '';
      syncButtons();
      $('lab-console').innerHTML = isPassed(it)
        ? `<div class="ok">✓ You passed this ${ex ? 'exercise' : 'step'}. Run it again any time, or go on.</div>${nextButton(i)}`
        : `<div class="muted">${ex ? 'No step-by-step guide this time: read the task, write the code, run the tests. Use the hints if you get stuck.' : 'Write your code above, then run the tests.'}</div>`;
      $('lab-console').querySelector('.ide-next')?.addEventListener('click', () => show(i + 1));
      renderSteps();
      setTimeout(() => { prevCM.refresh(); ed.refresh(); prevCM.scrollTo(null, 1e6); }, 0);
    }

    function syncButtons() {
      const it = items[S.cur], hs = hintsOf(it), seen = S.hints[keyOf(it)] || 0;
      const hb = $('lab-hint');
      hb.hidden = !hs.length;
      hb.textContent = hs.length > 1 ? (seen >= hs.length ? `Hints (${hs.length})` : `Hint ${seen + 1} of ${hs.length}`) : 'Hint';
      const sb = $('lab-sol');
      sb.hidden = project ? !Object.keys(it.solution || {}).length : !it.solution;
      const locked = solutionLocked(it);
      sb.textContent = locked ? `Solution 🔒` : 'Show solution';
      sb.title = locked ? `Unlocks when you pass, or after ${unlockAfter(it)} tries` : '';
    }
    const solutionLocked = it => it.kind === 'exercise' && !isPassed(it) && (S.tries[keyOf(it)] || 0) < unlockAfter(it);

    function nextButton(i) {
      const nx = items[i + 1];
      if (!nx || !unlocked(i + 1)) return '';
      return `<button class="ide-next" type="button">Next: ${esc(nx.title)} →</button>`;
    }

    let running = false;
    async function run() {
      if (running) return;
      running = true;
      keep(); save();
      const i = S.cur, it = items[i], ex = it.kind === 'exercise';
      const con = $('lab-console'), btn = $('lab-run');
      const realKey = it.real && lab.llm ? keyStore.get() || null : null;
      btn.disabled = true;
      con.innerHTML = `<div class="muted">${runner.ready ? (realKey ? 'Running the tests with real Claude…' : 'Running the tests…') : 'Starting Python (the first run takes a few seconds)…'}</div>`;
      let job, offset = 0;
      if (project) job = { files: { ...S.files }, tests: it.tests, realKey };
      else {
        const prev = givenOf(it), code = ed.getValue();
        offset = prev ? prev.split('\n').length + 1 : 0;
        job = { src: prev ? prev + '\n\n' + code : code, tests: it.tests, realKey };
      }
      const r = await runner.run(job);
      btn.disabled = false; running = false;
      let html = '';
      let passed = false;
      if (r.timeout) html = `<div class="bad">Stopped after ${r.timeout / 1000} seconds. Is there a loop that never ends?</div>`;
      else if (r.fatal) html = `<div class="bad">Python could not run: ${esc(r.fatal)}</div>`;
      else {
        if (r.stdout) html += `<pre class="out">${esc(r.stdout)}</pre>`;
        if (r.stage === 'code') {
          const e = r.error, line = e.line;
          const where = project ? (e.file ? `${e.file}, line ${line}: ` : '')
            : line == null ? '' : line > offset ? `Line ${line}: ` : `Line ${line}, in ${ex ? 'the given code' : 'code from an earlier step'}: `;
          html += `<div class="bad">${esc(where)}${esc(e.type)}: ${esc(e.msg)}</div>`;
          if (e.type === 'SyntaxError' || e.type === 'IndentationError') html += `<div class="muted">Check brackets, colons and indentation (4 spaces per level).</div>`;
        } else {
          html += r.tests.map(t => t.ok
            ? `<div class="ok">✓ ${esc(t.name)}</div>`
            : `<div class="bad">✗ ${esc(t.name)}<span>${esc(t.msg)}</span></div>`).join('');
          passed = r.tests.every(t => t.ok);
        }
      }
      const k = keyOf(it), was = !!S.passed[k], wasDone = labDone();
      S.passed[k] = passed || (was && !!r.timeout);
      if (!passed && !r.timeout && !r.fatal) S.tries[k] = (S.tries[k] || 0) + 1;
      save();
      if (passed) {
        const lastReq = !ex && labDone() && !wasDone;
        const msg = ex ? (exercises.every(isPassed) ? 'Exercise solved. That was the last one: every exercise in this lesson is done.' : 'Exercise solved.')
          : lastReq || (labDone() && i === N - 1) ? (lab.finalMessage || 'All tests pass. Your program works.') : 'Step passed.';
        html += `<div class="win">${esc(msg)}</div>${nextButton(i)}`;
      } else if (ex && solutionLocked(it) === false && !was && S.tries[k] === unlockAfter(it)) {
        html += `<div class="muted">The solution is now unlocked, if you want to compare.</div>`;
      }
      con.innerHTML = html;
      con.querySelector('.ide-next')?.addEventListener('click', () => show(i + 1));
      renderSteps(); syncButtons();
      if (passed && !ex && labDone()) complete(!wasDone);
    }

    function fullCode() {
      return steps.filter(s => !s.optional || isPassed(s)).map(codeOf).join('\n\n') + '\n';
    }
    async function projectFiles() {
      const out = { ...S.files };
      if (lab.requirements) out['requirements.txt'] = lab.requirements;
      if (lab.readme) out['README.md'] = lab.readme;
      if (Object.values(S.files).some(t => /^\s*(?:from|import)\s+llmsim\b/m.test(t))) {
        try { out['llmsim.py'] = await fetch('assets/py/llmsim.py').then(r => r.text()); } catch { /* offline */ }
      }
      return out;
    }

    async function complete(fresh) {
      const box = $('lab-done');
      box.hidden = false;
      const exNote = NE ? ` ${NE} exercises are now open in the lab above.` : '';
      if (project) {
        const files = await projectFiles();
        box.innerHTML = `
          <div class="lab-done-head">
            <div><div class="eyebrow">Project complete</div><h3>${esc(lab.doneTitle || 'You finished the project.')}</h3>
            <p>${esc(lab.doneText || 'Download the folder and run it on your own computer.')}${esc(exNote)}</p></div>
            <div class="lab-done-actions"><a class="btn" id="lab-dl" download="${esc(lab.folder || slug)}.zip">Download project (.zip)</a></div>
          </div>
          <div class="lab-files">${Object.keys(files).map(f => `<code>${esc(f)}</code>`).join('')}</div>
          ${lab.run ? `<pre><code class="language-bash">${esc(lab.run)}</code></pre>` : ''}`;
        $('lab-dl').href = URL.createObjectURL(zip(Object.fromEntries(Object.entries(files).map(([f, t]) => [`${lab.folder || slug}/${f}`, t]))));
      } else {
        const full = fullCode();
        box.innerHTML = `
          <div class="lab-done-head">
            <div><div class="eyebrow">Lesson complete</div><h3>${esc(lab.doneTitle || 'You finished the lab.')}</h3>
            <p>${esc(lab.doneText || 'Every line below is yours. The lesson is marked as done.')}${esc(exNote)}</p></div>
            <div class="lab-done-actions"><button class="btn" type="button" id="lab-copy">Copy code</button><a class="btn" id="lab-dl" download="${esc(lab.file)}">Download ${esc(lab.file)}</a></div>
          </div>
          <pre><code class="language-python">${esc(full)}</code></pre>`;
        $('lab-dl').href = URL.createObjectURL(new Blob([full], { type: 'text/x-python' }));
        $('lab-copy').addEventListener('click', async e => {
          try { await navigator.clipboard.writeText(full); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Select the code below to copy'; }
        });
      }
      box.querySelectorAll('pre code').forEach(c => window.hljs && window.hljs.highlightElement(c));
      if (onComplete) onComplete();
      if (fresh) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    $('lab-steps').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b && !b.disabled) show(+b.dataset.i); });
    $('lab-tabs').addEventListener('click', e => { const b = e.target.closest('button[data-file]'); if (b) openTab(b.dataset.file); });
    $('lab-run').addEventListener('click', run);
    $('lab-hint').addEventListener('click', () => {
      const h = $('lab-help'), it = items[S.cur], hs = hintsOf(it), k = keyOf(it);
      const seen = S.hints[k] || 0;
      if (!h.hidden && h.dataset.kind === 'hint' && seen >= hs.length) { h.hidden = true; return; }
      if (h.hidden || h.dataset.kind !== 'hint') S.hints[k] = Math.max(seen, 1);
      else S.hints[k] = Math.min(seen + 1, hs.length);
      save();
      h.hidden = false; h.dataset.kind = 'hint';
      const n = S.hints[k];
      h.innerHTML = hs.length > 1
        ? hs.slice(0, n).map((x, j) => `<p><strong>Hint ${j + 1}.</strong> ${x}</p>`).join('') + (n < hs.length ? '<p class="muted">Still stuck? Press the hint button again for a stronger hint.</p>' : '')
        : `<strong>Hint.</strong> ${hs[0]}`;
      if (renderMath) renderMath(h);
      syncButtons();
    });
    $('lab-sol').addEventListener('click', () => {
      const h = $('lab-help'), it = items[S.cur];
      const open = !h.hidden && h.dataset.kind === 'sol';
      h.hidden = open; h.dataset.kind = 'sol';
      if (open) return;
      if (solutionLocked(it)) {
        const t = S.tries[keyOf(it)] || 0;
        h.innerHTML = `<strong>The solution is locked for now.</strong> It unlocks when you pass, or after ${unlockAfter(it)} tries (you have made ${t}). Struggling a little is where the learning happens: try the hints first.`;
        return;
      }
      const sol = it.solution;
      const files = project ? Object.entries(sol) : [[null, sol]];
      h.innerHTML = `<strong>One possible solution.</strong> ${isPassed(it) ? 'Compare it with yours.' : 'Try it yourself first; reading it is fine too.'}
        ${files.map(([f, text], j) => `${f ? `<div class="ide-solfile">${esc(f)}</div>` : ''}<pre><code class="language-python">${esc(text)}</code></pre>
        <button class="ide-ghost" type="button" data-use="${j}">${f ? `Put this in ${esc(f)}` : 'Put this in the editor'}</button>`).join('')}`;
      h.querySelectorAll('code').forEach(c => window.hljs && window.hljs.highlightElement(c));
      h.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', () => {
        const [f, text] = files[+b.dataset.use];
        if (f) { keep(); S.files[f] = text; save(); openTab(f); }
        else setEditor(text), keep(), save();
        ed.focus();
      }));
    });
    let resetArmed = false;
    $('lab-reset').addEventListener('click', e => {
      const label = project ? 'Reset file' : 'Reset step';
      if (!resetArmed) { resetArmed = true; e.target.textContent = 'Click again to reset'; setTimeout(() => { resetArmed = false; e.target.textContent = label; }, 2500); return; }
      resetArmed = false; e.target.textContent = label;
      const it = items[S.cur];
      if (project) {
        const snap = S.snap[keyOf(it)] || lab.files;
        S.files[S.tab] = snap[S.tab] ?? lab.files[S.tab] ?? '';
        setEditor(S.files[S.tab]);
      } else setEditor(it.starter);
      keep(); save(); ed.focus();
    });

    if (location.hash === '#exercises' && NE && labDone()) {
      const first = exercises.findIndex(x => !isPassed(x));
      S.cur = N + (first < 0 ? 0 : first);
    }
    show(S.cur);
    if (labDone()) complete(false);
  };
})();
