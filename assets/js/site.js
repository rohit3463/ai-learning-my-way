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
  });
  document.addEventListener('DOMContentLoaded', syncThemeBtn);

  // ── progress ──
  const progress = {
    all() { return store.get('done', {}); },
    has(slug) { return !!this.all()[slug]; },
    toggle(slug) { const d = this.all(); d[slug] ? delete d[slug] : d[slug] = Date.now(); store.set('done', d); return !!d[slug]; },
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
          <div class="n">${String(i + 1).padStart(2, '0')}</div>
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

      const film = l.film ? `
        <div class="film-frame"><iframe src="films/${esc(l.film.file)}${l.film.start ? '?t=' + l.film.start : ''}" title="${esc(l.film.title)}" loading="lazy" allow="fullscreen"></iframe></div>
        <div class="film-caption"><span>Film: <em>${esc(l.film.title)}</em>${l.film.note ? ' · ' + esc(l.film.note) : ''}</span><a href="films/${esc(l.film.file)}${l.film.start ? '?t=' + l.film.start : ''}">Open full screen ↗</a></div>` : '';

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
          <div class="crumbs"><a href="./">Learning path</a> / Lesson ${idx + 1} of ${data.lessons.length}</div>
          <h1>${esc(l.title)}</h1>
          <p class="lede">${esc(l.summary)}</p>
          <div class="lesson-meta"><span>${l.minutes} min</span>${chips(l)}</div>
        </header>
        ${film}
        <div class="layout">
          <article class="prose" id="prose">${body}${videos}${code}
            <div class="done-row">
              <button class="btn" id="done" type="button" aria-pressed="${progress.has(l.slug)}">${progress.has(l.slug) ? '✓ Marked as done' : 'Mark as done'}</button>
              <span class="progress-note">Saved in this browser only.</span>
            </div>
            <nav class="pager" aria-label="Lessons">
              ${prev ? `<a class="prev" href="lesson.html?l=${prev.slug}"><span>← Previous</span><strong>${esc(prev.title)}</strong></a>` : ''}
              ${next ? `<a class="next" href="lesson.html?l=${next.slug}"><span>Next →</span><strong>${esc(next.title)}</strong></a>` : ''}
            </nav>
          </article>
          <aside class="toc" aria-label="On this page"><div class="eyebrow">On this page</div><ol id="toc"></ol></aside>
        </div>`;

      const prose = document.getElementById('prose');
      prose.querySelectorAll('table').forEach(t => { const w = document.createElement('div'); w.className = 'table-scroll'; t.before(w); w.appendChild(t); });
      const toc = document.getElementById('toc');
      prose.querySelectorAll('h2').forEach(h => {
        if (!h.id) h.id = slugify(h.textContent);
        toc.insertAdjacentHTML('beforeend', `<li><a href="#${h.id}">${esc(h.textContent)}</a></li>`);
      });
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
      document.getElementById('done').addEventListener('click', e => {
        const on = progress.toggle(l.slug);
        e.currentTarget.setAttribute('aria-pressed', on);
        e.currentTarget.textContent = on ? '✓ Marked as done' : 'Mark as done';
      });
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } catch (err) {
      host.innerHTML = `<div class="error"><h1>Lesson not found</h1><p>${esc(err.message)}. <a href="./">Back to the learning path</a>.</p></div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => { renderHome(); renderLesson(); });
})();
