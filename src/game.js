(() => {
  'use strict';
  const G = window.WallBounceLogic;
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const overlay = document.querySelector('#overlay');
  const W = 360, H = 640, LEFT = 36, RIGHT = 324;
  const images = {};
  const assets = ['wall','block','saw','coin','spikes-left','spikes-right','spring','star','shield','beam','blade','flower-deco','bg-sunset','bg-night','bg-dawn',
    ...G.SKINS.map(s => `ball-${s.id}`)];
  assets.forEach(id => {
    const img = new Image();
    img.src = id.startsWith('ball-') ? `assets/balls/${id.substring(5)}.png` : `assets/${id}.png`;
    images[id] = img;
  });
  ctx.imageSmoothingEnabled = false;
  let profile = G.freshProfile();
  let mode = 'loading';
  let result = null;
  let run = null;
  let lastFrame = 0;
  let clock = 0;
  let animationEpoch = 0;
  let banner = null;
  let rng = G.seeded(93);
  let collectionFilter = 'all';
  let eventTab = 'event';
  let inspected = profile.selected;
  let scrollPosition = 0;
  const Music = window.WallBounceMusic;
  const stars = Array.from({ length: 62 }, (_, i) => ({
    x: 55 + (i * 73.43) % 249,
    y: (i * 97.61) % H,
    phase: i * 1.23,
    size: i % 8 === 0 ? 2 : 1
  }));

  let writeQueue=Promise.resolve();
  let storageError='';
  async function loadProfile(){
    if(!window.wallBounceStorage)return G.freshProfile();
    try{return G.normalizeProfile(await window.wallBounceStorage.load());}
    catch(error){storageError='No se pudo abrir el archivo de progreso en Documentos.';return G.freshProfile();}
  }
  function saveProfile(){
    if(!window.wallBounceStorage)return;
    const snapshot=JSON.parse(JSON.stringify(profile));
    writeQueue=writeQueue.then(()=>window.wallBounceStorage.save(snapshot)).catch(error=>{
      storageError='No se pudo guardar en Documentos. Comprueba los permisos.';
      console.error('Guardado fallido:',error);
    });
  }
  function asset(name) {
    const img = images[name];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }
  function sprite(id, x, y, width, height) {
    const img = asset(id);
    if (img) ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }
  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
  }
  function startGame() {
    rng = G.seeded((Math.random() * 0xFFFFFFFF) >>> 0);
    run = {
      score: 0, picked: 0, stars: 0, shield: 0, wallBounces: 0, avoided: 0,
      balls: [], obstacles: [], pickups: [], particles: [],
      nextY: 260, spawned: 0, camera: 0, shake: 0, flash: 0,
      ball: {x: 176, y: 488, vx: 137, vy: -125, r: 12, inv: 1.3, trail: [], angle: 0, impact: 0}
    };
    while (run.nextY > -140) spawnObstacle();
    banner = null;
    mode = 'playing';
    result = null;
    animationEpoch++;
    renderUI();
    Music.play('level');
  }
  function spawnObstacle() {
    const score = run.score;
    const o = G.obstacle(rng, run.spawned, run.nextY, score);
    run.obstacles.push(o);
    if (run.spawned > 0 && run.spawned % 2 === 0) {
      run.pickups.push({kind:'coin', x: Math.round(116 + rng() * 125), y: run.nextY + 54, taken: false});
    }
    if (run.spawned > 2 && run.spawned % 4 === 0) {
      run.pickups.push({kind:'star', x: Math.round(146 + rng() * 68), y: run.nextY - 40, taken: false});
    }
    if (run.spawned >= 11 && run.spawned % 13 === 0) {
      run.pickups.push({kind:'shield', x: Math.round(150 + rng() * 50), y: run.nextY - 52, taken: false});
    }
    const gap = 169 - Math.min(57, score / 9) + rng() * 18;
    run.nextY -= gap;
    run.spawned++;
  }
  function pause() {
    if (mode === 'playing') {
      mode = 'pause';
      renderUI();
      Music.play('pause');
    } else if (mode === 'pause') {
      mode = 'playing';
      renderUI();
    }
  }
  function menu() {
    mode = 'menu';
    result = null;
    run = null;
    animationEpoch++;
    renderUI();
  }
  function emit(x, y, color, count = 12, speed = 95) {
    if (!run || profile.reducedFx) return;
    for (let i = 0; i < count; i++) {
      run.particles.push({
        x, y, vx: (rng() - .5) * speed * 2,
        vy: (rng() - .5) * speed * 2,
        size: 2 + Math.round(rng() * 3),
        life: .28 + rng() * .3,
        max: .58, color
      });
    }
  }
  function impulse() {
    if (mode !== 'playing' || !run) return;
    const b = run.ball;
    b.vy = -376;
    b.angle += (b.vx > 0 ? .18 : -.18);
    emit(b.x, b.y + run.camera, '#be88ff', 9, 82);
    Music.play('jump');
  }
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    impulse();
  });
  document.addEventListener('keydown', event => {
    if (['Space', 'ArrowUp', 'Escape'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape') {
      if (mode === 'playing' || mode === 'pause') pause();
      else if (mode === 'skins' || mode === 'settings' || mode === 'unlocked' || mode === 'events') menu();
    } else if ((event.code === 'Space' || event.code === 'ArrowUp') && !event.repeat) {
      if (mode === 'playing') impulse();
      else if (mode === 'menu') startGame();
    }
  });
  window.addEventListener('blur', () => { if (mode === 'playing') pause(); Music.suspend(); });
  window.addEventListener('focus', () => { Music.sync(mode,profile.music,profile.volume,profile.sound); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pause(); });
  overlay.addEventListener('click',event=>{
    const button=event.target.closest('button[data-action]');if(!button)return;
    event.stopPropagation();
    Music.activate(mode,profile.music,profile.volume,profile.sound);
    const action=button.dataset.action;
    if(action==='play'||action==='retry')startGame();
    else if(action==='pause'||action==='resume')pause();
    else if(action==='menu')menu();
    else if(action==='skins'){mode='skins';inspected=profile.selected;collectionFilter='all';scrollPosition=0;renderUI();}
    else if(action==='settings'){mode='settings';renderUI();}
    else if(action==='events'){mode='events';renderUI();}
    else if(action==='eventTab'){eventTab=button.dataset.tab;renderUI();}
    else if(action==='trailBuy'){const ans=G.buyTrail(profile,button.dataset.trail);if(ans.success){profile=ans.profile;saveProfile();Music.play('unlock');}else Music.play('tap');renderUI();}
    else if(action==='sound'){profile.sound=!profile.sound;saveProfile();renderUI();}
    else if(action==='music'){profile.music=!profile.music;saveProfile();renderUI();}
    else if(action==='volume'){profile.volume=G.clamp(profile.volume+Number(button.dataset.change),0,100);saveProfile();renderUI();}
    else if(action==='effects'){profile.reducedFx=!profile.reducedFx;saveProfile();renderUI();}
    else if(action==='folder'){if(window.wallBounceStorage)window.wallBounceStorage.openFolder().catch(console.error);}
    else if(action==='filter'){collectionFilter=button.dataset.filter;scrollPosition=0;renderUI();}
    else if(action==='viewskin'){
      const grid=document.getElementById('catalog-grid');if(grid)scrollPosition=grid.scrollTop;
      inspected=button.dataset.skin;renderUI();
    }
    else if(action==='equip'){
      if(profile.unlocked.includes(button.dataset.skin)){profile.selected=button.dataset.skin;saveProfile();Music.play('unlock');
        if(mode==='unlocked')mode='over';renderUI();}
    }
    else if(action==='showUnlock'){mode='unlocked';Music.play('unlock');renderUI();}
    else if(action==='results'){mode='over';renderUI();}
    if(action!=='play'&&action!=='retry'&&action!=='equip'&&action!=='showUnlock')Music.play('tap');
  });

  function collision(o, b) {
    const r = b.r - 4;
    if (o.type === 'spring') return false;
    if (o.type === 'beam' || o.type === 'blade') return G.circleRect(b.x,b.y,r,o.x+5,o.y+4,o.w-10,o.h-8);
    if (o.type === 'spike') {
      const x = o.side === 'left' ? LEFT : RIGHT - o.w;
      return G.circleRect(b.x, b.y, r, x + 3, o.y + 3, o.w - 6, o.h - 6);
    }
    if (o.type === 'double') {
      return G.circleRect(b.x, b.y, r, LEFT + 4, o.y + 3, o.w - 7, o.h - 6) ||
        G.circleRect(b.x, b.y, r, RIGHT - o.w + 3, o.y + 3, o.w - 7, o.h - 6);
    }
    if (o.type === 'block') return G.circleRect(b.x, b.y, r, o.x + 3, o.y + 3, o.w - 6, o.h - 6);
    if (o.type === 'moving') {
      const x = o.x + Math.sin(clock * o.speed + o.phase) * o.amp;
      return G.circleRect(b.x, b.y, r, x + 3, o.y + 3, o.w - 6, o.h - 6);
    }
    return G.circleCircle(b.x, b.y, r, o.x, o.y + 16, o.r - 2);
  }
  function finish() {
    if (mode !== 'playing' || !run) return;
    const b = run.ball;
    emit(b.x, b.y + run.camera, '#ff66bf', 28, 150);
    run.shake = 9;
    run.flash = .15;
    const computed = G.applyRun(profile, run);
    profile = computed.profile;
    result = { ...computed, score: run.score, bounces: run.wallBounces,
      avoided: run.avoided, picked: run.picked, stars: run.stars };
    saveProfile();
    mode = 'over';
    animationEpoch++;
    Music.play('hit');
    renderUI();
  }
  function update(dt) {
    clock += dt * (mode === 'playing' ? 1 : mode === 'pause' ? 0 : .2);
    if (!run) return;
    if (mode !== 'playing' && mode !== 'over') return;
    if (run.shake > 0) run.shake = Math.max(0, run.shake - dt * 25);
    if (run.flash > 0) run.flash = Math.max(0, run.flash - dt);
    for (const p of run.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 130 * dt;
      p.life -= dt;
    }
    run.particles = run.particles.filter(p => p.life > 0).slice(-180);
    if (mode !== 'playing') return;
    const b = run.ball;
    b.inv = Math.max(0, b.inv - dt);
    b.impact = Math.max(0, (b.impact || 0) - dt * 8);
    const speed = 137 + Math.min(115, run.score * .16);
    b.vx = Math.sign(b.vx || 1) * speed;
    b.vy = Math.min(270, b.vy + 515 * dt);
    b.angle += dt * (b.vx > 0 ? 1.45 : -1.45);
    const previousX = b.x;
    const previousY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x + b.r >= RIGHT) {
      b.x = RIGHT - b.r;
      b.vx = -speed;
      run.wallBounces++;
      b.impact = 1;
      emit(b.x, b.y + run.camera, '#63ecff', 11);
      run.shake = profile.reducedFx ? 0 : 2;
      Music.play('bounce');
    }
    if (b.x - b.r <= LEFT) {
      b.x = LEFT + b.r;
      b.vx = speed;
      run.wallBounces++;
      b.impact = 1;
      emit(b.x, b.y + run.camera, '#63ecff', 11);
      run.shake = profile.reducedFx ? 0 : 2;
      Music.play('bounce');
    }
    run.camera = Math.max(run.camera, 310 - b.y);
    const newScore = Math.max(run.score, Math.floor((488 - b.y) / 5));
    if (newScore !== run.score) {
      run.score = newScore;
      const hud = document.getElementById('hud-score');
      if (hud) hud.textContent = run.score;
    }
    if (b.y + run.camera > H + 22) { finish(); return; }
    // La trayectoria se comprueba en pequeños segmentos para no atravesar obstáculos a gran velocidad.
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - previousX, b.y - previousY) / 5));
    for (const o of run.obstacles) {
      if (o.y + run.camera < -65 || o.y + run.camera > H + 65) continue;
      if (o.type==='spring') {
        if (!o.used && G.circleRect(b.x,b.y,b.r,o.x+2,o.y+2,o.w-4,o.h-5) && b.vy>-250){
          o.used=true;b.vy=-455;emit(b.x,b.y+run.camera,'#adf7fc',22,85);
          Music.play('spring');banner={text:'¡SUPERSALTO!',until:clock+1.0};
        }
      } else if (b.inv <= 0) {
        for (let i = 1; i <= steps; i++) {
          const sample = {x: previousX + (b.x - previousX) * i / steps,
            y: previousY + (b.y - previousY) * i / steps, r: b.r};
          if (collision(o, sample)) {
            if (run.shield>0) {run.shield--;b.inv=.95;b.vy=-300;
              emit(b.x,b.y+run.camera,'#7cfcf8',23,120);
              banner={text:'¡ESCUDO ACTIVADO!',until:clock+1.2};Music.play('shield');break;
            } else { finish();return; }
          }
        }
      }
      if (!o.passed && b.y + 14 < o.y) {
        o.passed = true;
        run.avoided++;
        if (run.avoided % 5 === 0) {
          banner = {text: `✦ ${run.avoided} OBSTÁCULOS ✦`, until: clock + 1.1};
          Music.play('level');
        }
      }
    }
    for (const p of run.pickups) {
      if (p.taken) continue;
      if (G.circleCircle(b.x, b.y, b.r + 2, p.x, p.y, p.kind==='shield'?15:12)) {
        p.taken=true;
        if(p.kind==='coin'){run.picked++;Music.play('coin');}
        if(p.kind==='star'){run.stars++;Music.play('star');banner={text:'★ +1 ESTRELLA',until:clock+.8};}
        if(p.kind==='shield'){run.shield=1;Music.play('shield');banner={text:'¡ESCUDO!',until:clock+.8};}
        emit(p.x,p.y+run.camera,p.kind==='star'?'#ffcf5a':p.kind==='shield'?'#6feefe':'#ffd873',16);
        const hud=document.getElementById('hud-pickups');if(hud)hud.textContent=`${run.picked}`;
        const stars=document.getElementById('hud-stars');if(stars)stars.textContent=`${run.stars}`;
        const shield=document.getElementById('hud-shield');if(shield)shield.textContent=run.shield?'◆':'';
      }
    }
    b.trail.unshift({x: b.x, y: b.y});
    if (b.trail.length > 13) b.trail.pop();
    run.obstacles = run.obstacles.filter(o => o.y + run.camera <= H + 100);
    run.pickups = run.pickups.filter(p => !p.taken && p.y + run.camera <= H + 60);
    while (run.nextY + run.camera > -140 && run.obstacles.length < 25) spawnObstacle();
  }

  function drawBackground() {
    const world = run ? (run.score>550?'dawn':run.score>250?'night':'sunset') : 'sunset';
    const bg=asset(`bg-${world}`);
    if (bg) {
      ctx.drawImage(bg,0,0,W,H);
      const o=run?run.camera:clock*18;
      ctx.save();ctx.globalAlpha=.19;
      ctx.drawImage(bg,0,((o*.04)%H)-H,W,H);
      ctx.restore();
    } else rect(0,0,W,H,'#293758');
    const offset=run?run.camera:clock*15;
    // Los destellos y los edificios tienen velocidades diferentes para dar profundidad.
    for (const s of stars) {
      const y=((s.y+offset*.11)%H+H)%H;
      const lit=Math.sin(clock*1.8+s.phase)>.25;
      rect(s.x,y,s.size,s.size,lit?'#fff3b3':'#a8b7dc');
    }
    // Las paredes solo se dibujan en la partida: el menú aprovecha todo el fondo.
    if (mode!=='playing' && mode!=='pause' && mode!=='over') return;
    for (let y=-36;y<H+36;y+=32) {
      const shift=(Math.floor(offset*.52)%32+32)%32;
      sprite('wall',0,y+shift,36,32);
      sprite('wall',RIGHT,y+shift,36,32);
    }
    rect(LEFT-3,0,3,H,'#d3e4f2');rect(RIGHT,0,3,H,'#d3e4f2');
    rect(LEFT,0,3,H,'#59768c');rect(RIGHT-3,0,3,H,'#59768c');
    for (let i=0;i<11;i++) {
      const y=(((i*91+offset*.7)%770)+770)%770-45;
      rect(LEFT-2,y,2,14,'#a4fcda');rect(RIGHT,y+21,2,14,'#a4fcda');
    }
  }
  function drawObstacle(o, y) {
    if (o.type === 'spike') {
      const x = o.side === 'left' ? LEFT : RIGHT - o.w;
      sprite(`spikes-${o.side}`, x, y, o.w, o.h);
    } else if (o.type === 'double') {
      sprite('spikes-left', LEFT, y, o.w, o.h);
      sprite('spikes-right', RIGHT - o.w, y, o.w, o.h);
    } else if (o.type === 'spring') {
      ctx.save();ctx.globalAlpha=o.used?.42:1;sprite('spring',o.x,y+Math.sin(clock*3+o.phase)*1.5,o.w,o.h);ctx.restore();
    } else if (o.type === 'beam') {
      sprite('beam',o.x,y,o.w,o.h);
    } else if (o.type === 'blade') {
      sprite('blade',o.x,y,o.w,o.h);
    } else if (o.type === 'block') {
      sprite('block', o.x, y, o.w, o.h);
    } else if (o.type === 'moving') {
      const x = o.x + Math.sin(clock * o.speed + o.phase) * o.amp;
      ctx.save();ctx.globalAlpha=.47;sprite('beam',x-11,y+12,58,7);ctx.restore();
      sprite('block', x, y, o.w, o.h);
    } else if (o.type === 'saw') {
      ctx.save();
      ctx.translate(Math.round(o.x), Math.round(y + 16));
      ctx.rotate(clock * 1.7);
      sprite('saw', -20, -20, 40, 40);
      ctx.restore();
    }
  }
  function drawBall(x, y, imgName, scale = 1) {
    const s = 44 * scale;
    if (!profile.reducedFx) {
      ctx.fillStyle = '#fff4c654';
      ctx.beginPath();ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);ctx.fill();
    }
    const img = asset(imgName);
    if (img) {
      ctx.save();
      const impact = run && mode === 'playing' ? (run.ball.impact || 0) : 0;
      ctx.translate(x,y);
      ctx.rotate(run && mode === 'playing' ? Math.sin(run.ball.angle) * .14 : Math.sin(clock*.8)*.05);
      ctx.scale(1+impact*.16,1-impact*.13);
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(img,-s/2,-s/2,s,s);
      ctx.imageSmoothingEnabled=false;
      ctx.restore();
    }
    else {ctx.fillStyle='#fff4db';ctx.beginPath();ctx.arc(x,y,13*scale,0,Math.PI*2);ctx.fill();}
  }
  function draw() {
    ctx.save();
    if (run && run.shake && !profile.reducedFx) ctx.translate(Math.round((rng() - .5) * run.shake), Math.round((rng() - .5) * run.shake));
    drawBackground();
    if (run) {
      const cam = run.camera;
      for (const o of run.obstacles) {
        const y = o.y + cam;
        if (y < -70 || y > H + 60) continue;
        drawObstacle(o, y);
      }
      for (const p of run.pickups) {
        if (!p.taken && p.y + cam > -20 && p.y + cam < H + 20) {
          const yy = p.y + cam + Math.sin(clock * 5 + p.x) * 3;
          sprite(p.kind==='star'?'star':p.kind==='shield'?'shield':'coin',p.x-13,yy-13,26,26);
        }
      }
      const b = run.ball;
      const trailStyle=G.TRAILS.find(t=>t.id===profile.selectedTrail)||G.TRAILS[0];
      if (mode !== 'over') {
        if (!profile.reducedFx) {
          b.trail.forEach((item,index)=>{
            if(index%2!==0)return;
            const k=(b.trail.length-index)/b.trail.length;
            ctx.globalAlpha=.10+k*.22;
            ctx.fillStyle=trailStyle.colors[index%2];
            ctx.beginPath();ctx.arc(item.x,item.y+cam,3+k*9,0,Math.PI*2);ctx.fill();
          });ctx.globalAlpha=1;
        }
        if (b.inv <= 0 || Math.floor(clock * 8) % 2 === 0) {
          drawBall(b.x, b.y + cam, `ball-${profile.selected}`);
        }
      }
      for (const p of run.particles) {
        const a = G.clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = a;
        rect(p.x, p.y, p.size, p.size, p.color);
      }
      ctx.globalAlpha = 1;
      if (run.flash > 0 && !profile.reducedFx) {
        ctx.globalAlpha = Math.min(.6, run.flash * 2.5);
        rect(0, 0, W, H, '#fff5ff');
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (mode === 'playing' && banner && banner.until > clock) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#14273c';
      ctx.fillText(banner.text, 181, 111);
      ctx.fillStyle = '#b4faff';
      ctx.fillText(banner.text, 180, 109);
    }
  }
  function ballSrc(id){return `assets/balls/${id}.png`;}
  function coinIcon(){return '<img class="coin-icon" src="assets/coin.png" alt="monedas">';}
  function renderUI(){
    animationEpoch++;
    const epoch=animationEpoch;
    Music.sync(mode,profile.music,profile.volume,profile.sound);
    if(mode==='loading'){overlay.innerHTML='<div class="loading">CARGANDO...</div>';return;}
    if(mode==='playing'){
      overlay.innerHTML=`<div class="hud"><span class="hud-coins">${coinIcon()} <span id="hud-pickups">${run.picked}</span></span>
       <div class="hud-score"><span id="hud-score">${run.score}</span><small>ALTURA</small></div><span class="hud-stars">★ <span id="hud-stars">${run.stars}</span> <b id="hud-shield">${run.shield?'◆':''}</b></span>
       <button class="hud-pause" data-action="pause" aria-label="Pausar partida">Ⅱ</button></div>`;
      return;
    }
    if(mode==='menu'){
      const next=G.nextSkin(profile);
      const percentage=next?profile.progress:100;
      overlay.innerHTML=`<section class="menu-screen">
        <header class="menu-top"><span class="pill coin-pill">${coinIcon()} ${profile.coins}</span><span class="pill">★ ${profile.high} RÉCORD</span></header>
        <div class="menu-hero"><div class="logo-text"><span>WALL</span><strong>BOUNCE</strong></div>
          <div class="floating-sparks" aria-hidden="true">✦ &nbsp; ✧ &nbsp; ✦</div>
          <div class="podium"><img class="ball-img" src="${ballSrc(profile.selected)}" alt="Pelota equipada"></div>
          <span class="hero-name">${G.SKINS.find(s=>s.id===profile.selected).name}</span>
          <span class="hero-sub">Toca para saltar · Rebota y llega más alto</span></div>
        <div class="menu-bottom"><button class="btn btn-play" data-action="play"><span>▶</span> ¡JUGAR!</button>
          <div class="next-card"><div class="next-icon"><img src="${ballSrc(next?next.id:'fox')}" alt=""></div>
            <div class="next-copy"><b>${next?'PRÓXIMA PELOTA':'¡COLECCIÓN COMPLETA!'}</b><span>${next?next.name:'¡Has conseguido todas!'}</span>
             <div class="progress-track"><i style="width:${percentage}%"></i></div></div><b class="next-percent">${percentage}%</b></div>
          <div class="menu-nav"><button class="nav-btn" data-action="skins"><span>✿</span> PELOTAS</button>
            <button class="nav-btn" data-action="events"><span>★</span> EVENTOS</button>
            <button class="nav-btn" data-action="settings"><span>⚙</span> AJUSTES</button></div>
          ${storageError?`<p class="save-warning">${storageError}</p>`:''}
        </div></section>`;return;
    }
    if(mode==='pause'){
      overlay.innerHTML=`<div class="screen-shade"><section class="modal-card pause-card">
        <span class="modal-icon">Ⅱ</span><h1>EN PAUSA</h1><p>Llevas <strong>${run.score}</strong> puntos</p>
        <div class="stack"><button class="btn btn-green" data-action="resume">▶ CONTINUAR</button>
        <button class="btn btn-yellow" data-action="retry">↻ REINICIAR</button>
        <button class="btn btn-purple" data-action="menu">⌂ MENÚ PRINCIPAL</button></div>
      </section></div>`;return;
    }
    if(mode==='over'){
      const target=result.target;const unlocked=G.SKINS.find(s=>s.id===result.unlocked);
      const meta=target?`<div class="progress-card">
        <div class="progress-heading">${unlocked?'¡NUEVA PELOTA!':'DESBLOQUEANDO...'}</div>
        <div class="progress-main"><div class="orb-ring" id="progress-ring" style="--progress:${result.from}%"><div class="ring-center"><img src="${ballSrc(target.id)}" alt="${target.name}"></div></div>
         <div class="progress-details"><h2>${target.name}</h2><p>Avanza jugando partidas</p><div class="result-progress-track"><div id="progress-bar" style="width:${result.from}%"></div></div>
         <div class="progress-numbers"><strong id="progress-pct">${result.from}%</strong><span class="plus">+${result.gained}% esta partida</span></div></div></div>
       </div>`:`<div class="progress-card done"><h2>¡Colección completa!</h2><p>Has desbloqueado las 36 pelotas.</p></div>`;
      overlay.innerHTML=`<section class="results-screen"><div class="results-wrap">
        <div class="results-head"><span class="kicker">PARTIDA TERMINADA</span><h1>${result.isRecord?'¡NUEVO RÉCORD!':'¡BUEN REBOTE!'}</h1>
         <div class="score-caption">TU PUNTUACIÓN</div><div class="score-number">${result.score}</div></div>
        <div class="result-rewards"><div><span>${coinIcon()} MONEDAS</span><b>+${result.earned}</b></div>
          <div><span>★ MEJOR PUNTUACIÓN</span><b>${profile.high}</b></div>
          <div><span>✦ ESTRELLAS RECOGIDAS</span><b>+${result.stars}</b></div>
          ${result.eventReward?`<div><span>🎁 BONUS FESTIVAL</span><b>+${result.eventReward}</b></div>`:''}</div>
        ${meta}
        ${unlocked?`<button class="btn btn-unlock" data-action="showUnlock">✦ ¡VER PELOTA DESBLOQUEADA!</button>`:''}
        <div class="results-actions"><button class="btn btn-purple" data-action="menu">⌂ MENÚ</button><button class="btn btn-green" data-action="retry">↻ REINTENTAR</button></div>
      </div></section>`;
      if(target)animateProgress(result,epoch);
      return;
    }
    if(mode==='unlocked'){
      const ball=G.SKINS.find(s=>s.id===result.unlocked);
      if(!ball){mode='over';renderUI();return;}
      overlay.innerHTML=`<section class="unlock-screen"><div class="confetti" aria-hidden="true">✦ ✦ ✧ ✦ ★ ✦ ✧</div>
        <span class="unlock-kicker">¡NUEVA PELOTA!</span><h1>¡DESBLOQUEADA!</h1>
        <div class="unlock-light"><img src="${ballSrc(ball.id)}" alt="Pelota ${ball.name}"></div><h2>${ball.name}</h2>
        <p>¡La conseguiste jugando!</p><div class="unlock-actions"><button class="btn btn-green" data-action="equip" data-skin="${ball.id}">✓ EQUIPAR</button>
        <button class="btn btn-purple" data-action="results">MÁS TARDE</button></div></section>`;return;
    }
    if(mode==='skins'){
      const s=G.SKINS.find(x=>x.id===inspected)||G.SKINS[0];const stat=G.progressFor(profile,s);
      const choices=G.SKINS.filter(x=>collectionFilter==='all'||(collectionFilter==='owned'&&profile.unlocked.includes(x.id))||(collectionFilter==='locked'&&!profile.unlocked.includes(x.id)));
      const tabs=[['all','TODAS'],['owned','CONSEGUIDAS'],['locked','PENDIENTES']].map(([key,name])=>`<button class="${collectionFilter===key?'active':''}" data-action="filter" data-filter="${key}">${name}</button>`).join('');
      overlay.innerHTML=`<section class="catalog-screen"><div class="page-header"><button class="back-btn" data-action="menu" aria-label="Volver">←</button>
        <div><h1>PELOTAS</h1><span>${profile.unlocked.length} de ${G.SKINS.length} desbloqueadas</span></div><span class="pill coin-pill">${coinIcon()} ${profile.coins}</span></div>
        <div class="catalog-tabs">${tabs}</div>
        <div id="catalog-grid" class="catalog-grid">${choices.map(ball=>{const pg=G.progressFor(profile,ball);return `<button class="skin-tile ${ball.id===inspected?'selected':''} ${pg.unlocked?'':'locked'}" data-action="viewskin" data-skin="${ball.id}">
          <img src="${ballSrc(ball.id)}" alt="${ball.name}"><span>${ball.name}</span><small>${pg.unlocked?(profile.selected===ball.id?'✓ EQUIPADA':'✓ LIBRE'):pg.active?`${pg.pct}%`:'BLOQUEADA'}</small></button>`;}).join('')}</div>
        <div class="inspect-panel"><img class="inspect-ball" src="${ballSrc(s.id)}" alt="${s.name}"><div class="inspect-copy"><h2>${s.name}</h2>
        <p>${stat.unlocked?'¡Ya es tuya!':stat.active?'La próxima que desbloquearás':'Se desbloquea al conseguir la anterior'}</p>
        ${!stat.unlocked?`<div class="progress-track"><i style="width:${stat.pct}%"></i></div><small>${stat.pct}% DESBLOQUEADO</small>`:''}</div>
        ${stat.unlocked?`<button class="btn btn-green inspect-button" data-action="equip" data-skin="${s.id}" ${profile.selected===s.id?'disabled':''}>${profile.selected===s.id?'✓ LISTA':'EQUIPAR'}</button>`:''}</div>
       </section>`;
      const grid=document.getElementById('catalog-grid');if(grid)grid.scrollTop=scrollPosition;
      return;
    }
    if(mode==='events'){
      const progress=profile.totalStars%12;
      const trophies=[{name:'Primer salto',desc:'Consigue 50 puntos',need:50,type:'score',value:profile.high},
        {name:'Conquista las nubes',desc:'Consigue 200 puntos',need:200,type:'score',value:profile.high},
        {name:'Mira las estrellas',desc:'Recoge 24 estrellas',need:24,type:'stars',value:profile.totalStars},
        {name:'Gran explorador',desc:'Juega 20 partidas',need:20,type:'plays',value:profile.plays},
        {name:'Experto del rebote',desc:'Rebota 200 veces',need:200,type:'bounces',value:profile.totalBounces},
        {name:'Maestro de las alturas',desc:'Consigue 600 puntos',need:600,type:'score',value:profile.high}];
      overlay.innerHTML=`<section class="events-screen"><div class="page-header"><button class="back-btn" data-action="menu">←</button>
      <div><h1>EVENTOS</h1><span>Retos permanentes, a tu ritmo</span></div></div>
      <div class="event-tabs"><button data-action="eventTab" data-tab="event" class="${eventTab==='event'?'active':''}">FESTIVAL</button>
      <button data-action="eventTab" data-tab="trophies" class="${eventTab==='trophies'?'active':''}">LOGROS</button>
      <button data-action="eventTab" data-tab="trails" class="${eventTab==='trails'?'active':''}">ESTELAS</button></div>
      ${eventTab==='trails'?`<div class="trail-body"><div class="trail-intro">Personaliza la estela de tu pelota con las monedas que ganas jugando. <b>${coinIcon()} ${profile.coins}</b></div>
      ${G.TRAILS.map(t=>{const owned=profile.trails.includes(t.id),equipped=t.id===profile.selectedTrail;return `<div class="trail-row"><div class="trail-art" style="--t1:${t.colors[0]};--t2:${t.colors[1]}"><span>✦</span></div><div class="trail-data"><b>${t.name}</b><small>${equipped?'EQUIPADA':owned?'CONSEGUIDA':'DISEÑO DE ESTELA'}</small></div><button class="trail-action" data-action="trailBuy" data-trail="${t.id}" ${equipped?'disabled':''}>${equipped?'✓':owned?'EQUIPAR':t.price+' ◉'}</button></div>`}).join('')}</div>`:eventTab==='event'?`<div class="event-body"><div class="event-hero"><img src="assets/star.png" alt="estrella dorada">
      <div><small>FESTIVAL PERMANENTE</small><h2>LLUVIA DE ESTRELLAS</h2><p>Recoge estrellas doradas durante las partidas. Cada 12 estrellas te regalan 80 monedas.</p></div></div>
      <div class="event-counter"><span>HACIA TU PRÓXIMA RECOMPENSA</span><b>${progress}/12</b>
      <div class="progress-track"><i style="width:${progress/12*100}%"></i></div><p>${Math.floor(profile.totalStars/12)} premios conseguidos · ${profile.totalStars} estrellas en total</p></div>
      <div class="info-note">Las estrellas aparecen en el recorrido. Los premios se entregan automáticamente al terminar la partida. No hay fecha límite.</div></div>`:
      `<div class="trophy-list">${trophies.map((t,i)=>`<div class="trophy ${t.value>=t.need?'complete':''}">
      <span class="trophy-icon">${t.value>=t.need?'★':'✦'}</span><div><b>${t.name}</b><small>${t.desc}</small>
      <div class="progress-track"><i style="width:${Math.min(100,t.value/t.need*100)}%"></i></div></div><b>${Math.min(t.value,t.need)}/${t.need}</b></div>`).join('')}</div>`}
      <button class="btn btn-green settings-return" data-action="menu">VOLVER AL MENÚ</button></section>`;return;
    }
    if(mode==='settings'){
      overlay.innerHTML=`<section class="settings-screen"><div class="page-header"><button class="back-btn" data-action="menu">←</button><div><h1>AJUSTES</h1><span>A tu manera</span></div></div>
        <div class="settings-card"><div class="setting-row"><div>♫ MÚSICA<small>Dos canciones originales</small></div><button class="switch ${profile.music?'on':''}" data-action="music">${profile.music?'SÍ':'NO'}</button></div>
        <div class="setting-row"><div>♪ EFECTOS<small>Sonidos en archivos WAV</small></div><button class="switch ${profile.sound?'on':''}" data-action="sound">${profile.sound?'SÍ':'NO'}</button></div>
        <div class="setting-row"><div>VOLUMEN<small>${Math.round(profile.volume)}%</small></div><div class="volume-controls"><button data-action="volume" data-change="-10">−</button><b>${Math.round(profile.volume)}%</b><button data-action="volume" data-change="10">+</button></div></div>
        <div class="setting-row"><div>✦ PARTÍCULAS<small>Efectos visuales</small></div><button class="switch ${profile.reducedFx?'':'on'}" data-action="effects">${profile.reducedFx?'BAJO':'SÍ'}</button></div></div>
        <div class="data-card"><h2>★ TU PROGRESO</h2><p>Las partidas, monedas y pelotas se guardan dentro de <b>Documentos/Wall Bounce</b>.</p>
        <button class="btn btn-yellow" data-action="folder">▣ ABRIR CARPETA</button>${storageError?`<p class="save-warning">${storageError}</p>`:''}</div>
        <button class="btn btn-green settings-return" data-action="menu">✓ VOLVER AL MENÚ</button></section>`;return;
    }
  }
  function animateProgress(data,epoch){
    const reduce=profile.reducedFx||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=reduce?0:1250,startAt=performance.now()+220;
    function step(now){
      if(epoch!==animationEpoch||mode!=='over')return;
      const t=duration?G.clamp((now-startAt)/duration,0,1):1;
      const eased=1-Math.pow(1-t,3);const value=Math.round(data.from+(data.to-data.from)*eased);
      const number=document.getElementById('progress-pct');const ring=document.getElementById('progress-ring');const bar=document.getElementById('progress-bar');
      if(number)number.textContent=value+'%';if(ring)ring.style.setProperty('--progress',value+'%');if(bar)bar.style.width=value+'%';
      if(t<1)requestAnimationFrame(step);else if(data.unlocked)Music.play('unlock');else if(data.gained)Music.play('progress');
    }
    requestAnimationFrame(step);
  }
  function frame(timestamp) {
    const dt = Math.min(.032, Math.max(0, (timestamp - lastFrame) / 1000 || .016));
    lastFrame = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  async function boot(){profile=await loadProfile();inspected=profile.selected;mode='menu';renderUI();}
  renderUI();boot();
  requestAnimationFrame(frame);
})();
