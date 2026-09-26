// Learning AI My Way — step-by-step coding lab.
// window.startLab(host, { slug, lab, renderMath, onComplete }) renders an IDE-like panel where the
// learner writes one small piece of code per step, runs its tests in Python (Pyodide, in a worker),
// and unlocks the next step. Passing the last step calls onComplete().
(() => {
  const CM = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/';
  const WORKER_URL = 'assets/js/py-worker.js?v=1';
  const TIMEOUT_MS = 8000;

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
        else if (m.type === 'result' && this.pending && m.id === this.pending.id) this.finish(m.result);
      };
      w.onerror = e => { this.onStatus('error', e.message || 'Python could not start.'); this.finish({ fatal: e.message || 'Python could not start.' }); };
    }
    arm() {
      clearTimeout(this.pending.timer);
      this.pending.timer = setTimeout(() => {
        this.worker.terminate(); this.worker = null; this.ready = false;
        this.finish({ timeout: true });
        this.start();
      }, TIMEOUT_MS);
    }
    finish(result) {
      if (!this.pending) return;
      const p = this.pending; this.pending = null; clearTimeout(p.timer); p.resolve(result);
    }
    run(src, tests) {
      this.start();
      return new Promise(resolve => {
        const id = ++this.seq;
        this.pending = { id, resolve, timer: null };
        this.worker.postMessage({ id, src, tests });
        if (this.ready) this.arm();
      });
    }
  }

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  window.startLab = async function (host, { slug, lab, renderMath, onComplete }) {
    const KEY = 'lab:' + slug;
    const S = Object.assign({ code: {}, passed: {}, cur: 0 }, store.get(KEY) || {});
    const steps = lab.steps, N = steps.length;
    const save = () => store.set(KEY, S);
    const codeOf = s => S.code[s.id] ?? s.starter;
    const unlocked = i => steps.slice(0, i).every(s => S.passed[s.id]);
    const allPassed = () => steps.every(s => S.passed[s.id]);
    if (!unlocked(S.cur)) S.cur = 0;

    host.innerHTML = `
      <div class="lab-head">
        <div class="eyebrow">Build it yourself</div>
        <h2 id="build">${esc(lab.title)}</h2>
        <p>${lab.intro}</p>
      </div>
      <div class="ide">
        <div class="ide-top">
          <span class="ide-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="ide-file">${esc(lab.file)}</span>
          <span class="ide-count" id="lab-count"></span>
          <span class="ide-status" id="lab-status">Python not started</span>
        </div>
        <div class="ide-body">
          <ol class="ide-steps" id="lab-steps"></ol>
          <div class="ide-main">
            <div class="ide-brief" id="lab-brief"></div>
            <div class="ide-prev" id="lab-prev-wrap">
              <div class="ide-prev-label" id="lab-prev-label"></div>
              <div id="lab-prev"></div>
            </div>
            <div class="ide-editor" id="lab-editor"><p class="ide-loading">Loading the editor…</p></div>
            <div class="ide-bar">
              <button class="ide-run" id="lab-run" type="button">▶ Run tests</button>
              <span class="ide-kbd">Ctrl / ⌘ + Enter</span>
              <span class="ide-spacer"></span>
              <button class="ide-ghost" id="lab-hint" type="button">Hint</button>
              <button class="ide-ghost" id="lab-sol" type="button">Show solution</button>
              <button class="ide-ghost" id="lab-reset" type="button">Reset step</button>
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
      statusEl.textContent = state === 'loading' ? 'Starting Python…' : state === 'ready' ? 'Python ready' : 'Python failed to start';
      if (state === 'error' && err) statusEl.title = err;
    });
    // Warm up Python once the lab scrolls into view, so the first run is quick.
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { runner.start(); io.disconnect(); } }, { rootMargin: '400px' });
    io.observe(host);

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
    let saveTimer = null;
    ed.on('change', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { S.code[steps[S.cur].id] = ed.getValue(); save(); }, 300);
    });

    function prevCode(i) { return steps.slice(0, i).map(codeOf).join('\n\n'); }

    function renderSteps() {
      $('lab-steps').innerHTML = steps.map((s, i) => {
        const state = S.passed[s.id] ? 'passed' : unlocked(i) ? 'open' : 'locked';
        return `<li><button type="button" data-i="${i}" class="${state}${i === S.cur ? ' current' : ''}" ${state === 'locked' ? 'disabled' : ''}>
          <span class="n">${state === 'passed' ? '✓' : i + 1}</span><span class="t">${esc(s.title)}</span></button></li>`;
      }).join('');
      const done = steps.filter(s => S.passed[s.id]).length;
      $('lab-count').textContent = `${done} / ${N} steps`;
    }

    function show(i) {
      S.cur = i; save();
      const s = steps[i], prev = prevCode(i);
      $('lab-brief').innerHTML = `<div class="ide-step">Step ${i + 1} of ${N}</div><h3>${esc(s.title)}</h3>${s.brief}`;
      if (renderMath) renderMath($('lab-brief'));
      $('lab-prev-wrap').hidden = !prev;
      const prevLines = prev ? prev.split('\n').length : 0;
      $('lab-prev-label').textContent = prev ? `Lines 1–${prevLines} · written in earlier steps (read only)` : '';
      prevCM.setValue(prev);
      ed.setOption('firstLineNumber', prev ? prevLines + 2 : 1);
      ed.setValue(codeOf(s));
      ed.clearHistory();
      $('lab-help').hidden = true; $('lab-help').innerHTML = '';
      $('lab-console').innerHTML = S.passed[s.id]
        ? `<div class="ok">✓ You passed this step. Run it again any time, or go on to the next one.</div>${nextButton(i)}`
        : `<div class="muted">Write your code above, then run the tests.</div>`;
      $('lab-console').querySelector('.ide-next')?.addEventListener('click', () => show(i + 1));
      renderSteps();
      setTimeout(() => { prevCM.refresh(); ed.refresh(); prevCM.scrollTo(null, 1e6); }, 0);
    }

    function nextButton(i) {
      return i + 1 < N ? `<button class="ide-next" type="button">Next: ${esc(steps[i + 1].title)} →</button>` : '';
    }

    let running = false;
    async function run() {
      if (running) return;
      running = true;
      const i = S.cur, s = steps[i], prev = prevCode(i), code = ed.getValue();
      S.code[s.id] = code; save();
      const offset = prev ? prev.split('\n').length + 1 : 0;
      const con = $('lab-console'), btn = $('lab-run');
      btn.disabled = true;
      con.innerHTML = `<div class="muted">${runner.ready ? 'Running the tests…' : 'Starting Python (the first run takes a few seconds)…'}</div>`;
      const r = await runner.run(prev ? prev + '\n\n' + code : code, s.tests);
      btn.disabled = false; running = false;
      let html = '';
      let passed = false;
      if (r.timeout) html = `<div class="bad">Stopped after ${TIMEOUT_MS / 1000} seconds. Is there a loop that never ends?</div>`;
      else if (r.fatal) html = `<div class="bad">Python could not run: ${esc(r.fatal)}</div>`;
      else {
        if (r.stdout) html += `<pre class="out">${esc(r.stdout)}</pre>`;
        if (r.stage === 'code') {
          const e = r.error, line = e.line;
          const where = line == null ? '' : line > offset ? `Line ${line}: ` : `Line ${line}, in code from an earlier step: `;
          html += `<div class="bad">${esc(where)}${esc(e.type)}: ${esc(e.msg)}</div>`;
          if (e.type === 'SyntaxError' || e.type === 'IndentationError') html += `<div class="muted">Check brackets, colons and indentation (4 spaces per level).</div>`;
        } else {
          html += r.tests.map(t => t.ok
            ? `<div class="ok">✓ ${esc(t.name)}</div>`
            : `<div class="bad">✗ ${esc(t.name)}<span>${esc(t.msg)}</span></div>`).join('');
          passed = r.tests.every(t => t.ok);
        }
      }
      const was = !!S.passed[s.id];
      S.passed[s.id] = passed;
      save();
      if (passed) html += `<div class="win">${i + 1 < N ? 'Step passed.' : 'All tests pass. Your linear regression works.'}</div>${nextButton(i)}`;
      con.innerHTML = html;
      con.querySelector('.ide-next')?.addEventListener('click', () => show(i + 1));
      renderSteps();
      if (passed && allPassed()) complete(!was);
    }

    function complete(fresh) {
      const full = steps.map(codeOf).join('\n\n') + '\n';
      const box = $('lab-done');
      box.hidden = false;
      box.innerHTML = `
        <div class="lab-done-head">
          <div><div class="eyebrow">Lesson complete</div><h3>You wrote linear regression from scratch.</h3>
          <p>Every line below is yours: data, predictions, errors, loss, gradients, and the training loop. The lesson is marked as done.</p></div>
          <div class="lab-done-actions"><button class="btn" type="button" id="lab-copy">Copy code</button><a class="btn" id="lab-dl" download="${esc(lab.file)}">Download ${esc(lab.file)}</a></div>
        </div>
        <pre><code class="language-python">${esc(full)}</code></pre>`;
      if (window.hljs) window.hljs.highlightElement(box.querySelector('code'));
      $('lab-dl').href = URL.createObjectURL(new Blob([full], { type: 'text/x-python' }));
      $('lab-copy').addEventListener('click', async e => {
        try { await navigator.clipboard.writeText(full); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Select the code below to copy'; }
      });
      if (onComplete) onComplete();
      if (fresh) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    $('lab-steps').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b && !b.disabled) show(+b.dataset.i); });
    $('lab-run').addEventListener('click', run);
    $('lab-hint').addEventListener('click', () => {
      const h = $('lab-help'), s = steps[S.cur];
      const open = !h.hidden && h.dataset.kind === 'hint';
      h.hidden = open; h.dataset.kind = 'hint';
      h.innerHTML = `<strong>Hint.</strong> ${s.hint}`;
    });
    $('lab-sol').addEventListener('click', () => {
      const h = $('lab-help'), s = steps[S.cur];
      const open = !h.hidden && h.dataset.kind === 'sol';
      h.hidden = open; h.dataset.kind = 'sol';
      h.innerHTML = `<strong>One possible solution.</strong> Try it yourself first; reading it is fine too.
        <pre><code class="language-python">${esc(s.solution)}</code></pre>
        <button class="ide-ghost" type="button" id="lab-use">Put this in the editor</button>`;
      if (window.hljs) window.hljs.highlightElement(h.querySelector('code'));
      $('lab-use').addEventListener('click', () => { ed.setValue(s.solution); ed.focus(); });
    });
    let resetArmed = false;
    $('lab-reset').addEventListener('click', e => {
      if (!resetArmed) { resetArmed = true; e.target.textContent = 'Click again to reset'; setTimeout(() => { resetArmed = false; e.target.textContent = 'Reset step'; }, 2500); return; }
      resetArmed = false; e.target.textContent = 'Reset step';
      ed.setValue(steps[S.cur].starter); ed.focus();
    });

    show(S.cur);
    if (allPassed()) complete(false);
  };
})();
