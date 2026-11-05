const {app,BrowserWindow,shell,screen,Menu} = require('electron');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createReadingServer} = require('../reading-server.cjs');
const dir = process.env.KANSHAN_DESKTOP_TEST_DIR;
if (!dir) throw new Error('Run node tests/run-desktop.cjs');
const shotsDir = path.resolve(__dirname, '../work/test-results');
fs.mkdirSync(shotsDir, { recursive: true });
app.setPath('userData',dir);app.setPath('appData',dir);
let opened,service,menuTemplate;
Menu.buildFromTemplate=template=>({popup(){menuTemplate=template;return this;}});
shell.openExternal = async url => { opened=url; };
const originalLoad = Module._load;
Module._load = function(request,parent,...rest) {
  if (request === './reading-server.cjs' && parent.filename === path.resolve(__dirname,'../main.cjs')) return {
    createReadingServer:options=>{
      service=createReadingServer(options);
      const listen=service.server.listen.bind(service.server);
      service.server.listen=(_port,...args)=>listen(0,...args);
      return service;
    }
  };
  return originalLoad.call(this,request,parent,...rest);
};
require('../main.cjs');
Module._load=originalLoad;
const deadline=setTimeout(()=>{console.error('Desktop test timed out');app.exit(1);},40000);
app.whenReady().then(async()=>{
  try {
    let pet;
    for(let i=0;i<100;i++) {
      pet=BrowserWindow.getAllWindows()[0];
      if(pet && pet.webContents.getURL().endsWith('/ui/pet.html') && !pet.webContents.isLoading())break;
      await new Promise(r=>setTimeout(r,50));
    }
    assert.equal(BrowserWindow.getAllWindows().length,1);
    assert.equal(opened,undefined);
    await pet.webContents.executeJavaScript('document.querySelector("#fox").click()');
    for(let i=0;i<100&&!opened;i++)await new Promise(r=>setTimeout(r,20));
    const url=new URL(opened);
    assert.equal(url.hostname,'127.0.0.1');
    assert.equal(url.port,String(service.server.address().port));
    const code=new URLSearchParams(url.hash.slice(1)).get('launch');
    assert.ok(code && !opened.includes(service.token));
    const response=await fetch(url.origin+'/api/session',{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({code})});
    assert.equal(response.status,200);
    assert.equal(BrowserWindow.getAllWindows().length,1);
    assert.equal(await pet.webContents.executeJavaScript('window.kanshan.frequency()'),'natural');
    assert.equal(await pet.webContents.executeJavaScript('window.kanshan.menu()'),undefined);const modes=menuTemplate.find(item=>item.label==='动作频率').submenu;modes.find(item=>item.label==='安静').click();assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'pet-motion-preferences.json'),'utf8')).frequency,'quiet');assert.equal(await pet.webContents.executeJavaScript('window.kanshan.frequency()'),'quiet');modes.find(item=>item.label==='自然').click();
    const whisperItem=menuTemplate.find(item=>item.label==='碎碎念');assert.equal(whisperItem.checked,true);whisperItem.click();await new Promise(r=>setTimeout(r,80));assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'pet-settings.json'),'utf8')).whisper,false);whisperItem.click();await new Promise(r=>setTimeout(r,80));assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'pet-settings.json'),'utf8')).whisper,true);

    for(const state of ['sittingReading','thinking','annotating','closeReading','swaying','stretching','dozing','waking','greeting','dragging','edgeLeft','edgeRight','edgeTop','saved']){
      pet.webContents.send('pet-motion',state);await new Promise(r=>setTimeout(r,100));assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.state'),state.startsWith('edge')?'edge':state==='saved'?'reading':state);
      const sample='JSON.stringify(["head","left-flipper","right-flipper","left-foot","right-foot"].map(id=>getComputedStyle(document.getElementById(id)).transform))';
      const before=await pet.webContents.executeJavaScript(sample);await new Promise(r=>setTimeout(r,400));const after=await pet.webContents.executeJavaScript(sample);
      if(!await pet.webContents.executeJavaScript('matchMedia("(prefers-reduced-motion: reduce)").matches'))assert.notEqual(after,before,'Independent joints must keep moving: '+state);
    }
    pet.webContents.send('pet-motion','dozing');await new Promise(r=>setTimeout(r,100));
    fs.writeFileSync(path.join(shotsDir,'pet-dozing.png'),(await pet.webContents.capturePage()).toPNG());
    await pet.webContents.executeJavaScript('document.querySelector("#fox").dispatchEvent(new Event("pointerenter"))');assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.state'),'waking');
    pet.webContents.send('pet-reset');await new Promise(r=>setTimeout(r,80));
    const savedResponse=await fetch(url.origin+'/api/clips',{method:'POST',headers:{Authorization:'Bearer '+service.token,'Content-Type':'application/json'},body:JSON.stringify({quote:'保存后轻轻点头',url:'https://www.zhihu.com/answer/123',kind:'金句'})});assert.equal(savedResponse.status,200);
    await new Promise(r=>setTimeout(r,100));assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.feedback'),'saved');
    await new Promise(r=>setTimeout(r,1700));assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.feedback'),undefined);
    const area=screen.getPrimaryDisplay().workArea;
    let cursor={x:area.x+400,y:area.y+300};screen.getCursorScreenPoint=()=>cursor;
    pet.setPosition(area.x+300,area.y+200);
    await pet.webContents.executeJavaScript('window.kanshan.dragStart()');cursor={x:area.x+470,y:area.y+350};
    await new Promise(r=>setTimeout(r,60));assert.equal(pet.getBounds().x,area.x+370);assert.equal(pet.getBounds().y,area.y+250);
    const released=await pet.webContents.executeJavaScript('window.kanshan.dragEnd()');assert.equal(released.edge,'');
    cursor={x:area.x+420,y:area.y+300};await pet.webContents.executeJavaScript('window.kanshan.dragStart()');cursor={x:area.x+1,y:area.y+300};
    await new Promise(r=>setTimeout(r,60));const snapped=await pet.webContents.executeJavaScript('window.kanshan.dragEnd()');assert.equal(snapped.edge,'left');assert.equal(pet.getBounds().x,area.x);
    assert.equal(pet.isAlwaysOnTop(),true);assert.equal(pet.isResizable(),false);
    opened=undefined;pet.focus();pet.setPosition(area.x+300,area.y+200);cursor={x:area.x+400,y:area.y+300};
    pet.webContents.sendInputEvent({type:'mouseDown',x:100,y:100,button:'left',clickCount:1});
    await new Promise(r=>setTimeout(r,50));cursor={x:area.x+420,y:area.y+310};pet.webContents.sendInputEvent({type:'mouseMove',x:120,y:110,button:'left'});
    await new Promise(r=>setTimeout(r,120));assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.state'),'dragging');pet.webContents.send('pet-saved');await new Promise(r=>setTimeout(r,40));assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.feedback'),undefined);
    cursor={x:area.x+460,y:area.y+350};await new Promise(r=>setTimeout(r,50));pet.webContents.sendInputEvent({type:'mouseUp',x:120,y:110,button:'left',clickCount:1});
    await new Promise(r=>setTimeout(r,180));assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.state'),'landing');assert.equal(opened,undefined);
    await new Promise(r=>setTimeout(r,1200));assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.state'),'tidying');
    await new Promise(r=>setTimeout(r,3500));assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.state'),'reading');assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.feedback'),'saved');

    const beforeBubble=pet.getBounds();
    pet.webContents.send('pet-say',{text:'这句话，我替你收好了。',hold:1500});
    for(let i=0;i<80&&pet.getBounds().height<=beforeBubble.height+8;i++)await new Promise(r=>setTimeout(r,20));
    const grown=pet.getBounds();
    assert.ok(grown.height>beforeBubble.height+8,`bubble should grow the window, got ${grown.height}`);
    assert.equal(grown.y+grown.height,beforeBubble.y+beforeBubble.height);
    await new Promise(r=>setTimeout(r,320));
    fs.writeFileSync(path.join(shotsDir,'pet-bubble.png'),(await pet.webContents.capturePage()).toPNG());
    for(let i=0;i<120&&pet.getBounds().height!==beforeBubble.height;i++)await new Promise(r=>setTimeout(r,30));
    assert.equal(pet.getBounds().height,beforeBubble.height);

    const beforeThrow=pet.getBounds();
    await pet.webContents.executeJavaScript('window.kanshan.throwPet(900,-420)');
    await new Promise(r=>setTimeout(r,220));
    const flying=pet.getBounds();
    assert.ok(flying.x!==beforeThrow.x||flying.y!==beforeThrow.y,'throw should move the pet');
    let settledBounds=null;
    for(let i=0;i<160;i++){
      const current=pet.getBounds();
      if(current.x>=area.x-1&&current.y>=area.y-1&&current.x+current.width<=area.x+area.width+1&&current.y+current.height<=area.y+area.height+1){settledBounds=current;break;}
      await new Promise(r=>setTimeout(r,30));
    }
    assert.ok(settledBounds,'thrown pet should settle inside the work area');
    assert.ok(['dragging','landing','edge','tidying','reading'].includes(await pet.webContents.executeJavaScript('document.body.dataset.state')));

    console.log('PASS desktop: single pet, browser launch/session, native dragging, bounds clamping and edge snapping.');
    clearTimeout(deadline);service.dispose();service.server.close();
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
