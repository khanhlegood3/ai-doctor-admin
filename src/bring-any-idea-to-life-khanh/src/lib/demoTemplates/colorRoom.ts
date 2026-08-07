export const COLOR_ROOM_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Color Room</title>
<style>
  *{box-sizing:border-box;}
  html,body{height:100%;margin:0;}
  body{
    font-family:'Helvetica Neue', Arial, sans-serif; background:#efece6; color:#2a2a2a;
    display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px;
  }
  .app{display:flex; gap:34px; align-items:flex-start; flex-wrap:wrap; justify-content:center; max-width:920px;}
  .room-stage{perspective:1400px;}
  .room{
    width:360px; height:300px; position:relative; transform-style:preserve-3d;
    transform: rotateX(6deg) rotateY(-18deg);
    transition: transform .6s ease;
  }
  .face{position:absolute; transition: background .35s ease;}
  .wall-back{width:360px; height:300px; background:#d8cfc0; transform: translateZ(-120px);}
  .wall-left{width:240px; height:300px; background:#c7bcae; left:-120px; transform: rotateY(90deg) translateZ(0px);}
  .floor{width:360px; height:240px; background:#9c8f7a; top:300px; transform: rotateX(90deg) translateZ(0);}
  .rug{position:absolute; width:180px; height:110px; left:90px; top:340px; border-radius:6px; background:#b3573f; transform: rotateX(90deg) translateZ(1px); box-shadow:0 0 0 6px rgba(0,0,0,.04);}
  .sofa{position:absolute; width:150px; height:70px; left:105px; top:150px; border-radius:10px; background:#6b7c66; transform: translateZ(-1px); box-shadow: 0 12px 24px rgba(0,0,0,.25);}
  .art{position:absolute; width:70px; height:50px; left:40px; top:60px; border-radius:3px; background:#e0d6c3; border:6px solid #3a3128; transform: translateZ(-119px);}
  .plant{position:absolute; width:20px; height:60px; left:300px; top:170px; background:#3f5b3a; border-radius:0 40% 0 40%; transform: translateZ(-1px);}
  .lamp{position:absolute; width:10px; height:90px; left:20px; top:140px; background:#d9b26a; border-radius:50% 50% 4px 4px; transform: translateZ(-1px);}

  .panel{width:280px;}
  .eyebrow{font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:#8a8072;}
  h1{font-size:24px; margin:6px 0 20px; font-weight:600;}
  .group{margin-bottom:18px;}
  .group label{display:block; font-size:12px; color:#6c6455; margin-bottom:8px; font-weight:600;}
  .swrow{display:flex; gap:8px; flex-wrap:wrap;}
  .sw{width:30px; height:30px; border-radius:8px; cursor:pointer; border:2px solid transparent; transition: transform .15s;}
  .sw:hover{transform:translateY(-2px);}
  .sw.active{border-color:#2a2a2a;}
  .note{font-size:12px; color:#8a8072; line-height:1.5; margin-top:6px;}
</style>
</head>
<body>
<div class="app">
  <div class="room-stage">
    <div class="room" id="room">
      <div class="face wall-back" id="wallBack"></div>
      <div class="face wall-left" id="wallLeft"></div>
      <div class="face floor" id="floor"></div>
      <div class="rug" id="rug"></div>
      <div class="art"></div>
      <div class="sofa" id="sofa"></div>
      <div class="plant"></div>
      <div class="lamp"></div>
    </div>
  </div>
  <div class="panel">
    <div class="eyebrow">Color Room</div>
    <h1>Paint the room, live.</h1>
    <div class="group">
      <label>Back wall</label>
      <div class="swrow" data-target="wallBack">
        <div class="sw active" style="background:#d8cfc0" data-c="#d8cfc0"></div>
        <div class="sw" style="background:#e7c7c1" data-c="#e7c7c1"></div>
        <div class="sw" style="background:#c1d3cf" data-c="#c1d3cf"></div>
        <div class="sw" style="background:#2f2b26" data-c="#2f2b26"></div>
        <div class="sw" style="background:#f2e6c9" data-c="#f2e6c9"></div>
      </div>
    </div>
    <div class="group">
      <label>Side wall</label>
      <div class="swrow" data-target="wallLeft">
        <div class="sw active" style="background:#c7bcae" data-c="#c7bcae"></div>
        <div class="sw" style="background:#d8b3ab" data-c="#d8b3ab"></div>
        <div class="sw" style="background:#a9bcb8" data-c="#a9bcb8"></div>
        <div class="sw" style="background:#26221e" data-c="#26221e"></div>
        <div class="sw" style="background:#e2d5b0" data-c="#e2d5b0"></div>
      </div>
    </div>
    <div class="group">
      <label>Rug</label>
      <div class="swrow" data-target="rug">
        <div class="sw active" style="background:#b3573f" data-c="#b3573f"></div>
        <div class="sw" style="background:#3f6b8a" data-c="#3f6b8a"></div>
        <div class="sw" style="background:#c9a13b" data-c="#c9a13b"></div>
        <div class="sw" style="background:#4a4438" data-c="#4a4438"></div>
      </div>
    </div>
    <div class="group">
      <label>Sofa</label>
      <div class="swrow" data-target="sofa">
        <div class="sw active" style="background:#6b7c66" data-c="#6b7c66"></div>
        <div class="sw" style="background:#8a5a4a" data-c="#8a5a4a"></div>
        <div class="sw" style="background:#5a6b8a" data-c="#5a6b8a"></div>
        <div class="sw" style="background:#c9c2b4" data-c="#c9c2b4"></div>
      </div>
    </div>
    <div class="note">Drag left/right on the room to spin it around.</div>
  </div>
</div>
<script>
  document.querySelectorAll('.swrow').forEach(row => {
    const targetId = row.dataset.target;
    const targetEl = document.getElementById(targetId);
    row.querySelectorAll('.sw').forEach(sw => {
      sw.addEventListener('click', () => {
        row.querySelectorAll('.sw').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        targetEl.style.background = sw.dataset.c;
      });
    });
  });

  const room = document.getElementById('room');
  let dragging = false, startX = 0, rotY = -18, rotX = 6;
  const stage = document.querySelector('.room-stage');
  stage.addEventListener('pointerdown', e => { dragging = true; startX = e.clientX; });
  window.addEventListener('pointerup', () => dragging = false);
  window.addEventListener('pointermove', e => {
    if(!dragging) return;
    const dx = e.clientX - startX;
    rotY += dx * 0.3;
    startX = e.clientX;
    room.style.transform = 'rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg)';
  });
</script>
</body>
</html>`;
