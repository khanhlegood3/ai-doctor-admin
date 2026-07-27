import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'; 
import marketData from '../data/medical_3d_market.json';
import { useAuth } from '../context/AuthContext';
import AnimatedAvatarViewer from './AnimatedAvatarViewer';
import ObjModelViewer from './ObjModelViewer';

// medical_3d_market.json đã có sẵn modelUrl trỏ tới file .glb thật cho từng
// item, nhưng thiếu cờ previewable/format nên trước đây thẻ item luôn hiện
// ảnh tĩnh (asset.thumbnail) thay vì thumbnail 3D xoay thật như các theme
// ngoài (xem AssetCardThumbnail3D — chỉ bật 3D khi previewable && format).
// Bật previewable+format ở đây để NHẤT QUÁN: mọi item trên toàn trang (nội
// bộ lẫn ngoài) đều hiện thumbnail 3D thật xoay tự động thay vì ảnh chụp
// đại diện; asset.thumbnail vẫn còn đó để làm poster/fallback lúc model
// chưa kịp tải (component tự dùng placeholder này khi cần).
const INTERNAL_MARKET_DATA = marketData.map((item) => ({
  ...item,
  previewable: true,
  format: 'glb',
}));

// ============================================================================
// CHỦ ĐỀ (THEME) COMBOBOX — cùng ý tưởng với "Chủ đề (projects.json)" của
// trang Tạo Avatar: một danh sách "chủ đề" để chọn, mỗi chủ đề trỏ tới một
// nguồn dữ liệu JSON riêng. Ở đây item đầu tiên là kho nội bộ
// (medical_3d_market.json).
//
// Các chủ đề ngoài lấy từ dataset gobjaverse của modelscope/richdreamer
// (https://github.com/modelscope/richdreamer/blob/main/dataset/gobjaverse/README.md),
// CHỈ gồm nhóm "Map" theme (previewable: true) — trỏ thẳng tới FILE MODEL
// THẬT (glb_map.json / fbx_map.json / obj_map.json / sketchfab_map.json
// trong gobjaverse_xl_alignment_map), vì đây là nhóm duy nhất popup hiển
// thị được 3D thật (mỗi entry là {tarPath: link_file_model}). Với glb/fbx/obj
// trên GitHub, link gốc là dạng "blob" (trang xem HTML) nên phải đổi sang
// raw.githubusercontent.com mới tải được file nhị phân.
//   - GLB/GLTF: render bằng <model-viewer> (Google), chỉ đọc glTF/GLB.
//   - FBX: <model-viewer> KHÔNG hỗ trợ định dạng này, nên popup dùng lại
//     AnimatedAvatarViewer (THREE.FBXLoader + OrbitControls, cùng viewer
//     đang dùng cho hoạt ảnh avatar) để xem 3D thật thay vì chỉ hiện link
//     tải gốc.
//   - OBJ: <model-viewer> cũng không đọc được OBJ -> dùng ObjModelViewer
//     (THREE.OBJLoader + OrbitControls, tự canh giữa/scale mesh). OBJ không
//     mang màu/texture nếu thiếu file .mtl đi kèm — không phải lỗi.
//   - Sketchfab: rawUrl là TRANG XEM model (không phải file tải trực tiếp)
//     nên dùng iframe embed chính chủ của Sketchfab thay vì cố tải file
//     nhị phân.
//
// ĐÃ TẮT khỏi dropdown (không xoá code xử lý, chỉ không cho chọn nữa) — 4
// theme "Index/Caption" cũ (gobjaverse_280k.json, category_annotation.json,
// text_captions_cap3d.json, gobjaverse_alignment.json): đây chỉ là cấu trúc
// index/text, KHÔNG có file model 3D thật để xem trong popup. Vẫn giữ lại
// nhánh xử lý cho các id này trong normalizeExternalItem (không dùng tới,
// vô hại) để không phải sửa lan sang các hàm khác; 2 file
// text_captions_cap3d.json / gobjaverse_index_to_objaverse.json vẫn ĐANG
// ĐƯỢC DÙNG NGẦM cho tính năng tra caption Cap3D của popup Map theme (xem
// resolveCaptionForAsset bên dưới) — không liên quan tới dropdown này.
// ============================================================================
const INTERNAL_THEME_ID = 'medical_internal';



const EXTERNAL_THEMES = [
  // ---- Map theme — có model thật, xem 3D được trong popup ----
  {
    id: 'xl_align_glb_map',
    name: 'XL Alignment · GLB Map (GitHub)',
    license: 'gobjaverse_xl_alignment_map',
    url: 'https://virutalbuy-public.oss-cn-hangzhou.aliyuncs.com/share/aigc3d/gobjaverse_xl_alignment_map/glb_map.json',
    isMapTheme: true,
    format: 'glb',
    previewable: true,
  },
  {
    id: 'xl_align_sketchfab_map',
    name: 'XL Alignment · Sketchfab Map',
    license: 'gobjaverse_xl_alignment_map',
    url: 'https://virutalbuy-public.oss-cn-hangzhou.aliyuncs.com/share/aigc3d/gobjaverse_xl_alignment_map/sketchfab_map.json',
    isMapTheme: true,
    format: 'glb',
    previewable: true,
  },
  {
    id: 'xl_align_fbx_map',
    name: 'XL Alignment · FBX Map (GitHub)',
    license: 'gobjaverse_xl_alignment_map',
    url: 'https://virutalbuy-public.oss-cn-hangzhou.aliyuncs.com/share/aigc3d/gobjaverse_xl_alignment_map/fbx_map.json',
    isMapTheme: true,
    format: 'fbx',
    previewable: true, // xem 3D thật qua AnimatedAvatarViewer (THREE.FBXLoader), không dùng <model-viewer>
  },
  {
    id: 'xl_align_obj_map',
    name: 'XL Alignment · OBJ Map (GitHub)',
    license: 'gobjaverse_xl_alignment_map',
    url: 'https://virutalbuy-public.oss-cn-hangzhou.aliyuncs.com/share/aigc3d/gobjaverse_xl_alignment_map/obj_map.json',
    isMapTheme: true,
    format: 'obj',
    previewable: true, // xem 3D thật qua ObjModelViewer (THREE.OBJLoader), không dùng <model-viewer>
  },
];

// Danh sách gộp để render combobox chủ đề với thumbnail thật — item nội bộ
// (đầu tiên) dùng luôn ảnh của vật phẩm đầu tiên trong medical_3d_market.json
// (mô hình Tim bóc tách 3D) làm ảnh đại diện, thay vì chỉ hiện chữ trong
// thẻ <select> gốc, để nhất quán hình ảnh với các thẻ item trong lưới bên
// dưới (cùng bo góc rounded-md, object-cover, border trắng mờ). 4 chủ đề
// ngoài chưa có ảnh đại diện cố định (dữ liệu chỉ tải khi được chọn) nên
// dùng icon minh hoạ dataset thay thế.
const THEME_OPTIONS = [
  {
    id: INTERNAL_THEME_ID,
    name: 'Kho Y Tế (Nội bộ)',
    license: 'medical_3d_market.json',
    thumbnail: marketData?.[0]?.thumbnail || '',
  },
  ...EXTERNAL_THEMES.map((theme) => ({
    id: theme.id,
    name: theme.name,
    license: theme.license,
    thumbnail: '',
  })),
];


// ============================================================================
// CAPTION LOOKUP (chỉ dùng cho Nhóm A — Map theme) — popup item detail cần
// hiện caption text thật của vật thể, không chỉ tên file/tarPath.
//
// Cấu trúc THẬT của 2 file (đã xác nhận qua mẫu dữ liệu):
//   gobjaverse_index_to_objaverse.json: { "0/10042": "000-000/0028b77...glb", ... }
//   text_captions_cap3d.json:           { "0/10042": "A pair of white flip flops.", ... }
// Cả hai dùng CHUNG một khoá dạng "folder/index" — chính là tarPath trong
// glb_map.json/fbx_map.json/obj_map.json/sketchfab_map.json nhưng bỏ đuôi
// file (vd tarPath "1246/6228026.tar.gz" -> khoá "1246/6228026").
// => Caption tra được TRỰC TIẾP bằng khoá này, không cần qua UID objaverse.
// File index_to_objaverse chỉ dùng để lấy đường dẫn objaverse gốc (tham khảo/
// tải), và làm phương án dự phòng nếu 1 số entry của Cap3D lỡ được key theo
// UID thay vì theo "folder/index".
// ============================================================================
const GOBJAVERSE_INDEX_TO_OBJAVERSE_URL = 'https://virutalbuy-public.oss-cn-hangzhou.aliyuncs.com/share/aigc3d/gobjaverse_index_to_objaverse.json';
const GOBJAVERSE_280K_INDEX_TO_OBJAVERSE_URL = 'https://virutalbuy-public.oss-cn-hangzhou.aliyuncs.com/share/aigc3d/gobjaverse_280k_index_to_objaverse.json';
const TEXT_CAPTIONS_CAP3D_URL = 'https://virutalbuy-public.oss-cn-hangzhou.aliyuncs.com/share/aigc3d/text_captions_cap3d.json';

// ============================================================================
// WEB WORKER CHO JSON.parse — offload việc parse các file JSON lớn (Cap3D
// captions, gobjaverse index, *_map.json...) ra khỏi main thread, tránh đơ
// UI khi mở theme/popup lần đầu. 1 worker singleton dùng chung cho cả phiên
// trang; nhiều lệnh gọi song song được tương quan bằng requestId. Nếu Worker
// không khởi tạo được (môi trường lạ / CSP chặn) thì fallback JSON.parse
// thẳng trên main thread để tính năng vẫn chạy, chỉ mất phần tối ưu UI.
// ============================================================================
let jsonParseWorker = null;
let jsonParseRequestSeq = 0;
const jsonParsePending = new Map();

function getJsonParseWorker() {
  if (jsonParseWorker) return jsonParseWorker;
  try {
    jsonParseWorker = new Worker(new URL('../workers/jsonParseWorker.js', import.meta.url), { type: 'module' });
    jsonParseWorker.onmessage = (event) => {
      const { requestId, ok, data, error } = event.data || {};
      const pending = jsonParsePending.get(requestId);
      if (!pending) return;
      jsonParsePending.delete(requestId);
      if (ok) pending.resolve(data);
      else pending.reject(new Error(error || 'JSON.parse lỗi (worker)'));
    };
    jsonParseWorker.onerror = () => {
      // Lỗi ở cấp worker (hiếm) -> reject mọi request đang chờ để không treo
      // promise mãi mãi; lần gọi kế tiếp sẽ tự tạo lại worker mới.
      jsonParsePending.forEach(({ reject }) => reject(new Error('Worker JSON.parse lỗi')));
      jsonParsePending.clear();
      jsonParseWorker = null;
    };
  } catch {
    jsonParseWorker = null;
  }
  return jsonParseWorker;
}

function parseJsonInWorker(text) {
  const worker = getJsonParseWorker();
  if (!worker) return Promise.reject(new Error('Không tạo được Worker'));
  const requestId = ++jsonParseRequestSeq;
  return new Promise((resolve, reject) => {
    jsonParsePending.set(requestId, { resolve, reject });
    worker.postMessage({ requestId, text });
  });
}

// Parse "thông minh": ưu tiên Worker (không chặn main thread); nếu vì lý do
// gì đó Worker lỗi/không dùng được thì fallback JSON.parse thẳng.
async function parseJsonSmart(text) {
  try {
    return await parseJsonInWorker(text);
  } catch {
    return JSON.parse(text);
  }
}

// Cache module-level: url -> Promise<JSON đã tải/parse> (dùng trong 1 phiên
// trang — nếu 2 nơi cùng cần 1 url cùng lúc, chỉ 1 lượt tải+parse chạy).
// Tầng bền vững hơn (sống sót qua F5 / đóng mở lại trang) nằm ở IndexedDB —
// xem loadJsonCacheFromDB/saveJsonCacheToDB ở khối "MODULE INDEXED-DB" bên
// dưới; các dataset này gần như tĩnh nên không cần tải+parse lại mỗi lần.
const jsonFetchCache = new Map();
function fetchJsonOnce(url) {
  if (!jsonFetchCache.has(url)) {
    jsonFetchCache.set(
      url,
      (async () => {
        // 1) Đã có trong IndexedDB từ phiên trước -> dùng luôn, khỏi tải mạng.
        const cached = await loadJsonCacheFromDB(url);
        if (cached !== undefined) return cached;

        // 2) Chưa có -> tải text thô rồi parse TRONG WORKER (không chặn main
        // thread), thay vì res.json() chạy thẳng trên main thread.
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const data = await parseJsonSmart(text);

        // 3) Lưu lại cho lần sau (F5 / mở lại trang không phải tải+parse lại).
        saveJsonCacheToDB(url, data);
        return data;
      })()
    );
  }
  return jsonFetchCache.get(url);
}

// tarPath dạng "1246/6228026.tar.gz" -> bỏ đuôi file, giữ "1246/6228026"
// (đúng dạng khoá "folder/index" mà 2 file JSON caption/index dùng chung).
function tarPathToMapKey(tarPath) {
  const raw = String(tarPath || '').trim();
  // bỏ mọi đuôi dạng .tar.gz / .tar / .glb / .fbx / .obj / .zip ở cuối
  return raw.replace(/\.(tar\.gz|tgz|tar|glb|gltf|fbx|obj|zip)$/i, '');
}

// UID objaverse = tên file (bỏ đuôi) trong đường dẫn "000-000/hash.glb" hoặc
// "dictionary_index/object_index.glb" (category_annotation.json).
function extractUidFromObjaversePath(path) {
  const raw = String(path || '');
  const base = raw.split('/').pop() || raw;
  return base.replace(/\.[a-z0-9]+$/i, '');
}

// gobjaverse_alignment.json chứa link tải TRỰC TIẾP dạng
// ".../gobjaverse_alignment/1000/5002955.tar.gz" — 2 segment cuối của path
// (bỏ đuôi) chính là khoá "folder/index" giống hệt map theme.
function extractMapKeyFromAlignmentUrl(url) {
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) return '';
    const folder = parts[parts.length - 2];
    const file = tarPathToMapKey(parts[parts.length - 1]);
    return file ? `${folder}/${file}` : '';
  } catch {
    return '';
  }
}

function lookupInMap(map, key) {
  if (!map || !key) return undefined;
  if (Array.isArray(map)) {
    const idx = Number(key);
    return Number.isFinite(idx) ? map[idx] : undefined;
  }
  if (typeof map === 'object') {
    return map[key];
  }
  return undefined;
}

// Tra caption cho 1 asset. Asset có thể mang 1 trong 2 kiểu khoá:
//  - captionUid: UID objaverse trực tiếp (từ category_annotation.json)
//    -> tra thẳng text_captions_cap3d.json[uid].
//  - captionKey: khoá "folder/index" (từ map theme / gobjaverse_280k /
//    gobjaverse_alignment) -> tra trực tiếp text_captions_cap3d.json[key];
//    nếu miss, thử lấy UID qua gobjaverse_index_to_objaverse.json (bản đầy
//    đủ rồi tới bản 280k) rồi tra lại theo UID.
// Luôn trả về '' thay vì throw nếu bất kỳ bước nào miss.
async function resolveCaptionForAsset(asset) {
  if (!asset) return '';
  try {
    const captionsMap = await fetchJsonOnce(TEXT_CAPTIONS_CAP3D_URL);

    if (asset.captionUid) {
      const byUid = lookupInMap(captionsMap, asset.captionUid);
      return typeof byUid === 'string' ? byUid : '';
    }

    if (asset.captionKey) {
      const mapKey = tarPathToMapKey(asset.captionKey);
      const direct = lookupInMap(captionsMap, mapKey);
      if (typeof direct === 'string' && direct) return direct;

      let objaversePath;
      try {
        const fullIndexMap = await fetchJsonOnce(GOBJAVERSE_INDEX_TO_OBJAVERSE_URL);
        objaversePath = lookupInMap(fullIndexMap, mapKey);
      } catch {
        // bỏ qua, thử bản 280k
      }
      if (!objaversePath) {
        try {
          const idx280kMap = await fetchJsonOnce(GOBJAVERSE_280K_INDEX_TO_OBJAVERSE_URL);
          objaversePath = lookupInMap(idx280kMap, mapKey);
        } catch {
          // bỏ qua
        }
      }
      if (!objaversePath) return '';

      const uid = extractUidFromObjaversePath(objaversePath);
      const byUid = lookupInMap(captionsMap, uid);
      return typeof byUid === 'string' ? byUid : '';
    }

    return '';
  } catch {
    return '';
  }
}

// ============================================================================
// TẢI DỮ LIỆU THEO "CỬA SỔ" (LAZY WINDOW) — thay vì luôn CHUẨN HOÁ (normalize)
// cứng 100 mục đầu tiên bất kể pageSize là 8/16/32, giờ:
//   1. Cache JSON thô + mảng entries đã "dàn phẳng" theo url (module-level
//      Map) -> đổi qua đổi lại theme không fetch/parse lại từ đầu.
//   2. Chỉ CHUẨN HOÁ đủ số lượng cần cho trang hiện tại + vài trang đệm phía
//      sau (PREFETCH_PAGES) — không dựng object/thumbnail cho phần chưa cần
//      hiển thị. pageSize=8 sẽ chuẩn hoá ít hơn hẳn pageSize=32.
//   3. Khi người dùng chuyển trang vượt "cửa sổ" đã chuẩn hoá, chỉ re-slice
//      + normalize thêm từ entries đã cache sẵn trong RAM (không gọi mạng
//      lại) — rất rẻ vì dữ liệu thô đã có sẵn.
// Lưu ý: phần tốn kém thật sự (tải + JSON.parse toàn bộ file — có thể tới
// hàng trăm nghìn dòng, xem sketchfab_map.json ~340k entries) là không tránh
// được với 1 file JSON tĩnh không hỗ trợ phân trang phía server. Cải thiện ở
// đây là: (a) không lặp lại việc tải/parse đó mỗi lần đổi theme qua lại,
// (b) không lãng phí CPU dựng object cho các mục chưa hiển thị.
// ============================================================================
const PREFETCH_PAGES = 3; // dựng sẵn thêm vài trang kế tiếp để chuyển trang mượt, không giật

// Cache: theme.url -> Promise<{ entries, total }> — entries đã dàn phẳng
// (chưa chuẩn hoá thành asset), dùng lại cho mọi lần chọn lại theme này.
const themeEntriesCache = new Map();
function loadThemeEntries(theme) {
  if (!themeEntriesCache.has(theme.url)) {
    themeEntriesCache.set(
      theme.url,
      fetchJsonOnce(theme.url).then((data) => {
        const entries = theme.isMapTheme ? toMapEntriesArray(data) : toEntriesArray(data);
        return { entries, total: entries.length };
      })
    );
  }
  return themeEntriesCache.get(theme.url);
}

// Số mục cần chuẩn hoá để phủ hết trang hiện tại + PREFETCH_PAGES trang đệm,
// không bao giờ vượt quá tổng số entry thật.
function computeNeededPreviewCount(pageSizeVal, currentPageVal, totalVal) {
  const needed = currentPageVal * pageSizeVal + pageSizeVal * PREFETCH_PAGES;
  return Math.min(totalVal, Math.max(needed, pageSizeVal));
}

function normalizeEntriesSlice(entries, theme, count) {
  return entries
    .slice(0, count)
    .map((entry, index) => (theme.isMapTheme ? normalizeMapItem(entry, theme, index) : normalizeExternalItem(entry, theme, index)));
}

// Đổi link "blob" (trang xem HTML) của GitHub sang raw.githubusercontent.com
// để lấy được byte thật của file — <model-viewer> không tải được trang HTML.
// https://github.com/{owner}/{repo}/blob/{ref}/{path...} -> https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path...}
function toGithubRawUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)github\.com$/i.test(parsed.hostname)) return '';
    const parts = parsed.pathname.split('/').filter(Boolean);
    const blobIndex = parts.findIndex((part) => part === 'blob');
    if (blobIndex < 2 || parts.length < blobIndex + 3) return '';
    const [owner, repo] = parts;
    const ref = parts[blobIndex + 1];
    const filePath = parts.slice(blobIndex + 2).join('/');
    if (!owner || !repo || !ref || !filePath) return '';
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
  } catch {
    return '';
  }
}

// sketchfab_map.json không trỏ tới file .glb tải trực tiếp — nó trỏ tới
// TRANG XEM model của Sketchfab, vd:
//   https://sketchfab.com/3d-models/sber-69ca5719ef8f4430b0c4a587888dc608
// (đuôi là UID 32 ký tự hex của model). Sketchfab không cho tải file gốc
// qua link công khai (cần API key + quyền download riêng của tác giả), nên
// <model-viewer> không thể render trực tiếp link này — thay vào đó dùng
// IFRAME EMBED chính chủ của Sketchfab (vẫn xoay/zoom 3D được bình thường):
//   https://sketchfab.com/models/{uid}/embed
function extractSketchfabModelUid(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'sketchfab.com' && parsed.hostname !== 'www.sketchfab.com') return '';
    const match = parsed.pathname.match(/([0-9a-f]{32})/i);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function buildSketchfabEmbedUrl(uid) {
  if (!uid) return '';
  return `https://sketchfab.com/models/${uid}/embed?autostart=0&ui_theme=dark&transparent=1`;
}

// Chỉ trả về modelUrl khi ta chắc chắn đó là link tải file trực tiếp
// (raw GitHub, hoặc link đã kết thúc bằng .glb/.gltf/.fbx/.obj) — nếu không
// chắc (ví dụ trang xem model của Sketchfab, không phải file tải trực tiếp)
// thì để trống, popup sẽ hiện link "Xem nguồn" thay vì cố render lỗi.
function resolveDirectModelUrl(rawUrl) {
  if (!rawUrl) return '';
  const githubRaw = toGithubRawUrl(rawUrl);
  if (githubRaw) return githubRaw;
  if (/\.(glb|gltf|fbx|obj)(\?|#|$)/i.test(rawUrl)) return rawUrl;
  return '';
}

function externalThumbnail(themeName) {
  const initials = String(themeName || '3D').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="0" fill="#12182b"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="800" fill="#00e5ff">${initials}</text></svg>`)}`;
}

function fileNameFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split('/').filter(Boolean).pop() || url);
  } catch {
    return String(url || '').split('/').filter(Boolean).pop() || String(url || '');
  }
}

// Các file .json gốc có nhiều hình dạng khác nhau (mảng, object dạng
// dictionary_id -> [...], hoặc object dạng id -> caption). Hàm này quy về
// một mảng các entry {id, value} để xử lý đồng nhất, không giả định cấu trúc.
function toEntriesArray(data) {
  if (Array.isArray(data)) return data.map((value, index) => ({ id: `item-${index}`, value }));
  if (data && typeof data === 'object') return Object.entries(data).map(([id, value]) => ({ id, value }));
  return [];
}

// Các file "map" (glb_map.json, fbx_map.json, obj_map.json, sketchfab_map.json)
// có cấu trúc riêng: một MẢNG các object 1-cặp-key, ví dụ
// [{ "1246/6228028.tar.gz": "https://github.com/.../vishnu.glb" }, ...]
// -> quy về {id: tarPath, value: link_model}.
function toMapEntriesArray(data) {
  if (!Array.isArray(data)) return [];
  const entries = [];
  data.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    Object.entries(row).forEach(([tarPath, link]) => entries.push({ id: tarPath, value: link }));
  });
  return entries;
}

// Chuẩn hoá 1 dòng của Nhóm B (Index/Caption theme) — 4 file có 4 hình dạng
// dữ liệu khác nhau (đã xác nhận qua mẫu thật), nên xử lý riêng theo theme.id:
//
//  - gobjaverse_280k: value là string "folder/index" (khoá y hệt map theme)
//    -> dùng làm captionKey để tra caption, dù theme này không có model 3D.
//  - category_annotation: value là { dictionary_index, object_index, label }
//    -> object_index là UID+.glb -> dùng captionUid tra thẳng caption; label
//    dùng làm tag phân loại (10 nhóm: Daily-Used, Animals, Human-Shape...).
//  - text_captions_cap3d: value CHÍNH LÀ caption text -> hiện luôn làm tiêu
//    đề (presetCaption), không cần fetch lại khi mở popup.
//  - gobjaverse_alignment: value là link tải .tar.gz trực tiếp -> lấy tên
//    file làm tiêu đề, tách khoá "folder/index" từ URL để tra caption; KHÔNG
//    gán modelUrl vì .tar.gz không phải định dạng <model-viewer> đọc được.
function normalizeExternalItem(entry, theme, index) {
  const { id, value } = entry;
  let rawUrl = '';
  let titleFromValue = '';
  let downloads = 0;
  let tags = ['Open Dataset', theme.name];
  let captionKey = '';
  let captionUid = '';
  let presetCaption = '';

  if (theme.id === 'gobjaverse_280k' && typeof value === 'string') {
    captionKey = value.trim();
    titleFromValue = captionKey;
  } else if (theme.id === 'category_annotation' && value && typeof value === 'object') {
    const dictionaryIndex = value.dictionary_index || '';
    const objectIndex = value.object_index || '';
    captionUid = extractUidFromObjaversePath(objectIndex);
    titleFromValue = captionUid || `${dictionaryIndex}/${objectIndex}`;
    if (value.label) tags = ['Open Dataset', value.label, theme.name];
  } else if (theme.id === 'text_captions_cap3d' && typeof value === 'string') {
    presetCaption = value.trim();
    captionKey = String(id || '');
    titleFromValue = captionKey ? `Cap3D · ${captionKey}` : presetCaption;
  } else if (theme.id === 'gobjaverse_alignment' && typeof value === 'string' && /^https?:\/\//i.test(value)) {
    rawUrl = value;
    captionKey = extractMapKeyFromAlignmentUrl(value);
  } else if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) rawUrl = value;
    else titleFromValue = value.trim();
  } else if (Array.isArray(value)) {
    downloads = value.length;
  } else if (value && typeof value === 'object') {
    rawUrl = value.url || value.glb || value.model || value.path || '';
    titleFromValue = value.name || value.title || value.caption || '';
    downloads = Number(value.count || value.downloads || 0) || 0;
  } else if (typeof value === 'number') {
    downloads = value;
  }

  const title = (titleFromValue || (rawUrl ? fileNameFromUrl(rawUrl) : String(id))).slice(0, 140);

  // Toàn bộ Nhóm B có previewable=false -> chỉ gán modelUrl nếu ai đó bật lại
  // cờ này trong tương lai VÀ link resolve chắc chắn là .glb/.gltf tải trực
  // tiếp (không bao giờ gán thẳng link .tar.gz cho <model-viewer>).
  const modelUrl = theme.previewable ? resolveDirectModelUrl(rawUrl) : '';

  return {
    id: `${theme.id}-${index}-${String(id).slice(0, 40)}`,
    title,
    author: theme.name,
    price: 0,
    downloads,
    thumbnail: externalThumbnail(theme.name),
    modelUrl,
    tags,
    isExternal: true,
    sourceUrl: rawUrl || theme.url,
    captionKey: captionKey || undefined,
    captionUid: captionUid || undefined,
    presetCaption: presetCaption || undefined,
  };
}

// Chuẩn hoá 1 dòng của "map" theme thành asset — chỉ gán modelUrl (để popup
// gọi <model-viewer>) khi theme.previewable=true VÀ link được resolve chắc
// chắn là file tải trực tiếp (raw GitHub .glb/.gltf); ngược lại để trống,
// popup sẽ hiện link "Xem nguồn" thay vì cố render và báo lỗi.
// Nhiều bộ OBJ (đặc biệt file export từ Unity, ví dụ gate_1.obj + gate_1.mtl
// trong repo Quicksands) đặt file .mtl CÙNG TÊN, CÙNG THƯ MỤC với file .obj
// — chỉ khác đuôi. Thử suy ra link .mtl theo quy ước đó; nếu không tồn tại,
// ObjModelViewer sẽ tự fallback về vật liệu mặc định (xem catch trong
// MTLLoader.load ở ObjModelViewer.jsx), không có gì hỏng nếu đoán sai.
function deriveSiblingMtlUrl(objModelUrl) {
  if (!objModelUrl) return '';
  if (!/\.obj(\?|#|$)/i.test(objModelUrl)) return '';
  return objModelUrl.replace(/\.obj(\?|#|$)/i, '.mtl$1');
}

function normalizeMapItem(entry, theme, index) {
  const { id: tarPath, value } = entry;
  const rawUrl = typeof value === 'string' ? value.trim() : '';
  const modelUrl = theme.previewable ? resolveDirectModelUrl(rawUrl) : '';
  const mtlUrl = theme.format === 'obj' ? deriveSiblingMtlUrl(modelUrl) : '';

  // Riêng theme Sketchfab: rawUrl là trang xem model (không phải file .glb
  // tải trực tiếp) nên resolveDirectModelUrl() luôn trả về '' cho nó -> phải
  // tách UID và dựng link iframe embed riêng để popup vẫn xem 3D được.
  const sketchfabUid = theme.previewable ? extractSketchfabModelUid(rawUrl) : '';
  const sketchfabEmbedUrl = sketchfabUid ? buildSketchfabEmbedUrl(sketchfabUid) : '';

  return {
    id: `${theme.id}-${index}-${String(tarPath).slice(0, 60)}`,
    title: (rawUrl ? fileNameFromUrl(rawUrl) : tarPath) || tarPath,
    author: theme.name,
    price: 0,
    downloads: 0,
    thumbnail: externalThumbnail(theme.name),
    modelUrl,
    mtlUrl,
    sketchfabEmbedUrl,
    sketchfabUid,
    tags: ['Open Dataset', (theme.format || '').toUpperCase(), theme.name].filter(Boolean),
    isExternal: true,
    sourceUrl: rawUrl || theme.url,
    format: theme.format || '',
    previewable: Boolean(theme.previewable),
    captionKey: String(tarPath || '') || undefined,
  };
}

// ============================================================================
// THUMBNAIL "THẬT" CHO ITEM MAP THEME (GLB/FBX/OBJ/Sketchfab) Ở MÀN HÌNH
// CHÍNH — trước đây card dùng externalThumbnail() (ảnh SVG chữ cái viết tắt,
// không liên quan gì tới model thật). Giờ:
//   - Sketchfab: gọi oEmbed API chính chủ (sketchfab.com/oembed?url=...) lấy
//     thumbnail_url — đây là ảnh chụp thật của model, không phải screenshot
//     tự dựng. Cache theo uid để không gọi lại khi cuộn qua cuộn lại.
//   - GLB: render thẳng <model-viewer> thật (auto-rotate, không
//     camera-controls) làm thumbnail — tức chính là model 3D thật, không
//     phải ảnh tĩnh.
//   - FBX/OBJ: dùng lại AnimatedAvatarViewer/ObjModelViewer thật (cùng
//     viewer popup đang dùng) ở kích thước nhỏ.
// Để không dựng hàng chục 3D viewer cùng lúc (1 trang có thể tới 32 item),
// CHỈ mount viewer thật khi card đã cuộn vào viewport (IntersectionObserver,
// rootMargin đệm trước 200px) và giữ nguyên sau đó (không unmount lại khi
// cuộn ra, tránh tải lại model). Trước khi vào viewport, card hiện tạm ảnh
// placeholder cũ để không bị trống ô.
// ============================================================================
const sketchfabThumbCache = new Map(); // uid -> Promise<string thumbnail_url | ''>
function fetchSketchfabThumbnail(uid) {
  if (!sketchfabThumbCache.has(uid)) {
    sketchfabThumbCache.set(
      uid,
      fetch(`https://sketchfab.com/oembed?url=${encodeURIComponent(`https://sketchfab.com/models/${uid}`)}&format=json`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => (data && typeof data.thumbnail_url === 'string' ? data.thumbnail_url : ''))
        .catch(() => '')
    );
  }
  return sketchfabThumbCache.get(uid);
}

// Thumbnail cho từng dòng trong combobox chủ đề — item nội bộ có ảnh thật
// (thumbnail của vật phẩm đầu tiên trong kho), item ngoài (chưa tải dữ liệu)
// hiện icon đại diện dataset. Cùng kích thước/bo góc/viền để đồng bộ với
// ảnh thumbnail trong thẻ item của lưới bên dưới.
function ThemeThumb({ theme, size = 'w-8 h-8' }) {
  if (theme.thumbnail) {
    return (
      <img
        src={theme.thumbnail}
        alt=""
        className={`${size} rounded-md object-cover border border-white/10 shrink-0 bg-black/40`}
      />
    );
  }
  return (
    <div className={`${size} rounded-md border border-white/10 bg-gradient-to-br from-[#1c2438] to-black flex items-center justify-center text-sm shrink-0`}>
      🗂️
    </div>
  );
}

function AssetCardThumbnail3D({ asset }) {
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [sketchfabThumbUrl, setSketchfabThumbUrl] = useState('');

  // Quan sát 1 lần: khi card lọt vào viewport thì mount viewer thật, sau đó
  // ngắt observer (giữ nguyên viewer, không unmount khi cuộn ra khỏi màn hình).
  useEffect(() => {
    if (inView) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true); // môi trường không hỗ trợ IntersectionObserver -> hiện luôn
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  useEffect(() => {
    if (!inView || !asset.sketchfabUid) return;
    let cancelled = false;
    fetchSketchfabThumbnail(asset.sketchfabUid).then((url) => {
      if (!cancelled) setSketchfabThumbUrl(url);
    });
    return () => { cancelled = true; };
  }, [inView, asset.sketchfabUid]);

  const placeholder = (
    <img src={asset.thumbnail} alt={asset.title} className="w-full h-full object-cover" />
  );

  if (!inView) {
    return <div ref={containerRef} className="w-full h-full">{placeholder}</div>;
  }

  if (asset.sketchfabUid) {
    return (
      <div ref={containerRef} className="w-full h-full">
        {sketchfabThumbUrl ? (
          <img src={sketchfabThumbUrl} alt={asset.title} className="w-full h-full object-cover" />
        ) : (
          placeholder
        )}
      </div>
    );
  }

  if (asset.modelUrl && asset.format === 'glb') {
    return (
      <div ref={containerRef} className="w-full h-full">
        <model-viewer
          src={asset.modelUrl}
          alt={asset.title}
          auto-rotate
          style={{ width: '100%', height: '100%', pointerEvents: 'none', '--poster-color': 'transparent' }}
        ></model-viewer>
      </div>
    );
  }

  if (asset.modelUrl && asset.format === 'fbx') {
    return (
      <div ref={containerRef} className="w-full h-full" style={{ pointerEvents: 'none' }}>
        <AnimatedAvatarViewer modelUrl={asset.modelUrl} modelKind="fbx" isDark autoRotate showGrid={false} showDragHint={false} />
      </div>
    );
  }

  if (asset.modelUrl && asset.format === 'obj') {
    return (
      <div ref={containerRef} className="w-full h-full" style={{ pointerEvents: 'none' }}>
        <ObjModelViewer modelUrl={asset.modelUrl} mtlUrl={asset.mtlUrl} isDark autoRotate showGrid={false} />
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full">{placeholder}</div>;
}


// ============================================================================
// 1. MODULE INDEXED-DB (Lưu trữ vĩnh viễn dữ liệu tài khoản, ví tiền, kho đồ và avatar)
// ============================================================================
const DB_NAME = 'AiDoctor_Store_DB';
const STORE_NAME = 'user_assets_store';
// Store mới: cache JSON đã parse của các theme/URL ngoài (Cap3D captions,
// gobjaverse index, *_map.json...) — sống sót qua F5/đóng mở lại trang, để
// khỏi phải tải+parse lại file nặng mỗi lần vào trang (dataset gần như tĩnh,
// không cần làm mới liên tục). Bump DB_VERSION lên 2 để trigger
// onupgradeneeded tạo thêm store này cho DB cũ đã tồn tại (v1) trên máy
// người dùng.
const JSON_CACHE_STORE_NAME = 'external_json_cache';
const DB_VERSION = 2;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(JSON_CACHE_STORE_NAME)) {
        db.createObjectStore(JSON_CACHE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// storeName mặc định = STORE_NAME (dữ liệu tài khoản) để không phải sửa các
// lời gọi hiện có (coin, unlocked assets); JSON cache dùng lại 2 hàm này với
// storeName = JSON_CACHE_STORE_NAME thay vì viết lặp code IndexedDB riêng.
const saveDataToDB = async (key, value, storeName = STORE_NAME) => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Lỗi lưu IndexedDB:", error);
  }
};

const loadDataFromDB = async (key, defaultValue, storeName = STORE_NAME) => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result !== undefined ? request.result : defaultValue);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Lỗi đọc IndexedDB:", error);
    return defaultValue;
  }
};

// Cache JSON bền vững cho fetchJsonOnce (xem phía trên). defaultValue để
// undefined có chủ đích: đây là cách fetchJsonOnce phân biệt "chưa từng
// cache" (undefined) với "đã cache" (mọi giá trị JSON hợp lệ khác, kể cả
// null/0/false). saveJsonCacheToDB không await/throw ra ngoài — lỗi lưu
// cache (vd Safari private mode chặn IndexedDB) chỉ nên làm mất phần tối ưu
// lâu dài, không được làm hỏng luồng hiển thị dữ liệu hiện tại.
function loadJsonCacheFromDB(url) {
  return loadDataFromDB(url, undefined, JSON_CACHE_STORE_NAME);
}

function saveJsonCacheToDB(url, data) {
  saveDataToDB(url, data, JSON_CACHE_STORE_NAME);
}

// Cấu hình phân trang
const PAGE_SIZE_OPTIONS = [8, 16, 32];

// ============================================================================

export default function MedicalAssetStorePanel() {
  const { updateProfile, user } = useAuth();

  // "Kho đồ" (unlockedAssets) phải lưu riêng theo TỪNG user đang đăng nhập —
  // trước đây key 'unlocked_medical_assets' là CHUNG cho mọi user trên cùng
  // trình duyệt (mọi tài khoản thấy chung 1 kho đồ, sai). Dùng user.uuid làm
  // định danh (đã có sẵn cho mọi loại tài khoản: email/OAuth/guest — xem
  // AuthContext.jsx), fallback về email rồi 'guest' nếu uuid chưa kịp có.
  const userStorageId = user?.uuid || user?.email || 'guest';
  const unlockedAssetsKey = `unlocked_medical_assets_${userStorageId}`;

  // --- STATE MANAGEMENT ---
  const [viewMode, setViewMode] = useState("store"); 
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState("Tất cả");
  const [sortBy, setSortBy] = useState("popular");
  const [previewAsset, setPreviewAsset] = useState(null);

  // --- CHỦ ĐỀ (THEME) COMBOBOX ---
  const [selectedTheme, setSelectedTheme] = useState(INTERNAL_THEME_ID);
  const [externalAssets, setExternalAssets] = useState([]);
  const [externalTotal, setExternalTotal] = useState(0);
  const [themeStatus, setThemeStatus] = useState('idle'); // idle | loading | ok | error
  const [themeError, setThemeError] = useState('');
  
  // States Phân trang
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);

  // Combobox chủ đề tuỳ biến (thay cho <select> gốc) — cần state đóng/mở
  // + ref để bắt click ra ngoài, vì <select> gốc không hiện được thumbnail
  // trong từng option.
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef(null);
  
  // Quản lý dữ liệu người dùng
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [userCoins, setUserCoins] = useState(2500); 
  const [unlockedAssets, setUnlockedAssets] = useState([4, 7]); 
  const [toast, setToast] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('');

  // Cache trong RAM của entries thô (chưa chuẩn hoá) cho theme đang chọn —
  // dùng để "mở rộng cửa sổ" khi phân trang mà KHÔNG cần fetch mạng lại.
  const rawEntriesRef = useRef({ url: '', entries: [], total: 0 });

  // Caption text (Cap3D) cho item đang xem trong popup — chỉ áp dụng cho
  // Nhóm A (Map theme: glb/fbx/obj/sketchfab), tra cứu qua chuỗi
  // tarPath -> gobjaverse index -> objaverse UID -> caption text.
  const [captionStatus, setCaptionStatus] = useState('idle'); // idle | loading | ok | empty
  const [captionText, setCaptionText] = useState('');

  // 1. Tự động load dữ liệu từ IndexedDB — chạy lại mỗi khi user đổi (đăng
  // nhập tài khoản khác) để "Kho đồ" luôn đúng của người đang đăng nhập,
  // không bị lẫn giữa các tài khoản dùng chung trình duyệt. Ví (coins) vẫn
  // dùng chung 1 key toàn cục như trước (không nằm trong yêu cầu đổi lần này).
  useEffect(() => {
    let cancelled = false;
    setIsDbLoaded(false);
    const fetchUserData = async () => {
      const savedCoins = await loadDataFromDB('user_health_coins', 2500);
      const savedAssets = await loadDataFromDB(unlockedAssetsKey, [4, 7]);
      if (cancelled) return;

      setUserCoins(savedCoins);
      setUnlockedAssets(savedAssets);
      setIsDbLoaded(true);
    };
    fetchUserData();
    return () => { cancelled = true; };
  }, [unlockedAssetsKey]);

  // 2. Load thư viện Google Model Viewer
  useEffect(() => {
    const scriptId = 'google-model-viewer-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'module';
      script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';
      document.body.appendChild(script);
    }
  }, []);

  // 3. Reset phân trang về Trang 1 khi điều kiện lọc thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTag, sortBy, viewMode, pageSize, selectedTheme]);

  // 3b. Đóng dropdown chủ đề khi click ra ngoài
  useEffect(() => {
    if (!themeMenuOpen) return;
    const handleClickOutside = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [themeMenuOpen]);

  // 4. Tải dữ liệu chủ đề (theme) đang chọn trong combobox — nếu là chủ đề
  // ngoài (1 trong 4 link .json của gobjaverse) thì fetch (có cache), sau đó
  // chỉ CHUẨN HOÁ đủ 1 trang + vài trang đệm (xem PREFETCH_PAGES phía trên)
  // thay vì luôn dựng cứng 100 mục; chủ đề nội bộ dùng luôn
  // medical_3d_market.json đã import sẵn.
  useEffect(() => {
    if (selectedTheme === INTERNAL_THEME_ID) {
      setThemeStatus('ok');
      setThemeError('');
      setExternalAssets([]);
      setExternalTotal(0);
      setSelectedTag('Tất cả');
      rawEntriesRef.current = { url: '', entries: [], total: 0 };
      return;
    }
    const theme = EXTERNAL_THEMES.find((t) => t.id === selectedTheme);
    if (!theme) return;

    let cancelled = false;
    setThemeStatus('loading');
    setThemeError('');
    setSelectedTag('Tất cả');

    loadThemeEntries(theme)
      .then(({ entries, total }) => {
        if (cancelled) return;
        rawEntriesRef.current = { url: theme.url, entries, total };
        // Vừa đổi theme -> trang sẽ reset về 1 (effect #3 bên dưới), nên chỉ
        // cần chuẩn hoá đủ cho trang 1 + đệm.
        const count = computeNeededPreviewCount(pageSize, 1, total);
        setExternalAssets(normalizeEntriesSlice(entries, theme, count));
        setExternalTotal(total);
        setThemeStatus('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        rawEntriesRef.current = { url: '', entries: [], total: 0 };
        setExternalAssets([]);
        setExternalTotal(0);
        setThemeStatus('error');
        setThemeError(err?.message || 'Không thể tải dữ liệu');
      });

    return () => { cancelled = true; };
  }, [selectedTheme]);

  // 4b. Khi người dùng đổi cỡ trang hoặc chuyển sang trang cần nhiều mục hơn
  // "cửa sổ" đã chuẩn hoá hiện tại, chỉ re-slice + normalize thêm từ entries
  // đã cache trong rawEntriesRef (không gọi mạng lại) — thao tác rẻ vì dữ
  // liệu thô đã có sẵn trong RAM.
  useEffect(() => {
    if (selectedTheme === INTERNAL_THEME_ID) return;
    const { entries, total, url } = rawEntriesRef.current;
    const theme = EXTERNAL_THEMES.find((t) => t.id === selectedTheme);
    if (!theme || theme.url !== url || !total) return; // chưa sẵn sàng / đang tải theme khác

    const neededCount = computeNeededPreviewCount(pageSize, currentPage, total);
    setExternalAssets((prev) => (neededCount > prev.length ? normalizeEntriesSlice(entries, theme, neededCount) : prev));
  }, [currentPage, pageSize, selectedTheme]);

  // 5. Tra cứu caption text (Cap3D) mỗi khi mở popup cho 1 item Nhóm A/B có
  // gắn captionKey/captionUid — chạy pipeline captionKey/UID -> caption.
  // Nếu item đã có sẵn caption (theme "Cap3D Text Captions" — value chính là
  // caption) thì hiện luôn, không cần fetch lại.
  useEffect(() => {
    if (!previewAsset) {
      setCaptionStatus('idle');
      setCaptionText('');
      return;
    }
    if (previewAsset.presetCaption) {
      setCaptionText(previewAsset.presetCaption);
      setCaptionStatus('ok');
      return;
    }
    if (!previewAsset.captionKey && !previewAsset.captionUid) {
      setCaptionStatus('idle');
      setCaptionText('');
      return;
    }

    let cancelled = false;
    setCaptionStatus('loading');
    setCaptionText('');

    resolveCaptionForAsset(previewAsset).then((caption) => {
      if (cancelled) return;
      if (caption) {
        setCaptionText(caption);
        setCaptionStatus('ok');
      } else {
        setCaptionStatus('empty');
      }
    }).catch(() => {
      if (cancelled) return;
      setCaptionStatus('empty');
    });

    return () => { cancelled = true; };
  }, [previewAsset]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --- LOGIC MUA / MỞ KHÓA TÀI NGUYÊN ---
  const handleUnlockAsset = async (asset) => {
    if (unlockedAssets.includes(asset.id)) {
      showToast(`Đang tải xuống tệp nguồn "${asset.title}"...`, 'info');
      return;
    }

    if (userCoins < asset.price) {
      showToast("Bạn không đủ Health Coins! Hãy kiếm thêm từ các Hành trình sức khỏe.", "error");
      return;
    }

    const newCoins = userCoins - asset.price;
    const newUnlocked = [...unlockedAssets, asset.id];
    
    setUserCoins(newCoins);
    setUnlockedAssets(newUnlocked);
    
    await saveDataToDB('user_health_coins', newCoins);
    await saveDataToDB(unlockedAssetsKey, newUnlocked);
    
    showToast(`Đã lưu "${asset.title}" vào Kho đồ cá nhân!`, "success");
  };

  // --- LOGIC THIẾT LẬP AVATAR HỒ SƠ ---
  const handleSetAsAvatar = async (asset) => {
    if (!asset) return;
    
    setSaving(true);
    try {
      await saveDataToDB('user_current_avatar_asset', asset);

      // modelKind: cùng cách phân loại đang dùng ở modal xem trước phía trên
      // (previewAsset.format === 'fbx' | 'obj' | mặc định glb/gltf) — lưu lại
      // để màn hình Profile biết dùng đúng viewer 3D (AnimatedAvatarViewer
      // hay ObjModelViewer) khi hiển thị avatar hồ sơ thật.
      const modelKind = asset.format === 'fbx' ? 'fbx' : asset.format === 'obj' ? 'obj' : 'gltf';

      updateProfile({
        avatar: asset.thumbnail,
        avatarCustomized: true,
        openSourceAvatar: {
          id: asset.id,
          name: asset.title,
          collectionId: 'medical_asset_store',
          collectionName: 'Medical 3D Store',
          license: 'Purchased Asset',
          thumbnailUrl: asset.thumbnail || '',
          modelFileUrl: asset.modelUrl || '',
          mtlUrl: asset.mtlUrl || '',
          format: asset.format || 'glb',
          modelKind,
          source: 'internal_store',
        },
      });
      
      setSaveNote('Đã lưu làm avatar hồ sơ!');
      showToast(`✨ Đã thiết lập thành công "${asset.title}" làm hình đại diện!`, "success");
      
      setTimeout(() => {
        setSaving(false);
        setSaveNote('');
        setPreviewAsset(null); 
      }, 1500);

    } catch (err) {
      console.error("Lỗi thiết lập avatar:", err);
      showToast("Không thể thiết lập avatar, vui lòng thử lại.", "error");
      setSaving(false);
    }
  };

  const isInternalTheme = selectedTheme === INTERNAL_THEME_ID;
  const activeThemeData = isInternalTheme ? INTERNAL_MARKET_DATA : externalAssets;
  const activeThemeMeta = isInternalTheme
    ? { id: INTERNAL_THEME_ID, name: 'Kho Y Tế (Nội bộ)', license: 'Consensus Doctor' }
    : EXTERNAL_THEMES.find((t) => t.id === selectedTheme);

  // Số hiện trên tab "🛒 Chợ Mua Sắm" phải là TỔNG số lượng thật của cả
  // dataset đang chọn — với theme ngoài, activeThemeData (externalAssets)
  // chỉ là CỬA SỔ đã chuẩn hoá trong RAM (xem PREFETCH_PAGES phía trên),
  // dùng externalTotal (vài trăm nghìn mục từ gobjaverse) mới đúng, không
  // phải activeThemeData.length (luôn bị khoá cứng ở vài chục mục).
  const storeItemCount = isInternalTheme ? activeThemeData.length : (externalTotal || activeThemeData.length);

  const quickCategories = isInternalTheme
    ? ["Tất cả", "3D Model", "In 3D", "Digital Twin", "Avatar VRM", "Gamification"]
    : ["Tất cả", "Open Dataset", activeThemeMeta?.name].filter(Boolean);

  // --- LỌC DỮ LIỆU ---
  const filteredAssets = activeThemeData
    .filter(asset => {
      if (viewMode === "inventory" && !unlockedAssets.includes(asset.id)) {
        return false;
      }
      const matchesSearch = 
        asset.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.presetCaption || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesTab = selectedTag === "Tất cả" || asset.tags.includes(selectedTag);
      return matchesSearch && matchesTab;
    })
    .sort((a, b) => {
      if (sortBy === "popular") return b.downloads - a.downloads;
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      return 0;
    });

  // --- TÍNH TOÁN PHÂN TRANG ---
  // BUG đã sửa: trước đây totalPages tính bằng filteredAssets.length — với
  // theme ngoài, filteredAssets chỉ là CỬA SỔ đã "chuẩn hoá" vào RAM
  // (externalAssets, xem PREFETCH_PAGES phía trên), không phải toàn bộ
  // dataset. Kết quả là tổng số trang luôn bị khoá cứng ở khoảng
  // (1 + PREFETCH_PAGES) trang, nút "Trang sau" bị disable ngay cả khi
  // dataset còn hàng trăm nghìn mục chưa xem tới.
  //
  // Đúng ra: khi KHÔNG lọc/tìm kiếm, tổng số trang phải phản ánh toàn bộ
  // externalTotal — vì effect #4b (dòng ~760) đã lo việc tự mở rộng cửa sổ
  // RAM (re-slice từ entries thô đã cache, không tải mạng lại) mỗi khi
  // currentPage vượt quá phần đã chuẩn hoá. Khi ĐANG lọc/tìm kiếm thì khác:
  // ta chỉ biết được kết quả trong phạm vi cửa sổ đã tải (đúng như ghi chú
  // "Tìm kiếm chỉ áp dụng trong số này" ở ô search), nên totalPages vẫn
  // phải dựa trên filteredAssets.length trong trường hợp này.
  const isFiltering = Boolean(searchTerm) || selectedTag !== "Tất cả";
  const totalCount = (!isInternalTheme && !isFiltering) ? externalTotal : filteredAssets.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  // Cắt mảng dữ liệu để lấy đúng số lượng item của trang hiện tại
  const pagedAssets = filteredAssets.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Vừa chuyển sang 1 trang mà cửa sổ RAM chưa kịp mở rộng tới (effect #4b
  // chạy sau khi currentPage đổi) -> đừng hiện "Không tìm thấy", chỉ là
  // đang chờ 1 nhịp render để normalize thêm từ entries đã cache sẵn.
  const isWindowCatchingUp = !isInternalTheme && !isFiltering && pagedAssets.length === 0 && totalCount > 0;

  // Số trang đã "chuẩn hoá" sẵn trong RAM (xem PREFETCH_PAGES phía trên) —
  // dùng để hiện các nút số trang mà bấm vào là có ngay, không phải chờ
  // "Đang tải thêm dữ liệu cho trang này...". Với theme nội bộ hoặc đang
  // lọc/tìm kiếm thì toàn bộ filteredAssets đã có sẵn, nên coi như đã tải
  // hết (loadedPageCount = totalPages).
  const loadedItemCount = (isInternalTheme || isFiltering) ? totalCount : externalAssets.length;
  const loadedPageCount = Math.min(totalPages, Math.max(safePage, Math.ceil(loadedItemCount / pageSize)));

  // Danh sách số trang sẽ hiện dưới dạng nút bấm: dải trang đã tải quanh
  // trang hiện tại (safePage .. loadedPageCount) — bấm vào có dữ liệu
  // ngay, không phải chờ "Đang tải thêm dữ liệu...". Trang 1 (đầu) và
  // trang cuối (totalPages) luôn có nút riêng (ChevronsLeft/Right) để
  // nhảy nhanh dù chưa nằm trong cửa sổ đã tải.
  const loadedPageNumbers = [];
  for (let p = safePage; p <= loadedPageCount; p++) loadedPageNumbers.push(p);

  if (!isDbLoaded) {
    return <div className="p-6 text-center text-white h-full flex items-center justify-center font-mono tracking-widest">ĐANG TẢI DỮ LIỆU Y TẾ AN TOÀN...</div>;
  }

  return (
    <div className="p-6 min-h-screen text-gray-200 w-full rounded-xl bg-[#04060f] relative font-sans animate-fade">
      
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[110] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md border border-white/10 text-sm font-semibold transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-500/90 text-white shadow-emerald-500/20' :
          toast.type === 'error' ? 'bg-rose-500/90 text-white shadow-rose-500/20' : 'bg-blue-500/90 text-white shadow-blue-500/20'
        }`}>
          <span>{toast.type === 'success' ? '🎉' : toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
          {toast.message}
        </div>
      )}

      {/* HEADER STORE & VÍ TIỀN */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#00e5ff] to-[#9c6fff] bg-clip-text text-transparent">
            {viewMode === "store" ? "Chợ Tài Nguyên Y Tế v4" : "Kho Đồ Sinh Học Của Tôi"}
          </h1>
          <p className="text-gray-400 mt-1 text-sm max-w-xl">
            {viewMode === "store" 
              ? "Khám phá cấu trúc giải phẫu 3D, tệp tin in mô hình sinh học STL hoặc đổi thiết kế Avatar." 
              : `Hệ thống ghi nhận bạn đang sở hữu ${unlockedAssets.length} tài nguyên số được bảo mật lâu dài.`}
          </p>
        </div>
        
        {/* TIỀN XU */}
        <div className="flex items-center gap-3 bg-black/40 px-5 py-2.5 rounded-xl border border-[#ffb74d]/30 shadow-[0_0_15px_rgba(255,183,77,0.1)] shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-black font-black text-lg shadow-inner">
            🪙
          </div>
          <div>
            <div className="text-[10px] text-amber-400 uppercase tracking-widest font-mono font-bold">Số dư của bạn</div>
            <div className="text-xl font-black text-white font-mono">{userCoins.toLocaleString()} <span className="text-xs text-amber-300">Coins</span></div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/10 w-full sm:w-fit mb-8 mx-auto sm:mx-0 shadow-inner">
        <button 
          onClick={() => setViewMode("store")}
          className={`flex-1 sm:px-8 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
            viewMode === "store" 
              ? 'bg-gradient-to-r from-[#00e5ff] to-[#00b8cc] text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          🛒 Chợ Mua Sắm 
          <span className={`px-2 py-0.5 rounded-md text-[10px] ${viewMode === "store" ? "bg-black/20 text-black" : "bg-white/20 text-gray-300"}`}>
            {storeItemCount.toLocaleString()}
          </span>
        </button>
        <button 
          onClick={() => setViewMode("inventory")}
          className={`flex-1 sm:px-8 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
            viewMode === "inventory" 
              ? 'bg-gradient-to-r from-[#9c6fff] to-[#804dee] text-white shadow-[0_0_15px_rgba(156,111,255,0.4)]' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          🎒 Kho Đồ 
          <span className={`px-2 py-0.5 rounded-md text-[10px] ${viewMode === "inventory" ? "bg-white/20 text-white" : "bg-white/20 text-gray-300"}`}>
            {unlockedAssets.length}
          </span>
        </button>
      </div>

      {/* SEARCH BAR & FILTER OPTIONS */}
      <div className="flex flex-col gap-4 mb-6 bg-white/5 p-4 rounded-xl border border-white/5">

        {/* CHỦ ĐỀ COMBOBOX — item đầu tiên là kho nội bộ, 4 item sau lấy từ
            4 link .json trong README của modelscope/richdreamer (gobjaverse) */}
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Chủ đề (projects.json):</span>

          {/* Combobox tuỳ biến — thay cho <select> gốc để hiện được thumbnail
              thật cho item nội bộ (đầu tiên), nhất quán với ảnh thumbnail
              của các thẻ item trong lưới bên dưới. */}
          <div className="relative w-full md:w-[26rem]" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setThemeMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={themeMenuOpen}
              className="w-full flex items-center gap-2.5 bg-black/50 border border-white/10 text-white pl-2 pr-3 py-1.5 rounded-lg text-sm focus:ring-1 focus:ring-[#00e5ff] focus:outline-none cursor-pointer hover:border-[#00e5ff]/40 transition-colors"
            >
              <ThemeThumb theme={THEME_OPTIONS.find((t) => t.id === selectedTheme) || THEME_OPTIONS[0]} />
              <span className="flex-1 text-left truncate">
                {(THEME_OPTIONS.find((t) => t.id === selectedTheme) || THEME_OPTIONS[0]).name}
                <span className="text-gray-500"> · {(THEME_OPTIONS.find((t) => t.id === selectedTheme) || THEME_OPTIONS[0]).license}</span>
              </span>
              <ChevronRight size={14} className={`shrink-0 text-gray-500 transition-transform ${themeMenuOpen ? '-rotate-90' : 'rotate-90'}`} />
            </button>

            {themeMenuOpen && (
              <div
                role="listbox"
                className="absolute z-20 mt-1.5 w-full bg-[#0a0e1a] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
              >
                {THEME_OPTIONS.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    role="option"
                    aria-selected={theme.id === selectedTheme}
                    onClick={() => {
                      setSelectedTheme(theme.id);
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-left transition-colors ${
                      theme.id === selectedTheme
                        ? 'bg-[#00e5ff]/10 text-[#00e5ff]'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <ThemeThumb theme={theme} />
                    <span className="flex-1 truncate">
                      {theme.name}
                      <span className="block text-[11px] text-gray-500 truncate">{theme.license}</span>
                    </span>
                    {theme.id === selectedTheme && <span className="text-[#00e5ff] text-xs">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isInternalTheme && themeStatus === 'loading' && (
            <span className="text-[11px] text-amber-400 font-mono">⏳ Đang tải {activeThemeMeta?.name}...</span>
          )}
          {!isInternalTheme && themeStatus === 'ok' && (
            <span className="text-[11px] text-emerald-400 font-mono">
              ✓ Đã tải {externalAssets.length}/{externalTotal.toLocaleString()} mục (tự mở rộng khi chuyển trang)
              {externalAssets.length < externalTotal && ' · Tìm kiếm chỉ áp dụng trong số này'}
            </span>
          )}
          {!isInternalTheme && themeStatus === 'error' && (
            <span className="text-[11px] text-rose-400 font-mono" title={activeThemeMeta?.url}>
              ⚠️ Không tải được: {themeError}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
            <input
              type="text"
              placeholder="Tìm kiếm cấu trúc, tác giả, tag..."
              className="w-full pl-9 pr-9 py-2 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00e5ff] bg-black/40 text-white placeholder-gray-500 text-sm transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label="Xoá tìm kiếm"
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
            {/* Nhóm B/A (theme ngoài) có thể có tới hàng trăm nghìn mục, nhưng
            chỉ 1 phần đã được "chuẩn hoá" vào externalAssets (xem
            PREFETCH_PAGES). Search chạy trên phần đã tải này, KHÔNG quét lại
            toàn bộ dataset — ghi chú ngay dưới ô search để người dùng không
            hiểu nhầm "không có kết quả" thành dataset thiếu dữ liệu. */}
            {!isInternalTheme && searchTerm && externalAssets.length < externalTotal && (
              <p className="absolute left-1 top-full mt-1 text-[10px] text-gray-500 italic leading-snug">
                Chỉ tìm trong {externalAssets.length.toLocaleString()}/{externalTotal.toLocaleString()} mục đã tải — chuyển sang trang cuối để mở rộng cửa sổ tìm kiếm.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Sắp xếp:</span>
            <select
              className="bg-black/50 border border-white/10 text-white px-3 py-1.5 rounded-lg text-sm focus:ring-1 focus:ring-[#00e5ff] focus:outline-none cursor-pointer"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="popular">🔥 Lượt tải nhiều nhất</option>
              <option value="price-low">🪙 Giá: Thấp đến Cao</option>
              <option value="price-high">🪙 Giá: Cao đến Thấp</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {quickCategories.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide border whitespace-nowrap transition-all ${
                selectedTag === tag
                  ? 'bg-gradient-to-r from-[#00e5ff] to-[#00b8cc] text-black border-transparent shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* HIỂN THỊ SỐ LƯỢNG ITEM */}
      <div className="text-xs text-gray-400 mb-4 font-mono">
        Tìm thấy <strong className="text-[#00e5ff]">{filteredAssets.length}</strong> tài nguyên
      </div>

      {/* ASSET ITEMS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
        {pagedAssets.map((asset) => {
          const isOwned = unlockedAssets.includes(asset.id);
          
          return (
            <div 
              key={asset.id} 
              className="bg-gradient-to-b from-white/10 to-white/5 rounded-2xl shadow-xl hover:shadow-[0_15px_30px_rgba(0,229,255,0.15)] transition-all duration-300 border border-white/10 flex flex-col overflow-hidden group group-hover:border-[#00e5ff]/40"
            >
              <div className="relative h-48 bg-black/40 overflow-hidden cursor-pointer">
                {asset.previewable && (asset.modelUrl || asset.sketchfabUid) ? (
                  <div className="w-full h-full transition-transform duration-500 group-hover:scale-105">
                    <AssetCardThumbnail3D asset={asset} />
                  </div>
                ) : (
                  <img
                    src={asset.thumbnail}
                    alt={asset.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onClick={() => setPreviewAsset(asset)}
                  />
                )}
                <div 
                  onClick={() => setPreviewAsset(asset)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-xs font-bold tracking-wider text-[#00e5ff] gap-1.5"
                >
                  <span>👁️</span> XEM TƯƠNG TÁC 3D
                </div>
                
                {viewMode === "store" && isOwned && (
                  <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[10px] font-black px-2 py-1 rounded shadow-md z-10">
                    ĐÃ SỞ HỮU
                  </div>
                )}

                <div className="absolute bottom-2 left-2 flex gap-1 flex-wrap max-w-[90%]">
                  {asset.tags.slice(0, 2).map((tag, idx) => (
                    <span key={idx} className="bg-black/70 text-[10px] text-white font-semibold px-2 py-0.5 rounded backdrop-blur-md border border-white/5">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 flex flex-col flex-grow">
                <h3 
                  onClick={() => setPreviewAsset(asset)}
                  className="font-bold text-base text-white line-clamp-2 mb-1.5 cursor-pointer hover:text-[#00e5ff] transition-colors" 
                  title={asset.title}
                >
                  {asset.title}
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  tác giả <span className="font-semibold text-gray-300 cursor-pointer hover:underline">{asset.author}</span>
                </p>

                <div className="mt-auto pt-3 border-t border-white/10 flex justify-between items-center font-mono">
                  {viewMode === "store" ? (
                    <div className={`flex items-center font-bold text-sm ${asset.price === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      <span className="mr-1">{asset.price === 0 ? '🎁' : '🪙'}</span>
                      {asset.price === 0 ? "Miễn phí" : `${asset.price.toLocaleString()} Coins`}
                    </div>
                  ) : (
                    <div className="flex items-center font-bold text-sm text-purple-400">
                      <span className="mr-1">💼</span> Trong kho lưu trữ
                    </div>
                  )}

                  <div className="flex items-center text-xs text-gray-400 font-medium">
                    <span className="mr-1">📥</span>{asset.downloads.toLocaleString()}
                  </div>
                </div>
              </div>
              
              <div className="px-4 pb-4">
                 <button 
                    onClick={() => {
                      if (isOwned) {
                        setPreviewAsset(asset);
                      } else {
                        handleUnlockAsset(asset);
                      }
                    }}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all duration-300 border flex justify-center items-center gap-1.5 ${
                      isOwned 
                        ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 hover:bg-purple-600 hover:text-white hover:border-transparent shadow-lg shadow-purple-500/5'
                        : asset.price === 0 
                        ? 'bg-transparent border-[#00e5ff] text-[#00e5ff] hover:bg-[#00e5ff] hover:text-black'
                        : 'bg-transparent border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black'
                    }`}
                 >
                    {isOwned ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        Ứng Dụng Vật Phẩm
                      </>
                    ) : (
                      asset.price === 0 ? "Tải miễn phí" : `Mở khóa vật phẩm`
                    )}
                 </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* PAGINATION CONTROLS (Thanh Điều Khiển Phân Trang) */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 mb-8 bg-white/5 p-4 rounded-xl border border-white/5 gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs text-gray-400 font-mono uppercase tracking-widest whitespace-nowrap">Hiển thị</span>
            <select
              className="bg-black/50 border border-white/10 text-white px-3 py-1.5 rounded-lg text-sm focus:ring-1 focus:ring-[#00e5ff] focus:outline-none cursor-pointer w-full sm:w-auto"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size} / trang</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Trang đầu */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage <= 1}
              title="Trang đầu"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/40 text-gray-400 hover:text-[#00e5ff] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronsLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              title="Trang trước"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/40 text-gray-400 hover:text-[#00e5ff] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={18} />
            </button>

            {/* Các số trang ĐÃ TẢI SẴN (safePage..loadedPageCount) — bấm vào
                là có dữ liệu ngay, không phải chờ "Đang tải thêm..." */}
            <div className="flex items-center gap-1.5 px-1">
              {loadedPageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  title={p === safePage ? undefined : `Đã tải sẵn — đi tới trang ${p}`}
                  className={`min-w-[2.25rem] h-10 px-2 flex items-center justify-center rounded-xl border text-sm font-mono transition-all ${
                    p === safePage
                      ? 'border-[#00e5ff] bg-[#00e5ff]/10 text-[#00e5ff]'
                      : 'border-white/10 bg-black/40 text-gray-400 hover:text-[#00e5ff] hover:bg-white/10'
                  }`}
                >
                  {p}
                </button>
              ))}
              {loadedPageCount < totalPages && (
                <span className="text-gray-600 text-sm px-1 select-none">…</span>
              )}
            </div>

            <span className="text-xs font-mono text-gray-500 tracking-widest whitespace-nowrap">
              / {totalPages} trang
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              title="Trang sau"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/40 text-gray-400 hover:text-[#00e5ff] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={18} />
            </button>
            {/* Trang cuối */}
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage >= totalPages}
              title="Trang cuối"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/40 text-gray-400 hover:text-[#00e5ff] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronsRight size={18} />
            </button>
          </div>
        </div>
      )}
      
      {/* EMPTY STATE CONTAINER */}
      {pagedAssets.length === 0 && isWindowCatchingUp && (
        <div className="text-center py-24 text-gray-500 border border-dashed border-gray-700 rounded-2xl bg-gray-900/20">
          <span className="text-4xl block mb-2">⏳</span>
          <p className="text-lg font-medium">Đang tải thêm dữ liệu cho trang này...</p>
          <p className="text-sm text-gray-600 mt-1">Cửa sổ dữ liệu đang mở rộng để bắt kịp trang bạn vừa chuyển tới.</p>
        </div>
      )}
      {pagedAssets.length === 0 && !isWindowCatchingUp && (
        <div className="text-center py-24 text-gray-500 border border-dashed border-gray-700 rounded-2xl bg-gray-900/20">
          <span className="text-4xl block mb-2">{viewMode === "inventory" ? "🎒" : "🔍"}</span>
          <p className="text-lg font-medium">
            {viewMode === "inventory" ? "Kho đồ sinh học đang trống." : "Không tìm thấy tài nguyên phù hợp."}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {viewMode === "inventory" ? "Hãy truy cập Chợ Mua Sắm để trang bị các mô hình 3D cao cấp nhé!" : "Thử tìm kiếm theo nhãn tag như 'In 3D', 'Avatar'..."}
          </p>
        </div>
      )}

      {/* POPUP MODAL DETAIL */}
      {previewAsset && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade">
          <div className="bg-[#0b101d] text-white rounded-2xl border border-cyan-500/20 max-w-3xl w-full p-6 relative shadow-[0_0_60px_rgba(0,229,255,0.15)] flex flex-col h-[85vh]">
            
            <button 
              onClick={() => setPreviewAsset(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-colors text-lg z-10"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold text-white pr-8 mb-1 tracking-tight">{previewAsset.title}</h2>

            {(previewAsset.captionKey || previewAsset.captionUid || previewAsset.presetCaption) ? (
              <p className="text-xs text-gray-400 italic mb-4 leading-relaxed">
                {captionStatus === 'loading' && '⏳ Đang tra caption (Cap3D)...'}
                {captionStatus === 'ok' && `“${captionText}”`}
                {captionStatus === 'empty' && 'Không tìm thấy caption cho vật thể này trong Cap3D.'}
              </p>
            ) : (
              <div className="mb-4" />
            )}

            <div className="flex-grow bg-black/40 rounded-xl relative overflow-hidden border border-white/5 flex items-center justify-center shadow-inner">
              {previewAsset.modelUrl && previewAsset.format === 'fbx' ? (
                // <model-viewer> (Google) chỉ đọc glTF/GLB, không đọc được FBX.
                // Dùng lại AnimatedAvatarViewer (THREE.FBXLoader thật +
                // OrbitControls) — cùng viewer đang chạy cho hoạt ảnh avatar —
                // để xem 3D thật thay vì rơi vào fallback text.
                <AnimatedAvatarViewer
                  modelUrl={previewAsset.modelUrl}
                  modelKind="fbx"
                  isDark
                  autoRotate
                  showGrid={false}
                  showDragHint={false}
                />
              ) : previewAsset.modelUrl && previewAsset.format === 'obj' ? (
                // <model-viewer> cũng không đọc được OBJ -> dùng ObjModelViewer
                // (THREE.OBJLoader thật + OrbitControls). OBJ không có .mtl đi
                // kèm trong obj_map.json nên mesh hiện bằng vật liệu mặc định
                // (không phải lỗi tải, chỉ là thiếu thông tin màu/texture).
                <ObjModelViewer modelUrl={previewAsset.modelUrl} mtlUrl={previewAsset.mtlUrl} isDark autoRotate showGrid={false} />
              ) : previewAsset.modelUrl ? (
                <model-viewer
                  src={previewAsset.modelUrl}
                  alt={previewAsset.title}
                  auto-rotate
                  camera-controls
                  touch-action="pan-y"
                  style={{ width: '100%', height: '100%', '--poster-color': 'transparent', outline: 'none' }}
                ></model-viewer>
              ) : previewAsset.sketchfabEmbedUrl ? (
                // sketchfab_map.json trỏ tới trang xem model, không phải file
                // .glb tải trực tiếp -> <model-viewer> không đọc được. Dùng
                // iframe embed chính chủ của Sketchfab thay thế (vẫn xoay/zoom
                // 3D thật, chỉ khác là chạy trong iframe của Sketchfab).
                <iframe
                  title={previewAsset.title}
                  src={previewAsset.sketchfabEmbedUrl}
                  frameBorder="0"
                  allow="autoplay; fullscreen; xr-spatial-tracking"
                  allowFullScreen
                  style={{ width: '100%', height: '100%', border: 'none' }}
                ></iframe>
              ) : (
                <div className="text-center p-6 max-w-sm">
                  <span className="text-5xl mb-3 block">{previewAsset.isExternal ? '🗂️' : '📜'}</span>
                  <h4 className="font-bold text-sm text-gray-200 mb-1">
                    {previewAsset.isExternal ? 'Bản ghi dữ liệu mở (Open Dataset)' : 'Gói Logic Sức Khỏe'}
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {previewAsset.isExternal
                      ? 'Mục này đến từ tập dữ liệu JSON mở (gobjaverse/Objaverse), không có model 3D xem trực tiếp được.'
                      : 'Tài nguyên là hệ thống trò chơi và danh sách nhiệm vụ, không bao gồm cấu trúc hình học tĩnh.'}
                  </p>

                </div>
              )}
            </div>

            <div className="grid grid-cols-3 text-center border-t border-b border-white/5 py-3 my-4 text-xs font-mono text-gray-400">
              <div>Tác giả: <span className="text-cyan-400 font-semibold">{previewAsset.author}</span></div>
              <div>Tệp tin: <span className="text-purple-400 font-semibold">{previewAsset.modelUrl ? (previewAsset.format === 'fbx' ? 'fbx' : previewAsset.format === 'obj' ? 'obj' : 'glb') : previewAsset.sketchfabEmbedUrl ? 'sketchfab' : 'json'}</span></div>
              <div>Lượt tải: <span className="text-amber-400 font-semibold">{previewAsset.downloads.toLocaleString()}</span></div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              
              <div className="w-full sm:w-auto flex flex-col items-center sm:items-start gap-1">
                {unlockedAssets.includes(previewAsset.id) ? (
                  <>
                    <button
                      onClick={() => handleSetAsAvatar(previewAsset)}
                      disabled={saving}
                      style={{ 
                        background: 'linear-gradient(135deg, #00e5ff, #00e676)',
                        color: '#001018'
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-black text-xs tracking-wider flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-wait"
                    >
                      {saving ? (
                        "Đang lưu..."
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          Dùng làm avatar hồ sơ
                        </>
                      )}
                    </button>
                    {saveNote && <div className="text-[#00e676] text-[11px] font-bold text-center sm:text-left mt-1 w-full">{saveNote}</div>}
                  </>
                ) : (
                  <div className="text-xs font-mono text-gray-500 italic pl-1">
                    Mở khóa tài nguyên để kích hoạt Avatar hồ sơ
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button 
                  onClick={() => handleUnlockAsset(previewAsset)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold font-mono border flex items-center justify-center gap-1.5 transition-all ${
                    unlockedAssets.includes(previewAsset.id)
                      ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                      : 'bg-amber-500 border-transparent text-black hover:brightness-110 shadow-lg shadow-amber-500/10'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  {unlockedAssets.includes(previewAsset.id) ? "Tải về nguồn" : `Mở khóa (${previewAsset.price} Xu)`}
                </button>
                
                <button 
                  onClick={() => setPreviewAsset(null)} 
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl font-bold text-xs tracking-wide uppercase transition-colors"
                >
                  Đóng
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}