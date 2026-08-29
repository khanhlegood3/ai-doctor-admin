"""
Downloads MediaPipe .task model files into /tmp on cold start and reuses
them on warm invocations (Vercel keeps /tmp around for the life of the
execution environment, not per-request). Keeping model binaries out of git
keeps the repo/deploy small.

If Google ever changes these URLs, override with env vars:
  POSE_MODEL_URL, HAND_MODEL_URL, FACE_MODEL_URL, GESTURE_MODEL_URL
"""
import os
import urllib.request

MODEL_DIR = "/tmp/mediapipe-models"

DEFAULT_URLS = {
    "pose_landmarker.task": (
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
        "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
    ),
    "hand_landmarker.task": (
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
        "hand_landmarker/float16/latest/hand_landmarker.task"
    ),
    "face_landmarker.task": (
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
        "face_landmarker/float16/latest/face_landmarker.task"
    ),
    "gesture_recognizer.task": (
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/"
        "gesture_recognizer/float16/latest/gesture_recognizer.task"
    ),
}

ENV_OVERRIDES = {
    "pose_landmarker.task": "POSE_MODEL_URL",
    "hand_landmarker.task": "HAND_MODEL_URL",
    "face_landmarker.task": "FACE_MODEL_URL",
    "gesture_recognizer.task": "GESTURE_MODEL_URL",
}


def get_model_path(filename):
    os.makedirs(MODEL_DIR, exist_ok=True)
    path = os.path.join(MODEL_DIR, filename)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path

    url = os.environ.get(ENV_OVERRIDES.get(filename, ""), "") or DEFAULT_URLS[filename]
    tmp_path = path + ".part"
    urllib.request.urlretrieve(url, tmp_path)
    os.replace(tmp_path, path)
    return path
