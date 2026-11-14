import { createHash } from 'node:crypto'
const hash = value => createHash('sha256').update(value).digest('hex')

/** Verify at Google, not from client-supplied email/name/verified flags.
 * Access token is transient, never written to Mongo or returned to the browser.
 */
export async function verifyGoogleAccessToken(accessToken, fetchImpl = fetch, clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID) {
  if (!clientId) throw Object.assign(new Error('Chưa cấu hình GOOGLE_CLIENT_ID ở server.'), { status: 503 })
  if (typeof accessToken !== 'string' || !accessToken || accessToken.length > 4096) {
    throw Object.assign(new Error('Thiếu Google access token.'), { status: 401 })
  }
  const [tokenRes, profileRes] = await Promise.all([
    fetchImpl(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, { signal: AbortSignal.timeout(10000) }),
    fetchImpl('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000),
    }),
  ])
  if (!tokenRes.ok || !profileRes.ok) throw Object.assign(new Error('Phiên Google không hợp lệ.'), { status: 401 })
  const token = await tokenRes.json()
  const profile = await profileRes.json()
  if ((token.aud || token.issued_to) !== clientId || Number(token.expires_in) <= 0 ||
      !profile.sub || !profile.email || profile.email_verified !== true ||
      (token.sub || token.user_id) !== profile.sub) {
    throw Object.assign(new Error('Không xác minh được tài khoản Google.'), { status: 401 })
  }
  return profile
}

export async function linkGoogleIdentity(col, body, profile) {
  const uuid = typeof body.uuid === 'string' ? body.uuid.trim() : ''
  const secret = typeof body.secret === 'string' ? body.secret : ''
  if (!uuid || uuid.length > 160 || secret.length < 16 || secret.length > 256) {
    throw Object.assign(new Error('Thiếu UID hoặc khoá sở hữu hợp lệ.'), { status: 400 })
  }
  // Fail closed if historical duplicates prevent establishing uniqueness.
  await col.createIndex({ uuid: 1 }, { unique: true })
  await col.createIndex({ googleSub: 1 }, { unique: true, sparse: true })
  await col.createIndex({ googleEmailLower: 1 }, { unique: true, sparse: true })
  const googleEmailLower = profile.email.toLowerCase()
  let account = await col.findOne({ googleSub: profile.sub })
  // Verified email may link an existing password account, but not reassign an
  // already-linked subject. UUID is never changed on an existing record.
  if (!account) account = await col.findOne({ emailLower: googleEmailLower })
  if (account?.googleSub && account.googleSub !== profile.sub) {
    throw Object.assign(new Error('Email đã liên kết với danh tính Google khác.'), { status: 409 })
  }
  const secretHash = hash(secret)
  if (!account) {
    account = await col.findOne({ uuid })
    if (account?.googleSub && account.googleSub !== profile.sub) {
      throw Object.assign(new Error('UID này đã liên kết Google khác. Hãy chuyển sang ẩn danh trước.'), { status: 409 })
    }
    if (account?.secretHash && account.secretHash !== secretHash && !account.googleDeviceSecretHashes?.includes(secretHash)) {
      throw Object.assign(new Error('Không chứng minh được quyền sở hữu UID ẩn danh.'), { status: 403 })
    }
  }
  const canonicalUuid = account?.uuid || uuid
  // Client can detect a historical mismatch without creating any new mapping.
  if (body.existingAccount && canonicalUuid !== uuid) {
    throw Object.assign(new Error('UID cục bộ khác UID Google trên server. Cần đối soát dữ liệu.'), { status: 409 })
  }
  try {
    await col.updateOne(
      { uuid: canonicalUuid, $or: [{ googleSub: { $exists: false } }, { googleSub: profile.sub }] },
      {
        $set: { googleSub: profile.sub, googleEmailLower, verified: true, updatedAt: new Date().toISOString() },
        $setOnInsert: { uuid: canonicalUuid, name: profile.name || profile.email, secretHash, createdAt: new Date().toISOString() },
        $addToSet: { googleDeviceSecretHashes: secretHash },
      },
      { upsert: true },
    )
  } catch (error) {
    if (error.code !== 11000) throw error
    // Another tab/device linked this Google subject first: use that UID.
    const winner = await col.findOne({ googleSub: profile.sub })
    if (!winner || (body.existingAccount && winner.uuid !== uuid)) {
      throw Object.assign(new Error('UID vừa được liên kết. Vui lòng thử lại.'), { status: 409 })
    }
    await col.updateOne({ uuid: winner.uuid }, { $addToSet: { googleDeviceSecretHashes: secretHash } })
    return { uuid: winner.uuid, userId: winner.userId || null, apiAccessStatus: winner.apiAccessStatus || 'none' }
  }
  return { uuid: canonicalUuid, userId: account?.userId || null, apiAccessStatus: account?.apiAccessStatus || 'none' }
}
