"""Public health/status endpoint — no auth required. Only returns booleans
and non-secret config values (never the actual Redis token or admin secret),
so it's safe to leave publicly reachable for deploy debugging.
"""
import json
import os
from http.server import BaseHTTPRequestHandler

from _lib.auth import _redis_call
from _lib.base_handler import CORS_HEADERS


def check_redis():
    try:
        result = _redis_call("PING")
        return result.get("result") == "PONG"
    except Exception:
        return False


def build_status():
    redis_ok = check_redis()
    return {
        "redis_connected": redis_ok,
        "upstash_env_vars_set": bool(
            os.environ.get("UPSTASH_REDIS_REST_URL") and os.environ.get("UPSTASH_REDIS_REST_TOKEN")
        ),
        "admin_secret_set": bool(os.environ.get("ADMIN_SECRET")),
        "price_per_call_usd": float(os.environ.get("PRICE_PER_CALL_USD", "0.001")),
        "rate_limit_per_minute": int(os.environ.get("RATE_LIMIT_PER_MINUTE", "0") or "0"),
        "ready": redis_ok and bool(os.environ.get("ADMIN_SECRET")),
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
            self._send_json(200, build_status())
        except Exception:
            self._send_json(500, {"error": "Internal server error"})
