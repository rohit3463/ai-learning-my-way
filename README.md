# Learning AI My Way

A static website for learning machine learning and AI through animated films, worked-out math, and plain code.

**Live site:** https://rohit3463.github.io/ai-learning-my-way/

## Structure

| Path | What it is |
|---|---|
| `index.html` | Home page and learning path |
| `lesson.html` | Lesson page, `lesson.html?l=<slug>` |
| `films.html` | Film library |
| `films/*.html` | Standalone animated films (canvas + JavaScript). `?t=<seconds>` starts at a given time |
| `films/film-kit.js` | Shared film engine (controls, subtitles, narration, sound, math cards). Films from Lesson 4 on define only their data and scenes and call `FilmKit.run(...)` |
| `content/lessons.json` | The list of lessons, in order |
| `content/lessons/<slug>.html` | Optional written notes for a lesson, in plain HTML. Math goes in `\( … \)` (inline) or `\[ … \]` (centered) and is rendered by KaTeX |
| `content/labs/<slug>.js` | Optional hands-on coding lab for a lesson: small steps, each with starter code, hint, solution and Python tests. Enable with `"lab": "<slug>"` in `lessons.json` |
| `assets/js/lab.js`, `assets/js/py-worker.js` | The in-browser IDE. Code runs in real Python (Pyodide) inside a Web Worker, with an 8-second limit per run. `numpy`, `scikit-learn`, `scipy` and `pandas` are installed automatically the first time code imports them |
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
