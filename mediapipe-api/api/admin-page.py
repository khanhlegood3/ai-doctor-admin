"""
Serves the admin dashboard behind a real login instead of a bare form that
calls admin-only JSON endpoints with a secret typed into a plain input.

Flow:
  GET  /admin            -> valid session cookie?  yes: dashboard HTML
                                                     no:  login form
  POST /admin             (form field "password")  -> correct? set signed
                             HttpOnly cookie, 302 redirect to /admin
                                                     -> wrong? login form + error
  GET  /admin?logout=1    -> clear cookie, 302 redirect to /admin

Routed here via the rewrite in vercel.json (source "/admin" -> this
function), so the URL stays clean.
"""
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from _lib.admin_page_html import render_dashboard
from _lib.session import (
    COOKIE_NAME,
    check_password,
    create_token,
    parse_cookies,
    verify_token,
)

LOGIN_PAGE = """<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Đăng nhập — MediaPipe API Admin</title>
<style>
  :root {{ color-scheme: dark; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family:-apple-system, Segoe UI, Roboto, sans-serif; background:#0b0f14; color:#e6edf3; }}
  form {{ background:#161b22; border:1px solid #1f2937; border-radius:10px; padding:28px; width:320px; }}
  h1 {{ font-size:16px; margin:0 0 20px; }}
  label {{ display:block; font-size:12px; color:#8b949e; margin-bottom:6px; }}
  input {{ width:100%; padding:9px 10px; background:#0d1117; border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:14px; }}
  button {{ margin-top:16px; width:100%; padding:10px; background:#238636; border:none; border-radius:6px; color:white; font-size:14px; cursor:pointer; }}
  .err {{ color:#f85149; font-size:13px; margin-top:12px; }}
</style>
</head>
<body>
  <form method="POST" action="/admin">
    <h1>🧠 MediaPipe API — Admin</h1>
    <label>Admin Secret</label>
    <input type="password" name="password" autofocus required />
    <button type="submit">Đăng nhập</button>
    {error_html}
  </form>
</body>
</html>"""


def _read_form(handler):
    length = int(handler.headers.get("Content-Length", 0))
    raw = handler.rfile.read(length).decode("utf-8") if length else ""
    parsed = parse_qs(raw)
    return {k: v[0] for k, v in parsed.items()}


class handler(BaseHTTPRequestHandler):
    def _send_html(self, status, html, set_cookie=None, clear_cookie=False, redirect=None):
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        if redirect:
            self.send_header("Location", redirect)
        if set_cookie:
            self.send_header(
                "Set-Cookie",
                f"{COOKIE_NAME}={set_cookie}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200",
            )
        if clear_cookie:
            self.send_header(
                "Set-Cookie",
                f"{COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
            )
        body = html.encode("utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)

        if query.get("logout", ["0"])[0] == "1":
            self._send_html(302, "", clear_cookie=True, redirect="/admin")
            return

        if not os.environ.get("ADMIN_SECRET"):
            self._send_html(
                500,
                "<h1>Server misconfigured</h1><p>ADMIN_SECRET env var chưa được set trên Vercel.</p>",
            )
            return

        cookies = parse_cookies(self.headers.get("Cookie"))
        if verify_token(cookies.get(COOKIE_NAME)):
            self._send_html(200, render_dashboard(os.environ["ADMIN_SECRET"]))
        else:
            self._send_html(200, LOGIN_PAGE.format(error_html=""))

    def do_POST(self):
        form = _read_form(self)
        password = form.get("password", "")

        if check_password(password):
            token = create_token()
            self._send_html(302, "", set_cookie=token, redirect="/admin")
        else:
            error_html = '<p class="err">Sai admin secret. Thử lại.</p>'
            self._send_html(200, LOGIN_PAGE.format(error_html=error_html))
