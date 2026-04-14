# Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vite frontend bundling, Gunicorn WSGI server, and Docker containerization to the Campaign Performance Dashboard.

**Architecture:** Single-container deployment. Vite builds frontend assets (Tailwind compiled at build time, Chart.js + Flatpickr as npm packages) into `frontend/dist/`. Flask serves the built assets and API from one process via Gunicorn.

**Tech Stack:** Vite 6, Tailwind CSS 4, Chart.js, Flatpickr, Flask 3.1.3, Gunicorn 23, Docker (multi-stage)

**Spec:** `docs/superpowers/specs/2026-04-14-production-deployment-design.md`

---

## File Structure

```
take-home-challenge/
├── frontend/
│   ├── index.html              # CREATE — entry HTML (migrated from static/index.html)
│   ├── src/
│   │   ├── main.js             # CREATE — app JS (extracted from inline <script>)
│   │   └── style.css           # CREATE — Tailwind directives
│   ├── public/
│   │   ├── logo.png            # MOVE — from static/logo.png
│   │   └── favicon.ico         # CREATE — empty placeholder
│   ├── package.json            # CREATE
│   ├── vite.config.js          # CREATE
│   └── tailwind.config.js      # CREATE
├── app.py                      # MODIFY — update static_folder, add PORT env var
├── requirements.txt            # CREATE — pinned flask + gunicorn
├── Dockerfile                  # CREATE — multi-stage build
├── .dockerignore               # CREATE
└── (existing files unchanged)
```

---

### Task 1: Scaffold Vite project with Tailwind

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/src/style.css`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "campaign-dashboard",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd frontend && npm install vite tailwindcss @tailwindcss/vite chart.js flatpickr
```

Expected: `node_modules/` created, `package-lock.json` generated, packages listed in `package.json` dependencies.

- [ ] **Step 3: Create `frontend/vite.config.js`**

```js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5001',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 4: Create `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#10445C',
          DEFAULT: '#70B9DA',
          light: '#E2F5FD',
        },
        accent: {
          purple: '#4C269B',
          orange: '#E87C2A',
        },
        secondary: '#335586',
      },
    },
  },
};
```

- [ ] **Step 5: Create `frontend/src/style.css`**

```css
@import 'tailwindcss';
@import 'flatpickr/dist/flatpickr.min.css';

@config '../tailwind.config.js';
```

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/tailwind.config.js frontend/src/style.css
git commit -m "feat: scaffold Vite project with Tailwind and dependencies"
```

---

### Task 2: Move static assets to frontend/public

**Files:**
- Move: `static/logo.png` → `frontend/public/logo.png`
- Create: `frontend/public/favicon.ico`

- [ ] **Step 1: Copy logo to public directory**

```bash
mkdir -p frontend/public
cp static/logo.png frontend/public/logo.png
```

- [ ] **Step 2: Create placeholder favicon**

```bash
touch frontend/public/favicon.ico
```

Note: Vite copies everything in `public/` to the build output root. The logo will be accessible at `/logo.png` in production.

- [ ] **Step 3: Commit**

```bash
git add frontend/public/
git commit -m "feat: add static assets to frontend/public"
```

---

### Task 3: Create frontend/index.html

**Files:**
- Create: `frontend/index.html`

This is the current `static/index.html` with three changes:
1. Remove all CDN `<script>` and `<link>` tags (Tailwind, Chart.js, Flatpickr, Flatpickr CSS)
2. Remove the inline Tailwind config `<script>` block
3. Remove the entire inline `<script>` block (lines 187-608 of current file)
4. Add `<script type="module" src="/src/main.js"></script>` in `<head>`
5. Update logo `src` from `/static/logo.png` to `/logo.png`
6. Update favicon `href` from `/static/favicon.ico` to `/favicon.ico`

- [ ] **Step 1: Create `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Campaign performance dashboard showing impression trends, revenue, spend, and deal-level analytics across CTV, Display, Audio, and BVOD channels.">
  <meta name="robots" content="noindex, nofollow">
  <meta property="og:title" content="Campaign Performance Dashboard">
  <meta property="og:description" content="Track impression trends, revenue, and spend across campaign channels.">
  <meta property="og:type" content="website">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <link rel="canonical" href="/">
  <title>Campaign Performance Dashboard</title>
  <script type="module" src="/src/main.js"></script>
</head>

<body class="bg-gray-100 text-gray-800">

  <!-- Header -->
  <header class="px-6 py-3 flex items-center justify-between">
    <img src="/logo.png" alt="Broadlab — Campaign Performance Dashboard" class="h-8">
  </header>

  <!-- Error banner -->
  <div id="error-banner" class="hidden max-w-7xl mx-auto px-6 pt-4" role="alert">
    <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm text-red-700" id="error-message">Failed to load data.</p>
      </div>
      <button onclick="dismissError()" class="text-red-400 hover:text-red-600 text-lg leading-none" aria-label="Dismiss error">&times;</button>
    </div>
  </div>

  <noscript>
    <div style="max-width:80rem;margin:2rem auto;padding:1rem 1.5rem;background:#fef2f2;border:1px solid #fecaca;border-radius:0.5rem;color:#b91c1c;font-family:system-ui,sans-serif;">
      This dashboard requires JavaScript to display campaign data. Please enable JavaScript in your browser settings.
    </div>
  </noscript>

  <main class="max-w-7xl mx-auto px-6 py-6 space-y-6">
    <!-- Chart + KPI card -->
    <div class="bg-white rounded-2xl shadow-sm p-6 space-y-6">
      <div class="flex flex-row justify-between w-full items-center">
        <h1>Impression Trends</h1>
        <!-- Filters -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 border border-gray-200 bg-white rounded-full pl-1 pr-3 py-1">
            <div class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <select id="filter" aria-label="Filter by buy type"
              class="text-sm text-gray-700 bg-transparent border-none outline-none cursor-pointer pr-1 appearance-none">
              <option value="">All Types</option>
              <option value="CTV">CTV</option>
              <option value="Display">Display</option>
              <option value="Audio">Audio</option>
              <option value="BVOD">BVOD</option>
            </select>
            <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div class="flex items-center gap-2 border border-gray-200 bg-white rounded-full pl-1 pr-3 py-1">
            <div class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <select id="partner-filter" aria-label="Filter by supply partner"
              class="text-sm text-gray-700 bg-transparent border-none outline-none cursor-pointer pr-1 appearance-none">
              <option value="">All Partners</option>
            </select>
            <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div class="relative flex items-center gap-2 border border-gray-200 bg-white rounded-full pl-1 pr-3 py-1">
            <div class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <input id="date-range" type="text" readonly placeholder="All Dates" aria-label="Date range filter" class="text-sm text-gray-700 bg-transparent border-none outline-none cursor-pointer w-44">
            <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <button onclick="exportCSV()" aria-label="Export deals as CSV" class="flex items-center gap-2 bg-brand text-white rounded-full px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div id="empty-state" class="hidden py-16 text-center">
        <svg class="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
        <p class="text-gray-400 text-sm font-medium">No campaign data found for the selected filters.</p>
        <p class="text-gray-300 text-xs mt-1">Try adjusting your filters to see results.</p>
      </div>

      <!-- Dashboard content -->
      <div id="dashboard-content" class="flex flex-col space-y-6">
        <div class="flex flex-row gap-6 divide-x">
          <!-- Chart -->
          <div class="flex-1">
            <canvas id="trend-chart" height="90"></canvas>
          </div>

          <!-- KPI Cards -->
          <div class="w-64 flex flex-col shrink-0 justify-center divide-y pl-4" id="kpi-cards">
            <div class="pb-4">
              <p class="text-xs text-gray-400 font-medium mb-1">Impressions</p>
              <p class="text-2xl font-bold text-gray-800" id="kpi-impressions">-</p>
              <p class="text-xs text-gray-400 mt-1" id="kpi-impressions-daily">-</p>
            </div>
            <div class="py-4">
              <p class="text-xs text-gray-400 font-medium mb-1">Income</p>
              <p class="text-2xl font-bold text-gray-800" id="kpi-revenue">-</p>
              <p class="text-xs text-gray-400 mt-1" id="kpi-revenue-per-imp">-</p>
            </div>
            <div class="pt-4">
              <p class="text-xs text-gray-400 font-medium mb-1">Expense</p>
              <p class="text-2xl font-bold text-gray-800" id="kpi-spend">-</p>
              <p class="text-xs text-gray-400 mt-1" id="kpi-spend-per-imp">-</p>
            </div>
          </div>
        </div>

        <!-- Deals Table -->
        <section class="overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-gray-800 text-left">
                <tr>
                  <th class="py-2 cursor-pointer hover:bg-brand-light transition-colors" data-sort="deal_id" role="button" tabindex="0">Deal ID</th>
                  <th class="py-2 cursor-pointer hover:bg-brand-light transition-colors" data-sort="buy_type" role="button" tabindex="0">Buy Type</th>
                  <th class="py-2 cursor-pointer hover:bg-brand-light transition-colors" data-sort="supply_partner" role="button" tabindex="0">Partner</th>
                  <th class="py-2 cursor-pointer hover:bg-brand-light transition-colors text-right" data-sort="impressions" role="button" tabindex="0">Impressions</th>
                  <th class="py-2 cursor-pointer hover:bg-brand-light transition-colors text-right" data-sort="spend" role="button" tabindex="0">Spend</th>
                  <th class="py-2 cursor-pointer hover:bg-brand-light transition-colors text-right" data-sort="revenue" role="button" tabindex="0">Revenue</th>
                  <th class="py-2 cursor-pointer hover:bg-brand-light transition-colors text-right" data-sort="margin" role="button" tabindex="0">Margin</th>
                </tr>
              </thead>
              <tbody id="deals-body"></tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </main>

</body>

</html>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/index.html
git commit -m "feat: create frontend entry HTML without CDN dependencies"
```

---

### Task 4: Extract JavaScript to frontend/src/main.js

**Files:**
- Create: `frontend/src/main.js`

This is the entire inline `<script>` block from `static/index.html` (lines 187-608), with these modifications at the top:
1. Add `import` statements for Chart.js, Flatpickr, and the CSS
2. Wrap everything in a `DOMContentLoaded` listener (since the module script loads in `<head>`)
3. Expose `dismissError` and `exportCSV` on `window` (they are referenced by `onclick` attributes in the HTML)

- [ ] **Step 1: Create `frontend/src/main.js`**

```js
import Chart from 'chart.js/auto';
import flatpickr from 'flatpickr';
import './style.css';

document.addEventListener('DOMContentLoaded', function () {
  // --- State ---
  let dealsData = [];
  let sortCol = 'margin';
  let sortAsc = false;
  let trendChart = null;

  // --- Formatters ---
  const fmtNum = (n) => n.toLocaleString('en-GB');
  const fmtCurrency = (n) => '\u00A3' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- DOM helpers ---
  function createCell(text, classes) {
    const td = document.createElement('td');
    td.textContent = text;
    td.className = classes || '';
    return td;
  }

  // --- Error codes & messages ---
  var ERROR_MESSAGES = {
    'FE-100': 'Unable to reach the server. Please check the server is running.',
    'FE-101': 'Request timed out. The server may be overloaded.',
    'FE-102': 'Failed to parse server response.',
    'API-100': 'Campaign data is not available on the server.',
    'API-101': 'Invalid filter value provided.',
    'API-104': 'API endpoint not found.',
    'API-105': 'Internal server error.',
  };

  function errorMessage(code, serverMsg) {
    var msg = serverMsg || ERROR_MESSAGES[code] || 'An unexpected error occurred.';
    return '[' + code + '] ' + msg;
  }

  // --- Error handling ---
  function showError(code, serverMsg) {
    document.getElementById('error-message').textContent = errorMessage(code, serverMsg);
    document.getElementById('error-banner').classList.remove('hidden');
  }

  function dismissError() {
    document.getElementById('error-banner').classList.add('hidden');
  }

  // Expose to onclick handlers in HTML
  window.dismissError = dismissError;

  async function fetchWithRetry(url, retries, delay) {
    retries = retries || 3;
    delay = delay || 1000;
    for (var i = 0; i < retries; i++) {
      try {
        var res = await fetch(url);
        if (!res.ok) {
          var body = null;
          try { body = await res.json(); } catch (e) { /* not JSON */ }
          if (body && body.error && body.error.code) {
            var apiErr = new Error(body.error.message);
            apiErr.code = body.error.code;
            apiErr.serverMessage = body.error.message;
            throw apiErr;
          }
          var httpErr = new Error('HTTP ' + res.status);
          httpErr.code = 'FE-100';
          throw httpErr;
        }
        var json;
        try { json = await res.json(); } catch (e) {
          var parseErr = new Error('Invalid JSON');
          parseErr.code = 'FE-102';
          throw parseErr;
        }
        return json;
      } catch (err) {
        if (err.name === 'TypeError') {
          err.code = 'FE-100';
        }
        if (i === retries - 1) throw err;
        if (err.code === 'API-101') throw err;
        await new Promise(function (r) { setTimeout(r, delay); });
        delay *= 2;
      }
    }
  }

  // --- Date helpers ---
  function fmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getDateRange() {
    var picker = document.getElementById('date-range')._flatpickr;
    if (picker && picker.selectedDates.length === 2) {
      return { start: fmtDate(picker.selectedDates[0]), end: fmtDate(picker.selectedDates[1]) };
    }
    return { start: null, end: null };
  }

  // --- API helpers ---
  function buildUrl(path) {
    var buyType = document.getElementById('filter').value;
    var partner = document.getElementById('partner-filter').value;
    var dates = getDateRange();
    var params = [];
    if (buyType) params.push('buy_type=' + encodeURIComponent(buyType));
    if (partner) params.push('supply_partner=' + encodeURIComponent(partner));
    if (dates.start) params.push('start_date=' + dates.start);
    if (dates.end) params.push('end_date=' + dates.end);
    return params.length ? path + '?' + params.join('&') : path;
  }

  function updateUrlParams() {
    var params = new URLSearchParams();
    var buyType = document.getElementById('filter').value;
    var partner = document.getElementById('partner-filter').value;
    var dates = getDateRange();
    if (buyType) params.set('buy_type', buyType);
    if (partner) params.set('supply_partner', partner);
    if (dates.start) params.set('start_date', dates.start);
    if (dates.end) params.set('end_date', dates.end);
    var qs = params.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  async function loadDashboard() {
    updateUrlParams();
    dismissError();
    try {
      var [summary, trends, deals] = await Promise.all([
        fetchWithRetry(buildUrl('/api/summary')),
        fetchWithRetry(buildUrl('/api/daily-trends')),
        fetchWithRetry(buildUrl('/api/deals')),
      ]);

      var isEmpty = summary.impressions === 0 && deals.length === 0;
      document.getElementById('empty-state').classList.toggle('hidden', !isEmpty);
      document.getElementById('dashboard-content').classList.toggle('hidden', isEmpty);

      if (!isEmpty) {
        renderKPIs(summary);
        renderChart(trends);
        dealsData = deals;
        renderDeals();
      }
    } catch (err) {
      showError(err.code || 'FE-100', err.serverMessage);
    }
  }

  // --- KPI cards ---
  function renderKPIs(data) {
    document.getElementById('kpi-impressions').textContent = fmtNum(data.impressions);
    var dailyAvg = Math.round(data.impressions / 30);
    document.getElementById('kpi-impressions-daily').textContent = fmtNum(dailyAvg) + ' avg/day';

    document.getElementById('kpi-revenue').textContent = fmtCurrency(data.revenue);
    document.getElementById('kpi-spend').textContent = fmtCurrency(data.spend);

    var revenuePerImp = data.impressions > 0 ? (data.revenue / data.impressions * 1000).toFixed(2) : '0.00';
    document.getElementById('kpi-revenue-per-imp').textContent = '\u00A3' + revenuePerImp + ' per 1K imp.';

    var spendPerImp = data.impressions > 0 ? (data.spend / data.impressions * 1000).toFixed(2) : '0.00';
    document.getElementById('kpi-spend-per-imp').textContent = '\u00A3' + spendPerImp + ' per 1K imp.';
  }

  // --- Chart ---
  function renderChart(trends) {
    var labels = trends.map(function (t) { return t.date.slice(5); });
    var revenue = trends.map(function (t) { return t.revenue; });
    var spend = trends.map(function (t) { return -t.spend; });

    if (trendChart) {
      trendChart.data.labels = labels;
      trendChart.data.datasets[0].data = revenue;
      trendChart.data.datasets[1].data = spend;
      trendChart.update();
      return;
    }

    trendChart = new Chart(document.getElementById('trend-chart'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Revenue',
            data: revenue,
            backgroundColor: '#10445C',
            borderRadius: 4,
            borderSkipped: 'bottom',
            stack: 'stack0',
          },
          {
            label: 'Spend',
            data: spend,
            backgroundColor: '#E87C2A',
            borderRadius: 4,
            borderSkipped: 'bottom',
            stack: 'stack0',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var val = Math.abs(ctx.raw);
                return ctx.dataset.label + ': \u00A3' + fmtNum(val);
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#9ca3af' },
          },
          y: {
            stacked: true,
            grid: { color: '#f3f4f6' },
            border: { display: false },
            ticks: {
              callback: function (v) {
                var abs = Math.abs(v);
                if (abs >= 1000) return '\u00A3' + (v / 1000).toFixed(0) + 'K';
                return '\u00A3' + v;
              },
              font: { size: 11 },
              color: '#9ca3af',
            },
          },
        },
      },
    });
  }

  // --- Deals table ---
  function renderDeals() {
    var sorted = dealsData.slice().sort(function (a, b) {
      var valA = a[sortCol];
      var valB = b[sortCol];
      if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return sortAsc ? valA - valB : valB - valA;
    });

    var tbody = document.getElementById('deals-body');
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    sorted.forEach(function (d) {
      var tr = document.createElement('tr');
      tr.className = 'border-t hover:bg-brand-light';

      tr.appendChild(createCell(d.deal_id, 'py-2 font-medium'));
      tr.appendChild(createCell(d.buy_type, 'py-2'));
      tr.appendChild(createCell(d.supply_partner, 'py-2'));
      tr.appendChild(createCell(fmtNum(d.impressions), 'py-2 text-right'));
      tr.appendChild(createCell(fmtCurrency(d.spend), 'py-2 text-right'));
      tr.appendChild(createCell(fmtCurrency(d.revenue), 'py-2 text-right'));

      var marginColor = d.margin >= 0 ? 'text-green-600' : 'text-red-600';
      tr.appendChild(createCell(fmtCurrency(d.margin), 'py-2 text-right font-semibold ' + marginColor));

      tbody.appendChild(tr);
    });

    document.querySelectorAll('th[data-sort]').forEach(function (th) {
      var col = th.dataset.sort;
      var base = th.textContent.replace(/ [\u25B2\u25BC]$/, '');
      th.textContent = col === sortCol ? base + ' ' + (sortAsc ? '\u25B2' : '\u25BC') : base;
    });
  }

  // --- Load partner dropdown ---
  async function loadPartners() {
    try {
      var partners = await fetchWithRetry('/api/partners');
      var select = document.getElementById('partner-filter');
      partners.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
      });
    } catch (err) {
      showError(err.code || 'FE-100', err.serverMessage);
    }
  }

  // --- Export CSV ---
  function exportCSV() {
    if (!dealsData.length) return;
    var headers = ['Deal ID', 'Buy Type', 'Partner', 'Impressions', 'Spend', 'Revenue', 'Margin'];
    var rows = dealsData.map(function (d) {
      return [d.deal_id, d.buy_type, d.supply_partner, d.impressions, d.spend, d.revenue, d.margin];
    });
    var csv = [headers.join(',')].concat(rows.map(function (r) { return r.join(','); })).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var parts = ['broadlab_impression_trends'];
    var buyType = document.getElementById('filter').value;
    var partner = document.getElementById('partner-filter').value;
    if (buyType) parts.push(buyType.toLowerCase());
    if (partner) parts.push(partner.toLowerCase().replace(/\s+/g, '_'));
    a.download = parts.join('_') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Expose to onclick handler in HTML
  window.exportCSV = exportCSV;

  // --- Event listeners ---
  document.getElementById('filter').addEventListener('change', loadDashboard);
  document.getElementById('partner-filter').addEventListener('change', loadDashboard);

  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var col = th.dataset.sort;
      if (sortCol === col) {
        sortAsc = !sortAsc;
      } else {
        sortCol = col;
        sortAsc = col === 'deal_id' || col === 'buy_type' || col === 'supply_partner';
      }
      renderDeals();
    });
    th.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        th.click();
      }
    });
  });

  // --- Date range presets ---
  function applyPreset(preset) {
    var today = new Date();
    var start, end;
    switch (preset) {
      case 'last_7':
        end = new Date(today);
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        break;
      case 'last_30':
        end = new Date(today);
        start = new Date(today);
        start.setDate(start.getDate() - 29);
        break;
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today);
        break;
      case 'prev_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      default:
        datePicker.clear();
        loadDashboard();
        return;
    }
    datePicker.setDate([start, end]);
  }

  // --- Init Flatpickr + restore state ---
  var datePicker;

  (async function init() {
    var params = new URLSearchParams(location.search);
    var savedBuyType = params.get('buy_type') || '';
    var savedPartner = params.get('supply_partner') || '';
    var savedStart = params.get('start_date') || '';
    var savedEnd = params.get('end_date') || '';

    document.getElementById('filter').value = savedBuyType;

    await loadPartners();
    document.getElementById('partner-filter').value = savedPartner;

    datePicker = flatpickr('#date-range', {
      mode: 'range',
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'M j',
      defaultDate: savedStart && savedEnd ? [savedStart, savedEnd] : [],
      onClose: function (selectedDates) {
        if (selectedDates.length === 2 || selectedDates.length === 0) {
          loadDashboard();
        }
      },
      onReady: function (selectedDates, dateStr, instance) {
        var presets = document.createElement('div');
        presets.className = 'flatpickr-presets';
        presets.style.cssText = 'padding: 8px; border-top: 1px solid #e5e7eb; display: flex; flex-wrap: wrap; gap: 4px;';
        var buttons = [
          { label: 'Last 7 days', value: 'last_7' },
          { label: 'Last 30 days', value: 'last_30' },
          { label: 'This month', value: 'this_month' },
          { label: 'Previous month', value: 'prev_month' },
          { label: 'All time', value: 'all' },
        ];
        buttons.forEach(function (b) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = b.label;
          btn.style.cssText = 'padding: 4px 10px; font-size: 12px; border-radius: 9999px; border: 1px solid #e5e7eb; background: white; cursor: pointer; color: #374151;';
          btn.addEventListener('click', function () { applyPreset(b.value); });
          btn.addEventListener('mouseenter', function () { btn.style.background = '#E2F5FD'; });
          btn.addEventListener('mouseleave', function () { btn.style.background = 'white'; });
          presets.appendChild(btn);
        });
        instance.calendarContainer.appendChild(presets);
      },
    });

    loadDashboard();
  })();
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/main.js
git commit -m "feat: extract inline JS to main.js with ES module imports"
```

---

### Task 5: Verify Vite dev server works

**Files:** None (verification only)

- [ ] **Step 1: Start Flask backend**

```bash
python app.py &
```

Expected: Server running on port 5001.

- [ ] **Step 2: Start Vite dev server**

```bash
cd frontend && npm run dev
```

Expected: Vite dev server on `http://localhost:5173`. Open in browser — dashboard should render with chart, KPI cards, filters, and table. API calls proxied to Flask.

- [ ] **Step 3: Verify all features**

Test in browser:
- Chart renders with revenue/spend bars
- KPI cards show numbers
- Buy type filter works
- Partner filter dropdown populated
- Date picker opens with presets
- Table sorts by clicking headers
- Export CSV downloads a file
- URL updates with filter params

- [ ] **Step 4: Stop Flask backend**

```bash
kill %1
```

---

### Task 6: Update Flask backend for production

**Files:**
- Modify: `app.py` (lines 1-5 and 77-79 and 204-205)
- Create: `requirements.txt`

- [ ] **Step 1: Update `app.py`**

Change the top of the file (lines 1-5):

```python
import json
import os
from collections import defaultdict
from flask import Flask, jsonify, request

app = Flask(__name__, static_folder="frontend/dist", static_url_path="/")
```

Note: `send_from_directory` import is removed since it's no longer used.

Change the index route (lines 77-79):

```python
@app.route("/")
def index():
    return app.send_static_file("index.html")
```

Change the bottom of the file (lines 204-205):

```python
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=True, port=port)
```

- [ ] **Step 2: Create `requirements.txt`**

```
flask==3.1.3
gunicorn==23.0.0
```

- [ ] **Step 3: Install gunicorn in the venv**

```bash
pip install gunicorn==23.0.0
```

- [ ] **Step 4: Test production build + Flask serving**

```bash
cd frontend && npm run build && cd ..
python app.py
```

Open `http://localhost:5001` — dashboard should work identically to the Vite dev server version, but now served by Flask from the built assets.

- [ ] **Step 5: Commit**

```bash
git add app.py requirements.txt
git commit -m "feat: update Flask to serve Vite build output, add gunicorn"
```

---

### Task 7: Create Dockerfile and .dockerignore

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
venv/
__pycache__/
frontend/node_modules/
frontend/dist/
*.pyc
.git
docs/
*.png
*.html
!frontend/index.html
!app.py
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production runtime
FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
COPY campaign_delivery_sample.json .
COPY --from=frontend /app/frontend/dist ./frontend/dist
EXPOSE 8000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "app:app"]
```

- [ ] **Step 3: Build Docker image**

```bash
docker build -t campaign-dashboard .
```

Expected: Multi-stage build completes successfully. Image size should be ~150-200MB.

- [ ] **Step 4: Run Docker container**

```bash
docker run -p 8000:8000 campaign-dashboard
```

Expected: Gunicorn starts with 4 workers on port 8000.

- [ ] **Step 5: Verify in browser**

Open `http://localhost:8000` — full dashboard should work: chart, KPIs, filters, table, sorting, CSV export, date picker.

- [ ] **Step 6: Stop container and commit**

```bash
docker stop $(docker ps -q --filter ancestor=campaign-dashboard)
git add Dockerfile .dockerignore
git commit -m "feat: add multi-stage Dockerfile with Gunicorn"
```

---

### Task 8: Add .gitignore and clean up

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
# Python
venv/
__pycache__/
*.pyc

# Node
frontend/node_modules/
frontend/dist/

# IDE
.vscode/
.idea/

# OS
.DS_Store
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore for Python, Node, and IDE files"
```

---

## Verification Checklist

After all tasks are complete, verify end-to-end:

1. **Dev workflow:** `python app.py` + `cd frontend && npm run dev` → dashboard works on `localhost:5173`
2. **Production build:** `cd frontend && npm run build` + `python app.py` → dashboard works on `localhost:5001`
3. **Docker:** `docker build -t campaign-dashboard . && docker run -p 8000:8000 campaign-dashboard` → dashboard works on `localhost:8000`
4. **No CDN calls:** Open browser DevTools Network tab — no requests to `cdn.tailwindcss.com` or `cdn.jsdelivr.net`
5. **Assets hashed:** Check `frontend/dist/assets/` — JS and CSS files have content hashes in filenames
6. **All features work:** Filters, chart, KPIs, table sorting, CSV export, date picker presets, URL state persistence, error handling
