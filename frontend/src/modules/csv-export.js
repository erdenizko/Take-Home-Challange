export function exportCSV(dealsData, filters) {
	if (!dealsData.length) return;
	const headers = [
		"Deal ID",
		"Buy Type",
		"Partner",
		"Impressions",
		"Spend",
		"Revenue",
		"Margin",
	];
	const rows = dealsData.map((d) => [
		d.deal_id,
		d.buy_type,
		d.supply_partner,
		d.impressions,
		d.spend,
		d.revenue,
		d.margin,
	]);
	const csv = [headers.join(",")]
		.concat(rows.map((r) => r.join(",")))
		.join("\n");
	const blob = new Blob([csv], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	const parts = ["broadlab_impression_trends"];
	if (filters.buyType) parts.push(filters.buyType.toLowerCase());
	if (filters.partner)
		parts.push(filters.partner.toLowerCase().replace(/\s+/g, "_"));
	a.download = `${parts.join("_")}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}
