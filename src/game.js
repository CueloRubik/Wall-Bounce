(() => {
  'use strict';
  const G = window.WallBounceLogic;
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const overlay = document.querySelector('#overlay');
  const W = 360, H = 640, LEFT = 36, RIGHT = 324;
  const images = {};
  const assets = ['mailbag','wall','block','saw','coin','spikes-left','spikes-right','spring','star','shield','beam','blade','sky','station','harbor','observatory','moving',
    ...G.SKINS.map(s => `ball-${s.id}`)];
  assets.forEach(id => {
    const img = new Image();
    img.src = id.startsWith('ball-') ? `assets/balls/${id.substring(5)}.png` : ['sky','station','harbor','observatory'].includes(id) ? `assets/${id}.webp` : `assets/${id}.png`;
    images[id] = img;
  });
  // Keep a single native drawing grid at every window size.
  ctx.imageSmoothingEnabled = false;
  let profile = G.freshProfile();
  let mode = 'loading';
  let result = null;
  let run = null;
  let lastFrame = null;
  let accumulator = 0;
  const step = 1 / 120;
  let clock = 0;
  let animationEpoch = 0;
  let banner = null;
  let rng = G.seeded(93);
  let collectionFilter = 'all';
  let eventTab = 'event';
  let inspected = profile.selected;
  let scrollPosition = 0;
  const Music = window.WallBounceMusic;
  let writeQueue=Promise.resolve();
  const native=window.mobileStation;
  let notice='',permissionBusy=false;
  let storageError='';
  async function loadProfile(){
    if(!window.wallBounceStorage)return G.freshProfile();
    try{return G.normalizeProfile(await window.wallBounceStorage.load());}
    catch(error){storageError='No se pudo leer el progreso guardado.';return G.freshProfile();}
  }
  function saveProfile(){
    if(!window.wallBounceStorage)return;
    const snapshot=JSON.parse(JSON.stringify(profile));
    writeQueue=writeQueue.then(()=>window.wallBounceStorage.save(snapshot)).catch(error=>{
      storageError='No se pudo guardar el progreso.';
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
  const trailStars = new Map();
  function trailStar(color){
    if(trailStars.has(color))return trailStars.get(color);
    const star=asset('star');
    if(!star)return null;
    const tile=document.createElement('canvas');
    tile.width=40;tile.height=32;
    const paint=tile.getContext('2d');
    paint.imageSmoothingEnabled=false;
    paint.drawImage(star,0,0,40,32);
    paint.globalCompositeOperation='source-atop';
    paint.globalAlpha=.65;
    paint.fillStyle=color;
    paint.fillRect(0,0,40,32);
    trailStars.set(color,tile);
    return tile;
  }
  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
  }
  function startGame(practiceIndex = null, job = null) {
    const startHeight = practiceIndex === null ? 0 : G.ROUTE[practiceIndex].at;
    clock = 0;
    accumulator = 0;
    rng = G.seeded(job?.seed ?? ((Math.random() * 0xFFFFFFFF) >>> 0));
    run = {
      job, combo:0, comboCoins:0, lastCoin:-10, elapsed:0, parcels:0, lastSpring:-100, nextTap:0, boost:0,
      practiceIndex, startHeight, score: startHeight, picked: 0, stars: 0, shield: 0, wallBounces: 0, avoided: 0,
      balls: [], obstacles: [], pickups: [], particles: [],
      lastHeight: startHeight, started: false, nextY: 220, spawned: 0, camera: 0, shake: 0, flash: 0,
      ball: {x: 176, y: 488, vx: 122, vy: -125, r: 12, inv: 1.3, trail: [], angle: 0, spin: 0, impact: 0}
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
    const height = run.startHeight + (488 - run.nextY) / 5;
    const firstPractice = run.practiceIndex !== null && run.spawned === 0;
    const o = G.obstacle(rng, firstPractice ? 1 : run.spawned, run.nextY, height,
      firstPractice ? run.startHeight - 1 : run.lastHeight, run.lastSpring);
    if(o.type==='spring')run.lastSpring=run.spawned;
    run.lastHeight = height;
    run.obstacles.push(o);
    const kind = run.job?.id==='post' && run.spawned%3!==2 ? 'mailbag' : run.spawned % 11 === 9 ? 'shield' : run.spawned % 4 === 2 ? 'star' : 'coin';
    const lane=G.pickupLane(o,rng);
    run.pickups.push({kind,x:lane,y:o.y+118,taken:false});
    if(kind==='coin' && run.spawned%3===1){
      const approach=lane+(180-lane)*.45;
      run.pickups.push({kind:'coin',x:approach,y:o.y+174,taken:false});
    }
    run.nextY -= G.gapFor(height,rng);
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
        x, y, vx: (Math.random() - .5) * speed * 2,
        vy: (Math.random() - .5) * speed * 2,
        size: 2 + Math.round(Math.random() * 3),
        life: .28 + Math.random() * .3,
        max: .58, color
      });
    }
  }
  function impulse() {
    if (mode !== 'playing' || !run) return;
    const b = run.ball;
    if (!run.started) {
      run.started = true;
      if(!run.job && run.practiceIndex===null && profile.tickets>0){
        profile.tickets--;run.shield=1;saveProfile();
        const shield=document.getElementById('hud-shield');if(shield)shield.hidden=false;
      }
      document.querySelector('.launch-tip')?.remove();
    }
    if(run.elapsed + 1e-6 < run.nextTap)return;
    run.nextTap=run.elapsed+.24;
    b.vy = Math.min(b.vy, -376);
    emit(b.x, b.y + run.camera, '#be88ff', 9, 82);
    Music.play('jump');
  }
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    impulse();
  });
  document.addEventListener('keydown', event => {
    if (['Space','ArrowUp'].includes(event.code) && event.target.closest?.('button') && mode!=='playing') return;
    if (['Space','ArrowUp','Escape'].includes(event.code) && ['playing','pause','menu'].includes(mode)) event.preventDefault();
    if (event.code === 'Escape') {
      if (mode === 'playing' || mode === 'pause') pause();
      else if (mode === 'skins' || mode === 'settings' || mode === 'unlocked' || mode === 'events' || mode === 'route' || mode === 'practiceEnd' || mode === 'jobs' || mode === 'jobEnd' || mode === 'passport') menu();
    } else if ((event.code === 'Space' || event.code === 'ArrowUp') && !event.repeat) {
      if (mode === 'playing') impulse();
      else if (mode === 'menu') startGame();
    }
  });
  window.addEventListener('blur', () => { if (mode === 'playing') pause(); Music.suspend(); });
  window.addEventListener('focus', () => { Music.sync(mode,profile.music,profile.volume,profile.sound); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pause(); });
  document.getElementById('shell').addEventListener('click',event=>{
    const button=event.target.closest('button[data-action]');if(!button)return;
    event.stopPropagation();
    Music.activate(mode,profile.music,profile.volume,profile.sound);
    const action=button.dataset.action;
    if(action==='jump'){impulse();return;}
    if(action==='daily'){
      const claim=G.claimDaily(profile,G.dayNumber());profile=claim.profile;
      if(claim.reward){notice='Sello recibido · +'+claim.reward+' monedas';saveProfile();Music.play('coin');}
      renderUI();return;
    }
    if(action==='passport'){mode='passport';notice='';renderUI();return;}
    if(action==='gear'){
      const bought=G.buyGear(profile,button.dataset.id);
      if(bought.success){profile=bought.profile;saveProfile();Music.play('unlock');}
      renderUI();return;
    }
    if(action==='reminders' && native){
      if(permissionBusy)return;
      permissionBusy=true;button.disabled=true;
      native.change(!profile.reminders).then(enabled=>{
        profile.reminders=enabled;notice=enabled?'Recordatorio activado.':'Recordatorios desactivados.';saveProfile();
      }).catch(()=>{notice='No se pudo cambiar el recordatorio.';}).finally(()=>{permissionBusy=false;renderUI();});return;
    }
    if(action==='play')startGame();
    else if(action==='retry')startGame(run?.practiceIndex ?? null,run?.job ?? null);
    else if(action==='jobs'){run=null;mode='jobs';renderUI();}
    else if(action==='job'){const job=G.JOBS.find(j=>j.id===button.dataset.id);if(job)startGame(null,job);}
    else if(action==='route'){mode='route';renderUI();}
    else if(action==='practice'){
      const index=Number(button.dataset.index);
      if(G.ROUTE[index] && profile.high>=G.ROUTE[index].at)startGame(index);
    }
    else if(action==='pause'||action==='resume')pause();
    else if(action==='menu')menu();
    else if(action==='skins'){mode='skins';inspected=profile.selected;collectionFilter='all';scrollPosition=0;renderUI();}
    else if(action==='settings'){mode='settings';renderUI();}
    else if(action==='events'){mode='events';eventTab=button.dataset.tab||'missions';renderUI();}
    else if(action==='claim'){
      const list=overlay.querySelector('.trophy-list'), top=list.scrollTop;
      profile=G.claimMission(profile,button.dataset.id);
      saveProfile();Music.play('coin');renderUI();
      overlay.querySelector('.trophy-list').scrollTop=top;
    }
    else if(action==='eventTab'){eventTab=button.dataset.tab;renderUI();}
    else if(action==='trailBuy'){const ans=G.buyTrail(profile,button.dataset.trail);if(ans.success){profile=ans.profile;saveProfile();Music.play('unlock');}else Music.play('tap');renderUI();}
    else if(action==='sound'){profile.sound=!profile.sound;saveProfile();renderUI();}
    else if(action==='music'){profile.music=!profile.music;saveProfile();renderUI();}
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

  overlay.addEventListener('input', event=>{
    if(event.target.id!=='volume-slider')return;
    profile.volume=Number(event.target.value);
    document.getElementById('volume-value').textContent=profile.volume+'%';
    Music.sync(mode,profile.music,profile.volume,profile.sound);
  });
  overlay.addEventListener('change',event=>{if(event.target.id==='volume-slider')saveProfile();});
  function collision(o, b) {
    const r = b.r - 4;
    if (o.type === 'spring') return false;
    if (o.type === 'saw') return G.circleCircle(b.x,b.y,r,o.x,o.y+o.r,o.r-2);
    const hits = (id,x) => G.hitsSprite(hazardMasks[id],b.x,b.y,r,Math.round(x),o.y,o.w,o.h);
    if (o.type === 'double') return hits('spikes-left',LEFT) || hits('spikes-right',RIGHT-o.w);
    if (o.type === 'spike') return hits('spikes-'+o.side,o.side==='left' ? LEFT : RIGHT-o.w);
    const x = o.type==='moving' ? o.x+Math.sin(clock*o.speed+o.phase)*o.amp : o.x;
    return hits(o.type,x);
  }
  function finishJob(won,reason){
    run.reason=reason;
    run.won=won;
    run.reward=0;
    if(won){
      const outcome=G.settleJob(profile,run.job,run.elapsed);
      profile=outcome.profile;run.reward=outcome.reward;saveProfile();
    }
    mode='jobEnd';Music.play(won?'unlock':'hit');renderUI();
  }
  function finish(reason) {
    if (mode !== 'playing' || !run) return;
    const b = run.ball;
    emit(b.x, b.y + run.camera, '#ff66bf', 28, 150);
    run.shake = 9;
    run.flash = .15;
    run.reason=reason;
    if(run.job){finishJob(false,reason);return;}
    if(run.practiceIndex!==null){
      mode='practiceEnd';Music.play('hit');renderUI();return;
    }
    const computed = G.applyRun(profile, run);
    const ready = G.MISSIONS.filter(m=>profile[m.stat]<m.need && computed.profile[m.stat]>=m.need);
    profile = computed.profile;
    result = { ...computed, ready, score: run.score, bounces: run.wallBounces,
      avoided: run.avoided, picked: run.picked, stars: run.stars };
    saveProfile();
    mode = 'over';
    animationEpoch++;
    Music.play(result.climbed?'level':'hit');
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
    if (mode !== 'playing' || !run.started) return;
    const b = run.ball;
    run.elapsed+=dt;
    run.boost=Math.max(0,run.boost-dt);
    if(run.job && run.elapsed>run.job.limit+1e-6){finishJob(false,'Se acabó el tiempo.');return;}
    b.inv = Math.max(0, b.inv - dt);
    b.impact = Math.max(0, (b.impact || 0) - dt * 8);
    const speed = 152 + Math.min(52, run.score * .041);
    b.vx = Math.sign(b.vx || 1) * Math.min(speed,Math.abs(b.vx)+58*dt);
    b.vy = Math.min(270, b.vy + 515 * dt);
    G.roll(b,dt);
    const previousX = b.x;
    const previousY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (G.reflectWall(b, LEFT, RIGHT)) {
      b.vx*=.94;
      run.wallBounces++;
      b.impact = 1;
      emit(b.x, b.y + run.camera, '#63ecff', 11);
      run.shake = profile.reducedFx ? 0 : 2;
      Music.play('bounce');
    }
    run.camera = Math.max(run.camera, 310 - b.y);
    const newScore = Math.max(run.score, run.startHeight + Math.floor((488 - b.y) / 5));
    if (newScore !== run.score) {
      const stage = G.stageAt(newScore + 45);
      if(stage !== G.stageAt(run.score + 45)) banner={text:stage.hint,until:clock+3};
      run.score = newScore;
      const zone=document.getElementById('hud-zone');
      if(zone)zone.textContent=(run.practiceIndex!==null?'Práctica · ':'')+G.stageAt(newScore).name;
      const hud = document.getElementById('hud-score');
      if (hud) hud.textContent = run.score;
    }
    if (b.y + run.camera > H + 22) { finish('La pelota cayó por debajo de la pantalla.'); return; }
    // La trayectoria se comprueba en pequeños segmentos para no atravesar obstáculos a gran velocidad.
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - previousX, b.y - previousY) / 5));
    for (const o of run.obstacles) {
      if (o.y + run.camera < -65 || o.y + run.camera > H + 65) continue;
      if (o.type==='spring') {
        const surface=o.y+5;
        if (!o.used && b.vy>0 && previousY+b.r<=surface && b.y+b.r>=surface &&
            b.x+b.r>o.x+5 && b.x-b.r<o.x+o.w-5){
          o.used=true;o.hitAt=clock;b.y=surface-b.r;b.vy=-835;run.boost=1.85;
          emit(b.x,b.y+run.camera,'#adf7fc',18,85);
          Music.play('spring');banner={text:'Lanzamiento protegido',until:clock+1.0};
        }
      } else if (b.inv <= 0 && run.boost <= 0) {
        for (let i = 1; i <= steps; i++) {
          const sample = {x: previousX + (b.x - previousX) * i / steps,
            y: previousY + (b.y - previousY) * i / steps, r: b.r};
          if (collision(o, sample)) {
            if (run.shield>0) {run.shield--;document.getElementById('hud-shield').hidden=true;b.inv=.95;b.vy=-300;
              emit(b.x,b.y+run.camera,'#7cfcf8',23,120);
              banner={text:'¡ESCUDO ACTIVADO!',until:clock+1.2};Music.play('shield');break;
            } else { finish(G.ROUTE.find(stage=>stage.type===o.type).hint);return; }
          }
        }
      }
      if (!o.passed && b.y + 14 < o.y) {
        o.passed = true;
        run.avoided++;
        if (run.avoided % 10 === 0 && (!banner || banner.until < clock)) {
          banner = {text: `${run.avoided} pasos superados`, until: clock + 1.1};
          Music.play('level');
        }
      }
    }
    for (const p of run.pickups) {
      if (p.taken) continue;
      if (G.circleCircle(b.x, b.y, b.r + 2, p.x, p.y, p.kind==='shield'?15:p.kind==='coin' && !run.job && run.practiceIndex===null ? 12+profile.magnet*6 : 12)) {
        p.taken=true;
        if(p.kind==='mailbag'){run.parcels++;Music.play('coin');}
        if(p.kind==='coin'){
          run.picked++;Music.play('coin');
          if(!run.job && run.practiceIndex===null){
            run.combo=run.elapsed-run.lastCoin<=5 ? run.combo+1 : 1;run.lastCoin=run.elapsed;
            if(run.combo%3===0){run.comboCoins+=6;banner={text:'Cadena de '+run.combo+' · +6 monedas',until:clock+1.3};}
          }
        }
        if(p.kind==='star'){run.stars++;Music.play('star');banner={text:'+1 estrella',until:clock+.8};}
        if(p.kind==='shield'){run.shield=1;Music.play('shield');banner={text:'¡ESCUDO!',until:clock+.8};}
        emit(p.x,p.y+run.camera,p.kind==='star'?'#ffcf5a':p.kind==='shield'?'#6feefe':'#ffd873',16);
        const hud=document.getElementById('hud-pickups');if(hud)hud.textContent=`${run.picked}`;
        const stars=document.getElementById('hud-stars');if(stars)stars.textContent=`${run.stars}`;
        const shield=document.getElementById('hud-shield');if(shield)shield.hidden=!run.shield;
      }
    }
    if(run.job){
      const progress=run.job.id==='post' ? run.parcels : run.score;
      if(progress>=run.job.target){finishJob(true,'Encargo entregado');return;}
      const readout=document.getElementById('job-hud');
      const message=jobHud();
      if(readout && readout.textContent!==message)readout.textContent=message;
    }
    const tail = b.trail[0];
    if (!tail || Math.hypot(b.x-tail.x,b.y-tail.y)>=5) b.trail.unshift({x:b.x,y:b.y});
    if (b.trail.length > 13) b.trail.pop();
    run.obstacles = run.obstacles.filter(o => o.y + run.camera <= H + 100);
    run.pickups = run.pickups.filter(p => !p.taken && p.y + run.camera <= H + 60);
    while (run.nextY + run.camera > -140 && run.obstacles.length < 25) spawnObstacle();
  }

  function drawBackground() {
    const offset=run ? run.camera : 0;
    rect(0,0,W,H,'#ecd8b5');
    const backdrop= !run ? 'station' : run.score>=2200 ? 'observatory' : run.score>=390 ? 'harbor' : 'sky';
    const bg=asset(backdrop)||asset('sky');
    if(bg)ctx.drawImage(bg,0,-40+Math.min(40,offset*.012),W,H+40);
    if (!run) return;
    const tile=140, shift=offset%tile;
    for(let y=shift-tile;y<H;y+=tile){
      sprite('wall',0,y,LEFT,tile+1);
      sprite('wall',RIGHT,y,W-RIGHT,tile+1);
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
      const elapsed=o.used ? clock-o.hitAt : 1;
      const compression=elapsed<.28 ? Math.sin(elapsed/.28*Math.PI)*o.h*.3 : 0;
      ctx.save();ctx.globalAlpha=o.used?.62:1;
      sprite('spring',o.x,y+compression,o.w,o.h-compression);ctx.restore();
    } else if (o.type === 'beam') {
      sprite('beam',o.x,y,o.w,o.h);
    } else if (o.type === 'blade') {
      sprite('blade',o.x,y,o.w,o.h);
    } else if (o.type === 'block') {
      sprite('block', o.x, y, o.w, o.h);
    } else if (o.type === 'moving') {
      const x = o.x + Math.sin(clock * o.speed + o.phase) * o.amp;
      sprite('moving', x, y, o.w, o.h);
    } else if (o.type === 'saw') {
      ctx.save();
      ctx.translate(Math.round(o.x), Math.round(y + o.r));
      ctx.rotate(clock * 1.7);
      sprite('saw', -o.r, -o.r, 2*o.r, 2*o.r);
      ctx.restore();
    }
  }
  function drawBall(x, y, imgName, scale = 1) {
    const s = 32 * scale;
    const img = asset(imgName);
    if (img) {
      ctx.save();
      const impact = run && mode === 'playing' ? (run.ball.impact || 0) : 0;
      ctx.translate(Math.round(x),Math.round(y));
      ctx.rotate(run ? run.ball.angle : 0);
      ctx.scale(1+impact*.16,1-impact*.13);
      ctx.drawImage(img,-s/2,-s/2,s,s);
      ctx.restore();
    }

  }
  function draw() {
    ctx.save();
    if (run && run.shake && !profile.reducedFx) ctx.translate(Math.round((Math.random() - .5) * run.shake), Math.round((Math.random() - .5) * run.shake));
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
          sprite(p.kind,p.x-13,yy-13,26,26);
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
            const spark=trailStar(trailStyle.colors[(index/2)%2]);
            const size=5+k*12;
            if(spark)ctx.drawImage(spark,item.x-size/2,item.y+cam-size/2,size,size*.8);
          });ctx.globalAlpha=1;
        }
        if(run.boost>0){
          ctx.save();ctx.globalAlpha=.74;ctx.strokeStyle=run.boost<.35?'#ffd472':'#85efdf';ctx.lineWidth=2;ctx.beginPath();ctx.arc(Math.round(b.x),Math.round(b.y+cam),20,0,Math.PI*2);ctx.stroke();ctx.restore();
          sprite('shield',b.x+10,b.y+cam-21,14,14);
        }
        if (run.boost>0 || !run.started || b.inv <= 0 || Math.floor(clock * 8) % 2 === 0) {
          drawBall(b.x, b.y + cam, `ball-${profile.selected}`);
        }
      }
      for (const p of run.particles) {
        const a = G.clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = a;
        sprite('star',p.x,p.y,p.size+3,p.size+3);
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
      ctx.font = 'bold 13px system-ui';
      ctx.fillStyle = '#14273c';
      ctx.lineWidth=4;ctx.strokeStyle='#173c41';ctx.strokeText(banner.text,180,109,285);
      ctx.fillStyle = '#b4faff';
      ctx.fillText(banner.text,180,109,285);
    }
  }
  function jobHud(){
    const goal=run.job.id==='post' ? run.parcels+'/'+run.job.target+' sacas' : run.score+'/'+run.job.target+' m';
    return goal+' · '+Math.max(0,Math.ceil(run.job.limit-run.elapsed))+' s';
  }
  function passport(){
    const rank=G.league(profile.xp), day=profile.stamps%7;
    const available=G.dayNumber()>profile.claimDay;
    return `<section class="settings-screen"><header class="page-header"><button class="back-btn" data-action="menu" aria-label="Volver">${icon('back')}</button><h1>Pasaporte</h1></header>
      <article class="league-card" data-metal="${Math.floor(rank.tier/3)}">${icon('trophy')}<h2>${rank.name}</h2><p>${profile.xp} XP · ${rank.next?'Próximo ascenso a '+rank.next+' XP':'Liga máxima'}</p>
      <progress value="${profile.xp-rank.floor}" max="${(rank.next??profile.xp+1)-rank.floor}"></progress></article>
      <article class="settings-card"><h2>Sellos de estación</h2><p>Un sello por día. Puedes continuar la colección aunque descanses varios días.</p>
      <div class="stamps">${G.DAILY.map((reward,i)=>`<span class="${i<day?'stamped':''}">${icon(i<day?'star':'coin')}<b>${reward}</b></span>`).join('')}</div>
      <button class="btn btn-green" data-action="daily" ${available?'':'disabled'}>${available?'Recoger '+G.DAILY[day]+' monedas':'Premio de hoy recogido'}</button></article>
      <p role="status">${notice}</p></section>`;
  }
  function mobileHome(){
    const rank=G.league(profile.xp);
    return `<section class="station-home"><header><span>Wall Bounce</span><b>${coinIcon()} ${profile.coins}</b></header>
      <div class="platform"><div><small>Estación de salida</small><h1>Jardines<br>del aire</h1></div><img src="${ballSrc(profile.selected)}" alt="Pelota equipada"></div>
      <button class="btn btn-play" data-action="play">Iniciar ascenso</button>
      <button class="mobile-rank" data-action="passport">${icon('trophy')}<span><small>Mi pasaporte</small><b>${rank.name}</b></span><em>${G.dayNumber()>profile.claimDay?'Premio disponible':profile.xp+' XP'}</em></button>
      <div class="station-options"><button data-action="jobs">${icon('mailbag')}Encargos</button><button data-action="route">${icon('missions')}Practicar ruta</button></div>
      <p class="station-record">Récord personal · ${profile.high} m</p>${storageError?`<p>${storageError}</p>`:''}</section>`;
  }
  function gearShop(){
    return [['magnet','coin','Imán de monedas','Amplía la distancia de recogida en el ascenso.','Nivel '+profile.magnet+'/3'],['ticket','shield','Billete de escudo','Protege de un golpe en el próximo ascenso.','Reserva '+profile.tickets+'/5']].map(([id,art,name,desc,stock])=>{
      const cost=G.price(profile,id);
      return `<article class="trail-row">${icon(art)}<div class="trail-data"><b>${name}</b><small>${desc} · ${stock}</small></div><button class="trail-action" data-action="gear" data-id="${id}" ${cost===null||profile.coins<cost?'disabled':''}>${cost===null?'Completo':cost+' '+coinIcon()}</button></article>`;
    }).join('');
  }
  function ballSrc(id){return `assets/balls/${id}.png`;}
  function icon(name){return `<img class="art-icon" src="assets/${name}.png" alt="">`;}
  function coinIcon(){return '<img class="coin-icon" src="assets/coin.png" alt="monedas">';}
  const dock = document.getElementById('dock');
  const destinations = [
    ['menu', '', 'missions', 'Inicio'],
    ['skins', '', 'nav-collection', 'Pelotas'],
    ['events', 'missions', 'nav-journal', 'Misiones'],
    ['events', 'trails', 'nav-shop', 'Tienda'],
    ['settings', '', 'nav-tools', 'Ajustes']
  ];
  function updateDock(){
    dock.hidden = !['menu','skins','events','settings','route','jobs','passport'].includes(mode);
    if (dock.hidden) return;
    const ready = G.MISSIONS.filter(m => profile[m.stat] >= m.need && !profile.claimed.includes(m.id)).length;
    dock.innerHTML = destinations.map(([action,tab,art,label]) => {
      const current = action === mode && (!tab || tab === eventTab || (tab === 'missions' && eventTab === 'event'));
      const badge = tab === 'missions' && ready ? `<sup>${ready}</sup>` : '';
      return `<button data-action="${action}" data-tab="${tab}" ${current ? 'aria-current="page"' : ''}>${icon(art)}<span>${label}</span>${badge}</button>`;
    }).join('');
  }
  function renderUI(){
    updateDock();
    animationEpoch++;
    const epoch=animationEpoch;
    document.getElementById('shell').dataset.view=mode;
    Music.sync(mode,profile.music,profile.volume,profile.sound);
    if(mode==='loading'){overlay.innerHTML='<div class="loading">CARGANDO...</div>';return;}
    if(mode==='playing'){
      overlay.innerHTML=`<div class="hud"><span class="hud-coins">${coinIcon()} <b id="hud-pickups">${run.picked}</b></span>
      <div class="hud-score"><small id="hud-zone">${run.practiceIndex!==null?'Práctica · ':''}${G.stageAt(run.score).name}</small><strong><span id="hud-score">${run.score}</span> m</strong></div>
      <span class="hud-stars">${icon('star')} <b id="hud-stars">${run.stars}</b><img id="hud-shield" src="assets/shield.png" alt="Escudo activo" ${run.shield?'':'hidden'}></span>
      <button class="hud-pause" data-action="pause" aria-label="Pausar partida">${icon('pause')}</button></div>
      ${run.job?`<div class="job-hud" id="job-hud">${jobHud()}</div>`:''}
      ${native?'<button class="jump-pad" data-action="jump">Impulso</button>':''}
      ${run.started?'':'<div class="launch-tip"><b>Toca para dar el primer salto</b><small>Cada toque te impulsa. Rebotas solo en las paredes. Elige cuándo subir para esquivar las trampas.</small></div>'}`;
      return;
    }
    if(mode==='passport'){overlay.innerHTML=passport();return;}
    if(mode==='menu' && native){overlay.innerHTML=mobileHome();return;}
    if(mode==='menu'){
      const next=G.nextSkin(profile);
      const percentage=next?profile.progress:100;
      const nextStop=G.ROUTE.find(stage=>stage.at>profile.high);

      overlay.innerHTML=`<section class="menu-screen">
        <header class="menu-top"><span class="pill">${coinIcon()} ${profile.coins}</span><span class="pill">${icon('trophy')} Récord · ${profile.high} m</span></header>
        <div class="menu-hero"><h1 class="logo-text"><span>Wall</span><strong>Bounce</strong></h1>
        <div class="podium"><img src="${ballSrc(profile.selected)}" alt="Pelota equipada"></div>
        <span class="hero-name">${G.SKINS.find(s=>s.id===profile.selected).name}</span></div>
        <div class="menu-bottom"><div class="menu-cards"><button class="route-ticket" data-action="route">${icon('missions')}<span><small>CUADERNO DE RUTA</small><b>${nextStop?nextStop.name:'Ruta explorada'}</b></span><em>${nextStop?nextStop.at+' m':'Ver ruta'}</em></button>
        <button class="next-card" data-action="skins"><img src="${ballSrc(next?next.id:profile.selected)}" alt="">
        <span class="next-copy"><small>${next?'PRÓXIMA PELOTA':'COLECCIÓN COMPLETA'}</small><b>${next?next.name:'36 de 36'}</b>
        <span class="progress-track"><i style="width:${percentage}%"></i></span></span><b>${percentage}%</b></button></div>
        <button class="dispatch" data-action="jobs">${icon('mailbag')}<span>Tablón de encargos<small>Contrarreloj y reparto postal</small></span>${icon('stopwatch')}</button>
        <button class="btn btn-play" data-action="play">Empezar ascenso</button>

          ${storageError?`<p class="save-warning">${storageError}</p>`:''}
        </div></section>`;return;
    }
    if(mode==='jobs'){
      overlay.innerHTML=`<section class="route-screen"><header class="page-header"><button class="back-btn" data-action="menu" aria-label="Volver">${icon('back')}</button><h1>Tablón de encargos</h1></header><div class="job-list">${G.JOBS.map(job=>`<article class="job-card"><img src="assets/${job.art}.png" alt=""><div><h2>${job.name}</h2><p>${job.brief}</p><small>${profile.records[job.id]?'Mejor tiempo · '+(profile.records[job.id]/1000).toFixed(1)+' s':'Primera entrega · '+job.reward+' monedas'}</small></div><button class="btn" data-action="job" data-id="${job.id}">Aceptar encargo</button></article>`).join('')}</div></section>`;return;
    }
    if(mode==='jobEnd'){
      overlay.innerHTML=`<div class="screen-shade"><section class="modal-card"><img class="job-stamp" src="assets/${run.job.art}.png" alt=""><h1>${run.won?'¡Entrega a tiempo!':'Encargo pendiente'}</h1><p>${run.job.name} · ${run.elapsed.toFixed(1)} s<br>${run.reason}${run.reward?' · +'+run.reward+' monedas':''}</p><div class="stack"><button class="btn btn-green" data-action="retry">Reintentar</button><button class="btn" data-action="jobs">Volver al tablón</button></div></section></div>`;return;
    }
    if(mode==='route'){
      const art={spring:'spring',spike:'spikes-left',double:'spikes-right'};
      overlay.innerHTML=`<section class="route-screen"><header class="page-header"><button class="back-btn" data-action="menu" aria-label="Volver">${icon('back')}</button><div><h1>Cuaderno de ruta</h1><span>Tu récord · ${profile.high} m</span></div></header>
        <div class="route-cover"><h2>Estaciones del cielo</h2><p>Practica desde cualquier estación que hayas alcanzado. En práctica no se ganan premios.</p></div>
        <div class="route-list">${G.ROUTE.map((stage,index)=>{
          const open=profile.high>=stage.at;
          return `<article class="station-row"><img src="assets/${art[stage.type]||stage.type}.png" alt=""><div><small>${stage.at} m</small><h3>${stage.name}</h3><p>${stage.hint}</p><button class="trail-action" data-action="practice" data-index="${index}" ${open?'':'disabled'}>${open?'Practicar':'Alcanza '+stage.at+' m'}</button></div></article>`;
        }).join('')}</div></section>`;return;
    }
    if(mode==='practiceEnd'){
      overlay.innerHTML=`<div class="screen-shade"><section class="modal-card"><h1>Fin de la práctica</h1><p>${G.ROUTE[run.practiceIndex].name} · ${run.score-run.startHeight} m recorridos</p><p>${run.reason}</p><div class="stack"><button class="btn btn-green" data-action="retry">Repetir tramo</button><button class="btn" data-action="route">Cuaderno de ruta</button></div></section></div>`;return;
    }
    if(mode==='pause'){
      overlay.innerHTML=`<div class="screen-shade"><section class="modal-card pause-card">
        <span class="modal-icon">${icon('pause')}</span><h1>EN PAUSA</h1><p>Llevas <strong>${run.score}</strong> m de altura</p>
        <div class="stack"><button class="btn btn-green" data-action="resume">Continuar</button>
        <button class="btn btn-yellow" data-action="retry">Reiniciar</button>
        <button class="btn btn-purple" data-action="menu">Menú principal</button></div>
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
         <div class="score-caption">ALTURA ALCANZADA</div><div class="score-number">${result.score} m</div><p class="result-tip">${run.reason}</p></div>
        <div class="league-result ${result.climbed?'promoted':''}">${icon('trophy')}<span>${result.climbed?'¡Ascenso a ':''}${G.league(profile.xp).name}</span><b>+${result.xpGain} XP</b></div>
        <div class="result-rewards">${run.comboCoins?`<small>Incluye ${run.comboCoins} monedas por cadenas</small>`:''}<div><span>${coinIcon()} MONEDAS</span><b>+${result.earned}</b></div>
          <div><span>${icon('trophy')} Récord</span><b>${profile.high}</b></div>
          <div><span>${icon('star')} Estrellas</span><b>+${result.stars}</b></div>
          ${result.eventReward?`<div><span>${icon('chest')} Premio del festival</span><b>+${result.eventReward}</b></div>`:''}</div>
        ${result.ready.length?`<button class="run-mission" data-action="events" data-tab="missions">${icon('nav-journal')} Cobrar misión · ${result.ready.map(m=>m.name).join(', ')}</button>`:''}
        ${meta}
        ${unlocked?`<button class="btn btn-unlock" data-action="showUnlock">¡VER PELOTA DESBLOQUEADA!</button>`:''}
        <div class="results-actions"><button class="btn btn-purple" data-action="menu">Menú</button><button class="btn btn-green" data-action="retry">Reintentar</button></div>
      </div></section>`;
      if(target)animateProgress(result,epoch);
      return;
    }
    if(mode==='unlocked'){
      const ball=G.SKINS.find(s=>s.id===result.unlocked);
      if(!ball){mode='over';renderUI();return;}
      overlay.innerHTML=`<section class="unlock-screen"><div class="confetti" aria-hidden="true">${icon('trophy')}</div>
        <span class="unlock-kicker">¡NUEVA PELOTA!</span><h1>¡DESBLOQUEADA!</h1>
        <div class="unlock-light"><img src="${ballSrc(ball.id)}" alt="Pelota ${ball.name}"></div><h2>${ball.name}</h2>
        <p>¡La conseguiste jugando!</p><div class="unlock-actions"><button class="btn btn-green" data-action="equip" data-skin="${ball.id}">EQUIPAR</button>
        <button class="btn btn-purple" data-action="results">MÁS TARDE</button></div></section>`;return;
    }
    if(mode==='skins'){
      const s=G.SKINS.find(x=>x.id===inspected)||G.SKINS[0];const stat=G.progressFor(profile,s);
      const choices=G.SKINS.filter(x=>collectionFilter==='all'||(collectionFilter==='owned'&&profile.unlocked.includes(x.id))||(collectionFilter==='locked'&&!profile.unlocked.includes(x.id)));
      const tabs=[['all','TODAS'],['owned','CONSEGUIDAS'],['locked','PENDIENTES']].map(([key,name])=>`<button class="${collectionFilter===key?'active':''}" data-action="filter" data-filter="${key}">${name}</button>`).join('');
      overlay.innerHTML=`<section class="catalog-screen"><div class="page-header"><button class="back-btn" data-action="menu" aria-label="Volver">${icon('back')}</button>
        <div><h1>PELOTAS</h1><span>${profile.unlocked.length} de ${G.SKINS.length} desbloqueadas</span></div><span class="pill coin-pill">${coinIcon()} ${profile.coins}</span></div>
        <div class="catalog-tabs">${tabs}</div>
        <div id="catalog-grid" class="catalog-grid">${choices.map(ball=>{const pg=G.progressFor(profile,ball);return `<button class="skin-tile ${ball.id===inspected?'selected':''} ${pg.unlocked?'':'locked'}" data-action="viewskin" data-skin="${ball.id}">
          <img src="${ballSrc(ball.id)}" alt="${ball.name}"><span>${ball.name}</span><small>${pg.unlocked?(profile.selected===ball.id?'EQUIPADA':'LIBRE'):pg.active?`${pg.pct}%`:'BLOQUEADA'}</small></button>`;}).join('')}</div>
        <div class="inspect-panel"><img class="inspect-ball" src="${ballSrc(s.id)}" alt="${s.name}"><div class="inspect-copy"><h2>${s.name}</h2>
        <p>${stat.unlocked?'¡Ya es tuya!':stat.active?'La próxima que desbloquearás':'Se desbloquea al conseguir la anterior'}</p>
        ${!stat.unlocked?`<div class="progress-track"><i style="width:${stat.pct}%"></i></div><small>${stat.pct}% DESBLOQUEADO</small>`:''}</div>
        ${stat.unlocked?`<button class="btn btn-green inspect-button" data-action="equip" data-skin="${s.id}" ${profile.selected===s.id?'disabled':''}>${profile.selected===s.id?'LISTA':'EQUIPAR'}</button>`:''}</div>
       </section>`;
      const grid=document.getElementById('catalog-grid');if(grid)grid.scrollTop=scrollPosition;
      return;
    }
    if(mode==='events'){
      const progress=profile.totalStars%12;
      const rank=m=>profile.claimed.includes(m.id)?2:profile[m.stat]>=m.need?0:1;
      const missions=G.MISSIONS.slice().sort((a,b)=>rank(a)-rank(b));
      overlay.innerHTML=`<section class="events-screen"><div class="page-header"><button class="back-btn" data-action="menu" aria-label="Volver">${icon('back')}</button>
      <div><h1>Campamento</h1><span>${coinIcon()} ${profile.coins} monedas</span></div></div>
      <div class="event-tabs"><button data-action="eventTab" data-tab="event" class="${eventTab==='event'?'active':''}">FESTIVAL</button>
      <button data-action="eventTab" data-tab="missions" class="${eventTab==='missions'?'active':''}">MISIONES</button>
      <button data-action="eventTab" data-tab="trails" class="${eventTab==='trails'?'active':''}">TIENDA</button></div>
      ${eventTab==='trails'?`<div class="trail-body"><div class="trail-intro">Personaliza la estela de tu pelota con las monedas que ganas jugando. <b>${coinIcon()} ${profile.coins}</b></div>
      ${gearShop()}${G.TRAILS.map(t=>{const owned=profile.trails.includes(t.id),equipped=t.id===profile.selectedTrail;return `<div class="trail-row"><div class="trail-art" style="--t1:${t.colors[0]};--t2:${t.colors[1]}">${icon('star')}</div><div class="trail-data"><b>${t.name}</b><small>${equipped?'EQUIPADA':owned?'CONSEGUIDA':'DISEÑO DE ESTELA'}</small></div><button class="trail-action" data-action="trailBuy" data-trail="${t.id}" ${equipped?'disabled':''}>${equipped?'En uso':owned?'EQUIPAR':t.price+' '+coinIcon()}</button></div>`}).join('')}</div>`:eventTab==='event'?`<div class="event-body"><div class="event-hero"><img src="assets/star.png" alt="estrella dorada">
      <div><small>FESTIVAL PERMANENTE</small><h2>LLUVIA DE ESTRELLAS</h2><p>Recoge estrellas doradas durante las partidas. Cada 12 estrellas te regalan 80 monedas.</p></div></div>
      <div class="event-counter"><span>HACIA TU PRÓXIMA RECOMPENSA</span><b>${progress}/12</b>
      <div class="progress-track"><i style="width:${progress/12*100}%"></i></div><p>${Math.floor(profile.totalStars/12)} premios conseguidos · ${profile.totalStars} estrellas en total</p></div>
      <div class="info-note">Las estrellas aparecen en el recorrido. Los premios se entregan automáticamente al terminar la partida. No hay fecha límite.</div></div>`:
      `<div class="trophy-list">${missions.map(m=>{
        const value=Math.min(profile[m.stat],m.need),claimed=profile.claimed.includes(m.id);
        return `<article class="trophy">${icon(claimed?'trophy':'missions')}<div><b>${m.name}</b><small>${value} / ${m.need} ${m.unit}</small>
        <div class="progress-track"><i style="width:${100*value/m.need}%"></i></div></div>
        <button class="trail-action" data-action="claim" data-id="${m.id}" ${claimed||value<m.need?'disabled':''}>${claimed?'Cobrado':(value===m.need?'Cobrar ':'')+'+'+m.reward+' '+coinIcon()}</button></article>`}).join('')}</div>`}
      </section>`;return;
    }
    if(mode==='settings'){
      overlay.innerHTML=`<section class="settings-screen"><div class="page-header"><button class="back-btn" data-action="menu" aria-label="Volver">${icon('back')}</button><div><h1>AJUSTES</h1><span>A tu manera</span></div></div>
        <div class="settings-card"><div class="setting-row"><div>Música<small>Dos canciones originales</small></div><button class="switch ${profile.music?'on':''}" data-action="music">${profile.music?'SÍ':'NO'}</button></div>
        <div class="setting-row"><div>Sonidos<small>Saltos, premios y rebotes</small></div><button class="switch ${profile.sound?'on':''}" data-action="sound">${profile.sound?'SÍ':'NO'}</button></div>
        <div class="setting-row"><div>VOLUMEN<small id="volume-value">${Math.round(profile.volume)}%</small></div><input type="range" id="volume-slider" aria-label="Volumen" min="0" max="100" value="${profile.volume}"></div>
        <div class="setting-row"><div>Partículas<small>Efectos visuales</small></div><button class="switch ${profile.reducedFx?'':'on'}" data-action="effects">${profile.reducedFx?'BAJO':'SÍ'}</button></div></div>
        <div class="data-card"><h2>Tu progreso</h2>${native?`<p>Tu pasaporte y tu colección se guardan en este dispositivo.</p><div class="setting-row"><div>Recordatorio local<small>Un aviso silencioso tras cuatro días sin abrir el juego.</small></div><button class="switch" data-action="reminders" ${permissionBusy?'disabled':''}>${profile.reminders?'SÍ':'NO'}</button></div><small role="status">${notice}</small>`:`<p>Documentos/Wall Bounce</p><button class="btn" data-action="folder">Abrir carpeta</button>`}${storageError?`<p class="save-warning">${storageError}</p>`:''}</div>
        </section>`;return;
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
    const dt = lastFrame === null ? 0 : Math.max(0,(timestamp-lastFrame)/1000);
    lastFrame = timestamp;
    accumulator += Math.min(dt, .1);
    while (accumulator + 1e-10 >= step) {
      accumulator = Math.max(0, accumulator - step);
      update(step);
    }
    draw();
    requestAnimationFrame(frame);
  }
  async function refreshReminder(){
    if(!native || !profile.reminders)return;
    try{if(!await native.refresh()){profile.reminders=false;saveProfile();}}catch{notice='No se pudo actualizar el recordatorio.';}
  }
  window.addEventListener('station-back',()=>{
    if(mode==='playing'||mode==='pause')pause();
    else if(mode==='menu')native.exit();
    else menu();
  });
  window.addEventListener('station-active',()=>{refreshReminder();if(['menu','passport'].includes(mode))renderUI();});
  window.addEventListener('station-sleep',()=>{if(mode==='playing')pause();Music.suspend();});
  async function boot(){profile=await loadProfile();inspected=profile.selected;mode='menu';renderUI();refreshReminder();}
  renderUI();boot();
  requestAnimationFrame(frame);
})();
