class KpiCard extends HTMLElement {
	connectedCallback() {
		const label = this.getAttribute("label");

		this.innerHTML = `
			<p class="kpi-label">${label}</p>
			<p class="kpi-value">-</p>
			<p class="kpi-sub">-</p>
		`;

		this._valueEl = this.querySelector(".kpi-value");
		this._subEl = this.querySelector(".kpi-sub");
	}

	update(value, sub) {
		this._valueEl.textContent = value;
		this._subEl.textContent = sub;
	}
}

customElements.define("kpi-card", KpiCard);
