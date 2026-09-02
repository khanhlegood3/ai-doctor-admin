import json
from http.server import BaseHTTPRequestHandler

from _lib.base_handler import CORS_HEADERS
from _lib.session import USER_COOKIE_NAME, create_user_token
from _lib.users import get_user, verify_password


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload, set_cookie=None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        if set_cookie:
            self.send_header(
                "Set-Cookie",
                f"{USER_COOKIE_NAME}={set_cookie}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200",
            )
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

        email = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""

        try:
            user = get_user(email)
        except Exception:
            self._send_json(500, {"error": "Internal server error"})
            return

        if not user or not verify_password(password, user["salt"], user["password_hash"]):
            self._send_json(401, {"error": "Sai email hoặc mật khẩu"})
            return

        token = create_user_token(email)
        self._send_json(200, {"status": "ok"}, set_cookie=token)
