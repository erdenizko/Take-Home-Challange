# Production Deployment Design — Campaign Performance Dashboard

**Date:** 2026-04-14
**Status:** Approved

## Context

The project is a Flask + vanilla JS dashboard with no build tooling, no Docker, and CDN-loaded frontend dependencies. This spec covers adding Vite as a frontend bundler, Gunicorn as a production WSGI server, and Docker containerization — all in a single-container architecture.

## Architecture

```
take-home-challenge/
├── frontend/                  # Vite project
│   ├── index.html             # Entry HTML (moved from static/)
│   ├── src/
│   │   └── main.js            # App JS (extracted from inline <script>)
│   ├── public/
│   │   └── logo.png           # Static assets copied as-is to dist/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
├── app.py                     # Flask backend (updated static_folder path)
├── requirements.txt           # Pinned: flask, gunicorn
├── Dockerfile                 # Multi-stage: Node build → Python runtime
├── .dockerignore
└── campaign_delivery_sample.json
```

## Frontend (Vite + Vanilla JS)

### Dependencies (npm)

- **tailwindcss** + **@tailwindcss/vite** — compiled at build time, replaces CDN
- **chart.js** — imported as ES module
- **flatpickr** — imported as ES module (JS + CSS)

### Vite Config

- Dev server proxies `/api/*` → `http://localhost:5001` so Flask serves the API during development
- Build outputs to `frontend/dist/` with hashed filenames for cache busting
- `public/` directory holds `logo.png` (copied as-is to dist root)

### Tailwind Config

- Preserves existing custom colors: brand (dark/DEFAULT/light), accent (purple/orange), secondary
- Content path scans `index.html` and `src/**/*.js`
- Build-time compilation produces only the CSS classes actually used (~5-10KB vs ~300KB CDN)

### JavaScript Migration

The inline `<script>` block in index.html (~400 lines) moves to `src/main.js` with these changes:

- Add `import Chart from 'chart.js/auto'` (Chart.js tree-shakeable entry)
- Add `import flatpickr from 'flatpickr'` and `import 'flatpickr/dist/flatpickr.min.css'`
- Add `import './style.css'` for Tailwind directives
- Wrap initialization in `DOMContentLoaded` listener (since script is now in `<head>` via Vite)
- All existing logic (state, formatters, DOM helpers, API calls, chart, table, CSV export) stays identical

### HTML Changes

- Remove CDN `<script>` tags (Tailwind, Chart.js, Flatpickr)
- Remove inline `<script>` block
- Remove Flatpickr CSS `<link>`
- Remove Tailwind config `<script>`
- Add `<script type="module" src="/src/main.js"></script>`
- All HTML structure, classes, attributes, and SEO tags remain unchanged

## Backend

### app.py Changes

Minimal changes only:

```python
import os

app = Flask(__name__,
            static_folder='frontend/dist',
            static_url_path='/')

@app.route('/')
def index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=True, port=port)
```

- `static_folder` points to Vite build output
- `static_url_path='/'` serves assets from root (not `/static/`)
- Port configurable via `PORT` env var (dev default stays 5001)
- All API endpoints unchanged

### requirements.txt

```
flask==3.1.3
gunicorn==23.0.0
```

Pinned versions for reproducible builds.

## Docker

### Dockerfile (multi-stage)

**Stage 1 — Frontend build (Node 20 Alpine):**
- Copy `package.json` + `package-lock.json`, run `npm ci`
- Copy frontend source, run `npm run build`
- Output: `frontend/dist/` with optimized, hashed assets

**Stage 2 — Production runtime (Python 3.14 slim):**
- Install Python dependencies from `requirements.txt`
- Copy `app.py`, `campaign_delivery_sample.json`
- Copy `frontend/dist/` from Stage 1
- Expose port 8000
- Run: `gunicorn -w 4 -b 0.0.0.0:8000 app:app`

### .dockerignore

```
venv/
__pycache__/
frontend/node_modules/
frontend/dist/
*.pyc
.git
```

## Development Workflow

```bash
# Terminal 1: Flask backend
python app.py

# Terminal 2: Vite dev server (with API proxy)
cd frontend && npm run dev
```

- Vite dev server on port 5173, proxies `/api/*` to Flask on 5001
- Hot module replacement for CSS/JS changes
- No Docker needed for development

## Production Build & Run

```bash
# Build and run with Docker
docker build -t campaign-dashboard .
docker run -p 8000:8000 campaign-dashboard

# Or build frontend manually
cd frontend && npm run build
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

## What Changes vs What Stays

| Area | Before | After |
|------|--------|-------|
| Tailwind | CDN runtime JIT (~300KB JS) | Build-time CSS (~5-10KB) |
| Chart.js | CDN global script | npm import, tree-shaken |
| Flatpickr | CDN script + CSS | npm import |
| JavaScript | Inline in HTML | `src/main.js`, minified |
| WSGI server | Flask dev server | Gunicorn (4 workers) |
| Python deps | Unpinned `flask` | Pinned `flask`, `gunicorn` |
| Port config | Hardcoded 5001 | `PORT` env var |
| Container | None | Multi-stage Dockerfile |
| Logo path | `/static/logo.png` | `/logo.png` (from `public/`) |

**Unchanged:** All API endpoints, data processing logic, frontend functionality (filters, chart, table, sorting, CSV export, error handling, URL state), HTML structure, Tailwind classes, accessibility attributes.
