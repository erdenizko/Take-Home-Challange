# Campaign Performance Dashboard

A simple dashboard for exploring campaign delivery data — impressions, spend, revenue, and margin across 26 deals over 30 days.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open [http://localhost:5001](http://localhost:5001) in your browser.

## Approach

**Backend:** A single Flask file (`app.py`) that loads the JSON data at startup and exposes four API endpoints:

- `GET /api/summary` — Total impressions, spend, revenue, margin
- `GET /api/by-buy-type` — Breakdown by buy type
- `GET /api/daily-trends` — Day-by-day totals for charting
- `GET /api/deals` — Deal-level aggregated performance

All endpoints accept an optional `?buy_type=` query parameter for filtering. Aggregation uses plain Python (`defaultdict`) — no pandas needed for 780 records.

**Frontend:** A single HTML page using Tailwind CSS (CDN) for styling and Chart.js (CDN) for the trend chart. No build step, no framework.

**Interactions:**
- **Buy type filter** — dropdown in the header updates all sections (KPIs, chart, table)
- **Column sorting** — click any table header to sort; click again to reverse

## Technology choices

- **Vanilla JS** — the dataset is small and the interactions are simple. A framework would add complexity without benefit here.
- **Tailwind CSS via CDN** — rapid utility-class styling without a build pipeline. Matches Broadlab's existing stack.
- **Chart.js** — lightweight, well-documented, produces clean charts with minimal configuration.
- **No pandas** — with 780 records, stdlib `defaultdict` handles aggregation cleanly and keeps dependencies minimal.

## Deployment sketch (AWS)

For a production deployment, I would use:

1. **ECS Fargate** — containerise the Flask app with a Dockerfile and deploy to Fargate. No server management, scales horizontally, and integrates with ALB for load balancing.
2. **Application Load Balancer (ALB)** — route traffic to ECS tasks, handle HTTPS termination with an ACM certificate.
3. **S3 + CloudFront** (optional) — if the frontend grows, serve static assets from S3 behind CloudFront for caching and lower latency. For this small app, serving from Flask via ALB is sufficient.
4. **ECR** — store Docker images in Elastic Container Registry.

This setup is simple, serverless-ish (no EC2 to manage), and handles the scale an internal dashboard would need. For even simpler deployment, AWS Elastic Beanstalk with a Docker platform would work with minimal configuration.
