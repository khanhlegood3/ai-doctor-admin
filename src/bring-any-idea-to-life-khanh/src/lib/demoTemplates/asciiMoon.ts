export const ASCII_MOON_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ASCII Moon</title>
<style>
  *{box-sizing:border-box;}
  html,body{height:100%;margin:0; background:#020403;}
  body{
    display:flex; align-items:center; justify-content:center; flex-direction:column;
    font-family: ui-monospace, 'Courier New', monospace; color:#39ff6a; overflow:hidden;
  }
  pre{
    line-height:0.86; font-size:9px; letter-spacing:1px; white-space:pre; margin:0;
    text-shadow: 0 0 6px rgba(57,255,106,.5);
    user-select:none;
  }
  .hud{display:flex; gap:22px; margin-top:18px; font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:#1f8a3f; flex-wrap:wrap; justify-content:center;}
  .hud b{color:#39ff6a;}
  .controls{display:flex; gap:10px; margin-top:14px;}
  button{
    font-family:inherit; font-size:11px; background:transparent; color:#39ff6a; border:1px solid #1f8a3f;
    padding:6px 14px; border-radius:4px; cursor:pointer; letter-spacing:.1em; text-transform:uppercase;
  }
  button:hover{background:rgba(57,255,106,.1);}
  .scan{position:fixed; inset:0; pointer-events:none; background:repeating-linear-gradient(rgba(0,0,0,0) 0, rgba(0,0,0,0) 2px, rgba(0,0,0,.15) 3px); mix-blend-mode:multiply;}
</style>
</head>
<body>
<div class="scan"></div>
<pre id="moon"></pre>
<div class="hud">
  <div>phase: <b id="phaseLabel">full</b></div>
  <div>spin: <b id="spinLabel">on</b></div>
</div>
<div class="controls">
  <button id="phaseBtn">cycle phase</button>
  <button id="spinBtn">toggle spin</button>
</div>
<script>
  const ramp = ' .:-=+*#%@';
  const cols = 72, rows = 36;
  const pre = document.getElementById('moon');
  let angle = 0, spinning = true, phaseIdx = 0;
  const phases = ['new', 'crescent', 'half', 'gibbous', 'full'];
  const phaseLightOffset = { new: -2.2, crescent: -1.1, half: 0, gibbous: 1.1, full: 2.2 };

  function render(){
    let out = '';
    const R = 1;
    const lightOffset = phaseLightOffset[phases[phaseIdx]];
    for(let j = 0; j < rows; j++){
      let line = '';
      const v = (j / (rows-1)) * 2 - 1; // -1..1
      for(let i = 0; i < cols; i++){
        const u = (i / (cols-1)) * 2 - 1;
        const x = u, y = v * 1.6;
        const d2 = x*x + y*y;
        if(d2 > R*R){ line += ' '; continue; }
        const z = Math.sqrt(Math.max(0, R*R - d2));
        // rotate normal around Y for spin
        const nx = x*Math.cos(angle) + z*Math.sin(angle) + lightOffset*0.15;
        const nz = -x*Math.sin(angle) + z*Math.cos(angle);
        const lightDir = { x: 0.5, y: 0.4, z: 0.9 };
        let lum = nx*lightDir.x + y*(-lightDir.y) + nz*lightDir.z;
        lum = (lum + 1) / 2; // 0..1
        // craters via cheap noise
        const crater = Math.sin(nx*9 + nz*13) * Math.cos(y*11) * 0.06;
        lum = Math.max(0, Math.min(1, lum + crater));
        const idx = Math.floor(lum * (ramp.length-1));
        line += ramp[idx];
      }
      out += line + '\\n';
    }
    pre.textContent = out;
  }

  function loop(){
    if(spinning) angle += 0.02;
    render();
    requestAnimationFrame(loop);
  }
  loop();

  document.getElementById('spinBtn').addEventListener('click', () => {
    spinning = !spinning;
    document.getElementById('spinLabel').textContent = spinning ? 'on' : 'off';
  });
  document.getElementById('phaseBtn').addEventListener('click', () => {
    phaseIdx = (phaseIdx + 1) % phases.length;
    document.getElementById('phaseLabel').textContent = phases[phaseIdx];
  });
</script>
</body>
</html>`;
