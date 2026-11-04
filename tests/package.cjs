const {app} = require('electron');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {modelResponse} = require('./fixtures.cjs');
app.whenReady().then(async()=>{
  try {
    const {listPackage} = await import('@electron/asar');
    const archive = path.resolve(__dirname,'../release/Kanshan-win32-x64/resources/app.asar');
    const files = new Set(listPackage(archive).map(name=>name.replaceAll('\\','/')));
    for (const name of [
      '/main.cjs','/web.cjs','/ui/bridge.js','/ui/kanshan.png',
      '/node_modules/@earendil-works/pi-agent-core/dist/agent.js',
      '/node_modules/@earendil-works/pi-ai/dist/api/openai-completions.js',
      '/node_modules/@earendil-works/pi-schema/package.json',
      '/node_modules/openai/package.json'
    ]) assert.ok(files.has(name),'Missing packaged file: '+name);
    assert.ok(![...files].some(name=>/^\/(?:work|tests|docs|scripts)\//.test(name)));
    for (const name of ['main.cjs','preload.cjs','service.cjs','web.cjs','agent.mjs','interests.cjs','ui/app.js','ui/bridge.js','ui/kanshan.png','ui/style.css','ui/pet.css','ui/pet.html','ui/pet.js']) {
      const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      assert.equal(digest(path.join(archive,name)),digest(path.resolve(__dirname,'..',name)),'Outdated packaged file: '+name);
    }
    const {runReadingAgent} = await import(pathToFileURL(path.join(archive,'agent.mjs')).href);
    const result = await runReadingAgent({prompt:'测试打包依赖',baseUrl:'https://model.example/v1',model:'test',apiKey:'synthetic-key',fetchImpl:async()=>modelResponse('打包后的 pi Agent 工作正常。')});
    assert.equal(result,'打包后的 pi Agent 工作正常。');
    console.log('PASS packaged ASAR: original pet, browser assets, production Pi modules, and streaming agent runtime.');
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
