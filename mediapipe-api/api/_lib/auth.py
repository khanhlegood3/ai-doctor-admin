"""
Shared API-key auth + usage metering for the MediaPipe API.

Uses Upstash Redis REST API directly via urllib (no extra pip dependency,
keeps the Vercel function bundle small).

Required env vars (set in Vercel project settings):
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN

Key management (manual for now):
  Valid API keys live in a Redis SET called "mediapipe:keys".
  Add one with:  SADD mediapipe:keys <key>
  You can do this from the Upstash console, no extra code needed.

Usage counters:
  Each successful call increments mediapipe:usage:<key>:<YYYY-MM>
  by 1 (per request, regardless of batch size), so pricing can later
  be "per call" or you can switch to per-frame by passing a custom
  increment.
"""
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone


class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message
        super().__init__(message)


def _redis_url():
    url = os.environ.get("UPSTASH_REDIS_REST_URL")
    token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    if not url or not token:
        raise ApiError(500, "Server misconfigured: missing Upstash Redis env vars")
    return url, token


def _redis_call(*parts):
    """Call the Upstash Redis REST API with a command like ['SADD', 'key', 'member']."""
    url, token = _redis_url()
    path = "/" + "/".join(urllib.parse.quote(str(p), safe="") for p in parts)
    req = urllib.request.Request(
        url + path,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))


def check_api_key(headers):
    """Raises ApiError(401) if missing/invalid. Returns the key string."""
    key = headers.get("x-api-key") or headers.get("X-Api-Key")
    if not key:
        raise ApiError(401, "Missing X-API-Key header")

    result = _redis_call("SISMEMBER", "mediapipe:keys", key)
    if not result.get("result"):
        raise ApiError(401, "Invalid API key")
    return key


def record_usage(key, endpoint, increment=1):
    """Increments the monthly usage counter for this key. Best-effort — a
    metering failure should never block the actual API response, so callers
    should wrap this in try/except."""
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    _redis_call("INCRBY", f"mediapipe:usage:{key}:{month}", increment)
    _redis_call("INCRBY", f"mediapipe:usage:{key}:{month}:{endpoint}", increment)


def get_usage(key, month=None):
    month = month or datetime.now(timezone.utc).strftime("%Y-%m")
    total = _redis_call("GET", f"mediapipe:usage:{key}:{month}")
    per_endpoint = {}
    for ep in ("pose", "hand", "face", "gesture"):
        val = _redis_call("GET", f"mediapipe:usage:{key}:{month}:{ep}")
        per_endpoint[ep] = int(val.get("result") or 0)
    return {
        "month": month,
        "total_requests": int(total.get("result") or 0),
        "by_endpoint": per_endpoint,
    }
