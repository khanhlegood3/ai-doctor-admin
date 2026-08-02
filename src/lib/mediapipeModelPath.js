/**
 * Đường dẫn model MediaPipe (.task/.tflite).
 *
 * `local`: file đã được tự host trong public/models/ bởi
 *   scripts-copy-mediapipe-models.mjs (chạy qua predev/prebuild). Ưu tiên
 *   dùng đường dẫn này — nhanh, không phụ thuộc mạng ngoài.
 * `cdn`: URL gốc trên storage.googleapis.com của Google — dùng làm fallback
 *   nếu file local bị thiếu (vd: lần deploy đó script tải model bị lỗi mạng
 *   nên bị bỏ qua — xem scripts-copy-mediapipe-models.mjs) hoặc bị lỗi khi
 *   MediaPipe fetch (404, CORS, v.v.).
 */
const MODELS_BASE_URL = `${import.meta.env.BASE_URL}models`.replace(/\/\//g, '/')

export const MEDIAPIPE_MODEL_URLS = {
  face: {
    local: `${MODELS_BASE_URL}/face_landmarker.task`,
    cdn: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  pose: {
    local: `${MODELS_BASE_URL}/pose_landmarker_lite.task`,
    cdn: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  },
  object: {
    local: `${MODELS_BASE_URL}/efficientdet_lite0.tflite`,
    cdn: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
  },
  hand: {
    local: `${MODELS_BASE_URL}/hand_landmarker.task`,
    cdn: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
}
