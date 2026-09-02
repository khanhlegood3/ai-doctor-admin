"""
End-user accounts (separate from admin and from the plain API-key system).

Flow: user signs up with email+password -> stored with status "pending" ->
admin reviews in the dashboard -> approve generates an API key for them
(registered into the same `mediapipe:keys` set the API endpoints already
check) or reject leaves them without access.

Passwords are hashed with PBKDF2-HMAC-SHA256 (stdlib `hashlib`, no extra
pip dependency) — 200k iterations + a random 16-byte salt per user.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from _lib.auth import _redis_call

PBKDF2_ITERATIONS = 200_000
USERS_HASH_KEY = "mediapipe:users"


def _hash_password(password, salt=None):
    salt = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return base64.b64encode(salt).decode("ascii"), base64.b64encode(dk).decode("ascii")


def verify_password(password, salt_b64, hash_b64):
    salt = base64.b64decode(salt_b64)
    _, computed = _hash_password(password, salt)
    return hmac.compare_digest(computed, hash_b64)


def get_user(email):
    result = _redis_call("HGET", USERS_HASH_KEY, email.strip().lower())
    val = result.get("result")
    return json.loads(val) if val else None


def _save_user(email, data):
    _redis_call("HSET", USERS_HASH_KEY, email.strip().lower(), json.dumps(data))


def list_users():
    result = _redis_call("HGETALL", USERS_HASH_KEY)
    flat = result.get("result") or []
    pairs = list(zip(flat[0::2], flat[1::2]))
    users = [{"email": email, **json.loads(raw)} for email, raw in pairs]
    users.sort(key=lambda u: u.get("created_at", 0), reverse=True)
    return users


def create_user(email, password):
    email = email.strip().lower()
    if get_user(email):
        return None  # already registered
    salt_b64, hash_b64 = _hash_password(password)
    data = {
        "salt": salt_b64,
        "password_hash": hash_b64,
        "status": "pending",  # pending | approved | rejected
        "created_at": int(time.time()),
        "api_key": None,
    }
    _save_user(email, data)
    return data


def approve_user(email):
    user = get_user(email)
    if not user:
        return None
    if not user.get("api_key"):
        user["api_key"] = "sk_" + secrets.token_urlsafe(24)
    user["status"] = "approved"
    _save_user(email, user)
    return user


def reject_user(email):
    user = get_user(email)
    if not user:
        return None
    user["status"] = "rejected"
    _save_user(email, user)
    return user
