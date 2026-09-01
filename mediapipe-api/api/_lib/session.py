"""
Minimal signed-cookie session for gating the /admin dashboard page.

Not a general-purpose auth system — just enough to require the admin
password once and remember it in an HttpOnly cookie for a while, instead
of re-typing it into a plain form every visit with zero access control on
the page itself.

Token format:  <expiry_unix_ts>.<hex hmac-sha256 of expiry, keyed by ADMIN_SECRET>
No user data is stored in the token, so there's nothing to leak besides
the expiry.
"""
import hashlib
import hmac
import os
import time

COOKIE_NAME = "mp_admin_session"
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
