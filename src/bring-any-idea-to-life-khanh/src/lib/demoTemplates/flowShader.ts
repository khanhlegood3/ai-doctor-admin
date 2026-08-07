export const FLOW_SHADER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Flow Shader</title>
<style>
  *{box-sizing:border-box;}
  html,body{height:100%;margin:0; background:#070812; overflow:hidden;}
  body{font-family: ui-monospace, monospace; color:#eae6ff;}
  canvas{position:fixed; inset:0; display:block; cursor:crosshair;}
  .panel{
    position:fixed; bottom:18px; left:50%; transform:translateX(-50%); z-index:2;
    display:flex; gap:16px; align-items:center; background:rgba(10,8,24,.6); border:1px solid rgba(180,160,255,.25);
    padding:10px 18px; border-radius:999px; backdrop-filter: blur(8px);
  }
  .swatches{display:flex; gap:6px;}
  .sw{width:18px; height:18px; border-radius:50%; cursor:pointer; border:2px solid transparent;}
  .sw.active{border-color:#fff;}
  label{font-size:10px; letter-spacing:.15em; text-transform:uppercase; color:#b8aeff;}
  .title{position:fixed; top:20px; left:22px; z-index:2; font-size:11px; letter-spacing:.25em; text-transform:uppercase; color:#b8aeff;}
</style>
</head>
<body>
<div class="title">Flow Shader — move your cursor</div>
<canvas id="c"></canvas>
<div class="panel">
  <label>palette</label>
  <div class="swatches">
    <div class="sw active" style="background:linear-gradient(135deg,#7c6bff,#ff6bd6)" data-p="violet"></div>
    <div class="sw" style="background:linear-gradient(135deg,#33d0ff,#33ffb8)" data-p="aqua"></div>
    <div class="sw" style="background:linear-gradient(135deg,#ff9d3d,#ff3d6e)" data-p="ember"></div>
  </div>
</div>
<script>
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let W, H;
  function resize(){ W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
  window.addEventListener('resize', resize); resize();

  const palettes = {
    violet: ['#7c6bff', '#b06bff', '#ff6bd6'],
    aqua: ['#33d0ff', '#33ffd0', '#33ffb8'],
    ember: ['#ff9d3d', '#ff5d5d', '#ff3d6e']
  };
  let palette = palettes.violet;
  document.querySelectorAll('.sw').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.sw').forEach(s=>s.classList.remove('active'));
      sw.classList.add('active');
      palette = palettes[sw.dataset.p];
      particles.forEach(p => p.color = palette[Math.floor(Math.random()*palette.length)]);
    });
  });

  // Pseudo-noise flow field (cheap trig-based, no deps)
  function noise(x, y, t){
    return Math.sin(x*0.002 + t) + Math.cos(y*0.0025 - t*0.8) + Math.sin((x+y)*0.0015 + t*1.3);
  }

  let mouse = { x: W/2, y: H/2, active: false };
  canvas.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
  canvas.addEventListener('pointerleave', () => mouse.active = false);

  const COUNT = 700;
  const particles = Array.from({length: COUNT}, () => ({
    x: Math.random()*W, y: Math.random()*H,
    vx: 0, vy: 0, life: Math.random()*200,
    color: palette[Math.floor(Math.random()*palette.length)]
  }));

  let t = 0;
  ctx.fillStyle = '#070812';
  ctx.fillRect(0,0,W,H);

  function frame(){
    t += 0.004;
    ctx.fillStyle = 'rgba(7,8,18,0.08)';
    ctx.fillRect(0, 0, W, H);

    for(const p of particles){
      const angle = noise(p.x, p.y, t) * Math.PI;
      p.vx += Math.cos(angle) * 0.12;
      p.vy += Math.sin(angle) * 0.12;

      if(mouse.active){
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx*dx + dy*dy;
        if(d2 < 40000){
          const f = (40000 - d2) / 40000;
          p.vx += (dx/Math.sqrt(d2+1)) * f * 1.6;
          p.vy += (dy/Math.sqrt(d2+1)) * f * 1.6;
        }
      }

      p.vx *= 0.94; p.vy *= 0.94;
      p.x += p.vx; p.y += p.vy;
      p.life--;

      if(p.life <= 0 || p.x < 0 || p.x > W || p.y < 0 || p.y > H){
        p.x = Math.random()*W; p.y = Math.random()*H; p.vx = 0; p.vy = 0; p.life = 100 + Math.random()*200;
      }

      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  frame();
</script>
</body>
</html>`;
