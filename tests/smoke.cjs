// Own-application integration test. It uses synthetic local data and never calls a model.
const {app,BrowserWindow,ipcMain,safeStorage}=require('electron');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');
const {createService}=require('../service.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kanshan-ui-'));let w;
const screenshotsDir=path.resolve(__dirname,'../work/test-results');fs.mkdirSync(screenshotsDir,{recursive:true});
app.whenReady().then(async()=>{
 try{
  assert.ok(await safeStorage.isAsyncEncryptionAvailable());
  const service=createService({dir,encrypt:s=>safeStorage.encryptString(s),decrypt:b=>safeStorage.decryptString(b),fetchImpl:async(_url,options)=>{const payload=JSON.parse(options.body);const signals=JSON.parse(payload.messages[1].content.split('\n').at(-1)).signals;return{ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({topics:[{topic:'学习习惯',reason:'两篇学习资料的重复关注',confidence:.8,evidenceIds:signals.map(s=>s.id)}]})}}]})};}});
  ipcMain.handle('api',async(_e,{method,route,body})=>{try{return{data:await service.route(method,route,body)};}catch(e){return{error:e.message};}});
  ipcMain.handle('export',()=>true);ipcMain.handle('connection',()=>({token:'test'}));
  w=new BrowserWindow({width:1160,height:820,show:false,webPreferences:{preload:path.resolve(__dirname,'../preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const errors=[];w.webContents.on('console-message',(_event,...args)=>{const message=typeof _event==='object'?_event.message:args[1];if(message&&(/Uncaught|Content Security Policy/.test(message)))errors.push(message);});
  await w.loadFile(path.resolve(__dirname,'../ui/index.html'));
  const run=code=>w.webContents.executeJavaScript(code,true);
  const wait=async test=>{for(let i=0;i<150;i++){if(await run(test))return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+test);};
  await wait('!!document.querySelector("#search-form")');
  await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  await new Promise(r=>setTimeout(r,200));
  const image=await w.webContents.capturePage();fs.writeFileSync(path.join(screenshotsDir,'home.png'),image.toPNG());
  await run('document.querySelector("[data-view=problems]").click()');
  await run('document.querySelector("[name=title]").value="测试：如何坚持阅读";document.querySelector("[name=context]").value="每天十分钟";document.querySelector("#problem-form").requestSubmit()');
  await wait('!!document.querySelector("[data-action=plan]")');assert.equal(service.state().problems.length,1);
  await run('document.querySelector("[data-action=manual]").click()');
  await run('document.querySelector("[name=quote]").value="先从一个小行动开始";document.querySelector("[name=url]").value="https://www.zhihu.com/answer/123";document.querySelector("[name=title]").value="测试原文";document.querySelector("[name=note]").value="我愿意尝试";document.querySelector("#clip-form").requestSubmit()');
  await wait('document.querySelectorAll(".evidence").length===1');assert.equal(service.state().clips[0].problemId,service.state().problems[0].id);
  await run('document.querySelector("[data-view=clips]").click()');await wait('!!document.querySelector("#clip-filter")');
  await run('document.querySelector("[data-action=edit-clip]").click();document.querySelector("[name=note]").value="改成新的批注";document.querySelector("#clip-form").requestSubmit()');await wait('!document.querySelector("#dialog").open');assert.equal(service.state().clips[0].note,'改成新的批注');
  await run('document.querySelector("[data-view=settings]").click()');await wait('!!document.querySelector("#settings-form")');
  await run('document.querySelector("[name=interests]").value="科普，阅读";document.querySelector("#settings-form").requestSubmit()');await wait('document.querySelector("[name=interests]").value==="科普，阅读"');
  await new Promise(r=>setTimeout(r,100));assert.deepEqual(service.state().interests,['科普','阅读']);assert.deepEqual(errors,[]);
  await service.route('POST','/api/config',{...service.configState(),baseUrl:'https://model.example/v1',model:'test',aiKey:'synthetic-test-key'});
  await service.route('POST','/api/clips',{quote:'把练习拆小一点',title:'学习方法',url:'https://www.zhihu.com/answer/456'});
  await run('load().then(()=>{document.querySelector("[data-view=discover]").click();document.querySelector("[data-view=settings]").click();})');await wait('!!document.querySelector("#ai-learning")');
  assert.equal(await run('document.querySelector("#ai-learning").checked'),false);
  await run('document.querySelector("#ai-learning").checked=true;document.querySelector("#settings-form").requestSubmit()');await wait('document.querySelector("#ai-learning").checked');await new Promise(r=>setTimeout(r,50));assert.equal(service.state().learning.enabled,true);
  await run('document.querySelector("[data-action=preview-interests]").click()');await wait('!!document.querySelector("[data-action=confirm-interests]")');
  assert.ok(await run('document.querySelector("#dialog-body").textContent.includes("原文")||document.querySelector("#dialog-body").textContent.includes("quote")'));
  await run('document.querySelector("[data-action=confirm-interests]").click()');await wait('!document.querySelector("#dialog").open && document.querySelector("#profile-body").textContent.includes("学习习惯")');assert.equal(service.state().learning.topics.length,1);
  await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  fs.writeFileSync(path.join(screenshotsDir,'interest-settings.png'),(await w.webContents.capturePage()).toPNG());
  await run('document.querySelector("[data-action=pin-interest]").click()');await wait('document.querySelector("[name=interests]").value.includes("学习习惯")');assert.ok(service.state().interests.includes('学习习惯'));
  assert.deepEqual(errors,[]);service.dispose();
  console.log('PASS Electron UI: reading flows, AI learning opt-in, data preview, profile generation and pinning; screenshot saved.');
  app.exit(0);
 }catch(e){console.error(e);app.exit(1);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
