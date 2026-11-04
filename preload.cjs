const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('kanshan', {
  api: async (method,route,body) => { const r=await ipcRenderer.invoke('api',{method,route,body}); if(r.error) throw new Error(r.error); return r.data; },
  open: url => ipcRenderer.invoke('open-link',url),
  connection: () => ipcRenderer.invoke('connection'),
  copyToken: () => ipcRenderer.invoke('copy-token'),
  extension: () => ipcRenderer.invoke('show-extension'),
  show: () => ipcRenderer.invoke('show-panel'),
  menu: () => ipcRenderer.invoke('pet-menu'),
  export: text => ipcRenderer.invoke('export',text),
  onChange: callback => ipcRenderer.on('library-changed',() => callback())
});
