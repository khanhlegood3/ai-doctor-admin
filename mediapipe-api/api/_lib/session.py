"""
Minimal signed-cookie sessions (stdlib only, no extra deps).

Two independent session types share this module:
  - Admin session (COOKIE_NAME) — gates the whole /admin dashboard.
  - User session (USER_COOKIE_NAME) — lets a signed-up end user check
    their own approval status / API key at /account, signed with a
    separate secret (USER_SESSION_SECRET) so it's not the same trust
    boundary as the admin password.
"""
import base64
import hashlib
import hmac
import os
import time

COOKIE_NAME = "mp_admin_session"
USER_COOKIE_NAME = "mp_user_session"
SESSION_SECONDS = 12 * 60 * 60  # 12h


def _secret():
    return (os.environ.get("ADMIN_SECRET") or "").encode("utf-8")


def _sign(expiry):
    return hmac.new(_secret(), str(expiry).encode("utf-8"), hashlib.sha256).hexdigest()


def create_token():
    expiry = int(time.time()) + SESSION_SECONDS
    return f"{expiry}.{_sign(expiry)}"


def verify_token(token):
    if not token or "." not in token:
        return False
    expiry_str, sig = token.split(".", 1)
    try:
        expiry = int(expiry_str)
    except ValueError:
        return False
    if time.time() > expiry:
        return False
    expected = _sign(expiry)
    return hmac.compare_digest(sig, expected)


def check_password(password):
    secret = os.environ.get("ADMIN_SECRET") or ""
    if not secret:
        return False
    return hmac.compare_digest(password or "", secret)


def parse_cookies(cookie_header):
    cookies = {}
    if not cookie_header:
        return cookies
    for part in cookie_header.split(";"):
        if "=" in part:
            k, v = part.strip().split("=", 1)
            cookies[k] = v
    return cookies


# ---- User sessions (separate secret/trust boundary from admin) ----

def _user_secret():
    val = os.environ.get("USER_SESSION_SECRET") or os.environ.get("ADMIN_SECRET") or ""
    return val.encode("utf-8")


def create_user_token(email):
    expiry = int(time.time()) + SESSION_SECONDS
    email_b64 = base64.urlsafe_b64encode(email.encode("utf-8")).decode("ascii").rstrip("=")
    payload = f"{email_b64}.{expiry}"
    sig = hmac.new(_user_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def verify_user_token(token):
    if not token or token.count(".") != 2:
        return None
    email_b64, expiry_str, sig = token.split(".")
    try:
        expiry = int(expiry_str)
    except ValueError:
        return None
    if time.time() > expiry:
        return None
    payload = f"{email_b64}.{expiry_str}"
    expected = hmac.new(_user_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    padded = email_b64 + "=" * (-len(email_b64) % 4)
    try:
        return base64.urlsafe_b64decode(padded).decode("utf-8")
    except Exception:
        return None
