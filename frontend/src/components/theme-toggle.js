class ThemeToggle extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<button type="button" aria-label="Toggle dark mode"
				class="w-9 h-9 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
				<svg class="sun w-4.5 h-4.5 text-gray-500 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
				</svg>
				<svg class="moon w-4.5 h-4.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
				</svg>
			</button>
		`;

		const sun = this.querySelector(".sun");
		const moon = this.querySelector(".moon");
		const isDark = document.documentElement.classList.contains("dark");
		sun.classList.toggle("hidden", !isDark);
		moon.classList.toggle("hidden", isDark);

		this.querySelector("button").addEventListener("click", () => {
			const dark = document.documentElement.classList.toggle("dark");
			localStorage.setItem("theme", dark ? "dark" : "light");
			sun.classList.toggle("hidden", !dark);
			moon.classList.toggle("hidden", dark);
			this.dispatchEvent(new CustomEvent("theme-change", { detail: { dark } }));
		});
	}
}

customElements.define("theme-toggle", ThemeToggle);
