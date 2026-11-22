const {test}=require('node:test');const assert=require('node:assert/strict');const G=require('../src/logic');
test('36 pelotas originales identificables',()=>{assert.equal(G.SKINS.length,36);assert.equal(new Set(G.SKINS.map(s=>s.id)).size,36)});
test('cada partida aporta porcentaje, no misiones',()=>{const result=G.applyRun(G.freshProfile(),{score:0,picked:0});assert.equal(result.from,0);assert.ok(result.gained>=3);assert.equal(result.profile.progress,result.gained);assert.equal(result.profile.plays,1)});
test('la recompensa aumenta con la puntuación',()=>{assert.ok(G.gainForRun({score:120,picked:2})>G.gainForRun({score:0,picked:0}));assert.ok(G.payout({score:120,picked:2})>G.payout({score:0,picked:0}))});
test('desbloquea al 100%, seleccionable y siguiente a 0',()=>{let p=G.freshProfile();p.progress=98;const r=G.applyRun(p,{score:12,picked:0});assert.equal(r.to,100);assert.equal(r.unlocked,'cat');assert.equal(r.profile.nextIndex,2);assert.equal(r.profile.progress,0);assert.ok(r.profile.unlocked.includes('cat'));assert.equal(G.progressFor(r.profile,'cat').pct,100)});
test('sin doble desbloqueo',()=>{let p=G.freshProfile();p.progress=99;const a=G.applyRun(p,{score:100});const b=G.applyRun(a.profile,{score:10});assert.equal(a.unlocked,'cat');assert.equal(b.unlocked,null);assert.equal(b.profile.unlocked.filter(x=>x==='cat').length,1)});
test('guarda equipamiento y progreso',()=>{let p=G.freshProfile();p.nextIndex=4;p.progress=39;p.selected='bee';const q=G.normalizeProfile(JSON.parse(JSON.stringify(p)));assert.equal(q.selected,'bee');assert.equal(q.progress,39);assert.equal(q.unlocked.length,4)});
test('no equipa pelotas bloqueadas',()=>{const p=G.normalizeProfile({...G.freshProfile(),selected:'fox'});assert.equal(p.selected,'classic')});
test('colección completa detiene progreso',()=>{let p=G.freshProfile();p.nextIndex=36;p.progress=100;let r=G.applyRun(p,{score:80});assert.equal(r.profile.unlocked.length,36);assert.equal(r.gained,0)});
test('limita datos defectuosos',()=>{const p=G.normalizeProfile({coins:-500,nextIndex:999,progress:111,selected:'missing',volume:300});assert.equal(p.coins,0);assert.equal(p.unlocked.length,36);assert.equal(p.volume,100);assert.equal(p.selected,'classic')});
test('colisiones',()=>{assert.equal(G.circleCircle(0,0,3,5,0,3),true);assert.equal(G.circleRect(0,0,3,20,20,4,4),false)});

test('cada peligro tiene una introducción y solo aparece después de su tramo',()=>{
 for(let seed=1;seed<=100;seed++){
  const rng=G.seeded(seed);
  let height=54,previous=0;
  for(let row=0;height<=5000;row++){
   const obstacle=G.obstacle(rng,row,0,height,previous);
   const stage=G.stageAt(height);
   assert.ok(G.ROUTE.slice(0,G.ROUTE.indexOf(stage)+1).some(s=>s.type===obstacle.type));
   if(stage.at>previous)assert.equal(obstacle.type,stage.type);
   if(row===0)assert.equal(obstacle.type,'spike');
   const gap=G.gapFor(height,rng);
   assert.ok(gap>=345);
   previous=height;
   height+=gap/5;
  }
 }
});
test('las misiones conservan el progreso anterior y se cobran una sola vez',()=>{
 const old={high:150,coins:10};
 assert.equal(G.claimMission(old,'flight').coins,10);
 const paid=G.claimMission(old,'landing');
 assert.equal(paid.coins,45);
 assert.equal(G.claimMission(JSON.parse(JSON.stringify(paid)),'landing').coins,45);
 assert.equal(G.claimMission(paid,'unknown').coins,45);
});
test('los eventos de estrellas dan premios en Documentos sin reclamar manualmente',()=>{const p=G.freshProfile();p.totalStars=11;const result=G.applyRun(p,{score:10,stars:2,picked:0});assert.equal(result.eventReward,80);assert.equal(result.profile.totalStars,13);assert.equal(result.profile.coins,result.earned+80);});
test('el perfil antiguo es compatible al actualizar',()=>{const old={version:4,nextIndex:5,progress:51,selected:'donut',coins:125,high:240};const now=G.normalizeProfile(old);assert.equal(now.selected,'donut');assert.equal(now.progress,51);assert.equal(now.coins,125);assert.equal(now.totalStars,0);});

test('las estelas se desbloquean con monedas sin pago doble',()=>{let p=G.freshProfile();p.coins=300;const a=G.buyTrail(p,'mint');assert.equal(a.success,true);assert.equal(a.profile.coins,180);assert.equal(a.profile.selectedTrail,'mint');const b=G.buyTrail(a.profile,'mint');assert.equal(b.profile.coins,180);assert.equal(b.purchased,false);});
test('las estelas sin monedas no se compran',()=>{const r=G.buyTrail(G.freshProfile(),'galaxy');assert.equal(r.success,false);assert.equal(r.profile.trails.length,1);});

test('hasta 1000 m hay entre 8 y 11 encuentros y un solo trampolín de introducción',()=>{
 for(let seed=0;seed<200;seed++){
  const rng=G.seeded(seed);
  let previous=0,h=53.6,index=0,last=-100,springs=0;
  while(h<=1000){
   const o=G.obstacle(rng,index,0,h,previous,last);
   if(o.type==='spring'){assert.ok(index-last>=8);last=index;springs++;}
   const gap=G.gapFor(h,rng);assert.ok(gap>=440 && gap<=612);
   previous=h;h+=gap/5;index++;
  }
  assert.ok(index>=8 && index<=11);assert.equal(springs,1);
 }
});
test('el encargo guarda la mejor marca y paga solo la primera entrega',()=>{
 const job=G.JOBS[0], first=G.settleJob({coins:5},job,22.5);
 assert.equal(first.profile.coins,5+job.reward);
 const next=G.settleJob(first.profile,job,19.25);
 assert.equal(next.reward,0);assert.equal(next.profile.records[job.id],19250);
 assert.equal(G.settleJob(next.profile,job,28).profile.records[job.id],19250);
 assert.deepEqual(G.normalizeProfile({high:100}).records,{});
});
test('el giro invierte su dirección gradualmente al rebotar',()=>{
 const b={vx:150,r:12,spin:0,angle:0};
 for(let n=0;n<120;n++)G.roll(b,1/120);
 assert.ok(b.spin>4 && b.spin<6);
 b.vx=-150;G.roll(b,1/120);assert.ok(b.spin>0);
 for(let n=0;n<120;n++)G.roll(b,1/120);
 assert.ok(b.spin<0);
});

test('las monedas señalan un paso libre alrededor de las cargas y las sierras',()=>{
 const rng=G.seeded(7);
 for(const type of ['block','moving','saw']){
  for(const x of [116,192]){
   const lane=G.pickupLane({type,x,w:90},rng);
   const left=type==='saw'?x-33:x;
   const right=type==='saw'?x+33:x+90;
   assert.ok(lane+12<left || lane-12>right);
  }
 }
});
