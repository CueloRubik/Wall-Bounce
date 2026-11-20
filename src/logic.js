(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WallBounceLogic=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const rows=[['classic','Sonrisas','#fff0f8'],['cat','Michi','#ffaf86'],['bee','Abejita','#ffcc49'],['donut','Dona','#fa8dc7'],['basketball','Canasta','#f69a51'],['bunny','Conejita','#ffc1e2'],['frog','Ranita','#86d95e'],['citrus','Naranja','#ffc257'],['flower','Sakura','#ff9dc6'],['robot','Robito','#9dd8ff'],['pumpkin','Calabaza','#ffad6a'],['planet','Saturno','#a5a6f9'],['snow','Copito','#b0eaff'],['heart','Amorcito','#fb81b1'],['crown','Rey Sol','#f7ce55'],['dragon','Dragón','#71d2ad'],['ninja','Ninja','#a1add1'],['cherry','Cerecitas','#fd7799'],['cloud','Nubecita','#bbdafa'],['flame','Llamita','#ff955c'],['koi','Koi','#ffbfab'],['strawberry','Fresita','#fc6d8a'],['cosmic','Galaxia','#a987f4'],['ocean','Océano','#63d3f7'],['arcade','Arcade','#62cafa'],['kiwi','Kiwi','#b7d36a'],['moon','Lunita','#ffe0a4'],['crystal','Amatista','#d5a5ff'],['prism','Prisma','#9aefff'],['circuit','Cibernética','#65cfe8'],['sun','Solecito','#ffdc70'],['candy','Caramelo','#ebba96'],['clover','Trébol','#8ad685'],['rocket','Cohetito','#ff9ab5'],['jelly','Gelatina','#9ba8fa'],['fox','Zorrito','#ffbc83']];
const TRAILS=Object.freeze([{id:'original',name:'Destellos',price:0,colors:['#c584ed','#72e3f6']},{id:'mint',name:'Menta fresca',price:120,colors:['#67d5c6','#b3ffe9']},{id:'rose',name:'Cereza brillante',price:200,colors:['#ff72bb','#ffe0e7']},{id:'sun',name:'Chispas doradas',price:350,colors:['#ffc96c','#fff4aa']},{id:'galaxy',name:'Polvo galáctico',price:550,colors:['#8177dc','#e7acfa']}]);
const SKINS=Object.freeze(rows.map(([id,name,color],index)=>Object.freeze({id,name,color,index})));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));const int=v=>Number.isFinite(v)?Math.floor(clamp(v,0,100000000)):0;
function freshProfile(){return{version:5,coins:0,high:0,plays:0,totalScore:0,totalStars:0,totalBounces:0,selected:'classic',trails:['original'],selectedTrail:'original',sound:true,music:true,volume:70,reducedFx:false,nextIndex:1,progress:0,unlocked:['classic']};}
function normalizeProfile(raw){const p=freshProfile();if(!raw||typeof raw!=='object'||Array.isArray(raw))return p;
for(const k of ['coins','high','plays','totalScore','totalStars','totalBounces'])p[k]=int(raw[k]);p.sound=raw.sound!==false;p.music=raw.music!==false;p.volume=Number.isFinite(raw.volume)?clamp(raw.volume,0,100):70;p.reducedFx=raw.reducedFx===true;
p.nextIndex=clamp(int(raw.nextIndex)||1,1,SKINS.length);p.progress=p.nextIndex===SKINS.length?100:clamp(int(raw.progress),0,99);p.unlocked=SKINS.slice(0,p.nextIndex).map(s=>s.id);p.selected=p.unlocked.includes(raw.selected)?raw.selected:'classic';p.trails=TRAILS.filter(t=>t.price===0 || (Array.isArray(raw.trails)&&raw.trails.includes(t.id))).map(t=>t.id);p.selectedTrail=p.trails.includes(raw.selectedTrail)?raw.selectedTrail:'original';return p;}
function nextSkin(p){p=normalizeProfile(p);return p.nextIndex>=SKINS.length?null:SKINS[p.nextIndex];}
function progressFor(profile,skin){const p=normalizeProfile(profile);const s=typeof skin==='string'?SKINS.find(x=>x.id===skin):skin;if(!s)return{pct:0,unlocked:false,active:false};if(s.index<p.nextIndex)return{pct:100,unlocked:true,active:false};return{pct:s.index===p.nextIndex?p.progress:0,unlocked:false,active:s.index===p.nextIndex};}
function payout(run){const score=int(run.score);return(score?Math.max(1,Math.floor(score/8)):1)+int(run.picked)*3;}
function gainForRun(run){return clamp(3+Math.floor(int(run.score)/65)+Math.min(2,int(run.stars||0)),3,14);}
function applyRun(old,run){const before=normalizeProfile(old),p=normalizeProfile(old),score=int(run.score),stars=int(run.stars),earned=payout(run),target=nextSkin(before);const from=target?before.progress:100,gain=target?gainForRun(run):0;
const eventReward=(Math.floor((p.totalStars+stars)/12)-Math.floor(p.totalStars/12))*80;p.coins+=earned+eventReward;p.totalStars+=stars;p.totalBounces+=int(run.wallBounces);p.plays++;p.totalScore+=score;p.high=Math.max(p.high,score);let unlocked=null,to=Math.min(100,from+gain);
if(target){if(to>=100){unlocked=target.id;p.nextIndex++;p.unlocked.push(target.id);p.progress=p.nextIndex>=SKINS.length?100:0;}else p.progress=to;}
return{profile:normalizeProfile(p),earned,eventReward,stars,gained:target?to-from:0,displayGain:gain,target,from,to,unlocked,isRecord:score>before.high,score};}
function buyTrail(old,id){const p=normalizeProfile(old),t=TRAILS.find(a=>a.id===id);if(!t)return {profile:p,success:false,reason:'invalid'};if(p.trails.includes(id)){p.selectedTrail=id;return {profile:p,success:true,purchased:false};}if(p.coins<t.price)return {profile:p,success:false,reason:'coins'};p.coins-=t.price;p.trails.push(id);p.selectedTrail=id;return {profile:normalizeProfile(p),success:true,purchased:true};}
function seeded(seed){let state=seed>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function obstacle(rng,index,y,score){
 const level=clamp(score/600,0,1);
 let types;
 if(index===0)types=['spring'];
 else if(index<4)types=['spike','spike','spring'];
 else if(score<120)types=['spike','spike','block','spring'];
 else if(score<250)types=['spike','block','block','spring','saw'];
 else if(score<480)types=['spike','block','saw','moving','spring','beam'];
 else types=['spike','block','saw','moving','double','beam','blade','spring'];
 const type=types[Math.floor(rng()*types.length)],left=rng()>.5;
 const o={type,y,phase:rng()*Math.PI*2,passed:false};
 if(type==='spike'){o.side=left?'left':'right';o.w=Math.round(17+rng()*9+level*15);o.h=28;}
 else if(type==='block'){o.x=Math.round(128+rng()*102);o.w=29;o.h=29;}
 else if(type==='saw'){o.x=Math.round(140+rng()*80);o.r=15;}
 else if(type==='double'){o.w=Math.round(16+rng()*8+level*8);o.h=27;}
 else if(type==='moving'){o.x=Math.round(145+rng()*40);o.w=30;o.h=30;o.amp=Math.round(18+rng()*18);o.speed=1.1+rng()*.65+level*.6;}
 else if(type==='spring'){o.x=Math.round(145+rng()*60);o.w=49;o.h=23;o.used=false;}
 else if(type==='beam'){o.x=Math.round(142+rng()*67);o.w=58;o.h=14;}
 else if(type==='blade'){o.x=Math.round(141+rng()*73);o.w=29;o.h=31;}
 return o;
}
function circleRect(cx,cy,r,x,y,w,h){const nx=clamp(cx,x,x+w),ny=clamp(cy,y,y+h);return(cx-nx)**2+(cy-ny)**2<r*r;}
function circleCircle(x1,y1,r1,x2,y2,r2){return(x1-x2)**2+(y1-y2)**2<(r1+r2)**2;}
return{SKINS,TRAILS,buyTrail,freshProfile,normalizeProfile,nextSkin,progressFor,payout,gainForRun,applyRun,seeded,obstacle,circleRect,circleCircle,clamp};});
