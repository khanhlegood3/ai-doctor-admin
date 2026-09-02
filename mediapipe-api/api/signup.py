import json
import re
from http.server import BaseHTTPRequestHandler

from _lib.base_handler import CORS_HEADERS
from _lib.notify import notify_admin_new_signup
from _lib.users import create_user

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            body = json.loads(raw or "{}")
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Request body must be valid JSON"})
            return

        email = (body.get("email") or "").strip()
        password = body.get("password") or ""

        if not EMAIL_RE.match(email):
            self._send_json(400, {"error": "Email không hợp lệ"})
            return
        if len(password) < 8:
            self._send_json(400, {"error": "Mật khẩu cần tối thiểu 8 ký tự"})
            return

        try:
            user = create_user(email, password)
        except Exception:
            self._send_json(500, {"error": "Internal server error"})
            return

        if user is None:
            self._send_json(409, {"error": "Email này đã đăng ký rồi"})
            return

        try:
            notify_admin_new_signup(email)
        except Exception:
            pass  # notification failure must never fail the signup itself

        self._send_json(200, {
            "status": "pending",
            "message": "Đăng ký thành công. Tài khoản đang chờ admin duyệt.",
        })
