'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),mobile=path.join(root,'mobile'),android=path.join(mobile,'android');
const win=process.platform==='win32';
function javaMajor(output){
 const match=String(output).match(/(?:openjdk|java)\s+version\s+"(\d+)/i);
 return match?Number(match[1]):null;
}
function chooseJava(){
 const candidates=[process.env.JAVA_HOME];
 const roots=win?[
  path.join(process.env.ProgramFiles||'C:/Program Files','Eclipse Adoptium'),
  path.join(process.env.LOCALAPPDATA||'','Programs','Eclipse Adoptium'),
  path.join(process.env.ProgramFiles||'C:/Program Files','Java'),
  path.join(process.env.ProgramFiles||'C:/Program Files','Microsoft'),
  path.join(process.env.USERPROFILE||'','.jdks')
 ]:['/usr/lib/jvm','/opt/java'];
 for(const dir of roots){
  if(!fs.existsSync(dir))continue;
  for(const name of fs.readdirSync(dir).sort().reverse())if(/(?:jdk|temurin|java)[-_]?21|21[._-]/i.test(name))candidates.push(path.join(dir,name));
 }
 if(win)candidates.push(path.join(process.env.ProgramFiles||'C:/Program Files','Android','Android Studio','jbr'));
 for(const candidate of candidates.filter(Boolean)){
  const exe=path.join(candidate,'bin',win?'java.exe':'java');
  if(!fs.existsSync(exe)||!fs.existsSync(path.join(candidate,'bin',win?'javac.exe':'javac')))continue;
  const check=spawnSync(exe,['-version'],{encoding:'utf8'});
  if(check.status===0&&javaMajor((check.stderr||'')+(check.stdout||''))===21)return candidate;
 }
 return null;
}
function chooseSdk(){
 const candidates=[process.env.ANDROID_HOME,process.env.ANDROID_SDK_ROOT,process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Android','Sdk'),process.env.HOME&&path.join(process.env.HOME,'Android','Sdk')];
 return candidates.filter(Boolean).find(dir=>fs.existsSync(path.join(dir,'platforms','android-36','android.jar')))||null;
}
function run(exe,args,cwd){
 const result=spawnSync(exe,args,{cwd,stdio:'inherit',env:process.env});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('Falló '+exe+' (código '+result.status+').');
}
function main(mode){
 if(!['doctor','sync','debug'].includes(mode))throw Error('Modo Android desconocido.');
 const java=chooseJava(),sdk=chooseSdk();
 const cli=path.join(mobile,'node_modules','@capacitor','cli','bin','capacitor');
 const dependencies=fs.existsSync(cli)&&fs.existsSync(path.join(mobile,'node_modules','esbuild','package.json'));
 const nodeReady=Number(process.versions.node.split('.')[0])>=22;
 console.log('Node: '+process.version+(nodeReady?'':' (se necesita 22 o posterior)'));
 console.log('JDK 21: '+(java||'no encontrado; instala EclipseAdoptium.Temurin.21.JDK'));
 console.log('Android SDK 36: '+(sdk||'no encontrado; instala Android SDK Platform 36'));
 console.log('Capacitor: '+(dependencies?'instalado':'ejecuta npm.cmd --prefix mobile ci'));
 if(!nodeReady||!java||!sdk||!dependencies){
  if(mode==='doctor'){process.exitCode=1;return;}
  throw Error('Corrige los requisitos anteriores y vuelve a ejecutar android:debug.');
 }
 if(mode==='doctor')return;
 process.env.JAVA_HOME=java;
 process.env.ANDROID_HOME=sdk;
 process.env.ANDROID_SDK_ROOT=sdk;
 process.env.PATH=path.join(java,'bin')+path.delimiter+(process.env.PATH||'');
 fs.writeFileSync(path.join(android,'local.properties'),'sdk.dir='+sdk.replace(/\\/g,'/')+'\n');
 run(process.execPath,[path.join(mobile,'scripts','web.cjs')],mobile);
 run(process.execPath,[cli,'sync','android'],mobile);
 if(mode==='sync')return;
 if(win)run(process.env.ComSpec||'cmd.exe',['/d','/c','gradlew.bat','assembleDebug','--console=plain','--no-daemon'],android);
 else run('sh',['gradlew','assembleDebug','--console=plain','--no-daemon'],android);
 const source=path.join(android,'app','build','outputs','apk','debug','app-debug.apk');
 if(!fs.existsSync(source)||fs.statSync(source).size===0)throw Error('Gradle no produjo un APK válido.');
 const version=JSON.parse(fs.readFileSync(path.join(mobile,'package.json'),'utf8')).version;
 const output=path.join(root,'dist-android','Wall-Bounce-'+version+'-Android-debug.apk');
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.copyFileSync(source,output);
 console.log('APK: '+output);
}
if(require.main===module){
 try{main(process.argv[2]||'debug');}catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={javaMajor};
