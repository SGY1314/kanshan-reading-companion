const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('kanshan',{
  show:()=>ipcRenderer.invoke('show-panel'),
  menu:()=>ipcRenderer.invoke('pet-menu')
});
