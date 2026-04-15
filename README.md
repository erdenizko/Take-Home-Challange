# Campaign Performance Dashboard

A dashboard for exploring campaign delivery data — impressions, spend, revenue, and margin across 26 deals over 30 days.

## Prerequisites

- Python 3.14+
- Node.js 20+
- Docker (for containerised builds)

## Development

### Quick start

```bash
# Install all dependencies (backend + frontend)
make install

# Run both Flask and Vite dev servers in a single terminal
make dev
```

This starts:
- **Flask API** on `http://localhost:5001`
- **Vite dev server** on `http://localhost:5173` (proxies `/api/*` to Flask)

Open `http://localhost:5173` for development with hot module replacement.
Press `Ctrl+C` to stop both servers.

### Manual setup (two terminals)

**Terminal 1 — Backend:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Docker (production-like local build)

```bash
docker build -t campaign-dashboard .
docker run -p 8000:8000 campaign-dashboard
```

Open `http://localhost:8000`. Gunicorn serves the app with 4 workers.

## API Documentation (Swagger)

Interactive API docs are available via Swagger UI, powered by [Flasgger](https://github.com/flasgger/flasgger).

| URL | Description |
|-----|-------------|
| `/apidocs/` | Swagger UI — browse and try endpoints interactively |
| `/apispec.json` | Raw OpenAPI 2.0 spec (JSON) |

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/partners` | List unique supply partners |
| GET | `/api/summary` | Aggregated KPIs (impressions, spend, revenue, margin) |
| GET | `/api/by-buy-type` | KPI breakdown by buy type |
| GET | `/api/daily-trends` | Daily aggregated metrics for charting |
| GET | `/api/deals` | Deal-level performance, sorted by margin |

All endpoints except `/api/partners` and `/api/by-buy-type` accept optional query parameters: `buy_type`, `supply_partner`, `start_date`, `end_date`.

## CI/CD

GitHub Actions workflows are in `.github/workflows/`.

### CI (`ci.yml`) — runs on every push and PR to `main`

| Job | What it does |
|-----|-------------|
| Backend | Installs Python deps, lints with `ruff`, smoke-tests all API endpoints |
| Frontend | Installs Node deps, runs `vite build` |
| Docker | Builds the full multi-stage Docker image |

### Deploy (`deploy.yml`) — runs on push to `main`

Builds a Docker image, pushes to ECR, and deploys to ECS Fargate.

| Step | Description |
|------|-------------|
| Configure AWS | OIDC-based role assumption (no long-lived keys) |
| ECR Login | Authenticates to private container registry |
| Build & Push | Tags image with commit SHA + `latest`, pushes to ECR |
| Update Task Def | Swaps the new image into the current ECS task definition |
| Deploy | Registers new task def, updates ECS service, waits for stability |

### AWS Setup Required

1. **ECR repository** — `campaign-dashboard`
2. **ECS cluster** — `campaign-cluster` with a Fargate service `campaign-service`
3. **IAM OIDC provider** for GitHub Actions + IAM role with ECR push and ECS deploy permissions
4. **GitHub repo secret** — `AWS_ROLE_ARN` set to the IAM role ARN

Update the `env:` block in `deploy.yml` if your naming or region differs (default: `eu-west-1`).

## Architecture

```
Browser --> ALB --> ECS Fargate (Gunicorn + Flask)
                         |
                   frontend/dist/  (static assets)
                   app.py          (API + serves frontend)
                   campaign_delivery_sample.json (data)
```

## Technology choices

- **Vanilla JS** — the dataset is small and the interactions are simple. A framework would add complexity without benefit here.
- **Tailwind CSS** — utility-class styling via Vite plugin. Matches Broadlab's existing stack.
- **Chart.js** — lightweight, well-documented, produces clean charts with minimal configuration.
- **Flask + Flasgger** — minimal backend with auto-generated Swagger docs from route docstrings.
- **No pandas** — with 780 records, stdlib `defaultdict` handles aggregation cleanly and keeps dependencies minimal.
