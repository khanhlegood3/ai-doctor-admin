import json
from http.server import BaseHTTPRequestHandler

from _lib.admin import check_admin_secret, list_all_keys
from _lib.auth import (
    ApiError,
    _redis_call,
    get_key_stripe_customers,
    remove_key_label,
    remove_key_stripe_customer,
    set_key_label,
    set_key_stripe_customer,
)
from _lib.base_handler import CORS_HEADERS


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

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def do_GET(self):
        try:
            check_admin_secret(self.headers)
            from _lib.auth import get_key_labels
            labels = get_key_labels()
            stripe_customers = get_key_stripe_customers()
            keys = list_all_keys()
            self._send_json(200, {"keys": [
                {"api_key": k, "label": labels.get(k, ""), "stripe_customer_id": stripe_customers.get(k, "")}
                for k in keys
            ]})
        except ApiError as e:
            self._send_json(e.status, {"error": e.message})
        except Exception:
            self._send_json(500, {"error": "Internal server error"})

    def do_POST(self):
        try:
            check_admin_secret(self.headers)
            body = self._read_body()
            key = (body.get("api_key") or "").strip()
            label = (body.get("label") or "").strip()
            stripe_customer_id = (body.get("stripe_customer_id") or "").strip()
            if not key:
                self._send_json(400, {"error": "'api_key' is required"})
                return
            _redis_call("SADD", "mediapipe:keys", key)
            if label:
                set_key_label(key, label)
            if stripe_customer_id:
                set_key_stripe_customer(key, stripe_customer_id)
            self._send_json(200, {"added": key, "label": label, "stripe_customer_id": stripe_customer_id})
        except ApiError as e:
            self._send_json(e.status, {"error": e.message})
        except Exception:
            self._send_json(500, {"error": "Internal server error"})

    def do_DELETE(self):
        try:
            check_admin_secret(self.headers)
            body = self._read_body()
            key = (body.get("api_key") or "").strip()
            if not key:
                self._send_json(400, {"error": "'api_key' is required"})
                return
            _redis_call("SREM", "mediapipe:keys", key)
            remove_key_label(key)
            remove_key_stripe_customer(key)
            self._send_json(200, {"removed": key})
        except ApiError as e:
            self._send_json(e.status, {"error": e.message})
        except Exception:
            self._send_json(500, {"error": "Internal server error"})
