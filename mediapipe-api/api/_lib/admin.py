"""Admin-only helpers: protected by a separate ADMIN_SECRET (never given to
customers), used by the /api/admin/* endpoints that power the dashboard.
"""
import os

from _lib.auth import ApiError, _redis_call


def check_admin_secret(headers):
    secret = headers.get("x-admin-secret") or headers.get("X-Admin-Secret")
    expected = os.environ.get("ADMIN_SECRET")
    if not expected:
        raise ApiError(500, "Server misconfigured: ADMIN_SECRET not set")
    if not secret or secret != expected:
        raise ApiError(401, "Invalid admin secret")


def list_all_keys():
    result = _redis_call("SMEMBERS", "mediapipe:keys")
    return result.get("result") or []


def scan_usage_keys(pattern):
    """Wraps Redis SCAN to fetch all keys matching a pattern (usage counters
    are not in a set, so we scan for them by prefix)."""
    cursor = "0"
    found = []
    while True:
        result = _redis_call("SCAN", cursor, "MATCH", pattern, "COUNT", "200")
        cursor, batch = result.get("result", ["0", []])
        found.extend(batch)
        if cursor == "0":
            break
    return found


def mget(keys):
    if not keys:
        return []
    result = _redis_call("MGET", *keys)
    return result.get("result") or []
