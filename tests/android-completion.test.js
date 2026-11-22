const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../src/logic');
test('niveles y ligas tienen umbrales monotónicos y máximo visible',()=>{
 assert.equal(G.xpLevel(0).level,1);
 assert.equal(G.xpLevel(44).level,1);
 assert.equal(G.xpLevel(45).level,2);
 assert.equal(G.xpLevel(135).level,3);
 for(let i=0;i<10000;i+=13){const l=G.xpLevel(i);assert.ok(i>=l.floor&&i<l.next);assert.ok(l.progress>=0&&l.progress<100);}
 assert.equal(G.rankProgress(999999),100);
});
test('rutas diarias reproducibles y premios sin duplicados ni retroceso de fecha',()=>{
 const j=G.dailyJob(20800);
 assert.deepEqual(j,G.dailyJob(20800));
 assert.notEqual(j.seed,G.dailyJob(20801).seed);
 assert.equal(new Set([20800,20801,20802].map(d=>G.dailyJob(d).kind)).size,3);
 let first=G.settleJob({},j,10);
 assert.equal(first.reward,45);
 let again=G.settleJob(first.profile,j,9);
 assert.equal(again.reward,0);assert.equal(again.profile.dailyJobBest,9000);
 let next=G.settleJob(again.profile,G.dailyJob(20801),10);
 assert.equal(next.profile.coins,90);assert.equal(next.profile.dailyJobs,2);
 assert.equal(G.settleJob(next.profile,j,8).reward,0);
 assert.equal(G.settleJob(next.profile,G.dailyJob(20802),99).reward,0);
});
test('rutas cuentan la magnitud adecuada',()=>{
 const run={score:50,parcels:2,wallBounces:9};
 const expected={height:50,parcels:2,bounces:9};
 for(let d=20800;d<20803;d++){const job=G.dailyJob(d);assert.equal(G.jobProgress(job,run),expected[job.kind]);}
});
test('bobina y estelas nuevas conservan saldo y no superan límites',()=>{
 let p=G.normalizeProfile({coins:1000,version:8});
 p=G.buyGear(p,'coil').profile;assert.equal(p.coil,1);assert.equal(p.coins,820);
 p=G.buyGear(p,'coil').profile;assert.equal(p.coil,2);assert.equal(p.coins,520);
 assert.equal(G.buyGear(p,'coil').success,false);
 assert.equal(G.normalizeProfile({coil:99}).coil,2);
 const t=G.buyTrail(p,'aurora');assert.equal(t.success,true);assert.equal(t.profile.coins,250);
 assert.equal(G.buyTrail(t.profile,'aurora').profile.coins,250);
});
