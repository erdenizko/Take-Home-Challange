import json
import logging
import os
import sys
import time
from collections import defaultdict
from functools import wraps
from flask import Flask, g, jsonify, request
from flasgger import Swagger, swag_from


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter."""

    def format(self, record):
        log = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        if record.exc_info and record.exc_info[0]:
            log["exception"] = self.formatException(record.exc_info)
        for key in ("method", "path", "status", "duration_ms", "remote_addr", "error_code"):
            if hasattr(record, key):
                log[key] = getattr(record, key)
        return json.dumps(log)


def setup_logging(app):
    """Configure logging: JSON in production, human-readable in development."""
    handler = logging.StreamHandler(sys.stdout)
    if app.debug:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s — %(message)s"
        ))
    else:
        handler.setFormatter(JSONFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    # Quiet noisy libraries
    logging.getLogger("werkzeug").setLevel(logging.WARNING)


app = Flask(__name__, static_folder="frontend/dist", static_url_path="/")
logger = logging.getLogger("campaign_api")

swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: rule.rule.startswith("/api"),
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/",
}

swagger_template = {
    "info": {
        "title": "Campaign Delivery API",
        "description": "API for querying campaign delivery KPIs, deal performance, and daily trends.",
        "version": "1.0.0",
    },
    "basePath": "/",
    "schemes": ["http", "https"],
}

swagger = Swagger(app, config=swagger_config, template=swagger_template)

# --- Error codes ---
ERR_DATA_UNAVAILABLE = "data_unavailable"
ERR_INVALID_FILTER = "invalid_filter"
ERR_NOT_FOUND = "not_found"
ERR_INTERNAL = "internal_error"

VALID_BUY_TYPES = {"CTV", "Display", "Audio", "BVOD"}

# Load data once at startup
try:
    with open("campaign_delivery_sample.json") as f:
        DATA = json.load(f)
    VALID_PARTNERS = {r["supply_partner"] for r in DATA}
    logger.info("Loaded %d records from campaign_delivery_sample.json", len(DATA))
except Exception:
    logger.exception("Failed to load campaign data")
    DATA = []
    VALID_PARTNERS = set()


@app.before_request
def start_timer():
    g.start_time = time.monotonic()


@app.after_request
def log_request(response):
    if request.path.startswith("/flasgger_static") or request.path == "/apispec.json":
        return response
    duration_ms = round((time.monotonic() - g.start_time) * 1000, 1)
    logger.info(
        "%s %s %s (%.1fms)",
        request.method, request.path, response.status_code, duration_ms,
        extra={
            "method": request.method,
            "path": request.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "remote_addr": request.remote_addr,
        },
    )
    return response


def api_error(code, message, http_status=400):
    """Return a standardised error response."""
    log_level = logging.ERROR if http_status >= 500 else logging.WARNING
    logger.log(
        log_level, "%s: %s", code, message,
        extra={"error_code": code, "path": request.path},
    )
    return jsonify({"error": {"code": code, "message": message}}), http_status


def validate_filters():
    """Validate and return buy_type, supply_partner, start_date, end_date from query params."""
    buy_type = request.args.get("buy_type")
    supply_partner = request.args.get("supply_partner")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if buy_type and buy_type not in VALID_BUY_TYPES:
        return None, None, None, None, api_error(
            ERR_INVALID_FILTER,
            "Invalid buy_type '{}'. Must be one of: {}".format(buy_type, ", ".join(sorted(VALID_BUY_TYPES))),
        )
    if supply_partner and supply_partner not in VALID_PARTNERS:
        return None, None, None, None, api_error(
            ERR_INVALID_FILTER,
            "Invalid supply_partner '{}'. Check /api/partners for valid values.".format(supply_partner),
        )
    if start_date and end_date and start_date > end_date:
        return None, None, None, None, api_error(
            ERR_INVALID_FILTER,
            "start_date must be before or equal to end_date.",
        )
    return buy_type, supply_partner, start_date, end_date, None


def filter_data(data, buy_type=None, supply_partner=None, start_date=None, end_date=None):
    """Filter records by buy_type, supply_partner, and/or date range."""
    if buy_type:
        data = [r for r in data if r["buy_type"] == buy_type]
    if supply_partner:
        data = [r for r in data if r["supply_partner"] == supply_partner]
    if start_date:
        data = [r for r in data if r["date"] >= start_date]
    if end_date:
        data = [r for r in data if r["date"] <= end_date]
    return data


def with_filtered_data(fn):
    """Decorator that validates filters, checks DATA, and passes filtered records to the route."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not DATA:
            return api_error(ERR_DATA_UNAVAILABLE, "Campaign data is not available.", 503)
        buy_type, supply_partner, start_date, end_date, err = validate_filters()
        if err:
            return err
        records = filter_data(DATA, buy_type, supply_partner, start_date, end_date)
        return fn(records, *args, **kwargs)
    return wrapper


def aggregate(records, group_key=None):
    """Aggregate impressions, spend, and revenue, optionally grouped by a key field."""
    groups = defaultdict(lambda: {"impressions": 0, "spend": 0.0, "revenue": 0.0})
    for r in records:
        g = groups[r[group_key] if group_key else ""]
        g["impressions"] += r["impressions"]
        g["spend"] += r["spend"]
        g["revenue"] += r["gross_revenue"]
    for totals in groups.values():
        totals["spend"] = round(totals["spend"], 2)
        totals["revenue"] = round(totals["revenue"], 2)
        totals["margin"] = round(totals["revenue"] - totals["spend"], 2)
    return groups


@app.errorhandler(404)
def not_found(e):
    return api_error(ERR_NOT_FOUND, "Endpoint not found.", 404)


@app.errorhandler(500)
def internal_error(e):
    logger.exception("Unhandled exception on %s %s", request.method, request.path)
    return api_error(ERR_INTERNAL, "Internal server error.", 500)


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/api/partners")
@swag_from("swagger/partners.yml")
def partners():
    if not DATA:
        return api_error(ERR_DATA_UNAVAILABLE, "Campaign data is not available.", 503)
    return jsonify(sorted(VALID_PARTNERS))


@app.route("/api/summary")
@swag_from("swagger/summary.yml")
@with_filtered_data
def summary(records):
    totals = aggregate(records)[""]
    return jsonify(totals)


@app.route("/api/by-buy-type")
@swag_from("swagger/by_buy_type.yml")
def by_buy_type():
    groups = aggregate(DATA, group_key="buy_type")
    result = [
        {"buy_type": bt, **totals}
        for bt, totals in sorted(groups.items())
    ]
    return jsonify(result)


@app.route("/api/daily-trends")
@swag_from("swagger/daily_trends.yml")
@with_filtered_data
def daily_trends(records):
    groups = aggregate(records, group_key="date")
    result = [{"date": date, **totals} for date, totals in sorted(groups.items())]
    return jsonify(result)


@app.route("/api/deals")
@swag_from("swagger/deals.yml")
@with_filtered_data
def deals(records):
    totals = aggregate(records, group_key="deal_id")

    # Build deal metadata (fields not covered by aggregate)
    meta = {}
    for r in records:
        did = r["deal_id"]
        if did not in meta:
            meta[did] = {
                "buy_type": r["buy_type"],
                "supply_partner": r["supply_partner"],
                "start_date": r["date"],
                "end_date": r["date"],
            }
        else:
            m = meta[did]
            if r["date"] < m["start_date"]:
                m["start_date"] = r["date"]
            if r["date"] > m["end_date"]:
                m["end_date"] = r["date"]

    result = [
        {"deal_id": did, **meta[did], **totals[did]}
        for did in totals
    ]
    result.sort(key=lambda x: x["margin"], reverse=True)
    return jsonify(result)


setup_logging(app)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=True, port=port)
