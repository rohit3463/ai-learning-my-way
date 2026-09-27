// Render one lesson film to a YouTube-ready MP4, plus captions, chapters and a thumbnail.
// usage: node render-film.mjs <slug> <outDir> [--seconds N] [--fps 30]
import puppeteer from 'puppeteer-core';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [slug, outDir] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
const FPS = arg('--fps', 30), LIMIT = arg('--seconds', Infinity);
const BASE = process.env.FILM_BASE || 'http://localhost:8766';
const W = 1920, H = 1080, VOICE = 'Samantha', RATE = 170;
const work = path.join(outDir, '.work', slug);
fs.mkdirSync(work, { recursive: true });
const log = (...a) => console.log(`[${slug}]`, ...a);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: W / 1.5, height: H / 1.5, deviceScaleFactor: 1.5 });   // 1280×720 layout, 1920×1080 pixels
await page.goto(`${BASE}/films/${slug}.html?render=1`, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__film);
const film = await page.evaluate(() => ({ DUR: __film.DUR, SUBS: __film.SUBS, CHAPTERS: __film.CHAPTERS, title: document.title }));
log('film', film.title, film.DUR + 's', film.SUBS.length, 'subtitles');

// ── narration clips ──
const spoken = s => s.replace(/η/g, 'eta').replace(/…/g, '...').replace(/[“”]/g, '').replace(/×/g, 'times').replace(/’/g, "'");
const clips = film.SUBS.map(([s, e, text], i) => {
  const f = path.join(work, `line${String(i).padStart(2, '0')}.aiff`);
  if (!fs.existsSync(f)) execFileSync('say', ['-v', VOICE, '-r', String(RATE), '-o', f, spoken(text)]);
  const d = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
  return { i, s, e, text, file: f, d };
});

// ── timeline: film time advances with video time, but holds while a line is still being spoken ──
const dt = 1 / 240, tl = [];   // [video time, film time]
{
  let v = 0, t = 0, spokenUpTo = -1, cur = null;
  while (t < film.DUR - 1e-9 || (cur && v < cur.vStart + cur.d)) {
    const si = clips.findIndex(c => t >= c.s && t < c.e);
    if (si > spokenUpTo && si >= 0) { spokenUpTo = si; cur = clips[si]; cur.vStart = v; }
    let next = Math.min(film.DUR, t + dt);
    if (cur && v < cur.vStart + cur.d) next = Math.min(next, Math.max(t, cur.e - .4));
    tl.push([v, t]); v += dt; t = next;
    if (tl.length > 1e7) throw new Error('timeline runaway');
  }
  tl.push([v, t]); tl.push([v + 1.5, film.DUR]);   // a short still at the end
}
const VDUR = Math.min(tl[tl.length - 1][0], LIMIT);
const filmAt = v => { const i = Math.min(tl.length - 1, Math.max(0, Math.round(v / dt))); return tl[i][1]; };
const videoAt = t => { const r = tl.find(([, ft]) => ft >= t); return r ? r[0] : VDUR; };
log(`video ${VDUR.toFixed(1)}s (film ${film.DUR}s, ${(VDUR - film.DUR - 1.5).toFixed(1)}s of narration holds)`);

// ── captions (.srt) and YouTube chapters ──
const stamp = (x, srt) => { const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, s = Math.floor(x % 60), ms = Math.round((x % 1) * 1000);
  return srt ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
const srt = clips.filter(c => c.vStart !== undefined).map((c, k) => {
  const end = Math.max(c.vStart + c.d + .3, videoAt(c.e - .35));
  return `${k + 1}\n${stamp(c.vStart, true)} --> ${stamp(end, true)}\n${c.text}\n`;
}).join('\n');
fs.writeFileSync(path.join(outDir, `${slug}.srt`), srt);
const chapters = film.CHAPTERS.map(c => `${stamp(c.t === 0 ? 0 : videoAt(c.t))} ${c.act ? c.act + ': ' : ''}${c.name}`).join('\n');

// ── music, rendered offline in the page along the same timeline ──
const step = 1 / 20, samples = [], speaking = [];
for (let v = 0; v < VDUR; v += step) { samples.push(filmAt(v)); speaking.push(clips.some(c => c.vStart !== undefined && v >= c.vStart && v < c.vStart + c.d)); }
const b64 = await page.evaluate((s, st, sp) => __film.music(s, st, sp), samples, step, speaking);
const musicWav = path.join(work, 'music.wav');
fs.writeFileSync(musicWav, Buffer.from(b64, 'base64'));
await page.goto(`${BASE}/films/${slug}.html?render=1`, { waitUntil: 'networkidle0' });   // fresh page for drawing
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__film);
log('music rendered');

// ── thumbnail from the title card ──
await page.evaluate(() => __film.renderAt(3));
await page.screenshot({ path: path.join(outDir, `${slug}.thumbnail.jpg`), type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W / 1.5, height: H / 1.5 } });

// ── frames → video ──
const silent = path.join(work, 'video.mp4');
const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS), silent]);
const frames = Math.ceil(VDUR * FPS);
const t0 = Date.now();
for (let k = 0; k < frames; k++) {
  await page.evaluate(ft => __film.renderAt(ft), filmAt(k / FPS));
  const jpg = await page.screenshot({ type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: W / 1.5, height: H / 1.5 } });
  if (!enc.stdin.write(jpg)) await new Promise(r => enc.stdin.once('drain', r));
  if (k % 300 === 0) log(`frame ${k}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
enc.stdin.end();
await new Promise((res, rej) => enc.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg video ' + c))));
await browser.close();

// ── mix narration over the music, level to YouTube's loudness, and mux ──
const used = clips.filter(c => c.vStart !== undefined && c.vStart < VDUR);
const inputs = ['-i', silent, '-i', musicWav, ...used.flatMap(c => ['-i', c.file])];
const delays = used.map((c, k) => `[${k + 2}:a]aresample=48000,adelay=${Math.round(c.vStart * 1000)}|${Math.round(c.vStart * 1000)},volume=1.15[n${k}]`).join(';');
const mix = `${delays}${used.length ? ';' : ''}[1:a]volume=0.8[m];[m]${used.map((_, k) => `[n${k}]`).join('')}amix=inputs=${used.length + 1}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aformat=channel_layouts=stereo,aresample=48000[a]`;
const master = path.join(outDir, `${slug}.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', mix, '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', VDUR.toFixed(3), '-movflags', '+faststart', master]);

fs.writeFileSync(path.join(outDir, `${slug}.chapters.txt`), chapters + '\n');
const size = (fs.statSync(master).size / 1e6).toFixed(1);
log(`done: ${master} (${size} MB, ${VDUR.toFixed(1)}s) in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
