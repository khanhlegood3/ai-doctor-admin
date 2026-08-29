"""Common request-handling flow shared by every task endpoint (pose/hand/face/gesture).

Each endpoint file just supplies `endpoint_name` and a `process(images) -> dict`
function; this module handles: CORS, API-key auth, body parsing, usage
metering, and turning exceptions into consistent JSON error responses.
"""
import json
import traceback
from http.server import BaseHTTPRequestHandler

from _lib.auth import ApiError, check_api_key, record_usage
from _lib.imaging import BadRequest, parse_images_from_body

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
}


def make_handler(endpoint_name, process_fn):
    class Handler(BaseHTTPRequestHandler):
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

        def do_POST(self):
            try:
                api_key = check_api_key(self.headers)

                length = int(self.headers.get("Content-Length", 0))
                raw_body = self.rfile.read(length).decode("utf-8") if length else "{}"
                images = parse_images_from_body(raw_body)

                result = process_fn(images)

                try:
                    record_usage(api_key, endpoint_name)
                except Exception:
                    pass  # metering must never break the actual response

                self._send_json(200, {"endpoint": endpoint_name, "frame_count": len(images), **result})

            except ApiError as e:
                self._send_json(e.status, {"error": e.message})
            except BadRequest as e:
                self._send_json(400, {"error": e.message})
            except Exception:
                traceback.print_exc()
                self._send_json(500, {"error": "Internal server error"})

    return Handler
