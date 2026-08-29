import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

from _lib.base_handler import make_handler
from _lib.models import get_model_path

_landmarker = None


def _get_landmarker():
    global _landmarker
    if _landmarker is None:
        options = vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=get_model_path("hand_landmarker.task")),
            running_mode=vision.RunningMode.IMAGE,
            num_hands=2,
        )
        _landmarker = vision.HandLandmarker.create_from_options(options)
    return _landmarker


def process(images):
    landmarker = _get_landmarker()
    frames_out = []
    for img in images:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img)
        result = landmarker.detect(mp_image)
        hands = []
        for i, hand_landmarks in enumerate(result.hand_landmarks):
            handedness = result.handedness[i][0].category_name if result.handedness else None
            hands.append({
                "handedness": handedness,
                "landmarks": [{"x": lm.x, "y": lm.y, "z": lm.z} for lm in hand_landmarks],
            })
        frames_out.append({"hands": hands})
    return {"results": frames_out}


handler = make_handler("hand", process)
