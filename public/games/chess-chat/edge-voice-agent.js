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

  const state = { recognition: null, listening: false, continuous: false };

  const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const denormalizeVi = (text) => text.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

  const squareElement = (square) => document.querySelector(`[aria-label^="Square ${square},"]`);
  const clickSquare = (square) => {
    const el = squareElement(square);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  };
  const speak = (message) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = navigator.language?.startsWith('vi') ? 'vi-VN' : 'en-US';
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

  const runCommand = (raw) => {
    const squares = tokenizeSquares(raw);
    const status = document.querySelector('.edge-voice-agent__status');
    if (/\b(reset|new game|restart|choi lai|van moi)\b/.test(normalize(raw))) {
      document.querySelector('[aria-label="New game"], [title="New game"]')?.click();
      status.textContent = 'Đã gửi lệnh ván mới nếu nút có sẵn.';
      speak('New game command sent.');
      return;
    }
    if (squares.length >= 2) {
      clickSquare(squares[0]);
      setTimeout(() => clickSquare(squares[1]), 140);
      status.textContent = `Đã đi ${squares[0]} → ${squares[1]}.`;
      speak(`Moved ${squares[0]} to ${squares[1]}.`);
      return;
    }
    const pieceSquare = findPieceSquare(raw);
    if (pieceSquare && clickSquare(pieceSquare)) {
      status.textContent = `Đã chọn quân ở ${pieceSquare}.`;
      speak(`Selected ${pieceSquare}.`);
      return;
    }
    status.textContent = 'Chưa hiểu lệnh. Hãy nói ví dụ: “e2 to e4”, “knight g1 f3”, hoặc “chọn vua trắng”.';
    speak('I did not understand that chess command.');
  };

  const setListening = (listening) => {
    state.listening = listening;
    document.querySelector('.edge-voice-agent')?.classList.toggle('is-listening', listening);
    document.querySelector('.edge-voice-agent__listen').textContent = listening ? 'Đang nghe…' : '🎙️ Nói nước đi';
  };

  const startRecognition = () => {
    if (!SpeechRecognition) {
      document.querySelector('.edge-voice-agent__status').textContent = 'Trình duyệt chưa hỗ trợ SpeechRecognition. Hãy dùng Chrome/Edge.';
      return;
    }
    if (!state.recognition) {
      state.recognition = new SpeechRecognition();
      state.recognition.lang = navigator.language?.startsWith('vi') ? 'vi-VN' : 'en-US';
      state.recognition.interimResults = true;
      state.recognition.continuous = false;
      state.recognition.onresult = (event) => {
        const text = [...event.results].map(result => result[0].transcript).join(' ');
        document.querySelector('.edge-voice-agent__transcript').textContent = text;
        if (event.results[event.results.length - 1].isFinal) runCommand(text);
      };
      state.recognition.onend = () => setListening(false);
      state.recognition.onerror = (event) => {
        document.querySelector('.edge-voice-agent__status').textContent = `Lỗi microphone: ${event.error}`;
        setListening(false);
      };
    }
    window.speechSynthesis?.cancel();
    state.recognition.start();
    setListening(true);
  };

  const mount = () => {
    if (document.querySelector('.edge-voice-agent')) return;
    const el = document.createElement('aside');
    el.className = 'edge-voice-agent';
    el.innerHTML = `<div class="edge-voice-agent__card"><div class="edge-voice-agent__header"><div class="edge-voice-agent__orb" aria-hidden="true"></div><div><div class="edge-voice-agent__title">Edge Voice Agent for Chess</div><div class="edge-voice-agent__subtitle">Voice command layer inspired by edge_voice_agent</div></div></div><div class="edge-voice-agent__body"><div class="edge-voice-agent__controls"><button class="edge-voice-agent__button edge-voice-agent__button--primary edge-voice-agent__listen" type="button">🎙️ Nói nước đi</button><button class="edge-voice-agent__button edge-voice-agent__button--danger edge-voice-agent__stop" type="button">Dừng</button></div><div class="edge-voice-agent__transcript">Transcript sẽ hiện ở đây.</div><div class="edge-voice-agent__status">Sẵn sàng: nói <code>e2 to e4</code>, <code>g1 f3</code>, hoặc <code>chọn vua trắng</code>.</div><div class="edge-voice-agent__hint">Tip: dùng tên ô tiếng Anh hoặc Việt không dấu; agent sẽ click trực tiếp lên bàn cờ.</div></div></div>`;
    document.body.appendChild(el);
    el.querySelector('.edge-voice-agent__listen').addEventListener('click', startRecognition);
    el.querySelector('.edge-voice-agent__stop').addEventListener('click', () => {
      state.recognition?.abort();
      window.speechSynthesis?.cancel();
      setListening(false);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
