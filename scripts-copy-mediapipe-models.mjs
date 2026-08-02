import fs from 'fs'
import path from 'path'
import https from 'https'

// Tự host các file model MediaPipe (.task / .tflite) trong public/models/,
// giống cách scripts-copy-mediapipe-wasm.mjs đã làm với WASM — để camera
// không phải chờ tải trực tiếp từ storage.googleapis.com (CDN Google hay
// chậm/không ổn định từ mạng Việt Nam) mỗi lần load trang.
//
// Chỉ tải nếu file CHƯA có sẵn (cache theo tên file) — tránh tải lại vài MB
// mỗi lần chạy `npm run dev`. Muốn ép tải lại thì xoá file trong public/models/.
//
// Nếu tải lỗi (mất mạng, CDN chặn, v.v.) script KHÔNG làm crash predev/prebuild
// — chỉ cảnh báo và bỏ qua. Code loader (mediapipeModelPath.js +
// useMediaPipeVision.js) sẽ tự fallback về CDN gốc nếu không thấy file local.

const MODELS = [
  {
    name: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  {
    name: 'pose_landmarker_lite.task',
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  },
  {
    name: 'efficientdet_lite0.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
  },
]

const destDir = path.join('public', 'models')
fs.mkdirSync(destDir, { recursive: true })

function downloadFile(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      // storage.googleapis.com có thể trả 3xx redirect trước khi tới file thật.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume()
        downloadFile(res.headers.location, destPath, redirectsLeft - 1).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const tmpPath = `${destPath}.part`
      const fileStream = fs.createWriteStream(tmpPath)
      res.pipe(fileStream)
      fileStream.on('finish', () => {
        fileStream.close(() => {
          fs.renameSync(tmpPath, destPath)
          resolve()
        })
      })
      fileStream.on('error', reject)
    })
    request.on('error', reject)
    request.setTimeout(60_000, () => {
      request.destroy(new Error(`Timed out downloading ${url}`))
    })
  })
}

const run = async () => {
  for (const model of MODELS) {
    const destPath = path.join(destDir, model.name)
    if (fs.existsSync(destPath)) {
      console.log(`MediaPipe model already cached, skipping: ${destPath}`)
      continue
    }
    try {
      console.log(`Downloading MediaPipe model: ${model.name} ...`)
      await downloadFile(model.url, destPath)
      console.log(`Saved ${destPath}`)
    } catch (err) {
      console.warn(
        `Could not pre-cache MediaPipe model "${model.name}" (${err.message}). ` +
        `App will fall back to loading it from Google's CDN at runtime instead.`,
      )
      // Dọn file .part dở dang nếu có, để lần chạy sau thử tải lại từ đầu.
      const tmpPath = `${destPath}.part`
      if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true })
    }
  }
}

await run()
