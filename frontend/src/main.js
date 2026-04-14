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
