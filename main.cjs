const {app,BrowserWindow,ipcMain,shell,screen,safeStorage,dialog,Menu,Tray,nativeImage}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {createReadingServer}=require('./reading-server.cjs');
const {placePet}=require('./pet-motion.cjs');
const {loadSettings,saveSettings}=require('./pet-settings.cjs');
const {clampVelocity,stepThrow,edgeOf}=require('./pet-physics.cjs');
const {periodOf,buildWhisperPrompt,sanitizeLine,localLine,shouldWhisper,holdMs}=require('./pet-whisper.cjs');
const {buildPetMenu,buildTrayMenu}=require('./pet-menu.cjs');

const BASE_HEIGHT=326;
const FAST=process.env.KANSHAN_PET_FAST==='1';
const minuteMs=()=>FAST?1000:60000;
let pet,service,hideTimer,dragTimer,dragSession;
let motionFrequency='natural';
let petSettings=null,tray=null;
let throwTimer=null,throwState=null;
let whisperTimer=null,whisperBusy=false;
let lastInteraction=Date.now(),lastWhisperAt=0;

const frequencyFile=()=>path.join(app.getPath('userData'),'pet-motion-preferences.json');
function changeFrequency(value){if(!['quiet','natural','lively'].includes(value))return;motionFrequency=value;fs.writeFileSync(frequencyFile(),JSON.stringify({frequency:value}));pet?.webContents.send('pet-frequency',value);}

const extensionDir=app.isPackaged?path.join(process.resourcesPath,'extension'):path.join(__dirname,'extension');
const gotLock=app.requestSingleInstanceLock();
if(!gotLock)app.quit();
async function openWorkbench(){if(!service||!pet)return;try{await shell.openExternal(service.launchUrl());}catch{dialog.showErrorBox('无法打开浏览器','请检查 Windows 默认浏览器设置后重新点击看山。');}}
function migrateReadingData(target){
 fs.mkdirSync(target,{recursive:true});
 const roots=[path.join(app.getPath('appData'),'kanshan-frontend-demo'),app.getPath('userData')];
 for(const name of ['library.json','credentials.bin','demo-profile.json']){const dest=path.join(target,name);if(fs.existsSync(dest))continue;for(const root of roots){const source=path.join(root,name);if(fs.existsSync(source)){fs.copyFileSync(source,dest);break;}}}
}
function touch(){lastInteraction=Date.now();}
function stopDrag(snap=true){
 clearInterval(dragTimer);dragTimer=null;
 if(!dragSession||!pet||pet.isDestroyed()){dragSession=null;return {edge:''};}
 const cursor=screen.getCursorScreenPoint(),area=screen.getDisplayNearestPoint(cursor).workArea;
 const result=placePet({cursor,offset:dragSession.offset,size:pet.getBounds(),area,snap});pet.setPosition(result.x,result.y);dragSession=null;return result;
}
function dragVelocity(){
 if(!dragSession||!Array.isArray(dragSession.samples)||dragSession.samples.length<2)return {vx:0,vy:0,thrown:false};
 const samples=dragSession.samples;
 const last=samples[samples.length-1];
 const recent=samples.filter(sample=>sample.t>=last.t-120);
 if(recent.length<6)return {vx:0,vy:0,thrown:false};
 const first=recent[0];
 const span=(last.t-first.t)/1000;
 if(span<0.1)return {vx:0,vy:0,thrown:false};
 const vx=(last.x-first.x)/span;
 const vy=(last.y-first.y)/span;
 const distance=Math.hypot(last.x-first.x,last.y-first.y);
 return {vx,vy,thrown:distance>90&&Math.hypot(vx,vy)>1400};
}
function stopThrow(){clearInterval(throwTimer);throwTimer=null;throwState=null;}
function startThrow(vx,vy){
 if(!pet||pet.isDestroyed())return;
 stopDrag(false);
 const bounds=pet.getBounds();
 const area=screen.getDisplayMatching(bounds).workArea;
 throwState={x:bounds.x,y:bounds.y,vx:clampVelocity(vx),vy:clampVelocity(vy),w:bounds.width,h:bounds.height};
 clearInterval(throwTimer);
 let last=Date.now();
 throwTimer=setInterval(()=>{
  if(!pet||pet.isDestroyed()){stopThrow();return;}
  const now=Date.now(),dt=Math.min(0.04,(now-last)/1000);last=now;
  const step=stepThrow(throwState,dt,{x:area.x,y:area.y,width:area.width,height:area.height});
  throwState=step.state;
  pet.setPosition(Math.round(throwState.x),Math.round(throwState.y));
  if(!step.settled)return;
  clearInterval(throwTimer);throwTimer=null;
  const shot={x:throwState.x,y:throwState.y,width:bounds.width,height:bounds.height};
  const edge=edgeOf(shot,area);
  let x=throwState.x,y=throwState.y;
  if(edge==='left')x=area.x;
  if(edge==='right')x=area.x+area.width-bounds.width;
  if(edge==='top')y=area.y;
  if(edge==='bottom')y=area.y+area.height-bounds.height;
  pet.setPosition(Math.round(x),Math.round(y));
  pet.webContents.send('pet-landed',{edge});
  throwState=null;
 },16);
}
function applyBubble(height){
 if(!pet||pet.isDestroyed())return;
 const extra=Math.max(0,Math.min(180,Math.round(Number(height)||0)));
 const target=extra>0?BASE_HEIGHT+extra+8:BASE_HEIGHT;
 const bounds=pet.getBounds();
 if(Math.abs(bounds.height-target)<2)return;
 const area=screen.getDisplayMatching(bounds).workArea;
 const bottom=bounds.y+bounds.height;
 let y=bottom-target,nextHeight=target;
 if(y<area.y){y=area.y;nextHeight=bottom-y;}
 pet.setBounds({x:bounds.x,y:Math.round(y),width:bounds.width,height:Math.round(nextHeight)});
}
function resetPet(){stopThrow();stopDrag(false);const area=screen.getPrimaryDisplay().workArea;pet.setPosition(area.x+area.width-284,area.y+area.height-350);pet.show();pet.webContents.send('pet-reset');touch();}
function hidePet(){if(!pet)return;stopThrow();pet.hide();clearTimeout(hideTimer);hideTimer=setTimeout(()=>{pet?.show();pet?.webContents.send('pet-reset');},600000);}
function trayActions(){return {open:openWorkbench,show:()=>{pet?.show();pet?.webContents.send('pet-reset');},quit:()=>app.quit(),toggleSleep:()=>pet?.webContents.send('pet-motion','dozing'),toggle:key=>toggleSetting(key)};}
function refreshTray(){if(!tray||!petSettings)return;try{tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu({settings:petSettings,asleep:false,actions:trayActions()})));}catch{}}
function destroyTray(){if(!tray)return;try{tray.destroy();}catch{}tray=null;}
function setupTray(){
 if(!petSettings||!petSettings.tray||process.env.KANSHAN_NO_TRAY==='1'||process.env.KANSHAN_DESKTOP_TEST_DIR)return;
 if(tray)return;
 try{
  const image=nativeImage.createFromPath(path.join(__dirname,'ui/icon.png'));
  tray=new Tray(image.resize({width:16,height:16}));
  tray.setToolTip('看山·阅读伙伴');
  tray.on('click',()=>{pet?.show();});
  refreshTray();
 }catch{tray=null;}
}
function whisperContext(){
 let db={};
 try{db=(service&&service.state&&service.state())||{};}catch{}
 const clips=Array.isArray(db.clips)?db.clips:[];
 const problems=Array.isArray(db.problems)?db.problems:[];
 const later=Array.isArray(db.readLater)?db.readLater:[];
 const now=new Date();
 const savedToday=clips.filter(clip=>{const at=new Date(clip.createdAt);return Number.isFinite(at.getTime())&&at.toDateString()===now.toDateString();}).length;
 const openProblem=problems.find(problem=>!Array.isArray(problem.plans)||problem.plans.length===0);
 return {period:periodOf(now),weekday:'日一二三四五六'[now.getDay()],clips:clips.length,problems:problems.length,later:later.length,savedToday,problemTitle:openProblem?.title||''};
}
async function whisperNow({manual=false}={}){
 if(!pet||pet.isDestroyed()||whisperBusy||!petSettings)return false;
 if(!manual&&(!pet.isVisible()||dragSession||throwTimer))return false;
 const intervalMs=Math.max(1,petSettings.whisperMinutes)*minuteMs();
 if(!manual&&!shouldWhisper({now:Date.now(),lastWhisperAt,lastInteractionAt:lastInteraction,intervalMs}))return false;
 whisperBusy=true;
 const context=whisperContext();
 let text='';
 try{
  const configured=service&&service.configState&&service.configState().aiConfigured;
  if(petSettings.whisperAi&&configured&&service.ask){
   text=await Promise.race([
    service.ask(buildWhisperPrompt(context)),
    new Promise((_,reject)=>setTimeout(()=>reject(Error('whisper timeout')),12000)),
   ]);
  }
 }catch{}
 finally{whisperBusy=false;}
 text=sanitizeLine(text)||localLine(context);
 lastWhisperAt=Date.now();
 pet.webContents.send('pet-say',{text,hold:holdMs(text,FAST)});
 return true;
}
function scheduleWhisper(){
 clearTimeout(whisperTimer);
 if(!petSettings||!petSettings.whisper)return;
 const delay=Math.max(1,petSettings.whisperMinutes)*minuteMs();
 whisperTimer=setTimeout(async()=>{
  try{await whisperNow();}catch{}
  scheduleWhisper();
 },delay);
}
function toggleSetting(key){
 if(!petSettings||!(key in petSettings))return petSettings;
 petSettings=saveSettings(app.getPath('userData'),{[key]:!petSettings[key]});
 applySetting(key);
 return petSettings;
}
function applySetting(key){
 if(key==='alwaysOnTop'&&pet)pet.setAlwaysOnTop(!!petSettings.alwaysOnTop);
 if(key==='tray'){petSettings.tray?setupTray():destroyTray();}
 if(key==='whisper')scheduleWhisper();
 if(pet&&!pet.isDestroyed())pet.webContents.send('pet-config',{...petSettings});
 refreshTray();
}
function settingsOverride(){try{return process.env.KANSHAN_PET_SETTINGS?JSON.parse(process.env.KANSHAN_PET_SETTINGS):undefined;}catch{return undefined;}}

app.on('second-instance',openWorkbench);
app.whenReady().then(async()=>{
 if(!gotLock)return;
 if(!await safeStorage.isAsyncEncryptionAvailable()){dialog.showErrorBox('无法安全保存凭证','Windows 加密服务不可用，暂时无法启动。');return app.quit();}
 petSettings=loadSettings(app.getPath('userData'),settingsOverride());
 try{const settings=JSON.parse(fs.readFileSync(frequencyFile(),'utf8'));if(['quiet','natural','lively'].includes(settings.frequency))motionFrequency=settings.frequency;}catch{}
 const dataDir=path.join(app.getPath('userData'),'reading-v0.6');migrateReadingData(dataDir);
 service=createReadingServer({dir:dataDir,encrypt:s=>safeStorage.encryptString(s),decrypt:b=>safeStorage.decryptString(b),onClipSaved:()=>{if(pet&&!pet.isDestroyed())pet.webContents.send('pet-saved');},openExtension:async()=>{const error=await shell.openPath(extensionDir);if(error)throw Error(error);}});
 try{await new Promise((resolve,reject)=>{service.server.once('error',reject);service.server.listen(47840,'127.0.0.1',resolve);});}catch{dialog.showErrorBox('启动失败','本机端口 47840 被占用。请先关闭预览服务或旧版看山后重试。');return app.quit();}
 const area=screen.getPrimaryDisplay().workArea;
 pet=new BrowserWindow({width:260,height:BASE_HEIGHT,x:area.x+area.width-284,y:area.y+area.height-350,frame:false,transparent:true,alwaysOnTop:!!petSettings.alwaysOnTop,resizable:false,maximizable:false,fullscreenable:false,skipTaskbar:true,hasShadow:false,icon:path.join(__dirname,'ui/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 pet.webContents.setWindowOpenHandler(()=>({action:'deny'}));pet.webContents.on('will-navigate',e=>e.preventDefault());
 const trusted=e=>pet&&!pet.isDestroyed()&&e.sender===pet.webContents;
 ipcMain.handle('pet-frequency',e=>trusted(e)?motionFrequency:'natural');
 ipcMain.handle('pet-settings',e=>trusted(e)?{...petSettings}:null);
 ipcMain.handle('pet-setting',(e,payload)=>{if(!trusted(e))return null;const key=payload?.key;if(typeof key!=='string'||!(key in petSettings))return petSettings;petSettings=saveSettings(app.getPath('userData'),{[key]:payload?.value});applySetting(key);return petSettings;});
 ipcMain.handle('pet-bubble',(e,payload)=>{if(!trusted(e))return;applyBubble(payload?.height);});
 ipcMain.handle('pet-throw',(e,payload)=>{if(!trusted(e))return {ok:false};startThrow(Number(payload?.vx)||0,Number(payload?.vy)||0);return {ok:true};});
 ipcMain.handle('pet-interact',e=>{if(!trusted(e))return;touch();});
 ipcMain.handle('pet-whisper-now',e=>{if(!trusted(e))return false;touch();return whisperNow({manual:true});});
 ipcMain.handle('show-panel',e=>{if(trusted(e))return openWorkbench();});
 ipcMain.handle('pet-drag-start',e=>{
  if(!trusted(e))return {cancelled:true};
  stopThrow();stopDrag(false);const cursor=screen.getCursorScreenPoint(),bounds=pet.getBounds();dragSession={offset:{x:cursor.x-bounds.x,y:cursor.y-bounds.y},samples:[{x:cursor.x,y:cursor.y,t:Date.now()}]};
  dragTimer=setInterval(()=>{if(!pet||pet.isDestroyed()||!dragSession)return;const cursor=screen.getCursorScreenPoint();const result=placePet({cursor,offset:dragSession.offset,size:pet.getBounds(),area:screen.getDisplayNearestPoint(cursor).workArea});pet.setPosition(result.x,result.y);dragSession.samples.push({x:cursor.x,y:cursor.y,t:Date.now()});if(dragSession.samples.length>24)dragSession.samples.shift();},16);
  return {ok:true};
 });
 ipcMain.handle('pet-drag-end',e=>{
  if(!trusted(e))return {edge:''};
  const velocity=dragVelocity();
  if(velocity.thrown){startThrow(velocity.vx*0.78,velocity.vy*0.78);return {edge:'',thrown:true};}
  return stopDrag(true);
 });
 ipcMain.handle('pet-menu',e=>{if(!trusted(e))return;stopDrag(false);touch();const extras=[
  {label:'打开划线插件文件夹',click:()=>shell.openPath(extensionDir)},
  {label:'动作频率',submenu:[['安静','quiet'],['自然','natural'],['活泼','lively']].map(([label,value])=>({label,type:'radio',checked:motionFrequency===value,click:()=>changeFrequency(value)}))},
  {label:'看看动作',submenu:[['坐着翻书','sittingReading'],['举书细读','closeReading'],['托腮思考','thinking'],['钢笔批注','annotating'],['轻轻晃脚','swaying'],['伸个懒腰','stretching'],['抱书打盹','dozing'],['睡醒抬头','waking'],['招手回应','greeting'],['拎起抱书','dragging'],['落地扶页与整理','landing'],['扒住左边框','edgeLeft'],['扒住右边框','edgeRight'],['扒住上边框','edgeTop'],['收好金句','saved']].map(([label,state])=>({label,click:()=>pet.webContents.send('pet-motion',state)}))}
 ];
 Menu.buildFromTemplate(buildPetMenu({settings:petSettings,asleep:false,extras,actions:{open:openWorkbench,say:()=>whisperNow({manual:true}),reset:resetPet,hide:hidePet,quit:()=>app.quit(),toggleSleep:()=>pet.webContents.send('pet-motion','dozing'),toggle:key=>toggleSetting(key)}})).popup({window:pet});});
 screen.on('display-removed',resetPet);screen.on('display-metrics-changed',resetPet);
 await pet.loadFile(path.join(__dirname,'ui/pet.html'));
 setupTray();
 scheduleWhisper();
 console.log('看山·阅读伙伴：http://127.0.0.1:47840/');
});
app.on('before-quit',()=>{clearTimeout(hideTimer);clearTimeout(whisperTimer);clearInterval(dragTimer);clearInterval(throwTimer);destroyTray();service?.dispose();service?.server.close();});
app.on('window-all-closed',()=>app.quit());
