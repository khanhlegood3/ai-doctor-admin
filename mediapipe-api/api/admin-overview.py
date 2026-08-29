import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from _lib.admin import check_admin_secret, list_all_keys, mget, scan_usage_keys
from _lib.auth import ApiError
from _lib.base_handler import CORS_HEADERS

PRICE_PER_CALL_USD = float(os.environ.get("PRICE_PER_CALL_USD", "0.001"))
ENDPOINTS = ("pose", "hand", "face", "gesture")


def _month_str(month):
    return month or datetime.now(timezone.utc).strftime("%Y-%m")


def build_overview(month):
    keys = list_all_keys()
    rows = []
    total_calls = 0

    for key in keys:
        total_key = f"mediapipe:usage:{key}:{month}"
        per_ep_keys = [f"mediapipe:usage:{key}:{month}:{ep}" for ep in ENDPOINTS]
        values = mget([total_key] + per_ep_keys)
        total = int(values[0] or 0) if values else 0
        by_endpoint = {ep: int(values[i + 1] or 0) for i, ep in enumerate(ENDPOINTS)} if values else {}

        rows.append({
            "api_key": key,
            "total_requests": total,
            "by_endpoint": by_endpoint,
            "estimated_cost_usd": round(total * PRICE_PER_CALL_USD, 4),
        })
        total_calls += total

    rows.sort(key=lambda r: r["total_requests"], reverse=True)
    return {
        "month": month,
        "price_per_call_usd": PRICE_PER_CALL_USD,
        "total_keys": len(keys),
        "total_requests": total_calls,
        "total_estimated_cost_usd": round(total_calls * PRICE_PER_CALL_USD, 4),
        "keys": rows,
    }


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        try:
            check_admin_secret(self.headers)
            month = parse_qs(urlparse(self.path).query).get("month", [None])[0]
            self._send_json(200, build_overview(_month_str(month)))
        except ApiError as e:
            self._send_json(e.status, {"error": e.message})
        except Exception:
            self._send_json(500, {"error": "Internal server error"})
