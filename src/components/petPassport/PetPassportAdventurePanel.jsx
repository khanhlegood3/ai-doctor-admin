// src/components/petPassport/PetPassportAdventurePanel.jsx
// Chuyển đổi từ pet-passport-adventure/src/App.tsx (starter app AI Studio)
// sang React/JSX thuần cho dự án này, dùng ĐÚNG CÔNG NGHỆ của trang
// "Tạo Game bằng Avatar của Tôi" (Comic Hero):
//   - Không gọi thẳng @google/genai + API key nhúng trình duyệt (mất an
//     toàn) — gọi qua Serverless Function api/groq-proxy.js dùng chung
//     provider 'gemini-comic' (xem petPassportClient.js).
//   - Bỏ hộp thoại "Select API Key" của môi trường AI Studio
//     (window.aistudio) vì không tồn tại ở đây — lỗi hiển thị qua toast,
//     giống comicHero (handleAPIError/showApiToast).
//   - Bỏ thư viện 'motion/react' (không có trong package.json của dự án —
//     không thêm dependency mới) — thay bằng transition CSS/Tailwind thuần.
// Giữ nguyên bố cục, ngôn ngữ (tiếng Anh) và trải nghiệm gốc của starter
// app (giao diện "sổ hộ chiếu" viền đen, shadow cứng).
import React, { useState, useRef } from 'react'
import {
  Upload, MapPin, Download, RefreshCw, Loader2, Plane, Camera, Plus, Trash2,
  Settings, Info, ChevronDown, AlertCircle, X,
} from 'lucide-react'
import { generatePetAdventureImage, fileToBase64 } from './petPassportClient'

const ASPECT_RATIOS = ['1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3']
const SUGGESTIONS = [
  'My pet sitting on a boat in the Ha Long Bay karst islands.',
  'My pet exploring the red torii gates of the Fushimi Inari Shrine.',
  "My pet in front of the 'leaning' houses of Amsterdam.",
]

const staticFilesUrl = 'https://www.gstatic.com/aistudio/starter-apps/pet_passport/'
const TEMPLATE_IMAGES = [
  { id: '1', imageUrl: `${staticFilesUrl}example_snoo.png`, location: 'Durdle Door, Dorset', template_description: 'Snoo wearing sunglasses', aspect_ratio: '3:4' },
  { id: '2', imageUrl: `${staticFilesUrl}example_nigel.png`, location: 'Lapland, Finland', template_description: 'Nigel with a christmas hat and scarf', aspect_ratio: '3:4' },
  { id: '3', imageUrl: `${staticFilesUrl}example_multi.png`, location: 'Richmond Park, London', template_description: 'Nigel and Dougie enjoying a picnic', aspect_ratio: '3:4' },
]

export default function PetPassportAdventurePanel() {
  const [subjects, setSubjects] = useState([])
  const [destinations, setDestinations] = useState([])
  const [currentDestination, setCurrentDestination] = useState('')
  const [currentDescription, setCurrentDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [toasts, setToasts] = useState([])
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('9:16')

  const fileInputRef = useRef(null)
  const [uploadType, setUploadType] = useState('character')

  const addToast = (message, type = 'error') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => removeToast(id), 5000)
  }
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      addToast('Please upload a valid image file (.png, .jpg, .jpeg, or .webp)', 'error')
      e.target.value = ''
      return
    }
    try {
      const base64Data = await fileToBase64(file)
      const newSubject = {
        id: Date.now().toString(),
        name: uploadType === 'character'
          ? `Pet ${subjects.filter((s) => s.type === 'character').length + 1}`
          : `Object ${subjects.filter((s) => s.type === 'object').length + 1}`,
        type: uploadType,
        data: base64Data,
        mimeType: file.type,
        url: `data:${file.type};base64,${base64Data}`,
      }
      setSubjects((prev) => [...prev, newSubject])
      setHasStarted(true)
    } catch {
      addToast('Failed to read the uploaded image.', 'error')
    }
    e.target.value = ''
  }

  const removeSubject = (id) => setSubjects((prev) => prev.filter((s) => s.id !== id))
  const updateSubjectName = (id, name) => setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))

  const generateAdventure = async (destination, description) => {
    if (subjects.length === 0) return

    const newAdventure = {
      id: Date.now().toString(),
      prompt: destination,
      description,
      loading: true,
      aspectRatio: selectedAspectRatio,
    }
    setDestinations((prev) => [newAdventure, ...prev])
    setIsGenerating(true)

    try {
      const { imageUrl } = await generatePetAdventureImage({
        subjects, destination, description, aspectRatio: selectedAspectRatio,
      })
      setDestinations((prev) => prev.map((adv) => (adv.id === newAdventure.id ? { ...adv, imageUrl, loading: false } : adv)))
    } catch (error) {
      const errorMessage = error?.message || 'Failed to generate image'
      if (error?.status === 429) {
        addToast('Đang bị giới hạn tần suất của chế độ ảnh miễn phí. Vui lòng đợi vài giây rồi thử lại.', 'error')
      } else {
        addToast(errorMessage, 'error')
      }
      setDestinations((prev) => prev.map((adv) => (adv.id === newAdventure.id ? { ...adv, loading: false, error: errorMessage } : adv)))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (currentDestination.trim() && !isGenerating) {
      generateAdventure(currentDestination.trim(), currentDescription.trim())
      setCurrentDestination('')
      setCurrentDescription('')
    }
  }

  const handleDownloadAlbum = () => {
    destinations.forEach((dest, index) => {
      if (!dest.imageUrl) return
      const link = document.createElement('a')
      link.href = dest.imageUrl
      link.download = `pet-passport-${index + 1}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

  const handleRestart = () => {
    setSubjects([])
    setDestinations([])
    setCurrentDestination('')
    setCurrentDescription('')
    setHasStarted(false)
  }

  const characterCount = subjects.filter((s) => s.type === 'character').length
  const objectCount = subjects.filter((s) => s.type === 'object').length

  const ToastStack = (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white min-w-[280px] sm:min-w-[300px] max-w-[calc(100vw-2rem)] transition-all duration-200"
        >
          <div className={`p-2 rounded-full ${toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div className="flex-1 text-sm font-bold leading-tight">{toast.message}</div>
          <button onClick={() => removeToast(toast.id)} className="p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )

  const HiddenFileInput = (
    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept=".png,.jpg,.jpeg,.webp" className="hidden" />
  )

  if (!hasStarted) {
    return (
      <div className="pet-passport-root max-w-6xl mx-auto pl-4 pr-6 sm:px-8 py-12 font-sans">
        {ToastStack}
        <header className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-black mb-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Plane className="w-10 h-10" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 tracking-tight leading-none">Pet Passport</h1>
          <p className="text-xl md:text-2xl font-serif italic opacity-90">
            Send your furry friends on a global adventure
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {TEMPLATE_IMAGES.map((img, idx) => (
            <div
              key={img.id}
              className={`bg-white p-4 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform hover:scale-105 cursor-pointer ${idx === 0 ? '-rotate-2' : idx === 1 ? 'rotate-1' : '-rotate-1'}`}
              onClick={() => { setUploadType('character'); fileInputRef.current?.click() }}
            >
              <div className="bg-black/5 rounded-xl border border-black/10 overflow-hidden mb-4" style={{ aspectRatio: img.aspect_ratio.replace(':', '/') }}>
                <img src={img.imageUrl} alt={img.location} className="w-full h-full object-cover" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg uppercase tracking-tight">{img.location}</h3>
                <div className="font-serif italic text-sm opacity-70 line-clamp-2 mt-1">"{img.template_description}"</div>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-white p-8 rounded-3xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center">
            <h2 className="text-2xl font-bold mb-6">Start Your Adventure</h2>
            <p className="font-serif italic opacity-70 mb-8">Upload a clear photo of your pet to begin their global journey.</p>
            <button
              onClick={() => { setUploadType('character'); fileInputRef.current?.click() }}
              className="w-full flex items-center justify-center gap-3 py-6 px-8 rounded-2xl border-2 border-black bg-black text-white font-bold text-lg uppercase tracking-wider hover:bg-black/80 transition-all transform hover:scale-105 active:scale-95 focus:ring-4 focus:ring-white/20 focus:outline-none cursor-pointer"
            >
              <Upload className="w-6 h-6" />
              Upload Pet Photo
            </button>
            <div className="mt-6 text-[10px] leading-relaxed text-left opacity-50 space-y-2">
              <p>By using this feature, you confirm that you have the necessary rights to any content that you upload. Do not generate content that infringes on others' intellectual property or privacy rights.</p>
            </div>
            {HiddenFileInput}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pet-passport-root max-w-6xl mx-auto pl-4 pr-6 sm:px-8 py-12 font-sans">
      {ToastStack}

      <header className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-black mb-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Plane className="w-10 h-10" />
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 tracking-tight leading-none">Pet Passport</h1>
        <p className="text-xl md:text-2xl font-serif italic opacity-90">Send your furry friends on a global adventure</p>
      </header>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Cột trái: Subjects & Config */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white p-6 rounded-3xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
              <span>1. Upload subjects</span>
            </h2>
            <h3 className="mb-4">
              <span className="text-xs font-mono opacity-50">{characterCount}/5 Pets • {objectCount}/14 Objects</span>
            </h3>

            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
              {subjects.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-black/10 rounded-2xl">
                  <Camera className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-serif italic opacity-50">No subjects added yet</p>
                </div>
              )}
              {subjects.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-3 p-2 bg-black/5 rounded-xl border border-black/10 group">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <img src={s.url} alt={s.name} className="w-full h-full object-cover rounded-lg border border-black/20" />
                    <div className="absolute -top-2 -left-2 bg-black text-white text-[10px] font-mono px-1 rounded">img_{idx}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => updateSubjectName(s.id, e.target.value)}
                      className="w-full bg-transparent text-sm font-bold focus:outline-none border-b border-transparent focus:border-black focus:ring-2 focus:ring-black/5 rounded px-1"
                    />
                    <div className="text-[10px] uppercase tracking-widest opacity-50">{s.type}</div>
                  </div>
                  <button onClick={() => removeSubject(s.id)} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 rounded-lg focus:opacity-100 focus:ring-2 focus:ring-red-500 focus:outline-none cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                disabled={characterCount >= 5}
                onClick={() => { setUploadType('character'); fileInputRef.current?.click() }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-black font-bold text-xs uppercase tracking-wider hover:bg-black hover:text-white transition-colors disabled:opacity-30 focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Pet
              </button>
              <button
                disabled={objectCount >= 14}
                onClick={() => { setUploadType('object'); fileInputRef.current?.click() }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-black font-bold text-xs uppercase tracking-wider hover:bg-black hover:text-white transition-colors disabled:opacity-30 focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Object
              </button>
            </div>
            {HiddenFileInput}
          </div>

          {showAdvanced && (
            <div className="bg-white p-6 rounded-3xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5" /> Edit settings
              </h2>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Aspect Ratio</label>
                <div className="relative">
                  <select
                    value={selectedAspectRatio}
                    onChange={(e) => setSelectedAspectRatio(e.target.value)}
                    className="w-full appearance-none bg-black/5 border-2 border-black rounded-xl py-3 px-4 font-bold focus:outline-none cursor-pointer focus:ring-2 focus:ring-black"
                  >
                    {ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleRestart}
            className="w-full py-4 px-6 rounded-full border-2 border-black font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" /> Reset Adventure
          </button>
        </div>

        {/* Cột phải: Prompt & Results */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <MapPin className="w-6 h-6" /> 2. Plan their Adventure
              </h2>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider hover:opacity-70 transition-opacity border-b border-black focus:ring-2 focus:ring-black focus:outline-none focus:border-transparent rounded px-1 cursor-pointer"
              >
                <Settings className="w-4 h-4" /> {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Destination</label>
                <input
                  type="text"
                  value={currentDestination}
                  onChange={(e) => setCurrentDestination(e.target.value)}
                  placeholder="e.g. The Great Wall of China"
                  className="w-full bg-transparent border-b-2 border-black py-3 px-2 text-xl focus:outline-none focus:border-black/50 font-serif italic focus:ring-2 focus:ring-black/5 rounded"
                  disabled={isGenerating}
                />
              </div>

              {showAdvanced && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Scene Description</label>
                  <textarea
                    value={currentDescription}
                    onChange={(e) => setCurrentDescription(e.target.value)}
                    placeholder="Describe the scene, lighting, and what the subjects are doing..."
                    className="w-full bg-black/5 border-2 border-black rounded-2xl p-4 min-h-[120px] focus:outline-none focus:border-black focus:ring-2 focus:ring-black font-serif italic resize-none"
                    disabled={isGenerating}
                  />
                </div>
              )}

              <div className="flex justify-end items-center">
                <button
                  type="submit"
                  disabled={!currentDestination.trim() || subjects.length === 0 || isGenerating}
                  className="w-full sm:w-auto bg-black text-white px-6 sm:px-12 py-4 rounded-full font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-black/80 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 focus:ring-4 focus:ring-black/20 focus:outline-none cursor-pointer"
                >
                  {isGenerating ? (<><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>) : (<><Plane className="w-5 h-5" /> 3. Generate holiday snap!</>)}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t border-black/10">
              <p className="text-sm font-bold uppercase tracking-wider opacity-60 mb-4">Inspiration:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion, idx) => {
                  const petName = subjects.find((s) => s.type === 'character')?.name || 'My pet'
                  const displaySuggestion = suggestion.replace('My pet', petName)
                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentDestination(displaySuggestion)}
                      className="text-left text-xs py-2 px-4 rounded-full border border-black/20 hover:border-black hover:bg-black/5 transition-colors font-serif italic focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
                    >
                      "{displaySuggestion}"
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {destinations.length > 0 && (
            <div className="pt-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <h2 className="text-3xl sm:text-4xl font-bold">Travel Album</h2>
                {destinations.some((d) => d.imageUrl) && (
                  <button onClick={handleDownloadAlbum} className="flex items-center gap-2 font-bold uppercase tracking-wider border-b-2 border-black pb-1 hover:opacity-70 transition-opacity cursor-pointer">
                    <Download className="w-5 h-5" /> Download All
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {destinations.map((dest) => (
                  <div key={dest.id} className="bg-white p-4 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-w-0 overflow-hidden">
                    <div
                      className="bg-black/5 rounded-xl border border-black/10 overflow-hidden relative flex items-center justify-center mb-4 max-h-[600px] min-h-[120px] w-full max-w-full"
                      style={{ aspectRatio: dest.aspectRatio.replace(':', '/') }}
                    >
                      {dest.loading ? (
                        <div className="text-center p-4 sm:p-8 flex flex-col items-center justify-center w-full h-full">
                          <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin mb-4 opacity-50 flex-shrink-0" />
                          <p className="font-serif italic text-sm sm:text-base opacity-70 break-words w-full line-clamp-3">Generating snap of {dest.prompt}</p>
                        </div>
                      ) : dest.error ? (
                        <div className="text-center text-red-600 px-6 py-8">
                          <p className="font-bold mb-2">Adventure Failed</p>
                          <p className="text-sm opacity-80">{dest.error}</p>
                        </div>
                      ) : dest.imageUrl ? (
                        <img src={dest.imageUrl} alt={dest.prompt} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="px-2 min-w-0">
                      <h3 className="font-bold text-lg uppercase tracking-tight break-words">{dest.prompt}</h3>
                      {dest.description && (
                        <p className="font-serif italic text-sm opacity-70 line-clamp-2 mt-1 break-words">"{dest.description}"</p>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-black/10 flex justify-between items-center px-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">AI Generated</span>
                      <span className="text-[10px] font-mono opacity-50">{new Date(parseInt(dest.id, 10)).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
