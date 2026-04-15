import { errorMessage } from "../utils/fetch.js";

class ErrorBanner extends HTMLElement {
	connectedCallback() {
		this.className = `${this.className} hidden max-w-7xl mx-auto px-6 pt-4`.trim();
		this.setAttribute("role", "alert");

		this.innerHTML = `
			<div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p class="text-sm text-red-700 dark:text-red-400">Failed to load data.</p>
				</div>
				<button type="button" class="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-lg leading-none" aria-label="Dismiss error">&times;</button>
			</div>
		`;

		this._messageEl = this.querySelector("p");
		this.querySelector("button").addEventListener("click", () => this.dismiss());
	}

	show(code, serverMsg) {
		this._messageEl.textContent = errorMessage(code, serverMsg);
		this.classList.remove("hidden");
	}

	dismiss() {
		this.classList.add("hidden");
	}
}

customElements.define("error-banner", ErrorBanner);
