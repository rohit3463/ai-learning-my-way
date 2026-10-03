// End-to-end check of one lesson in headless Chrome: run every lab step's and exercise's solution
// through the real page, check the exercise locks, then sweep the film for errors.
// usage: node tools/e2e-lesson.mjs <slug>            (with the site served on http://localhost:8766)
//        node tools/e2e-lesson.mjs --bench <lab>     (a lab on the test bench, tools/fixtures/lab.html)
import puppeteer from 'puppeteer-core';
const bench = process.argv[2] === '--bench';
const slug = bench ? process.argv[3] : process.argv[2], BASE = process.env.FILM_BASE || 'http://localhost:8766';
const labKey = bench ? 'test:' + slug : slug;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 1000 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const url = bench ? `${BASE}/tools/fixtures/lab.html?lab=${slug}&x=${Date.now()}` : `${BASE}/lesson.html?l=${slug}&x=${Date.now()}`;
await p.goto(url, { waitUntil: 'networkidle2' });
await p.evaluate(k => { localStorage.removeItem('lab:' + k); localStorage.removeItem('anthropic-key'); }, labKey);
await p.reload({ waitUntil: 'networkidle2' });
await p.waitForSelector('.ide-editor .CodeMirror', { timeout: 30000 });
if (!bench) console.log(await p.evaluate(() => `${document.querySelector('.crumbs').textContent} | katex ${document.querySelectorAll('.prose .katex').length}`));
const info = await p.evaluate(s => { const l = window.LABS[s]; return { n: l.steps.length, ne: (l.exercises || []).length, project: l.mode === 'project' }; }, slug);
console.log(`lab: ${info.n} steps, ${info.ne} exercises${info.project ? ', project mode' : ''}`);

const consoleText = () => p.evaluate(() => document.getElementById('lab-console').textContent.replace(/\s+/g, ' '));
async function runItem(i, code) {
  await p.evaluate((i, code, project) => {
    document.querySelector(`#lab-steps button[data-i="${i}"]`).click();
    const cm = () => document.querySelector('.ide-editor .CodeMirror').CodeMirror;
    if (project) for (const [f, text] of Object.entries(code)) { document.querySelector(`#lab-tabs button[data-file="${f}"]`).click(); cm().setValue(text); }
    else cm().setValue(code);
    document.getElementById('lab-run').click();
  }, i, code, info.project);
  await p.waitForFunction(() => !document.getElementById('lab-run').disabled && !/Running the tests|Starting Python|Installing/.test(document.getElementById('lab-console').textContent), { timeout: 240000 });
  return consoleText();
}

let pass = 0;
const sol = (kind, i) => p.evaluate((s, kind, i) => { const it = window.LABS[s][kind][i]; return it.solution; }, slug, kind, i);
const exLockedBefore = info.ne ? await p.evaluate(n => document.querySelector(`#lab-steps button[data-i="${n}"]`).disabled, info.n) : null;
for (let i = 0; i < info.n; i++) {
  const t0 = Date.now();
  const txt = await runItem(i, await sol('steps', i));
  const ok = !/✗|Line \d|line \d|Stopped|could not|Error/.test(txt) && /✓/.test(txt); if (ok) pass++;
  console.log(`step ${i + 1}: ${ok ? 'pass' : 'FAIL ' + txt.slice(0, 260)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
const done = bench ? await p.evaluate(() => window.labCompleted) : await p.evaluate(() => document.getElementById('done').textContent);
console.log(`lab ${pass}/${info.n} | done: ${done} | download: ${await p.evaluate(() => document.getElementById('lab-dl')?.getAttribute('download') || 'none')}`);

if (info.ne) {
  // exercise locks: closed before the lab is done, solution locked until passed or 3 tries, hints step up
  const t = await p.evaluate(n => {
    document.querySelector(`#lab-steps button[data-i="${n}"]`).click();
    document.getElementById('lab-sol').click();
    const locked = /locked/.test(document.getElementById('lab-help').textContent);
    document.getElementById('lab-hint').click(); document.getElementById('lab-hint').click();
    const hints = document.querySelectorAll('#lab-help p strong').length;
    return { locked, hints };
  }, info.n);
  console.log(`exercises: locked before lab done ${exLockedBefore} | solution locked at first ${t.locked} | hints shown after 2 clicks ${t.hints}`);
  let ep = 0;
  for (let j = 0; j < info.ne; j++) {
    const i = info.n + j, t0 = Date.now();
    if (j === 0) {      // a wrong answer counts as a try
      await runItem(i, info.project ? {} : 'pass');
    }
    const txt = await runItem(i, await sol('exercises', j));
    const ok = /solved/.test(txt) && !/✗/.test(txt); if (ok) ep++;
    console.log(`exercise ${j + 1}: ${ok ? 'pass' : 'FAIL ' + txt.slice(0, 260)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  const count = await p.evaluate(() => document.getElementById('lab-count').textContent);
  console.log(`exercises ${ep}/${info.ne} | ${count}`);
}
console.log(`page errors: ${errs.length}${errs.length ? ' ' + errs.slice(0, 3).join(' / ') : ''}`);
if (!bench) {
  await p.goto(`${BASE}/films/${slug}.html?x=${Date.now()}`, { waitUntil: 'networkidle2' });
  const fe = await p.evaluate(async () => { const m = []; console.error = (...a) => m.push(String(a[0] && a[0].stack || a[0]).split('\n')[0]); window.addEventListener('error', e => m.push(e.message));
    const s = document.getElementById('scrub'); for (let t = 0; t <= +s.max; t += .25) { s.value = t; s.dispatchEvent(new Event('input')); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); } return m; });
  console.log('film sweep errors:', fe.length, fe.slice(0, 2).join(' / '));
}
await b.close();
