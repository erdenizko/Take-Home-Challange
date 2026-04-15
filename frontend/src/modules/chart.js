import Chart from "chart.js/auto";
import { fmtNum } from "../utils/formatters.js";

function cssVar(name) {
	return getComputedStyle(document.documentElement)
		.getPropertyValue(name)
		.trim();
}

function chartColors() {
	return {
		revenue: cssVar("--chart-revenue"),
		spend: cssVar("--chart-spend"),
		gridColor: cssVar("--chart-grid"),
		tickColor: cssVar("--chart-tick"),
	};
}

export function updateChartColors(chart) {
	const c = chartColors();
	chart.data.datasets[0].backgroundColor = c.revenue;
	chart.data.datasets[1].backgroundColor = c.spend;
	chart.options.scales.x.ticks.color = c.tickColor;
	chart.options.scales.y.grid.color = c.gridColor;
	chart.options.scales.y.ticks.color = c.tickColor;
	chart.update();
}

export function renderChart(trends, existingChart) {
	const labels = trends.map((t) => t.date.slice(5));
	const revenue = trends.map((t) => t.revenue);
	const spend = trends.map((t) => -t.spend);

	if (existingChart) {
		existingChart.data.labels = labels;
		existingChart.data.datasets[0].data = revenue;
		existingChart.data.datasets[1].data = spend;
		existingChart.update();
		return existingChart;
	}

	const c = chartColors();
	return new Chart(document.getElementById("trend-chart"), {
		type: "bar",
		data: {
			labels: labels,
			datasets: [
				{
					label: "Revenue",
					data: revenue,
					backgroundColor: c.revenue,
					borderRadius: 4,
					borderSkipped: "bottom",
					stack: "stack0",
				},
				{
					label: "Spend",
					data: spend,
					backgroundColor: c.spend,
					borderRadius: 4,
					borderSkipped: "bottom",
					stack: "stack0",
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
						label: (ctx) => {
							const val = Math.abs(ctx.raw);
							return `${ctx.dataset.label}: \u00A3${fmtNum(val)}`;
						},
					},
				},
			},
			scales: {
				x: {
					stacked: true,
					grid: { display: false },
					ticks: { font: { size: 11 }, color: c.tickColor },
				},
				y: {
					stacked: true,
					grid: { color: c.gridColor },
					border: { display: false },
					ticks: {
						callback: (v) => {
							const abs = Math.abs(v);
							if (abs >= 1000) return `\u00A3${(v / 1000).toFixed(0)}K`;
							return `\u00A3${v}`;
						},
						font: { size: 11 },
						color: c.tickColor,
					},
				},
			},
		},
	});
}
