import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import Camera3DAngleGizmo, { buildCameraPrompt } from './CameraAngle3DGizmo.jsx'
import NavButtons from './NavButtons.jsx'

// Camera Angle 3D Studio — nhúng tính năng "3D Camera Control" của
// multimodalart/qwen-image-multiple-angles-3d-camera (dùng LoRA
// fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA) vào app, cùng pattern
// realtime-Hugging-Face-Space (@gradio/client từ browser) đang dùng ở
// TwoDTo3DAssetPanel.jsx. Vật thể trung tâm của gizmo là 1 model .obj thật
// (demo mặc định: nhân vật Attack05 (45).obj) thay vì ảnh phẳng, giúp xem
// trước góc máy trực quan hơn.
const CAMERA_SPACE_URL = 'https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera'
const CAMERA_SPACE_ID = 'multimodalart/qwen-image-multiple-angles-3d-camera'
const LORA_MODEL_URL = 'https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA'
const GRADIO_CLIENT_CDN = 'https://esm.sh/@gradio/client@1.18.0'
const IMAGE_TOKEN = '$IMAGE_FILE'
const DEFAULT_OBJ_URL = 'https://raw.githubusercontent.com/godekd3133/DX9_WorldSkill_Practice_Gyeonggi_01/81ed0a14c63d309bbfc0fc98c8a40a43325336e6/Resource/Player/Animation/Attack05/Attack05%20(45).obj'

// Dùng tạm khi link .obj người dùng nhập vào textbox bị lỗi (404, CORS,
// parse lỗi...) — model đã có sẵn thật trong public/assets/models/ (xem
// MedicalVisualPlayground.jsx, mục Krabby Patty demo). Chỉ để tham khảo,
// .mtl không tải được trực tiếp trong Camera3DAngleGizmo (component này chỉ
// nhận objUrl, không có prop mtlUrl) nên không cần dùng ở đây, nhưng vẫn ghi
// lại link .mtl gốc trên GitHub trong dòng cảnh báo cho người dùng tham khảo.
const FALLBACK_OBJ_URL = '/assets/models/krabbypattie01.obj'
const FALLBACK_MTL_INFO_URL = 'https://github.com/xuankhanh1612/ai-doctor-admin/blob/main/public/assets/models/krabbypattie01.mtl'

// Khung "🎮 3D Camera Control 2D Object" — chiếu ảnh 2D thật lên mặt phẳng
// làm tâm gizmo, vì "Realtime Hugging Face API" bên dưới chỉ dùng upload
// ảnh 2D để đổi góc chụp trước khi chạy (không dùng model .obj).
const DEFAULT_IMAGE_2D_URL = 'https://png.pngtree.com/png-clipart/20230812/original/pngtree-world-hepatitis-day-with-human-liver-organ-and-stethoscope-vector-png-image_10294720.png'
// Dùng tạm khi link ảnh 2D người dùng nhập vào textbox bị lỗi (404, CORS,
// hotlink bị chặn...) — ảnh có sẵn thật trong public/src/mediapipe-khanh/.
const FALLBACK_IMAGE_2D_URL = '/src/mediapipe-khanh/thumbs_up.png'

// Khung "🎮 3D Camera Control 2D + 3D Object" — bản sao khung 3D Object,
// hiển thị CẢ ảnh 2D lẫn model .obj cùng lúc trong 1 gizmo (2 textbox link
// riêng: textbox 1 = ảnh 2D, textbox 2 = model .obj + .mtl).
const DEFAULT_COMBO_IMAGE_URL = DEFAULT_IMAGE_2D_URL
const FALLBACK_COMBO_IMAGE_URL = FALLBACK_IMAGE_2D_URL
const DEFAULT_COMBO_OBJ_URL = DEFAULT_OBJ_URL
const DEFAULT_COMBO_MTL_URL = 'https://raw.githubusercontent.com/godekd3133/DX9_WorldSkill_Practice_Gyeonggi_01/81ed0a14c63d309bbfc0fc98c8a40a43325336e6/Resource/Player/Animation/Attack05/Attack05%20(45).mtl'
const FALLBACK_COMBO_OBJ_URL = FALLBACK_OBJ_URL
const FALLBACK_COMBO_MTL_URL = 'https://github.com/xuankhanh1612/ai-doctor-admin/blob/main/public/assets/models/krabbypattie01.mtl'
const DEFAULT_OBJECT_TRANSFORM = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }

const loadGradioClient = () => import(/* @vite-ignore */ GRADIO_CLIENT_CDN).then((m) => m.Client)

function replaceImageToken(value, imageFile) {
  if (Array.isArray(value)) return value.map((item) => replaceImageToken(item, imageFile))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceImageToken(v, imageFile)]))
  }
  return value === IMAGE_TOKEN ? imageFile : value
}

export default function CameraAngle3DStudioPanel({ onNext, nextLabel, onPrev, prevLabel } = {}) {
  const { theme } = useApp()
  const isDark = theme === 'dark'
  const gizmoWrapperRef = useRef(null) // khung "🎮 3D Camera Control 2D Object" (ảnh 2D)
  const gizmo3dWrapperRef = useRef(null) // khung "🎮 3D Camera Control 3D Object" (model .obj)
  const gizmoComboWrapperRef = useRef(null) // khung "🎮 3D Camera Control 2D + 3D Object" (ảnh 2D + model .obj)

  // --- Khung "🎮 3D Camera Control 2D Object" — ảnh 2D làm tâm gizmo, camera
  // này cũng là camera dùng để sinh prompt gửi cho "Realtime Hugging Face API". ---
  const [image2dUrl, setImage2dUrl] = useState(DEFAULT_IMAGE_2D_URL)
  const [effectiveImage2dUrl, setEffectiveImage2dUrl] = useState(DEFAULT_IMAGE_2D_URL)
  const [image2dLoadError, setImage2dLoadError] = useState('')
  const [camera, setCamera] = useState({ azimuth: 0, elevation: 0, distance: 1.0 })
  const [object2dTransform, setObject2dTransform] = useState(DEFAULT_OBJECT_TRANSFORM)

  // --- Khung "🎮 3D Camera Control 3D Object" — bản sao dùng model .obj thật,
  // độc lập với khung 2D Object ở trên (camera/model riêng, chỉ để xem trước). ---
  const [obj3dUrl, setObj3dUrl] = useState(DEFAULT_OBJ_URL)
  const [effectiveObj3dUrl, setEffectiveObj3dUrl] = useState(DEFAULT_OBJ_URL)
  const [obj3dLoadError, setObj3dLoadError] = useState('')
  const [camera3d, setCamera3d] = useState({ azimuth: 0, elevation: 0, distance: 1.0 })
  const [object3dTransform, setObject3dTransform] = useState(DEFAULT_OBJECT_TRANSFORM)

  // --- Khung "🎮 3D Camera Control 2D + 3D Object" — bản sao khung 3D Object,
  // hiển thị ảnh 2D (textbox 1) + model .obj/.mtl (textbox 2) cùng lúc. ---
  const [comboImageUrl, setComboImageUrl] = useState(DEFAULT_COMBO_IMAGE_URL)
  const [effectiveComboImageUrl, setEffectiveComboImageUrl] = useState(DEFAULT_COMBO_IMAGE_URL)
  const [comboImageLoadError, setComboImageLoadError] = useState('')
  const [comboObjUrl, setComboObjUrl] = useState(DEFAULT_COMBO_OBJ_URL)
  const [comboMtlUrl, setComboMtlUrl] = useState(DEFAULT_COMBO_MTL_URL)
  const [effectiveComboObjUrl, setEffectiveComboObjUrl] = useState(DEFAULT_COMBO_OBJ_URL)
  const [effectiveComboMtlUrl, setEffectiveComboMtlUrl] = useState(DEFAULT_COMBO_MTL_URL)
  const [comboObjLoadError, setComboObjLoadError] = useState('')
  const [cameraCombo, setCameraCombo] = useState({ azimuth: 0, elevation: 0, distance: 1.0 })
  const [objectComboImageTransform, setObjectComboImageTransform] = useState(DEFAULT_OBJECT_TRANSFORM)
  const [objectComboObjTransform, setObjectComboObjTransform] = useState(DEFAULT_OBJECT_TRANSFORM)

  const [sourceImage, setSourceImage] = useState(null)
  const [sourcePreview, setSourcePreview] = useState('')
  const [spaceId, setSpaceId] = useState(CAMERA_SPACE_ID)
  const [apiEndpoint, setApiEndpoint] = useState('/infer_camera_edit')
  const [hfToken, setHfToken] = useState('')
  const [status, setStatus] = useState('Kéo 3 tay cầm 🟢🩷🟠 hoặc dùng slider để chọn góc máy, sau đó bấm "Chạy realtime".')
  const [apiSchema, setApiSchema] = useState(null)
  const [rawResponse, setRawResponse] = useState(null)
  const [outputImage, setOutputImage] = useState('')
  const [busy, setBusy] = useState(false)
  const [objDownloadState, setObjDownloadState] = useState('idle') // 'idle' | 'downloading' | 'done' | 'error' (2D Object: ảnh)
  const [snapshotDownloadState, setSnapshotDownloadState] = useState('idle') // 'idle' | 'downloading' | 'done' | 'error'
  const [clipboardState, setClipboardState] = useState('idle') // 'idle' | 'copied' | 'pasted' | 'error'

  const [obj3dDownloadState, setObj3dDownloadState] = useState('idle') // 3D Object: model .obj
  const [snapshot3dDownloadState, setSnapshot3dDownloadState] = useState('idle')
  const [clipboard3dState, setClipboard3dState] = useState('idle')

  const [comboDownloadState, setComboDownloadState] = useState('idle') // 2D + 3D Object
  const [comboSnapshotDownloadState, setComboSnapshotDownloadState] = useState('idle')
  const [comboImageClipboardState, setComboImageClipboardState] = useState('idle') // textbox 1 (ảnh 2D)
  const [comboObjClipboardState, setComboObjClipboardState] = useState('idle') // textbox 2 (obj)
  const [comboMtlClipboardState, setComboMtlClipboardState] = useState('idle') // textbox 2 (mtl)

  const palette = useMemo(() => ({
    bg: isDark ? '#030712' : '#f3f7fb',
    card: isDark ? 'rgba(10,18,34,0.94)' : '#ffffff',
    card2: isDark ? 'rgba(15,23,42,0.86)' : '#eef6ff',
    border: isDark ? 'rgba(125,211,252,0.20)' : 'rgba(14,116,144,0.14)',
    text: isDark ? '#e5eefb' : '#162033',
    text2: isDark ? '#9fb0c8' : '#5e6a7d',
    cyan: '#22d3ee', violet: '#a78bfa', green: '#34d399', amber: '#fbbf24', red: '#fb7185',
  }), [isDark])

  const prompt = buildCameraPrompt(camera.azimuth, camera.elevation, camera.distance)
  const prompt3d = buildCameraPrompt(camera3d.azimuth, camera3d.elevation, camera3d.distance)

  // --- Khung "🎮 3D Camera Control 2D Object" (ảnh 2D) ---
  // Mỗi khi người dùng gõ/dán/xoá link trong textbox, thử tải lại đúng link
  // đó — xoá cảnh báo lỗi cũ trước, để component tự báo lỗi mới (nếu có) qua
  // handleImage2dLoadError bên dưới.
  useEffect(() => {
    setImage2dLoadError('')
    setEffectiveImage2dUrl(image2dUrl)
  }, [image2dUrl])

  const handleImage2dLoadError = (err, failedUrl) => {
    // Đang thử lại chính fallback mà vẫn lỗi -> chỉ log, không fallback tiếp
    // để tránh vòng lặp vô hạn.
    if (failedUrl === FALLBACK_IMAGE_2D_URL) {
      console.warn('Camera3DAngleGizmo: cả ảnh 2D dự phòng cũng không tải được', err)
      return
    }
    // Chỉ xử lý nếu đây đúng là lần thử của link người dùng đang nhập hiện tại
    // (tránh trường hợp lỗi trả về trễ từ 1 URL đã bị thay bằng URL khác).
    if (failedUrl !== image2dUrl) return
    setImage2dLoadError(
      `Không tải được ảnh 2D từ link này (${err?.message || 'lỗi tải file'}). Đang dùng tạm ảnh public/src/mediapipe-khanh/thumbs_up.png cho đến khi bạn dán link ảnh mới không lỗi vào ô trên.`
    )
    setEffectiveImage2dUrl(FALLBACK_IMAGE_2D_URL)
  }

  const handleImage2dLoadSuccess = (loadedUrl) => {
    // Chỉ xoá cảnh báo khi chính link người dùng đang nhập tải thành công —
    // nếu là fallback thì giữ nguyên cảnh báo để họ biết vẫn đang xem tạm.
    if (loadedUrl === image2dUrl) setImage2dLoadError('')
  }

  // --- Khung "🎮 3D Camera Control 3D Object" (model .obj) ---
  useEffect(() => {
    setObj3dLoadError('')
    setEffectiveObj3dUrl(obj3dUrl)
  }, [obj3dUrl])

  const handleObj3dLoadError = (err, failedUrl) => {
    if (failedUrl === FALLBACK_OBJ_URL) {
      console.warn('Camera3DAngleGizmo: cả model demo dự phòng cũng không tải được', err)
      return
    }
    if (failedUrl !== obj3dUrl) return
    setObj3dLoadError(
      `Không tải được model từ link này (${err?.message || 'lỗi tải file'}). Đang dùng tạm model demo public/assets/models/krabbypattie01.obj (kèm ${FALLBACK_MTL_INFO_URL}) cho đến khi bạn dán link .obj mới không lỗi vào ô trên.`
    )
    setEffectiveObj3dUrl(FALLBACK_OBJ_URL)
  }

  const handleObj3dLoadSuccess = (loadedUrl) => {
    if (loadedUrl === obj3dUrl) setObj3dLoadError('')
  }

  // --- Khung "🎮 3D Camera Control 2D + 3D Object" (ảnh 2D + model .obj/.mtl) ---
  const promptCombo = buildCameraPrompt(cameraCombo.azimuth, cameraCombo.elevation, cameraCombo.distance)

  // Textbox 1 (ảnh 2D)
  useEffect(() => {
    setComboImageLoadError('')
    setEffectiveComboImageUrl(comboImageUrl)
  }, [comboImageUrl])

  const handleComboImageLoadError = (err, failedUrl) => {
    if (failedUrl === FALLBACK_COMBO_IMAGE_URL) {
      console.warn('Camera3DAngleGizmo: cả ảnh 2D dự phòng cũng không tải được', err)
      return
    }
    if (failedUrl !== comboImageUrl) return
    setComboImageLoadError(
      `Không tải được ảnh 2D từ link này (${err?.message || 'lỗi tải file'}). Đang dùng tạm ảnh public/src/mediapipe-khanh/thumbs_up.png cho đến khi bạn dán link ảnh mới không lỗi vào ô trên.`
    )
    setEffectiveComboImageUrl(FALLBACK_COMBO_IMAGE_URL)
  }

  const handleComboImageLoadSuccess = (loadedUrl) => {
    if (loadedUrl === comboImageUrl) setComboImageLoadError('')
  }

  // Textbox 2 (model .obj + .mtl) — coi 2 link này là 1 cặp: nếu obj hoặc mtl
  // lỗi thì cả cặp fallback về model demo krabbypattie01.obj + .mtl.
  useEffect(() => {
    setComboObjLoadError('')
    setEffectiveComboObjUrl(comboObjUrl)
    setEffectiveComboMtlUrl(comboMtlUrl)
  }, [comboObjUrl, comboMtlUrl])

  const handleComboObjLoadError = (err, failedUrl) => {
    if (failedUrl === FALLBACK_COMBO_OBJ_URL) {
      console.warn('Camera3DAngleGizmo: cả model demo dự phòng cũng không tải được', err)
      return
    }
    if (failedUrl !== comboObjUrl) return
    setComboObjLoadError(
      `Không tải được model .obj/.mtl từ link này (${err?.message || 'lỗi tải file'}). Đang dùng tạm model demo public/assets/models/krabbypattie01.obj (kèm ${FALLBACK_COMBO_MTL_URL}) cho đến khi bạn dán link .obj/.mtl mới không lỗi vào ô trên.`
    )
    setEffectiveComboObjUrl(FALLBACK_COMBO_OBJ_URL)
    // FALLBACK_COMBO_MTL_URL là link "xem trên GitHub" (không phải raw) nên
    // không tải trực tiếp được — chỉ ghi trong dòng cảnh báo để tham khảo,
    // gizmo dùng model demo với material mặc định cho đến khi có link mới.
    setEffectiveComboMtlUrl('')
  }

  const handleComboObjLoadSuccess = (loadedUrl) => {
    if (loadedUrl === comboObjUrl) setComboObjLoadError('')
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    setSourceImage(file || null)
    setSourcePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return file ? URL.createObjectURL(file) : '' })
    setOutputImage('')
    if (file) setStatus(`Đã chọn ảnh 2D: ${file.name}. Chỉnh góc máy rồi bấm "Chạy realtime".`)
  }

  const setSlider = (key) => (e) => {
    const num = Number(e.target.value)
    setCamera((prev) => ({ ...prev, [key]: num }))
  }

  const inspectApi = () => {
    setBusy(true)
    setStatus('Đang đọc schema realtime API từ Hugging Face Space...')
    loadGradioClient()
      .then((Client) => Client.connect(spaceId, hfToken ? { hf_token: hfToken } : undefined))
      .then((client) => client.view_api())
      .then((schema) => { setApiSchema(schema); setStatus('Đã tải schema API. Nếu endpoint mặc định khác, hãy sửa lại ô "Endpoint Gradio API" theo schema.') })
      .catch((error) => setStatus(`Không đọc được schema API: ${error?.message || error}`))
      .finally(() => setBusy(false))
  }

  const runCameraEdit = () => {
    if (!sourceImage) { setStatus('Vui lòng upload ảnh 2D để đổi góc chụp trước khi chạy.'); return }
    setBusy(true)
    setStatus(`Đang gửi ảnh + prompt "${prompt}" tới Hugging Face Space...`)
    const args = [
      IMAGE_TOKEN, // image
      camera.azimuth, camera.elevation, camera.distance,
      0, true, // seed, randomize_seed
      1.0, 4, // guidance_scale, num_inference_steps
      1024, 1024, // height, width
    ]
    loadGradioClient()
      .then((Client) => Client.connect(spaceId, hfToken ? { hf_token: hfToken } : undefined))
      .then((client) => client.predict(apiEndpoint, replaceImageToken(args, sourceImage)))
      .then((result) => {
        setRawResponse(result)
        const data = result?.data || result
        const imgEntry = Array.isArray(data) ? data[0] : data
        const url = imgEntry?.url || imgEntry?.path || (typeof imgEntry === 'string' ? imgEntry : '')
        setOutputImage(url || '')
        setStatus(url ? 'Hoàn tất! Ảnh với góc chụp mới đã sẵn sàng.' : 'API đã trả kết quả nhưng chưa nhận diện được ảnh output — xem Raw response bên dưới.')
      })
      .catch((error) => setStatus(`Không chạy được realtime API: ${error?.message || error}. Hãy bấm "Đọc API" để lấy đúng endpoint/thứ tự tham số, hoặc dùng Space nhúng bên dưới.`))
      .finally(() => setBusy(false))
  }

  // Tải file (.obj hoặc ảnh 2D) đang dùng trong gizmo về máy — fetch thật ->
  // Blob -> <a download> để trình duyệt lưu đúng tên file, không chỉ mở
  // link. Nếu server chặn CORS, rơi về mở tab mới để tự "Save As" thủ công.
  // Trả về true nếu tải trực tiếp thành công. Dùng effectiveUrl (file THẬT
  // SỰ đang hiển thị trong gizmo — có thể là fallback nếu link người dùng
  // nhập bị lỗi) thay vì url thô người dùng đang gõ.
  const downloadGizmoFile = async (effectiveUrl, defaultFileName) => {
    try {
      const res = await fetch(effectiveUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      let fileName = defaultFileName
      try {
        const path = new URL(effectiveUrl, window.location.href).pathname
        const base = path.split('/').pop()
        if (base) fileName = decodeURIComponent(base)
      } catch { /* giữ tên mặc định nếu URL không hợp lệ */ }
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000)
      return true
    } catch (err) {
      console.warn('Download file failed, opening in new tab instead', err)
      window.open(effectiveUrl, '_blank', 'noopener')
      return false
    }
  }

  // Chụp lại đúng canvas WebGL của gizmo (renderer đã bật
  // preserveDrawingBuffer trong CameraAngle3DGizmo.jsx) rồi ghép thêm dải
  // thông tin góc XYZ + prompt hiện tại vào bên dưới ảnh, xuất ra PNG thật —
  // đây là phần "chỉnh góc XYZ" của tên nút, khác với file .obj gốc (vốn
  // không đổi theo góc máy).
  const downloadAngleSnapshot = (wrapperRef, cam, promptText) => {
    const srcCanvas = wrapperRef.current?.querySelector('canvas')
    if (!srcCanvas) return false
    const w = srcCanvas.width
    const h = srcCanvas.height
    const scale = w / 800
    const bannerH = Math.round(110 * scale)
    const out = document.createElement('canvas')
    out.width = w
    out.height = h + bannerH
    const ctx = out.getContext('2d')
    ctx.drawImage(srcCanvas, 0, 0, w, h)
    ctx.fillStyle = '#05070d'
    ctx.fillRect(0, h, w, bannerH)
    ctx.fillStyle = '#22d3ee'
    ctx.font = `900 ${Math.round(22 * scale)}px monospace`
    ctx.fillText(`Azimuth ${cam.azimuth}° · Elevation ${cam.elevation}° · Distance ${cam.distance.toFixed(1)}`, 20 * scale, h + 40 * scale)
    ctx.fillStyle = '#34d399'
    ctx.font = `${Math.round(16 * scale)}px monospace`
    ctx.fillText(promptText, 20 * scale, h + 76 * scale)
    const pngUrl = out.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = pngUrl
    a.download = `camera-angle-az${cam.azimuth}-el${cam.elevation}-dist${cam.distance.toFixed(1)}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    return true
  }

  // --- Khung "🎮 3D Camera Control 2D Object" ---
  const downloadObjAndAngle = async () => {
    if (!effectiveImage2dUrl) return
    setObjDownloadState('downloading')
    const ok = await downloadGizmoFile(effectiveImage2dUrl, 'image-2d.png')
    setObjDownloadState(ok ? 'done' : 'error')
    setTimeout(() => setObjDownloadState('idle'), 2200)
  }

  const downloadSnapshotOnly = () => {
    setSnapshotDownloadState('downloading')
    const ok = downloadAngleSnapshot(gizmoWrapperRef, camera, prompt)
    setSnapshotDownloadState(ok ? 'done' : 'error')
    setTimeout(() => setSnapshotDownloadState('idle'), 2200)
  }

  const clearImage2dUrl = () => { setImage2dUrl('') }

  const copyImage2dUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(image2dUrl || '')
      setClipboardState('copied')
    } catch (err) {
      console.warn('Copy link failed', err)
      setClipboardState('error')
    }
    setTimeout(() => setClipboardState('idle'), 1800)
  }

  const pasteImage2dUrlFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setImage2dUrl(text.trim())
      setClipboardState('pasted')
    } catch (err) {
      console.warn('Paste link failed (trình duyệt có thể chưa cấp quyền clipboard)', err)
      setClipboardState('error')
    }
    setTimeout(() => setClipboardState('idle'), 1800)
  }

  // --- Khung "🎮 3D Camera Control 3D Object" ---
  const downloadObj3dAndAngle = async () => {
    if (!effectiveObj3dUrl) return
    setObj3dDownloadState('downloading')
    const ok = await downloadGizmoFile(effectiveObj3dUrl, 'model.obj')
    setObj3dDownloadState(ok ? 'done' : 'error')
    setTimeout(() => setObj3dDownloadState('idle'), 2200)
  }

  const downloadSnapshot3dOnly = () => {
    setSnapshot3dDownloadState('downloading')
    const ok = downloadAngleSnapshot(gizmo3dWrapperRef, camera3d, prompt3d)
    setSnapshot3dDownloadState(ok ? 'done' : 'error')
    setTimeout(() => setSnapshot3dDownloadState('idle'), 2200)
  }

  const clearObj3dUrl = () => { setObj3dUrl('') }

  const copyObj3dUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(obj3dUrl || '')
      setClipboard3dState('copied')
    } catch (err) {
      console.warn('Copy link failed', err)
      setClipboard3dState('error')
    }
    setTimeout(() => setClipboard3dState('idle'), 1800)
  }

  const pasteObj3dUrlFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setObj3dUrl(text.trim())
      setClipboard3dState('pasted')
    } catch (err) {
      console.warn('Paste link failed (trình duyệt có thể chưa cấp quyền clipboard)', err)
      setClipboard3dState('error')
    }
    setTimeout(() => setClipboard3dState('idle'), 1800)
  }

  // --- Khung "🎮 3D Camera Control 2D + 3D Object" ---
  const downloadComboAndAngle = async () => {
    if (!effectiveComboObjUrl) return
    setComboDownloadState('downloading')
    const ok = await downloadGizmoFile(effectiveComboObjUrl, 'model.obj')
    setComboDownloadState(ok ? 'done' : 'error')
    setTimeout(() => setComboDownloadState('idle'), 2200)
  }

  const downloadComboSnapshotOnly = () => {
    setComboSnapshotDownloadState('downloading')
    const ok = downloadAngleSnapshot(gizmoComboWrapperRef, cameraCombo, promptCombo)
    setComboSnapshotDownloadState(ok ? 'done' : 'error')
    setTimeout(() => setComboSnapshotDownloadState('idle'), 2200)
  }

  // Textbox 1 (ảnh 2D)
  const clearComboImageUrl = () => { setComboImageUrl('') }

  const copyComboImageUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(comboImageUrl || '')
      setComboImageClipboardState('copied')
    } catch (err) {
      console.warn('Copy link failed', err)
      setComboImageClipboardState('error')
    }
    setTimeout(() => setComboImageClipboardState('idle'), 1800)
  }

  const pasteComboImageUrlFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setComboImageUrl(text.trim())
      setComboImageClipboardState('pasted')
    } catch (err) {
      console.warn('Paste link failed (trình duyệt có thể chưa cấp quyền clipboard)', err)
      setComboImageClipboardState('error')
    }
    setTimeout(() => setComboImageClipboardState('idle'), 1800)
  }

  // Textbox 2 (model .obj)
  const clearComboObjUrl = () => { setComboObjUrl('') }

  const copyComboObjUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(comboObjUrl || '')
      setComboObjClipboardState('copied')
    } catch (err) {
      console.warn('Copy link failed', err)
      setComboObjClipboardState('error')
    }
    setTimeout(() => setComboObjClipboardState('idle'), 1800)
  }

  const pasteComboObjUrlFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setComboObjUrl(text.trim())
      setComboObjClipboardState('pasted')
    } catch (err) {
      console.warn('Paste link failed (trình duyệt có thể chưa cấp quyền clipboard)', err)
      setComboObjClipboardState('error')
    }
    setTimeout(() => setComboObjClipboardState('idle'), 1800)
  }

  // Textbox 2 (model .mtl)
  const clearComboMtlUrl = () => { setComboMtlUrl('') }

  const copyComboMtlUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(comboMtlUrl || '')
      setComboMtlClipboardState('copied')
    } catch (err) {
      console.warn('Copy link failed', err)
      setComboMtlClipboardState('error')
    }
    setTimeout(() => setComboMtlClipboardState('idle'), 1800)
  }

  const pasteComboMtlUrlFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setComboMtlUrl(text.trim())
      setComboMtlClipboardState('pasted')
    } catch (err) {
      console.warn('Paste link failed (trình duyệt có thể chưa cấp quyền clipboard)', err)
      setComboMtlClipboardState('error')
    }
    setTimeout(() => setComboMtlClipboardState('idle'), 1800)
  }

  return (
    <div style={{ minHeight: '100%', background: palette.bg, color: palette.text, padding: '28px clamp(16px, 4vw, 42px)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <section style={{ border: `1px solid ${palette.border}`, background: `radial-gradient(circle at 16% 8%, rgba(34,211,238,.22), transparent 34%), radial-gradient(circle at 84% 12%, rgba(167,139,250,.20), transparent 32%), ${palette.card}`, borderRadius: 30, padding: '28px clamp(18px, 4vw, 38px)', boxShadow: isDark ? '0 28px 90px rgba(0,0,0,.42)' : '0 24px 70px rgba(14,116,144,.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 780 }}>
              <div style={{ color: palette.cyan, fontSize: 12, fontWeight: 950, letterSpacing: '.16em', textTransform: 'uppercase' }}>3D XYZ Camera Angle</div>
              <h1 style={{ margin: '10px 0 8px', fontSize: 'clamp(28px, 4vw, 48px)', lineHeight: 1.05 }}>Chọn góc chụp bằng gizmo 3D thật</h1>
              <p style={{ margin: 0, color: palette.text2, fontSize: 15, lineHeight: 1.7 }}>
                Kéo 3 tay cầm màu quanh mô hình <strong>.obj</strong> để chọn <strong>Azimuth</strong> (🟢 xoay ngang), <strong>Elevation</strong> (🩷 góc nghiêng), <strong>Distance</strong> (🟠 khoảng cách) — y hệt cơ chế của Space gốc, rồi gửi prompt sinh ra kèm ảnh 2D thật tới <strong>fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA</strong> để đổi góc chụp ảnh thật.
              </p>
            </div>
            <div style={{ minWidth: 230, color: palette.text2, fontSize: 12, fontWeight: 800, lineHeight: 1.6 }}>
              Link Hugging Face ngoài đã được ẩn theo cấu hình nội bộ.
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 18, marginTop: 18 }}>

          {/* --- GIZMO 2D Object (ảnh 2D) + SLIDERS — cung cấp prompt/góc chụp
               cho "🚀 Realtime Hugging Face API" bên dưới, vì API đó chỉ
               dùng upload ảnh 2D để đổi góc chụp trước khi chạy. --- */}
          <section style={cardStyle(palette)}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>🎮 3D Camera Control 2D Object</h2>
            <p style={{ margin: '0 0 12px', color: palette.text2, fontSize: 12 }}>Kéo tay cầm: 🟢 Azimuth · 🩷 Elevation · 🟠 Distance</p>

            <div ref={gizmoWrapperRef}>
              <Camera3DAngleGizmo
                mode="image"
                imageUrl={effectiveImage2dUrl}
                value={camera}
                objectTransform={object2dTransform}
                onChange={setCamera}
                onLoadError={handleImage2dLoadError}
                onLoadSuccess={handleImage2dLoadSuccess}
              />
            </div>

            <ObjectTransformControls palette={palette} value={object2dTransform} onChange={setObject2dTransform} />

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={downloadObjAndAngle}
                disabled={objDownloadState === 'downloading'}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 800, flex: 1,
                  border: `1px solid ${palette.cyan}66`, background: `${palette.cyan}1f`, color: palette.cyan,
                  cursor: objDownloadState === 'downloading' ? 'wait' : 'pointer', opacity: objDownloadState === 'downloading' ? 0.7 : 1,
                }}
              >
                {objDownloadState === 'downloading' && '⏳ Đang tải...'}
                {objDownloadState === 'done' && '✅ Đã tải (ảnh)'}
                {objDownloadState === 'error' && '⚠️ Lỗi'}
                {objDownloadState === 'idle' && '⬇️ Download ảnh 2D'}
              </button>

              <button
                type="button"
                onClick={downloadSnapshotOnly}
                disabled={snapshotDownloadState === 'downloading'}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 800, flex: 1,
                  border: `1px solid ${palette.violet}66`, background: `${palette.violet}1f`, color: palette.violet,
                  cursor: snapshotDownloadState === 'downloading' ? 'wait' : 'pointer', opacity: snapshotDownloadState === 'downloading' ? 0.7 : 1,
                }}
              >
                {snapshotDownloadState === 'downloading' && '⏳ Đang tải...'}
                {snapshotDownloadState === 'done' && '✅ Đã tải (.png)'}
                {snapshotDownloadState === 'error' && '⚠️ Lỗi'}
                {snapshotDownloadState === 'idle' && '⬇️ Download Toàn cảnh góc chụp XYZ'}
              </button>
            </div>

            <label style={labelStyle(palette)}>Link ảnh 2D cho gizmo (đổi thử ảnh khác)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={image2dUrl} onChange={(e) => setImage2dUrl(e.target.value)} style={{ ...inputStyle(palette), fontFamily: 'monospace', fontSize: 11, flex: 1 }} />
              <button
                type="button"
                onClick={clearImage2dUrl}
                title="Xoá Link đang có trong Textbox"
                aria-label="Xoá Link đang có trong Textbox"
                style={iconButtonStyle(palette.red)}
              >
                ❌
              </button>
              <button
                type="button"
                onClick={copyImage2dUrlToClipboard}
                title="Copy Link đang có trong Textbox vào bộ nhớ"
                aria-label="Copy Link đang có trong Textbox vào bộ nhớ"
                style={iconButtonStyle(palette.cyan)}
              >
                {clipboardState === 'copied' ? '✅' : '📋'}
              </button>
              <button
                type="button"
                onClick={pasteImage2dUrlFromClipboard}
                title="Copy Link trong bộ nhớ vào Textbox"
                aria-label="Copy Link trong bộ nhớ vào Textbox"
                style={iconButtonStyle(palette.green)}
              >
                {clipboardState === 'pasted' ? '✅' : '📥'}
              </button>
            </div>
            {image2dLoadError && (
              <div style={{ marginTop: 6, color: palette.red, fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>
                ⚠️ {image2dLoadError}
              </div>
            )}

            <div className="slider-row" style={{ marginTop: 14 }}>
              <label style={{ ...labelStyle(palette), margin: 0, minWidth: 130 }}>Azimuth {camera.azimuth}°</label>
              <input type="range" min={0} max={315} step={45} value={camera.azimuth} onChange={setSlider('azimuth')} style={{ flex: 1 }} />
            </div>
            <div className="slider-row">
              <label style={{ ...labelStyle(palette), margin: 0, minWidth: 130 }}>Elevation {camera.elevation}°</label>
              <input type="range" min={-30} max={60} step={30} value={camera.elevation} onChange={setSlider('elevation')} style={{ flex: 1 }} />
            </div>
            <div className="slider-row">
              <label style={{ ...labelStyle(palette), margin: 0, minWidth: 130 }}>Distance {camera.distance.toFixed(1)}</label>
              <input type="range" min={0.6} max={1.4} step={0.4} value={camera.distance} onChange={setSlider('distance')} style={{ flex: 1 }} />
            </div>

            <label style={labelStyle(palette)}>Prompt sinh ra</label>
            <div style={{ ...inputStyle(palette), fontFamily: 'monospace', fontSize: 12, color: palette.green }}>{prompt}</div>
          </section>

          {/* --- GIZMO 3D Object (model .obj thật) + SLIDERS — bản sao độc lập
               của khung trên, chỉ để xem trước góc máy trên model 3D. --- */}
          <section style={cardStyle(palette)}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>🎮 3D Camera Control 3D Object</h2>
            <p style={{ margin: '0 0 12px', color: palette.text2, fontSize: 12 }}>Kéo tay cầm: 🟢 Azimuth · 🩷 Elevation · 🟠 Distance</p>

            <div ref={gizmo3dWrapperRef}>
              <Camera3DAngleGizmo
                mode="obj"
                objUrl={effectiveObj3dUrl}
                value={camera3d}
                objectTransform={object3dTransform}
                onChange={setCamera3d}
                onLoadError={handleObj3dLoadError}
                onLoadSuccess={handleObj3dLoadSuccess}
              />
            </div>

            <ObjectTransformControls palette={palette} value={object3dTransform} onChange={setObject3dTransform} />

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={downloadObj3dAndAngle}
                disabled={obj3dDownloadState === 'downloading'}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 800, flex: 1,
                  border: `1px solid ${palette.cyan}66`, background: `${palette.cyan}1f`, color: palette.cyan,
                  cursor: obj3dDownloadState === 'downloading' ? 'wait' : 'pointer', opacity: obj3dDownloadState === 'downloading' ? 0.7 : 1,
                }}
              >
                {obj3dDownloadState === 'downloading' && '⏳ Đang tải...'}
                {obj3dDownloadState === 'done' && '✅ Đã tải (.obj)'}
                {obj3dDownloadState === 'error' && '⚠️ Lỗi'}
                {obj3dDownloadState === 'idle' && '⬇️ Download 3D'}
              </button>

              <button
                type="button"
                onClick={downloadSnapshot3dOnly}
                disabled={snapshot3dDownloadState === 'downloading'}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 800, flex: 1,
                  border: `1px solid ${palette.violet}66`, background: `${palette.violet}1f`, color: palette.violet,
                  cursor: snapshot3dDownloadState === 'downloading' ? 'wait' : 'pointer', opacity: snapshot3dDownloadState === 'downloading' ? 0.7 : 1,
                }}
              >
                {snapshot3dDownloadState === 'downloading' && '⏳ Đang tải...'}
                {snapshot3dDownloadState === 'done' && '✅ Đã tải (.png)'}
                {snapshot3dDownloadState === 'error' && '⚠️ Lỗi'}
                {snapshot3dDownloadState === 'idle' && '⬇️ Download Toàn cảnh góc chụp XYZ'}
              </button>
            </div>

            <label style={labelStyle(palette)}>Model .obj demo cho gizmo (đổi thử model khác)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={obj3dUrl} onChange={(e) => setObj3dUrl(e.target.value)} style={{ ...inputStyle(palette), fontFamily: 'monospace', fontSize: 11, flex: 1 }} />
              <button
                type="button"
                onClick={clearObj3dUrl}
                title="Xoá Link đang có trong Textbox"
                aria-label="Xoá Link đang có trong Textbox"
                style={iconButtonStyle(palette.red)}
              >
                ❌
              </button>
              <button
                type="button"
                onClick={copyObj3dUrlToClipboard}
                title="Copy Link đang có trong Textbox vào bộ nhớ"
                aria-label="Copy Link đang có trong Textbox vào bộ nhớ"
                style={iconButtonStyle(palette.cyan)}
              >
                {clipboard3dState === 'copied' ? '✅' : '📋'}
              </button>
              <button
                type="button"
                onClick={pasteObj3dUrlFromClipboard}
                title="Copy Link trong bộ nhớ vào Textbox"
                aria-label="Copy Link trong bộ nhớ vào Textbox"
                style={iconButtonStyle(palette.green)}
              >
                {clipboard3dState === 'pasted' ? '✅' : '📥'}
              </button>
            </div>
            {obj3dLoadError && (
              <div style={{ marginTop: 6, color: palette.red, fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>
                ⚠️ {obj3dLoadError}
              </div>
            )}

            <div className="slider-row" style={{ marginTop: 14 }}>
              <label style={{ ...labelStyle(palette), margin: 0, minWidth: 130 }}>Azimuth {camera3d.azimuth}°</label>
              <input type="range" min={0} max={315} step={45} value={camera3d.azimuth} onChange={(e) => setCamera3d((prev) => ({ ...prev, azimuth: Number(e.target.value) }))} style={{ flex: 1 }} />
            </div>
            <div className="slider-row">
              <label style={{ ...labelStyle(palette), margin: 0, minWidth: 130 }}>Elevation {camera3d.elevation}°</label>
              <input type="range" min={-30} max={60} step={30} value={camera3d.elevation} onChange={(e) => setCamera3d((prev) => ({ ...prev, elevation: Number(e.target.value) }))} style={{ flex: 1 }} />
            </div>
            <div className="slider-row">
              <label style={{ ...labelStyle(palette), margin: 0, minWidth: 130 }}>Distance {camera3d.distance.toFixed(1)}</label>
              <input type="range" min={0.6} max={1.4} step={0.4} value={camera3d.distance} onChange={(e) => setCamera3d((prev) => ({ ...prev, distance: Number(e.target.value) }))} style={{ flex: 1 }} />
            </div>

            <label style={labelStyle(palette)}>Prompt sinh ra</label>
            <div style={{ ...inputStyle(palette), fontFamily: 'monospace', fontSize: 12, color: palette.green }}>{prompt3d}</div>
          </section>

          {/* --- GIZMO 2D + 3D Object (ảnh 2D + model .obj thật cùng lúc) +
               SLIDERS — bản sao của khung "3D Object" ở trên, hiển thị cả
               ảnh 2D (textbox 1) lẫn model .obj/.mtl (textbox 2) trong cùng
               1 gizmo, để so sánh trực quan góc chụp giữa ảnh phẳng và
               model thật cùng lúc. --- */}
          <section style={cardStyle(palette)}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>🎮 3D Camera Control 2D + 3D Object</h2>
            <p style={{ margin: '0 0 12px', color: palette.text2, fontSize: 12 }}>Kéo tay cầm: 🟢 Azimuth · 🩷 Elevation · 🟠 Distance</p>

            <div ref={gizmoComboWrapperRef}>
              <Camera3DAngleGizmo
                mode="both"
                imageUrl={effectiveComboImageUrl}
                objUrl={effectiveComboObjUrl}
                mtlUrl={effectiveComboMtlUrl}
                value={cameraCombo}
                objectTransforms={{ image: objectComboImageTransform, obj: objectComboObjTransform }}
                onChange={setCameraCombo}
                onLoadError={(err, failedUrl) => {
                  if (failedUrl === effectiveComboImageUrl || failedUrl === comboImageUrl) handleComboImageLoadError(err, failedUrl)
                  else handleComboObjLoadError(err, failedUrl)
                }}
                onLoadSuccess={(loadedUrl) => {
                  if (loadedUrl === comboImageUrl) handleComboImageLoadSuccess(loadedUrl)
                  if (loadedUrl === comboObjUrl) handleComboObjLoadSuccess(loadedUrl)
                }}
              />
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={downloadComboAndAngle}
                disabled={comboDownloadState === 'downloading'}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 800, flex: 1,
                  border: `1px solid ${palette.cyan}66`, background: `${palette.cyan}1f`, color: palette.cyan,
                  cursor: comboDownloadState === 'downloading' ? 'wait' : 'pointer', opacity: comboDownloadState === 'downloading' ? 0.7 : 1,
                }}
              >
                {comboDownloadState === 'downloading' && '⏳ Đang tải...'}
                {comboDownloadState === 'done' && '✅ Đã tải (.obj)'}
                {comboDownloadState === 'error' && '⚠️ Lỗi'}
                {comboDownloadState === 'idle' && '⬇️ Download 3D'}
              </button>

              <button
                type="button"
                onClick={downloadComboSnapshotOnly}
                disabled={comboSnapshotDownloadState === 'downloading'}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 800, flex: 1,
                  border: `1px solid ${palette.violet}66`, background: `${palette.violet}1f`, color: palette.violet,
                  cursor: comboSnapshotDownloadState === 'downloading' ? 'wait' : 'pointer', opacity: comboSnapshotDownloadState === 'downloading' ? 0.7 : 1,
                }}
              >
                {comboSnapshotDownloadState === 'downloading' && '⏳ Đang tải...'}
                {comboSnapshotDownloadState === 'done' && '✅ Đã tải (.png)'}
                {comboSnapshotDownloadState === 'error' && '⚠️ Lỗi'}
                {comboSnapshotDownloadState === 'idle' && '⬇️ Download Toàn cảnh góc chụp XYZ'}
              </button>
            </div>

            <label style={labelStyle(palette)}>Textbox 1 · Link ảnh 2D cho gizmo</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={comboImageUrl} onChange={(e) => setComboImageUrl(e.target.value)} style={{ ...inputStyle(palette), fontFamily: 'monospace', fontSize: 11, flex: 1 }} />
              <button
                type="button"
                onClick={clearComboImageUrl}
                title="Xoá Link đang có trong Textbox"
                aria-label="Xoá Link đang có trong Textbox"
                style={iconButtonStyle(palette.red)}
              >
                ❌
              </button>
              <button
                type="button"
                onClick={copyComboImageUrlToClipboard}
                title="Copy Link đang có trong Textbox vào bộ nhớ"
                aria-label="Copy Link đang có trong Textbox vào bộ nhớ"
                style={iconButtonStyle(palette.cyan)}
              >
                {comboImageClipboardState === 'copied' ? '✅' : '📋'}
              </button>
              <button
                type="button"
                onClick={pasteComboImageUrlFromClipboard}
                title="Copy Link trong bộ nhớ vào Textbox"
                aria-label="Copy Link trong bộ nhớ vào Textbox"
                style={iconButtonStyle(palette.green)}
              >
                {comboImageClipboardState === 'pasted' ? '✅' : '📥'}
              </button>
            </div>
            {comboImageLoadError && (
              <div style={{ marginTop: 6, color: palette.red, fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>
                ⚠️ {comboImageLoadError}
              </div>
            )}

            <label style={labelStyle(palette)}>Textbox 2 · Link model .obj cho gizmo</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={comboObjUrl} onChange={(e) => setComboObjUrl(e.target.value)} style={{ ...inputStyle(palette), fontFamily: 'monospace', fontSize: 11, flex: 1 }} />
              <button
                type="button"
                onClick={clearComboObjUrl}
                title="Xoá Link đang có trong Textbox"
                aria-label="Xoá Link đang có trong Textbox"
                style={iconButtonStyle(palette.red)}
              >
                ❌
              </button>
              <button
                type="button"
                onClick={copyComboObjUrlToClipboard}
                title="Copy Link đang có trong Textbox vào bộ nhớ"
                aria-label="Copy Link đang có trong Textbox vào bộ nhớ"
                style={iconButtonStyle(palette.cyan)}
              >
                {comboObjClipboardState === 'copied' ? '✅' : '📋'}
              </button>
              <button
                type="button"
                onClick={pasteComboObjUrlFromClipboard}
                title="Copy Link trong bộ nhớ vào Textbox"
                aria-label="Copy Link trong bộ nhớ vào Textbox"
                style={iconButtonStyle(palette.green)}
              >
                {comboObjClipboardState === 'pasted' ? '✅' : '📥'}
              </button>
            </div>
            <label style={{ ...labelStyle(palette), margin: '8px 0 6px' }}>Textbox 2 · Link model .mtl (material) cho gizmo</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={comboMtlUrl} onChange={(e) => setComboMtlUrl(e.target.value)} style={{ ...inputStyle(palette), fontFamily: 'monospace', fontSize: 11, flex: 1 }} />
              <button
                type="button"
                onClick={clearComboMtlUrl}
                title="Xoá Link đang có trong Textbox"
                aria-label="Xoá Link đang có trong Textbox"
                style={iconButtonStyle(palette.red)}
              >
                ❌
              </button>
              <button
                type="button"
                onClick={copyComboMtlUrlToClipboard}
                title="Copy Link đang có trong Textbox vào bộ nhớ"
                aria-label="Copy Link đang có trong Textbox vào bộ nhớ"
                style={iconButtonStyle(palette.cyan)}
              >
                {comboMtlClipboardState === 'copied' ? '✅' : '📋'}
              </button>
              <button
                type="button"
                onClick={pasteComboMtlUrlFromClipboard}
                title="Copy Link trong bộ nhớ vào Textbox"
                aria-label="Copy Link trong bộ nhớ vào Textbox"
                style={iconButtonStyle(palette.green)}
              >
                {comboMtlClipboardState === 'pasted' ? '✅' : '📥'}
              </button>
            </div>
            {comboObjLoadError && (
              <div style={{ marginTop: 6, color: palette.red, fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>
                ⚠️ {comboObjLoadError}
              </div>
            )}

            <div className="slider-row" style={{ marginTop: 14 }}>
              <label style={{ ...labelStyle(palette), margin: 0, minWidth: 130 }}>Azimuth {cameraCombo.azimuth}°</label>
              <input type="range" min={0} max={315} step={45} value={cameraCombo.azimuth} onChange={(e) => setCameraCombo((prev) => ({ ...prev, azimuth: Number(e.target.value) }))} style={{ flex: 1 }} />
            </div>
            <div className="slider-row">
              <label style={{ ...labelStyle(palette), margin: 0, minWidth: 130 }}>Elevation {cameraCombo.elevation}°</label>
              <input type="range" min={-30} max={60} step={30} value={cameraCombo.elevation} onChange={(e) => setCameraCombo((prev) => ({ ...prev, elevation: Number(e.target.value) }))} style={{ flex: 1 }} />
            </div>
            <div className="slider-row">
              <label style={{ ...labelStyle(palette), margin: 0, minWidth: 130 }}>Distance {cameraCombo.distance.toFixed(1)}</label>
              <input type="range" min={0.6} max={1.4} step={0.4} value={cameraCombo.distance} onChange={(e) => setCameraCombo((prev) => ({ ...prev, distance: Number(e.target.value) }))} style={{ flex: 1 }} />
            </div>

            <label style={labelStyle(palette)}>Prompt sinh ra</label>
            <div style={{ ...inputStyle(palette), fontFamily: 'monospace', fontSize: 12, color: palette.green }}>{promptCombo}</div>
          </section>


          {/* --- COMBO OBJECT TRANSFORMS: đặt cạnh khu Realtime HF để dễ quan sát khi tinh chỉnh 2 object. --- */}
          <section style={cardStyle(palette)}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>Object XYZ Transform · 2D + 3D</h2>
            <p style={{ margin: '0 0 12px', color: palette.text2, fontSize: 12 }}>Điều khiển riêng từng object trong khung “🎮 3D Camera Control 2D + 3D Object”.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, alignItems: 'start' }}>
              <ObjectTransformControls
                palette={palette}
                title="2D Object XYZ Transform"
                value={objectComboImageTransform}
                onChange={setObjectComboImageTransform}
              />
              <ObjectTransformControls
                palette={palette}
                title="3D Object XYZ Transform"
                value={objectComboObjTransform}
                onChange={setObjectComboObjTransform}
              />
            </div>
          </section>

        </div>
        {(onNext || onPrev) && (
          <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
        )}
      </div>
    </div>
  )
}


function ObjectTransformControls({ palette, value, onChange, title = 'Object XYZ Transform' }) {
  const updateTransform = (group, axis) => (event) => {
    const nextValue = Number(event.target.value)
    onChange((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [axis]: nextValue,
      },
    }))
  }

  const resetTransform = () => onChange(DEFAULT_OBJECT_TRANSFORM)

  const rows = [
    ['position', 'x', '↔️ Di chuyển Object trái/phải trục X', -2, 2, 0.05, value.position.x.toFixed(2)],
    ['position', 'y', '↔️ Di chuyển Object trái/phải trục Y', -2, 2, 0.05, value.position.y.toFixed(2)],
    ['position', 'z', '↔️ Di chuyển Object trái/phải trục Z', -2, 2, 0.05, value.position.z.toFixed(2)],
    ['rotation', 'x', '🔄 Xoay Object tại chỗ trục X', -180, 180, 5, `${value.rotation.x}°`],
    ['rotation', 'y', '🔄 Xoay Object tại chỗ trục Y', -180, 180, 5, `${value.rotation.y}°`],
    ['rotation', 'z', '🔄 Xoay Object tại chỗ trục Z', -180, 180, 5, `${value.rotation.z}°`],
  ]

  return (
    <div style={{ marginTop: 14, padding: 12, border: `1px solid ${palette.border}`, borderRadius: 16, background: palette.card2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ color: palette.text, fontSize: 13, fontWeight: 950 }}>{title}</div>
        <button type="button" onClick={resetTransform} style={{ ...iconButtonStyle(palette.amber), width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 900 }}>Reset</button>
      </div>
      {rows.map(([group, axis, label, min, max, step, display]) => (
        <div key={`${group}-${axis}`} className="slider-row" style={{ marginTop: 8 }}>
          <label style={{ ...labelStyle(palette), margin: 0, minWidth: 210 }}>{label}: {display}</label>
          <input type="range" min={min} max={max} step={step} value={value[group][axis]} onChange={updateTransform(group, axis)} style={{ flex: 1 }} />
        </div>
      ))}
    </div>
  )
}

function cardStyle(palette) {
  return { border: `1px solid ${palette.border}`, background: palette.card, borderRadius: 24, padding: 18, boxShadow: '0 18px 54px rgba(15,23,42,.10)' }
}
function labelStyle(palette) { return { display: 'block', color: palette.text2, fontSize: 12, fontWeight: 850, margin: '12px 0 6px' } }
function inputStyle(palette) { return { width: '100%', boxSizing: 'border-box', border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.card2, color: palette.text, padding: '11px 12px', outline: 'none', font: 'inherit' } }
function linkButton(background, color) { return { display: 'inline-flex', justifyContent: 'center', textDecoration: 'none', borderRadius: 14, padding: '11px 14px', background, color, fontWeight: 950, fontSize: 13, boxShadow: '0 12px 32px rgba(0,0,0,.18)' } }
function iconButtonStyle(accent) {
  return {
    flex: '0 0 auto', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, border: `1px solid ${accent}55`, background: `${accent}1a`, color: accent,
    cursor: 'pointer', fontSize: 15, lineHeight: 1,
  }
}
function actionButton(palette, busy, background, color) { return { border: 'none', borderRadius: 14, padding: '12px 14px', cursor: busy ? 'wait' : 'pointer', fontWeight: 950, color, background: busy ? palette.text2 : background } }
