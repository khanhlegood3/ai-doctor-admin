export const VORTEX_GALLERY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Vortex Gallery</title>
<style>
  *{box-sizing:border-box;}
  html,body{height:100%;margin:0; background:#0a0a12; overflow:hidden;}
  body{font-family:'Helvetica Neue', Arial, sans-serif; color:#f4f2ff;}
  .stage{position:fixed; inset:0; perspective:1200px; display:flex; align-items:center; justify-content:center; cursor:grab;}
  .stage:active{cursor:grabbing;}
  .vortex{position:relative; width:1px; height:1px; transform-style:preserve-3d;}
  .card{
    position:absolute; width:150px; height:190px; left:-75px; top:-95px;
    border-radius:14px; overflow:hidden; background:linear-gradient(160deg, var(--c1), var(--c2));
    display:flex; align-items:flex-end; padding:14px; font-size:13px; font-weight:600;
    box-shadow: 0 20px 40px rgba(0,0,0,.5); transition: box-shadow .3s;
  }
  .card:hover{ box-shadow: 0 30px 60px rgba(180,150,255,.35); }
  .title-bar{position:fixed; top:26px; left:26px; z-index:2;}
  .eyebrow{font-size:11px; letter-spacing:.25em; text-transform:uppercase; color:#a89bff;}
  h1{margin:6px 0 0; font-size:26px; font-weight:300;}
  .hint{position:fixed; bottom:22px; left:26px; z-index:2; font-size:12px; color:rgba(244,242,255,.5);}
  .center-glow{position:fixed; top:50%; left:50%; width:260px; height:260px; transform:translate(-50%,-50%);
    background: radial-gradient(circle, rgba(140,110,255,.25), transparent 70%); pointer-events:none;}
</style>
</head>
<body>
<div class="title-bar">
  <div class="eyebrow">Vortex Gallery</div>
  <h1>Nine ideas, spinning.</h1>
</div>
<div class="center-glow"></div>
<div class="stage" id="stage">
  <div class="vortex" id="vortex"></div>
</div>
<div class="hint">Drag to spin · scroll to zoom</div>
<script>
  const items = [
    { t: 'Calm Space', c1:'#3a2f5a', c2:'#8b7bb0' },
    { t: 'Cyber Rain', c1:'#04211a', c2:'#0fae7a' },
    { t: 'Color Room', c1:'#4a3f30', c2:'#c9a13b' },
    { t: 'Flow Shader', c1:'#241a4a', c2:'#a06bff' },
    { t: 'Dream Run', c1:'#5a2f5a', c2:'#ff9dc9' },
    { t: 'ASCII Moon', c1:'#0a1a0a', c2:'#3fae5a' },
    { t: 'Moon Note', c1:'#151530', c2:'#5a6bae' },
    { t: 'Seaside Stay', c1:'#0a3a4a', c2:'#3bc9d8' },
    { t: 'Your Idea', c1:'#3a2020', c2:'#e0704a' },
  ];

  const vortex = document.getElementById('vortex');
  const n = items.length;
  const radius = 260;
  items.forEach((item, i) => {
    const angle = (i / n) * Math.PI * 2;
    const card = document.createElement('div');
    card.className = 'card';
    card.style.setProperty('--c1', item.c1);
    card.style.setProperty('--c2', item.c2);
    card.style.transform = 'rotateY(' + (angle * 180/Math.PI) + 'deg) translateZ(' + radius + 'px)';
    card.textContent = item.t;
    vortex.appendChild(card);
  });

  let rotY = 0, rotX = -8, autoSpin = true;
  let dragging = false, lastX = 0, lastY = 0;
  const stage = document.getElementById('stage');

  function render(){
    vortex.style.transform = 'rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg)';
  }

  stage.addEventListener('pointerdown', e => { dragging = true; autoSpin = false; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('pointerup', () => dragging = false);
  window.addEventListener('pointermove', e => {
    if(!dragging) return;
    rotY += (e.clientX - lastX) * 0.4;
    rotX -= (e.clientY - lastY) * 0.2;
    rotX = Math.max(-40, Math.min(40, rotX));
    lastX = e.clientX; lastY = e.clientY;
    render();
  });

  let scale = 1;
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    scale = Math.max(0.6, Math.min(1.6, scale - e.deltaY * 0.001));
    vortex.style.scale = scale;
  }, { passive:false });

  function loop(){
    if(autoSpin) rotY += 0.15;
    render();
    requestAnimationFrame(loop);
  }
  loop();
</script>
</body>
</html>`;
