import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, Shuffle, ChevronLeft, ChevronRight, Info, LayoutGrid, List,
  Share2, Ruler, Play, Pause, Download, ExternalLink, Sparkles, Box, Image as ImageIcon,
  ShieldCheck, Link as LinkIcon, Hash, Coins, MoveVertical,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import AnimatedAvatarViewer from './AnimatedAvatarViewer'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import offlineProjects from '../data/projects.json'

const OFFLINE_AVATAR_MODULES = import.meta.glob('../data/avatars/*.json', { eager: true })

const AVATAR_SOURCES = [
  {
    key: 'realtime',
    label: 'Real-Time',
    baseUrl: 'https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data',
    projectsUrl: 'https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data/projects.json',
  },
  {
    key: 'online',
    label: 'On-Line',
    baseUrl: 'https://raw.githubusercontent.com/xuankhanh1612/open-source-avatars/main/data',
    projectsUrl: 'https://raw.githubusercontent.com/xuankhanh1612/open-source-avatars/main/data/projects.json',
  },
  {
    key: 'offline',
    label: 'Off-Line',
    baseUrl: 'src/data',
    projectsUrl: 'src/data/projects.json',
    offline: true,
  },
]
const PAGE_SIZE_OPTIONS = [8, 16, 32]

const BLOCKCHAIN_LABELS = {
  ethereum: 'Ethereum',
  base: 'Base',
  optimism: 'Optimism',
  polygon: 'Polygon',
  shape: 'Shape',
}

function parseOpenSeaItemUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null
  let parsed
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (!/(^|\.)opensea\.io$/i.test(parsed.hostname)) return null
  const parts = parsed.pathname.split('/').filter(Boolean)
  const itemIndex = parts.findIndex((part) => part.toLowerCase() === 'item')
  if (itemIndex < 0 || parts.length < itemIndex + 4) return null
  const chain = parts[itemIndex + 1]
  const contract = parts[itemIndex + 2]
  const tokenId = parts[itemIndex + 3]
  if (!chain || !contract || !tokenId) return null
  return {
    url: parsed.toString(),
    marketplace: 'OpenSea',
    chain,
    chainLabel: BLOCKCHAIN_LABELS[chain.toLowerCase()] || chain.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    contract,
    tokenId,
  }
}

function shortenAddress(address) {
  if (!address) return '—'
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

function getAvatarOpenSeaInfo(avatar) {
  return parseOpenSeaItemUrl(avatar?.external_url || avatar?.externalUrl || avatar?.metadata?.external_url || avatar?.metadata?.externalUrl)
}
const ANIMATION_BASE_URL = 'https://www.opensourceavatars.com/animations'
// File names follow the PascalCase convention used by opensourceavatars.com's
// own /animations/*.fbx files (confirmed via Cross Jumps -> CrossJumps.fbx and
// Fight Idle -> FightIdle.fbx). T-Pose has no file: it just clears playback.
const ANIMATION_FILE_MAP = {
  'Bored': 'Bored.fbx',
  'Cross Jumps': 'CrossJumps.fbx',
  'Fight Idle': 'FightIdle.fbx',
  'Jumping Rope': 'JumpingRope.fbx',
  'Looking': 'Looking.fbx',
  'Looking Around': 'LookingAround.fbx',
  'Magic Spell Casting': 'MagicSpellCasting.fbx',
  'Offensive Idle': 'OffensiveIdle.fbx',
  'Searching Files High': 'SearchingFilesHigh.fbx',
  'Standing Magic Attack': 'StandingMagicAttack.fbx',
  'Texting While Standing': 'TextingWhileStanding.fbx',
}
const ANIMATION_PRESETS = [
  'T-Pose (Default)',
  'Bored',
  'Cross Jumps',
  'Fight Idle',
  'Jumping Rope',
  'Looking',
  'Looking Around',
  'Magic Spell Casting',
  'Offensive Idle',
  'Searching Files High',
  'Standing Magic Attack',
  'Texting While Standing',
]
const fallbackAvatarSvg = (name, background) => {
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#${background}"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="800" fill="#fff">${initials}</text></svg>`)}`
}

const FALLBACK_AVATARS = [
  {
    id: 'fallback-health-01',
    name: 'Health Explorer',
    collectionName: 'Local fallback',
    license: 'Generated preview',
    format: 'PNG',
    thumbnail_url: fallbackAvatarSvg('Health Explorer', '00b8cc'),
    model_file_url: '',
  },
  {
    id: 'fallback-vrm-02',
    name: 'VRM Pilot',
    collectionName: 'Local fallback',
    license: 'Generated preview',
    format: 'PNG',
    thumbnail_url: fallbackAvatarSvg('VRM Pilot', '6b3fd4'),
    model_file_url: '',
  },
]

const valueOf = (item, keys, fallback = '') => {
  for (const key of keys) {
    const value = item?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}

function normalizeAvatar(item, project) {
  const id = valueOf(item, ['id', 'token_id', 'name'], `${project?.id || 'avatar'}-${Math.random().toString(36).slice(2)}`)
  const name = valueOf(item, ['name', 'title', 'display_name'], `Avatar ${id}`)
  const thumbnail = valueOf(item, ['thumbnail_url', 'preview_image_url', 'image_url', 'image', 'thumbnail', 'preview'])
  const modelUrl = valueOf(item, ['model_file_url', 'vrm_url', 'download_url', 'model_url', 'file_url'])
  const externalUrl = valueOf(item, ['external_url', 'externalUrl']) || valueOf(item?.metadata, ['external_url', 'externalUrl'])
  const openSea = parseOpenSeaItemUrl(externalUrl)
  return {
    ...item,
    id,
    name,
    thumbnail_url: thumbnail,
    model_file_url: modelUrl,
    format: valueOf(item, ['format'], 'VRM'),
    description: valueOf(item, ['description']),
    metadata: item?.metadata && typeof item.metadata === 'object' ? item.metadata : null,
    collectionId: project?.id || '',
    collectionName: project?.name || 'Open Source Avatars',
    license: project?.license || item?.license || 'Open license',
    author: project?.creator_id || '',
    external_url: externalUrl,
    openSea,
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

function moduleDefault(module) {
  return module?.default ?? module
}

async function loadProjectsJson(source) {
  if (source.offline) return offlineProjects
  return fetchJson(source.projectsUrl)
}

async function loadAvatarDataJson(source, dataFile) {
  if (!source.offline) return fetchJson(`${source.baseUrl}/${dataFile}`)
  const modulePath = `../data/${dataFile}`
  const module = OFFLINE_AVATAR_MODULES[modulePath]
  if (!module) throw new Error(`Missing offline avatar data: ${dataFile}`)
  return moduleDefault(module)
}

function avatarFinderSlug(avatar) {
  return String(avatar?.name || avatar?.id || 'froggy')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'froggy'
}

// Real formats derived from the avatar's own record — the primary
// model_file_url plus whatever ToxSam/open-source-avatars actually lists
// under metadata.alternateModels. Nothing here is invented: a format button
// only appears if the dataset provides a URL for it.
function getFormatOptions(avatar) {
  if (!avatar) return []
  const options = []
  const primaryLabel = (avatar.format || 'VRM').toUpperCase()
  if (avatar.model_file_url) {
    options.push({ key: 'primary', label: primaryLabel, url: avatar.model_file_url, kind: primaryLabel.includes('FBX') ? 'fbx' : 'gltf' })
  }
  const alt = avatar.metadata?.alternateModels || {}
  if (alt.fbx) options.push({ key: 'fbx', label: 'FBX', url: alt.fbx, kind: 'fbx' })
  if (alt.voxel_vrm) options.push({ key: 'voxel_vrm', label: 'Voxel VRM', url: alt.voxel_vrm, kind: 'gltf' })
  if (alt.voxel_fbx) options.push({ key: 'voxel_fbx', label: 'Voxel FBX', url: alt.voxel_fbx, kind: 'fbx' })
  const seen = new Set()
  return options.filter((option) => (seen.has(option.label) ? false : (seen.add(option.label), true)))
}

const TEXTURE_URL_KEYS = [
  'texture', 'textures', 'texture_url', 'textureUrl', 'albedo', 'albedo_url', 'albedoUrl',
  'diffuse', 'diffuse_url', 'diffuseUrl', 'base_color', 'baseColor', 'base_color_url', 'baseColorUrl',
  'image', 'image_url', 'imageUrl', 'thumbnail', 'thumbnail_url', 'thumbnailUrl', 'preview', 'preview_url', 'previewUrl',
]

function titleFromTextureKey(key) {
  const normalized = String(key || 'Texture').replace(/[_-]+/g, ' ')
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

function getFileNameFromUrl(url) {
  try {
    const path = new URL(url).pathname
    return decodeURIComponent(path.split('/').filter(Boolean).pop() || url)
  } catch {
    return String(url || '').split('/').filter(Boolean).pop() || String(url || '')
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function normalizeTextureCandidate(value, key = 'Texture', seen = new Set()) {
  if (typeof value !== 'string' || !value.trim()) return null
  const url = value.trim()
  if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) return null
  if (seen.has(url)) return null
  seen.add(url)
  const name = titleFromTextureKey(key)
  const fileName = getFileNameFromUrl(url)
  const lower = `${key} ${fileName}`.toLowerCase()
  const type = lower.includes('normal') ? 'Normal'
    : lower.includes('rough') ? 'Roughness'
      : lower.includes('metal') ? 'Metalness'
        : lower.includes('emissive') ? 'Emissive'
          : lower.includes('ao') || lower.includes('occlusion') ? 'Ambient Occlusion'
            : lower.includes('alpha') ? 'Alpha'
              : lower.includes('thumb') || lower.includes('preview') ? 'Preview'
                : 'Albedo/Diffuse'
  return { key: `${key}-${seen.size}`, name, fileName, url, type }
}

function collectTextureOptions(avatar) {
  if (!avatar) return []
  const seen = new Set()
  const textures = []
  const visit = (value, key = 'Texture', depth = 0) => {
    if (depth > 4 || value == null) return
    if (typeof value === 'string') {
      const candidate = normalizeTextureCandidate(value, key, seen)
      if (candidate) textures.push(candidate)
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${key} ${index + 1}`, depth + 1))
      return
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([childKey, childValue]) => {
        const searchableKey = String(childKey).toLowerCase()
        if (TEXTURE_URL_KEYS.some((textureKey) => searchableKey.includes(textureKey.toLowerCase())) || depth > 0) {
          visit(childValue, childKey, depth + 1)
        }
      })
    }
  }
  visit(avatar.metadata, 'metadata')
  ;['texture_url', 'textureUrl', 'albedo_url', 'albedoUrl', 'diffuse_url', 'diffuseUrl', 'image_url', 'thumbnail_url'].forEach((key) => visit(avatar[key], key))
  if (!textures.length && avatar.thumbnail_url) {
    const fallback = normalizeTextureCandidate(avatar.thumbnail_url, 'Preview texture', seen)
    if (fallback) textures.push(fallback)
  }
  return textures
}

function licenseUsageNote(license, vi) {
  const normalized = (license || '').toUpperCase()
  if (normalized.includes('CC0')) return vi ? 'Mọi người (miễn phí bản quyền)' : 'Everyone (public domain)'
  if (normalized.includes('CC-BY') || normalized.includes('CC BY')) return vi ? 'Mọi người (cần ghi công)' : 'Everyone (attribution required)'
  if (!license) return vi ? 'Chưa rõ' : 'Unspecified'
  return license
}

// ============================================================================
// TRÍCH XUẤT TEXTURE THẬT TỪ FILE MODEL (.vrm/.glb) — giống hệt cách tab
// "Textures" của opensourceavatars.com/en/finder và /en/vrminspector hiển
// thị: field ardriveFiles.textures trong projects.json THỰC RA chỉ là TÊN
// FILE (vd "031_Devil_Voxel_Texture.png"), không phải link tải được, nên
// không thể "lấy" texture qua đó. Cách đúng là PARSE trực tiếp ảnh nhúng bên
// trong chính file .vrm/.glb (chuẩn glTF nhúng ảnh dạng bufferView/base64)
// bằng GLTFLoader rồi liệt kê từng texture THẬT (kích thước/dung lượng thật,
// không đoán) — vì vậy tên texture ở đây theo đúng quy ước "new_texture_N"
// (N = chỉ số texture) như OSA hiển thị, thay vì tên field JSON.
// ============================================================================
const modelTextureCache = new Map() // model url -> Promise<texture[]>

function bytesFromDataUrl(dataUrl) {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) return 0
  const base64Length = dataUrl.length - commaIndex - 1
  return Math.round((base64Length * 3) / 4)
}

function extractModelTextures(url) {
  if (!url) return Promise.resolve([])
  if (modelTextureCache.has(url)) return modelTextureCache.get(url)

  const promise = new Promise((resolve) => {
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        try {
          const parser = gltf.parser
          const textureDefs = parser?.json?.textures || []
          if (!textureDefs.length) { resolve([]); return }
          Promise.all(textureDefs.map((_, index) => parser.getDependency('texture', index).catch(() => null)))
            .then((loadedTextures) => {
              const results = []
              loadedTextures.forEach((tex, index) => {
                const img = tex?.image
                if (!img) return
                const width = img.naturalWidth || img.width || 0
                const height = img.naturalHeight || img.height || 0
                let previewUrl = ''
                let bytes = 0
                try {
                  const canvas = document.createElement('canvas')
                  canvas.width = width || 512
                  canvas.height = height || 512
                  const ctx = canvas.getContext('2d')
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                  previewUrl = canvas.toDataURL('image/png')
                  bytes = bytesFromDataUrl(previewUrl)
                } catch {
                  previewUrl = img.src || ''
                }
                if (!previewUrl) return
                results.push({
                  key: `embedded-${index}`,
                  name: `new_texture_${index}`,
                  fileName: `new_texture_${index}.png`,
                  url: previewUrl,
                  type: 'Albedo/Diffuse',
                  width,
                  height,
                  bytes,
                })
              })
              resolve(results)
            })
        } catch {
          resolve([])
        }
      },
      undefined,
      () => resolve([]) // model lỗi/CORS -> coi như không có texture nhúng, fallback dùng collectTextureOptions
    )
  })

  modelTextureCache.set(url, promise)
  return promise
}

function TexturePreviewCard({ texture, meta, palette, isDark, vi, onLoad, large = false }) {
  if (!texture) return null
  return (
    <div className="osa-card" style={{ overflow: 'hidden', background: palette.card }}>
      <div style={{ aspectRatio: '1 / 1', background: isDark ? '#111827' : '#f8fafc', display: 'grid', placeItems: 'center', padding: large ? 18 : 10 }}>
        <img src={texture.url} alt={texture.name} loading="lazy" onLoad={(event) => onLoad(texture, event)} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'auto' }} />
      </div>
      <div style={{ padding: large ? 16 : 12, borderTop: `1px solid ${palette.border}` }}>
        <div style={{ fontSize: large ? 16 : 14, fontWeight: 900, color: palette.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{texture.name}</div>
        <div style={{ marginTop: 10, display: 'grid', gap: 8, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: palette.text3 }}>{vi ? 'Kích thước' : 'Dimensions'}:</span><strong>{meta?.width ? `${meta.width} × ${meta.height}` : '—'}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: palette.text3 }}>{vi ? 'Dung lượng' : 'File Size'}:</span><strong>{formatBytes(meta?.bytes)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: palette.text3 }}>{vi ? 'Loại' : 'Type'}:</span><strong>{texture.type}</strong></div>
        </div>
        <a href={texture.url} target="_blank" rel="noreferrer" download style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14, borderRadius: 10, border: `1px solid ${palette.border}`, padding: '9px 10px', color: palette.accent, fontSize: 11, fontWeight: 900, textDecoration: 'none' }}><Download size={14} /> {vi ? 'Tải texture' : 'Download texture'}</a>
      </div>
    </div>
  )
}

export default function AvatarCreatorPanel() {
  const { user, updateProfile } = useAuth()
  const { theme, lang } = useApp()
  const isDark = theme === 'dark'
  const vi = lang === 'vi'

  const [projects, setProjects] = useState([])
  const [sourceStatuses, setSourceStatuses] = useState(() => AVATAR_SOURCES.map((source) => ({ ...source, status: 'pending' })))
  const [activeSource, setActiveSource] = useState(null)
  const [avatars, setAvatars] = useState([])
  const [selectedCollection, setSelectedCollection] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [query, setQuery] = useState('')
  const [nftOnly, setNftOnly] = useState(false)
  const [pageSize, setPageSize] = useState(8)
  const [currentPage, setCurrentPage] = useState(1)
  const [browseView, setBrowseView] = useState('grid') // 'grid' | 'list'
  const [selectedFormatKey, setSelectedFormatKey] = useState('primary')
  const [modelStats, setModelStats] = useState(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [showMeasureGrid, setShowMeasureGrid] = useState(true)
  const [showHeightRuler, setShowHeightRuler] = useState(false)
  const [modelHeightMeters, setModelHeightMeters] = useState(null)
  const [showBones, setShowBones] = useState(false)
  const [showWireframe, setShowWireframe] = useState(false)
  const [showTextures, setShowTextures] = useState(true)
  const [assetTab, setAssetTab] = useState('model')
  const [selectedTextureUrl, setSelectedTextureUrl] = useState('')
  const [textureMeta, setTextureMeta] = useState({})
  // Texture THẬT trích xuất trực tiếp từ file .vrm/.glb đang chọn (xem
  // extractModelTextures phía trên) — ưu tiên dùng thay cho
  // collectTextureOptions (chỉ đoán từ field JSON, thường không có link ảnh
  // thật) để bảng Texture giống hệt tab Textures của opensourceavatars.com.
  const [embeddedTextures, setEmbeddedTextures] = useState([])
  const [embeddedTexturesStatus, setEmbeddedTexturesStatus] = useState('idle') // idle | loading | ok | empty
  const [showInfoOverlay, setShowInfoOverlay] = useState(true)
  const [shareStatus, setShareStatus] = useState('')
  const [selectedAnimation, setSelectedAnimation] = useState('Fight Idle')
  const [animationLoadStatus, setAnimationLoadStatus] = useState('')
  const [animationBlobUrl, setAnimationBlobUrl] = useState('')
  const [status, setStatus] = useState(vi ? 'Đang tải danh sách chủ đề avatar...' : 'Loading avatar themes...')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveNote, setSaveNote] = useState('')

  useEffect(() => () => {
    if (animationBlobUrl) URL.revokeObjectURL(animationBlobUrl)
  }, [animationBlobUrl])

  // ---- Load the theme/category list from projects.json (drives the combobox) ----
  useEffect(() => {
    let cancelled = false
    const markSourceStatus = (key, nextStatus) => {
      setSourceStatuses((current) => current.map((source) => (source.key === key ? { ...source, status: nextStatus } : source)))
    }

    async function loadProjects() {
      setStatus(vi ? 'Đang tải danh sách chủ đề avatar từ projects.json...' : 'Loading avatar themes from projects.json...')
      setError('')
      setActiveSource(null)
      setSourceStatuses(AVATAR_SOURCES.map((source) => ({ ...source, status: 'pending' })))

      const failures = []
      for (const source of AVATAR_SOURCES) {
        if (cancelled) return
        markSourceStatus(source.key, 'loading')
        try {
          const registryProjects = await loadProjectsJson(source)
          const publicProjects = registryProjects.filter((project) => project?.is_public !== false && (project.avatar_data_file || project.avatarDataFile))
          if (cancelled) return
          markSourceStatus(source.key, 'ok')
          setActiveSource(source)
          setProjects(publicProjects)
          setSelectedCollection((current) => (publicProjects.some((project) => project.id === current) ? current : (publicProjects[0]?.id || '')))
          if (!publicProjects.length) {
            setAvatars(FALLBACK_AVATARS)
            setSelectedAvatar(FALLBACK_AVATARS[0])
            setStatus(vi ? 'Không có chủ đề public, đang dùng avatar dự phòng.' : 'No public themes were found, using fallback avatars.')
          }
          return
        } catch (err) {
          failures.push(`${source.label}: ${err.message}`)
          if (cancelled) return
          markSourceStatus(source.key, 'error')
        }
      }

      if (cancelled) return
      setProjects([])
      setAvatars(FALLBACK_AVATARS)
      setSelectedAvatar(FALLBACK_AVATARS[0])
      setError(vi ? `Không tải được projects.json: ${failures.join('; ')}` : `Could not load projects.json: ${failures.join('; ')}`)
      setStatus(vi ? 'Bạn vẫn có thể dùng avatar dự phòng để cập nhật hồ sơ.' : 'You can still use a fallback avatar to update your profile.')
    }
    loadProjects()
    return () => { cancelled = true }
  }, [vi])

  // ---- Load avatars for whichever theme is selected in the combobox ----
  useEffect(() => {
    const selectedProject = projects.find((project) => project.id === selectedCollection)
    if (!selectedProject || !activeSource) return
    let cancelled = false
    async function loadThemeAvatars() {
      setStatus(vi ? `Đang tải avatar chủ đề ${selectedProject.name}...` : `Loading ${selectedProject.name} avatars...`)
      setError('')
      setAvatars([])
      setSelectedAvatar(null)
      try {
        const dataFile = selectedProject.avatar_data_file || selectedProject.avatarDataFile
        const data = await loadAvatarDataJson(activeSource, dataFile)
        const list = Array.isArray(data) ? data : (Array.isArray(data?.avatars) ? data.avatars : [])
        const nextAvatars = list.map((item) => normalizeAvatar(item, selectedProject)).filter((item) => item.thumbnail_url || item.model_file_url)
        if (cancelled) return
        setAvatars(nextAvatars.length ? nextAvatars : FALLBACK_AVATARS)
        setSelectedAvatar(nextAvatars[0] || FALLBACK_AVATARS[0])
        setCurrentPage(1)
        setStatus(nextAvatars.length
          ? (vi ? `Đã tải ${nextAvatars.length} avatar trong chủ đề ${selectedProject.name}.` : `Loaded ${nextAvatars.length} avatars in ${selectedProject.name}.`)
          : (vi ? 'Chủ đề này chưa có ảnh xem trước, đang dùng avatar dự phòng.' : 'This theme has no preview images, using fallback avatars.'))
      } catch (err) {
        if (cancelled) return
        setAvatars(FALLBACK_AVATARS)
        setSelectedAvatar(FALLBACK_AVATARS[0])
        setCurrentPage(1)
        setError(vi ? `Không tải được chủ đề ${selectedProject.name}: ${err.message}` : `Could not load ${selectedProject.name}: ${err.message}`)
        setStatus(vi ? 'Bạn vẫn có thể dùng avatar dự phòng để cập nhật hồ sơ.' : 'You can still use a fallback avatar to update your profile.')
      }
    }
    loadThemeAvatars()
    return () => { cancelled = true }
  }, [projects, selectedCollection, activeSource, vi])

  const filteredAvatars = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return avatars.filter((avatar) => {
      const openSea = getAvatarOpenSeaInfo(avatar)
      if (nftOnly && !openSea) return false
      const searchable = `${avatar.name} ${avatar.collectionName} ${avatar.license} ${openSea?.chainLabel || ''} ${openSea?.tokenId || ''}`.toLowerCase()
      return !normalizedQuery || searchable.includes(normalizedQuery)
    })
  }, [avatars, query, nftOnly])

  useEffect(() => { setCurrentPage(1) }, [query, pageSize, selectedCollection, nftOnly])

  // Reset the format/model-stats whenever the selected avatar changes, so we
  // never show stale triangle/material counts from a previously loaded model.
  useEffect(() => {
    setSelectedFormatKey('primary')
    setModelStats(null)
  }, [selectedAvatar?.id])

  const totalPages = Math.max(1, Math.ceil(filteredAvatars.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pagedAvatars = filteredAvatars.slice((safePage - 1) * pageSize, safePage * pageSize)

  const formatOptions = useMemo(() => getFormatOptions(selectedAvatar), [selectedAvatar])
  const metadataTextureOptions = useMemo(() => collectTextureOptions(selectedAvatar), [selectedAvatar])
  // Textures hiện trên UI: ưu tiên texture THẬT trích xuất từ chính file
  // .vrm/.glb (embeddedTextures); chỉ dùng heuristic JSON (metadataTextureOptions)
  // làm phương án dự phòng khi model chưa tải xong / không parse được (lỗi
  // CORS, định dạng FBX không hỗ trợ trích embedded texture qua GLTFLoader...).
  const textureOptions = embeddedTextures.length ? embeddedTextures : metadataTextureOptions
  const selectedTexture = textureOptions.find((texture) => texture.url === selectedTextureUrl) || textureOptions[0] || null
  const selectedTextureMeta = selectedTexture ? textureMeta[selectedTexture.url] : null
  const activeFormat = formatOptions.find((option) => option.key === selectedFormatKey) || formatOptions[0] || null
  const activeModelUrl = activeFormat?.url || ''
  const activeModelKind = activeFormat?.kind || 'gltf'

  useEffect(() => {
    setSelectedTextureUrl((current) => (textureOptions.some((texture) => texture.url === current) ? current : (textureOptions[0]?.url || '')))
  }, [textureOptions])

  // Parse thật file .vrm/.glb đang chọn để lấy texture nhúng bên trong (xem
  // extractModelTextures) — chỉ áp dụng cho định dạng gltf/vrm (GLTFLoader
  // không đọc được FBX). Cache theo URL nên đổi qua lại giữa các định dạng/
  // avatar đã xem không phải tải lại.
  useEffect(() => {
    if (!activeModelUrl || activeModelKind !== 'gltf') {
      setEmbeddedTextures([])
      setEmbeddedTexturesStatus('idle')
      return
    }
    let cancelled = false
    setEmbeddedTexturesStatus('loading')
    extractModelTextures(activeModelUrl).then((textures) => {
      if (cancelled) return
      setEmbeddedTextures(textures)
      setEmbeddedTexturesStatus(textures.length ? 'ok' : 'empty')
      if (textures.length) {
        setTextureMeta((current) => {
          const next = { ...current }
          textures.forEach((texture) => {
            next[texture.url] = { width: texture.width, height: texture.height, bytes: texture.bytes }
          })
          return next
        })
      }
    })
    return () => { cancelled = true }
  }, [activeModelUrl, activeModelKind])

  useEffect(() => {
    const controller = new AbortController()
    // Texture trích xuất thật (data: URL) đã có sẵn width/height/bytes chính
    // xác ngay khi extract xong, không cần HEAD fetch — chỉ còn dùng cách
    // này cho texture theo link http(s) thật (nhánh dự phòng metadata).
    textureOptions.filter((texture) => /^https?:\/\//i.test(texture.url)).forEach((texture) => {
      fetch(texture.url, { method: 'HEAD', signal: controller.signal })
        .then((response) => {
          const length = Number(response.headers.get('content-length'))
          if (!Number.isFinite(length) || length <= 0) return
          setTextureMeta((current) => ({ ...current, [texture.url]: { ...(current[texture.url] || {}), bytes: length } }))
        })
        .catch(() => {})
    })
    return () => controller.abort()
  }, [textureOptions])

  const handleTextureImageLoad = (texture, event) => {
    const img = event.currentTarget
    setTextureMeta((current) => ({
      ...current,
      [texture.url]: {
        ...(current[texture.url] || {}),
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
      },
    }))
  }

  const loadAnimationFile = async (animation) => {
    setSelectedAnimation(animation)
    const fileName = ANIMATION_FILE_MAP[animation]
    if (!fileName) {
      // T-Pose (Default): drop the current clip reference so the viewer's
      // mixer action gets stopped next time an animation blob effect re-runs.
      if (animationBlobUrl) URL.revokeObjectURL(animationBlobUrl)
      setAnimationBlobUrl('')
      setAnimationLoadStatus('')
      return
    }

    const animationUrl = `${ANIMATION_BASE_URL}/${fileName}`
    setAnimationLoadStatus(vi ? `Đang tải ${fileName}...` : `Loading ${fileName}...`)

    try {
      // Real network fetch — nothing here is a canned number.
      const response = await fetch(animationUrl, { headers: { Accept: 'application/octet-stream,*/*' } })
      if (!response.ok && response.status !== 304) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const nextBlobUrl = URL.createObjectURL(blob)
      if (animationBlobUrl) URL.revokeObjectURL(animationBlobUrl)
      setAnimationBlobUrl(nextBlobUrl)
    } catch (err) {
      console.warn(`Animation load failed for ${fileName}`, err)
      setAnimationLoadStatus(vi ? `Không tải được ${fileName}: ${err.message}` : `Could not load ${fileName}: ${err.message}`)
    }
  }

  const handleUseAvatar = async () => {
    if (!selectedAvatar) return
    setSaving(true)
    const previewUrl = selectedAvatar.thumbnail_url || selectedAvatar.image_url || selectedAvatar.model_file_url
    // modelKind: cùng logic phân loại FBX/glTF (bao gồm VRM) đang dùng cho
    // AnimatedAvatarViewer ở getFormatOptions() bên trên — lưu lại để màn
    // hình Profile biết dùng loader nào khi hiển thị avatar 3D thật.
    const modelKind = (selectedAvatar.format || '').toUpperCase().includes('FBX') ? 'fbx' : 'gltf'
    updateProfile({
      avatar: previewUrl,
      avatarCustomized: true,
      openSourceAvatar: {
        id: selectedAvatar.id,
        name: selectedAvatar.name,
        collectionId: selectedAvatar.collectionId,
        collectionName: selectedAvatar.collectionName,
        license: selectedAvatar.license,
        thumbnailUrl: selectedAvatar.thumbnail_url || '',
        modelFileUrl: selectedAvatar.model_file_url || '',
        format: selectedAvatar.format || 'VRM',
        modelKind,
        source: 'ToxSam/open-source-avatars',
        openSea: getAvatarOpenSeaInfo(selectedAvatar),
      },
    })
    setSaveNote(vi ? 'Đã lưu làm avatar hồ sơ!' : 'Saved as profile avatar!')
    window.setTimeout(() => setSaving(false), 350)
    window.setTimeout(() => setSaveNote(''), 2400)
  }

  const handleRandomAvatar = () => {
    if (!filteredAvatars.length) return
    const pick = filteredAvatars[Math.floor(Math.random() * filteredAvatars.length)]
    setSelectedAvatar(pick)
    const idx = filteredAvatars.indexOf(pick)
    setCurrentPage(Math.floor(idx / pageSize) + 1)
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(selectedAvatarFinderUrl)
      setShareStatus(vi ? 'Đã copy link!' : 'Link copied!')
    } catch {
      setShareStatus(vi ? 'Không copy được link' : 'Could not copy link')
    }
    window.setTimeout(() => setShareStatus(''), 2200)
  }

  const selectedAvatarFinderUrl = selectedAvatar
    ? `https://www.opensourceavatars.com/en/finder?avatar=${encodeURIComponent(avatarFinderSlug(selectedAvatar))}`
    : 'https://www.opensourceavatars.com/en/finder?avatar=froggy'

  const palette = {
    text: isDark ? '#e8f0f8' : '#172033',
    text2: isDark ? 'rgba(232,240,248,0.66)' : '#526071',
    text3: isDark ? 'rgba(232,240,248,0.44)' : '#7b8794',
    card: isDark ? 'rgba(255,255,255,0.055)' : '#fff',
    card2: isDark ? 'rgba(255,255,255,0.08)' : '#f8fafc',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
    accent: '#00b8cc',
  }

  const iconBtnStyle = (active) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 10,
    border: `1px solid ${active ? palette.accent : palette.border}`,
    background: active ? 'rgba(0,184,204,0.14)' : palette.card,
    color: active ? palette.accent : palette.text2,
    cursor: 'pointer',
  })

  const metadata = selectedAvatar?.metadata
  const nftAttributes = Array.isArray(metadata?.attributes) ? metadata.attributes.slice(0, 4) : []
  const selectedOpenSea = getAvatarOpenSeaInfo(selectedAvatar)
  const nftAvatarCount = avatars.filter((avatar) => getAvatarOpenSeaInfo(avatar)).length

  return (
    <div style={{ padding: 24, color: palette.text, maxWidth: 1440, margin: '0 auto' }}>
      <style>{`
        .osa-select, .osa-input { border:1px solid ${palette.border}; background:${palette.card}; color:${palette.text}; border-radius:12px; padding:10px 12px; font-family:inherit; font-size:13px; }
        .osa-card { border:1px solid ${palette.border}; border-radius:18px; background:${palette.card2}; }
        .osa-label { font-size:10px; font-weight:900; letter-spacing:.09em; text-transform:uppercase; color:${palette.text3}; }
        .osa-thumb-btn { text-align:left; border-radius:16px; overflow:hidden; padding:0; cursor:pointer; transition: transform .12s ease, box-shadow .12s ease; }
        .osa-thumb-btn:hover { transform: translateY(-2px); }
        .osa-layout { display:grid; grid-template-columns: minmax(230px,290px) minmax(230px,270px) minmax(360px,1fr) minmax(190px,220px); gap:16px; align-items:start; }
        .osa-texture-inspector { display:grid; grid-template-columns:minmax(260px,360px) minmax(360px,1fr) minmax(210px,260px); gap:16px; align-items:stretch; }
        .osa-scroll::-webkit-scrollbar { width:6px; }
        .osa-scroll::-webkit-scrollbar-thumb { background:${palette.border}; border-radius:6px; }
        @media (max-width: 1360px) {
          .osa-layout { grid-template-columns: 1fr 1fr; }
          .osa-browse-col { order:1; }
          .osa-detail-col { order:2; }
          .osa-viewer-col { order:3; grid-column: 1 / -1; }
          .osa-anim-col { order:4; grid-column: 1 / -1; }
          .osa-texture-inspector { grid-template-columns:1fr; }
        }
        @media (max-width: 760px) {
          .osa-layout { grid-template-columns: 1fr; }
          .osa-browse-col, .osa-detail-col, .osa-viewer-col, .osa-anim-col { grid-column: 1 / -1; }
          .osa-texture-inspector { grid-template-columns:1fr; }
        }
      `}</style>

      <section className="osa-card" style={{ overflow: 'hidden', boxShadow: isDark ? '0 18px 55px rgba(0,0,0,0.28)' : '0 18px 55px rgba(15,23,42,0.08)' }}>
        {/* ---- Header, styled after opensourceavatars.com's top bar ---- */}
        <div style={{ padding: '18px 22px', background: 'linear-gradient(135deg, rgba(0,229,255,0.16), rgba(156,111,255,0.18))', borderBottom: `1px solid ${palette.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '.02em' }}>OSA</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: palette.accent, letterSpacing: '.12em', textTransform: 'uppercase' }}>Open Source Avatars</span>
              </div>
              <nav style={{ display: 'flex', gap: 6 }}>
                {['Home', 'Avatars', 'Finder', 'Inspector'].map((tab) => (
                  <span key={tab} style={{
                    fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase',
                    padding: '6px 10px', borderRadius: 999,
                    color: tab === 'Avatars' ? '#001018' : palette.text3,
                    background: tab === 'Avatars' ? palette.accent : 'transparent',
                  }}>{tab}</span>
                ))}
              </nav>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={user?.avatar || selectedAvatar?.thumbnail_url || FALLBACK_AVATARS[0].thumbnail_url} alt="Current user avatar" style={{ width: 44, height: 44, borderRadius: 14, objectFit: 'cover', border: `2px solid ${palette.accent}` }} />
              <div>
                <div style={{ fontWeight: 900, fontSize: 13 }}>{user?.name || (vi ? 'Người dùng' : 'User')}</div>
                <div style={{ color: palette.text3, fontSize: 11 }}>{user?.email || user?.uuid || 'guest'}</div>
              </div>
            </div>
          </div>

          <div style={{ margin: '10px 0 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: palette.text2 }}>{vi ? 'Nguồn/Source' : 'Source'}</span>
            {sourceStatuses.map((source) => {
              const dotColor = source.status === 'ok' ? '#22c55e' : source.status === 'error' ? '#ef4444' : source.status === 'loading' ? '#f59e0b' : palette.text3
              return (
                <span key={source.key} title={source.projectsUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${activeSource?.key === source.key ? palette.accent : palette.border}`, borderRadius: 999, padding: '5px 9px', background: activeSource?.key === source.key ? 'rgba(0,229,255,0.12)' : palette.card, color: palette.text2, fontSize: 11, fontWeight: 900 }}>
                  <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 999, background: dotColor, boxShadow: source.status === 'ok' ? '0 0 0 3px rgba(34,197,94,0.16)' : source.status === 'error' ? '0 0 0 3px rgba(239,68,68,0.14)' : 'none' }} />
                  {source.label}
                </span>
              )
            })}
            {nftAvatarCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${palette.accent}`, borderRadius: 999, padding: '5px 9px', background: 'linear-gradient(135deg, rgba(0,184,204,0.16), rgba(99,102,241,0.16))', color: palette.accent, fontSize: 11, fontWeight: 900 }}>
                <ShieldCheck size={12} /> {nftAvatarCount} {vi ? 'NFT Blockchain' : 'Blockchain NFTs'}
              </span>
            )}
          </div>
          <p style={{ margin: '10px 0 0', color: palette.text2, maxWidth: 760, lineHeight: 1.6, fontSize: 13 }}>
            {vi
              ? 'Chọn chủ đề từ projects.json của xuankhanh1612/open-source-avatars, duyệt & phân trang danh sách avatar, xem 3D thật, nhận diện item có link OpenSea và lưu làm avatar hồ sơ.'
              : 'Pick a theme from xuankhanh1612/open-source-avatars projects.json, browse the paginated list, view a real 3D model, detect OpenSea-linked items, and save it as the profile avatar.'}
          </p>
        </div>

        <div style={{ padding: 18 }}>
          <div className="osa-layout">

            {/* ============ Column 1: Browse / search / theme combobox / grid ============ */}
            <div className="osa-browse-col osa-card" style={{ padding: 14 }}>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: palette.text3 }} />
                <input
                  className="osa-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={vi ? 'Tìm avatar...' : 'Search avatars...'}
                  style={{ width: '100%', paddingLeft: 30, boxSizing: 'border-box' }}
                />
              </div>

              <div className="osa-label" style={{ marginBottom: 6 }}>{vi ? 'Chủ đề (projects.json)' : 'Theme (projects.json)'}</div>
              <select
                className="osa-select"
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                style={{ width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
              >
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.license}</option>)}
                {!projects.length && <option value="">{vi ? 'Avatar dự phòng' : 'Fallback avatars'}</option>}
              </select>

              <button type="button" onClick={handleRandomAvatar} className="osa-card" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', marginBottom: 12, cursor: 'pointer', fontWeight: 900, fontSize: 12, color: palette.text }}>
                <Shuffle size={14} /> {vi ? 'Avatar ngẫu nhiên' : 'Random Avatar'}
              </button>

              <button
                type="button"
                onClick={() => setNftOnly((value) => !value)}
                disabled={!nftAvatarCount}
                className="osa-card"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  marginBottom: 12,
                  cursor: nftAvatarCount ? 'pointer' : 'not-allowed',
                  fontWeight: 900,
                  fontSize: 12,
                  color: nftOnly ? '#fff' : palette.text,
                  background: nftOnly ? 'linear-gradient(135deg,#00b8cc,#8b5cf6)' : palette.card,
                  opacity: nftAvatarCount ? 1 : 0.55,
                }}
              >
                <ShieldCheck size={14} /> {nftOnly ? (vi ? 'Đang lọc NFT OpenSea' : 'Filtering OpenSea NFTs') : (vi ? 'Chỉ NFT Blockchain' : 'Blockchain NFTs only')}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <span style={{ color: palette.text3, fontSize: 11 }}>
                  {vi ? `${filteredAvatars.length} avatar${nftOnly ? ' NFT' : ''}` : `${filteredAvatars.length} ${nftOnly ? 'NFT ' : ''}avatars`}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => setBrowseView('grid')} style={iconBtnStyle(browseView === 'grid')} title={vi ? 'Xem dạng lưới' : 'Grid view'}><LayoutGrid size={14} /></button>
                  <button type="button" onClick={() => setBrowseView('list')} style={iconBtnStyle(browseView === 'list')} title={vi ? 'Xem dạng danh sách' : 'List view'}><List size={14} /></button>
                </div>
              </div>

              <div className="osa-scroll" style={{ maxHeight: 480, overflowY: 'auto', display: browseView === 'grid' ? 'grid' : 'flex', gridTemplateColumns: browseView === 'grid' ? 'repeat(2, 1fr)' : undefined, flexDirection: browseView === 'list' ? 'column' : undefined, gap: 8 }}>
                {pagedAvatars.map((avatar) => {
                  const active = selectedAvatar?.id === avatar.id
                  const openSea = getAvatarOpenSeaInfo(avatar)
                  if (browseView === 'list') {
                    return (
                      <button key={`${avatar.collectionId}-${avatar.id}`} type="button" onClick={() => setSelectedAvatar(avatar)} className="osa-thumb-btn" style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${active ? palette.accent : palette.border}`, background: active ? 'rgba(0,184,204,0.10)' : palette.card, padding: 6 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(0,0,0,0.08)', display: 'grid', placeItems: 'center' }}>
                          {avatar.thumbnail_url ? <img src={avatar.thumbnail_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🧑‍🚀</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{avatar.name}</div>
                          <div style={{ fontSize: 10, color: openSea ? palette.accent : palette.text3 }}>{openSea ? `NFT · ${openSea.chainLabel} · #${openSea.tokenId}` : avatar.format}</div>
                        </div>
                      </button>
                    )
                  }
                  return (
                    <button key={`${avatar.collectionId}-${avatar.id}`} type="button" onClick={() => setSelectedAvatar(avatar)} className="osa-thumb-btn" style={{ border: `1px solid ${active ? palette.accent : palette.border}`, background: active ? 'rgba(0,184,204,0.10)' : palette.card, boxShadow: active ? `0 0 0 3px rgba(0,184,204,0.15)` : 'none' }}>
                      <div style={{ aspectRatio: '1 / 1', background: 'rgba(0,0,0,0.08)', display: 'grid', placeItems: 'center' }}>
                        {avatar.thumbnail_url ? <img src={avatar.thumbnail_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 32 }}>🧑‍🚀</span>}
                      </div>
                      <div style={{ padding: 7 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{avatar.name}</div>
                        <div style={{ fontSize: 9, color: openSea ? '#8b5cf6' : palette.accent, fontWeight: 800, marginTop: 2 }}>{openSea ? `NFT · ${openSea.chainLabel}` : avatar.format}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
                <select className="osa-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label={vi ? 'Số avatar mỗi trang' : 'Avatars per page'} style={{ padding: '7px 8px', fontSize: 11 }}>
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} / {vi ? 'trang' : 'page'}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage <= 1} style={iconBtnStyle(false)}><ChevronLeft size={14} /></button>
                  <span style={{ fontSize: 11, color: palette.text2 }}>{safePage}/{totalPages}</span>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage >= totalPages} style={iconBtnStyle(false)}><ChevronRight size={14} /></button>
                </div>
              </div>
            </div>

            {/* ============ Column 2: Selected avatar detail / technical panels ============ */}
            <div className="osa-detail-col osa-card" style={{ padding: 14 }}>
              <div style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(135deg,#0f172a,#312e81)', border: `1px solid ${palette.border}`, display: 'grid', placeItems: 'center' }}>
                {selectedAvatar?.thumbnail_url
                  ? <img src={selectedAvatar.thumbnail_url} alt={selectedAvatar.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 56 }}>🧑‍🚀</span>}
                <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9, fontWeight: 900 }}>{selectedAvatar?.collectionName}</span>
                <span style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', borderRadius: 999, background: palette.accent, color: '#001018', fontSize: 9, fontWeight: 900 }}>{selectedAvatar?.license}</span>
              </div>

              <h2 style={{ margin: '12px 0 2px', fontSize: 18 }}>{selectedAvatar?.name || (vi ? 'Chọn avatar' : 'Select an avatar')}</h2>
              {selectedAvatar?.description && <div style={{ color: palette.text3, fontSize: 11, marginBottom: 10 }}>{selectedAvatar.description}</div>}

              {selectedOpenSea && (
                <div className="osa-card" style={{ padding: 12, marginTop: 10, background: 'linear-gradient(135deg, rgba(0,184,204,0.12), rgba(139,92,246,0.14))', borderColor: 'rgba(139,92,246,0.38)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <ShieldCheck size={16} style={{ color: '#8b5cf6' }} />
                    <strong style={{ fontSize: 13 }}>{vi ? 'NFT Blockchain' : 'Blockchain NFT'}</strong>
                  </div>
                  <div style={{ display: 'grid', gap: 8, fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: palette.text3 }}><Coins size={12} /> Chain</span>
                      <strong>{selectedOpenSea.chainLabel}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: palette.text3 }}><Hash size={12} /> Token ID</span>
                      <strong>#{selectedOpenSea.tokenId}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: palette.text3 }}><LinkIcon size={12} /> Contract</span>
                      <strong title={selectedOpenSea.contract}>{shortenAddress(selectedOpenSea.contract)}</strong>
                    </div>
                  </div>
                  <a href={selectedOpenSea.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, borderRadius: 10, border: `1px solid ${palette.border}`, padding: '9px 10px', color: palette.accent, fontSize: 11, fontWeight: 900, textDecoration: 'none', background: palette.card }}>
                    {vi ? 'Mở item trên OpenSea' : 'Open item on OpenSea'} <ExternalLink size={13} />
                  </a>
                </div>
              )}

              <div className="osa-label" style={{ margin: '10px 0 6px' }}>{vi ? 'Chi tiết kỹ thuật' : 'Technical Details'}</div>
              <div style={{ fontSize: 12, lineHeight: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: palette.text3 }}>{vi ? 'Định dạng' : 'Format'}</span><strong>{activeFormat?.label || '—'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: palette.text3 }}>{vi ? 'Tam giác' : 'Triangles'}</span><strong>{modelStats ? modelStats.triangles.toLocaleString() : (activeModelUrl ? (vi ? 'Đang tính...' : 'Calculating...') : '—')}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: palette.text3 }}>{vi ? 'Vật liệu' : 'Materials'}</span><strong>{modelStats ? modelStats.materials : '—'}</strong></div>
              </div>

              <div className="osa-label" style={{ margin: '12px 0 6px' }}>{vi ? 'Giấy phép' : 'License'}</div>
              <div style={{ fontSize: 12, lineHeight: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: palette.text3 }}>{vi ? 'Dự án' : 'Project'}</span><strong>{selectedAvatar?.collectionName || '—'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: palette.text3 }}>{vi ? 'Giấy phép' : 'License'}</span><strong>{selectedAvatar?.license || '—'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: palette.text3 }}>{vi ? 'Tác giả' : 'Author'}</span><strong>{selectedAvatar?.author || '—'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: palette.text3 }}>{vi ? 'Đối tượng dùng' : 'Allowed Users'}</span><strong>{licenseUsageNote(selectedAvatar?.license, vi)}</strong></div>
              </div>

              {(metadata?.series || metadata?.number || nftAttributes.length > 0) && (
                <>
                  <div className="osa-label" style={{ margin: '12px 0 6px' }}>{vi ? 'Siêu dữ liệu' : 'Metadata'}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.9 }}>
                    {metadata?.series && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: palette.text3 }}>Series</span><strong>{metadata.series}{metadata.number ? ` · #${metadata.number}` : ''}</strong></div>}
                    {nftAttributes.map((attr, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: palette.text3 }}>{attr.trait_type}</span><strong>{attr.value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <a href={selectedAvatarFinderUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, color: palette.accent, fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>
                {vi ? 'Mở trong Finder' : 'Open in Finder'} <ExternalLink size={11} />
              </a>

              <button type="button" onClick={handleUseAvatar} disabled={!selectedAvatar || saving} style={{ marginTop: 12, width: '100%', border: 'none', borderRadius: 12, padding: '11px 14px', cursor: saving ? 'wait' : 'pointer', fontWeight: 900, fontSize: 12, color: '#001018', background: 'linear-gradient(135deg,#00e5ff,#00e676)' }}>
                {saving ? (vi ? 'Đang lưu...' : 'Saving...') : (vi ? 'Dùng làm avatar hồ sơ' : 'Use as profile avatar')}
              </button>
              {saveNote && <div style={{ marginTop: 6, color: '#00b874', fontSize: 11, fontWeight: 800 }}>{saveNote}</div>}
            </div>

            {/* ============ Column 3: 3D render frame ============ */}
            <div className="osa-viewer-col osa-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: `1px solid ${palette.border}`, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setShowInfoOverlay((v) => !v)} style={iconBtnStyle(showInfoOverlay)} title={vi ? 'Hiện thông tin' : 'Toggle info'}><Info size={15} /></button>
                  <button type="button" onClick={handleShare} style={iconBtnStyle(false)} title={vi ? 'Copy link' : 'Share'}><Share2 size={15} /></button>
                  <button type="button" onClick={() => setShowMeasureGrid((v) => !v)} style={iconBtnStyle(showMeasureGrid)} title={vi ? 'Lưới đo' : 'Measurement grid'}><Ruler size={15} /></button>
                  <button type="button" onClick={() => setShowHeightRuler((v) => !v)} style={iconBtnStyle(showHeightRuler)} title={vi ? 'Thước đo chiều cao' : 'Height ruler'} aria-pressed={showHeightRuler}><MoveVertical size={15} /></button>
                  <button type="button" onClick={() => setShowBones((v) => !v)} style={iconBtnStyle(showBones)} title={vi ? 'Hiện xương' : 'Show Bones'} aria-pressed={showBones}>🦴</button>
                  <button type="button" onClick={() => setShowWireframe((v) => !v)} style={iconBtnStyle(showWireframe)} title="Wireframe" aria-pressed={showWireframe}><Box size={15} /></button>
                  <button type="button" onClick={() => setShowTextures((v) => !v)} style={iconBtnStyle(showTextures)} title="Textures" aria-pressed={showTextures}><ImageIcon size={15} /></button>
                  <button type="button" onClick={() => setAutoRotate((v) => !v)} style={iconBtnStyle(autoRotate)} title={vi ? 'Tự xoay' : 'Auto-rotate'}>{autoRotate ? <Pause size={15} /> : <Play size={15} />}</button>
                </div>
                <span style={{ padding: '4px 8px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)', color: palette.text2, fontSize: 10, fontWeight: 900 }}>
                  {shareStatus || (showHeightRuler && modelHeightMeters ? `${vi ? 'Cao' : 'Height'}: ${modelHeightMeters.toFixed(2)} m` : 'VRM Inspector')}
                </span>
              </div>

              <div style={{ position: 'relative', minHeight: 420, background: isDark ? 'linear-gradient(180deg,#0b1220,#050816)' : 'linear-gradient(180deg,#f4f0e8,#e8e1d7)' }}>
                {showInfoOverlay && selectedAvatar && (
                  <div style={{ position: 'absolute', zIndex: 3, top: 10, left: 10, padding: '6px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 800, maxWidth: 220 }}>
                    {selectedAvatar.name} · {activeFormat?.label || selectedAvatar.format}
                  </div>
                )}
                {activeModelUrl ? (
                  <div style={{ width: '100%', height: 420 }}>
                    <AnimatedAvatarViewer
                      modelUrl={activeModelUrl}
                      modelKind={activeModelKind}
                      animationBlobUrl={animationBlobUrl}
                      animationLabel={selectedAnimation}
                      isDark={isDark}
                      autoRotate={autoRotate}
                      showGrid={showMeasureGrid}
                      showHeightRuler={showHeightRuler}
                      showBones={showBones}
                      showWireframe={showWireframe}
                      showTextures={showTextures}
                      onStatusChange={(update) => {
                        if (update.error) {
                          setAnimationLoadStatus(vi ? `Lỗi: ${update.error}` : `Error: ${update.error}`)
                        } else if (update.stats) {
                          setModelStats(update.stats)
                        } else if (typeof update.realHeightMeters === 'number') {
                          setModelHeightMeters(update.realHeightMeters)
                        } else if (typeof update.trackCount === 'number') {
                          setAnimationLoadStatus(vi
                            ? `${selectedAnimation} đã tải xong · ${update.trackCount} tracks`
                            : `${selectedAnimation} loaded · ${update.trackCount} tracks`)
                        } else if (update.timedOut) {
                          setAnimationLoadStatus(vi ? 'Đã ép tắt loading (safety timeout)' : 'Loading indicator forced off (safety timeout)')
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ height: 420, display: 'grid', placeItems: 'center' }}>
                    {selectedAvatar?.thumbnail_url
                      ? <img src={selectedAvatar.thumbnail_url} alt={selectedAvatar.name} style={{ maxHeight: '80%', borderRadius: 16 }} />
                      : <span style={{ fontSize: 72 }}>🧑‍🚀</span>}
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 14px', borderTop: `1px solid ${palette.border}` }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button type="button" onClick={() => setAssetTab('model')} style={{ padding: '7px 12px', borderRadius: 999, border: `1px solid ${assetTab === 'model' ? palette.accent : palette.border}`, background: assetTab === 'model' ? 'rgba(0,184,204,0.14)' : palette.card, color: assetTab === 'model' ? palette.accent : palette.text2, fontWeight: 900, fontSize: 11, cursor: 'pointer' }}>Model</button>
                  <button type="button" onClick={() => setAssetTab('textures')} style={{ padding: '7px 12px', borderRadius: 999, border: `1px solid ${assetTab === 'textures' ? palette.accent : palette.border}`, background: assetTab === 'textures' ? 'rgba(0,184,204,0.14)' : palette.card, color: assetTab === 'textures' ? palette.accent : palette.text2, fontWeight: 900, fontSize: 11, cursor: 'pointer' }}>Textures</button>
                </div>
                {assetTab === 'model' ? (
                  <>
                    <div className="osa-label" style={{ marginBottom: 8 }}>{vi ? 'Định dạng' : 'Format'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {formatOptions.length ? formatOptions.map((option) => (
                        <button key={option.key} type="button" onClick={() => setSelectedFormatKey(option.key)} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${option.key === (activeFormat?.key) ? palette.accent : palette.border}`, background: option.key === (activeFormat?.key) ? 'rgba(0,184,204,0.14)' : palette.card, color: palette.text, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                          {option.label}
                        </button>
                      )) : <span style={{ color: palette.text3, fontSize: 12 }}>{vi ? 'Không có file model.' : 'No model file available.'}</span>}
                    </div>
                  </>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <div className="osa-label" style={{ marginBottom: 8 }}>{vi ? 'Textures 2D' : '2D Textures'}</div>
                    {embeddedTexturesStatus === 'loading' && (
                      <div style={{ fontSize: 11, color: palette.text3, marginBottom: 8 }}>
                        {vi ? '⏳ Đang phân tích texture nhúng trong model...' : '⏳ Extracting embedded textures from the model...'}
                      </div>
                    )}
                    {selectedTexture ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(190px, 1.1fr) minmax(160px, 0.9fr)', gap: 12 }}>
                        <div className="osa-card" style={{ overflow: 'hidden', background: palette.card }}>
                          <TexturePreviewCard texture={selectedTexture} meta={selectedTextureMeta} palette={palette} isDark={isDark} vi={vi} onLoad={handleTextureImageLoad} />
                        </div>
                        <div className="osa-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 330, overflowY: 'auto' }}>
                          {textureOptions.map((texture) => {
                            const activeTexture = selectedTexture?.url === texture.url
                            return (
                              <button key={texture.url} type="button" onClick={() => setSelectedTextureUrl(texture.url)} style={{ display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', border: `1px solid ${activeTexture ? palette.accent : palette.border}`, borderLeft: activeTexture ? `3px solid ${palette.accent}` : `3px solid transparent`, background: activeTexture ? 'rgba(0,184,204,0.12)' : palette.card, color: palette.text, borderRadius: 10, padding: 7, cursor: 'pointer' }}>
                                <span style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', background: isDark ? '#111827' : '#f1f5f9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                  <img src={texture.url} alt="" loading="lazy" onLoad={(event) => handleTextureImageLoad(texture, event)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </span>
                                <span style={{ minWidth: 0 }}>
                                  <span style={{ display: 'block', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{texture.name}</span>
                                  <span style={{ display: 'block', fontSize: 10, color: palette.text3, marginTop: 2 }}>{texture.type}</span>
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : <span style={{ color: palette.text3, fontSize: 12 }}>{vi ? 'Chưa tìm thấy texture trong dữ liệu avatar.' : 'No texture assets were found in this avatar record.'}</span>}
                  </div>
                )}
                <a
                  href={activeModelUrl || undefined}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', borderRadius: 12, padding: '11px 14px',
                    fontWeight: 900, fontSize: 13, textDecoration: 'none',
                    color: activeModelUrl ? '#001018' : palette.text3,
                    background: activeModelUrl ? 'linear-gradient(135deg,#00e5ff,#9c6fff)' : palette.card,
                    border: activeModelUrl ? 'none' : `1px solid ${palette.border}`,
                    pointerEvents: activeModelUrl ? 'auto' : 'none',
                  }}
                >
                  <Download size={15} /> {vi ? 'Tải xuống' : 'Download'}
                </a>
              </div>

              <p style={{ padding: '0 14px 14px', color: error ? '#ff6b6b' : palette.text3, fontSize: 11, lineHeight: 1.5, margin: 0 }}>{error || status}</p>
            </div>

            {/* ============ Column 4: Animations ============ */}
            <div className="osa-anim-col osa-card" style={{ padding: 14 }}>
              <div className="osa-label" style={{ marginBottom: 4 }}>{vi ? 'Hoạt ảnh' : 'Animations'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Sparkles size={12} style={{ color: palette.accent }} />
                <span style={{ fontSize: 11, color: palette.text3 }}>{selectedAnimation}</span>
              </div>
              <div className="osa-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
                {ANIMATION_PRESETS.map((animation) => {
                  const active = selectedAnimation === animation
                  return (
                    <button key={animation} type="button" onClick={() => loadAnimationFile(animation)} style={{ textAlign: 'left', border: `1px solid ${active ? palette.accent : 'transparent'}`, borderLeft: active ? `3px solid ${palette.accent}` : '3px solid transparent', background: active ? (isDark ? 'rgba(0,184,204,0.14)' : '#fff') : 'transparent', color: palette.text, borderRadius: 8, padding: '9px 8px', cursor: 'pointer', fontSize: 12, fontWeight: active ? 900 : 600 }}>
                      {animation}
                    </button>
                  )
                })}
              </div>
              {animationLoadStatus && (
                <div style={{ marginTop: 10, padding: '8px 9px', borderRadius: 8, background: isDark ? 'rgba(0,229,255,0.10)' : 'rgba(0,184,204,0.10)', color: palette.accent, fontSize: 11, fontWeight: 800, lineHeight: 1.35 }}>
                  {animationLoadStatus}
                </div>
              )}
              <div style={{ marginTop: 10, color: palette.text3, fontSize: 10, lineHeight: 1.45 }}>
                {vi
                  ? 'Fetch file .fbx thật từ opensourceavatars.com, parse bằng THREE.FBXLoader, phát trên skeleton qua THREE.AnimationMixer.'
                  : 'Fetches the real .fbx from opensourceavatars.com, parses it with THREE.FBXLoader, and plays it via a genuine THREE.AnimationMixer.'}
              </div>
            </div>

          </div>

          {/* ============ OSA-style 2D texture inspector, like Finder/Inspector texture views ============ */}
          <div className="osa-card" style={{ marginTop: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.01em', color: palette.text }}>{vi ? 'Textures 2D' : '2D Textures'}</div>
                <div style={{ fontSize: 12, color: palette.text3, marginTop: 2 }}>
                  {vi ? 'Xem UV/texture giống tab Textures của opensourceavatars.com' : 'UV/texture view styled after the opensourceavatars.com Textures tab'}
                </div>
              </div>
              <span style={{ padding: '5px 10px', borderRadius: 999, background: isDark ? 'rgba(0,229,255,0.12)' : 'rgba(0,184,204,0.12)', color: palette.accent, fontSize: 11, fontWeight: 900 }}>
                {embeddedTexturesStatus === 'loading'
                  ? (vi ? '⏳ Đang phân tích...' : '⏳ Extracting...')
                  : `${textureOptions.length} ${vi ? 'texture' : 'textures'}`}
              </span>
            </div>
            {selectedTexture ? (
              <div className="osa-texture-inspector" style={{ padding: 16 }}>
                <TexturePreviewCard texture={selectedTexture} meta={selectedTextureMeta} palette={palette} isDark={isDark} vi={vi} onLoad={handleTextureImageLoad} large />
                <div style={{ minHeight: 420, borderRadius: 18, overflow: 'hidden', border: `1px solid ${palette.border}`, background: isDark ? 'linear-gradient(180deg,#0b1220,#050816)' : 'linear-gradient(180deg,#f4f0e8,#e8e1d7)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: `1px solid ${palette.border}`, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13 }}>{selectedAvatar?.name || (vi ? 'Avatar đã chọn' : 'Selected avatar')}</strong>
                    <span style={{ color: palette.text3, fontSize: 11 }}>{activeFormat?.label || selectedAvatar?.format || 'VRM'} · {selectedTexture.type}</span>
                  </div>
                  <div style={{ height: 390 }}>
                    {activeModelUrl ? (
                      <AnimatedAvatarViewer
                        modelUrl={activeModelUrl}
                        modelKind={activeModelKind}
                        animationBlobUrl={animationBlobUrl}
                        animationLabel={selectedAnimation}
                        isDark={isDark}
                        autoRotate={autoRotate}
                        showGrid={showMeasureGrid}
                        showHeightRuler={showHeightRuler}
                        showBones={false}
                        showWireframe={false}
                        showTextures={showTextures}
                      />
                    ) : (
                      <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                        {selectedAvatar?.thumbnail_url ? <img src={selectedAvatar.thumbnail_url} alt={selectedAvatar.name} style={{ maxHeight: '72%', borderRadius: 16 }} /> : <span style={{ fontSize: 88 }}>🧑‍🚀</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="osa-card" style={{ padding: 14, background: palette.card }}>
                  <div className="osa-label" style={{ marginBottom: 10 }}>{vi ? 'Danh sách texture' : 'Texture list'}</div>
                  <div className="osa-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 390, overflowY: 'auto' }}>
                    {textureOptions.map((texture) => {
                      const activeTexture = selectedTexture?.url === texture.url
                      return (
                        <button key={`inspector-${texture.url}`} type="button" onClick={() => setSelectedTextureUrl(texture.url)} style={{ display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', border: `1px solid ${activeTexture ? palette.accent : palette.border}`, borderLeft: activeTexture ? `3px solid ${palette.accent}` : `3px solid transparent`, background: activeTexture ? 'rgba(0,184,204,0.12)' : palette.card2, color: palette.text, borderRadius: 10, padding: 8, cursor: 'pointer' }}>
                          <span style={{ width: 46, height: 46, borderRadius: 8, overflow: 'hidden', background: isDark ? '#111827' : '#f1f5f9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <img src={texture.url} alt="" loading="lazy" onLoad={(event) => handleTextureImageLoad(texture, event)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{texture.name}</span>
                            <span style={{ display: 'block', fontSize: 10, color: palette.text3, marginTop: 2 }}>{texture.type}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: 18, color: palette.text3, fontSize: 12 }}>{vi ? 'Chưa tìm thấy texture trong dữ liệu avatar này.' : 'No texture assets were found in this avatar record.'}</div>
            )}
          </div>

          {/* ============ Full-width 3D preview, below the whole grid ============ */}
          <div className="osa-card" style={{ marginTop: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${palette.border}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.01em', color: palette.text }}>
                    {vi ? 'Trình xem 3D & Animation' : '3D & Animation Viewer'}
                  </div>
                  <div style={{ fontSize: 12, color: palette.text3, marginTop: 2 }}>
                    opensourceavatars.com/finder
                  </div>
                </div>
                <a
                  href={selectedAvatarFinderUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: palette.accent, fontSize: 13, fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  {vi ? 'Mở 3D' : 'Open 3D'} <ExternalLink size={14} />
                </a>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                {selectedAvatar ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: palette.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedAvatar.name} · {activeFormat?.label || selectedAvatar.format} · {selectedAnimation}
                  </span>
                ) : <span />}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setShowMeasureGrid((v) => !v)} style={iconBtnStyle(showMeasureGrid)} title={vi ? 'Lưới đo' : 'Measurement grid'}><Ruler size={15} /></button>
                  <button type="button" onClick={() => setShowHeightRuler((v) => !v)} style={iconBtnStyle(showHeightRuler)} title={vi ? 'Thước đo chiều cao' : 'Height ruler'} aria-pressed={showHeightRuler}><MoveVertical size={15} /></button>
                  <button type="button" onClick={() => setShowBones((v) => !v)} style={iconBtnStyle(showBones)} title={vi ? 'Hiện xương' : 'Show Bones'} aria-pressed={showBones}>🦴</button>
                  <button type="button" onClick={() => setShowWireframe((v) => !v)} style={iconBtnStyle(showWireframe)} title="Wireframe" aria-pressed={showWireframe}><Box size={15} /></button>
                  <button type="button" onClick={() => setShowTextures((v) => !v)} style={iconBtnStyle(showTextures)} title="Textures" aria-pressed={showTextures}><ImageIcon size={15} /></button>
                  <button type="button" onClick={() => setAutoRotate((v) => !v)} style={iconBtnStyle(autoRotate)} title={vi ? 'Tự xoay' : 'Auto-rotate'}>{autoRotate ? <Pause size={15} /> : <Play size={15} />}</button>
                  <button type="button" onClick={handleShare} style={iconBtnStyle(false)} title={vi ? 'Copy link' : 'Share'}><Share2 size={15} /></button>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', height: 620, background: isDark ? 'radial-gradient(120% 90% at 50% 20%, #142032 0%, #050816 72%)' : 'linear-gradient(180deg,#f4f0e8,#e8e1d7)' }}>
              {activeModelUrl ? (
                <AnimatedAvatarViewer
                  modelUrl={activeModelUrl}
                  modelKind={activeModelKind}
                  animationBlobUrl={animationBlobUrl}
                  animationLabel={selectedAnimation}
                  isDark={isDark}
                  autoRotate={autoRotate}
                  showGrid={showMeasureGrid}
                  showHeightRuler={showHeightRuler}
                  showBones={showBones}
                  showWireframe={showWireframe}
                  showTextures={showTextures}
                  showDragHint
                  onStatusChange={(update) => {
                    if (update.error) {
                      setAnimationLoadStatus(vi ? `Lỗi: ${update.error}` : `Error: ${update.error}`)
                    } else if (update.stats) {
                      setModelStats(update.stats)
                    } else if (typeof update.realHeightMeters === 'number') {
                      setModelHeightMeters(update.realHeightMeters)
                    } else if (typeof update.trackCount === 'number') {
                      setAnimationLoadStatus(vi
                        ? `${selectedAnimation} đã tải xong · ${update.trackCount} tracks`
                        : `${selectedAnimation} loaded · ${update.trackCount} tracks`)
                    } else if (update.timedOut) {
                      setAnimationLoadStatus(vi ? 'Đã ép tắt loading (safety timeout)' : 'Loading indicator forced off (safety timeout)')
                    }
                  }}
                />
              ) : (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                  {selectedAvatar?.thumbnail_url
                    ? <img src={selectedAvatar.thumbnail_url} alt={selectedAvatar.name} style={{ maxHeight: '70%', borderRadius: 16 }} />
                    : <span style={{ fontSize: 96 }}>🧑‍🚀</span>}
                </div>
              )}
            </div>

            <div style={{ padding: '10px 16px', borderTop: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: palette.text3, fontSize: 11 }}>
                {vi
                  ? 'Render 3D nội bộ bằng THREE.js/WebGL (canvas thật, không dùng iframe) nên không dính lỗi CSP frame-ancestors của trang nguồn. Kéo để xoay.'
                  : 'Rendered internally with THREE.js/WebGL (a real canvas, no iframe), so it never hits the source site\'s CSP frame-ancestors restriction. Drag to rotate.'}
              </span>
              {showHeightRuler && modelHeightMeters && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#00b8cc', fontSize: 11, fontWeight: 900 }}>
                  <MoveVertical size={12} /> {modelHeightMeters.toFixed(2)} m {vi ? '(chiều cao thực tế)' : '(real height)'}
                </span>
              )}
              {modelStats && (
                <span style={{ color: palette.text3, fontSize: 11, fontWeight: 800 }}>
                  {modelStats.vertices ? `${modelStats.vertices.toLocaleString()} ${vi ? 'đỉnh' : 'verts'}` : ''}
                </span>
              )}
            </div>
          </div>

          {/* ============ "Khung render 3D" — three.js/VRM render, posed not T-Posed ============ */}
          {/* Shares the same AnimatedAvatarViewer used above, so this panel shows the
              avatar in its currently selected Mixamo pose (e.g. "Fight Idle") instead
              of the raw glTF bind pose — matching how opensourceavatars.com/finder
              presents avatars — and it inherits that viewer's real OrbitControls drag
              plus its built-in first-time finger drag hint. No iframe anywhere. */}
          <div className="osa-card" style={{ marginTop: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.01em', color: palette.text }}>
                  {vi ? 'Khung render 3D' : '3D Render Frame'}
                </div>
                <div style={{ fontSize: 12, color: palette.text3, marginTop: 2 }}>
                  opensourceavatars.com/finder
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setShowHeightRuler((v) => !v)} style={iconBtnStyle(showHeightRuler)} title={vi ? 'Thước đo chiều cao' : 'Height ruler'} aria-pressed={showHeightRuler}><MoveVertical size={15} /></button>
                <button type="button" onClick={() => setShowBones((v) => !v)} style={iconBtnStyle(showBones)} title={vi ? 'Hiện xương' : 'Show Bones'} aria-pressed={showBones}>🦴</button>
                <button type="button" onClick={() => setShowWireframe((v) => !v)} style={iconBtnStyle(showWireframe)} title="Wireframe" aria-pressed={showWireframe}><Box size={15} /></button>
                <button type="button" onClick={() => setShowTextures((v) => !v)} style={iconBtnStyle(showTextures)} title="Textures" aria-pressed={showTextures}><ImageIcon size={15} /></button>
              <a
                href={selectedAvatarFinderUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: palette.accent, fontSize: 13, fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                {vi ? 'Mở 3D' : 'Open 3D'} <ExternalLink size={14} />
              </a>
              </div>
            </div>

            <div style={{ position: 'relative', height: 560, overflow: 'hidden', background: isDark ? 'radial-gradient(circle at 50% 24%, rgba(0,229,255,0.16), transparent 42%), linear-gradient(180deg,#0b1220,#050816)' : 'radial-gradient(circle at 50% 24%, rgba(0,184,204,0.14), transparent 44%), linear-gradient(180deg,#f4f0e8,#e8e1d7)' }}>
              {/* Decorative ground ring + light beam, matching opensourceavatars.com's viewer chrome */}
              <div style={{ position: 'absolute', left: '50%', bottom: 46, width: '62%', maxWidth: 420, height: 92, transform: 'translateX(-50%) perspective(420px) rotateX(66deg)', borderRadius: '50%', border: `1px solid ${isDark ? 'rgba(148,163,184,0.28)' : 'rgba(71,85,105,0.22)'}`, background: isDark ? 'repeating-radial-gradient(circle, rgba(148,163,184,0.22) 0 1px, transparent 1px 26px)' : 'repeating-radial-gradient(circle, rgba(71,85,105,0.2) 0 1px, transparent 1px 26px)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: '50%', bottom: 70, width: 2, height: 320, transform: 'translateX(-50%)', background: isDark ? 'linear-gradient(transparent,rgba(0,229,255,0.32),transparent)' : 'linear-gradient(transparent,rgba(0,184,204,0.28),transparent)', pointerEvents: 'none' }} />

              {activeModelUrl ? (
                <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
                  <AnimatedAvatarViewer
                    modelUrl={activeModelUrl}
                    modelKind={activeModelKind}
                    animationBlobUrl={animationBlobUrl}
                    animationLabel={selectedAnimation}
                    isDark={isDark}
                    autoRotate={autoRotate}
                    showGrid={false}
                    showHeightRuler={showHeightRuler}
                    showAxisGizmo
                    showBones={showBones}
                    showWireframe={showWireframe}
                    showTextures={showTextures}
                    showDragHint
                  />
                </div>
              ) : (
                <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'grid', placeItems: 'center' }}>
                  {selectedAvatar?.thumbnail_url
                    ? <img src={selectedAvatar.thumbnail_url} alt={selectedAvatar.name} style={{ maxHeight: '60%', borderRadius: 16 }} />
                    : <span style={{ fontSize: 88 }}>🧑‍🚀</span>}
                </div>
              )}
            </div>

            <div style={{ padding: '10px 16px', borderTop: `1px solid ${palette.border}` }}>
              <span style={{ color: palette.text3, fontSize: 11, lineHeight: 1.5 }}>
                {activeModelUrl
                  ? (vi
                    ? `Render 3D nội bộ bằng three.js/VRM, không dùng iframe nên tránh lỗi CSP frame-ancestors. Đang hiển thị tư thế "${selectedAnimation}" thay vì T-Pose mặc định, giống cách opensourceavatars.com/finder trình bày avatar.`
                    : `Rendered locally with three.js/VRM — no iframe, so it avoids the source site's CSP frame-ancestors errors. Showing the "${selectedAnimation}" pose instead of the default T-Pose, matching how opensourceavatars.com/finder presents avatars.`)
                  : (vi ? 'Avatar này chưa có model URL, đang hiển thị ảnh preview.' : 'This avatar has no model URL yet, so a static preview image is shown.')}
                {' '}
                {vi
                  ? 'Đổi animation ở khung "Trình xem 3D & Animation" phía trên để cập nhật tư thế ở đây.'
                  : 'Change the animation in the "3D & Animation Viewer" panel above to update the pose shown here.'}
                {' '}
                {vi
                  ? 'Bấm vào trục X/Y/Z ở góc dưới trái để xoay nhanh camera về đúng hướng đó.'
                  : 'Click the X/Y/Z axis widget in the bottom-left corner to snap the camera to that view instantly.'}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
