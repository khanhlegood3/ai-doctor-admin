"""Shared helpers: parse request body, decode base64 images to numpy arrays."""
import base64
import json

import cv2
import numpy as np

MAX_FRAMES = 30  # cap batch/video-frame requests so one call can't run forever


class BadRequest(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(message)


def _decode_one(b64_str):
    if "," in b64_str and b64_str.strip().startswith("data:"):
        b64_str = b64_str.split(",", 1)[1]
    try:
        raw = base64.b64decode(b64_str)
    except Exception:
        raise BadRequest("Invalid base64 image data")
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise BadRequest("Could not decode image (must be valid JPEG/PNG bytes)")
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def parse_images_from_body(raw_body):
    """Accepts JSON body with either:
      { "image": "<base64>" }              -> single image
      { "frames": ["<base64>", ...] }       -> batch / video frames
    Returns a list of RGB numpy arrays (length 1 for single-image requests).
    """
    try:
        body = json.loads(raw_body or "{}")
    except json.JSONDecodeError:
        raise BadRequest("Request body must be valid JSON")

    if "frames" in body:
        frames = body["frames"]
        if not isinstance(frames, list) or not frames:
            raise BadRequest("'frames' must be a non-empty array of base64 images")
        if len(frames) > MAX_FRAMES:
            raise BadRequest(f"Too many frames in one request (max {MAX_FRAMES})")
        return [_decode_one(f) for f in frames]

    if "image" in body:
        return [_decode_one(body["image"])]

    raise BadRequest("Request body must include 'image' (single) or 'frames' (array)")
