const {app,BrowserWindow,ipcMain,shell,screen,safeStorage,dialog,Menu} = require('electron');
const path = require('node:path');
const {createService} = require('./service.cjs');
let pet, service, hideTimer;
const extensionDir = app.isPackaged ? path.join(process.resourcesPath,'extension') : path.join(__dirname,'extension');
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
async function openWorkbench() {
  if (!service || !pet) return;
  try { await shell.openExternal(service.launchUrl()); }
  catch { dialog.showErrorBox('无法打开浏览器','请检查 Windows 默认浏览器设置后重新点击看山。'); }
}
app.on('second-instance',openWorkbench);
app.whenReady().then(async () => {
  if (!gotLock) return;
  if (!await safeStorage.isAsyncEncryptionAvailable()) { dialog.showErrorBox('无法安全保存凭证','Windows 加密服务不可用，暂时无法启动。'); return app.quit(); }
  service = createService({dir:app.getPath('userData'),encrypt:s=>safeStorage.encryptString(s),decrypt:b=>safeStorage.decryptString(b),openExtension:async()=>{const error=await shell.openPath(extensionDir);if(error)throw new Error(error);}});
  try { await new Promise((resolve,reject)=>{service.server.once('error',reject);service.server.listen(47831,'127.0.0.1',resolve);}); }
  catch { dialog.showErrorBox('启动失败','本机端口 47831 被占用。请关闭旧版看山后重试。'); return app.quit(); }
  const area = screen.getPrimaryDisplay().workArea;
  pet = new BrowserWindow({width:190,height:278,x:area.x+area.width-214,y:area.y+area.height-300,frame:false,transparent:true,alwaysOnTop:true,resizable:false,skipTaskbar:true,icon:path.join(__dirname,'ui/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  pet.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  pet.webContents.on('will-navigate',e=>e.preventDefault());
  ipcMain.handle('show-panel',openWorkbench);
  ipcMain.handle('pet-menu',()=>Menu.buildFromTemplate([
    {label:'在浏览器打开阅读伙伴',click:openWorkbench},
    {label:'暂时隐藏 10 分钟',click:()=>{pet.hide();clearTimeout(hideTimer);hideTimer=setTimeout(()=>pet?.show(),600000);}},
    {label:'退出看山',click:()=>app.quit()}
  ]).popup({window:pet}));
  await pet.loadFile(path.join(__dirname,'ui/pet.html'));
});
app.on('before-quit',()=>{clearTimeout(hideTimer);service?.dispose();service?.server.close();});
app.on('window-all-closed',()=>app.quit());
