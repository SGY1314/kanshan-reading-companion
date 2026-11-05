const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createReadingServer}=require('../reading-server.cjs');
const {modelResponse}=require('./fixtures.cjs');
function fixture(t,encrypt=s=>Buffer.from('new:'+s)){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kanshan-credentials-'));
 const original=Buffer.from('unreadable-old-encrypted-data');fs.writeFileSync(path.join(dir,'credentials.bin'),original);
 fs.writeFileSync(path.join(dir,'library.json'),JSON.stringify({clips:[{id:'c1',quote:'原有笔记保留',url:'https://www.zhihu.com/answer/123'}],settings:{baseUrl:'https://model.example/v1',model:'test'}}));
 const options={dir,encrypt,fetchImpl:async()=>modelResponse('重新配置后模型可以调用'),decrypt:b=>{if(!b.toString().startsWith('new:'))throw Error('safeStorage decryptString synthetic failure');return b.toString().slice(4);}};
 const service=createReadingServer(options);t.after(()=>{service.dispose();service.server.close();fs.rmSync(dir,{recursive:true,force:true});});return {dir,original,options,service};
}
test('unreadable credentials keep desktop state, notes and plugin authentication available',async t=>{
 const {dir,original,service}=fixture(t);await new Promise(r=>service.server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+service.server.address().port;
 const state=await fetch(origin+'/api/state',{headers:{Authorization:'Bearer '+service.token,Origin:'chrome-extension://'+'a'.repeat(32)}});assert.equal(state.status,200);const data=await state.json();assert.equal(data.config.credentialsUnavailable,true);assert.equal(data.config.aiConfigured,false);assert.equal(data.config.zhihuConfigured,false);assert.equal(data.clips[0].quote,'原有笔记保留');assert.ok(!JSON.stringify(data).includes('decryptString'));
 const launch=new URL(service.launchUrl());const login=await fetch(origin+'/api/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:new URLSearchParams(launch.hash.slice(1)).get('launch')})});const cookie=login.headers.get('set-cookie').split(';')[0];const paired=await fetch(origin+'/api/connection',{headers:{Cookie:cookie}});assert.equal(paired.status,200);assert.equal((await paired.json()).token,service.token);
 await service.route('POST','/api/config',{baseUrl:'https://model.example/v1',model:'test',aiKey:'',zhihuKey:''});assert.deepEqual(fs.readFileSync(path.join(dir,'credentials.bin')),original);assert.equal(fs.readdirSync(dir).filter(n=>n.startsWith('credentials.unreadable-')).length,0);
 await assert.rejects(()=>service.route('POST','/api/demo/test',{confirm:true}),/配置|保存/);
});
test('replacement backs up unreadable ciphertext and survives restart without losing notes',async t=>{
 const {dir,original,options,service}=fixture(t);
 const config=await service.route('POST','/api/config',{zhihuKey:'synthetic-zhihu',aiKey:'synthetic-ai'});assert.equal(config.credentialsUnavailable,false);assert.equal(config.zhihuConfigured,true);assert.equal(config.aiConfigured,true);assert.equal((await service.route('POST','/api/demo/test',{confirm:true})).answer,'重新配置后模型可以调用');
 const backups=fs.readdirSync(dir).filter(n=>n.startsWith('credentials.unreadable-'));assert.equal(backups.length,1);assert.deepEqual(fs.readFileSync(path.join(dir,backups[0])),original);
 const resumed=createReadingServer(options);t.after(()=>resumed.dispose());const state=await resumed.route('GET','/api/state');assert.equal(state.config.aiConfigured,true);assert.equal(state.clips.length,1);assert.ok(!JSON.stringify(state).includes('synthetic-ai'));assert.equal(state.config.baseUrl,'https://model.example/v1');
});
test('failed replacement encryption leaves the original credentials intact',async t=>{
 const {dir,original,service}=fixture(t,()=>{throw Error('synthetic encryption failure');});await assert.rejects(()=>service.route('POST','/api/config',{aiKey:'new-key'}),/原凭证保持不变/);assert.deepEqual(fs.readFileSync(path.join(dir,'credentials.bin')),original);assert.equal(fs.readdirSync(dir).filter(n=>n.startsWith('credentials.unreadable-')).length,0);
});
