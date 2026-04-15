import { fmtNum, fmtCurrency } from "../utils/formatters.js";

function createCell(text, classes, subText) {
	const td = document.createElement("td");
	td.className = classes || "";
	if (subText) {
		const main = document.createElement("div");
		main.textContent = text;
		const sub = document.createElement("div");
		sub.textContent = subText;
		sub.className = "deal-sub-text";
		td.appendChild(main);
		td.appendChild(sub);
	} else {
		td.textContent = text;
	}
	return td;
}

export function renderDeals(dealsData, sortCol, sortAsc) {
	const sorted = dealsData.slice().sort((a, b) => {
		const valA = a[sortCol];
		const valB = b[sortCol];
		if (typeof valA === "string")
			return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
		return sortAsc ? valA - valB : valB - valA;
	});

	const tbody = document.getElementById("deals-body");
	while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

	sorted.forEach((d) => {
		const tr = document.createElement("tr");
		tr.className = "deal-row";

		const dateStr =
			d.start_date === d.end_date
				? d.start_date?.slice(5) || ""
				: `${d.start_date?.slice(5) || ""} – ${d.end_date?.slice(5) || ""}`;

		const dealCell = createCell(
			`${d.deal_id} · ${d.buy_type}`,
			"deal-cell",
			`${d.supply_partner} · ${dateStr}`,
		);
		dealCell.querySelector("div:first-child").classList.add("font-medium");
		tr.appendChild(dealCell);

		const impCell = createCell(fmtNum(d.impressions), "metric-cell");
		impCell.setAttribute("data-label", "Impressions");
		tr.appendChild(impCell);

		const imp = d.impressions || 0;
		const impPerSpend =
			imp > 0 && d.spend > 0 ? (imp / d.spend).toFixed(1) : "-";
		const revPerImp = imp > 0 ? ((d.revenue / imp) * 1000).toFixed(2) : "-";
		const marginPerImp = imp > 0 ? ((d.margin / imp) * 1000).toFixed(2) : "-";

		const spendCell = createCell(
			fmtCurrency(d.spend),
			"metric-cell",
			`${impPerSpend} imp/£`,
		);
		spendCell.setAttribute("data-label", "Spend");
		tr.appendChild(spendCell);

		const revCell = createCell(
			fmtCurrency(d.revenue),
			"metric-cell",
			`£${revPerImp}/1K imp`,
		);
		revCell.setAttribute("data-label", "Revenue");
		tr.appendChild(revCell);

		const marginColor = d.margin >= 0 ? "text-green-700" : "text-red-700";
		const marginCell = createCell(
			fmtCurrency(d.margin),
			`metric-cell ${marginColor}`,
			`£${marginPerImp}/1K imp`,
		);
		marginCell.setAttribute("data-label", "Margin");
		tr.appendChild(marginCell);

		tbody.appendChild(tr);
	});

	document.querySelectorAll("th[data-sort]").forEach((th) => {
		const col = th.dataset.sort;
		const base = th.textContent.replace(/ [\u25B2\u25BC]$/, "");
		th.textContent =
			col === sortCol ? `${base} ${sortAsc ? "\u25B2" : "\u25BC"}` : base;
	});
}

export function setupSortListeners(onSort) {
	document.querySelectorAll("th[data-sort]").forEach((th) => {
		th.addEventListener("click", () => onSort(th.dataset.sort));
		th.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				th.click();
			}
		});
	});
}
