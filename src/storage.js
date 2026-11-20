'use strict';
const fs = require('node:fs');
const path = require('node:path');
function createStorage(documentsPath) {
  if (typeof documentsPath !== 'string' || !documentsPath.trim()) throw new Error('Ruta Documentos inválida');
  const dir = path.join(documentsPath, 'Wall Bounce');
  const names = Object.freeze({main:path.join(dir,'progreso.json'), backup:path.join(dir,'progreso-respaldo.json'), temp:path.join(dir,'progreso-temporal.json')});
  for(const sub of ['', 'session','cache','crashes']) fs.mkdirSync(path.join(dir,sub),{recursive:true});
  function read() {
    for(const candidate of [names.main,names.backup]) {
      try {
        const parsed=JSON.parse(fs.readFileSync(candidate,'utf8'));
        if(parsed && typeof parsed==='object' && !Array.isArray(parsed)) return parsed;
      } catch(error) {if(error.code!=='ENOENT' && error.name!=='SyntaxError')throw error;}
    }
    return null;
  }
  function write(data) {
    if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error('Progreso inválido');
    const json=JSON.stringify(data);
    if(json.length>100000) throw new Error('Progreso excesivo');
    fs.writeFileSync(names.temp,json,'utf8');
    if(fs.existsSync(names.main)) {
      try { JSON.parse(fs.readFileSync(names.main,'utf8'));fs.copyFileSync(names.main,names.backup); }
      catch(error) {if(error.name!=='SyntaxError')throw error;}
    }
    fs.renameSync(names.temp,names.main);
    return true;
  }
  return {dir,names,read,write};
}
module.exports={createStorage};
