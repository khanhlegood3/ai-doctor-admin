/**
 * gameAffiliateChain.js — Ghi quan hệ Affiliate + phần thưởng game lên
 * blockchain (BSC Testnet), dùng Account Abstraction (ERC-4337) gasless qua
 * Pimlico bundler + `HienMauPaymaster`, giống kiến trúc đã dùng trong
 * `AffiliateSystemControlPanel.jsx` (executeGaslessTask).
 *
 * ABI thật của `HienMauAffiliate.sol` (đã xác nhận với người dùng):
 *   - registerReferral(address _referrer) external
 *       msg.sender tự trở thành referee, chỉ cần truyền địa chỉ referrer.
 *       Revert nếu: referrer == address(0), referrer == msg.sender, hoặc
 *       msg.sender đã có referrer từ trước ("Already registered").
 *   - rewardTask(uint256 _baseAmount) external
 *       Cộng _baseAmount vào balances[msg.sender] RỒI TỰ ĐỘNG chia hoa hồng
 *       đa tầng (levelRates = [10,5,2]%) ngược lên toàn bộ tuyến trên —
 *       KHÔNG cần gọi thêm giao dịch nào khác để trả hoa hồng.
 *       Revert nếu chưa đủ 4 giờ kể từ lần gọi trước của CHÍNH msg.sender
 *       ("Task cooldown active: come back later") — cooldown tính theo VÍ,
 *       dùng chung cho mọi loại thưởng (ad_watch/game_complete) vì cả 2 đều
 *       gọi cùng 1 hàm rewardTask.
 *
 * → Hệ quả cho game affiliate: 1 lần gọi rewardTask() là đủ để vừa cộng
 * điểm cho người chơi vừa trả hoa hồng cho F1/F2/F3 NGAY TRONG CÙNG 1 giao
 * dịch — không cần (và không nên) gửi thêm giao dịch on-chain riêng cho
 * phần hoa hồng của người giới thiệu.
 *
 * Paymaster (`HienMauPaymaster.sol`) chỉ tài trợ gas cho các cuộc gọi có
 * dest == affiliateContract && value == 0 qua hàm chuẩn `execute(...)` của
 * Simple Smart Account — đúng với cách `permissionless` gửi transaction ở
 * dưới, không cần chỉnh gì thêm.
 *
 * Mỗi user (uuid) có 1 smart-account ví ẩn danh riêng, private key sinh 1
 * lần và lưu trong localStorage (giống getOrGeneratePrivateKey trong
 * AffiliateSystemControlPanel.jsx) — KHÔNG dùng để giữ tài sản thật, chỉ để
 * ký các userOperation gasless.
 */

import { createPublicClient, http, encodeFunctionData } from 'viem'
import { bscTestnet } from 'viem/chains'
import { createSmartAccountClient } from 'permissionless'
import { toSimpleSmartAccount } from 'permissionless/accounts'
import { privateKeyToAccount } from 'viem/accounts'
import {
  markReferralSynced,
  markReferralFailed,
  markRewardSynced,
  markRewardFailed,
} from './gameAffiliateDB'

const PIMLICO_URL = import.meta.env.VITE_PIMLICO_BUNDLER_URL
  || 'https://api.pimlico.io/v2/97/rpc?apikey=VITE_YOUR_PIMLICO_API_KEY'

const PAYMASTER_ADDRESS = import.meta.env.VITE_PAYMASTER_CONTRACT_ADDRESS
  || '0x177858e3450ff286E7d301100363567A555E435f'
const AFFILIATE_CONTRACT = import.meta.env.VITE_AFFILIATE_CONTRACT_ADDRESS
  || '0x44f787D670Ff4Ef65334D6637960bb7Fe5E1231c'

const ENTRY_POINT = { address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', version: '0.6' }

// ─── Export cho UI: link "xem trên chain" kiểu Moralis / BscScan Testnet ──
// Cho phép AffiliateUUIDReferralPanel.jsx (và các panel khác) tự dựng link
// tới BscScan Testnet mà không cần biết địa chỉ contract / định dạng URL.
export const AFFILIATE_CONTRACT_ADDRESS = AFFILIATE_CONTRACT
export const BSCSCAN_TESTNET_BASE_URL = 'https://testnet.bscscan.com'

export function getBscScanAddressUrl(address) {
  return address ? `${BSCSCAN_TESTNET_BASE_URL}/address/${address}` : null
}

export function getBscScanTxUrl(txHash) {
  return txHash ? `${BSCSCAN_TESTNET_BASE_URL}/tx/${txHash}` : null
}

// ABI thật, lấy nguyên văn từ artifact đã compile của HienMauAffiliate.sol
const AFFILIATE_ABI = [
  { inputs: [], stateMutability: 'nonpayable', type: 'constructor' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'from', type: 'address' }, { indexed: true, internalType: 'address', name: 'to', type: 'address' }, { indexed: false, internalType: 'uint256', name: 'level', type: 'uint256' }, { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'CommissionPaid', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'user', type: 'address' }, { indexed: true, internalType: 'address', name: 'referrer', type: 'address' }], name: 'ReferralRegistered', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'user', type: 'address' }, { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'TaskRewarded', type: 'event' },
  { inputs: [{ internalType: 'address', name: '', type: 'address' }], name: 'balances', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: '', type: 'address' }], name: 'lastTaskTime', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], name: 'levelRates', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: '', type: 'address' }], name: 'referrers', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: '_referrer', type: 'address' }], name: 'registerReferral', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: '_baseAmount', type: 'uint256' }], name: 'rewardTask', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint256[]', name: '_newRates', type: 'uint256[]' }], name: 'setLevelRates', outputs: [], stateMutability: 'nonpayable', type: 'function' },
]

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http('https://data-seed-prebsc-1-s1.binance.org:8545'),
})

// ─── Ví ẩn danh riêng cho mỗi uuid (giống AffiliateSystemControlPanel) ─────
function getOrGeneratePrivateKey(uuid) {
  const storageKey = `game_affiliate_pk_${uuid}`
  let pk = localStorage.getItem(storageKey)
  if (!pk) {
    const array = new Uint8Array(32)
    window.crypto.getRandomValues(array)
    pk = '0x' + Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(storageKey, pk)
  }
  return pk
}

export function getGameAffiliateWalletAddress(uuid) {
  if (!uuid) return null
  const pk = getOrGeneratePrivateKey(uuid)
  return privateKeyToAccount(pk).address
}

async function getSmartAccountClient(uuid) {
  const owner = privateKeyToAccount(getOrGeneratePrivateKey(uuid))
  const smartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: ENTRY_POINT,
  })
  return createSmartAccountClient({
    account: smartAccount,
    chain: bscTestnet,
    bundlerTransport: http(PIMLICO_URL),
    paymaster: {
      getPaymasterStubData: async () => ({ paymasterAndData: PAYMASTER_ADDRESS }),
      getPaymasterData: async () => ({ paymasterAndData: PAYMASTER_ADDRESS }),
    },
  })
}

// Cache 1 smart-account-client theo uuid trong phiên hiện tại để tránh khởi
// tạo lại (và gọi getPaymasterStubData) mỗi lần gửi transaction.
const clientCache = new Map()
async function getCachedSmartAccountClient(uuid) {
  if (clientCache.has(uuid)) return clientCache.get(uuid)
  const client = await getSmartAccountClient(uuid)
  clientCache.set(uuid, client)
  return client
}

async function sendGaslessCall(uuid, { functionName, args }) {
  const smartAccountClient = await getCachedSmartAccountClient(uuid)
  const callData = encodeFunctionData({ abi: AFFILIATE_ABI, functionName, args })
  const txHash = await smartAccountClient.sendTransaction({
    to: AFFILIATE_CONTRACT,
    data: callData,
    value: 0n,
    maxFeePerGas: 5000000000n,
    maxPriorityFeePerGas: 5000000000n,
  })
  return txHash
}

// Lỗi từ Pimlico bundler (vd eth_estimateUserOperationGas) đôi khi trả về
// revert reason ở dạng hex thô CHƯA decode (selector 0x08c379a0 = chuẩn ABI
// Error(string)), khác với lỗi JSON-RPC thường có sẵn text người đọc được.
// Nếu chỉ regex trực tiếp trên error.message, những case như "Already
// registered" bị bỏ lỡ (message chỉ toàn hex) và bị coi nhầm là lỗi thật.
function decodeAbiRevertReason(rawText) {
  const match = rawText.match(/0x08c379a0[0-9a-fA-F]+/)
  if (!match) return null
  try {
    const hex = match[0].slice(2)
    const lengthHex = hex.slice(72, 136)
    const length = parseInt(lengthHex, 16)
    if (!Number.isFinite(length) || length <= 0 || length > 1000) return null
    const dataHex = hex.slice(136, 136 + length * 2)
    let str = ''
    for (let i = 0; i < dataHex.length; i += 2) {
      str += String.fromCharCode(parseInt(dataHex.slice(i, i + 2), 16))
    }
    return str
  } catch {
    return null
  }
}

function getRevertMessage(error) {
  const rawText = error?.message || String(error)
  return decodeAbiRevertReason(rawText) || rawText
}

function isCooldownError(error) {
  return /cooldown/i.test(getRevertMessage(error))
}

function isAlreadyRegisteredError(error) {
  return /Already registered/i.test(getRevertMessage(error))
}

// ─── 1) Ghi quan hệ referral lên chain ─────────────────────────────────────
// msg.sender (= ví của refereeUuid) tự trở thành người được giới thiệu, chỉ
// cần truyền địa chỉ ví của referrerUuid.
export async function registerReferralOnChain({ id, referrerUuid, refereeUuid }) {
  try {
    const referrerAddress = getGameAffiliateWalletAddress(referrerUuid)
    const txHash = await sendGaslessCall(refereeUuid, {
      functionName: 'registerReferral',
      args: [referrerAddress],
    })
    if (id) await markReferralSynced(id, txHash)
    return { ok: true, txHash }
  } catch (error) {
    // "Already registered" trên chain không phải lỗi thật — nghĩa là quan hệ
    // này đã tồn tại từ trước (vd gọi lại sau khi mất mạng lần trước), coi
    // như thành công để không chặn UI với thông báo lỗi vô nghĩa.
    if (isAlreadyRegisteredError(error)) {
      if (id) await markReferralSynced(id, null)
      return { ok: true, txHash: null, note: 'already_registered_onchain' }
    }
    console.error('[gameAffiliateChain] registerReferralOnChain lỗi:', error)
    if (id) await markReferralFailed(id, error?.message || String(error))
    return { ok: false, error: error?.message || String(error) }
  }
}

// ─── 2) Ghi thưởng (xem QC / hoàn thành game) lên chain ───────────────────
// rewardTask() TỰ ĐỘNG chia hoa hồng lên toàn bộ tuyến trên trong CÙNG 1
// giao dịch — không gọi thêm giao dịch nào khác cho phần hoa hồng.
export async function recordRewardOnChain({ id, uuid, amount }) {
  try {
    const amountUint = BigInt(Math.max(0, Math.round(Number(amount) || 0)))
    const txHash = await sendGaslessCall(uuid, {
      functionName: 'rewardTask',
      args: [amountUint],
    })
    if (id) await markRewardSynced(id, txHash)
    return { ok: true, txHash }
  } catch (error) {
    const cooldown = isCooldownError(error)
    console.error('[gameAffiliateChain] recordRewardOnChain lỗi:', error)
    if (id) await markRewardFailed(id, cooldown ? 'Đang trong thời gian chờ (cooldown 4h/ví) — sẽ tự đồng bộ lại sau.' : (error?.message || String(error)))
    return { ok: false, error: error?.message || String(error), cooldown }
  }
}

// ─── Đồng bộ lại toàn bộ reward đang "pending"/"failed" (vd sau khi mất
// mạng hoặc hết cooldown) ───────────────────────────────────────────────
export async function retryPendingRewards(pendingRows) {
  const results = []
  for (const row of pendingRows) {
    // eslint-disable-next-line no-await-in-loop
    const res = await recordRewardOnChain({ id: row.id, uuid: row.uuid, amount: row.amount })
    results.push({ id: row.id, ...res })
  }
  return results
}
