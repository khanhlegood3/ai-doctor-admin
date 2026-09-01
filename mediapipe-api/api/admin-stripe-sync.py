"""
GET/POST /api/admin-stripe-sync

For each API key that has a linked Stripe Customer ID, computes how many
calls happened this month that haven't been reported to Stripe yet
(current usage counter minus the last synced count), reports that delta
as a Stripe Billing Meter event, then remembers the new synced count so
the next run only reports what's new.

Two ways this gets called:
  - Vercel Cron (GET), authenticated via `Authorization: Bearer <CRON_SECRET>`
    which Vercel attaches automatically when CRON_SECRET is set.
  - The admin dashboard's "Đồng bộ lên Stripe" button (POST), authenticated
    via the normal `X-Admin-Secret` header like other admin endpoints.
"""
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from _lib.admin import check_admin_secret, list_all_keys
from _lib.auth import ApiError, get_key_stripe_customers, get_synced_count, set_synced_count
from _lib.base_handler import CORS_HEADERS
from _lib.stripe_billing import StripeError, report_meter_event


def _month_str(month):
    return month or datetime.now(timezone.utc).strftime("%Y-%m")


def _current_usage(key, month):
    from _lib.admin import mget
    values = mget([f"mediapipe:usage:{key}:{month}"])
    return int(values[0] or 0) if values else 0


def run_sync(month):
    month = _month_str(month)
    keys = list_all_keys()
    customer_map = get_key_stripe_customers()

    results = []
    for key in keys:
        customer_id = customer_map.get(key)
        if not customer_id:
            continue  # no Stripe customer linked yet, nothing to report

        current = _current_usage(key, month)
        already_synced = get_synced_count(key, month)
        delta = current - already_synced

        if delta <= 0:
            results.append({"api_key": key, "customer_id": customer_id, "reported": 0, "status": "up_to_date"})
            continue

        try:
            report_meter_event(
                customer_id,
                delta,
                identifier=f"{key}:{month}:{current}",  # unique per sync point, safe to retry
            )
            set_synced_count(key, month, current)
            results.append({"api_key": key, "customer_id": customer_id, "reported": delta, "status": "ok"})
        except StripeError as e:
            results.append({"api_key": key, "customer_id": customer_id, "reported": 0, "status": "error", "error": str(e)})

    return {"month": month, "keys_with_stripe_customer": len(results), "results": results}


def _check_cron_auth(headers):
    cron_secret = os.environ.get("CRON_SECRET")
    auth_header = headers.get("Authorization") or headers.get("authorization")
    if cron_secret and auth_header == f"Bearer {cron_secret}":
        return True
    return False


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

    def _run(self):
        month = parse_qs(urlparse(self.path).query).get("month", [None])[0]
        self._send_json(200, run_sync(month))

    def do_GET(self):
        try:
            if not _check_cron_auth(self.headers):
                check_admin_secret(self.headers)  # allow manual GET too, for testing
            self._run()
        except ApiError as e:
            self._send_json(e.status, {"error": e.message})
        except Exception as e:
            self._send_json(500, {"error": f"Internal server error: {e}"})

    def do_POST(self):
        try:
            check_admin_secret(self.headers)
            self._run()
        except ApiError as e:
            self._send_json(e.status, {"error": e.message})
        except Exception as e:
            self._send_json(500, {"error": f"Internal server error: {e}"})
