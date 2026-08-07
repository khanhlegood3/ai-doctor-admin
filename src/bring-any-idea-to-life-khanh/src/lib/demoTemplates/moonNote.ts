export const MOON_NOTE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Moon Note</title>
<style>
  *{box-sizing:border-box;}
  html,body{height:100%;margin:0;}
  body{
    font-family:'Iowan Old Style', Georgia, serif;
    background: linear-gradient(180deg, #0d1024 0%, #171b3a 100%);
    color:#e7e6f5; display:flex; min-height:100vh;
  }
  .sidebar{width:230px; border-right:1px solid rgba(231,230,245,.1); padding:22px 16px; display:flex; flex-direction:column;}
  .brand{display:flex; align-items:center; gap:8px; margin-bottom:22px;}
  .moon-icon{width:20px; height:20px; border-radius:50%; background:#e7e6f5; box-shadow: inset 6px -2px 0 0 #171b3a;}
  .brand span{font-size:14px; letter-spacing:.05em; color:#c9c6f0;}
  .new-btn{
    font-family: inherit; background:rgba(160,150,255,.15); border:1px solid rgba(160,150,255,.35); color:#e7e6f5;
    padding:9px 12px; border-radius:8px; cursor:pointer; margin-bottom:18px; font-size:13px; text-align:left;
  }
  .new-btn:hover{background:rgba(160,150,255,.25);}
  .note-list{overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:6px;}
  .note-item{
    padding:10px 10px; border-radius:8px; cursor:pointer; font-size:13px; color:#b7b4dd;
    border:1px solid transparent; display:flex; flex-direction:column; gap:2px;
  }
  .note-item:hover{background:rgba(231,230,245,.05);}
  .note-item.active{background:rgba(160,150,255,.14); border-color:rgba(160,150,255,.3); color:#fff;}
  .note-item .snippet{font-size:11px; color:#7d79ab; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
  .main{flex:1; display:flex; flex-direction:column; padding:34px 46px; position:relative;}
  .stars{position:absolute; inset:0; pointer-events:none; z-index:0;}
  .editor-wrap{position:relative; z-index:1; flex:1; display:flex; flex-direction:column;}
  input.note-title{
    font-family:inherit; font-size:28px; font-weight:400; background:transparent; border:none; outline:none; color:#f4f2ff;
    margin-bottom:14px;
  }
  input.note-title::placeholder{color:#5c5891;}
  textarea.note-body{
    font-family:'Iowan Old Style', Georgia, serif; font-size:16px; line-height:1.7; background:transparent; border:none; outline:none;
    color:#d8d6f2; resize:none; flex:1;
  }
  textarea.note-body::placeholder{color:#4d4a7a;}
  .footer{display:flex; justify-content:space-between; font-size:11px; color:#5c5891; margin-top:14px; letter-spacing:.05em;}
  .phase-tag{padding:3px 10px; border-radius:999px; background:rgba(160,150,255,.12); border:1px solid rgba(160,150,255,.25);}
</style>
</head>
<body>
<div class="sidebar">
  <div class="brand"><div class="moon-icon"></div><span>Moon Note</span></div>
  <button class="new-btn" id="newNote">+ New note</button>
  <div class="note-list" id="noteList"></div>
</div>
<div class="main">
  <canvas class="stars" id="stars"></canvas>
  <div class="editor-wrap">
    <input class="note-title" id="titleInput" placeholder="Untitled note" />
    <textarea class="note-body" id="bodyInput" placeholder="Write what's on your mind tonight..."></textarea>
    <div class="footer">
      <span id="wordCount">0 words</span>
      <span class="phase-tag" id="phaseTag">🌙 waxing</span>
    </div>
  </div>
</div>
<script>
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  function resize(){ canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
  window.addEventListener('resize', resize); resize();
  const stars = Array.from({length: 70}, () => ({ x: Math.random(), y: Math.random(), r: Math.random()*1.3+0.3, a: Math.random()*Math.PI*2 }));
  function drawStars(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(const s of stars){
      s.a += 0.01;
      ctx.fillStyle = 'rgba(200,196,240,'+ (0.3+Math.sin(s.a)*0.3) +')';
      ctx.beginPath(); ctx.arc(s.x*canvas.width, s.y*canvas.height, s.r, 0, Math.PI*2); ctx.fill();
    }
    requestAnimationFrame(drawStars);
  }
  drawStars();

  const phases = ['🌑 new', '🌒 waxing crescent', '🌓 first quarter', '🌔 waxing gibbous', '🌕 full', '🌖 waning gibbous', '🌗 last quarter', '🌘 waning crescent'];
  document.getElementById('phaseTag').textContent = phases[Math.floor(Math.random()*phases.length)];

  let notes = [
    { id: 1, title: 'Late-night idea', body: 'What if the note app tracked the moon phase for every entry, just for texture?' },
    { id: 2, title: 'Reading list', body: '- Wind, Sand and Stars\\n- The Overstory\\n- Braiding Sweetgrass' },
  ];
  let activeId = notes[0].id;

  function renderList(){
    const list = document.getElementById('noteList');
    list.innerHTML = '';
    notes.slice().reverse().forEach(n => {
      const el = document.createElement('div');
      el.className = 'note-item' + (n.id === activeId ? ' active' : '');
      el.innerHTML = '<div>' + (n.title || 'Untitled note') + '</div><div class="snippet">' + (n.body.split('\\n')[0] || 'No content yet') + '</div>';
      el.addEventListener('click', () => { activeId = n.id; renderList(); loadNote(); });
      list.appendChild(el);
    });
  }

  function loadNote(){
    const n = notes.find(n => n.id === activeId);
    document.getElementById('titleInput').value = n.title;
    document.getElementById('bodyInput').value = n.body;
    updateWordCount();
  }

  function updateWordCount(){
    const words = document.getElementById('bodyInput').value.trim().split(/\\s+/).filter(Boolean).length;
    document.getElementById('wordCount').textContent = words + ' word' + (words===1?'':'s');
  }

  document.getElementById('titleInput').addEventListener('input', e => {
    const n = notes.find(n => n.id === activeId);
    n.title = e.target.value;
    renderList();
  });
  document.getElementById('bodyInput').addEventListener('input', e => {
    const n = notes.find(n => n.id === activeId);
    n.body = e.target.value;
    updateWordCount();
    renderList();
  });

  document.getElementById('newNote').addEventListener('click', () => {
    const id = Date.now();
    notes.push({ id, title: '', body: '' });
    activeId = id;
    renderList();
    loadNote();
    document.getElementById('titleInput').focus();
  });

  renderList();
  loadNote();
</script>
</body>
</html>`;
