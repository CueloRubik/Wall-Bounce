const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../src/logic');
test('un premio por día local, sin perder sellos tras una pausa',()=>{
 let p=G.claimDaily({},100).profile;
 assert.equal(G.claimDaily(p,100).reward,0);
 assert.equal(G.claimDaily(p,99).reward,0);
 for(let day=105;day<=110;day++)p=G.claimDaily(p,day).profile;
 assert.equal(p.stamps,7);assert.equal(G.claimDaily(p,111).reward,20);
});
test('los rangos recorren las tres divisiones y terminan en Diamante III',()=>{
 let xp=0;
 for(let i=0;i<15;i++){let r=G.league(xp);assert.equal(r.tier,i);xp=r.next;}
 assert.equal(G.league(999999).name,'Diamante III');
 const p=G.freshProfile();p.xp=84;
 const result=G.applyRun(p,{score:36,picked:1,comboCoins:6});
 assert.equal(result.climbed,true);assert.equal(result.xpGain,5);
 assert.equal(result.earned,G.payout({score:36,picked:1})+6);
});
test('el taller conserva compras y respeta el límite y el saldo',()=>{
 assert.equal(G.buyGear({},'ticket').success,false);
 let p=G.normalizeProfile({coins:1000});
 for(let i=0;i<3;i++)p=G.buyGear(p,'magnet').profile;
 assert.equal(p.coins,400);assert.equal(G.buyGear(p,'magnet').success,false);
 for(let i=0;i<5;i++)p=G.buyGear(p,'ticket').profile;
 assert.equal(p.tickets,5);assert.equal(G.buyGear(p,'ticket').success,false);
});
