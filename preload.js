'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('wallBounceStorage',Object.freeze({
  load:()=>ipcRenderer.invoke('wallbounce:load'),
  save:profile=>ipcRenderer.invoke('wallbounce:save',profile),
  openFolder:()=>ipcRenderer.invoke('wallbounce:folder')
}));
