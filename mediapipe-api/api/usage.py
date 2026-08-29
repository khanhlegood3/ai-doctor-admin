import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from _lib.auth import ApiError, check_api_key, get_usage
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

    def do_GET(self):
        try:
            api_key = check_api_key(self.headers)
            month = parse_qs(urlparse(self.path).query).get("month", [None])[0]
            self._send_json(200, get_usage(api_key, month))
        except ApiError as e:
            self._send_json(e.status, {"error": e.message})
        except Exception:
            self._send_json(500, {"error": "Internal server error"})
