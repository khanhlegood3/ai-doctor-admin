import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

from _lib.base_handler import make_handler
from _lib.models import get_model_path

_landmarker = None


def _get_landmarker():
    global _landmarker
    if _landmarker is None:
        options = vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=get_model_path("pose_landmarker.task")),
            running_mode=vision.RunningMode.IMAGE,
            num_poses=1,
        )
        _landmarker = vision.PoseLandmarker.create_from_options(options)
    return _landmarker


def process(images):
    landmarker = _get_landmarker()
    frames_out = []
    for img in images:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img)
        result = landmarker.detect(mp_image)
        poses = []
        for pose_landmarks in result.pose_landmarks:
            poses.append([
                {"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility}
                for lm in pose_landmarks
            ])
        frames_out.append({"poses": poses})
    return {"results": frames_out}


handler = make_handler("pose", process)
