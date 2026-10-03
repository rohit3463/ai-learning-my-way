# Learning AI My Way

A static website with two learning tracks, each taught through animated films, worked-out notes, and code you write yourself:

- **Machine Learning → Deep Learning**: every model derived from first principles, up to how large language models are built.
- **AI Engineering: Building Agents**: building production-grade applications and agents on top of LLMs, in three levels (Basic B1–B7, Intermediate I1–I7, Advanced P1–P7).

Every lesson ends with exercises, and every part of a track ends with a guided project.

**Live site:** https://rohit3463.github.io/ai-learning-my-way/

## Structure

| Path | What it is |
|---|---|
| `index.html` | Home page: the two tracks and their lessons |
| `lesson.html` | Lesson page, `lesson.html?l=<slug>` |
| `films.html` | Film library, grouped by track |
| `films/*.html` | Standalone animated films (canvas + JavaScript). `?t=<seconds>` starts at a given time |
| `films/film-kit.js` | Shared film engine (controls, subtitles, narration, sound, math cards). Films from Lesson 4 on define only their data and scenes and call `FilmKit.run(...)` |
| `content/lessons.json` | `tracks` (each with `sections`) and `lessons`, in order. A lesson names its `track` and `section`; `"soon": true` lists it as coming soon, `"kind": "project"` marks a project, and `"exercises": N` shows its exercise count. Numbers are worked out from the order: 00, 01, … in the ML track, B1, I1, P1, … in labelled sections |
| `content/lessons/<slug>.html` | Optional written notes for a lesson, in plain HTML. Math goes in `\( … \)` (inline) or `\[ … \]` (centered) and is rendered by KaTeX |
| `content/labs/<slug>.js` | Optional hands-on coding lab for a lesson (see *Writing labs* below). Enable with `"lab": "<slug>"` in `lessons.json` |
| `assets/js/lab.js`, `assets/js/py-worker.js` | The in-browser IDE. Code runs in real Python (Pyodide) inside a Web Worker, with a 20-second limit per run. `numpy`, `scikit-learn`, `scipy` and `pandas` are installed automatically the first time code imports them |
| `assets/py/llmsim.py`, `assets/py/anthropic/` | The simulated model for the agent labs. `import anthropic` in a lab loads a stand-in with the real SDK's interface, answered by `llmsim`, so no API key is needed |
| `assets/` | Shared CSS and JavaScript |

## Run locally

The pages load `content/lessons.json` with `fetch`, so open them through a local server rather than as files:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy

The site is plain HTML with no build step. GitHub Pages serves it from the `main` branch root
(Settings → Pages → Deploy from a branch → `main` / `/ (root)`).

## Updating the site

After changing `assets/js/site.js` or `assets/css/site.css`, bump the `?v=` number where they are linked in
`index.html`, `lesson.html` and `films.html`. Browsers cache these files for up to 10 minutes, and the new number
makes them fetch the fresh copy straight away.

## Rendering the films to video

`tools/` turns each film into a 1920×1080, 30 fps MP4 for YouTube, with narration (macOS `say`), the film's music,
loudness levelled to about −14 LUFS, plus an `.srt` caption file, chapter timestamps, a thumbnail and a ready-to-paste
title and description. Requirements: macOS, Google Chrome, `ffmpeg` (`brew install ffmpeg`) and Node.

```sh
cd tools && npm install
(cd .. && python3 -m http.server 8766 &)          # serve the site locally
caffeinate -i node render-film.mjs linear-regression ../../videos
node youtube-meta.mjs ../../videos ..            # writes <slug>.youtube.txt
```

The site's download links (`videos/*.mp4`) are 720p copies of those masters.

## Writing labs

A lab file sets `window.LABS['<slug>']` to an object with `title`, `intro`, `steps` and optionally `exercises`.

- **Guided steps** (`steps`): `{ id, title, brief, starter, hint, solution, tests }`. A test is `{ name, check }`, where `check` is Python that raises `AssertionError` when the code is wrong (`close(a, b, tol)` is provided). Each step's code runs after all earlier steps' code. `optional: true` steps do not block completion.
- **Exercises** (`exercises`): unguided tasks shown after the lab is done. `{ id, type: 'fix' | 'extend' | 'design', title, brief, given, starter, hints: [...], solution, tests }`. `given` is read-only code run first: a string, or a list of step ids whose solutions are used. Hints are revealed one at a time; the solution unlocks after the exercise passes or after `unlockAfter` failed tries (default 3).
- **Projects** (`mode: 'project'`): several files edited in tabs. `files` holds each file's starting text; each step names the `file` to work in, may `add` starter text to files when first opened, and has `solution: { 'file.py': fullText }`. Tests import from the files (`from agent import run`). The finished project downloads as a zip with `requirements`, `readme` and, if used, `llmsim.py`.
- **Model labs** (`llm: true`): code can `import anthropic` and `import llmsim`. Every run starts from a clean simulator. `llmsim.configure(...)` switches on faults (rate limits, overload, timeouts, broken JSON, refusals, prompt injection), `llmsim.script(...)` and `llmsim.on(...)` fix the replies, and `llmsim.calls` logs every request for tests to inspect. `time.sleep` moves a pretend clock instead of waiting. Steps with `real: true` call the real Claude API when the learner has saved their own key in the lab (it stays in their browser).

`tools/fixtures/demo-agent.js` is a small complete project lab to copy from. Open it at `tools/fixtures/lab.html?lab=demo-agent`.

## Authoring tools

| Command (from the repo root) | What it does |
|---|---|
| `node tools/check-lab.mjs <slug> [--skip sklearn] [--file path]` | Runs a lab in local Python: every step's and exercise's solution must pass and every starter must fail |
| `node tools/e2e-lesson.mjs <slug>` | Opens the lesson in headless Chrome, runs every lab step (including scikit-learn) and exercise, checks the exercise locks, then sweeps the film for script errors |
| `node tools/e2e-lesson.mjs --bench <lab>` | The same for a lab on the test bench (`tools/fixtures/`), with no lesson page or film |
| `python3 tools/check-llmsim.py` | Checks the simulated model: tools, JSON, documents, faults, injection, streaming, caching |
| `python3 tools/build-film.py <slug> "<Title>" ... <seconds> <script.js>` | Wraps a film script that uses `films/film-kit.js` in the shared film page |

The browser tools need `cd tools && npm install` and the site served on port 8766.
