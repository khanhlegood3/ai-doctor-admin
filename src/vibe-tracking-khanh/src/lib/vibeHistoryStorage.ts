import { saveRecord, getAllRecords, fileToDataUrl } from '../../../lib/medicalStorage.js';
import { notifyUpload } from '../../../hooks/useMedicalData.js';
import { uploadKolFileToR2 } from '../../../components/health-games/remixKol/kolYoutubeFetchClient.js';

export const VIBE_HISTORY_SOURCE_MODULE = 'vibe-tracking';
export type VibeHistoryKind = 'emotion' | 'sign';

export interface VibeHistoryRecord {
  id: string;
  title: string;
  kind: VibeHistoryKind;
  uploadedAt: string;
  filename: string;
  name?: string;
  mimeType: string;
  size: number;
  fileType: 'video';
  type: 'video';
  dataUrl?: string;
  r2Url?: string;
  videoUrl?: string;
  analysisSummary?: string;
  analysisDetails?: string;
  analysisText?: string;
  sourceModule: string;
  ownerUuid?: string | null;
  ownerEmail?: string;
  ownerName?: string;
}

function readCurrentUser(): any {
  try {
    const session = JSON.parse(localStorage.getItem('cdoc_session') || 'null');
    if (session?.email) {
      const users = JSON.parse(localStorage.getItem('cdoc_users') || '{}');
      if (users?.[session.email]) return users[session.email];
    }
  } catch {}
  return null;
}

function genId(kind: VibeHistoryKind) {
  return `vibe_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function startVideoRecorder(video: HTMLVideoElement | null): MediaRecorder | null {
  const stream = (video?.srcObject as MediaStream | null) || (video as any)?.captureStream?.() || (video as any)?.mozCaptureStream?.();
  if (!stream || typeof MediaRecorder === 'undefined') return null;
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  return new MediaRecorder(stream, { mimeType });
}

export async function saveVibeHistory(params: { kind: VibeHistoryKind; blob?: Blob | null; summary?: string; details?: string; }) {
  const user = readCurrentUser();
  const uploadedAt = new Date().toISOString();
  const titlePrefix = params.kind === 'sign' ? 'AI Sign Language Translator' : 'AI Professor Assistant';
  const filename = `${params.kind}-${uploadedAt.replace(/[:.]/g, '-')}.webm`;
  const videoFile = params.blob && params.blob.size > 0 ? new File([params.blob], filename, { type: params.blob.type || 'video/webm' }) : null;
  const localDataUrl = videoFile ? await fileToDataUrl(videoFile) : '';
  const analysisSummary = params.summary || 'Chưa có phân tích.';
  const analysisDetails = params.details || '';
  const record: VibeHistoryRecord = {
    id: genId(params.kind),
    title: `${titlePrefix} · ${new Date(uploadedAt).toLocaleString()}`,
    kind: params.kind,
    uploadedAt,
    filename,
    name: filename,
    fileType: 'video',
    type: 'video',
    mimeType: videoFile?.type || params.blob?.type || 'video/webm',
    size: videoFile?.size || params.blob?.size || 0,
    dataUrl: localDataUrl,
    r2Url: '',
    videoUrl: localDataUrl,
    analysisSummary,
    analysisDetails,
    analysisText: [analysisSummary, analysisDetails].filter(Boolean).join('\n\n'),
    sourceModule: VIBE_HISTORY_SOURCE_MODULE,
    ownerUuid: user?.uuid || null,
    ownerEmail: user?.email || '',
    ownerName: user?.name || user?.given_name || '',
  };

  await saveRecord(record, { ownerUuid: user?.uuid || null });

  if (videoFile) {
    const uploaded = await uploadKolFileToR2(videoFile, 'raw');
    record.r2Url = uploaded.url;
    record.videoUrl = uploaded.url || localDataUrl;
    record.size = uploaded.size || record.size;
    await saveRecord(record, { ownerUuid: user?.uuid || null });
  }

  notifyUpload();
  window.dispatchEvent(new CustomEvent('vibe_tracking_history_changed'));
  return record;
}

export async function listVibeHistory(kind: VibeHistoryKind): Promise<VibeHistoryRecord[]> {
  const user = readCurrentUser();
  const all = await getAllRecords({ ownerUuid: user?.uuid || null, includeUnowned: !user?.uuid });
  return all.filter((r: any) => r.sourceModule === VIBE_HISTORY_SOURCE_MODULE && r.kind === kind).sort((a: any, b: any) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
}
