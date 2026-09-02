import json
from http.server import BaseHTTPRequestHandler

from _lib.admin import check_admin_secret
from _lib.auth import ApiError, _redis_call, set_key_label
from _lib.base_handler import CORS_HEADERS
from _lib.notify import notify_user_approved
from _lib.users import approve_user, list_users, reject_user


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
            users = list_users()
            for u in users:
                u.pop("password_hash", None)
                u.pop("salt", None)
            self._send_json(200, {"users": users})
        except ApiError as e:
            self._send_json(e.status, {"error": e.message})
        except Exception:
            self._send_json(500, {"error": "Internal server error"})

    def do_POST(self):
        try:
            check_admin_secret(self.headers)
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            body = json.loads(raw or "{}")
            email = (body.get("email") or "").strip().lower()
            action = body.get("action")

            if not email or action not in ("approve", "reject"):
                self._send_json(400, {"error": "'email' and action ('approve'|'reject') are required"})
                return

            if action == "approve":
                user = approve_user(email)
                if not user:
                    self._send_json(404, {"error": "Không tìm thấy user"})
                    return
                # Register the generated key into the same set /api/pose etc. check
                _redis_call("SADD", "mediapipe:keys", user["api_key"])
                set_key_label(user["api_key"], email)
                try:
                    notify_user_approved(email, user["api_key"])
                except Exception:
                    pass
                self._send_json(200, {"email": email, "status": "approved", "api_key": user["api_key"]})
            else:
                user = reject_user(email)
                if not user:
                    self._send_json(404, {"error": "Không tìm thấy user"})
                    return
                self._send_json(200, {"email": email, "status": "rejected"})
        except ApiError as e:
            self._send_json(e.status, {"error": e.message})
        except Exception:
            self._send_json(500, {"error": "Internal server error"})
