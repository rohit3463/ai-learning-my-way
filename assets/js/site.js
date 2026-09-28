// Learning AI My Way — shared site logic: theme, progress, lesson rendering.
(() => {
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  // ── theme ──
  const root = document.documentElement;
  const saved = store.get('theme', null);
  if (saved) root.dataset.theme = saved;
  function currentTheme() {
    return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function syncThemeBtn() {
    const b = document.getElementById('theme');
    if (b) b.textContent = currentTheme() === 'dark' ? 'Light mode' : 'Dark mode';
  }
  document.addEventListener('click', e => {
    if (e.target.id !== 'theme') return;
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next; store.set('theme', next); syncThemeBtn();
    const g = document.querySelector('iframe.giscus-frame');
    if (g) g.contentWindow.postMessage({ giscus: { setConfig: { theme: giscusTheme() } } }, 'https://giscus.app');
  });
  const giscusTheme = () => currentTheme() === 'dark' ? 'transparent_dark' : 'light';
  document.addEventListener('DOMContentLoaded', syncThemeBtn);

  // ── progress ──
  const progress = {
    all() { return store.get('done', {}); },
    has(slug) { return !!this.all()[slug]; },
    toggle(slug) { const d = this.all(); d[slug] ? delete d[slug] : d[slug] = Date.now(); store.set('done', d); return !!d[slug]; },
    mark(slug) { const d = this.all(); if (!d[slug]) { d[slug] = Date.now(); store.set('done', d); } },
  };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function loadLessons() {
    const r = await fetch('content/lessons.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('Could not load content/lessons.json');
    return r.json();
  }

  function chips(l) {
    const c = [];
    if (l.film) c.push('<span class="chip film">Film</span>');
    if (l.doc) c.push('<span class="chip math">Math</span>');
    if (l.code && l.code.length) c.push('<span class="chip code">Code</span>');
    if (l.lab) c.push('<span class="chip code">Hands-on coding</span>');
    if (l.videos && l.videos.length) c.push(`<span class="chip video">${l.videos.length} video${l.videos.length > 1 ? 's' : ''}</span>`);
    return `<div class="chips">${c.join('')}</div>`;
  }

  // ── home page ──
  async function renderHome() {
    const list = document.getElementById('path');
    if (!list) return;
    try {
      const data = await loadLessons();
      const done = progress.all();
      list.innerHTML = data.lessons.map((l, i) => `
        <li class="stop${done[l.slug] ? ' done' : ''}">
          <div class="n">${String(i).padStart(2, '0')}</div>
          <div>
            <h3><a href="lesson.html?l=${encodeURIComponent(l.slug)}">${esc(l.title)}</a></h3>
            <p>${esc(l.summary)}</p>
            ${chips(l)}
          </div>
          <div class="meta">${l.minutes} min</div>
        </li>`).join('');
      const n = data.lessons.filter(l => done[l.slug]).length;
      const note = document.getElementById('progress-note');
      if (note) note.textContent = `${n} of ${data.lessons.length} done`;
    } catch (err) {
      list.innerHTML = `<li class="error">${esc(err.message)}. If you opened this file directly, run a local server instead (see README).</li>`;
    }
  }

  // ── math ──
  // Lesson notes are plain HTML. KaTeX's auto-render turns \( ... \) and \[ ... \] into typeset math.
  function renderMath(scope) {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(scope, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
    });
  }

  function slugify(s) { return s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function enhanceCode(scope) {
    scope.querySelectorAll('pre > code').forEach(code => {
      if (window.hljs) window.hljs.highlightElement(code);
      const pre = code.parentElement;
      if (pre.querySelector('.copy')) return;
      const b = document.createElement('button');
      b.className = 'copy'; b.type = 'button'; b.textContent = 'Copy';
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(code.innerText); b.textContent = 'Copied'; }
        catch { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected'; }
        setTimeout(() => b.textContent = 'Copy', 1600);
      });
      pre.appendChild(b);
    });
  }

  function videoCard(v) {
    return `<div class="video">
      <button class="yt" type="button" data-id="${esc(v.id)}" aria-label="Play ${esc(v.title)}">
        <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy">
        <span>▶ Play</span>
      </button>
      <h4>${esc(v.title)}</h4>
      <p>${esc(v.channel)}${v.why ? ' · ' + esc(v.why) : ''}</p>
    </div>`;
  }

  // ── lesson page ──
  async function renderLesson() {
    const host = document.getElementById('lesson');
    if (!host) return;
    const slug = new URLSearchParams(location.search).get('l');
    try {
      const data = await loadLessons();
      const idx = data.lessons.findIndex(l => l.slug === slug);
      if (idx < 0) throw new Error(`No lesson called "${slug || ''}"`);
      const l = data.lessons[idx], prev = data.lessons[idx - 1], next = data.lessons[idx + 1];
      document.title = `${l.title} · Learning AI My Way`;

      // A lesson's written notes are optional: set "doc": true in lessons.json once content/lessons/<slug>.html exists.
      const body = l.doc ? await fetch(`content/lessons/${l.slug}.html`, { cache: 'no-cache' }).then(r => {
        if (!r.ok) throw new Error(`Missing content/lessons/${l.slug}.html`); return r.text();
      }) : '';

      const filmSrc = l.film ? `films/${l.film.file}${l.film.start ? (l.film.file.includes('?') ? '&' : '?') + 't=' + l.film.start : ''}` : '';
      const film = l.film ? `
        <div class="film-frame"><iframe src="${esc(filmSrc)}" title="${esc(l.film.title)}" loading="lazy" allow="fullscreen"></iframe></div>
        <div class="film-caption"><span>Film: <em>${esc(l.film.title)}</em>${l.film.note ? ' · ' + esc(l.film.note) : ''}</span><span class="film-links">${l.film.video ? `<a href="${esc(l.film.video)}" download>Download video (MP4)</a> · ` : ''}<a href="${esc(filmSrc)}">Open full screen ↗</a></span></div>` : '';

      const videos = (l.videos || []).length ? `<h2 id="watch">Watch</h2><div class="videos">${l.videos.map(videoCard).join('')}</div>` : '';
      const code = (l.code || []).length ? `<h2 id="code">Code</h2>
        <p>Plain Python and numpy, no frameworks, so every line of the math is visible. Run with <code>pip install numpy</code>, then <code>python code/&lt;file&gt;</code>.</p>
        <div class="code-files">${l.code.map(c => `
          <details class="code-file" data-src="code/${esc(c.file)}">
            <summary><code>code/${esc(c.file)}</code><span>${esc(c.about)}</span></summary>
            <pre><code class="language-python">Loading…</code></pre>
          </details>`).join('')}</div>` : '';

      host.innerHTML = `
        <header class="lesson-head">
          <div class="crumbs"><a href="./">Learning path</a> / Lesson ${idx}</div>
          <h1>${esc(l.title)}</h1>
          <p class="lede">${esc(l.summary)}</p>
          <div class="lesson-meta"><span>${l.minutes} min</span>${chips(l)}</div>
        </header>
        ${film}
        <div class="layout">
          <article class="prose" id="prose">${body}${videos}${code}</article>
          <aside class="toc" aria-label="On this page"><div class="eyebrow">On this page</div><ol id="toc"></ol></aside>
        </div>
        ${l.lab ? '<section class="lab" id="lab"><p class="loading">Loading the coding lab…</p></section>' : ''}
        <div class="lesson-end">
          <div class="done-row">
            <button class="btn" id="done" type="button" aria-pressed="${progress.has(l.slug)}">${progress.has(l.slug) ? '✓ Marked as done' : 'Mark as done'}</button>
            <span class="progress-note">${l.lab ? 'Finishing the coding lab marks this lesson as done. ' : ''}Saved in this browser only.</span>
          </div>
          <nav class="pager" aria-label="Lessons">
            ${prev ? `<a class="prev" href="lesson.html?l=${prev.slug}"><span>← Previous</span><strong>${esc(prev.title)}</strong></a>` : ''}
            ${next ? `<a class="next" href="lesson.html?l=${next.slug}"><span>Next →</span><strong>${esc(next.title)}</strong></a>` : ''}
          </nav>
        </div>
        <section class="discuss" id="discuss" hidden>
          <h2>Questions and feedback</h2>
          <p>Stuck on a step, spotted a mistake, or have an idea for this lesson? Leave a comment or a reaction below. You sign in with GitHub, and every comment is saved as a public discussion on the project.</p>
          <div id="giscus"></div>
        </section>`;

      const prose = document.getElementById('prose');
      prose.querySelectorAll('table').forEach(t => { const w = document.createElement('div'); w.className = 'table-scroll'; t.before(w); w.appendChild(t); });
      const toc = document.getElementById('toc');
      prose.querySelectorAll('h2').forEach(h => {
        if (!h.id) h.id = slugify(h.textContent);
        toc.insertAdjacentHTML('beforeend', `<li><a href="#${h.id}">${esc(h.textContent)}</a></li>`);
      });
      if (l.lab) toc.insertAdjacentHTML('beforeend', '<li><a href="#build">Build it yourself</a></li>');
      if (!toc.children.length) toc.closest('.toc').remove();
      renderMath(prose);
      enhanceCode(prose);

      prose.addEventListener('click', e => {
        const yt = e.target.closest('.yt');
        if (!yt) return;
        const f = document.createElement('iframe');
        f.src = `https://www.youtube-nocookie.com/embed/${yt.dataset.id}?autoplay=1&rel=0`;
        f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
        f.title = yt.getAttribute('aria-label');
        yt.replaceWith(f);
      });
      prose.querySelectorAll('details.code-file').forEach(d => d.addEventListener('toggle', async () => {
        if (!d.open || d.dataset.loaded) return;
        d.dataset.loaded = '1';
        const codeEl = d.querySelector('code.language-python');
        try {
          const r = await fetch(d.dataset.src); if (!r.ok) throw new Error();
          codeEl.textContent = await r.text();
        } catch { codeEl.textContent = `# Could not load ${d.dataset.src}`; }
        enhanceCode(d);
      }));
      const doneBtn = document.getElementById('done');
      const syncDone = () => {
        const on = progress.has(l.slug);
        doneBtn.setAttribute('aria-pressed', on);
        doneBtn.textContent = on ? '✓ Marked as done' : 'Mark as done';
      };
      doneBtn.addEventListener('click', () => { progress.toggle(l.slug); syncDone(); });
      if (l.lab) loadLab(l, () => { progress.mark(l.slug); syncDone(); });
      loadDiscussion(l, toc);
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } catch (err) {
      host.innerHTML = `<div class="error"><h1>Lesson not found</h1><p>${esc(err.message)}. <a href="./">Back to the learning path</a>.</p></div>`;
    }
  }

  // One GitHub Discussion per lesson, through giscus. Stays hidden until content/giscus.json has its IDs.
  async function loadDiscussion(l, toc) {
    let cfg;
    try { cfg = await fetch('content/giscus.json', { cache: 'no-cache' }).then(r => r.json()); } catch { return; }
    if (!cfg.repoId || !cfg.categoryId) return;
    document.getElementById('discuss').hidden = false;
    toc?.insertAdjacentHTML('beforeend', '<li><a href="#discuss">Questions and feedback</a></li>');
    const s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    Object.entries({
      repo: cfg.repo, 'repo-id': cfg.repoId, category: cfg.category, 'category-id': cfg.categoryId,
      mapping: 'specific', term: `${l.title} (${l.slug})`, strict: '1',
      'reactions-enabled': '1', 'emit-metadata': '0', 'input-position': 'top',
      theme: giscusTheme(), lang: 'en', loading: 'lazy',
    }).forEach(([k, v]) => s.setAttribute('data-' + k, v));
    s.crossOrigin = 'anonymous'; s.async = true;
    document.getElementById('giscus').appendChild(s);
  }

  async function loadLab(l, onComplete) {
    const host = document.getElementById('lab');
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = `content/labs/${l.lab}.js?v=${l.labVersion || 1}`;
        s.onload = res; s.onerror = () => rej(new Error(`Missing content/labs/${l.lab}.js`));
        document.head.appendChild(s);
      });
      const lab = window.LABS && window.LABS[l.lab];
      if (!lab || !window.startLab) throw new Error('The coding lab could not start');
      await window.startLab(host, { slug: l.slug, lab, renderMath, onComplete });
      if (location.hash === '#build') document.getElementById('build')?.scrollIntoView();
    } catch (err) {
      host.innerHTML = `<p class="error">${esc(err.message)}. Try reloading the page.</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => { renderHome(); renderLesson(); });
})();
