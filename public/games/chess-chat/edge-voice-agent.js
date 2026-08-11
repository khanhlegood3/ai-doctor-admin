(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const files = 'abcdefgh';
  const ranks = '12345678';
  const pieceWords = {
    pawn: 'p', rook: 'r', castle: 'r', knight: 'n', horse: 'n', bishop: 'b', queen: 'q', king: 'k', tot: 'p', xe: 'r', ma: 'n', tuong: 'b', hau: 'q', vua: 'k'
  };
  const nato = { alpha: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e', foxtrot: 'f', golf: 'g', hotel: 'h' };
  const viFiles = { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f', g: 'g', h: 'h' };
  const viRanks = { một: '1', hai: '2', ba: '3', bốn: '4', tư: '4', năm: '5', sáu: '6', bảy: '7', tám: '8' };

  const LANG_STORAGE_KEY = 'edge-voice-agent:lang';
  const OPEN_STORAGE_KEY = 'edge-voice-agent:open';

  // --- i18n: mọi chuỗi hiển thị trong widget, 2 ngôn ngữ ---
  const STRINGS = {
    vi: {
      title: 'Edge Voice Agent for Chess',
      subtitle: 'Điều khiển bàn cờ bằng giọng nói',
      listen: '🎙️ Nói nước đi',
      listening: 'Đang nghe…',
      stop: 'Dừng',
      transcriptPlaceholder: 'Transcript sẽ hiện ở đây.',
      readyStatus: 'Sẵn sàng: nói "e2 to e4", "g1 f3", hoặc "chọn vua trắng".',
      hint: 'Tip: dùng tên ô tiếng Anh hoặc Việt không dấu; agent sẽ click trực tiếp lên bàn cờ.',
      unsupported: 'Trình duyệt chưa hỗ trợ nhận diện giọng nói. Hãy dùng Chrome/Edge.',
      micError: (e) => `Lỗi microphone: ${e}`,
      newGameSent: 'Đã gửi lệnh ván mới nếu nút có sẵn.',
      moved: (a, b) => `Đã đi ${a} → ${b}.`,
      selected: (sq) => `Đã chọn quân ở ${sq}.`,
      notUnderstood: 'Chưa hiểu lệnh. Hãy nói ví dụ: "e2 to e4", "knight g1 f3", hoặc "chọn vua trắng".',
      collapseLabel: 'Thu nhỏ',
      expandLabel: 'Edge Voice Agent',
      langLabel: 'VI',
      imageSectionTitle: 'Ảnh quân cờ',
      noActivePiece: 'Hãy chọn 1 quân cờ trên bàn để đổi ảnh.',
      activePieceLabel: (name, square) => `Đang chọn: ${name} (${square})`,
      uploadButton: '🖼️ Tải ảnh lên',
      resetButton: '↺ Về ảnh gốc',
      uploadedStatus: (name) => `Đã đổi ảnh cho ${name}.`,
      resetStatus: (name) => `Đã đưa ${name} về ảnh gốc.`,
      invalidImage: 'File không phải là ảnh hợp lệ.',
    },
    en: {
      title: 'Edge Voice Agent for Chess',
      subtitle: 'Voice control layer for the board',
      listen: '🎙️ Say a move',
      listening: 'Listening…',
      stop: 'Stop',
      transcriptPlaceholder: 'Transcript will appear here.',
      readyStatus: 'Ready: say "e2 to e4", "g1 f3", or "select white king".',
      hint: 'Tip: use English square names; the agent clicks directly on the board.',
      unsupported: 'Your browser does not support speech recognition. Please use Chrome/Edge.',
      micError: (e) => `Microphone error: ${e}`,
      newGameSent: 'Sent the new-game command if the button is available.',
      moved: (a, b) => `Moved ${a} → ${b}.`,
      selected: (sq) => `Selected the piece on ${sq}.`,
      notUnderstood: 'Did not understand that. Try: "e2 to e4", "knight g1 f3", or "select white king".',
      collapseLabel: 'Collapse',
      expandLabel: 'Edge Voice Agent',
      langLabel: 'EN',
      imageSectionTitle: 'Piece image',
      noActivePiece: 'Select a piece on the board to change its image.',
      activePieceLabel: (name, square) => `Selected: ${name} (${square})`,
      uploadButton: '🖼️ Upload image',
      resetButton: '↺ Reset to default',
      uploadedStatus: (name) => `Updated the image for ${name}.`,
      resetStatus: (name) => `Reset ${name} back to its default image.`,
      invalidImage: 'That file is not a valid image.',
    },
  };

  const detectDefaultLang = () => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
    return navigator.language?.startsWith('vi') ? 'vi' : 'en';
  };

  const state = {
    recognition: null,
    listening: false,
    lang: detectDefaultLang(),
    open: localStorage.getItem(OPEN_STORAGE_KEY) !== 'closed',
    activePiece: null, // { id, name, square } | null, cập nhật qua event từ React app
    transcriptText: '', // transcript hiện tại, để không bị đè mất khi đổi ngôn ngữ
  };

  const t = () => STRINGS[state.lang];

  const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const denormalizeVi = (text) => text.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

  const squareElement = (square) => document.querySelector(`[aria-label^="Square ${square},"]`);
  const clickSquare = (square) => {
    const el = squareElement(square);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  };
  const speak = (viText, enText) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.lang === 'vi' ? viText : enText);
    utterance.lang = state.lang === 'vi' ? 'vi-VN' : 'en-US';
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  };

  const tokenizeSquares = (raw) => {
    const ascii = normalize(raw);
    const vi = denormalizeVi(raw);
    const candidates = [];
    const compact = ascii.replace(/\s+/g, '');
    compact.replace(/[a-h][1-8]/g, match => { candidates.push(match); return match; });
    const words = ascii.split(' ');
    for (let i = 0; i < words.length - 1; i += 1) {
      const file = nato[words[i]] || viFiles[words[i]] || (files.includes(words[i]) ? words[i] : null);
      const rank = viRanks[words[i + 1]] || (ranks.includes(words[i + 1]) ? words[i + 1] : null);
      if (file && rank) candidates.push(`${file}${rank}`);
    }
    const viWords = vi.split(' ');
    for (let i = 0; i < viWords.length - 1; i += 1) {
      const file = viFiles[viWords[i]];
      const rank = viRanks[viWords[i + 1]];
      if (file && rank) candidates.push(`${file}${rank}`);
    }
    return [...new Set(candidates)];
  };

  const findPieceSquare = (raw) => {
    const ascii = normalize(raw);
    const color = /\bblack\b|\bden\b/.test(ascii) ? 'Black' : /\bwhite\b|\btrang\b/.test(ascii) ? 'White' : '';
    const pieceKey = Object.keys(pieceWords).find(word => new RegExp(`\\b${word}\\b`).test(ascii));
    if (!pieceKey) return null;
    const type = { p: 'Pawn', r: 'Rook', n: 'Knight', b: 'Bishop', q: 'Queen', k: 'King' }[pieceWords[pieceKey]];
    const selector = color ? `[aria-label*="${color} ${type}"]` : `[aria-label*="${type}"]`;
    const el = document.querySelector(selector);
    const match = el?.getAttribute('aria-label')?.match(/Square ([a-h][1-8]),/);
    return match?.[1] || null;
  };

  const setStatus = (text) => {
    const el = document.querySelector('.edge-voice-agent__status');
    if (el) el.textContent = text;
  };

  const runCommand = (raw) => {
    state.hasRunCommand = true;
    const squares = tokenizeSquares(raw);
    if (/\b(reset|new game|restart|choi lai|van moi)\b/.test(normalize(raw))) {
      document.querySelector('[aria-label="New game"], [title="New game"]')?.click();
      setStatus(t().newGameSent);
      speak('Đã gửi lệnh ván mới.', 'New game command sent.');
      return;
    }
    if (squares.length >= 2) {
      clickSquare(squares[0]);
      setTimeout(() => clickSquare(squares[1]), 140);
      setStatus(t().moved(squares[0], squares[1]));
      speak(`Đã đi ${squares[0]} tới ${squares[1]}.`, `Moved ${squares[0]} to ${squares[1]}.`);
      return;
    }
    const pieceSquare = findPieceSquare(raw);
    if (pieceSquare && clickSquare(pieceSquare)) {
      setStatus(t().selected(pieceSquare));
      speak(`Đã chọn ô ${pieceSquare}.`, `Selected ${pieceSquare}.`);
      return;
    }
    setStatus(t().notUnderstood);
    speak('Chưa hiểu lệnh vừa nói.', 'I did not understand that chess command.');
  };

  const setListening = (listening) => {
    state.listening = listening;
    document.querySelector('.edge-voice-agent')?.classList.toggle('is-listening', listening);
    const btn = document.querySelector('.edge-voice-agent__listen');
    if (btn) btn.textContent = listening ? t().listening : t().listen;
  };

  const startRecognition = () => {
    if (!SpeechRecognition) {
      setStatus(t().unsupported);
      return;
    }
    // Luôn tạo lại instance khi bắt đầu nghe để áp dụng đúng `lang` hiện tại
    // (đổi ngôn ngữ giữa các lượt nói không cần reload trang).
    state.recognition = new SpeechRecognition();
    state.recognition.lang = state.lang === 'vi' ? 'vi-VN' : 'en-US';
    state.recognition.interimResults = true;
    state.recognition.continuous = false;
    state.recognition.onresult = (event) => {
      const text = [...event.results].map(result => result[0].transcript).join(' ');
      state.transcriptText = text;
      const el = document.querySelector('.edge-voice-agent__transcript');
      if (el) el.textContent = text;
      if (event.results[event.results.length - 1].isFinal) runCommand(text);
    };
    state.recognition.onend = () => setListening(false);
    state.recognition.onerror = (event) => {
      setStatus(t().micError(event.error));
      setListening(false);
    };
    window.speechSynthesis?.cancel();
    state.recognition.start();
    setListening(true);
  };

  // --- Toggle mở/đóng widget ---
  const applyOpenState = () => {
    const el = document.querySelector('.edge-voice-agent');
    if (!el) return;
    el.classList.toggle('is-collapsed', !state.open);
    const toggleBtn = document.querySelector('.edge-voice-agent__collapse');
    if (toggleBtn) toggleBtn.setAttribute('aria-label', state.open ? t().collapseLabel : t().expandLabel);
  };
  const setOpen = (open) => {
    state.open = open;
    localStorage.setItem(OPEN_STORAGE_KEY, open ? 'open' : 'closed');
    applyOpenState();
  };

  // --- Toggle ngôn ngữ VI/EN: đổi mọi chuỗi hiển thị + lang của STT/TTS ---
  const applyLanguageTexts = () => {
    const strings = t();
    const set = (selector, text) => { const el = document.querySelector(selector); if (el && text !== undefined) el.textContent = text; };
    set('.edge-voice-agent__title', strings.title);
    set('.edge-voice-agent__subtitle', strings.subtitle);
    set('.edge-voice-agent__hint', strings.hint);
    set('.edge-voice-agent__lang-toggle', strings.langLabel);
    set('.edge-voice-agent__image-title', strings.imageSectionTitle);
    set('.edge-voice-agent__upload-label', strings.uploadButton);
    set('.edge-voice-agent__reset', strings.resetButton);
    const listenBtn = document.querySelector('.edge-voice-agent__listen');
    if (listenBtn) listenBtn.textContent = state.listening ? strings.listening : strings.listen;
    const stopBtn = document.querySelector('.edge-voice-agent__stop');
    if (stopBtn) stopBtn.textContent = strings.stop;
    // Transcript/status hiện tại được GIỮ NGUYÊN khi đổi ngôn ngữ (không dịch
    // lại nội dung động) — chỉ khi widget còn ở trạng thái ban đầu (chưa
    // nói gì, chưa có lệnh nào) thì mới cập nhật theo ngôn ngữ mới.
    if (!state.transcriptText) set('.edge-voice-agent__transcript', strings.transcriptPlaceholder);
    if (!state.hasRunCommand) setStatus(strings.readyStatus);
    updateActivePieceUI();
  };
  const LANG_CHANGE_EVENT = 'chesschat:lang-changed';
  const setLang = (lang) => {
    state.lang = lang;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    applyLanguageTexts();
    applyOpenState();
    // Báo cho React app (src/App.tsx) đồng bộ ngôn ngữ UI + ngôn ngữ AI
    // (system prompt, STT, TTS) — xem src/lib/i18n.ts / SettingsContext.tsx.
    window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: { lang } }));
  };

  // --- Upload / Reset ảnh quân cờ (qua window.ChessChatBridge do React app cung cấp) ---
  const updateActivePieceUI = () => {
    const strings = t();
    const label = document.querySelector('.edge-voice-agent__piece-label');
    const uploadInput = document.querySelector('.edge-voice-agent__upload-input');
    const uploadLabel = document.querySelector('.edge-voice-agent__upload');
    const resetBtn = document.querySelector('.edge-voice-agent__reset');
    const piece = state.activePiece || window.ChessChatBridge?.getActivePiece?.() || null;
    if (label) label.textContent = piece ? strings.activePieceLabel(piece.name, piece.square) : strings.noActivePiece;
    [uploadInput, uploadLabel, resetBtn].forEach(el => { if (el) el.toggleAttribute('disabled', !piece); });
    if (uploadLabel) uploadLabel.classList.toggle('is-disabled', !piece);
  };

  const handleImageFile = (file) => {
    const piece = state.activePiece || window.ChessChatBridge?.getActivePiece?.();
    if (!piece || !file) return;
    if (!file.type.startsWith('image/')) {
      setStatus(t().invalidImage);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string' && window.ChessChatBridge?.setPieceImage(piece.id, dataUrl)) {
        setStatus(t().uploadedStatus(piece.name));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetImage = () => {
    const piece = state.activePiece || window.ChessChatBridge?.getActivePiece?.();
    if (!piece) return;
    if (window.ChessChatBridge?.resetPieceImage(piece.id)) {
      setStatus(t().resetStatus(piece.name));
    }
  };

  const mount = () => {
    if (document.querySelector('.edge-voice-agent')) return;
    const strings = t();
    const el = document.createElement('aside');
    el.className = 'edge-voice-agent';
    el.innerHTML = `
      <div class="edge-voice-agent__card">
        <div class="edge-voice-agent__header">
          <div class="edge-voice-agent__orb" aria-hidden="true"></div>
          <div class="edge-voice-agent__header-text">
            <div class="edge-voice-agent__title">${strings.title}</div>
            <div class="edge-voice-agent__subtitle">${strings.subtitle}</div>
          </div>
          <button class="edge-voice-agent__lang-toggle" type="button" title="Vietnamese / English">${strings.langLabel}</button>
          <button class="edge-voice-agent__collapse" type="button" aria-label="${strings.collapseLabel}">–</button>
        </div>
        <div class="edge-voice-agent__body">
          <div class="edge-voice-agent__controls">
            <button class="edge-voice-agent__button edge-voice-agent__button--primary edge-voice-agent__listen" type="button">${strings.listen}</button>
            <button class="edge-voice-agent__button edge-voice-agent__button--danger edge-voice-agent__stop" type="button">${strings.stop}</button>
          </div>
          <div class="edge-voice-agent__transcript">${strings.transcriptPlaceholder}</div>
          <div class="edge-voice-agent__status">${strings.readyStatus}</div>
          <div class="edge-voice-agent__hint">${strings.hint}</div>
          <div class="edge-voice-agent__divider"></div>
          <div class="edge-voice-agent__image-title">${strings.imageSectionTitle}</div>
          <div class="edge-voice-agent__piece-label">${strings.noActivePiece}</div>
          <div class="edge-voice-agent__controls">
            <label class="edge-voice-agent__button edge-voice-agent__upload" for="edge-voice-agent-upload-input">
              <span class="edge-voice-agent__upload-label">${strings.uploadButton}</span>
            </label>
            <input class="edge-voice-agent__upload-input" id="edge-voice-agent-upload-input" type="file" accept="image/*" hidden />
            <button class="edge-voice-agent__button edge-voice-agent__reset" type="button">${strings.resetButton}</button>
          </div>
        </div>
      </div>
      <button class="edge-voice-agent__reopen" type="button" aria-label="${strings.expandLabel}">🎙️</button>
    `;
    document.body.appendChild(el);

    el.querySelector('.edge-voice-agent__listen').addEventListener('click', startRecognition);
    el.querySelector('.edge-voice-agent__stop').addEventListener('click', () => {
      state.recognition?.abort();
      window.speechSynthesis?.cancel();
      setListening(false);
    });
    el.querySelector('.edge-voice-agent__collapse').addEventListener('click', () => setOpen(false));
    el.querySelector('.edge-voice-agent__reopen').addEventListener('click', () => setOpen(true));
    el.querySelector('.edge-voice-agent__lang-toggle').addEventListener('click', () => setLang(state.lang === 'vi' ? 'en' : 'vi'));
    el.querySelector('.edge-voice-agent__upload-input').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      handleImageFile(file);
      e.target.value = '';
    });
    el.querySelector('.edge-voice-agent__reset').addEventListener('click', handleResetImage);

    // React app (src/App.tsx) báo quân cờ đang active qua CustomEvent này.
    window.addEventListener('chesschat:active-piece-changed', (e) => {
      state.activePiece = e.detail || null;
      updateActivePieceUI();
    });
    // Nếu ngôn ngữ bị đổi từ phía React (ví dụ sau này có toggle trong app),
    // đồng bộ lại UI của widget này theo.
    window.addEventListener(LANG_CHANGE_EVENT, (e) => {
      const newLang = e.detail?.lang;
      if ((newLang === 'vi' || newLang === 'en') && newLang !== state.lang) {
        state.lang = newLang;
        localStorage.setItem(LANG_STORAGE_KEY, newLang);
        applyLanguageTexts();
        applyOpenState();
      }
    });

    applyOpenState();
    updateActivePieceUI();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
