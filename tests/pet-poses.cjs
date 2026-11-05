const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
app.whenReady().then(async()=>{let w;try{
 ipcMain.handle('pet-bubble',()=>{});ipcMain.on('pet-interact',()=>{});ipcMain.handle('pet-frequency',()=> 'natural');ipcMain.handle('pet-settings',()=>({sound:false}));
 const folder=path.resolve(__dirname,'../../../work/pet-poses');fs.mkdirSync(folder,{recursive:true});
 w=new BrowserWindow({show:true,width:260,height:326,transparent:true,frame:false,webPreferences:{preload:path.resolve(__dirname,'../preload.cjs'),sandbox:true,contextIsolation:true,backgroundThrottling:false}});
 await w.loadFile(path.resolve(__dirname,'../ui/pet.html'));
 const cards=[];
 for(const [label,state]of [['坐着翻书','sittingReading'],['举书细读','closeReading'],['托腮思考','thinking'],['钢笔批注','annotating'],['晃脚','swaying'],['伸懒腰','stretching'],['打盹','dozing'],['醒来','waking'],['招手','greeting'],['拎起抱书','dragging'],['落地扶页','landing'],['蹲下整理','tidying'],['左侧扒边','edgeLeft'],['右侧扒边','edgeRight'],['上侧扒边','edgeTop'],['保存金句','saved']]){
  await w.loadFile(path.resolve(__dirname,'../ui/pet.html'));
  if(state==='tidying')await w.webContents.executeJavaScript("clearTimeout(transitionTimer);clearTimeout(actionTimer);setState('tidying')");else w.webContents.send('pet-motion',state);await new Promise(r=>setTimeout(r,60));
  assert.equal(await w.webContents.executeJavaScript('document.body.dataset.state'),state.startsWith('edge')?'edge':state==='saved'?'reading':state);
  const animations=await w.webContents.executeJavaScript("document.getAnimations().map(a=>{a.pause();a.currentTime=a.effect.getTiming().duration*.45;return a.animationName})");assert.ok(animations.length>0,state);
  await w.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');console.log(state,await w.webContents.executeJavaScript('getComputedStyle(document.querySelector("#book")).transform'));const png=(await w.webContents.capturePage()).toPNG();fs.writeFileSync(path.join(folder,state+'.png'),png);cards.push({label,src:state+'.png'});
 }
 w.setSize(1100,1530);
 fs.writeFileSync(path.join(folder,'index.html'),'<style>body{margin:0;background:#f8f6ef;color:#3e4735;font:16px SimSun}h1{font-size:24px;font-weight:normal;margin:28px 36px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:0 20px}figure{margin:0;text-align:center;border:1px solid #dedfD2;background:#fcfbf7}img{width:235px;height:300px;object-fit:contain}figcaption{padding:12px;border-top:1px solid #e6e5dc}</style><h1>看山 · 阅读间的小动作</h1><main>'+cards.map(c=>'<figure><img src="'+c.src+'"><figcaption>'+c.label+'</figcaption></figure>').join('')+'</main>');await w.loadFile(path.join(folder,'index.html'));
 await new Promise(r=>setTimeout(r,150));fs.writeFileSync(path.resolve(folder,'../看山动作预览.png'),(await w.webContents.capturePage()).toPNG());console.log('PASS pose rendering: all sixteen animated states captured.');w.destroy();app.quit();
 }catch(e){console.error(e);w?.destroy();app.exit(1);}});
