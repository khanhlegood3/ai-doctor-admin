import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, Copy, ExternalLink, Activity, Check, Terminal, Settings, Layers,
  Play, RefreshCw, Cpu, Wifi, Code, Filter, Clock, X, ChevronDown, RotateCcw,
  ChevronLeft, ChevronRight, ArrowRightLeft, Database, ArrowRight, Wallet,
  AlertTriangle, FileCode
} from 'lucide-react';

// =========================================================================
// INDEXEDDB ENGINE FOR ALCHEMY LOGS
// =========================================================================
const DB_NAME = 'HMNV_Alchemy_Logs_DB';
const DB_VERSION = 1;
const STORE_NAME = 'alchemy_logs';

const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      if (!event.target.result.objectStoreNames.contains(STORE_NAME)) {
        event.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

const saveLogToIndexedDB = async (logEntry) => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const request = transaction.objectStore(STORE_NAME).put(logEntry);
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) { console.error("Alchemy DB Save Error:", error); }
};

const getAllLogsFromIndexedDB = async () => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = (event) => {
        const logs = event.target.result || [];
        resolve(logs.sort((a, b) => b.timestamp - a.timestamp));
      };
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) { return []; }
};

const clearAllLogsFromIndexedDB = async () => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const request = transaction.objectStore(STORE_NAME).clear();
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) { console.error("Alchemy DB Clear Error:", error); }
};

const shortenAddress = (addr) => addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '0x...';

const generateCurlCommand = (log) => {
  if (!log) return '';
  return `curl https://bnb-testnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY \\\n  -X POST \\\n  -H "accept: application/json" \\\n  -H "content-type: application/json" \\\n  --data '${JSON.stringify(log.requestBody)}'`;
};

const MOCK_USER_OP_V06 = {
  sender: "0x177858e3450ff286E7d301100363567A555E435f",
  nonce: "0x1",
  initCode: "0x",
  callData: "0xabcdef",
  callGasLimit: "0x5208",
  verificationGasLimit: "0x5208",
  preVerificationGas: "0x5208",
  maxFeePerGas: "0x1",
  maxPriorityFeePerGas: "0x1",
  paymasterAndData: "0x",
  signature: "0x"
};

export default function AffiliateWebhookAdmin() {
  const [activeWebhookTab, setActiveWebhookTab] = useState('affiliate');
  const [copiedType, setCopiedType] = useState(''); 
  const [sandboxCategory, setSandboxCategory] = useState('standard');
  const [customAddress, setCustomAddress] = useState('0x44f787D670Ff4Ef65334D6637960bb7Fe5E1231c');

  // State Sandbox RPC
  const [selectedRpcMethod, setSelectedRpcMethod] = useState('alchemy_getAssetTransfers');
  const [blockParam, setBlockParam] = useState('0x7226a16'); 
  const [txFrom, setTxFrom] = useState('0x60d492288df05122a47421b91cd94df5016c2b9d');
  const [txValue, setTxValue] = useState('0x0');
  const [feeBlockCount, setFeeBlockCount] = useState('0x5');
  const [feeNewestBlock, setFeeNewestBlock] = useState('latest');
  const [feePercentiles, setFeePercentiles] = useState('20, 30');
  const [logsFromBlock, setLogsFromBlock] = useState('0x137d3c2');
  const [logsToBlock, setLogsToBlock] = useState('0x137d3cb'); 
  const [logsTopics, setLogsTopics] = useState('');
  const [editableJsonInput, setEditableJsonInput] = useState('');

  // State Request Logs Engine
  const [isLoadingRpc, setIsLoadingRpc] = useState(false);
  const [rawRpcResponse, setRawRpcResponse] = useState(null);
  const [requestLogs, setRequestLogs] = useState([]);
  const [selectedRequestLog, setSelectedRequestLog] = useState(null);

  // State Filters
  const [activeDropdown, setActiveDropdown] = useState(null); 
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('hour'); 
  const [selectedMethods, setSelectedMethods] = useState([]);
  const [selectedHttpCodes, setSelectedHttpCodes] = useState([]);
  const [selectedResponseTimes, setSelectedResponseTimes] = useState([]); 

  // State Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 
  
  const dropdownRef = useRef(null);
  const ALCHEMY_RPC_URL = "https://bnb-testnet.g.alchemy.com/v2/3P6Sj-7RXbrD7znG4t8f8";
  // Trước đây hard-code SAI domain "hien-mau-nhan-van.vercel.app" (thừa dấu
  // gạch ngang) — không khớp domain deploy thật "hienmaunhanvan.vercel.app",
  // nên URL copy ra dán vào Alchemy dashboard sẽ trỏ vào endpoint không tồn
  // tại. Giữ dạng chuỗi tĩnh (không dùng window.location.origin) vì endpoint
  // này PHẢI là domain public thật để Alchemy gọi vào được, kể cả khi admin
  // đang mở panel này từ localhost lúc dev.
  const targetEndpoint = "https://hienmaunhanvan.vercel.app/api/alchemy-webhook";

  const webhookData = {
    affiliate: { contract: '0x44f787D670Ff4Ef65334D6637960bb7Fe5E1231c', dashboardUrl: 'https://dashboard.alchemy.com/apps/xo4ut1zr4j2ut5qk/webhooks/wh_pqra43npyunzk8w7' },
    paymaster: { contract: '0x177858e3450ff286E7d301100363567A555E435f', dashboardUrl: 'https://dashboard.alchemy.com/apps/xo4ut1zr4j2ut5qk/webhooks/wh_ck5mia12huh25nvp' }
  };

  const timeFilterOptions = [
    { key: '5min', label: 'Last 5 minutes' },
    { key: 'hour', label: 'Last hour' },
    { key: 'day', label: 'Last day' },
    { key: '7days', label: 'Last 7 days' }
  ];

  useEffect(() => {
    const loadLogs = async () => {
      const persistedLogs = await getAllLogsFromIndexedDB();
      if (persistedLogs.length > 0) {
        setRequestLogs(persistedLogs);
        setSelectedRequestLog(persistedLogs[0]);
      }
    };
    loadLogs();
  }, []);

  useEffect(() => {
    if (sandboxCategory === 'aa') {
      setSelectedRpcMethod('pm_getPaymasterData');
    } else {
      setSelectedRpcMethod('alchemy_getAssetTransfers');
    }
  }, [sandboxCategory]);

  useEffect(() => {
    const targetQueryAddress = customAddress.trim();
    let paramsBody = [];

    if (selectedRpcMethod.startsWith('pm_')) {
      paramsBody = [MOCK_USER_OP_V06, "0x5FF137D4b0fDCd49DcA30c7CF57E578a026d2789", "0x61", { policyId: "hmnv-gas-policy-2026" }];
    } else if (selectedRpcMethod === 'alchemy_getAssetTransfers') {
      paramsBody = [{ fromBlock: "0x0", toBlock: "latest", toAddress: targetQueryAddress, category: ["external", "erc20"], excludeZeroValue: false, withMetadata: true }];
    } else if (selectedRpcMethod === 'eth_getLogs') {
      paramsBody = [{ fromBlock: logsFromBlock, toBlock: logsToBlock, address: targetQueryAddress }];
    } else if (selectedRpcMethod === 'eth_getBlockReceipts') {
      paramsBody = [blockParam];
    }

    const fullRpcPayload = { jsonrpc: "2.0", id: 1, method: selectedRpcMethod, params: paramsBody };
    setEditableJsonInput(JSON.stringify(fullRpcPayload, null, 2));
  }, [selectedRpcMethod, customAddress, logsFromBlock, logsToBlock, blockParam]);

  useEffect(() => {
    const defaultContract = webhookData[activeWebhookTab].contract;
    setCustomAddress(defaultContract);
    setSandboxCategory(activeWebhookTab === 'paymaster' ? 'aa' : 'standard');
  }, [activeWebhookTab]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setActiveDropdown(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExecuteDataEngineCall = async () => {
    setIsLoadingRpc(true);
    setRawRpcResponse(null);
    const startTime = performance.now();

    let finalPayload;
    try { finalPayload = JSON.parse(editableJsonInput); } catch (e) {
      setRawRpcResponse({ error: "Lỗi cấu trúc JSON", details: "Vui lòng kiểm tra lại cú pháp." });
      setIsLoadingRpc(false);
      return;
    }

    try {
      const response = await fetch(ALCHEMY_RPC_URL, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(finalPayload)
      });
      const resData = await response.json();
      const duration = Math.round(performance.now() - startTime);

      setRawRpcResponse(resData);
      
      const newLogEntry = {
        id: `alc_${Math.random().toString(36).substr(2, 7)}`,
        method: finalPayload.method || selectedRpcMethod,
        app: "Khánh's First App",
        httpStatus: response.status,
        errorCode: resData.error ? String(resData.error.code) : "-",
        errorMessage: resData.error ? resData.error.message : "-",
        responseTime: `${duration} ms`,
        timeSent: new Date().toLocaleTimeString(),
        timestamp: Date.now(),
        requestBody: finalPayload,
        responseBody: resData
      };
      
      await saveLogToIndexedDB(newLogEntry);
      setRequestLogs(prev => [newLogEntry, ...prev]);
      setSelectedRequestLog(newLogEntry);
      setCurrentPage(1);
    } catch (error) {
      setRawRpcResponse({ error: "Lỗi kết nối RPC Node Alchemy", details: error.message });
    } finally {
      setIsLoadingRpc(false);
    }
  };

  const handleClearTerminalHistory = async () => {
    if(window.confirm("Xoá sạch lịch sử logs lưu trữ trong IndexedDB?")) {
      await clearAllLogsFromIndexedDB();
      setRequestLogs([]);
      setSelectedRequestLog(null);
    }
  };

  const toggleFilter = (item, list, setList) => {
    setCurrentPage(1);
    if (list.includes(item)) setList(list.filter(i => i !== item));
    else setList([...list, item]);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleResetFilters = () => {
    setSelectedTimeFilter('hour');
    setSelectedMethods([]);
    setSelectedHttpCodes([]);
    setSelectedResponseTimes([]);
    setCurrentPage(1);
  };

  const handleCopyClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(''), 2000);
  };

  const filteredRequestLogs = requestLogs.filter(log => {
    const diffMs = Date.now() - log.timestamp;
    if (selectedTimeFilter === '5min' && diffMs > 5 * 60 * 1000) return false;
    if (selectedTimeFilter === 'hour' && diffMs > 60 * 60 * 1000) return false;
    if (selectedTimeFilter === 'day' && diffMs > 24 * 60 * 60 * 1000) return false;
    if (selectedTimeFilter === '7days' && diffMs > 7 * 24 * 60 * 60 * 1000) return false;

    if (selectedMethods.length > 0 && !selectedMethods.includes(log.method)) return false;
    
    if (selectedHttpCodes.length > 0) {
      const isSuccess = log.httpStatus === 200;
      if (selectedHttpCodes.includes('200') && !isSuccess) return false;
      if (selectedHttpCodes.includes('error') && isSuccess) return false;
    }

    if (selectedResponseTimes.length > 0) {
      const timeNum = parseInt(log.responseTime) || 0;
      let cat = '';
      if (timeNum < 200) cat = 'light';
      else if (timeNum <= 2000) cat = 'medium';
      else cat = 'heavy';
      if (!selectedResponseTimes.includes(cat)) return false;
    }
    return true;
  });

  const totalItems = filteredRequestLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentPagedLogs = filteredRequestLogs.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Head banner */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="text-blue-500 w-7 h-7" /> Hệ Thống Quản Trị Webhook & Alchemy Sandbox
        </h1>
      </div>

      {/* WEBHOOK TABS CONTROL */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button onClick={() => setActiveWebhookTab('affiliate')} className={`text-left p-5 rounded-xl border transition-all ${activeWebhookTab === 'affiliate' ? 'bg-slate-950/80 border-blue-500 ring-1 ring-blue-500/30 font-bold' : 'bg-slate-950/20 border-slate-800 text-slate-400'}`}>
            <span className="text-sm font-bold block mb-1">AFFILIATE TRACKER WEBHOOK TARGET</span>
            <span className="text-xs font-mono text-slate-500 block truncate">{webhookData.affiliate.contract}</span>
          </button>
          <button onClick={() => setActiveWebhookTab('paymaster')} className={`text-left p-5 rounded-xl border transition-all ${activeWebhookTab === 'paymaster' ? 'bg-slate-950/80 border-blue-500 ring-1 ring-blue-500/30 font-bold' : 'bg-slate-950/20 border-slate-800 text-slate-400'}`}>
            <span className="text-sm font-bold block mb-1">HIENMAUPAYMASTERCONTRACT (ERC-4337)</span>
            <span className="text-xs font-mono text-slate-500 block truncate">{webhookData.paymaster.contract}</span>
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-300 overflow-x-auto flex items-center">{targetEndpoint}</div>
            <button onClick={() => handleCopyClipboard(targetEndpoint, 'endpoint')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium">{copiedType === 'endpoint' ? 'Đã copy' : 'Copy Endpoint'}</button>
          </div>
          <a href={webhookData[activeWebhookTab].dashboardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline font-mono">Mở cấu hình trên Alchemy Dashboard <ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 font-mono text-xs"><span className="text-slate-400 uppercase font-sans font-semibold">Active Search Wallet Target:</span> <div className="text-blue-400 mt-2 truncate">{customAddress}</div></div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5"><span className="text-xs text-slate-400 font-semibold uppercase">IndexedDB Alchemy Cache Engine:</span> <div className="text-sm font-bold text-emerald-400 mt-1.5 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> SYSTEM CAPTURED ({requestLogs.length} Records)</div></div>
      </div>

      {/* SANDBOX STUDIO PLAYGROUND */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
          <h2 className="text-sm font-bold uppercase text-slate-300 flex items-center gap-1.5"><Code className="w-4 h-4 text-blue-400" /> Alchemy Integrated Sandbox Console</h2>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button onClick={() => setSandboxCategory('standard')} className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${sandboxCategory === 'standard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Standard RPC</button>
            <button onClick={() => setSandboxCategory('aa')} className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${sandboxCategory === 'aa' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Account Abstraction</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Method</label>
            <select value={selectedRpcMethod} onChange={(e) => setSelectedRpcMethod(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-blue-400 font-mono focus:outline-none">
              {sandboxCategory === 'aa' ? (
                <>
                  <option value="pm_getPaymasterData">pm_getPaymasterData</option>
                  <option value="pm_getPaymasterStubData">pm_getPaymasterStubData</option>
                  <option value="alchemy_requestPaymasterAndData">alchemy_requestPaymasterAndData</option>
                </>
              ) : (
                <>
                  <option value="alchemy_getAssetTransfers">alchemy_getAssetTransfers</option>
                  <option value="eth_getLogs">eth_getLogs</option>
                  <option value="eth_getBlockReceipts">eth_getBlockReceipts</option>
                  <option value="eth_feeHistory">eth_feeHistory</option>
                </>
              )}
            </select>
          </div>
          <div className="lg:col-span-7">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Target Address</label>
            <input type="text" value={customAddress} onChange={(e) => setCustomAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none" />
          </div>
          <div className="lg:col-span-2">
            <button onClick={handleExecuteDataEngineCall} disabled={isLoadingRpc} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-xl text-sm h-[38px] flex items-center justify-center gap-2"><Play className="w-4 h-4"/> Run Code</button>
          </div>
        </div>

        {selectedRpcMethod === 'eth_getLogs' && (
          <div className="grid grid-cols-2 gap-4 p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-mono">
            <div><label className="text-slate-400">fromBlock</label><input type="text" value={logsFromBlock} onChange={(e) => setLogsFromBlock(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 mt-1" /></div>
            <div><label className="text-slate-400">toBlock (+10 blocks max)</label><input type="text" value={logsToBlock} onChange={(e) => setLogsToBlock(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 mt-1" /></div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <textarea value={editableJsonInput} onChange={(e) => setEditableJsonInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-pink-400 h-52 resize-none focus:outline-none" />
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-blue-400 h-52 overflow-y-auto custom-scrollbar">
            {rawRpcResponse ? <pre>{JSON.stringify(rawRpcResponse, null, 2)}</pre> : <span className="text-slate-600 block text-center pt-20">Đang đợi chạy request...</span>}
          </div>
        </div>
      </div>

      {/* ĐÃ BỔ SUNG: ALCHEMY ADVANCED EXPLORER VISUALIZER BẢNG ĐIỆN TỬ FULL-WIDTH */}
      <div className="border border-slate-800 bg-slate-900 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-slate-950/50 border-b border-slate-800 px-4 py-3 text-xs font-bold uppercase text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2"><Database className="w-4 h-4 text-blue-400" /> Alchemy Sandbox Tracker Visualizer</div>
          <span className="text-[11px] text-slate-500 font-mono">Method: {selectedRpcMethod}</span>
        </div>
        <div className="overflow-x-auto min-h-[160px]">
          {rawRpcResponse?.result ? (
            <>
              {/* Trường hợp 1: Kết quả là danh sách Transfers từ alchemy_getAssetTransfers */}
              {selectedRpcMethod === 'alchemy_getAssetTransfers' && Array.isArray(rawRpcResponse.result.transfers) ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="p-3">Tx Hash</th>
                      <th className="p-3">Block</th>
                      <th className="p-3">From</th>
                      <th className="p-3 text-center">Dir</th>
                      <th className="p-3">To</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-[13px]">
                    {rawRpcResponse.result.transfers.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono text-blue-400 truncate max-w-[120px]"><span title={tx.hash}>{shortenAddress(tx.hash)}</span></td>
                        <td className="p-3 font-mono text-slate-300">{parseInt(tx.blockNum, 16) || tx.blockNum}</td>
                        <td className="p-3 font-mono text-slate-400">{shortenAddress(tx.from)}</td>
                        <td className="p-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tx.to?.toLowerCase() === customAddress.toLowerCase() ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {tx.to?.toLowerCase() === customAddress.toLowerCase() ? 'IN' : 'OUT'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400">{shortenAddress(tx.to)}</td>
                        <td className="p-3 text-purple-400 uppercase font-semibold text-[11px]">[{tx.category}]</td>
                        <td className="p-3 text-right font-bold text-slate-100">{tx.value} <span className="text-xs font-normal text-slate-400">{tx.asset}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : selectedRpcMethod === 'eth_getLogs' && Array.isArray(rawRpcResponse.result) ? (
                /* Trường hợp 2: Kết quả từ eth_getLogs */
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="p-3">Tx Hash</th>
                      <th className="p-3">Block Hex</th>
                      <th className="p-3">Log Index</th>
                      <th className="p-3">Contract emitter</th>
                      <th className="p-3">Topic [0] (Event Sig)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-[13px] font-mono">
                    {rawRpcResponse.result.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-blue-400">{shortenAddress(log.transactionHash)}</td>
                        <td className="p-3 text-slate-300">{log.blockNumber}</td>
                        <td className="p-3 text-slate-400">{log.logIndex}</td>
                        <td className="p-3 text-emerald-400">{shortenAddress(log.address)}</td>
                        <td className="p-3 text-purple-400 truncate max-w-[200px]" title={log.topics?.[0]}>{shortenAddress(log.topics?.[0])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : selectedRpcMethod.startsWith('pm_') && rawRpcResponse.result.paymasterAndData ? (
                /* Trường hợp 3: Khối Account Abstraction Paymaster Approval Badge */
                <div className="p-6 flex items-center justify-between bg-purple-950/10 border-l-4 border-l-purple-500">
                  <div className="space-y-1">
                    <div className="text-purple-400 font-bold text-sm flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> BUNDLER & PAYMASTER VALIDATION SUCCESS
                    </div>
                    <div className="text-xs text-slate-400 max-w-xl leading-relaxed">
                      Alchemy Gas Policy đã ký duyệt hợp lệ cho UserOperation. Mã hóa chữ ký tài trợ Gas dưới đây đã sẵn sàng để tích hợp vào Engine:
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs font-mono text-pink-400 truncate max-w-xl mt-3 select-all">{rawRpcResponse.result.paymasterAndData}</div>
                  </div>
                  <span className="bg-purple-500/10 text-purple-400 text-xs px-3 py-1 border border-purple-500/20 font-bold uppercase rounded-xl">ERC-4337 PASS</span>
                </div>
              ) : (
                <div className="text-slate-500 p-6 text-center">Yêu cầu đã thực thi thành công nhưng phương thức này không hỗ trợ hiển thị dạng bảng grid. Vui lòng xem kết quả Json thô phía trên.</div>
              )}
            </>
          ) : (
            <div className="text-slate-600 text-center py-12 font-medium"><Terminal className="w-8 h-8 mx-auto mb-1 opacity-40 animate-pulse" />Bấm "Run Code" để tải luồng dữ liệu thám mã chuỗi khối lên bảng Visualizer.</div>
          )}
        </div>
      </div>

      {/* FULL HISTORY REQUEST RESPONSE CONTROL BLOCK */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative" ref={dropdownRef}>
        <div className="mb-4 flex justify-between items-center">
          <div><h2 className="text-lg font-semibold text-white flex items-center gap-2"><Clock className="text-purple-400 w-5 h-5"/> Request Logs Lịch Sử (Alchemy Developer Control)</h2></div>
          <button onClick={handleClearTerminalHistory} className="px-3 py-1.5 bg-rose-950/40 border border-rose-900/60 text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5"/> Clear DB History</button>
        </div>

        {/* FULL FILTER TOOLKIT */}
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 relative z-20">
          <span className="text-xs font-semibold text-slate-400 px-1">Filters</span>
          <div className="relative">
            <button onClick={() => setActiveDropdown(activeDropdown === 'time' ? null : 'time')} className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg text-xs flex items-center gap-1 font-medium">Time: <span className="text-blue-400">{timeFilterOptions.find(o => o.key === selectedTimeFilter)?.label || 'Last hour'}</span><ChevronDown className="w-3 h-3 text-slate-500" /></button>
            {activeDropdown === 'time' && (
              <div className="absolute left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 space-y-0.5 z-30">
                {timeFilterOptions.map(option => (<button key={option.key} onClick={() => { setSelectedTimeFilter(option.key); setActiveDropdown(null); setCurrentPage(1); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium ${selectedTimeFilter === option.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{option.label}</button>))}
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setActiveDropdown(activeDropdown === 'methods' ? null : 'methods')} className={`px-3 py-1.5 border text-slate-300 rounded-lg text-xs flex items-center gap-1 font-medium ${selectedMethods.length > 0 ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-800'}`}>Methods {selectedMethods.length > 0 && `(${selectedMethods.length})`}<ChevronDown className="w-3 h-3 text-slate-500" /></button>
            {activeDropdown === 'methods' && (
              <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-1 z-30">
                {['alchemy_getAssetTransfers', 'eth_getLogs', 'eth_getBlockReceipts', 'eth_feeHistory', 'pm_getPaymasterData', 'pm_getPaymasterStubData'].map(m => (
                  <label key={m} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-mono text-slate-300 cursor-pointer"><input type="checkbox" checked={selectedMethods.includes(m)} onChange={() => toggleFilter(m, selectedMethods, setSelectedMethods)} className="rounded border-slate-800 text-blue-500" />{m}</label>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setActiveDropdown(activeDropdown === 'http' ? null : 'http')} className={`px-3 py-1.5 border text-slate-300 rounded-lg text-xs flex items-center gap-1 font-medium ${selectedHttpCodes.length > 0 ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-800'}`}>HTTP codes {selectedHttpCodes.length > 0 && `(${selectedHttpCodes.length})`}<ChevronDown className="w-3 h-3 text-slate-500" /></button>
            {activeDropdown === 'http' && (
              <div className="absolute left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-1 z-30">
                <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded-lg text-xs text-slate-300 cursor-pointer"><input type="checkbox" checked={selectedHttpCodes.includes('200')} onChange={() => toggleFilter('200', selectedHttpCodes, setSelectedHttpCodes)} className="rounded text-blue-500 bg-slate-950" /> Success (200)</label>
                <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded-lg text-xs text-slate-300 cursor-pointer"><input type="checkbox" checked={selectedHttpCodes.includes('error')} onChange={() => toggleFilter('error', selectedHttpCodes, setSelectedHttpCodes)} className="rounded text-blue-500 bg-slate-950" /> Failures / Errors</label>
              </div>
            )}
          </div>
          {(selectedTimeFilter !== 'hour' || selectedMethods.length > 0 || selectedHttpCodes.length > 0) && (<button onClick={handleResetFilters} className="ml-auto p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg"><RotateCcw className="w-4 h-4" /></button>)}
        </div>

        {/* LOGS DATAGRID LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start relative z-10">
          <div className="lg:col-span-2 flex flex-col border border-slate-800 rounded-xl bg-slate-950/20 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/40">
                  <th className="p-3">Method</th><th className="p-3">HTTP</th><th className="p-3">Error Code</th><th className="p-3 text-right">Response Time</th><th className="p-3 text-right">Time Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {currentPagedLogs.map((log) => (
                  <tr key={log.id} onClick={() => setSelectedRequestLog(log)} className={`hover:bg-slate-900/40 cursor-pointer transition-colors ${selectedRequestLog?.id === log.id ? 'bg-slate-800/60 border-l-2 border-l-blue-500' : ''}`}>
                    <td className="p-3 font-mono text-slate-200">{log.method}</td>
                    <td className="p-3"><span className={log.httpStatus === 200 ? "text-emerald-400" : "text-rose-400"}>{log.httpStatus}</span></td>
                    <td className="p-3 font-mono text-slate-500">{log.errorCode}</td>
                    <td className="p-3 text-right text-emerald-400 font-medium">{log.responseTime}</td>
                    <td className="p-3 text-right text-slate-500">{log.timeSent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalItems === 0 && <div className="text-center py-12 text-slate-600 bg-slate-950/20">Không tìm thấy bản ghi log nào.</div>}

            {/* Pagination block */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-800 bg-slate-950/40 gap-4 text-xs text-slate-400">
              <div>Showing <span className="text-slate-200">{totalItems > 0 ? startIndex + 1 : 0}</span> to <span className="text-slate-200">{endIndex}</span> of <span className="text-slate-200">{totalItems}</span> entries</div>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {/* THREE-STAGE INSPECTOR SIDEBAR */}
          <div className="lg:col-span-1 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 shadow-2xl">
            <h3 className="text-xs font-bold uppercase text-slate-300 flex items-center gap-1 border-b border-slate-900 pb-2"><FileCode className="w-4 h-4 text-emerald-400" /> Log Payload Inspector</h3>
            {selectedRequestLog ? (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center"><span className="text-[11px] font-bold uppercase text-slate-400">➔ Request Payload</span>
                    <button onClick={() => { setSelectedRpcMethod(selectedRequestLog.method); setEditableJsonInput(JSON.stringify(selectedRequestLog.requestBody, null, 2)); window.scrollTo({ top: 320, behavior: 'smooth' }); }} className="text-[10px] text-blue-400 hover:underline">Retry in Sandbox</button>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 max-h-36 overflow-auto font-mono text-[11px] text-pink-400"><pre>{JSON.stringify(selectedRequestLog.requestBody, null, 2)}</pre></div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">cURL Shell Code</span>
                  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 font-mono text-[10px] text-slate-400 overflow-x-auto whitespace-pre">{generateCurlCommand(selectedRequestLog)}</div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">⬇ Response Body Payload</span>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 max-h-40 overflow-auto font-mono text-[11px] text-blue-400 custom-scrollbar"><pre>{JSON.stringify(selectedRequestLog.responseBody, null, 2)}</pre></div>
                </div>
              </div>
            ) : <div className="text-slate-600 text-center py-12">Chọn log bên trái để kiểm định.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}