const {app, BrowserWindow, ipcMain, shell, screen, safeStorage, dialog, clipboard, Menu} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {createService, zhihuUrl} = require('./service.cjs');
let pet, panel, service;
const extensionDir = app.isPackaged ? path.join(process.resourcesPath,'extension') : path.join(__dirname,'extension');
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', () => { panel?.show(); panel?.focus(); });
function showPanel() { if (!panel) return; panel.show(); panel.focus(); }
app.whenReady().then(async () => {
  if (!gotLock) return;
  if (!await safeStorage.isAsyncEncryptionAvailable()) { dialog.showErrorBox('无法安全保存凭证','Windows 加密服务不可用，暂时无法启动。'); return app.quit(); }
  service = createService({dir:app.getPath('userData'), encrypt:s => safeStorage.encryptString(s), decrypt:b => safeStorage.decryptString(b), onChange: () => { panel?.webContents.send('library-changed'); pet?.webContents.send('library-changed'); }});
  try { await new Promise((resolve,reject) => { service.server.once('error',reject); service.server.listen(47831,'127.0.0.1',resolve); }); } catch { dialog.showErrorBox('启动失败','本机端口 47831 被占用。请关闭旧版看山后重试。'); return app.quit(); }
  const prefs = {preload:path.join(__dirname,'preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true};
  const area = screen.getPrimaryDisplay().workArea;
  pet = new BrowserWindow({width:200,height:242,x:area.x+area.width-224,y:area.y+area.height-264,frame:false,transparent:true,alwaysOnTop:true,resizable:false,skipTaskbar:true,webPreferences:prefs});
  panel = new BrowserWindow({width:1160,height:820,minWidth:900,minHeight:650,title:'看山·阅读伙伴',icon:path.join(__dirname,'ui/icon.png'),backgroundColor:'#f5f5ef',autoHideMenuBar:true,webPreferences:prefs});
  for (const w of [pet,panel]) { w.webContents.setWindowOpenHandler(() => ({action:'deny'})); w.webContents.on('will-navigate', e => e.preventDefault()); }
  pet.loadFile('ui/pet.html'); panel.loadFile('ui/index.html');
  panel.on('close', e => { if (!app.isQuitting) { e.preventDefault(); panel.hide(); } });
  ipcMain.handle('api', async (_event, {method, route, body}) => { try { return {data:await service.route(method,route,body)}; } catch(e) { return {error:e.message}; } });
  ipcMain.handle('open-link', async (_event,url) => { if (!zhihuUrl(url) && url !== 'https://developer.zhihu.com/profile') throw new Error('仅支持知乎链接'); await shell.openExternal(url); });
  ipcMain.handle('connection', () => ({port:47831,token:service.token,extensionPath:extensionDir,dataPath:app.getPath('userData')}));
  ipcMain.handle('copy-token', () => clipboard.writeText(service.token));
  ipcMain.handle('show-extension', () => shell.openPath(extensionDir));
  ipcMain.handle('show-panel', showPanel);
  ipcMain.handle('pet-menu', () => Menu.buildFromTemplate([{label:'打开阅读笔记',click:showPanel},{label:'暂时隐藏 10 分钟',click:() => {pet.hide();setTimeout(() => pet.show(),600000);}},{label:'退出看山',click:() => app.quit()}]).popup({window:pet}));
  ipcMain.handle('export', async (_event,markdown) => { const result = await dialog.showSaveDialog(panel,{title:'导出阅读笔记',defaultPath:'看山阅读笔记.md',filters:[{name:'Markdown',extensions:['md']}]}); if (!result.canceled) { fs.writeFileSync(result.filePath,String(markdown),'utf8'); return true; } return false; });
});
app.on('before-quit', () => {app.isQuitting=true; service?.dispose(); service?.server.close();});
app.on('window-all-closed', () => app.quit());
