const {contextBridge,ipcRenderer} = require('electron');
const on = (channel, callback) => {
  const listener = (_, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('kanshan',{
  show:()=>ipcRenderer.invoke('show-panel'),
  menu:()=>ipcRenderer.invoke('pet-menu'),
  dragStart:()=>ipcRenderer.invoke('pet-drag-start'),
  dragEnd:()=>ipcRenderer.invoke('pet-drag-end'),
  frequency:()=>ipcRenderer.invoke('pet-frequency'),
  settings:()=>ipcRenderer.invoke('pet-settings'),
  setBubble:height=>ipcRenderer.invoke('pet-bubble',{height}),
  throwPet:(vx,vy)=>ipcRenderer.invoke('pet-throw',{vx,vy}),
  interact:()=>ipcRenderer.invoke('pet-interact'),
  setSetting:(key,value)=>ipcRenderer.invoke('pet-setting',{key,value}),
  say:()=>ipcRenderer.invoke('pet-whisper-now'),
  onSay:callback=>on('pet-say',callback),
  onLanded:callback=>on('pet-landed',callback),
  onConfig:callback=>on('pet-config',callback),
  onFrequency:callback=>on('pet-frequency',callback),
  onMotion:callback=>on('pet-motion',callback),
  onSaved:callback=>{const listener=()=>callback();ipcRenderer.on('pet-saved',listener);return()=>ipcRenderer.removeListener('pet-saved',listener);},
  onReset:callback=>{const listener=()=>callback();ipcRenderer.on('pet-reset',listener);return()=>ipcRenderer.removeListener('pet-reset',listener);}
});
