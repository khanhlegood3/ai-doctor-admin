import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from _lib.base_handler import CORS_HEADERS
from _lib.session import USER_COOKIE_NAME, parse_cookies, verify_user_token
from _lib.users import get_user


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload, clear_cookie=False):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        if clear_cookie:
            self.send_header(
                "Set-Cookie",
                f"{USER_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
            )
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        if query.get("logout", ["0"])[0] == "1":
            self._send_json(200, {"status": "logged_out"}, clear_cookie=True)
            return

        cookies = parse_cookies(self.headers.get("Cookie"))
        email = verify_user_token(cookies.get(USER_COOKIE_NAME))
        if not email:
            self._send_json(401, {"error": "Chưa đăng nhập"})
            return

        user = get_user(email)
        if not user:
            self._send_json(404, {"error": "Không tìm thấy tài khoản"})
            return

        self._send_json(200, {
            "email": email,
            "status": user.get("status"),
            "api_key": user.get("api_key") if user.get("status") == "approved" else None,
            "created_at": user.get("created_at"),
        })
