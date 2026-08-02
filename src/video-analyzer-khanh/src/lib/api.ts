/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// ĐÃ ĐỔI: bản gốc gọi thẳng @google/genai với API key nhúng client
// (process.env.GEMINI_API_KEY, xem README video-analyzer.zip) — không an
// toàn để deploy thật. Ở đây thay bằng 3 bước gọi qua Serverless Function
// /api/groq-proxy (provider: 'video-analyzer'), server dùng GEMINI_API_KEY
// thật (biến môi trường, không lộ ra client) — xem
// api/_lib/videoAnalyzerProxy.js:
//
//   1. initUpload  -> mở resumable-upload session với Gemini File API, trả
//                      về `uploadUrl` (đã có quyền ghi tạm thời từ Google).
//   2. Trình duyệt PUT thẳng bytes video LÊN GOOGLE bằng uploadUrl đó
//      (không qua server của mình nữa) -> tránh giới hạn kích thước body
//      của Vercel Serverless Function, giống mô hình presigned URL đã dùng
//      cho video KOL/R2 (xem kolR2Upload.js).
//   3. checkFile   -> poll trạng thái xử lý (PROCESSING -> ACTIVE) vì Gemini
//                      cần thời gian xử lý video sau khi nhận đủ bytes.
//   4. generate    -> generateContent thật kèm function calling, trả về
//                      timecodes đã parse sẵn.

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

  console.log('Uploading...');
  const { uploadUrl } = await proxyCall('initUpload', {
    mimeType,
    numBytes: file.size,
    displayName: file.name,
  });

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(file.size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Video upload failed (${uploadRes.status})`);
  }

  const uploadData = await uploadRes.json();
  let fileResource = uploadData.file;
  console.log('Uploaded.');

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
