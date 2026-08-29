import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

from _lib.base_handler import make_handler
from _lib.models import get_model_path

_landmarker = None


def _get_landmarker():
    global _landmarker
    if _landmarker is None:
        options = vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=get_model_path("face_landmarker.task")),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
            output_face_blendshapes=True,
        )
        _landmarker = vision.FaceLandmarker.create_from_options(options)
    return _landmarker


def process(images):
    landmarker = _get_landmarker()
    frames_out = []
    for img in images:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img)
        result = landmarker.detect(mp_image)
        faces = []
        for i, face_landmarks in enumerate(result.face_landmarks):
            blendshapes = []
            if result.face_blendshapes:
                blendshapes = [
                    {"category": b.category_name, "score": b.score}
                    for b in result.face_blendshapes[i]
                ]
            faces.append({
                "landmarks": [{"x": lm.x, "y": lm.y, "z": lm.z} for lm in face_landmarks],
                "blendshapes": blendshapes,
            })
        frames_out.append({"faces": faces})
    return {"results": frames_out}


handler = make_handler("face", process)
