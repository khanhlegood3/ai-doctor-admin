import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { useApp } from './context/AppContext'
import Topbar from './components/Topbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import GlobalAIChatbot from './components/GlobalAIChatbot.jsx'
import ImagingPanel from './components/ImagingPanel.jsx'
import CheckinPanel from './components/CheckinPanel.jsx'
import TwinPanel from './components/TwinPanel.jsx'
import Matrix3DBodyPanel from './components/Matrix3DBodyPanel.jsx'
import Omnidirectional3DBodyPanel from './components/Omnidirectional3DBodyPanel.jsx'
import TelemedicinePanel from './components/TelemedicinePanel.jsx'
import StatisticalAnalysisPanel from './components/StatisticalAnalysisPanel.jsx'
import SimulationPanel from './components/SimulationPanel.jsx'
import ConsensusPanel from './components/ConsensusPanel.jsx'
import VarCheckPanel from './components/VarCheckPanel.jsx'
import SwarmConsensusPanel from './components/SwarmConsensusPanel.jsx'
import UploadPanel from './components/upload/UploadPanel.jsx'
import HealthJourneyPanel from './components/HealthJourneyPanel.jsx'
import HealthJourneyGamePanel from './components/HealthJourneyGamePanel.jsx'
import MyRewardHealthPanel from './components/MyRewardHealthPanel.jsx'
import MedicalAssetStorePanel from './components/MedicalAssetStorePanel.jsx' // <--- IMPORT PANEL MỚI Ở ĐÂY
import MedicalVisualPlayground from './components/MedicalVisualPlayground.jsx'
import MedicalVisualCameraAngle3D from './components/MedicalVisualCameraAngle3D.jsx'
import LunchJourneyPanel from './components/LunchJourneyPanel.jsx'
import DinnerJourneyPanel from './components/DinnerJourneyPanel.jsx'
import FamilyTreePanel from './components/family/FamilyTreePanel.jsx'
import FamilyMedicalRelationshipPanel from './components/family/FamilyMedicalRelationshipPanel.jsx'
import AdminPanel from './components/admin/AdminPanel.jsx'
import AdminConceptPanel from './components/AdminConceptPanel.jsx'
import PatientRecordPanel from './components/PatientRecordPanel.jsx'
import Protein3DPanel from './components/Protein3DPanel.jsx'
import AIHealthcareVisionPanel from './components/AIHealthcareVisionPanel.jsx'
import AIHealthcareVisionControlPanel from './components/AIHealthcareVisionControlPanel.jsx'
import AIInbodyPortalPanel from './components/AIInbodyPortalPanel.jsx'
import WaterDrinkChatBotPanel from './components/WaterDrinkChatBotPanel.jsx'
import RSSPortalPanel from './components/RSSPortalPanel.jsx'
import WikiMedVisionPanel from './components/WikiMedVisionPanel.jsx'
import FullDocumentSummarizationPanel from './components/FullDocumentSummarizationPanel.jsx'
import DocumentOCRPanel from './components/DocumentOCRPanel.jsx'
import StressReliefPanel from './components/StressReliefPanel.jsx'
import PrintCenter from './print/PrintCenter.jsx'
import UserProfilePanel from './components/UserProfilePanel.jsx'
import DonationHeroPanel from './components/DonationHeroPanel.jsx'
import AffiliateUUIDReferralPanel from './components/AffiliateUUIDReferralPanel.jsx'
import BodyProtectionJourneyPanel from './components/BodyProtectionJourneyPanel.jsx'
import Hero3DMapPanel from './components/Hero3DMapPanel.jsx'
import MyPainPathBodyPanel from './components/MyPainPathBodyPanel.jsx'
import MyPainPathBodyPixelPanel from './components/MyPainPathBodyPixelPanel.jsx'
import MyPainPathNoiTangPanel from './components/MyPainPathNoiTangPanel.jsx'
import MyPainPathNoiTangPixelPanel from './components/MyPainPathNoiTangPixelPanel.jsx'
import ChooseUserRolePanel from './components/ChooseUserRolePanel.jsx'
import AvatarCreatorPanel from './components/AvatarCreatorPanel.jsx'
import Make3DModelPanel from './components/Make3DModelPanel.jsx'
import My3DAssetPanel from './components/My3DAssetPanel.jsx'
import TwoDTo3DAssetPanel from './components/TwoDTo3DAssetPanel.jsx'
import XyzCameraAnglePanel from './components/XyzCameraAnglePanel.jsx'
import CameraAngle3DStudioPanel from './components/CameraAngle3DStudioPanel.jsx'
import Create3DVideoFrom2DPanel from './components/Create3DVideoFrom2DPanel.jsx'
import OrganConnectionPanel from './components/OrganConnectionPanel.jsx'
import ChatHistoryPanel from './components/ChatHistoryPanel.jsx'
import PatientReflectPanel from './components/PatientReflectPanel.jsx'
import MyImageToVideoPanel from './components/MyImageToVideoPanel.jsx'
import AffiliateSystemControlPanel from './components/AffiliateSystemControlPanel.jsx'
import AffiliateSystemPanel from './components/AffiliateSystemPanel.jsx'
import AffiliateWebhookAdmin from './components/admin/AffiliateWebhookAdmin.jsx'
import MoralisPlaygroundAdmin from './components/admin/MoralisPlaygroundAdmin.jsx'
import AffiliateSystemAdminPanel from './components/admin/AffiliateSystemAdminPanel.jsx'
import RoleMembershipAdminPanel from './components/admin/RoleMembershipAdminPanel.jsx'
import LoginPage from './pages/LoginPage.jsx'
import LandingPageZeroToForever from './pages/landingPageZeroToForever.jsx'
import { addNotification } from './lib/notifications.js'
import { useTTS } from './lib/groqAiClient.js'

// Thứ tự này đồng bộ menu chính và nút điều hướng qua/lại giữa các màn hình.
const PANELS = ['bodyProtectionJourney', 'hero3DMap', 'myPainPathBody', 'myPainPathBodyPixel', 'myPainPathNoiTang', 'myPainPathNoiTangPixel', 'healthJourneyGame', 'medicalAssetStore', 'medicalVisualPlayground', 'medicalVisualCameraAngle3D', 'myRewardHealth', 'affiliateControl', 'affiliate', 'rssPortal', 'waterDrinkChatBot', 'wikiMedVision', 'fullDocSummarization', 'documentOCR', 'cameraAngle3DStudio', 'organConnection', 'healthJourney', 'lunchJourney', 'dinnerJourney', 'upload', 'imaging', 'checkin', 'family', 'record', 'familyRelationship', 'matrix3dBody', 'omnidirectional3dBody', 'twin', 'telemedicine', 'statAnalysis', 'swarm', 'consensus', 'varCheck', 'protein3d', 'aiHealthcareVision', 'aiHealthcareVisionControl', 'stressRelief', 'aiInbodyPortal', 'printPortal', 'patientReflect', 'chatHistory', 'affiliateAdmin', 'roleMembershipAdmin', 'myImageToVideo', 'make3DModel', 'my3dAsset', 'twoDTo3DAsset', 'xyzCameraAngle']

const VIP_PRO_PANEL_IDS = new Set([
  'myPainPathBody',
  'myPainPathBodyPixel',
  'myPainPathNoiTang',
  'myPainPathNoiTangPixel',
  'medicalVisualPlayground',
  'myRewardHealth',
  'affiliate',
  'rssPortal',
  'checkin',
  'matrix3dBody',
  'twin',
  'telemedicine',
  'statAnalysis',
  'swarm',
  'consensus',
  'varCheck',
  'protein3d',
  'aiInbodyPortal',
  'printPortal',
])

const VIP_PRO_LOCK_MESSAGE = 'Bạn phải hoạt động mạnh mẽ và hữu ích thì VIP PRO Account sẽ là của bạn toàn quyền'


export default function App() {
  const { user, loading } = useAuth()
  const { theme, t } = useApp()
  const [active, setActive]               = useState('bodyProtectionJourney')
  const [selectedMember, setSelectedMember] = useState(null)
  const [compareImage, setCompareImage] = useState(null)
  const [uploadedImages, setUploadedImages] = useState([])
  const [imagingScrollTarget, setImagingScrollTarget] = useState(null)
  const mainRef = useRef(null)
  const [scrollState, setScrollState] = useState({
    canScroll: false,
    showTop: false,
    showEnd: false,
  })
  const [sidebarOpenSignal, setSidebarOpenSignal] = useState(0)
  // Bấm "Toàn màn hình" trong BodyProtectionJourneyPanel (trang "Hành Trình
  // Bảo Vệ Cơ Thể") -> ẩn hẳn Sidebar bên trái để nhường chỗ cho khung game.
  // Luôn trả lại true (hiện Sidebar) mỗi khi rời khỏi panel đó, tránh việc
  // menu bị ẩn vĩnh viễn nếu người dùng điều hướng đi nơi khác lúc đang
  // toàn màn hình.
  const [hideSidebarForFocus, setHideSidebarForFocus] = useState(false)

  // Thứ tự màn hình cho KHÁCH (guest, chưa đăng nhập) khi vào web:
  // 1) 'chooseRole'  -> ChooseUserRolePanel ("Chọn Vai Trò Anh Hùng") — CHẠY
  //    ĐẦU TIÊN, trước cả "Anh Hùng Hiến Tặng".
  // 2) 'hero'        -> DonationHeroPanel ("Anh Hùng Hiến Tặng") — vào sau
  //    khi bấm chọn 1 vai trò hoặc "Tiếp tục tìm hiểu" ở bước 1.
  // 3) 'login'        -> LoginPage thật — vào khi bấm "Tạo tài khoản" ở bước
  //    1 hoặc 2, hoặc bấm nút hành động ở bước 2.
  //
  // NGOẠI LỆ: nếu URL có sẵn ?ref=... (User 2 mở link Affiliate do User 1
  // chia sẻ), bỏ qua thẳng 2 màn 'chooseRole'/'hero' và vào LoginPage NGAY
  // (ở tab Đăng ký — xem loginInitialMode bên dưới), để User 2 đăng ký nhanh
  // thay vì phải lướt qua các màn giới thiệu trước. Đọc trực tiếp từ URL
  // ngay lúc khởi tạo state (không phải trong useEffect) để tránh nháy màn
  // 'chooseRole' rồi mới nhảy sang 'login'.
  const [preLoginView, setPreLoginView] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('ref') ? 'login' : 'landing'
    } catch { return 'landing' }
  })
  // Tab mặc định khi vào LoginPage: 'register' nếu đến từ link Affiliate
  // (?ref=...) hoặc bấm nút "Tạo tài khoản"/"Đăng ký tạo Tài Khoản"; 'login'
  // nếu bấm nút "Đăng nhập" thông thường.
  const [loginInitialMode, setLoginInitialMode] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('ref') ? 'register' : 'login'
    } catch { return 'login' }
  })
  // Cờ riêng: chỉ true khi user THỰC SỰ hoàn tất 1 hành động ngay TRÊN trang
  // Login (Google/Apple/Email hoặc "Bắt đầu ẩn danh"). Trước đây app dùng
  // `preLoginView !== 'login'` để suy luận điều này, nhưng nếu người dùng đã
  // có phiên anonymous từ trước (do bấm mic ở ChooseUserRolePanel /
  // DonationHeroPanel) rồi mới bấm 1 nút hành động khác (không phải nút trên
  // trang Login) để set preLoginView='login', suy luận đó sai — vì user đã
  // tồn tại (anonymous) NÊN điều kiện showGuestPreLoginScreens bị tính là
  // false ngay lập tức, khiến app bỏ qua hẳn trang Login và nhảy thẳng vào
  // layout đầy đủ (bug: "vào thẳng trang Game"). Cờ hasCompletedLogin tách
  // riêng 2 việc này: preLoginView chỉ quyết định ĐANG XEM màn nào trong 3
  // màn guest, còn hasCompletedLogin mới quyết định đã THỰC SỰ đăng nhập
  // xong (từ chính trang Login) hay chưa.
  const [hasCompletedLogin, setHasCompletedLogin] = useState(false)
  const prevUserRef = useRef(null)

  useEffect(() => {
    // Vừa logout (trước đó có user, giờ không còn) -> lần vào tiếp theo lại
    // bắt đầu từ màn hình "Chọn Vai Trò Anh Hùng" thay vì thẳng vào Login.
    if (prevUserRef.current && !user) {
      setPreLoginView('chooseRole')
      setLoginInitialMode('login')
      setHasCompletedLogin(false)
    }
    prevUserRef.current = user
  }, [user])

  // Ghi chú: nút mic trên ChooseUserRolePanel / DonationHeroPanel giờ tự xử
  // lý hoàn toàn cục bộ (xem src/components/heroPanels/HeroMicVoiceButton.jsx)
  // — bấm mic sẽ tự tạo phiên "anonymous" (nếu đang là khách) rồi ghi âm +
  // trao đổi thoại trực tiếp NGAY TẠI TRANG đó (không mở popup chat, không
  // điều hướng đi đâu). App.jsx không cần biết/điều phối việc này nữa; chỉ
  // cần đảm bảo (xem showGuestPreLoginScreens bên dưới) rằng việc tạo phiên
  // anonymous đó không vô tình làm app nhảy sang layout đầy đủ.

  useEffect(() => {
    setCompareImage(null)
    setUploadedImages([])
    setImagingScrollTarget(null)
  }, [user?.uuid])

  // Lưới an toàn: rời khỏi các panel có chế độ toàn màn hình (điều hướng sang
  // trang khác) trong lúc đang toàn màn hình -> luôn hiện lại Sidebar.
  useEffect(() => {
    if (!['bodyProtectionJourney', 'medicalVisualPlayground'].includes(active) && hideSidebarForFocus) {
      setHideSidebarForFocus(false)
    }
  }, [active, hideSidebarForFocus])

  const panelLabels = {
    adminConcept: 'AI Doctor Admin Panel',
    landingZeroToForever: 'Zero to Forever - Trang chủ',
    chooseUserRole: 'Chọn Vai Trò Anh Hùng',
    donationHero: 'Anh Hùng Hiến Tặng',
    affiliateUuidReferral: 'Đăng Ký Affiliate Marketing',
    bodyProtectionJourney: 'Hành Trình Bảo Vệ Cơ Thể',
    hero3DMap: '3D Map for Hero',
    myPainPathBody: 'My Pain Path Body',
    myPainPathBodyPixel: 'My Pain Path Body Pixel',
    myPainPathNoiTang: 'My Pain Path Nội Tạng',
    myPainPathNoiTangPixel: 'My Pain Path Nội Tạng Pixel',
    healthJourneyGame: 'Health Journey Game',
    medicalAssetStore: 'Chợ Tài nguyên 3D', // <--- THÊM NHÃN TẠI ĐÂY
    medicalVisualPlayground: 'Medical 3D Lab (Touchless)',
    medicalVisualCameraAngle3D: 'Medical Camera Angle 3D',
    myRewardHealth: 'My Reward Health',
    affiliateControl: 'Affiliate Control Panel',
    affiliate: 'Affiliate & Earn Đa Tầng',
    affiliateAdmin: 'Quản Trị Affiliate',
    roleMembershipAdmin: 'Quản Trị Vai Trò & Nâng Cấp Thành Viên',
    moralisPlaygroundAdmin: 'Moralis Playground Admin',
    affiliateWebhookAdmin: 'Affiliate Webhook Admin',
    healthJourney: t('healthJourney'),
    lunchJourney: t('lunchJourney'),
    dinnerJourney: t('dinnerJourney'),
    upload: t('uploadRecords'),
    imaging: t('imaging'),
    checkin: t('checkin'),
    family: t('familyTree'),
    familyRelationship: t('familyRelationship'),
    record: t('patientRecord'),
    matrix3dBody: t('matrix3dBody'),
    omnidirectional3dBody: t('omnidirectional3dBody'),
    twin: t('twin'),
    telemedicine: t('telemedicine'),
    statAnalysis: t('statAnalysis'),
    swarm: t('swarmCouncil'),
    consensus: `${t('consensus')} (Classic)`,
    varCheck: 'VAR Y TẾ',
    protein3d: t('protein3d'),
    aiHealthcareVision: t('aiHealthcareVision'),
    aiHealthcareVisionControl: t('aiHealthcareVisionControl'),
    stressRelief: t('stressRelief'),
    aiInbodyPortal: t('aiInbodyPortal'),
    waterDrinkChatBot: t('waterDrinkChatBot'),
    rssPortal: 'Healthy RSS Portal',
    wikiMedVision: t('wikiMedVision'),
    fullDocSummarization: 'Full-Document Summarization',
    documentOCR: 'Document OCR',
    twoDTo3DAsset: '2D to 3D Asset',
    xyzCameraAngle: 'Góc chụp toạ độ XYZ',
    cameraAngle3DStudio: '3D Camera Angle',
    organConnection: 'Ăn gì tốt hôm nay',
    printPortal: 'Print Portal',
    patientReflect: 'Hero Reflection / Phản chiếu Siêu Anh Hùng',
    chatHistory: 'Lịch sử Chat với AI',
    myImageToVideo: 'My Image to Video',
    profile: t('profile'),
    avatarCreator: 'Tạo Avatar',
    make3DModel: 'Make 3D Model',
    my3dAsset: 'My 3D Asset',
    create3DVideoFrom2D: 'Create 3D Video From 2D',
  }

  const navigateToRecord = (member) => { setSelectedMember(member); setActive('record') }
  const navigateToUpload = useCallback(() => setActive('upload'), [])
  const navigateToChatHistory = useCallback(() => {
    setActive('chatHistory')
    setPreLoginView('login')
  }, [])

  useEffect(() => {
    window.addEventListener('navigate-to-upload', navigateToUpload)
    return () => window.removeEventListener('navigate-to-upload', navigateToUpload)
  }, [navigateToUpload])

  useEffect(() => {
    window.addEventListener('navigate-to-chat-history', navigateToChatHistory)
    return () => window.removeEventListener('navigate-to-chat-history', navigateToChatHistory)
  }, [navigateToChatHistory])

  // ─── Link giới thiệu Affiliate (?ref=<userId hoặc uuid>&refName=<tên>&refId=<userId>) ──
  // User 1 chia sẻ link kèm User ID của họ (an toàn hơn UUID thô để chia sẻ:
  // không dấu, không khoảng trắng, không cần encode — xem
  // AffiliateUUIDReferralPanel.jsx). Link CŨ đã chia sẻ trước khi có thay đổi
  // này vẫn dùng UUID thô làm ?ref= — 2 dạng phân biệt được vì UUID (định
  // dạng HEALTH-...) LUÔN chứa dấu "-", còn User ID (USER_ID_REGEX) không bao
  // giờ có "-", nên link cũ vẫn hoạt động bình thường, không bị phá.
  // refName/refId ở đây CHỈ là gợi ý hiển thị tạm (optimistic) do chính
  // người tạo link tự khai — KHÔNG được dùng làm căn cứ xác nhận cuối cùng,
  // vì ai cũng có thể sửa tay trên URL. LoginPage.jsx và
  // AffiliateUUIDReferralPanel.jsx luôn tra lại từ server theo đúng UUID
  // (nguồn sự thật duy nhất) trước khi cho đăng ký — xem "Mức 3/4 chống giả
  // mạo" trong 2 file đó.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const ref = params.get('ref')
      if (!ref) return
      const refName = params.get('refName') || ''
      const refId = params.get('refId') || ''
      window.history.replaceState({}, '', window.location.pathname)

      // Ghi + bắn kèm 1 sự kiện 'cdoc-pending-referral-updated': LoginPage.jsx
      // chỉ đọc sessionStorage 1 LẦN lúc mount, nhưng LoginPage lại có thể đã
      // mount TRƯỚC KHI effect này ghi xong (đặc biệt ở nhánh User ID bên
      // dưới, phải chờ 1 lượt fetch bất đồng bộ) — do React luôn chạy effect
      // của component CON trước component CHA trong cùng 1 lượt render. Nếu
      // không bắn sự kiện, LoginPage sẽ đọc phải sessionStorage rỗng và ô
      // "UUID người giới thiệu" mãi mãi không được điền sẵn (bug: link giới
      // thiệu dạng ?ref=<User ID> không tự điền UUID).
      const setPendingReferral = (payload) => {
        sessionStorage.setItem('cdoc_pending_referral', JSON.stringify(payload))
        window.dispatchEvent(new CustomEvent('cdoc-pending-referral-updated', { detail: payload }))
      }

      if (ref.includes('-')) {
        // Dạng UUID thô (link cũ, hoặc chưa đặt User ID lúc tạo link).
        setPendingReferral({ uuid: ref, name: refName, userId: refId })
        return
      }

      // Dạng User ID — phân giải ngược ra UUID thật từ server trước khi lưu,
      // vì toàn bộ luồng nội bộ (referral, on-chain, cây F1/F2/F3) vẫn vận
      // hành theo UUID. Nếu User ID này không tồn tại (vd gõ sai/đã đổi), KHÔNG
      // lưu pending referral rác — người dùng vẫn có thể tự dán tay UUID/User
      // ID đúng sau đó.
      ;(async () => {
        try {
          const res = await fetch(`/api/user-profile?userId=${encodeURIComponent(ref)}`)
          const data = await res.json().catch(() => ({}))
          if (data?.uuid) {
            setPendingReferral({ uuid: data.uuid, name: refName, userId: ref })
          }
        } catch { /* ignore lỗi mạng — người dùng vẫn tự dán tay được */ }
      })()
    } catch { /* ignore (URL không hợp lệ) */ }
  }, [])


  // Ngay khi User 2 CÓ uuid (kể cả ẩn danh) và đang có 1 link giới thiệu chờ
  // xử lý (khác chính uuid của họ) -> tự điều hướng thẳng tới panel Affiliate
  // để họ thấy UUID người giới thiệu đã điền sẵn, không phải tự tìm menu.
  // Chỉ tự điều hướng đúng 1 lần/phiên để không kéo người dùng quay lại nếu
  // họ đã rời trang đó để làm việc khác.
  const autoNavigatedForReferralRef = useRef(false)
  useEffect(() => {
    if (autoNavigatedForReferralRef.current || !user?.uuid) return
    try {
      const pending = JSON.parse(sessionStorage.getItem('cdoc_pending_referral') || 'null')
      if (pending?.uuid && pending.uuid !== user.uuid) {
        autoNavigatedForReferralRef.current = true
        setActive('affiliateUuidReferral')
      }
    } catch { /* ignore */ }
  }, [user?.uuid])

  const openMainMenu = useCallback(() => {
    setActive('bodyProtectionJourney')
    window.setTimeout(() => setSidebarOpenSignal(signal => signal + 1), 0)
  }, [])

  // affiliateControl = "Affiliate Control Panel" chỉ là màn MÔ PHỎNG/DEMO nội
  // bộ (6 user giả u1-u6, dropdown "Đóng vai đại lý", state cục bộ không liên
  // kết gì với UUID/user_profiles thật) — KHÔNG phải dữ liệu affiliate thật
  // của người dùng. Đưa vào ADMIN_ONLY_PANELS để tránh user thật nhầm lẫn đây
  // là hoa hồng/tuyến dưới thật của họ (xem thêm Sidebar.jsx — đã tách sang
  // nhóm menu riêng "Mô Phỏng (Nội Bộ)" ngay sau nhóm Admin).
  const ADMIN_ONLY_PANELS = ['adminConcept', 'affiliateAdmin', 'roleMembershipAdmin', 'affiliateControl', 'moralisPlaygroundAdmin', 'affiliateWebhookAdmin', 'myImageToVideo', 'make3DModel', 'my3dAsset', 'twoDTo3DAsset', 'xyzCameraAngle']
  const visiblePanels = user?.isAdmin ? PANELS : PANELS.filter(id => !ADMIN_ONLY_PANELS.includes(id))

  useEffect(() => {
    if (ADMIN_ONLY_PANELS.includes(active) && !user?.isAdmin) {
      setActive('bodyProtectionJourney')
    }
  }, [active, user?.isAdmin])

  const goNext = () => {
    const idx = visiblePanels.indexOf(active)
    if (idx >= 0 && idx < visiblePanels.length - 1) setActive(visiblePanels[idx + 1])
  }
  const goPrev = () => {
    const idx = visiblePanels.indexOf(active)
    if (idx > 0) setActive(visiblePanels[idx - 1])
  }

  const handleSelectCompareFile = (dataUrl, records = [], options = {}) => {
    const selectedFile = options.selectedRecord
    const isPdf =
      selectedFile?.mimeType?.includes('pdf') ||
      selectedFile?.fileType === 'pdf' ||
      selectedFile?.type === 'pdf' ||
      selectedFile?.filename?.toLowerCase()?.endsWith('.pdf')

    setCompareImage(isPdf ? null : dataUrl)
    setUploadedImages(records)
    setImagingScrollTarget({
      target: isPdf ? 'end' : 'top',
      requestedAt: Date.now(),
    })
    setActive('imaging')
  }

  const updateScrollControls = useCallback(() => {
    const el = mainRef.current
    if (!el) return

    const maxScroll = el.scrollHeight - el.clientHeight
    const canScroll = maxScroll > 12
    const showTop = canScroll && el.scrollTop > 120
    const showEnd = canScroll && maxScroll - el.scrollTop > 120

    setScrollState(prev => (
      prev.canScroll === canScroll &&
      prev.showTop === showTop &&
      prev.showEnd === showEnd
        ? prev
        : { canScroll, showTop, showEnd }
    ))
  }, [])

  const scrollMainTo = useCallback((target) => {
    const el = mainRef.current
    if (!el) return

    el.scrollTo({
      top: target === 'end' ? el.scrollHeight : 0,
      behavior: 'smooth',
    })
  }, [])

  useEffect(() => {
    const el = mainRef.current
    if (!el) return undefined

    updateScrollControls()
    const timer = window.setTimeout(updateScrollControls, 250)

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateScrollControls)
      : null

    if (resizeObserver) {
      resizeObserver.observe(el)
      if (el.firstElementChild) resizeObserver.observe(el.firstElementChild)
    }
    el.addEventListener('scroll', updateScrollControls, { passive: true })
    window.addEventListener('resize', updateScrollControls)

    return () => {
      window.clearTimeout(timer)
      resizeObserver?.disconnect()
      el.removeEventListener('scroll', updateScrollControls)
      window.removeEventListener('resize', updateScrollControls)
    }
  }, [active, updateScrollControls])

  const activePanelIndex = visiblePanels.indexOf(active)
  const prevPanel = visiblePanels[activePanelIndex - 1]
  const nextPanel = visiblePanels[activePanelIndex + 1]
  const prevLabel = prevPanel ? panelLabels[prevPanel] : null
  const nextLabel = nextPanel ? panelLabels[nextPanel] : null

  // Link Affiliate dạng cũ /r/<code> KHÔNG còn có trang render riêng
  // (AffiliateReferralLandingPage đã bị gỡ bỏ — trùng lặp/không đồng bộ với
  // luồng LoginPage tab "Đăng ký" chuẩn). Nếu ai đó vẫn còn giữ link cũ dạng
  // này, chuyển hướng ngay sang trang chủ kèm ?ref=<code> để đi đúng luồng
  // chuẩn (LoginPage, tab Đăng ký) thay vì vào thẳng trang Đăng ký F1 cũ.
  const referralRouteMatch = typeof window !== 'undefined' ? window.location.pathname.match(/^\/r\/([^/?#]+)/i) : null

  if (referralRouteMatch) {
    if (typeof window !== 'undefined') {
      window.location.replace(`${window.location.origin}/?ref=${encodeURIComponent(referralRouteMatch[1])}`)
    }
    return null
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: theme === 'dark' ? '#04060f' : '#f0f4f8',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚕️</div>
          <div style={{ color: '#00b8cc', fontFamily: 'monospace', fontSize: 14, letterSpacing: '0.1em' }}>LOADING...</div>
        </div>
      </div>
    )
  }

  // Vẫn hiển thị 2 màn hình "guest" (chooseRole / hero) kể cả khi đã có
  // user — MIỄN LÀ đó là phiên "anonymous" tạo ra bởi bấm mic (xem
  // heroPanels/HeroMicVoiceButton.jsx) và người dùng CHƯA thực sự hoàn tất
  // đăng nhập trên trang Login (hasCompletedLogin). Nếu không, loginAnonymous()
  // gọi từ bên trong nút mic sẽ khiến `user` có giá trị ngay lập tức và làm
  // app nhảy thẳng sang layout đầy đủ (Sidebar/Topbar) — đúng thứ người dùng
  // KHÔNG muốn khi chỉ mới bấm mic để hỏi AI ngay tại trang này, HOẶC khi mới
  // bấm 1 nút hành động khác (Khám phá / Hiến tặng ngay / Tạo tài khoản /
  // Đăng nhập) để CHUYỂN SANG trang Login chứ chưa hề bấm nút nào trên chính
  // trang đó. Khi người dùng chủ động bấm 1 trong các nút TRÊN trang Login
  // (Google/Apple/Email hoặc "Bắt đầu ẩn danh"), hasCompletedLogin chuyển
  // sang true, điều kiện dưới đây sẽ false và app chuyển sang layout đầy đủ
  // như bình thường.
  const showGuestPreLoginScreens = !user || (user.isAnonymous && !hasCompletedLogin)

  if (showGuestPreLoginScreens) {
    if (preLoginView === 'landing') {
      return (
        <LandingPageZeroToForever
          onGetStarted={() => setPreLoginView('chooseRole')}
          onLogin={() => { setLoginInitialMode('login'); setPreLoginView('login') }}
          onWatchVideo={() => setPreLoginView('chooseRole')}
          onDownloadApp={() => setPreLoginView('chooseRole')}
        />
      )
    }
    if (preLoginView === 'chooseRole') {
      return (
        <div style={{ minHeight: '100vh', background: '#eef7f1' }}>
          <ChooseUserRolePanel
            mode="guest"
            onSelectRole={() => setPreLoginView('hero')}
            onEnterAction={() => setPreLoginView('hero')}
            onCreateAccount={() => setPreLoginView('login')}
            onBackToLanding={() => setPreLoginView('landing')}
          />
          <GlobalPageReader readRootRef={mainRef} activeKey={preLoginView} />
          {/* Mount GlobalAIChatbot NGAY TẠI ĐÂY để popup chat vẫn truy cập
          được từ trang guest này (nút 🤗 góc màn hình) — nhưng KHÔNG có
          tín hiệu ngoài nào điều khiển nó nữa: nút mic của ChooseUserRolePanel
          giờ tự trao đổi thoại trực tiếp (xem HeroMicVoiceButton.jsx), popup
          này chỉ mở/đóng khi người dùng tự bấm vào nó. Nội dung 2 bên vẫn
          đồng bộ vì dùng chung 1 kho lưu trữ. */}
          <GlobalAIChatbot activePanelLabel={panelLabels.chooseUserRole} />
        </div>
      )
    }
    if (preLoginView === 'hero') {
      return (
        <div style={{ minHeight: '100vh', background: '#eef7f1' }}>
          <DonationHeroPanel
            mode="guest"
            onEnterAction={() => { setLoginInitialMode('register'); setPreLoginView('login') }}
            onBack={() => setPreLoginView('chooseRole')}
            onLogin={() => { setLoginInitialMode('login'); setPreLoginView('login') }}
          />
          <GlobalPageReader readRootRef={mainRef} activeKey={preLoginView} />
          {/* Mount GlobalAIChatbot NGAY TẠI ĐÂY — lý do xem chú thích tương
          tự ở nhánh 'chooseRole' phía trên. */}
          <GlobalAIChatbot activePanelLabel={panelLabels.donationHero} />
        </div>
      )
    }
    return (
      <LoginPage
        initialMode={loginInitialMode}
        onSuccess={() => setHasCompletedLogin(true)}
        onBack={() => setPreLoginView('hero')}
        onShowProjectInfo={() => setPreLoginView('landing')}
      />
    )
  }

  const isDark = theme === 'dark'
  const mainBg = isDark ? 'var(--bg2)' : '#f4f7fb'
  const familyStorageOwnerId = user?.uuid || 'guest'
  const isVipProAccount = Boolean(
    user?.isAdmin ||
    user?.isVipPro ||
    user?.vipPro ||
    user?.accountType === 'vip_pro' ||
    user?.accountType === 'VIP_PRO' ||
    user?.plan === 'vip_pro' ||
    user?.plan === 'VIP_PRO' ||
    user?.tier === 'vip_pro' ||
    user?.tier === 'VIP_PRO'
  )
  const shouldLockVipProPanel = VIP_PRO_PANEL_IDS.has(active) && !isVipProAccount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Topbar activePanel={active} onNavigateProfile={() => setActive('profile')} onNavigateAdmin={() => setActive('admin')} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {!hideSidebarForFocus && (
          <Sidebar active={active} onNavigate={(id) => setActive(id)} openSignal={sidebarOpenSignal} />
        )}
        <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', background: mainBg, paddingBottom: hideSidebarForFocus ? 0 : 104 }}>
          <PanelErrorBoundary
            resetKey={active}
            isDark={isDark}
            panelLabel={panelLabels[active] || active}
            onReset={() => setActive('upload')}
            familyStorageOwnerId={familyStorageOwnerId}
            user={user}
          >
            <VipProGate locked={shouldLockVipProPanel} isDark={isDark}>
            {active === 'adminConcept' && user?.isAdmin && <AdminConceptPanel />}
            {active === 'adminConcept' && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            {active === 'hero3DMap' && <Hero3DMapPanel onNext={goNext} nextLabel={nextLabel} onOpenBodyProtectionJourney={() => setActive('bodyProtectionJourney')} />}
            {active === 'myPainPathBody' && <MyPainPathBodyPanel />}
            {active === 'myPainPathBodyPixel' && <MyPainPathBodyPixelPanel />}
            {active === 'myPainPathNoiTang' && <MyPainPathNoiTangPanel />}
            {active === 'myPainPathNoiTangPixel' && <MyPainPathNoiTangPixelPanel />}
            {active === 'healthJourneyGame' && <HealthJourneyGamePanel onNext={goNext} nextLabel={nextLabel} onViewMedicalRecord={() => setActive('upload')} onOpenMyRewardHealth={() => setActive('myRewardHealth')} />}
            {active === 'medicalAssetStore' && <MedicalAssetStorePanel />} {/* <--- RENDER PANEL Ở ĐÂY */}
            {active === 'medicalVisualPlayground' && <MedicalVisualPlayground onFullscreenChange={setHideSidebarForFocus} />}
            {active === 'medicalVisualCameraAngle3D' && <MedicalVisualCameraAngle3D onFullscreenChange={setHideSidebarForFocus} />}
            {active === 'myRewardHealth' && <MyRewardHealthPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} onOpenFoodToday={() => setActive('organConnection')} />}
            {active === 'affiliateControl' && user?.isAdmin && <AffiliateSystemControlPanel />}
            {active === 'affiliateControl' && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            {active === 'affiliate' && <AffiliateSystemPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'affiliateAdmin' && user?.isAdmin && <AffiliateSystemAdminPanel />}
            {active === 'affiliateAdmin' && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            {active === 'roleMembershipAdmin' && user?.isAdmin && <RoleMembershipAdminPanel />}
            {active === 'roleMembershipAdmin' && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            {active === 'moralisPlaygroundAdmin' && user?.isAdmin && <MoralisPlaygroundAdmin />}
            {active === 'moralisPlaygroundAdmin' && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            {active === 'affiliateWebhookAdmin' && user?.isAdmin && <AffiliateWebhookAdmin />}
            {active === 'affiliateWebhookAdmin' && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            {active === 'healthJourney' && <HealthJourneyPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} onOpenStressRelief={() => setActive('stressRelief')} onOpenInBody={() => setActive('aiInbodyPortal')} onViewMedicalRecord={() => setActive('upload')} />}
            {active === 'lunchJourney' && <LunchJourneyPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} onOpenStressRelief={() => setActive('stressRelief')} onOpenInBody={() => setActive('aiInbodyPortal')} onViewMedicalRecord={() => setActive('upload')} />}
            {active === 'dinnerJourney' && <DinnerJourneyPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} onOpenStressRelief={() => setActive('stressRelief')} onOpenInBody={() => setActive('aiInbodyPortal')} onViewMedicalRecord={() => setActive('upload')} />}
            {active === 'upload'    && <UploadPanel        patientId="LXK-2024" onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} onSelectImage={handleSelectCompareFile} />}
            {active === 'imaging'   && <ImagingPanel       onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} compareImage={compareImage} uploadedImages={uploadedImages} onSelectCompareImage={setCompareImage} scrollTarget={imagingScrollTarget} onScrollTargetHandled={() => setImagingScrollTarget(null)} />}
            {active === 'checkin'   && <CheckinPanel       onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'family'    && <FamilyTreePanel    patientId="LXK-2024" nextLabel={nextLabel} storageOwnerId={familyStorageOwnerId} onNext={goNext} onPrev={goPrev} prevLabel={prevLabel} onViewRecord={navigateToRecord} />}
            {active === 'familyRelationship' && <FamilyMedicalRelationshipPanel patientId="LXK-2024" nextLabel={nextLabel} storageOwnerId={familyStorageOwnerId} onNext={goNext} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'record'    && <PatientRecordPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} selectedMember={selectedMember} storageOwnerId={familyStorageOwnerId} onBackToPatient={() => setSelectedMember(null)} />}
            {active === 'matrix3dBody' && <Matrix3DBodyPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'omnidirectional3dBody' && <Omnidirectional3DBodyPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'twin'      && <TwinPanel          onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'telemedicine' && <TelemedicinePanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} onViewMedicalRecord={() => setActive('upload')} />}
            {active === 'statAnalysis' && <StatisticalAnalysisPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'swarm'     && <SwarmConsensusPanel onReset={() => setActive('upload')} onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'consensus' && <ConsensusPanel     onReset={() => setActive('upload')} onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'varCheck'  && <VarCheckPanel      onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'protein3d' && <Protein3DPanel     onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'aiHealthcareVision' && <AIHealthcareVisionPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'aiHealthcareVisionControl' && <AIHealthcareVisionControlPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} onViewMedicalRecord={() => setActive('upload')} />}
            {active === 'stressRelief' && <StressReliefPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'aiInbodyPortal' && <AIInbodyPortalPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} onViewMedicalRecord={() => setActive('upload')} />}
            {active === 'rssPortal' && <RSSPortalPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'waterDrinkChatBot' && <WaterDrinkChatBotPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} onViewMedicalRecord={() => setActive('upload')} />}
            {active === 'wikiMedVision' && <WikiMedVisionPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'fullDocSummarization' && <FullDocumentSummarizationPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'documentOCR' && <DocumentOCRPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'twoDTo3DAsset' && user?.isAdmin && <TwoDTo3DAssetPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'xyzCameraAngle' && user?.isAdmin && <XyzCameraAnglePanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'cameraAngle3DStudio' && <CameraAngle3DStudioPanel />}
            {active === 'organConnection' && <OrganConnectionPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'printPortal' && <PrintCenter onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'patientReflect' && <PatientReflectPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'chatHistory' && <ChatHistoryPanel onNext={goNext} nextLabel={nextLabel} onPrev={goPrev} prevLabel={prevLabel} activePanelLabel={panelLabels[active] || active} />}
            {active === 'myImageToVideo' && user?.isAdmin && <MyImageToVideoPanel onPrev={goPrev} prevLabel={prevLabel} />}
            {active === 'myImageToVideo' && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            {active === 'landingZeroToForever' && (
              <LandingPageZeroToForever
                onGetStarted={() => setActive('chooseUserRole')}
                onLogin={() => setActive('chooseUserRole')}
                onWatchVideo={() => setActive('chooseUserRole')}
                onDownloadApp={() => setActive('chooseUserRole')}
              />
            )}
            {active === 'chooseUserRole' && (
              <ChooseUserRolePanel
                mode="member"
                onSelectRole={() => setActive('donationHero')}
                onEnterAction={() => setActive('donationHero')}
                onBackToLanding={() => setActive('landingZeroToForever')}
              />
            )}
            {active === 'donationHero' && (
              <DonationHeroPanel mode="member" onBack={() => setActive('chooseUserRole')} />
            )}
            {active === 'affiliateUuidReferral' && <AffiliateUUIDReferralPanel />}
            {active === 'bodyProtectionJourney' && (
              <BodyProtectionJourneyPanel
                onNext={goNext}
                nextLabel={nextLabel}
                onFullscreenChange={setHideSidebarForFocus}
              />
            )}
            {active === 'profile'   && <UserProfilePanel />}
            {active === 'create3DVideoFrom2D' && user?.isAdmin && <Create3DVideoFrom2DPanel />}
            {active === 'create3DVideoFrom2D' && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            {active === 'avatarCreator' && <AvatarCreatorPanel />}
            {active === 'make3DModel' && user?.isAdmin && <Make3DModelPanel />}
            {active === 'make3DModel' && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            {active === 'my3dAsset' && user?.isAdmin && <My3DAssetPanel />}
            {active === 'my3dAsset' && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            {active === 'admin'     && user?.isAdmin && <AdminPanel />}
            {active === 'admin'     && !user?.isAdmin && (
              <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
            )}
            </VipProGate>
          </PanelErrorBoundary>
          <GlobalScrollButtons
            showTop={scrollState.showTop}
            showEnd={scrollState.showEnd}
            onGoTop={() => scrollMainTo('top')}
            onGoEnd={() => scrollMainTo('end')}
          />
          <GlobalPageReader readRootRef={mainRef} activeKey={active} />
        </main>
        {!hideSidebarForFocus && (
          <GlobalBottomNav
            active={active}
            onOpenMainMenu={openMainMenu}
            onNavigate={(id) => setActive(id)}
          />
        )}
        <GlobalAIChatbot activePanelLabel={panelLabels[active] || active} />
      </div>
    </div>
  )
}

function VipProGate({ locked, isDark, children }) {
  if (!locked) return children

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 58px)' }}>
      <div
        aria-hidden="true"
        inert=""
        style={{
          filter: 'blur(4px)',
          opacity: 0.42,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {children}
      </div>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="VIP PRO Accounts Only"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 'min(12vh, 96px) 18px 32px',
          background: isDark ? 'rgba(4,6,15,0.24)' : 'rgba(244,247,251,0.28)',
          cursor: 'not-allowed',
        }}
      >
        <div style={{
          width: 'min(560px, 100%)',
          borderRadius: 24,
          border: '1px solid rgba(251,191,36,0.45)',
          background: isDark ? 'rgba(15,23,42,0.94)' : 'rgba(255,255,255,0.96)',
          boxShadow: '0 28px 80px rgba(15,23,42,0.28)',
          padding: '28px 30px',
          textAlign: 'center',
          color: isDark ? '#f8fafc' : '#172033',
          backdropFilter: 'blur(14px)',
        }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>👑</div>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 12 }}>
            VIP PRO Accounts Only
          </div>
          <p style={{ margin: 0, fontSize: 20, lineHeight: 1.55, fontWeight: 800 }}>
            {VIP_PRO_LOCK_MESSAGE}
          </p>
          <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.6, color: isDark ? 'rgba(226,232,240,0.72)' : 'rgba(71,85,105,0.82)' }}>
            Bạn vẫn có thể xem trước bố cục phía sau, nhưng mọi nút bấm, ô nhập liệu và thao tác click đã được khóa cho đến khi tài khoản được nâng cấp.
          </p>
        </div>
      </div>
    </div>
  )
}


function getReadablePageText(root) {
  if (typeof document === 'undefined') return ''
  const sourceRoot = root || document.body
  const clone = sourceRoot.cloneNode(true)
  clone.querySelectorAll?.([
    'script',
    'style',
    'noscript',
    'svg',
    'canvas',
    'audio',
    'video',
    'iframe',
    '[aria-hidden="true"]',
    '[data-page-reader-ignore]',
  ].join(',')).forEach(node => node.remove())

  return (clone.innerText || clone.textContent || '')
    .replace(/\s+/g, ' ')
    .replace(/([.!?。！？])\s+/g, '$1\n')
    .trim()
}

const PAGE_READER_HIGHLIGHT_NAME = 'ai-doctor-page-reader-active'
let pageReaderHighlightStyleInjected = false

function ensurePageReaderHighlightStyle() {
  if (typeof document === 'undefined' || pageReaderHighlightStyleInjected) return
  const style = document.createElement('style')
  style.textContent = `
    ::highlight(${PAGE_READER_HIGHLIGHT_NAME}) {
      background: rgba(250, 204, 21, 0.62);
      color: inherit;
    }
  `
  document.head.appendChild(style)
  pageReaderHighlightStyleInjected = true
}

function clearPageReaderHighlight() {
  if (typeof CSS === 'undefined' || !CSS.highlights) return
  CSS.highlights.delete(PAGE_READER_HIGHLIGHT_NAME)
}

function showPageReaderHighlight(range) {
  if (typeof Highlight === 'undefined' || typeof CSS === 'undefined' || !CSS.highlights || !range) return
  ensurePageReaderHighlightStyle()
  CSS.highlights.set(PAGE_READER_HIGHLIGHT_NAME, new Highlight(range))
}

function shouldSkipReaderNode(node) {
  const parent = node?.parentElement
  if (!parent) return true
  return Boolean(parent.closest([
    'script',
    'style',
    'noscript',
    'svg',
    'canvas',
    'audio',
    'video',
    'iframe',
    '[aria-hidden="true"]',
    '[data-page-reader-ignore]',
  ].join(',')))
}

function getReadablePageSegments(root) {
  if (typeof document === 'undefined') return []
  const sourceRoot = root || document.body
  const walker = document.createTreeWalker(
    sourceRoot,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (shouldSkipReaderNode(node)) return NodeFilter.FILTER_REJECT
        return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      },
    },
  )
  const segments = []
  const sentencePattern = /[^.!?。！？\n]+[.!?。！？]?/g
  let node = walker.nextNode()
  while (node) {
    const text = node.nodeValue || ''
    for (const match of text.matchAll(sentencePattern)) {
      const sentence = match[0].replace(/\s+/g, ' ').trim()
      if (!sentence) continue
      const start = match.index || 0
      const end = start + match[0].length
      const range = document.createRange()
      range.setStart(node, start)
      range.setEnd(node, end)
      segments.push({ text: sentence, range })
    }
    node = walker.nextNode()
  }
  return segments
}

function GlobalPageReader({ readRootRef, activeKey }) {
  const { theme, lang } = useApp()
  const isVi = lang !== 'en'
  const [showPlaybackControls, setShowPlaybackControls] = useState(false)
  const readSessionRef = useRef(0)
  const {
    speaking,
    speak,
    stop,
    paused,
    pause,
    resume,
    volume,
    setVolume,
    rate,
    setRate,
    hasReplay,
  } = useTTS(isVi ? 'vi' : 'en')

  useEffect(() => {
    readSessionRef.current += 1
    clearPageReaderHighlight()
    stop()
    setShowPlaybackControls(false)
  }, [activeKey, stop])

  const speakCurrentPage = async () => {
    const sessionId = readSessionRef.current + 1
    readSessionRef.current = sessionId
    const segments = getReadablePageSegments(readRootRef?.current)
    const fallbackText = segments.length ? '' : getReadablePageText(readRootRef?.current)
    if (!segments.length && !fallbackText) {
      window.alert(isVi ? 'Không tìm thấy chữ để đọc trên màn hình.' : 'No readable text was found on this screen.')
      return
    }

    if (!segments.length) {
      clearPageReaderHighlight()
      await speak(fallbackText, { restart: true })
      return
    }

    for (const segment of segments) {
      if (readSessionRef.current !== sessionId) break
      showPageReaderHighlight(segment.range)
      segment.range.startContainer.parentElement?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      await speak(segment.text, { restart: true })
    }

    if (readSessionRef.current === sessionId) clearPageReaderHighlight()
  }

  const handleToggleRead = () => {
    if (speaking) {
      handleStopReading()
      return
    }
    setShowPlaybackControls(true)
    speakCurrentPage()
  }

  const handleStopReading = () => {
    readSessionRef.current += 1
    clearPageReaderHighlight()
    stop()
  }

  const handleReplay = () => {
    setShowPlaybackControls(true)
    speakCurrentPage()
  }

  const isDark = theme === 'dark'
  const title = speaking
    ? (isVi ? 'Dừng đọc màn hình' : 'Stop reading the screen')
    : (isVi ? 'Đọc tất cả chữ trên màn hình từ trên xuống dưới' : 'Read all visible screen text from top to bottom')

  return (
    <div
      data-page-reader-ignore
      style={{
        position: 'fixed',
        top: 'calc(10px + env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 260,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        onClick={handleToggleRead}
        aria-pressed={speaking}
        aria-label={title}
        title={title}
        style={{
          pointerEvents: 'auto',
          width: 54,
          height: 54,
          borderRadius: '50%',
          border: speaking ? '2px solid #ef4444' : '2px solid #10b981',
          background: speaking
            ? 'linear-gradient(135deg, #ef4444, #f97316)'
            : (isDark ? 'rgba(2,6,23,0.88)' : 'rgba(255,255,255,0.94)'),
          color: speaking ? '#fff' : (isDark ? '#34d399' : '#047857'),
          boxShadow: '0 14px 38px rgba(0,0,0,0.24)',
          cursor: 'pointer',
          fontSize: 24,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {speaking ? '■' : '🔊'}
      </button>
      {(speaking || hasReplay) && (
        <button
          type="button"
          onClick={() => setShowPlaybackControls(value => !value)}
          aria-expanded={showPlaybackControls}
          aria-label={showPlaybackControls ? (isVi ? 'Ẩn vùng điều khiển loa' : 'Hide speaker controls') : (isVi ? 'Hiện vùng điều khiển loa' : 'Show speaker controls')}
          style={{
            pointerEvents: 'auto',
            border: isDark ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(16,185,129,0.24)',
            borderRadius: 999,
            background: isDark ? 'rgba(2,6,23,0.88)' : 'rgba(255,255,255,0.96)',
            color: isDark ? '#e5e7eb' : '#064e3b',
            boxShadow: '0 10px 26px rgba(0,0,0,0.16)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 900,
            padding: '7px 12px',
          }}
        >
          🔊 {showPlaybackControls ? (isVi ? 'Ẩn điều khiển' : 'Hide controls') : (isVi ? 'Hiện điều khiển' : 'Show controls')}
        </button>
      )}
      {(speaking || hasReplay) && showPlaybackControls && (
        <div
          style={{
            pointerEvents: 'auto',
            display: 'grid',
            gap: 6,
            minWidth: 250,
            padding: '10px 12px',
            borderRadius: 18,
            border: isDark ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(16,185,129,0.24)',
            background: isDark ? 'rgba(2,6,23,0.92)' : 'rgba(255,255,255,0.96)',
            color: isDark ? '#e5e7eb' : '#064e3b',
            boxShadow: '0 16px 42px rgba(0,0,0,0.22)',
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{speaking ? (isVi ? 'Đang đọc màn hình' : 'Reading screen') : (isVi ? 'Sẵn sàng nghe lại' : 'Ready to replay')}</div>
              <div style={{ marginTop: 2, opacity: 0.72, fontSize: 10, fontWeight: 700 }}>
                {speaking
                  ? (paused ? (isVi ? 'Đã tạm dừng' : 'Paused') : (isVi ? 'Đang phát âm thanh chung' : 'Global audio is playing'))
                  : (isVi ? 'Bấm nghe lại để đọc trang hiện tại' : 'Tap replay to read the current page')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {speaking && (
                <button
                  type="button"
                  onClick={paused ? resume : pause}
                  aria-label={paused ? (isVi ? 'Nghe tiếp' : 'Resume') : (isVi ? 'Tạm dừng nghe' : 'Pause')}
                  style={{ border: 0, borderRadius: 999, padding: '6px 9px', cursor: 'pointer', fontWeight: 900 }}
                >
                  {paused ? '▶' : '⏸'}
                </button>
              )}
              <button
                type="button"
                onClick={handleReplay}
                aria-label={isVi ? 'Nghe lại' : 'Replay'}
                style={{ border: 0, borderRadius: 999, padding: '6px 9px', cursor: 'pointer', fontWeight: 900 }}
              >
                ↻
              </button>
              {speaking && (
                <button
                  type="button"
                  onClick={handleStopReading}
                  aria-label={isVi ? 'Dừng hẳn việc nghe' : 'Stop playback'}
                  style={{ border: 0, borderRadius: 999, padding: '6px 9px', cursor: 'pointer', fontWeight: 900, background: '#ef4444', color: '#fff' }}
                >
                  ■
                </button>
              )}
            </div>
          </div>
          <label style={{ display: 'grid', gridTemplateColumns: '66px 1fr 34px', gap: 6, alignItems: 'center' }}>
            <span>{isVi ? 'Âm lượng' : 'Volume'}</span>
            <input type="range" min="0" max="1" step="0.05" value={volume} onChange={event => setVolume(event.target.value)} />
            <span style={{ textAlign: 'right' }}>{Math.round(volume * 100)}%</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '66px 1fr 34px', gap: 6, alignItems: 'center' }}>
            <span>{isVi ? 'Tốc độ' : 'Speed'}</span>
            <input type="range" min="0.5" max="2" step="0.05" value={rate} onChange={event => setRate(event.target.value)} />
            <span style={{ textAlign: 'right' }}>{rate.toFixed(2)}×</span>
          </label>
        </div>
      )}
    </div>
  )
}

function GlobalBottomNav({ active, onOpenMainMenu, onNavigate }) {
  const { theme } = useApp()
  const isDark = theme === 'dark'
  const items = [
    { id: 'health', label: 'Health', icon: '♿', action: onOpenMainMenu, active: ['bodyProtectionJourney', 'healthJourneyGame', 'medicalAssetStore', 'medicalVisualPlayground', 'medicalVisualCameraAngle3D', 'myRewardHealth', 'healthJourney', 'lunchJourney', 'dinnerJourney'].includes(active) },
    { id: 'family', label: 'Community', icon: '👥', action: () => onNavigate('family'), active: active === 'family' },
    { id: 'aiHealthcareVision', label: 'AI Scan', icon: '🧬', action: () => onNavigate('aiHealthcareVision'), active: active === 'aiHealthcareVision' || active === 'aiHealthcareVisionControl' },
    { id: 'upload', label: 'Record', icon: '📄', action: () => onNavigate('upload'), active: active === 'upload' },
    { id: 'profile', label: 'Profile', icon: '👤', action: () => onNavigate('profile'), active: active === 'profile' },
  ]

  return (
    <nav
      aria-label="Global quick navigation"
      style={{
        position: 'fixed', left: '50%', bottom: 14, transform: 'translateX(-50%)', zIndex: 180,
        width: 'min(calc(100vw - 24px), 560px)', minHeight: 72,
        display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4,
        padding: '8px 10px calc(8px + env(safe-area-inset-bottom))', borderRadius: 24,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'}`,
        background: isDark ? 'rgba(8,12,26,0.90)' : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(18px)', boxShadow: '0 18px 55px rgba(0,0,0,0.24)',
      }}
    >
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={item.action}
          aria-current={item.active ? 'page' : undefined}
          style={{
            minWidth: 0, minHeight: 54, border: 'none', borderRadius: 18, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            background: item.active ? 'linear-gradient(135deg, rgba(0,229,255,0.20), rgba(156,111,255,0.18))' : 'transparent',
            color: item.active ? '#00e5ff' : (isDark ? 'rgba(232,240,248,0.72)' : '#626266'),
            fontFamily: 'inherit', fontSize: 11, fontWeight: item.active ? 900 : 700,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

class PanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, reportSent: false }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Panel render error:', error, info)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, reportSent: false })
    }
  }

  handleClearHealthJourneyData = () => {
    try {
      localStorage.removeItem('health_journey_local_db_v1')
    } catch (e) {
      console.error('Unable to clear health journey data:', e)
    }
    this.setState({ error: null, reportSent: false })
  }

  handleClearFamilyData = () => {
    try {
      try { localStorage.removeItem('health_journey_local_db_v1') } catch (_) {}
      const ownerKey = String(this.props.familyStorageOwnerId || 'guest').trim().toLowerCase() || 'guest'
      const byUser = JSON.parse(localStorage.getItem('cdoc_family_members_by_user') || '{}')

      if (byUser?.[ownerKey]) {
        delete byUser[ownerKey]['LXK-2024']
        localStorage.setItem('cdoc_family_members_by_user', JSON.stringify(byUser))
      }
      localStorage.removeItem('cdoc_family_members')
    } catch (error) {
      console.error('Unable to clear family data:', error)
    }
    this.setState({ error: null, reportSent: false })
  }

  handleSendToAdmin = () => {
    const { error } = this.state
    const { panelLabel, user } = this.props
    addNotification({
      type: 'system-error',
      title: 'Lỗi render cần admin kiểm tra',
      message: `User ${user?.email || 'unknown'} báo lỗi tại ${panelLabel}: ${error?.message || 'Unknown panel error'}`,
      audience: 'admin',
      userEmail: user?.email || '',
      userName: user?.name || '',
      panelLabel,
      screenMessage: `Không thể tải trang ${panelLabel}`,
      errorMessage: error?.message || 'Unknown panel error',
      errorStack: error?.stack || '',
      status: 'new',
    })
    this.setState({ reportSent: true })
  }

  render() {
    if (!this.state.error) return this.props.children

    const { isDark, panelLabel, onReset } = this.props
    const text = isDark ? '#e8f0f8' : '#1a2035'
    const text2 = isDark ? 'rgba(232,240,248,0.62)' : '#555'
    const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
    const surface = isDark ? 'rgba(255,255,255,0.04)' : '#fff'

    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <div style={{ width: '100%', maxWidth: 640, border: `1px solid ${border}`, background: surface, borderRadius: 18, padding: 28, boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.45)' : '0 18px 60px rgba(0,0,0,0.12)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ color: text, fontSize: 20, margin: '0 0 8px', fontWeight: 900 }}>
            Không thể tải trang {panelLabel}
          </h2>
          <p style={{ color: text2, fontSize: 13, lineHeight: 1.65, margin: '0 0 18px' }}>
            Ứng dụng đã chặn lỗi render để tránh màn hình đen. Nếu lỗi đến từ dữ liệu Gia phả bệnh lý đã lưu trên trình duyệt, hãy xoá cache dữ liệu gia đình rồi mở lại trang.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 140, overflow: 'auto', padding: 12, borderRadius: 10, border: `1px solid ${border}`, color: '#ff8a65', background: isDark ? 'rgba(0,0,0,0.24)' : '#fff7f3', fontSize: 11 }}>
            {this.state.error?.message || 'Unknown panel error'}
          </pre>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <button type="button" onClick={this.handleClearHealthJourneyData} style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(134,239,172,.35)', background: 'rgba(134,239,172,.1)', color: '#86efac', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              Xoá cache Health Journey
            </button>
            <button type="button" onClick={this.handleClearFamilyData} style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(0,229,255,.35)', background: 'rgba(0,229,255,.1)', color: '#00e5ff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              Xoá dữ liệu gia đình trên máy
            </button>
            <button type="button" onClick={this.handleSendToAdmin} disabled={this.state.reportSent} style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(255,183,77,.38)', background: this.state.reportSent ? 'rgba(0,230,118,.1)' : 'rgba(255,183,77,.12)', color: this.state.reportSent ? '#00e676' : '#ffb74d', fontWeight: 800, cursor: this.state.reportSent ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {this.state.reportSent ? 'Đã gửi admin' : 'Gửi admin'}
            </button>
            <button type="button" onClick={onReset} style={{ padding: '10px 14px', borderRadius: 9, border: `1px solid ${border}`, background: 'transparent', color: text2, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Về trang tải hồ sơ
            </button>
          </div>
        </div>
      </div>
    )
  }
}

function GlobalScrollButtons({ showTop, showEnd, onGoTop, onGoEnd }) {
  return (
    <div className="scroll-jump-controls" aria-label="Page scroll controls">
      <button
        type="button"
        className={`scroll-jump-button ${showTop ? 'is-visible' : ''}`}
        aria-label="Go to top"
        title="Go to Top"
        onClick={onGoTop}
      >
        <span aria-hidden="true">↑</span>
        <span className="scroll-jump-label">Top</span>
      </button>
      <button
        type="button"
        className={`scroll-jump-button ${showEnd ? 'is-visible' : ''}`}
        aria-label="Go to end"
        title="Go to End"
        onClick={onGoEnd}
      >
        <span aria-hidden="true">↓</span>
        <span className="scroll-jump-label">End</span>
      </button>
    </div>
  )
}
