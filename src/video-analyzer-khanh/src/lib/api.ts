/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// ĐÃ ĐỔI: bản gốc gọi thẳng @google/genai với API key nhúng client
// (process.env.GEMINI_API_KEY, xem README video-analyzer.zip) — không an
// toàn để deploy thật. Ở đây thay bằng luồng qua Serverless Function
// /api/groq-proxy (provider: 'video-analyzer'), server dùng GEMINI_API_KEY
// thật (biến môi trường, không lộ ra client) — xem
// api/_lib/videoAnalyzerProxy.js:
//
//   1. initR2Upload  -> ký presigned PUT URL lên Cloudflare R2. Trình duyệt
//                        PUT bytes video thẳng lên R2 (bucket đã bật CORS
//                        cho origin thật của app — xem r2Storage.js).
//      LƯU Ý: ĐÃ THỬ mở resumable-upload session thẳng với Gemini File API
//      ở server rồi trả uploadUrl cho trình duyệt PUT trực tiếp lên Google
//      — nhưng bị CHẶN BỞI CORS (Google chỉ cấp CORS cho session mở ngay từ
//      trình duyệt, không phải từ server) nên phải đổi sang relay qua R2.
//   2. uploadToGemini -> SAU KHI R2 upload xong, server tải bytes từ R2 rồi
//                        đẩy sang Gemini File API (server-to-server, không
//                        qua trình duyệt nên không bị CORS).
//   3. checkFile      -> poll trạng thái xử lý (PROCESSING -> ACTIVE) vì
//                        Gemini cần thời gian xử lý video sau khi nhận đủ
//                        bytes.
//   4. generate       -> generateContent thật kèm function calling, trả về
//                        timecodes đã parse sẵn.

export type UploadedVideoFile = {
  uri: string
  mimeType: string
};

async function proxyCall(action: string, extra: Record<string, unknown>) {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'video-analyzer', action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Video Analyzer proxy error (${res.status})`);
  }
  return data;
}

async function uploadFile(file: File): Promise<UploadedVideoFile> {
  const mimeType = file.type || 'video/mp4';

  console.log('Uploading to R2...');
  const { uploadUrl, publicUrl } = await proxyCall('initR2Upload', { mimeType });

  const r2Res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: file,
  });
  if (!r2Res.ok) {
    throw new Error(`Video upload to R2 failed (${r2Res.status})`);
  }
  console.log('Uploaded to R2. Sending to Gemini...');

  let fileResource = await proxyCall('uploadToGemini', {
    publicUrl,
    mimeType,
    displayName: file.name,
  });
  console.log('Sent to Gemini.');

  console.log('Getting...');
  while (fileResource.state === 'PROCESSING') {
    console.log(`current file status: ${fileResource.state}`);
    console.log('File is still processing, retrying in 5 seconds');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    fileResource = await proxyCall('checkFile', { fileName: fileResource.name });
  }
  console.log(fileResource.state);
  if (fileResource.state === 'FAILED') {
    throw new Error('File processing failed.');
  }
  console.log('Done');

  return { uri: fileResource.uri, mimeType: fileResource.mimeType || mimeType };
}

async function generateContent(
  promptText: string,
  file: UploadedVideoFile,
): Promise<{ functionCalls: Array<{ name: string; args: unknown }> }> {
  const { functionCall } = await proxyCall('generate', {
    promptText,
    fileUri: file.uri,
    mimeType: file.mimeType,
  });

  return { functionCalls: functionCall ? [functionCall] : [] };
}

export { generateContent, uploadFile };

