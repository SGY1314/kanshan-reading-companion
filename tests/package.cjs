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
    const archive = path.resolve(__dirname,'../release-v0.6/Kanshan-win32-x64/resources/app.asar');
    const files = new Set(listPackage(archive).map(name=>name.replaceAll('\\','/')));
    for (const name of [
      '/main.cjs','/ui/pet-behavior.js','/ui/penguin-reference.png','/pet-settings.cjs','/pet-physics.cjs','/pet-whisper.cjs','/pet-menu.cjs','/memory.cjs','/web.cjs','/ui/live.js','/ui/experience.js','/reading-server.cjs','/features.cjs','/pet-motion.cjs','/ui/kanshan.png',
      '/node_modules/@earendil-works/pi-agent-core/dist/agent.js',
      '/node_modules/@earendil-works/pi-ai/dist/api/openai-completions.js',
      '/node_modules/@earendil-works/pi-schema/package.json',
      '/node_modules/openai/package.json'
    ]) assert.ok(files.has(name),'Missing packaged file: '+name);
    assert.ok(![...files].some(name=>/^\/(?:work|tests|docs|scripts)\//.test(name)));
    for (const name of ['main.cjs','preload.cjs','service.cjs','web.cjs','agent.mjs','interests.cjs','memory.cjs','ui/app.js','ui/live.js','ui/experience.js','reading-server.cjs','features.cjs','pet-motion.cjs','ui/kanshan.png','ui/style.css','ui/pet.css','ui/pet.html','ui/pet.js','ui/pet-behavior.js','ui/penguin-reference.png','pet-settings.cjs','pet-physics.cjs','pet-whisper.cjs','pet-menu.cjs']) {
      const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      assert.equal(digest(path.join(archive,name)),digest(path.resolve(__dirname,'..',name)),'Outdated packaged file: '+name);
    }
    for (const name of ['reading.js','content.js','background.js','manifest.json']) {
      const source=fs.readFileSync(path.resolve(__dirname,'../extension',name));
      assert.deepEqual(fs.readFileSync(path.resolve(__dirname,'../release-v0.6/Kanshan-win32-x64/resources/extension',name)),source,'Outdated external plugin: '+name);
      assert.deepEqual(fs.readFileSync(path.join(archive,'extension',name)),source,'Outdated archived plugin: '+name);
    }
    const {runReadingAgent} = await import(pathToFileURL(path.join(archive,'agent.mjs')).href);
    const result = await runReadingAgent({prompt:'测试打包依赖',baseUrl:'https://model.example/v1',model:'test',apiKey:'synthetic-key',fetchImpl:async()=>modelResponse('打包后的 pi Agent 工作正常。')});
    assert.equal(result,'打包后的 pi Agent 工作正常。');
    console.log('PASS packaged ASAR: original pet, browser assets, production Pi modules, and streaming agent runtime.');
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
