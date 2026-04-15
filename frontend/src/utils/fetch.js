const ERROR_MESSAGES = {
	network_error: "Unable to reach the server. Please check the server is running.",
	request_timeout: "Request timed out. The server may be overloaded.",
	parse_error: "Failed to parse server response.",
	data_unavailable: "Campaign data is not available on the server.",
	invalid_filter: "Invalid filter value provided.",
	not_found: "API endpoint not found.",
	internal_error: "Internal server error.",
};

export function errorMessage(code, serverMsg) {
	const msg =
		serverMsg || ERROR_MESSAGES[code] || "An unexpected error occurred.";
	return `[${code}] ${msg}`;
}

export async function fetchWithRetry(url, retries, delay) {
	retries = retries || 3;
	delay = delay || 1000;
	for (let i = 0; i < retries; i++) {
		try {
			const res = await fetch(url);
			if (!res.ok) {
				let body = null;
				try {
					body = await res.json();
				} catch (_e) {
					/* not JSON */
				}
				if (body?.error?.code) {
					const apiErr = new Error(body.error.message);
					apiErr.code = body.error.code;
					apiErr.serverMessage = body.error.message;
					throw apiErr;
				}
				const httpErr = new Error(`HTTP ${res.status}`);
				httpErr.code = "network_error";
				throw httpErr;
			}
			let json;
			try {
				json = await res.json();
			} catch (_e) {
				const parseErr = new Error("Invalid JSON");
				parseErr.code = "parse_error";
				throw parseErr;
			}
			return json;
		} catch (err) {
			if (err.name === "TypeError") {
				err.code = "network_error";
			}
			if (i === retries - 1) throw err;
			if (err.code === "invalid_filter") throw err;
			await new Promise((r) => {
				setTimeout(r, delay);
			});
			delay *= 2;
		}
	}
}
