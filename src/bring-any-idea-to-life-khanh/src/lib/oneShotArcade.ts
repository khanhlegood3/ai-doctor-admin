/**
 * One Shot Arcade — chuyển thể từ one-shot-arcade.zip (bản gốc AI Studio,
 * dùng @google/genai / Gemini "Nano Banana Pro") sang hạ tầng sẵn có của dự
 * án (Groq + Pollinations ẩn danh, xem api/_lib/arcadeSprite.js).
 *
 * KHÁC với 9 mẫu trong DEMO_TEMPLATES (xem demoTemplates/index.ts): mẫu đó
 * CỐ Ý không gọi AI. File này thì NGƯỢC LẠI — gọi AI thật (Groq Vision để mô
 * tả ảnh, Pollinations "flux" ẩn danh để sinh sprite, Groq text cho lời
 * thoại villain) — nên được thêm như MỘT MỤC RIÊNG trong App.tsx, không nằm
 * trong mảng DEMO_TEMPLATES, để không phá vỡ tài liệu "KHÔNG gọi AI" của bộ
 * mẫu đó.
 *
 * Vẫn dùng chung cơ chế hiển thị với DEMO_TEMPLATES/LivePreview: đây là 1
 * chuỗi HTML tự chứa, được set làm `creation.html` rồi render trong
 * <iframe srcDoc sandbox="... allow-same-origin">. Nhờ allow-same-origin +
 * srcDoc, fetch('/api/groq-proxy') bên trong vẫn trỏ đúng domain thật đang
 * chạy app (không bị CORS).
 *
 * Đánh đổi đã biết trước so với bản Gemini gốc:
 *   - Bản gốc: image-to-image, sprite GIỮ NGUYÊN khuôn mặt thật của người
 *     chơi. Bản này: Pollinations "flux" chỉ nhận text-to-image (không có
 *     ảnh tham chiếu) — nên sprite được sinh từ MÔ TẢ CHỮ (do Groq Vision
 *     đọc ảnh rồi mô tả lại: màu tóc, trang phục, đặc điểm nổi bật...),
 *     không phải chuyển đổi 1:1 khuôn mặt thật.
 *   - Không có "villain sống" qua Gemini Live API (audio 2 chiều thời gian
 *     thực) — thay bằng lời thoại text ngắn (Groq) + đọc qua
 *     /api/google-tts?tl=vi (đã có sẵn trong dự án) mỗi khi villain lại gần.
 */

export const ONE_SHOT_ARCADE_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>One Shot Arcade</title>
<style>
  :root{ --neon:#05d9e8; --neon-dim:#0a8a99; --bg:#050608; --danger:#ff2e6c; --gold:#ffd23f; }
  *{ box-sizing:border-box; }
  html,body{ margin:0; padding:0; height:100%; background:var(--bg); color:var(--neon); font-family:'Courier New', monospace; overflow:hidden; }
  #root{ position:relative; width:100%; height:100%; display:flex; flex-direction:column; }
  .crt{ position:absolute; inset:0; pointer-events:none; z-index:30;
    background:repeating-linear-gradient(rgba(0,0,0,0) 0px, rgba(0,0,0,0) 1px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0) 3px);
    box-shadow: inset 0 0 12vw rgba(0,0,0,0.75); mix-blend-mode:normal; }
  .glow{ text-shadow:0 0 6px var(--neon), 0 0 14px var(--neon); }
  .panel{ border:3px solid var(--neon); border-radius:10px; box-shadow:0 0 14px rgba(5,217,232,0.45); background:rgba(5,10,14,0.85); }
  .screen{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:18px; text-align:center; }
  h1{ font-size:clamp(22px,5vw,40px); letter-spacing:4px; margin:0 0 4px; }
  .sub{ color:#7fe8ef; font-size:12px; letter-spacing:2px; opacity:0.85; }
  button{ font-family:inherit; cursor:pointer; }
  .btn{ background:transparent; color:var(--neon); border:2px solid var(--neon); border-radius:8px; padding:10px 18px; font-size:13px; letter-spacing:2px; text-transform:uppercase; transition:all .15s; }
  .btn:hover:not(:disabled){ background:var(--neon); color:#00191d; box-shadow:0 0 16px var(--neon); }
  .btn:disabled{ opacity:0.35; cursor:not-allowed; }
  .btn.danger{ border-color:var(--danger); color:var(--danger); }
  .btn.danger:hover:not(:disabled){ background:var(--danger); color:#1a0007; box-shadow:0 0 16px var(--danger); }
  .btn.gold{ border-color:var(--gold); color:var(--gold); }
  .btn.gold:hover:not(:disabled){ background:var(--gold); color:#1a1300; box-shadow:0 0 16px var(--gold); }
  .row{ display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
  .villains{ display:flex; gap:14px; flex-wrap:wrap; justify-content:center; margin:6px 0; }
  .villain-card{ width:96px; padding:10px 6px; border:2px solid #234; border-radius:8px; font-size:34px; cursor:pointer; background:rgba(255,255,255,0.02); }
  .villain-card.sel{ border-color:var(--danger); box-shadow:0 0 12px var(--danger); }
  .villain-card small{ display:block; margin-top:4px; font-size:10px; color:#9bb; letter-spacing:1px; }
  .upload{ border:2px dashed var(--neon-dim); border-radius:10px; padding:16px; font-size:12px; color:#9be; cursor:pointer; max-width:320px; }
  .upload img{ max-width:96px; max-height:96px; border-radius:6px; display:block; margin:8px auto 0; }
  .hud{ position:absolute; top:0; left:0; right:0; display:flex; justify-content:space-between; padding:8px 14px; font-size:12px; z-index:15; letter-spacing:1px; }
  .hud span{ margin-right:14px; }
  #gameCanvas{ image-rendering:pixelated; background:#050b14; border:3px solid var(--neon-dim); border-radius:6px; touch-action:none; }
  .dpad{ position:absolute; bottom:14px; left:14px; display:grid; grid-template-columns:44px 44px 44px; grid-template-rows:44px 44px 44px; gap:4px; z-index:20; }
  .dpad button{ background:rgba(5,217,232,0.12); border:2px solid var(--neon); color:var(--neon); border-radius:6px; font-size:16px; }
  .bubble{ position:absolute; z-index:22; background:#12030a; border:2px solid var(--danger); color:#ffb3c8; border-radius:8px; padding:6px 10px; font-size:11px; max-width:200px; pointer-events:none; box-shadow:0 0 10px rgba(255,46,108,0.5); }
  .loading-lines{ font-size:11px; color:#7fe8ef; line-height:1.9; min-height:80px; }
  .loading-lines .ok{ color:#5cff9e; }
  .loading-lines .cur{ color:var(--gold); }
  .spinner{ width:22px; height:22px; border:3px solid rgba(5,217,232,0.25); border-top-color:var(--neon); border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto; }
  @keyframes spin{ to{ transform:rotate(360deg); } }
  .lb{ text-align:left; font-size:11px; max-height:160px; overflow:auto; width:min(320px,80vw); }
  .lb-row{ display:flex; justify-content:space-between; padding:3px 6px; border-bottom:1px dashed rgba(5,217,232,0.2); }
  .warn{ color:var(--gold); font-size:11px; max-width:340px; }
  .hidden{ display:none !important; }
  ::-webkit-scrollbar{ width:6px; } ::-webkit-scrollbar-thumb{ background:var(--neon-dim); border-radius:3px; }
</style>
</head>
<body>
<div id="root">
  <div class="crt"></div>

  <!-- ===== TITLE SCREEN ===== -->
  <div id="titleScreen" class="screen">
    <h1 class="glow">🕹️ ONE SHOT ARCADE</h1>
    <div class="sub">ẢNH CỦA BẠN → NHÂN VẬT GAME · AI SINH BẰNG GROQ + POLLINATIONS</div>

    <label class="upload panel" id="uploadBox">
      <div id="uploadHint">📸 Bấm để chọn ảnh chân dung của bạn (không bắt buộc)</div>
      <img id="uploadPreview" class="hidden" />
      <input id="fileInput" type="file" accept="image/*" class="hidden" />
    </label>

    <div class="sub" style="margin-top:6px;">Chọn quái vật đối đầu</div>
    <div class="villains" id="villainPicker"></div>

    <div class="row">
      <button class="btn gold" id="startBtn">▶ BẮT ĐẦU</button>
      <button class="btn" id="lbOpenBtn">🏆 BẢNG XẾP HẠNG</button>
    </div>
    <div class="warn" id="titleWarn"></div>
  </div>

  <!-- ===== LOADING SCREEN ===== -->
  <div id="loadingScreen" class="screen hidden">
    <h1 class="glow" style="font-size:20px;">ĐANG DỰNG THẾ GIỚI...</h1>
    <div class="spinner"></div>
    <div class="loading-lines panel" id="loadingLines" style="padding:12px 18px;"></div>
    <div class="sub" id="loadingNote">Ảnh sinh miễn phí có thể mất ~15s/ảnh do giới hạn tốc độ của Pollinations.</div>
  </div>

  <!-- ===== GAME SCREEN ===== -->
  <div id="gameScreen" class="screen hidden" style="padding:6px; gap:8px;">
    <div class="hud panel" style="position:relative; width:100%; max-width:640px; border-radius:8px; padding:6px 12px;">
      <span>❤️ <span id="hudLives">3</span></span>
      <span>🪙 <span id="hudCoins">0</span>/<span id="hudCoinsTotal">0</span></span>
      <span>⏱ <span id="hudTime">0</span>s</span>
    </div>
    <div style="position:relative;">
      <canvas id="gameCanvas" width="480" height="352"></canvas>
      <div class="dpad">
        <div></div><button data-dir="up">▲</button><div></div>
        <button data-dir="left">◀</button><div></div><button data-dir="right">▶</button>
        <div></div><button data-dir="down">▼</button><div></div>
      </div>
    </div>
    <div class="sub">Di chuyển: phím mũi tên / WASD / D-Pad — né quái, gom hết vàng rồi ra CỬA THOÁT 🚪</div>
  </div>

  <!-- ===== END SCREEN ===== -->
  <div id="endScreen" class="screen hidden">
    <h1 class="glow" id="endTitle">GAME OVER</h1>
    <div id="endSceneWrap"></div>
    <div class="sub" id="endStats"></div>
    <div class="row">
      <button class="btn gold" id="retryBtn">↻ CHƠI LẠI</button>
      <button class="btn" id="lbOpenBtn2">🏆 BẢNG XẾP HẠNG</button>
    </div>
  </div>

  <!-- ===== LEADERBOARD OVERLAY ===== -->
  <div id="lbScreen" class="screen hidden">
    <h1 class="glow" style="font-size:18px;">🏆 TOP NGƯỜI CHƠI</h1>
    <div class="lb panel" id="lbList" style="padding:8px;"></div>
    <button class="btn" id="lbCloseBtn">ĐÓNG</button>
  </div>
</div>

<script>
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Cấu hình chung
  // ---------------------------------------------------------------------
  var GAME_ID = 'one-shot-arcade';
  var GAME_TITLE = 'One Shot Arcade';
  var COLS = 15, ROWS = 11, CELL = 32;
  var VILLAIN_PRESETS = [
    { id: 'robot', emoji: '🤖', label: 'Robot', desc: 'a menacing chrome retro robot with glowing red eyes and jagged metal armor' },
    { id: 'vampire', emoji: '🧛', label: 'Ma Cà Rồng', desc: 'a pale gothic vampire villain with a dark cape and sharp fangs, glowing purple eyes' },
    { id: 'ninja', emoji: '🥷', label: 'Ninja Bóng Tối', desc: 'a shadowy ninja villain in black with glowing crimson eyes and twin daggers' },
  ];

  function uid() {
    var k = 'osa_uuid';
    try {
      var v = localStorage.getItem(k);
      if (!v) { v = 'osa-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return 'osa-' + Math.random().toString(36).slice(2); }
  }
  function playerName() {
    try { return localStorage.getItem('osa_name') || 'Ẩn danh'; } catch (e) { return 'Ẩn danh'; }
  }

  // ---------------------------------------------------------------------
  // API helpers — gọi thẳng /api/groq-proxy (đang chạy) từ trong iframe.
  // srcDoc + sandbox="... allow-same-origin" khiến iframe kế thừa origin
  // của trang cha nên fetch tương đối vẫn trúng đúng domain thật.
  // ---------------------------------------------------------------------
  function apiPost(body) {
    return fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  function describePhotoFromBase64(base64, mimeType) {
    var messages = [
      { role: 'system', content: 'Bạn mô tả NGOẠI HÌNH trong ảnh (kiểu tóc, màu tóc, màu áo/trang phục, phụ kiện nổi bật) bằng 1 câu tiếng Anh ngắn (<=25 từ), phong cách trung tính, phù hợp để vẽ nhân vật pixel art retro. KHÔNG đoán danh tính, KHÔNG mô tả khuôn mặt chi tiết, chỉ mô tả phong cách/trang phục/màu sắc tổng quát.' },
      { role: 'user', content: [
        { type: 'text', text: 'Describe the outfit and overall vibe of this person for a retro pixel-art game sprite, one short sentence.' },
        { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64 } },
      ] },
    ];
    return apiPost({ model: 'meta-llama/llama-4-scout-17b-16e-instruct', max_tokens: 120, messages: messages })
      .then(function (data) {
        var text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        return text.trim() || 'a cheerful adventurer in a blue jacket';
      });
  }

  function retryable(fn, tries) {
    tries = tries || 3;
    return fn().catch(function (err) {
      if (tries <= 1) throw err;
      var isRateLimit = /giới hạn tần suất|429/i.test(String(err && err.message));
      var wait = isRateLimit ? 16000 : 2500;
      return new Promise(function (resolve) { setTimeout(resolve, wait); }).then(function () { return retryable(fn, tries - 1); });
    });
  }

  function generateSprite(description) {
    return retryable(function () {
      return apiPost({ provider: 'arcade-sprite', action: 'sprite', description: description });
    });
  }
  function generateScene(description, villainDescription) {
    return retryable(function () {
      return apiPost({ provider: 'arcade-sprite', action: 'scene', description: description, villainDescription: villainDescription });
    }, 2);
  }
  function generateTaunt(villainDescription, situation) {
    return apiPost({ provider: 'arcade-sprite', action: 'taunt', villainDescription: villainDescription, situation: situation, lang: 'vi' })
      .then(function (d) { return d.line; })
      .catch(function () { return null; });
  }

  // Xoá nền xanh lục (#00ff66) mà backend yêu cầu AI vẽ, biến thành trong
  // suốt — cùng ý tưởng "chroma key" như processSpriteImage() bản gốc.
  function stripGreenBackground(base64, mimeType) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try {
          var data = ctx.getImageData(0, 0, c.width, c.height);
          var d = data.data;
          for (var i = 0; i < d.length; i += 4) {
            var r = d[i], g = d[i + 1], b = d[i + 2];
            if (g > 140 && g > r * 1.35 && g > b * 1.35) d[i + 3] = 0;
          }
          ctx.putImageData(data, 0, 0);
        } catch (e) { /* CORS lỗi hiếm gặp — giữ ảnh gốc nếu không xoá được nền */ }
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = function () { resolve('data:' + mimeType + ';base64,' + base64); };
      img.src = 'data:' + mimeType + ';base64,' + base64;
    });
  }

  // ---------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var screens = { title: $('titleScreen'), loading: $('loadingScreen'), game: $('gameScreen'), end: $('endScreen'), lb: $('lbScreen') };
  function show(name) {
    Object.keys(screens).forEach(function (k) { screens[k].classList.toggle('hidden', k !== name); });
  }

  // --- Title screen: upload + villain picker ---
  var heroFile = null, heroBase64 = null, heroMime = null;
  var selectedVillain = VILLAIN_PRESETS[0];

  var villainPicker = $('villainPicker');
  VILLAIN_PRESETS.forEach(function (v) {
    var el = document.createElement('div');
    el.className = 'villain-card panel' + (v.id === selectedVillain.id ? ' sel' : '');
    el.dataset.id = v.id;
    el.innerHTML = v.emoji + '<small>' + v.label + '</small>';
    el.onclick = function () {
      selectedVillain = v;
      Array.prototype.forEach.call(villainPicker.children, function (c) { c.classList.toggle('sel', c.dataset.id === v.id); });
    };
    villainPicker.appendChild(el);
  });

  $('uploadBox').onclick = function () { $('fileInput').click(); };
  $('fileInput').onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    heroFile = f;
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = String(reader.result);
      var m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (m) { heroMime = m[1]; heroBase64 = m[2]; }
      $('uploadPreview').src = dataUrl;
      $('uploadPreview').classList.remove('hidden');
      $('uploadHint').textContent = '✅ ' + f.name;
    };
    reader.readAsDataURL(f);
  };

  // ---------------------------------------------------------------------
  // Loading flow: mô tả ảnh (nếu có) -> sinh sprite hero + villain
  // ---------------------------------------------------------------------
  var loadingLinesEl = $('loadingLines');
  function setLoadingSteps(steps) {
    loadingLinesEl.innerHTML = steps.map(function (s) {
      return '<div class="' + (s.status === 'done' ? 'ok' : s.status === 'active' ? 'cur' : '') + '">' +
        (s.status === 'done' ? '✔' : s.status === 'active' ? '…' : '·') + ' ' + s.label + '</div>';
    }).join('');
  }

  var heroSpriteUrl = null, villainSpriteUrl = null, heroDescription = null;

  $('startBtn').onclick = function () {
    show('loading');
    var steps = [
      { label: 'Phân tích ảnh của bạn', status: heroBase64 ? 'active' : 'skip' },
      { label: 'Vẽ sprite nhân vật của bạn', status: 'pending' },
      { label: 'Triệu hồi ' + selectedVillain.label, status: 'pending' },
    ];
    setLoadingSteps(steps);
    $('titleWarn').textContent = '';

    var descPromise = heroBase64
      ? describePhotoFromBase64(heroBase64, heroMime).catch(function () { return 'a cheerful adventurer in a blue jacket'; })
      : Promise.resolve('a cheerful pixel-art adventurer with a red scarf');

    descPromise.then(function (desc) {
      heroDescription = desc;
      steps[0].status = 'done'; steps[1].status = 'active'; setLoadingSteps(steps);
      return generateSprite(desc);
    }).then(function (heroImg) {
      steps[1].status = 'done'; steps[2].status = 'active'; setLoadingSteps(steps);
      return stripGreenBackground(heroImg.imageBase64, heroImg.mimeType).then(function (url) { heroSpriteUrl = url; });
    }).then(function () {
      return generateSprite(selectedVillain.desc);
    }).then(function (vImg) {
      steps[2].status = 'done'; setLoadingSteps(steps);
      return stripGreenBackground(vImg.imageBase64, vImg.mimeType).then(function (url) { villainSpriteUrl = url; });
    }).then(function () {
      startGame();
    }).catch(function (err) {
      show('title');
      $('titleWarn').textContent = '⚠ Không sinh được nhân vật AI (' + (err && err.message || 'lỗi không rõ') + '). Đang dùng nhân vật mặc định để bạn vẫn chơi được.';
      heroSpriteUrl = null; villainSpriteUrl = null;
      startGame();
    });
  };

  // ---------------------------------------------------------------------
  // Sinh mê cung (recursive backtracker) — 1 = tường, 0 = đường đi
  // ---------------------------------------------------------------------
  function buildMaze() {
    var w = COLS, h = ROWS;
    var grid = [];
    for (var y = 0; y < h; y++) { grid.push(new Array(w).fill(1)); }
    function carve(cx, cy) {
      grid[cy][cx] = 0;
      var dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
      for (var i = dirs.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = dirs[i]; dirs[i] = dirs[j]; dirs[j] = t; }
      dirs.forEach(function (d) {
        var nx = cx + d[0], ny = cy + d[1];
        if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && grid[ny][nx] === 1) {
          grid[cy + d[1] / 2][cx + d[0] / 2] = 0;
          carve(nx, ny);
        }
      });
    }
    carve(1, 1);
    grid[1][1] = 0; grid[h - 2][w - 2] = 0;
    return grid;
  }

  // ---------------------------------------------------------------------
  // Trạng thái game
  // ---------------------------------------------------------------------
  var canvas = $('gameCanvas'), ctx = canvas.getContext('2d');
  var maze, coins, lives, coinsCollected, coinsTotal, elapsed, timerHandle, rafHandle;
  var player, villain, exitCell, keys = {}, gameRunning = false, lastTauntAt = 0;
  var heroImgObj = null, villainImgObj = null;

  function loadImg(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  function startGame() {
    maze = buildMaze();
    coins = [];
    for (var y = 1; y < ROWS - 1; y++) {
      for (var x = 1; x < COLS - 1; x++) {
        if (maze[y][x] === 0 && Math.random() < 0.12 && !(x === 1 && y === 1)) coins.push({ x: x, y: y, taken: false });
      }
    }
    coinsTotal = coins.length; coinsCollected = 0;
    lives = 3; elapsed = 0;
    player = { x: 1, y: 1 };
    villain = { x: COLS - 2, y: ROWS - 2, path: [] };
    exitCell = { x: COLS - 2, y: ROWS - 2 };
    $('hudCoinsTotal').textContent = coinsTotal;
    $('hudCoins').textContent = 0;
    $('hudLives').textContent = lives;

    Promise.all([loadImg(heroSpriteUrl), loadImg(villainSpriteUrl)]).then(function (imgs) {
      heroImgObj = imgs[0]; villainImgObj = imgs[1];
      show('game');
      gameRunning = true;
      lastTauntAt = Date.now();
      clearInterval(timerHandle);
      timerHandle = setInterval(function () { elapsed++; $('hudTime').textContent = elapsed; }, 1000);
      cancelAnimationFrame(rafHandle);
      loop();
    });
  }

  function cellFree(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS && maze[y][x] === 0; }

  function bfsNextStep(from, to) {
    var qq = [[from.x, from.y]], visited = {}, parent = {};
    var key = function (x, y) { return x + ',' + y; };
    visited[key(from.x, from.y)] = true;
    while (qq.length) {
      var cur = qq.shift(); var cx = cur[0], cy = cur[1];
      if (cx === to.x && cy === to.y) break;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = cx + d[0], ny = cy + d[1];
        if (cellFree(nx, ny) && !visited[key(nx, ny)]) {
          visited[key(nx, ny)] = true; parent[key(nx, ny)] = key(cx, cy); qq.push([nx, ny]);
        }
      });
    }
    var k = key(to.x, to.y);
    if (!visited[k]) return null;
    var path = [k];
    while (parent[k] && parent[k] !== key(from.x, from.y)) { k = parent[k]; path.push(k); }
    var first = path[path.length - 1] || key(to.x, to.y);
    var parts = first.split(','); return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) };
  }

  var moveAccum = 0, villainAccum = 0;
  function loop() {
    if (!gameRunning) return;
    handleInput();
    updateVillain();
    render();
    maybeTaunt();
    rafHandle = requestAnimationFrame(loop);
  }

  function handleInput() {
    moveAccum++;
    if (moveAccum < 9) return; // tốc độ di chuyển player
    moveAccum = 0;
    var dx = 0, dy = 0;
    if (keys.up) dy = -1; else if (keys.down) dy = 1;
    else if (keys.left) dx = -1; else if (keys.right) dx = 1;
    if (dx || dy) {
      var nx = player.x + dx, ny = player.y + dy;
      if (cellFree(nx, ny)) { player.x = nx; player.y = ny; }
    }
    coins.forEach(function (c) {
      if (!c.taken && c.x === player.x && c.y === player.y) { c.taken = true; coinsCollected++; $('hudCoins').textContent = coinsCollected; }
    });
    if (player.x === exitCell.x && player.y === exitCell.y) { endGame(true); }
  }

  function updateVillain() {
    villainAccum++;
    if (villainAccum < 16) return; // villain chậm hơn player 1 chút
    villainAccum = 0;
    var step = bfsNextStep(villain, player);
    if (step) { villain.x = step.x; villain.y = step.y; }
    if (villain.x === player.x && villain.y === player.y) {
      lives--; $('hudLives').textContent = lives;
      player.x = 1; player.y = 1;
      if (lives <= 0) endGame(false);
    }
  }

  var tauntBubble = null;
  function maybeTaunt() {
    var now = Date.now();
    if (now - lastTauntAt < 9000) return;
    var distNow = Math.abs(villain.x - player.x) + Math.abs(villain.y - player.y);
    if (distNow > 6 && Math.random() > 0.3) return;
    lastTauntAt = now;
    generateTaunt(selectedVillain.desc, 'the hero is ' + distNow + ' tiles away, ' + coinsCollected + '/' + coinsTotal + ' coins collected').then(function (line) {
      if (!line || !gameRunning) return;
      tauntBubble = { text: line, until: Date.now() + 4500 };
    });
  }

  function render() {
    ctx.fillStyle = '#050b14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (maze[y][x] === 1) { ctx.fillStyle = '#0a2a33'; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); ctx.strokeStyle = 'rgba(5,217,232,0.15)'; ctx.strokeRect(x * CELL, y * CELL, CELL, CELL); }
      }
    }
    ctx.fillStyle = '#ffd23f';
    ctx.font = (CELL * 0.6) + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🚪', exitCell.x * CELL + CELL / 2, exitCell.y * CELL + CELL / 2);
    coins.forEach(function (c) { if (!c.taken) ctx.fillText('🪙', c.x * CELL + CELL / 2, c.y * CELL + CELL / 2); });

    drawSprite(villainImgObj, villain.x, villain.y, '👾');
    drawSprite(heroImgObj, player.x, player.y, '🧑');

    if (tauntBubble && Date.now() < tauntBubble.until) {
      ctx.save();
      var bx = villain.x * CELL, by = villain.y * CELL - 8;
      ctx.font = '10px monospace'; ctx.textAlign = 'left';
      var w = Math.min(180, 8 + tauntBubble.text.length * 5.4);
      ctx.fillStyle = 'rgba(18,3,10,0.92)'; ctx.strokeStyle = '#ff2e6c'; ctx.lineWidth = 1.5;
      var bh = 22;
      var boxX = Math.max(2, Math.min(canvas.width - w - 2, bx - w / 2));
      var boxY = Math.max(2, by - bh);
      ctx.beginPath(); ctx.rect(boxX, boxY, w, bh); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb3c8';
      ctx.fillText(tauntBubble.text.slice(0, 32), boxX + 5, boxY + bh / 2 + 3);
      ctx.restore();
    } else { tauntBubble = null; }
  }

  function drawSprite(img, cx, cy, fallbackEmoji) {
    var px = cx * CELL, py = cy * CELL;
    if (img) { ctx.drawImage(img, px - 4, py - 10, CELL + 8, CELL + 10); }
    else { ctx.font = (CELL * 0.75) + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(fallbackEmoji, px + CELL / 2, py + CELL / 2); }
  }

  // --- Input: bàn phím + D-Pad chạm ---
  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') keys.up = true;
    if (k === 'arrowdown' || k === 's') keys.down = true;
    if (k === 'arrowleft' || k === 'a') keys.left = true;
    if (k === 'arrowright' || k === 'd') keys.right = true;
  });
  window.addEventListener('keyup', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') keys.up = false;
    if (k === 'arrowdown' || k === 's') keys.down = false;
    if (k === 'arrowleft' || k === 'a') keys.left = false;
    if (k === 'arrowright' || k === 'd') keys.right = false;
  });
  Array.prototype.forEach.call(document.querySelectorAll('.dpad button'), function (btn) {
    var dir = btn.dataset.dir;
    var set = function (v) { return function (e) { e.preventDefault(); keys[dir] = v; }; };
    btn.addEventListener('touchstart', set(true)); btn.addEventListener('touchend', set(false));
    btn.addEventListener('mousedown', set(true)); btn.addEventListener('mouseup', set(false)); btn.addEventListener('mouseleave', set(false));
  });

  // ---------------------------------------------------------------------
  // Kết thúc game — ghi leaderboard/play-log (endpoint có sẵn trong dự án)
  // ---------------------------------------------------------------------
  function endGame(won) {
    if (!gameRunning) return;
    gameRunning = false;
    clearInterval(timerHandle); cancelAnimationFrame(rafHandle);
    var score = coinsCollected * 100 + (won ? 500 : 0);

    apiPost && fetch('/api/game-play-log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: uid(), name: playerName(), gameId: GAME_ID, gameTitle: GAME_TITLE, status: won ? 'win' : 'lose', score: score, timeSec: elapsed, meta: { coinsCollected: coinsCollected, coinsTotal: coinsTotal, villain: selectedVillain.id } }),
    }).catch(function () {});

    if (won) {
      fetch('/api/game-leaderboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: uid(), name: playerName(), gameId: GAME_ID, gameTitle: GAME_TITLE, status: 'win', score: score, timeSec: elapsed }),
      }).catch(function () {});
    }

    $('endTitle').textContent = won ? '🏆 BẠN ĐÃ THOÁT!' : '💀 GAME OVER';
    $('endTitle').style.color = won ? '#5cff9e' : '#ff2e6c';
    $('endStats').textContent = '🪙 ' + coinsCollected + '/' + coinsTotal + ' vàng · ⏱ ' + elapsed + 's · Điểm: ' + score;
    var sceneWrap = $('endSceneWrap'); sceneWrap.innerHTML = '';

    if (won && heroDescription) {
      var spinner = document.createElement('div'); spinner.className = 'spinner'; sceneWrap.appendChild(spinner);
      generateScene(heroDescription, selectedVillain.desc).then(function (img) {
        sceneWrap.innerHTML = '<img src="data:' + img.mimeType + ';base64,' + img.imageBase64 + '" style="max-width:min(420px,86vw);border:2px solid var(--neon);border-radius:8px;" />';
      }).catch(function () { sceneWrap.innerHTML = ''; });
    }
    show('end');
  }

  $('retryBtn').onclick = function () { show('title'); };

  // --- Leaderboard overlay ---
  function loadLeaderboard() {
    var el = $('lbList'); el.innerHTML = 'Đang tải...';
    fetch('/api/game-leaderboard?gameId=' + encodeURIComponent(GAME_ID) + '&limit=10')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var items = (data && data.items) || [];
        if (!items.length) { el.innerHTML = '<div style="padding:10px;">Chưa có ai lập kỷ lục. Hãy là người đầu tiên!</div>'; return; }
        el.innerHTML = items.map(function (it) {
          return '<div class="lb-row"><span>#' + it.rank + ' ' + (it.name || 'Ẩn danh') + '</span><span>' + it.bestTimeSec + 's · ' + it.bestScore + 'đ</span></div>';
        }).join('');
      }).catch(function () { el.innerHTML = '<div style="padding:10px;">Không tải được bảng xếp hạng.</div>'; });
  }
  $('lbOpenBtn').onclick = function () { loadLeaderboard(); show('lb'); };
  $('lbOpenBtn2').onclick = function () { loadLeaderboard(); show('lb'); };
  $('lbCloseBtn').onclick = function () { show(gameRunning ? 'game' : (heroSpriteUrl !== undefined && screens.end.classList.contains('hidden') === false ? 'end' : 'title')); };

  show('title');
})();
</script>
</body>
</html>
`;
