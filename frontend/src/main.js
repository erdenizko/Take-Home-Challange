import "./style.css";
import "./components/filter-chip.js";
import "./components/kpi-card.js";
import "./components/theme-toggle.js";
import "./components/error-banner.js";
import "./components/date-range-picker.js";

import { fmtNum, fmtCurrency } from "./utils/formatters.js";
import { fetchWithRetry } from "./utils/fetch.js";
import { renderChart, updateChartColors } from "./modules/chart.js";
import { renderDeals, setupSortListeners } from "./modules/deals-table.js";
import { exportCSV } from "./modules/csv-export.js";

document.addEventListener("DOMContentLoaded", () => {
	// --- State ---
	const state = {
		dealsData: [],
		sortCol: "margin",
		sortAsc: false,
		trendChart: null,
	};

	// --- Dark mode ---
	document.querySelector("theme-toggle").addEventListener("theme-change", () => {
		if (state.trendChart) updateChartColors(state.trendChart);
	});

	// --- DOM refs ---
	const errorBanner = document.getElementById("error-banner");
	const filterEl = document.querySelector("filter-chip[name='filter']");
	const partnerEl = document.querySelector("filter-chip[name='partner-filter']");
	const kpiCards = Object.fromEntries(
		[...document.querySelectorAll("kpi-card[key]")].map((c) => [c.getAttribute("key"), c]),
	);

	// --- Helpers ---
	function setParam(key, value) {
		const params = new URLSearchParams(location.search);
		if (value) params.set(key, value);
		else params.delete(key);
		history.replaceState(null, "", params.size ? `?${params}` : location.pathname);
	}

	function buildUrl(path) {
		return location.search ? `${path}${location.search}` : path;
	}

	// --- Dashboard loader ---
	async function loadDashboard() {
		errorBanner.dismiss();
		try {
			const [summary, trends, deals] = await Promise.all([
				fetchWithRetry(buildUrl("/api/summary")),
				fetchWithRetry(buildUrl("/api/daily-trends")),
				fetchWithRetry(buildUrl("/api/deals")),
			]);

			const isEmpty = summary.impressions === 0 && deals.length === 0;
			document
				.getElementById("empty-state")
				.classList.toggle("hidden", !isEmpty);
			document
				.getElementById("dashboard-content")
				.classList.toggle("hidden", isEmpty);

			if (!isEmpty) {
				const perK = (val) => summary.impressions > 0 ? ((val / summary.impressions) * 1000).toFixed(2) : "0.00";
				kpiCards.impressions.update(fmtNum(summary.impressions), `${fmtNum(Math.round(summary.impressions / 30))} avg/day`);
				kpiCards.revenue.update(fmtCurrency(summary.revenue), `\u00A3${perK(summary.revenue)} per 1K imp.`);
				kpiCards.spend.update(fmtCurrency(summary.spend), `\u00A3${perK(summary.spend)} per 1K imp.`);
				state.trendChart = renderChart(trends, state.trendChart);
				state.dealsData = deals;
				renderDeals(state.dealsData, state.sortCol, state.sortAsc);
			}
		} catch (err) {
			errorBanner.show(err.code || "network_error", err.serverMessage);
		}
	}

	// --- Partners dropdown ---
	async function loadPartners() {
		try {
			const partners = await fetchWithRetry("/api/partners");
			partners.forEach((p) => partnerEl.addOption(p, p));
		} catch (err) {
			errorBanner.show(err.code || "network_error", err.serverMessage);
		}
	}

	// --- Event listeners ---
	filterEl.addEventListener("change", () => {
		setParam("buy_type", filterEl.value);
		loadDashboard();
	});
	partnerEl.addEventListener("change", () => {
		setParam("supply_partner", partnerEl.value);
		loadDashboard();
	});

	setupSortListeners((col) => {
		if (state.sortCol === col) {
			state.sortAsc = !state.sortAsc;
		} else {
			state.sortCol = col;
			state.sortAsc = col === "deal_id";
		}
		renderDeals(state.dealsData, state.sortCol, state.sortAsc);
	});

	// --- Export ---
	document.getElementById("export-btn").addEventListener("click", () =>
		exportCSV(state.dealsData, {
			buyType: filterEl.value,
			partner: partnerEl.value,
		}),
	);

	// --- Date range ---
	const datePickerEl = document.getElementById("date-picker");
	datePickerEl.addEventListener("date-change", ({ detail }) => {
		setParam("start_date", detail.start || "");
		setParam("end_date", detail.end || "");
		loadDashboard();
	});

	// --- Init ---
	(async function init() {
		const params = new URLSearchParams(location.search);

		filterEl.value = params.get("buy_type") || "";

		await loadPartners();
		partnerEl.value = params.get("supply_partner") || "";

		loadDashboard();
	})();
});
