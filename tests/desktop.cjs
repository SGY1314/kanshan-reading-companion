const {app,BrowserWindow,shell} = require('electron');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createService} = require('../service.cjs');
const dir = process.env.KANSHAN_DESKTOP_TEST_DIR;
if (!dir) throw new Error('Run node tests/run-desktop.cjs');
app.setPath('userData',dir);
let opened,service;
shell.openExternal = async url => { opened=url; };
const originalLoad = Module._load;
Module._load = function(request,parent,...rest) {
  if (request === './service.cjs' && parent.filename === path.resolve(__dirname,'../main.cjs')) return {
    createService:options=>{
      service=createService(options);
      const listen=service.server.listen.bind(service.server);
      service.server.listen=(_port,...args)=>listen(0,...args);
      return service;
    }
  };
  return originalLoad.call(this,request,parent,...rest);
};
require('../main.cjs');
Module._load=originalLoad;
const deadline=setTimeout(()=>{console.error('Desktop test timed out');app.exit(1);},15000);
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
    console.log('PASS desktop entry: one pet window, click calls default browser with working single-use local URL.');
    clearTimeout(deadline);service.dispose();service.server.close();
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
