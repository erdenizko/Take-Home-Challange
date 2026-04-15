import flatpickr from "flatpickr";
import { fmtDate } from "../utils/formatters.js";

const PRESETS = [
	{ label: "Last 7 days", value: "last_7" },
	{ label: "Last 30 days", value: "last_30" },
	{ label: "This month", value: "this_month" },
	{ label: "Previous month", value: "prev_month" },
	{ label: "All time", value: "all" },
];

class DateRangePicker extends HTMLElement {
	connectedCallback() {
		this.className = `${this.className} relative flex items-center gap-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-full pl-1 pr-3 py-1 cursor-pointer`.trim();

		this.innerHTML = `
			<div class="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center shrink-0">
				<svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
				</svg>
			</div>
			<input type="text" readonly placeholder="All Dates" aria-label="Date range filter" class="text-sm text-gray-700 dark:text-gray-200 bg-transparent border-none outline-none cursor-pointer w-44">
			<svg class="w-3 h-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		`;

		const input = this.querySelector("input");
		const params = new URLSearchParams(location.search);
		const start = this.getAttribute("start") || params.get("start_date") || "";
		const end = this.getAttribute("end") || params.get("end_date") || "";

		this._picker = flatpickr(input, {
			mode: "range",
			dateFormat: "Y-m-d",
			altInput: true,
			altFormat: "M j",
			defaultDate: start && end ? [start, end] : [],
			onClose: (selectedDates) => {
				if (selectedDates.length === 2) {
					this._emit(fmtDate(selectedDates[0]), fmtDate(selectedDates[1]));
				} else if (selectedDates.length === 0) {
					this._emit(null, null);
				}
			},
			onReady: (_selectedDates, _dateStr, instance) => {
				const presets = document.createElement("div");
				presets.className = "flatpickr-presets";
				PRESETS.forEach((p) => {
					const btn = document.createElement("button");
					btn.type = "button";
					btn.textContent = p.label;
					btn.className = "flatpickr-preset-btn";
					btn.addEventListener("click", () => this._applyPreset(p.value));
					presets.appendChild(btn);
				});
				instance.calendarContainer.appendChild(presets);
			},
		});
	}

	_emit(start, end) {
		this.dispatchEvent(new CustomEvent("date-change", { detail: { start, end } }));
	}

	_applyPreset(preset) {
		const today = new Date();
		let start, end;
		switch (preset) {
			case "last_7":
				end = new Date(today);
				start = new Date(today);
				start.setDate(start.getDate() - 6);
				break;
			case "last_30":
				end = new Date(today);
				start = new Date(today);
				start.setDate(start.getDate() - 29);
				break;
			case "this_month":
				start = new Date(today.getFullYear(), today.getMonth(), 1);
				end = new Date(today);
				break;
			case "prev_month":
				start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
				end = new Date(today.getFullYear(), today.getMonth(), 0);
				break;
			default:
				this._picker.clear();
				this._emit(null, null);
				return;
		}
		this._picker.setDate([start, end]);
	}
}

customElements.define("date-range-picker", DateRangePicker);
