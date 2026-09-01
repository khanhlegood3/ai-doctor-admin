"""
Reports usage to Stripe's Billing Meters API so subscriptions on a metered
Price bill automatically at the end of each billing cycle.

Uses urllib directly (no `stripe` pip package) to keep the function bundle
small, consistent with the rest of this backend.

One-time setup required in the Stripe Dashboard (not done by this code):
  1. Billing -> Meters -> create a meter, event name must match
     STRIPE_METER_EVENT_NAME (default "mediapipe_api_calls").
  2. Create a metered Price attached to that meter (set your per-unit price
     there — PRICE_PER_CALL_USD in this project is only used for the
     dashboard's own estimate, Stripe's Price is the actual source of truth
     for what gets charged).
  3. For each paying customer: create a Stripe Customer + subscribe them to
     that metered Price (Stripe Checkout, Payment Links, or manually in the
     dashboard all work). Copy their Stripe Customer ID into this admin
     dashboard's key management screen.
Once that's done, this module just reports "customer X used N calls" and
Stripe handles invoicing/charging on its own schedule.
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

STRIPE_API_BASE = "https://api.stripe.com/v1"


class StripeError(Exception):
    pass


def _stripe_request(path, data):
    secret_key = os.environ.get("STRIPE_SECRET_KEY")
    if not secret_key:
        raise StripeError("STRIPE_SECRET_KEY env var not set")

    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        STRIPE_API_BASE + path,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise StripeError(f"Stripe API error {e.code}: {detail}")


def report_meter_event(customer_id, value, event_name=None, identifier=None):
    """Reports `value` units of usage for a Stripe customer. `identifier`
    should be unique per event to make retries safe (Stripe dedupes on it)."""
    event_name = event_name or os.environ.get("STRIPE_METER_EVENT_NAME", "mediapipe_api_calls")
    data = {
        "event_name": event_name,
        "payload[stripe_customer_id]": customer_id,
        "payload[value]": str(value),
        "timestamp": str(int(time.time())),
    }
    if identifier:
        data["identifier"] = identifier
    return _stripe_request("/billing/meter_events", data)
