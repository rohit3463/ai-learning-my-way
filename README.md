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
| `content/lessons.json` | The list of lessons, in order |
| `content/lessons/<slug>.md` | Optional written notes for a lesson (Markdown with `$…$` / `$$…$$` math) |
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
