export const DREAM_RUN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Dream Run</title>
<style>
  *{box-sizing:border-box;}
  html,body{height:100%;margin:0; overflow:hidden;}
  body{
    font-family:'Trebuchet MS', 'Segoe UI', sans-serif;
    background: linear-gradient(180deg, #ffd6ec 0%, #d8c7ff 45%, #b6d8ff 100%);
    display:flex; align-items:center; justify-content:center;
  }
  #game{width:100%; height:100%; display:block;}
  .hud{position:fixed; top:18px; left:0; right:0; display:flex; justify-content:space-between; padding:0 22px; z-index:2; pointer-events:none;}
  .badge{font-weight:700; color:#5b3a7a; background:rgba(255,255,255,.6); padding:6px 14px; border-radius:999px; font-size:13px;}
  .center-msg{
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:3; text-align:center;
    color:#4a2f6b; font-weight:700; background:rgba(255,255,255,.75); padding:18px 26px; border-radius:16px;
    box-shadow:0 10px 30px rgba(90,50,110,.2);
  }
  .center-msg small{display:block; font-weight:400; margin-top:6px; font-size:12px; color:#7a5a9a;}
</style>
</head>
<body>
<canvas id="game"></canvas>
<div class="hud">
  <div class="badge" id="score">Score: 0</div>
  <div class="badge">Dream Run</div>
</div>
<div class="center-msg" id="msg">Tap, click, or press Space to run<small>Jump the clouds, chase the sparkles</small></div>
<script>
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
  window.addEventListener('resize', resize); resize();

  const groundY = () => canvas.height * 0.78;
  let running = false, gameOver = false, score = 0, speed = 6;
  let player = { x: 110, y: 0, vy: 0, r: 22, jumping: false };
  let obstacles = [];
  let stars = Array.from({length: 60}, () => ({ x: Math.random(), y: Math.random()*0.6, r: Math.random()*1.6+0.6 }));
  let sparkles = [];
  let frame = 0;

  function reset(){
    player.y = groundY(); player.vy = 0; player.jumping = false;
    obstacles = []; sparkles = []; score = 0; speed = 6; frame = 0; gameOver = false;
    document.getElementById('score').textContent = 'Score: 0';
  }
  reset();

  function jump(){
    if(!running){ running = true; document.getElementById('msg').style.display = 'none'; }
    if(gameOver){ reset(); return; }
    if(!player.jumping){ player.vy = -14.5; player.jumping = true; }
  }
  window.addEventListener('keydown', e => { if(e.code === 'Space'){ e.preventDefault(); jump(); }});
  canvas.addEventListener('pointerdown', jump);

  function spawnObstacle(){
    const h = 30 + Math.random()*30;
    obstacles.push({ x: canvas.width + 40, w: 22 + Math.random()*14, h, hue: Math.random()*360 });
  }
  function spawnSparkle(){
    sparkles.push({ x: canvas.width + 40, y: groundY() - 90 - Math.random()*70, r: 5, collected:false });
  }

  function drawCloudHill(){
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for(let x=0; x<=canvas.width; x+=40){
      const y = groundY() - 10 + Math.sin((x+frame*1.2)*0.01)*8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath(); ctx.fill();
  }

  function loop(){
    frame++;
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // stars/sparkle bg
    for(const s of stars){
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.arc(s.x*canvas.width, s.y*canvas.height, s.r, 0, Math.PI*2); ctx.fill();
    }

    drawCloudHill();

    ctx.strokeStyle = 'rgba(90,60,120,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY()+18); ctx.lineTo(canvas.width, groundY()+18); ctx.stroke();

    if(running && !gameOver){
      if(frame % Math.max(50, 90 - Math.floor(score/5)) === 0) spawnObstacle();
      if(frame % 70 === 0) spawnSparkle();

      player.vy += 0.85;
      player.y += player.vy;
      if(player.y > groundY()){ player.y = groundY(); player.vy = 0; player.jumping = false; }

      obstacles.forEach(o => o.x -= speed);
      obstacles = obstacles.filter(o => o.x > -50);

      sparkles.forEach(s => s.x -= speed);
      sparkles = sparkles.filter(s => s.x > -20 && !s.collected);

      for(const o of obstacles){
        const px = player.x, py = player.y - player.r;
        if(px + player.r > o.x && px - player.r < o.x + o.w && py + player.r*2 > groundY() + 18 - o.h){
          gameOver = true;
        }
      }
      for(const s of sparkles){
        const dx = s.x - player.x, dy = s.y - player.y;
        if(Math.sqrt(dx*dx+dy*dy) < player.r + s.r + 6){ s.collected = true; score += 5; }
      }

      if(frame % 6 === 0) score += 1;
      speed = 6 + score*0.02;
      document.getElementById('score').textContent = 'Score: ' + score;
    }

    // obstacles (crystal spikes)
    for(const o of obstacles){
      ctx.fillStyle = 'hsl(' + o.hue + ', 70%, 75%)';
      ctx.beginPath();
      ctx.moveTo(o.x, groundY()+18);
      ctx.lineTo(o.x + o.w/2, groundY()+18-o.h);
      ctx.lineTo(o.x + o.w, groundY()+18);
      ctx.closePath(); ctx.fill();
    }

    // sparkles
    for(const s of sparkles){
      ctx.fillStyle = '#fff3b0';
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(frame*0.05);
      for(let i=0;i<4;i++){ ctx.rotate(Math.PI/2); ctx.fillRect(-1.5, -s.r*2, 3, s.r*2); }
      ctx.restore();
    }

    // player (dreamy blob)
    ctx.fillStyle = '#ff7fb8';
    ctx.beginPath(); ctx.arc(player.x, player.y - player.r, player.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.arc(player.x-6, player.y - player.r-6, 6, 0, Math.PI*2); ctx.fill();

    if(gameOver){
      ctx.fillStyle = 'rgba(74,47,107,.85)';
      ctx.font = 'bold 26px Trebuchet MS';
      ctx.textAlign = 'center';
      ctx.fillText('Dream interrupted — tap to try again', canvas.width/2, canvas.height*0.35);
    }

    requestAnimationFrame(loop);
  }
  loop();
</script>
</body>
</html>`;
