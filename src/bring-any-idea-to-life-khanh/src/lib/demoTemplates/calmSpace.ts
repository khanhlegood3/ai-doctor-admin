export const CALM_SPACE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Calm Space</title>
<style>
  :root{
    --dusk-1:#2b2140; --dusk-2:#4a3b6b; --dusk-3:#8b7bb0; --glow:#f2c9c2; --mist:#cfe0e8;
  }
  *{box-sizing:border-box;}
  html,body{height:100%;margin:0;}
  body{
    font-family: 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;
    background: radial-gradient(120% 90% at 50% 100%, var(--dusk-2), var(--dusk-1) 60%);
    color:#f4eee8; overflow:hidden; display:flex; align-items:center; justify-content:center;
  }
  #sky{position:fixed; inset:0; z-index:0;}
  .wrap{position:relative; z-index:2; text-align:center; width:100%; max-width:560px; padding:24px;}
  .eyebrow{letter-spacing:.3em; text-transform:uppercase; font-size:11px; color:var(--dusk-3); font-family: ui-monospace, monospace;}
  h1{font-weight:400; font-size:clamp(24px,4vw,34px); margin:10px 0 28px; color:#fbf4ee;}
  .orb-stage{position:relative; width:280px; height:280px; margin:0 auto 26px; display:flex; align-items:center; justify-content:center;}
  .ring{position:absolute; inset:0; border-radius:50%; border:1px solid rgba(242,201,194,.18);}
  .ring.r2{inset:24px; border-color:rgba(207,224,232,.16);}
  .orb{
    width:120px; height:120px; border-radius:50%;
    background: radial-gradient(circle at 35% 30%, var(--glow), var(--dusk-3) 55%, transparent 75%);
    box-shadow: 0 0 60px 10px rgba(242,201,194,.25);
    transition: transform 4s ease-in-out, box-shadow 4s ease-in-out;
    transform: scale(1);
  }
  .orb.inhale{ transform: scale(1.7); box-shadow: 0 0 90px 20px rgba(242,201,194,.4); }
  .orb.exhale{ transform: scale(1); box-shadow: 0 0 40px 6px rgba(242,201,194,.2); }
  .phase{font-family: ui-monospace, monospace; font-size:13px; letter-spacing:.2em; text-transform:uppercase; color:var(--mist); min-height:20px;}
  .controls{display:flex; gap:10px; justify-content:center; margin-top:26px; flex-wrap:wrap;}
  button{
    font-family:inherit; font-size:13px; padding:9px 18px; border-radius:999px; cursor:pointer;
    border:1px solid rgba(244,238,232,.25); background:rgba(244,238,232,.06); color:#f4eee8;
    transition: all .2s ease;
  }
  button:hover{background:rgba(244,238,232,.14); border-color:rgba(244,238,232,.5);}
  button.active{background:var(--glow); color:#2b2140; border-color:var(--glow);}
  .hint{margin-top:20px; font-size:12px; color:rgba(244,238,232,.5); font-family: ui-monospace, monospace;}
</style>
</head>
<body>
<canvas id="sky"></canvas>
<div class="wrap">
  <div class="eyebrow">Calm Space</div>
  <h1>A quiet minute, whenever you need one.</h1>
  <div class="orb-stage">
    <div class="ring"></div>
    <div class="ring r2"></div>
    <div class="orb" id="orb"></div>
  </div>
  <div class="phase" id="phase">breathe in</div>
  <div class="controls">
    <button data-p="4-4-4">box</button>
    <button data-p="4-7-8" class="active">calming</button>
    <button data-p="5-0-5">even</button>
  </div>
  <div class="hint">Follow the orb. Inhale as it grows, hold, exhale as it settles.</div>
</div>
<script>
  // Drifting starfield
  const c = document.getElementById('sky');
  const ctx = c.getContext('2d');
  let stars = [];
  function resize(){ c.width = innerWidth; c.height = innerHeight;
    stars = Array.from({length: 90}, () => ({
      x: Math.random()*c.width, y: Math.random()*c.height,
      r: Math.random()*1.4+0.2, s: Math.random()*0.3+0.05, a: Math.random()
    }));
  }
  window.addEventListener('resize', resize); resize();
  function drawSky(){
    ctx.clearRect(0,0,c.width,c.height);
    for(const st of stars){
      st.a += 0.01*st.s;
      const alpha = 0.4 + Math.sin(st.a)*0.4;
      ctx.fillStyle = 'rgba(244,238,232,'+Math.max(alpha,0)+')';
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI*2); ctx.fill();
    }
    requestAnimationFrame(drawSky);
  }
  drawSky();

  // Breathing engine
  const orb = document.getElementById('orb');
  const phaseEl = document.getElementById('phase');
  let pattern = [4,7,8]; // inhale, hold, exhale (seconds)
  let timer = null;

  function runCycle(){
    clearTimeout(timer);
    const [inhale, hold, exhale] = pattern;
    orb.style.transitionDuration = inhale + 's';
    orb.classList.remove('exhale'); orb.classList.add('inhale');
    phaseEl.textContent = 'breathe in';
    timer = setTimeout(() => {
      phaseEl.textContent = hold > 0 ? 'hold' : 'breathe out';
      if(hold > 0){
        timer = setTimeout(() => {
          orb.style.transitionDuration = exhale + 's';
          orb.classList.remove('inhale'); orb.classList.add('exhale');
          phaseEl.textContent = 'breathe out';
          timer = setTimeout(runCycle, exhale*1000);
        }, hold*1000);
      } else {
        orb.style.transitionDuration = exhale + 's';
        orb.classList.remove('inhale'); orb.classList.add('exhale');
        timer = setTimeout(runCycle, exhale*1000);
      }
    }, inhale*1000);
  }
  runCycle();

  document.querySelectorAll('.controls button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.controls button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      pattern = btn.dataset.p.split('-').map(Number);
      runCycle();
    });
  });
</script>
</body>
</html>`;
