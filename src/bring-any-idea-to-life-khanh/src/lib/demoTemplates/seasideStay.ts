export const SEASIDE_STAY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Seaside Stay</title>
<style>
  *{box-sizing:border-box;}
  html,body{margin:0; font-family:'Helvetica Neue', Arial, sans-serif; color:#1c2b33;}
  .hero{
    position:relative; height:64vh; min-height:380px; overflow:hidden; display:flex; align-items:flex-end;
    background: linear-gradient(180deg, #bfe4f5 0%, #8fcbe8 35%, #3f8fae 70%, #235a72 100%);
  }
  .sun{position:absolute; top:14%; right:14%; width:70px; height:70px; border-radius:50%; background:#ffe08a; box-shadow:0 0 60px 20px rgba(255,224,138,.5);}
  .wave{position:absolute; bottom:0; left:0; width:200%; height:90px; background: repeating-radial-gradient(circle at 30px -10px, rgba(255,255,255,.5) 0 6px, transparent 7px 60px); animation: drift 8s linear infinite;}
  @keyframes drift{ from{ transform:translateX(0);} to{ transform:translateX(-50%);} }
  .hero-content{position:relative; z-index:2; padding:0 8vw 40px; color:#fff;}
  .eyebrow{font-size:12px; letter-spacing:.3em; text-transform:uppercase; opacity:.85;}
  h1{font-size:clamp(30px,5vw,52px); font-weight:300; margin:8px 0 0; max-width:640px;}

  .booking-card{
    max-width:1040px; margin:-46px auto 0; position:relative; z-index:3; background:#fff; border-radius:16px;
    box-shadow:0 24px 60px rgba(20,50,60,.18); padding:22px 26px; display:flex; gap:18px; flex-wrap:wrap; align-items:flex-end;
  }
  .field{display:flex; flex-direction:column; gap:4px; flex:1; min-width:130px;}
  .field label{font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:#6b8a97;}
  .field input, .field select{font-family:inherit; font-size:14px; border:none; outline:none; color:#1c2b33; padding:4px 0; border-bottom:1px solid #dfeaf0;}
  .search-btn{background:#235a72; color:#fff; border:none; padding:12px 26px; border-radius:10px; font-size:14px; cursor:pointer; height:42px;}
  .search-btn:hover{background:#1a4757;}

  .listings{max-width:1040px; margin:56px auto; padding:0 8vw;}
  .listings h2{font-weight:300; font-size:24px; margin-bottom:22px;}
  .grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:20px;}
  .card{border-radius:14px; overflow:hidden; background:#f5f9fb; border:1px solid #e4eef1; cursor:pointer; transition: transform .2s;}
  .card:hover{transform:translateY(-4px);}
  .card .img{height:150px; position:relative; overflow:hidden;}
  .card .price-tag{position:absolute; bottom:10px; left:10px; background:rgba(255,255,255,.9); padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600;}
  .card .info{padding:14px;}
  .card .info h3{margin:0 0 4px; font-size:15px; font-weight:600;}
  .card .info p{margin:0; font-size:12px; color:#6b8a97;}
  .stars{color:#e8a23b; font-size:12px; margin-top:6px;}

  .modal-backdrop{position:fixed; inset:0; background:rgba(20,40,50,.5); display:none; align-items:center; justify-content:center; z-index:10;}
  .modal-backdrop.open{display:flex;}
  .modal{background:#fff; border-radius:14px; padding:28px; max-width:360px; text-align:center;}
  .modal h3{margin-top:0;}
  .modal button{margin-top:14px; background:#235a72; color:#fff; border:none; padding:10px 22px; border-radius:8px; cursor:pointer;}
</style>
</head>
<body>
<section class="hero">
  <div class="sun"></div>
  <div class="wave"></div>
  <div class="hero-content">
    <div class="eyebrow">Seaside Stay</div>
    <h1>Wake up to the tide, every morning.</h1>
  </div>
</section>

<div class="booking-card">
  <div class="field"><label>Destination</label><input id="dest" placeholder="Where to?" value="Amalfi Coast" /></div>
  <div class="field"><label>Check in</label><input type="date" id="checkin" /></div>
  <div class="field"><label>Check out</label><input type="date" id="checkout" /></div>
  <div class="field"><label>Guests</label>
    <select id="guests"><option>1 guest</option><option selected>2 guests</option><option>3 guests</option><option>4+ guests</option></select>
  </div>
  <button class="search-btn" id="searchBtn">Search stays</button>
</div>

<div class="listings">
  <h2 id="resultsTitle">Stays along the coast</h2>
  <div class="grid" id="grid"></div>
</div>

<div class="modal-backdrop" id="modalBackdrop">
  <div class="modal">
    <h3 id="modalTitle">Booked!</h3>
    <p id="modalBody">We've held this stay for you. A confirmation would land in your inbox in a real app.</p>
    <button id="modalClose">Nice</button>
  </div>
</div>

<script>
  const stays = [
    { name:'Cliffside Blue House', place:'Amalfi Coast, Italy', price:'$210/night', rating:4.9, c1:'#3f8fae', c2:'#bfe4f5' },
    { name:'The Dune Cabin', place:'Cape Cod, USA', price:'$165/night', rating:4.7, c1:'#8a7a5a', c2:'#e8d9b8' },
    { name:'Coral Bay Loft', place:'Zanzibar, Tanzania', price:'$140/night', rating:4.8, c1:'#2fa9a0', c2:'#bff0e8' },
    { name:'Salt Air Cottage', place:'Big Sur, USA', price:'$255/night', rating:5.0, c1:'#4a6b8a', c2:'#cfe0ee' },
    { name:'Tide Pool House', place:'Santorini, Greece', price:'$300/night', rating:4.9, c1:'#3f6a9e', c2:'#e8f0f8' },
    { name:'Driftwood Studio', place:'Byron Bay, Australia', price:'$120/night', rating:4.6, c1:'#5a9e7a', c2:'#dff0e2' },
  ];

  const grid = document.getElementById('grid');
  function renderStays(list){
    grid.innerHTML = '';
    list.forEach(s => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="img" style="background:linear-gradient(160deg,'+s.c1+','+s.c2+')"><div class="price-tag">'+s.price+'</div></div>' +
        '<div class="info"><h3>'+s.name+'</h3><p>'+s.place+'</p><div class="stars">' + '★'.repeat(Math.round(s.rating)) + ' ' + s.rating + '</div></div>';
      card.addEventListener('click', () => openModal(s));
      grid.appendChild(card);
    });
  }
  renderStays(stays);

  const backdrop = document.getElementById('modalBackdrop');
  function openModal(stay){
    document.getElementById('modalTitle').textContent = stay ? ('Requested: ' + stay.name) : 'Search updated';
    document.getElementById('modalBody').textContent = stay
      ? 'This is a demo booking flow — no real reservation was made.'
      : 'Showing stays that match your dates and guest count (demo data).';
    backdrop.classList.add('open');
  }
  document.getElementById('modalClose').addEventListener('click', () => backdrop.classList.remove('open'));
  document.getElementById('searchBtn').addEventListener('click', () => {
    const dest = document.getElementById('dest').value || 'anywhere';
    document.getElementById('resultsTitle').textContent = 'Stays near ' + dest;
    const shuffled = [...stays].sort(() => Math.random()-0.5);
    renderStays(shuffled);
    openModal(null);
  });
</script>
</body>
</html>`;
