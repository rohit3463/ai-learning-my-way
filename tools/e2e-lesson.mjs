// End-to-end check of one lesson in headless Chrome: run every lab step's solution, then sweep the film for errors.
// usage: node tools/e2e-lesson.mjs <slug>   (with the site served on http://localhost:8766)
import puppeteer from 'puppeteer-core';
const slug = process.argv[2], BASE = process.env.FILM_BASE || 'http://localhost:8766';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 1000 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/lesson.html?l=${slug}&x=${Date.now()}`, { waitUntil: 'networkidle2' });
await p.evaluate(s => localStorage.removeItem('lab:' + s), slug);
await p.waitForSelector('.ide-editor .CodeMirror', { timeout: 30000 });
console.log(await p.evaluate(() => `${document.querySelector('.crumbs').textContent} | katex ${document.querySelectorAll('.prose .katex').length}`));
const n = await p.evaluate(s => window.LABS[s].steps.length, slug);
let pass = 0;
for (let i = 0; i < n; i++) {
  const t0 = Date.now();
  await p.evaluate((s, i) => { document.querySelector('.ide-editor .CodeMirror').CodeMirror.setValue(window.LABS[s].steps[i].solution); document.getElementById('lab-run').click(); }, slug, i);
  await p.waitForFunction(() => /passed|All tests pass|✗|Line|Stopped|could not/.test(document.getElementById('lab-console').textContent), { timeout: 240000 });
  const txt = await p.evaluate(() => document.getElementById('lab-console').textContent.replace(/\s+/g, ' '));
  const ok = /passed|All tests pass/.test(txt); if (ok) pass++;
  console.log(`step ${i + 1}: ${ok ? 'pass' : 'FAIL ' + txt.slice(0, 220)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  await p.evaluate(() => document.querySelector('.ide-next')?.click());
}
console.log(`lab ${pass}/${n} | done: ${await p.evaluate(() => document.getElementById('done').textContent)} | page errors: ${errs.length}`);
await p.goto(`${BASE}/films/${slug}.html?x=${Date.now()}`, { waitUntil: 'networkidle2' });
const fe = await p.evaluate(async () => { const m = []; console.error = (...a) => m.push(String(a[0] && a[0].stack || a[0]).split('\n')[0]); window.addEventListener('error', e => m.push(e.message));
  const s = document.getElementById('scrub'); for (let t = 0; t <= +s.max; t += .25) { s.value = t; s.dispatchEvent(new Event('input')); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); } return m; });
console.log('film sweep errors:', fe.length, fe.slice(0, 2).join(' / '));
await b.close();
