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

  // Number every lesson inside its track. ML lessons count up across parts (00, 01, …);
  // sections with a label count within the section (B1, B2, … I1, …). Projects are not numbered.
  function catalog(data) {
    const tracks = data.tracks || [{ id: 'ml', title: 'Learning path', short: 'Learning path', sections: [{ id: 'all', title: '' }] }];
    tracks.forEach((t, ti) => {
      let n = 0;
      t.index = ti;
      t.sections.forEach((sec, si) => {
        let k = 0;
        sec.track = t; sec.index = si;
        sec.items = data.lessons.filter(l => (l.track || tracks[0].id) === t.id && (l.section || t.sections[0].id) === sec.id);
        sec.items.forEach(l => {
          l.trackObj = t; l.sectionObj = sec;
          if (l.kind === 'project') { l.num = ''; l.label = 'Project'; }
          else if (sec.label) { l.num = sec.label + (++k); l.label = l.num; }
          else { l.num = String(n).padStart(2, '0'); l.label = `Lesson ${n++}`; }
        });
      });
      t.items = t.sections.flatMap(s => s.items);
      t.ready = t.items.filter(l => !l.soon);
    });
    return tracks;
  }
  const sectionName = sec => sec.level ? `${sec.level}: ${sec.title}` : `Part ${sec.index + 1}: ${sec.title}`;

  function chips(l) {
    const c = [];
    if (l.soon) return '';
    if (l.film) c.push('<span class="chip film">Film</span>');
    if (l.doc) c.push('<span class="chip math">' + (l.trackObj && l.trackObj.id === 'agents' ? 'Notes' : 'Math') + '</span>');
    if (l.code && l.code.length) c.push('<span class="chip code">Code</span>');
    if (l.lab) c.push(`<span class="chip code">${l.kind === 'project' ? 'Guided project' : 'Hands-on coding'}</span>`);
    if (l.exercises) c.push(`<span class="chip ex">${l.exercises} exercises</span>`);
    if (l.videos && l.videos.length) c.push(`<span class="chip video">${l.videos.length} video${l.videos.length > 1 ? 's' : ''}</span>`);
    return `<div class="chips">${c.join('')}</div>`;
  }

  // ── home page ──
  function stop(l, done) {
    const cls = ['stop', done[l.slug] ? 'done' : '', l.soon ? 'soon' : '', l.kind === 'project' ? 'project' : ''].filter(Boolean).join(' ');
    const title = l.soon ? esc(l.title) : `<a href="lesson.html?l=${encodeURIComponent(l.slug)}">${esc(l.title)}</a>`;
    return `<li class="${cls}">
      <div class="n">${l.kind === 'project' ? '<span class="proj-mark" aria-hidden="true">◆</span>' : esc(l.num)}</div>
      <div>
        <h3>${title}</h3>
        <p>${esc(l.summary)}</p>
        ${chips(l)}
      </div>
      <div class="meta">${l.soon ? 'Coming soon' : l.minutes ? `${l.minutes} min` : ''}</div>
    </li>`;
  }

  async function renderHome() {
    const host = document.getElementById('path');
    if (!host) return;
    try {
      const data = await loadLessons();
      const tracks = catalog(data);
      const done = progress.all();
      const count = items => { const ready = items.filter(l => !l.soon); return { n: ready.filter(l => done[l.slug]).length, of: ready.length, planned: items.length }; };
      const pick = () => {
        const want = location.hash.slice(1) || store.get('track', tracks[0].id);
        return tracks.find(t => t.id === want) || tracks[0];
      };
      const draw = () => {
        const cur = pick();
        document.getElementById('tracks').innerHTML = tracks.map(t => {
          const c = count(t.items);
          const pct = c.of ? Math.round(100 * c.n / c.of) : 0;
          return `<button type="button" role="tab" class="track-card" data-track="${t.id}" aria-selected="${t === cur}">
            <span class="eyebrow">Track ${t.index + 1}</span>
            <strong>${esc(t.title)}</strong>
            <span class="tagline">${esc(t.tagline || '')}</span>
            <span class="bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
            <span class="count">${c.of ? `${c.n} of ${c.of} done` : 'Starting soon'} · ${c.planned} planned</span>
          </button>`;
        }).join('');
        host.innerHTML = `
          <p class="track-summary">${esc(cur.summary || '')}</p>
          ${cur.sections.map(sec => {
            const c = count(sec.items);
            return `<section class="part" aria-labelledby="part-${cur.id}-${sec.id}">
              <div class="section-head">
                <div>
                  <div class="eyebrow">${esc(sec.level || `Part ${sec.index + 1}`)}</div>
                  <h2 id="part-${cur.id}-${sec.id}">${esc(sec.title)}</h2>
                  ${sec.summary ? `<p class="part-sum">${esc(sec.summary)}</p>` : ''}
                </div>
                <span class="progress-note">${c.of ? `${c.n} of ${c.of} done` : 'Coming soon'}</span>
              </div>
              <ol class="path">${sec.items.map(l => stop(l, done)).join('')}</ol>
            </section>`;
          }).join('')}`;
      };
      document.getElementById('tracks').addEventListener('click', e => {
        const b = e.target.closest('[data-track]');
        if (!b) return;
        store.set('track', b.dataset.track);
        history.replaceState(null, '', '#' + b.dataset.track);
        draw();
      });
      addEventListener('hashchange', draw);
      draw();
    } catch (err) {
      host.innerHTML = `<p class="error">${esc(err.message)}. If you opened this file directly, run a local server instead (see README).</p>`;
    }
  }

  // ── films page ──
  async function renderFilms() {
    const host = document.getElementById('films');
    if (!host) return;
    try {
      const tracks = catalog(await loadLessons());
      host.innerHTML = tracks.map(t => {
        const films = t.items.filter(l => l.film && !l.soon);
        return `<section class="film-track">
          <div class="eyebrow">Track ${t.index + 1}</div>
          <h2>${esc(t.title)}</h2>
          ${films.length ? `<div class="film-list">${films.map(l => `
            <div class="film-item">
              <a class="film-card" href="films/${esc(l.film.file)}">
                <div class="poster">${esc(l.film.title)}</div>
                <div>
                  <h3>${esc(l.film.title)}</h3>
                  <p>${esc(l.label)} · ${esc((l.film.note || '').split(',')[0])} · ${esc(l.film.blurb || l.summary)}</p>
                </div>
              </a>
              ${l.film.video ? `<p class="film-dl"><a href="${esc(l.film.video)}" download>Download the video (MP4, 720p)</a></p>` : ''}
            </div>`).join('')}</div>` : '<p class="film-empty">Films arrive with each lesson in this track.</p>'}
        </section>`;
      }).join('');
    } catch (err) {
      host.innerHTML = `<p class="error">${esc(err.message)}.</p>`;
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
      catalog(data);
      const l = data.lessons.find(x => x.slug === slug);
      if (!l) throw new Error(`No lesson called "${slug || ''}"`);
      const ready = l.trackObj.ready, at = ready.indexOf(l);
      const prev = at > 0 ? ready[at - 1] : null, next = at >= 0 ? ready[at + 1] : null;
      document.title = `${l.title} · Learning AI My Way`;
      const crumbs = `<a href="./#${l.trackObj.id}">${esc(l.trackObj.short || l.trackObj.title)}</a> / ${esc(sectionName(l.sectionObj))} / ${esc(l.label)}`;
      if (l.soon) {
        host.innerHTML = `
          <header class="lesson-head">
            <div class="crumbs">${crumbs}</div>
            <h1>${esc(l.title)}</h1>
            <p class="lede">${esc(l.summary)}</p>
          </header>
          <div class="soon-note"><strong>This ${l.kind === 'project' ? 'project' : 'lesson'} is being written.</strong> It will have the same parts as every lesson: a film, the notes, a guided coding lab and exercises. Your progress on other lessons is kept.</div>
          <div class="lesson-end">
            <nav class="pager" aria-label="Lessons">
              <a class="prev" href="./#${l.trackObj.id}"><span>← Back</span><strong>${esc(l.trackObj.title)}</strong></a>
            </nav>
          </div>
          <section class="discuss" id="discuss" hidden>
            <h2>Questions and feedback</h2>
            <p>Is there something you would like this ${l.kind === 'project' ? 'project' : 'lesson'} to cover? Leave a comment below. You sign in with GitHub, and every comment is saved as a public discussion on the project.</p>
            <div id="giscus"></div>
          </section>`;
        loadDiscussion(l, null);
        return;
      }

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
          <div class="crumbs">${crumbs}</div>
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
      if (l.lab && l.exercises) toc.insertAdjacentHTML('beforeend', '<li><a href="#exercises">Exercises</a></li>');
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
      if (location.hash === '#build' || location.hash === '#exercises') document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } catch (err) {
      host.innerHTML = `<p class="error">${esc(err.message)}. Try reloading the page.</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => { renderHome(); renderFilms(); renderLesson(); });
})();
