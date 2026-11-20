'use strict';
const {app,BrowserWindow,ipcMain,shell}=require('electron');
const path=require('node:path');
const {createStorage}=require('./src/storage');
app.setName('Wall Bounce');
const storage=createStorage(app.getPath('documents'));
app.setPath('userData',storage.dir);
app.setPath('sessionData',path.join(storage.dir,'session'));
app.commandLine.appendSwitch('disk-cache-dir',path.join(storage.dir,'cache'));
try{app.setPath('crashDumps',path.join(storage.dir,'crashes'));}catch(_){/* depende de Electron y el sistema operativo */}
ipcMain.handle('wallbounce:load',()=>storage.read());
ipcMain.handle('wallbounce:save',(_event,profile)=>storage.write(profile));
ipcMain.handle('wallbounce:folder',()=>shell.openPath(storage.dir));
function createWindow(){
  const win=new BrowserWindow({title:'Wall Bounce',width:420,height:740,minWidth:360,minHeight:620,
    useContentSize:true,autoHideMenuBar:true,backgroundColor:'#b8e8ff',icon:path.join(__dirname,'assets','icon.png'),
    webPreferences:{preload:path.join(__dirname,'preload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
  win.loadFile(path.join(__dirname,'index.html'));
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
}
app.whenReady().then(()=>{createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
