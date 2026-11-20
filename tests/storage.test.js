const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const {createStorage}=require('../src/storage');
test('guarda únicamente dentro de Documentos/Wall Bounce',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wb-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const documents=path.join(root,'Documentos');const a=createStorage(documents);
  const profile={coins:150,progress:33,nextIndex:5};
  a.write(profile);
  assert.equal(a.dir,path.join(documents,'Wall Bounce'));
  assert.equal(fs.existsSync(a.names.main),true);
  assert.deepEqual(a.read(),profile);
  assert.deepEqual(createStorage(documents).read(),profile);
  assert.deepEqual(fs.readdirSync(root),['Documentos']);
});
test('salva respaldo y lo usa ante corrupción',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wb-recovery-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=createStorage(root);store.write({coins:20});store.write({coins:30});
  assert.equal(JSON.parse(fs.readFileSync(store.names.backup,'utf8')).coins,20);
  fs.writeFileSync(store.names.main,'NO_JSON','utf8');
  assert.equal(store.read().coins,20);
  store.write({coins:40});
  assert.equal(store.read().coins,40);
  assert.equal(JSON.parse(fs.readFileSync(store.names.backup,'utf8')).coins,20);
});
test('no permite escribir datos no válidos',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wb-invalid-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=createStorage(root);assert.throws(()=>store.write(null));assert.throws(()=>store.write('abc'));
});
