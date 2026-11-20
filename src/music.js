(() => {
'use strict';
const tracks = {
  menu: new Audio('assets/music/picnic-menu.mp3'),
  game: new Audio('assets/music/bounce-parade.mp3')
};
for (const track of Object.values(tracks)) { track.loop = true; track.preload = 'auto'; track.volume = 0; }
const FX = ['tap','jump','bounce','coin','hit','level','unlock','pause','progress','spring','star','shield'];
const soundFiles = Object.fromEntries(FX.map(name => [name, `assets/sfx/${name}.wav`]));
const pools = {};
for (const name of FX) pools[name] = Array.from({length: name==='coin'||name==='star'?2:1}, () => {
  const audio=new Audio(soundFiles[name]);audio.preload='auto';return audio;
});
const intervals={jump:155,bounce:115,tap:130,coin:75,star:120,level:350,hit:250,progress:500,unlock:650,pause:160,spring:260,shield:260};
const levels={jump:.12,bounce:.095,tap:.075,coin:.23,star:.22,level:.19,hit:.2,progress:.16,unlock:.36,pause:.13,spring:.18,shield:.19};
const lastPlayed={};
let started=false, enabled=true, volume=.7, desired='menu', sfx=true, active=null, paused=false;
function sync(mode,on=true,amount=70,sound=true) {
  desired=(mode==='playing'||mode==='pause')?'game':'menu';
  paused=mode==='pause'; enabled=on;volume=Math.max(0,Math.min(1,amount/100));sfx=sound;
  for(const [id,t] of Object.entries(tracks))if(!enabled || id!==desired){t.pause();t.volume=0;}
  active=enabled?tracks[desired]:null;
  if(active && started){active.volume=volume*(paused?.17:1)*.40;active.play().catch(()=>{});}
}
function activate(mode,on,amount,sound){started=true;sync(mode,on,amount,sound);}
function play(name){
  if(!started || !sfx || !pools[name])return;
  const now=performance.now();if(now-(lastPlayed[name]??-Infinity)<(intervals[name]||100))return;
  lastPlayed[name]=now;
  const pool=pools[name];let audio=pool.find(a=>a.paused||a.ended);
  if(!audio)return; // no overlapping voices of the same action
  try {audio.currentTime=0;audio.volume=Math.min(.52,volume*(levels[name]||.17));audio.play().catch(()=>{});}catch(_){}
}
function suspend(){Object.values(tracks).forEach(t=>t.pause());for(const p of Object.values(pools))p.forEach(t=>t.pause());}
window.WallBounceMusic={sync,activate,play,suspend};
})();
