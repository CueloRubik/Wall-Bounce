const fs = require('node:fs');
const path = require('node:path');
const {buildSync} = require('esbuild');
const mobile = path.resolve(__dirname,'..'), root = path.dirname(mobile), out = path.join(mobile,'www');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
for(const file of ['assets','src','style.css','index.html']) {
  fs.cpSync(path.join(root,file),path.join(out,file),{recursive:true,filter:src=>!['storage.js'].includes(path.basename(src))});
}
fs.copyFileSync(path.join(mobile,'mobile.css'),path.join(out,'mobile.css'));
let html=fs.readFileSync(path.join(out,'index.html'),'utf8');
html=html.replace('</head>','<link rel="stylesheet" href="mobile.css"></head>').replace('<script src="src/logic.js">','<script src="native.js"></script><script src="src/logic.js">');
fs.writeFileSync(path.join(out,'index.html'),html);
buildSync({entryPoints:[path.join(mobile,'native.js')],bundle:true,outfile:path.join(out,'native.js'),target:'chrome89'});
