export const CYBER_RAIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Cyber Rain</title>
<style>
  *{box-sizing:border-box;}
  html,body{height:100%;margin:0; background:#04070a; overflow:hidden;}
  body{font-family: ui-monospace, 'JetBrains Mono', monospace; color:#c9ffe6;}
  canvas{position:fixed; inset:0; display:block;}
  .hud{
    position:fixed; top:18px; left:18px; z-index:2; display:flex; flex-direction:column; gap:10px;
    background:rgba(5,12,10,.55); border:1px solid rgba(120,255,190,.25); border-radius:10px;
    padding:14px 16px; backdrop-filter: blur(6px); min-width:200px;
  }
  .hud .title{font-size:11px; letter-spacing:.25em; text-transform:uppercase; color:#7dffc0; opacity:.9;}
  .row{display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:11px; color:#9fe8c8;}
  input[type=range]{width:110px; accent-color:#39ff9a;}
  .swatches{display:flex; gap:6px;}
  .sw{width:16px; height:16px; border-radius:4px; cursor:pointer; border:1px solid rgba(255,255,255,.3);}
  .corner{position:fixed; z-index:2; font-size:10px; letter-spacing:.2em; color:rgba(125,255,192,.5); text-transform:uppercase;}
  .tl{top:18px; right:18px;} .br{bottom:18px; right:18px; text-align:right;}
</style>
</head>
<body>
<canvas id="rain"></canvas>
<div class="hud">
  <div class="title">Cyber Rain // control</div>
  <div class="row"><span>speed</span><input id="speed" type="range" min="1" max="10" value="4"></div>
  <div class="row"><span>density</span><input id="density" type="range" min="6" max="40" value="20"></div>
  <div class="row"><span>hue</span>
    <div class="swatches">
      <div class="sw" style="background:#39ff9a" data-c="#39ff9a"></div>
      <div class="sw" style="background:#39d1ff" data-c="#39d1ff"></div>
      <div class="sw" style="background:#ff3ba0" data-c="#ff3ba0"></div>
      <div class="sw" style="background:#ffd23b" data-c="#ffd23b"></div>
    </div>
  </div>
</div>
<div class="corner tl">signal: live</div>
<div class="corner br">click to disturb the field</div>
<script>
  const canvas = document.getElementById('rain');
  const ctx = canvas.getContext('2d');
  let W, H, columns, drops, fontSize = 16, color = '#39ff9a';
  const glyphs = 'アイウエオカキクケコサシスセソ0123456789<>/\\\\|+-*=';

  function setup(){
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
    columns = Math.floor(W / fontSize);
    drops = new Array(columns).fill(0).map(() => Math.random() * -50);
  }
  window.addEventListener('resize', setup);
  setup();

  let speed = 4, density = 20;
  document.getElementById('speed').addEventListener('input', e => speed = +e.target.value);
  document.getElementById('density').addEventListener('input', e => density = +e.target.value);
  document.querySelectorAll('.sw').forEach(s => s.addEventListener('click', () => color = s.dataset.c));

  let disturb = null;
  canvas.addEventListener('click', (e) => { disturb = { x: e.clientX, y: e.clientY, t: 0 }; });

  function frame(){
    ctx.fillStyle = 'rgba(4,7,10,0.18)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = fontSize + 'px monospace';

    for(let i = 0; i < columns; i++){
      const text = glyphs[Math.floor(Math.random()*glyphs.length)];
      const x = i * fontSize;
      let y = drops[i] * fontSize;

      let localColor = color;
      if(disturb){
        const dx = x - disturb.x, dy = y - disturb.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < 160){ localColor = '#ffffff'; }
      }

      ctx.fillStyle = localColor;
      ctx.globalAlpha = Math.random() * 0.5 + 0.5;
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 1;

      if(y > H && Math.random() > (1 - density/1000)) drops[i] = 0;
      drops[i] += speed / 60 * 2;
    }

    if(disturb){ disturb.t++; if(disturb.t > 20) disturb = null; }
    requestAnimationFrame(frame);
  }
  frame();
</script>
</body>
</html>`;
