(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WallBounceLogic=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const rows=[['classic','Sonrisas','#fff0f8'],['cat','Michi','#ffaf86'],['bee','Abejita','#ffcc49'],['donut','Dona','#fa8dc7'],['basketball','Canasta','#f69a51'],['bunny','Conejita','#ffc1e2'],['frog','Ranita','#86d95e'],['citrus','Naranja','#ffc257'],['flower','Sakura','#ff9dc6'],['robot','Robito','#9dd8ff'],['pumpkin','Calabaza','#ffad6a'],['planet','Saturno','#a5a6f9'],['snow','Copito','#b0eaff'],['heart','Amorcito','#fb81b1'],['crown','Rey Sol','#f7ce55'],['dragon','Dragón','#71d2ad'],['ninja','Ninja','#a1add1'],['cherry','Cerecitas','#fd7799'],['cloud','Nubecita','#bbdafa'],['flame','Llamita','#ff955c'],['koi','Koi','#ffbfab'],['strawberry','Fresita','#fc6d8a'],['cosmic','Galaxia','#a987f4'],['ocean','Océano','#63d3f7'],['arcade','Arcade','#62cafa'],['kiwi','Kiwi','#b7d36a'],['moon','Lunita','#ffe0a4'],['crystal','Amatista','#d5a5ff'],['prism','Prisma','#9aefff'],['circuit','Cibernética','#65cfe8'],['sun','Solecito','#ffdc70'],['candy','Caramelo','#ebba96'],['clover','Trébol','#8ad685'],['rocket','Cohetito','#ff9ab5'],['jelly','Gelatina','#9ba8fa'],['fox','Zorrito','#ffbc83']];
const TRAILS=Object.freeze([{id:'original',name:'Destellos',price:0,colors:['#c584ed','#72e3f6']},{id:'mint',name:'Menta fresca',price:120,colors:['#67d5c6','#b3ffe9']},{id:'rose',name:'Cereza brillante',price:200,colors:['#ff72bb','#ffe0e7']},{id:'sun',name:'Chispas doradas',price:350,colors:['#ffc96c','#fff4aa']},{id:'galaxy',name:'Polvo galáctico',price:550,colors:['#8177dc','#e7acfa']},{id:'aurora',name:'Aurora boreal',price:270,colors:['#69d8ac','#9a8de7']},{id:'ember',name:'Brasas',price:390,colors:['#f28b43','#f7d6a0']},{id:'ice',name:'Cristales de hielo',price:450,colors:['#83cdeb','#e5f8ff']}]);
const SKINS=Object.freeze(rows.map(([id,name,color],index)=>Object.freeze({id,name,color,index})));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));const int=v=>Number.isFinite(v)?Math.floor(clamp(v,0,100000000)):0;
function freshProfile(){return{version:9,xp:0,stamps:0,claimDay:0,magnet:0,coil:0,tickets:0,dailyJobDay:0,dailyJobBest:0,dailyJobs:0,reminders:false,records:{},claimed:[],coins:0,high:0,plays:0,totalScore:0,totalStars:0,totalBounces:0,selected:'classic',trails:['original'],selectedTrail:'original',sound:true,music:true,volume:70,reducedFx:false,nextIndex:1,progress:0,unlocked:['classic']};}
function normalizeProfile(raw){const p=freshProfile();if(!raw||typeof raw!=='object'||Array.isArray(raw))return p;
for(const k of ['coins','high','plays','totalScore','totalStars','totalBounces'])p[k]=int(raw[k]);p.sound=raw.sound!==false;p.music=raw.music!==false;p.volume=Number.isFinite(raw.volume)?clamp(raw.volume,0,100):70;p.reducedFx=raw.reducedFx===true;
for(const job of JOBS){const ms=int(raw.records?.[job.id]);if(ms>0)p.records[job.id]=ms;}
for(const key of ['xp','stamps','claimDay','dailyJobDay','dailyJobBest','dailyJobs'])p[key]=int(raw[key]);
p.magnet=Math.min(3,int(raw.magnet));p.coil=Math.min(2,int(raw.coil));p.tickets=Math.min(5,int(raw.tickets));p.reminders=raw.reminders===true;
p.claimed=MISSIONS.filter(m=>Array.isArray(raw.claimed)&&raw.claimed.includes(m.id)).map(m=>m.id);
p.nextIndex=clamp(int(raw.nextIndex)||1,1,SKINS.length);p.progress=p.nextIndex===SKINS.length?100:clamp(int(raw.progress),0,99);p.unlocked=SKINS.slice(0,p.nextIndex).map(s=>s.id);p.selected=p.unlocked.includes(raw.selected)?raw.selected:'classic';p.trails=TRAILS.filter(t=>t.price===0 || (Array.isArray(raw.trails)&&raw.trails.includes(t.id))).map(t=>t.id);p.selectedTrail=p.trails.includes(raw.selectedTrail)?raw.selectedTrail:'original';return p;}
const DAILY=[20,30,35,45,50,65,100];
const LEAGUES=['Bronce','Plata','Oro','Platino','Diamante'];
const DIVISIONS=['I','II','III'];
const thresholds=[0];
for(let i=1;i<LEAGUES.length*3;i++)thresholds[i]=thresholds[i-1]+60+25*i;
function league(xp){
 const points=int(xp);
 let tier=0;
 while(tier+1<thresholds.length && points>=thresholds[tier+1])tier++;
 return {tier,name:LEAGUES[Math.floor(tier/3)]+' '+DIVISIONS[tier%3],floor:thresholds[tier],next:thresholds[tier+1]??null};
}
function xpLevel(xp){
 const points=int(xp),level=Math.floor((1+Math.sqrt(1+8*points/45))/2);
 const floor=45*(level-1)*level/2,next=45*level*(level+1)/2;
 return {level,floor,next,progress:Math.floor(100*(points-floor)/(next-floor))};
}
function rankProgress(xp){
 const r=league(xp);
 return r.next===null?100:Math.floor(100*(int(xp)-r.floor)/(r.next-r.floor));
}
function dayNumber(now=new Date()){
 return Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000);
}
function claimDaily(old,day){
 const p=normalizeProfile(old);
 if(!Number.isInteger(day)||day<=p.claimDay)return {profile:p,reward:0};
 const reward=DAILY[p.stamps%DAILY.length];
 p.coins+=reward;p.claimDay=day;p.stamps++;
 return {profile:p,reward};
}
function price(p,id){
 if(id==='magnet' && p.magnet<3)return [90,190,320][p.magnet];
 if(id==='ticket' && p.tickets<5)return 50;
 if(id==='coil' && p.coil<2)return [180,300][p.coil];
 return null;
}
function buyGear(old,id){
 const p=normalizeProfile(old), cost=price(p,id);
 if(cost===null || p.coins<cost)return {profile:p,success:false};
 p.coins-=cost;
 if(id==='magnet')p.magnet++;else if(id==='coil')p.coil++;else p.tickets++;
 return {profile:p,success:true};
}
function nextSkin(p){p=normalizeProfile(p);return p.nextIndex>=SKINS.length?null:SKINS[p.nextIndex];}
function progressFor(profile,skin){const p=normalizeProfile(profile);const s=typeof skin==='string'?SKINS.find(x=>x.id===skin):skin;if(!s)return{pct:0,unlocked:false,active:false};if(s.index<p.nextIndex)return{pct:100,unlocked:true,active:false};return{pct:s.index===p.nextIndex?p.progress:0,unlocked:false,active:s.index===p.nextIndex};}
function payout(run){const score=int(run.score);return(score?Math.max(1,Math.floor(score/8)):1)+int(run.picked)*3;}
function gainForRun(run){return clamp(3+Math.floor(int(run.score)/65)+Math.min(2,int(run.stars||0)),3,14);}
function applyRun(old,run){const before=normalizeProfile(old),p=normalizeProfile(old),score=int(run.score),stars=int(run.stars),earned=payout(run)+int(run.comboCoins),target=nextSkin(before);const from=target?before.progress:100,gain=target?gainForRun(run):0;
const eventReward=(Math.floor((p.totalStars+stars)/12)-Math.floor(p.totalStars/12))*80;p.coins+=earned+eventReward;p.totalStars+=stars;p.totalBounces+=int(run.wallBounces);p.plays++;p.totalScore+=score;p.high=Math.max(p.high,score);let unlocked=null,to=Math.min(100,from+gain);
const xpGain=Math.min(150,Math.floor(score/12)+int(run.picked)*2+stars*5);
p.xp+=xpGain;
const climbed=league(p.xp).tier>league(before.xp).tier;
if(target){if(to>=100){unlocked=target.id;p.nextIndex++;p.unlocked.push(target.id);p.progress=p.nextIndex>=SKINS.length?100:0;}else p.progress=to;}
return{profile:normalizeProfile(p),earned,eventReward,stars,xpGain,climbed,gained:target?to-from:0,displayGain:gain,target,from,to,unlocked,isRecord:score>before.high,score};}
function buyTrail(old,id){const p=normalizeProfile(old),t=TRAILS.find(a=>a.id===id);if(!t)return {profile:p,success:false,reason:'invalid'};if(p.trails.includes(id)){p.selectedTrail=id;return {profile:p,success:true,purchased:false};}if(p.coins<t.price)return {profile:p,success:false,reason:'coins'};p.coins-=t.price;p.trails.push(id);p.selectedTrail=id;return {profile:normalizeProfile(p),success:true,purchased:true};}
function seeded(seed){let state=seed>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const MISSIONS = [
 {id:'landing', name:'Primer mirador', stat:'high', need:120, reward:35, unit:'m de altura'},
 {id:'bounce', name:'De pared a pared', stat:'totalBounces', need:30, reward:60, unit:'rebotes'},
 {id:'stars', name:'Cartógrafo estelar', stat:'totalStars', need:5, reward:90, unit:'estrellas'},
 {id:'flight', name:'Sobre el valle', stat:'high', need:1000, reward:150, unit:'m de altura'},
 {id:'first', name:'Primer salto', stat:'high', need:50, reward:15, unit:'m de altura'},
 {id:'clouds', name:'Conquista las nubes', stat:'high', need:200, reward:40, unit:'m de altura'},
 {id:'look', name:'Mira las estrellas', stat:'totalStars', need:24, reward:100, unit:'estrellas'},
 {id:'explorer', name:'Gran explorador', stat:'plays', need:20, reward:80, unit:'partidas'},
 {id:'expert', name:'Experto del rebote', stat:'totalBounces', need:200, reward:100, unit:'rebotes'},
 {id:'master', name:'Maestro de las alturas', stat:'high', need:600, reward:100, unit:'m de altura'},
 {id:'summit', name:'Más allá del faro', stat:'high', need:2400, reward:250, unit:'m de altura'}
];
function claimMission(old,id){
 const p=normalizeProfile(old), mission=MISSIONS.find(m=>m.id===id);
 if(!mission || p.claimed.includes(id) || p[mission.stat]<mission.need)return p;
 p.claimed.push(id);
 p.coins+=mission.reward;
 return p;
}
const JOBS = [
 {id:'express',name:'Expreso del valle',art:'stopwatch',target:780,limit:19,reward:65,seed:711,brief:'Alcanza 780 m en 19 segundos.'},
 {id:'post',name:'Correo de altura',art:'mailbag',target:3,limit:52,reward:90,seed:835,brief:'Recoge tres sacas de correo en 52 segundos.'}
];
const DAILY_ROUTES=[
 {kind:'height',name:'Mirador del día',art:'stopwatch',target:380,limit:32,reward:45,brief:'Alcanza 380 m en 32 segundos.'},
 {kind:'parcels',name:'Correo del día',art:'mailbag',target:2,limit:42,reward:45,brief:'Recoge dos sacas en 42 segundos.'},
 {kind:'bounces',name:'Rebotes del día',art:'missions',target:9,limit:36,reward:45,brief:'Completa nueve rebotes de pared en 36 segundos.'}
];
function dailyJob(day){
 if(!Number.isInteger(day)||day<1||day>100000000)return null;
 return {...DAILY_ROUTES[day%DAILY_ROUTES.length],id:'daily',day,seed:Math.imul(day,2654435761)>>>0};
}
function jobProgress(job,run){
 return job.kind==='bounces'?int(run.wallBounces):job.kind==='parcels'||job.id==='post'?int(run.parcels):int(run.score);
}
function settleJob(profile,job,elapsed){
 const next=normalizeProfile(profile), ms=Math.max(1,Math.round(elapsed*1000));
 if(job.id==='daily'){
   const standard=dailyJob(job.day);
   if(!standard||!Number.isFinite(elapsed)||elapsed<0||elapsed>standard.limit||job.day<next.dailyJobDay)return {profile:next,reward:0};
   const repeat=next.dailyJobDay===job.day;
   const reward=repeat?0:standard.reward;
   next.dailyJobBest=repeat&&next.dailyJobBest?Math.min(next.dailyJobBest,ms):ms;
   next.dailyJobDay=job.day;
   if(!repeat){next.dailyJobs++;next.coins+=reward;}
   return {profile:next,reward};
 }
 const best=next.records[job.id], reward=best ? 0 : job.reward;
 next.records[job.id]=best ? Math.min(best,ms) : ms;
 next.coins+=reward;
 return {profile:next,reward};
}
function roll(ball,dt){
 const target=clamp(ball.vx/ball.r*.39,-6,6);
 ball.spin+=clamp(target-ball.spin,-17*dt,17*dt);
 ball.angle=(ball.angle+ball.spin*dt)%(Math.PI*2);
}
const ROUTE = [
 {at:0,name:'Jardines del aire',type:'spike',hint:'Elige el momento de pasar por la pared libre.'},
 {at:180,name:'Taller de resortes',type:'spring',hint:'Cae sobre la placa roja para un lanzamiento protegido.'},
 {at:390,name:'Puerto de carga',type:'block',hint:'Rodea la caja por un lado.'},
 {at:810,name:'Molino del valle',type:'saw',hint:'Deja espacio entre la sierra y tu pelota.'},
 {at:1400,name:'Andén flotante',type:'moving',hint:'Observa el vaivén antes de subir.'},
 {at:2200,name:'Paso gemelo',type:'double',hint:'Cruza por el centro.'},
 {at:3200,name:'Central de tormentas',type:'beam',hint:'Pasa por fuera del arco eléctrico.'},
 {at:4400,name:'Aguja del cielo',type:'blade',hint:'Deja la cuchilla a un lado.'}
];
function stageAt(height){return ROUTE.filter(s=>height>=s.at).pop()||ROUTE[0];}
function gapFor(height,rng){return Math.max(345,545-height*.105)+rng()*66;}
function obstacle(rng,index,y,height,previousHeight=height,lastSpring=-100){
 const stage=stageAt(height), known=ROUTE.slice(0,ROUTE.indexOf(stage)+1);
 const hazards=known.filter(s=>s.type!=='spring');
 const bonus=height>=180 && index-lastSpring>=8 && index%9===7;
 const type=stage.at>previousHeight ? stage.type : bonus ? 'spring' : hazards[Math.floor(rng()*hazards.length)].type;
 const o={type,y,phase:rng()*Math.PI*2,passed:false};
 switch(type){
 case 'spring': Object.assign(o,{x:115+rng()*54,w:72,h:67,used:false}); break;
 case 'spike': Object.assign(o,{side:(index+Math.floor(rng()*2))%3===0?'left':'right',w:68,h:71}); break;
 case 'double': Object.assign(o,{w:49,h:60}); break;
 case 'saw': Object.assign(o,{x:126+rng()*108,r:33}); break;
 case 'block': Object.assign(o,{x:(index%2 ? 74 : 174)+rng()*28,w:76,h:66}); break;
 case 'moving': Object.assign(o,{x:114+rng()*54,w:90,h:49,amp:30,speed:.84}); break;
 case 'beam': Object.assign(o,{x:110+rng()*55,w:83,h:25}); break;
 case 'blade': Object.assign(o,{x:132+rng()*68,w:33,h:79}); break;
 }
 return o;
}
function pickupLane(o,rng){
 if(o.type==='spike')return o.side==='left'?246:114;
 if(o.type==='spring')return o.x+o.w/2;
 if(o.type==='double')return 180;
 const center=o.type==='saw'?o.x:o.x+o.w/2;
 return center<180?262+rng()*13:85+rng()*13;
}
function circleRect(cx,cy,r,x,y,w,h){const nx=clamp(cx,x,x+w),ny=clamp(cy,y,y+h);return(cx-nx)**2+(cy-ny)**2<r*r;}
function circleCircle(x1,y1,r1,x2,y2,r2){return(x1-x2)**2+(y1-y2)**2<(r1+r2)**2;}
function hitsSprite(mask, cx, cy, radius, x, y, w, h) {
 if (!circleRect(cx,cy,radius,x,y,w,h)) return false;
 const dx=w/mask[0].length, dy=h/mask.length;
 const left=Math.max(0,Math.floor((cx-radius-x)/dx));
 const right=Math.min(mask[0].length-1,Math.floor((cx+radius-x)/dx));
 const top=Math.max(0,Math.floor((cy-radius-y)/dy));
 const bottom=Math.min(mask.length-1,Math.floor((cy+radius-y)/dy));
 for(let row=top;row<=bottom;row++){
  for(let col=left;col<=right;col++){
   if(mask[row][col]==='#' && circleRect(cx,cy,radius,x+col*dx,y+row*dy,dx,dy)) return true;
  }
 }
 return false;
}
function reflectWall(ball,left,right){
 const min=left+ball.r, max=right-ball.r;
 if(ball.x>=max && ball.vx>0){ball.x=2*max-ball.x;ball.vx=-ball.vx;return true;}
 if(ball.x<=min && ball.vx<0){ball.x=2*min-ball.x;ball.vx=-ball.vx;return true;}
 return false;
}
return{DAILY,league,xpLevel,rankProgress,dayNumber,claimDaily,price,buyGear,JOBS,dailyJob,jobProgress,settleJob,roll,hitsSprite,reflectWall,pickupLane,MISSIONS,claimMission,ROUTE,stageAt,gapFor,SKINS,TRAILS,buyTrail,freshProfile,normalizeProfile,nextSkin,progressFor,payout,gainForRun,applyRun,seeded,obstacle,circleRect,circleCircle,clamp};});
