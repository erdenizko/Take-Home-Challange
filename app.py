import json
import os
from collections import defaultdict
from flask import Flask, jsonify, request

app = Flask(__name__, static_folder="frontend/dist", static_url_path="/")

# --- Error codes ---
# API-1xx: Data errors
# API-100: Data file not found or failed to load
# API-101: Invalid filter value
# API-102: No data matching filters
VALID_BUY_TYPES = {"CTV", "Display", "Audio", "BVOD"}

# Load data once at startup
try:
    with open("campaign_delivery_sample.json") as f:
        DATA = json.load(f)
    VALID_PARTNERS = {r["supply_partner"] for r in DATA}
except Exception:
    DATA = []
    VALID_PARTNERS = set()


def api_error(code, message, http_status=400):
    """Return a standardised error response."""
    return jsonify({"error": {"code": code, "message": message}}), http_status


def validate_filters():
    """Validate and return buy_type, supply_partner, start_date, end_date from query params."""
    buy_type = request.args.get("buy_type")
    supply_partner = request.args.get("supply_partner")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if buy_type and buy_type not in VALID_BUY_TYPES:
        return None, None, None, None, api_error(
            "API-101",
            "Invalid buy_type '{}'. Must be one of: {}".format(buy_type, ", ".join(sorted(VALID_BUY_TYPES))),
        )
    if supply_partner and supply_partner not in VALID_PARTNERS:
        return None, None, None, None, api_error(
            "API-101",
            "Invalid supply_partner '{}'. Check /api/partners for valid values.".format(supply_partner),
        )
    if start_date and end_date and start_date > end_date:
        return None, None, None, None, api_error(
            "API-101",
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


@app.errorhandler(404)
def not_found(e):
    return api_error("API-104", "Endpoint not found.", 404)


@app.errorhandler(500)
def internal_error(e):
    return api_error("API-105", "Internal server error.", 500)


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/api/partners")
def partners():
    """List of unique supply partners for the filter dropdown."""
    if not DATA:
        return api_error("API-100", "Campaign data is not available.", 503)
    return jsonify(sorted(VALID_PARTNERS))


@app.route("/api/summary")
def summary():
    """Overall KPI totals, optionally filtered by buy_type and/or supply_partner."""
    if not DATA:
        return api_error("API-100", "Campaign data is not available.", 503)
    buy_type, supply_partner, start_date, end_date, err = validate_filters()
    if err:
        return err
    records = filter_data(DATA, buy_type, supply_partner, start_date, end_date)
    total_impressions = sum(r["impressions"] for r in records)
    total_spend = round(sum(r["spend"] for r in records), 2)
    total_revenue = round(sum(r["gross_revenue"] for r in records), 2)
    margin = round(total_revenue - total_spend, 2)

    return jsonify({
        "impressions": total_impressions,
        "spend": total_spend,
        "revenue": total_revenue,
        "margin": margin,
    })


@app.route("/api/by-buy-type")
def by_buy_type():
    """Breakdown of KPIs per buy_type."""
    groups = defaultdict(lambda: {"impressions": 0, "spend": 0.0, "revenue": 0.0})

    for r in DATA:
        g = groups[r["buy_type"]]
        g["impressions"] += r["impressions"]
        g["spend"] += r["spend"]
        g["revenue"] += r["gross_revenue"]

    result = []
    for buy_type, totals in sorted(groups.items()):
        result.append({
            "buy_type": buy_type,
            "impressions": totals["impressions"],
            "spend": round(totals["spend"], 2),
            "revenue": round(totals["revenue"], 2),
            "margin": round(totals["revenue"] - totals["spend"], 2),
        })

    return jsonify(result)


@app.route("/api/daily-trends")
def daily_trends():
    """Daily impressions, spend, and revenue. Optionally filtered by buy_type and/or supply_partner."""
    if not DATA:
        return api_error("API-100", "Campaign data is not available.", 503)
    buy_type, supply_partner, start_date, end_date, err = validate_filters()
    if err:
        return err
    records = filter_data(DATA, buy_type, supply_partner, start_date, end_date)
    days = defaultdict(lambda: {"impressions": 0, "spend": 0.0, "revenue": 0.0})

    for r in records:
        d = days[r["date"]]
        d["impressions"] += r["impressions"]
        d["spend"] += r["spend"]
        d["revenue"] += r["gross_revenue"]

    result = []
    for date in sorted(days):
        totals = days[date]
        result.append({
            "date": date,
            "impressions": totals["impressions"],
            "spend": round(totals["spend"], 2),
            "revenue": round(totals["revenue"], 2),
        })

    return jsonify(result)


@app.route("/api/deals")
def deals():
    """Deal-level aggregated performance. Optionally filtered by buy_type and/or supply_partner."""
    if not DATA:
        return api_error("API-100", "Campaign data is not available.", 503)
    buy_type, supply_partner, start_date, end_date, err = validate_filters()
    if err:
        return err
    records = filter_data(DATA, buy_type, supply_partner, start_date, end_date)
    deal_map = {}

    for r in records:
        did = r["deal_id"]
        if did not in deal_map:
            deal_map[did] = {
                "deal_id": did,
                "buy_type": r["buy_type"],
                "supply_partner": r["supply_partner"],
                "impressions": 0,
                "spend": 0.0,
                "revenue": 0.0,
            }
        d = deal_map[did]
        d["impressions"] += r["impressions"]
        d["spend"] += r["spend"]
        d["revenue"] += r["gross_revenue"]

    result = []
    for d in deal_map.values():
        d["spend"] = round(d["spend"], 2)
        d["revenue"] = round(d["revenue"], 2)
        d["margin"] = round(d["revenue"] - d["spend"], 2)
        result.append(d)

    result.sort(key=lambda x: x["margin"], reverse=True)
    return jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=True, port=port)
