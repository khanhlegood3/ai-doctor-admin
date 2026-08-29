import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

from _lib.base_handler import make_handler
from _lib.models import get_model_path

_recognizer = None


def _get_recognizer():
    global _recognizer
    if _recognizer is None:
        options = vision.GestureRecognizerOptions(
            base_options=BaseOptions(model_asset_path=get_model_path("gesture_recognizer.task")),
            running_mode=vision.RunningMode.IMAGE,
            num_hands=2,
        )
        _recognizer = vision.GestureRecognizer.create_from_options(options)
    return _recognizer


def process(images):
    recognizer = _get_recognizer()
    frames_out = []
    for img in images:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img)
        result = recognizer.recognize(mp_image)
        hands = []
        for i, gestures in enumerate(result.gestures):
            handedness = result.handedness[i][0].category_name if result.handedness else None
            top_gesture = gestures[0] if gestures else None
            hands.append({
                "handedness": handedness,
                "gesture": top_gesture.category_name if top_gesture else None,
                "score": top_gesture.score if top_gesture else None,
            })
        frames_out.append({"hands": hands})
    return {"results": frames_out}


handler = make_handler("gesture", process)
