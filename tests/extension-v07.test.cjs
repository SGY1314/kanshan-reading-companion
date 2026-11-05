const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {createReadingServer}=require('../reading-server.cjs');
const file=name=>fs.readFileSync(path.join(__dirname,'../extension',name),'utf8');
const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('等待插件响应超时');};
function background(fetchImpl,initial={}){
 const data={...initial};let handle;
 const chrome={storage:{local:{get:async key=>key===null?{...data}:{[key]:data[key]},set:async value=>Object.assign(data,value),remove:async keys=>{for(const key of [].concat(keys))delete data[key];}}},tabs:{create:async value=>value},runtime:{getURL:name=>'chrome-extension://'+'a'.repeat(32)+'/'+name,onMessage:{addListener:fn=>handle=fn}}};
 vm.runInNewContext(file('background.js'),{chrome,fetch:fetchImpl,URL,AbortSignal,Error,Set,Map,JSON,Date});
 return {data,send:(message,sender={})=>new Promise(resolve=>handle(message,sender,resolve))};
}
function page(bg,hash=''){
 const dom=new JSDOM('<h1>怎样轻松学习</h1><div class="AnswerItem" data-zop=\'{"itemId":"123","authorName":"作者"}\'><div class="RichText"><p>先留一点时间，每天只读一页，然后慢慢来。</p></div></div>',{url:'https://www.zhihu.com/answer/123'+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,attach=w.Element.prototype.attachShadow;let shadow;
 w.Element.prototype.attachShadow=function(options){shadow=attach.call(this,options);return shadow;};
 w.chrome={runtime:{sendMessage:m=>bg.send(m,{tab:{url:w.location.href}}),onMessage:{addListener:()=>{}}}};w.CSS={highlights:new Map()};w.Highlight=class{constructor(...ranges){this.ranges=ranges;}};w.Range.prototype.getBoundingClientRect=()=>({left:30,bottom:100});w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.eval(file('content.js'));
 return {w,close:()=>w.close(),get shadow(){return shadow;},async select(index=0){const text=w.document.querySelector('.RichText p').firstChild,range=w.document.createRange();range.selectNodeContents(text);w.getSelection().removeAllRanges();w.getSelection().addRange(range);w.document.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true}));await wait(()=>shadow.querySelector('.bar'));shadow.querySelectorAll('.bar button')[index].click();await wait(()=>index===1?shadow.querySelector('.save-toast')?.textContent.includes('已收好'):shadow.querySelector('#ks-note'));}};
}
test('v07 verifies pairing before storing and saves through the complete desktop server',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kanshan-v07-'));const app=createReadingServer({dir,encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>{app.dispose();app.server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+app.server.address().port;
 const bg=background((url,options)=>fetch(String(url).replace('http://127.0.0.1:47840',origin),options),{token:app.token});
 assert.ok((await bg.send({action:'CONNECT',token:'invalid'})).error);assert.equal(bg.data.token,app.token);
 assert.ok((await bg.send({action:'CONNECT',token:app.token},{tab:{url:'https://www.zhihu.com/answer/123'}})).error);
 assert.ok((await bg.send({method:'GET',path:'/api/state'},{tab:{url:'https://evil.example/'}})).error);
 assert.ok((await bg.send({method:'POST',path:'/api/config',body:{}},{tab:{url:'https://www.zhihu.com/answer/123'}})).error);
 assert.equal((await bg.send({action:'CONNECT',token:app.token},{tab:{url:'http://127.0.0.1:47840/'}})).data.connected,true);
 const synced=await app.route('POST','/api/demo/sync',{questions:[{id:'q1',title:'忙碌时怎么学习',context:'希望轻松一点'}]});
 const p=page(bg);t.after(p.close);await p.select(0);const note=p.shadow.querySelector('#ks-note');note.value='试着读一页';note.dispatchEvent(new p.w.Event('input'));p.shadow.querySelector('#ks-problem').value=synced.problems[0].id;p.shadow.querySelector('#ks-save').click();await wait(()=>p.shadow.querySelector('#ks-save').textContent==='已收好');
 const state=await app.route('GET','/api/state');assert.equal(state.clips.length,1);assert.equal(state.clips[0].kind,'划线');assert.equal(state.clips[0].note,'试着读一页');assert.equal(state.clips[0].problemId,synced.problems[0].id);
 assert.equal(Object.keys(bg.data).filter(k=>k.startsWith('draft:')).length,0);
});
test('v07 keeps offline notes across reload and retries explanation without saving twice',async t=>{
 let online=false,saves=0,explanations=0;const clips=[];
 const bg=background(async(url,options)=>{
  if(!online)throw Error('offline');const pathname=new URL(url).pathname;
  if(pathname==='/api/state')return {ok:true,json:async()=>({clips,problems:[]})};
  if(pathname==='/api/clips'){saves++;const clip={...JSON.parse(options.body),id:'c1'};clips.push(clip);return {ok:true,json:async()=>clip};}
  if(pathname==='/api/explain'){explanations++;return explanations===1?{ok:false,json:async()=>({error:'模型暂不可用'})}:{ok:true,json:async()=>({answer:'今天先读一页就好。'})};}
  throw Error('unexpected');
 },{token:'synthetic-token'});
 const first=page(bg);await first.select(2);first.shadow.querySelector('#ks-note').value='希望轻松一点';first.shadow.querySelector('#ks-note').dispatchEvent(new first.w.Event('input'));first.shadow.querySelector('#ks-close').click();await wait(()=>Object.keys(bg.data).some(k=>k.startsWith('draft:')));first.close();
 const second=page(bg);t.after(second.close);await wait(()=>second.shadow.querySelector('.badge').textContent.includes('未完成'));second.shadow.querySelector('.badge').click();await wait(()=>second.shadow.querySelector('#ks-note'));assert.equal(second.shadow.querySelector('#ks-note').value,'希望轻松一点');online=true;second.shadow.querySelector('#ks-save').click();await wait(()=>second.shadow.querySelector('#ks-status').textContent.includes('模型暂不可用'));assert.equal(saves,1);
 second.shadow.querySelector('#ks-close').click();await wait(()=>Object.values(bg.data).some(d=>d?.savedId==='c1'));
 const third=page(bg);t.after(third.close);await wait(()=>third.shadow.querySelector('.badge').textContent.includes('未完成'));third.shadow.querySelector('.badge').click();await wait(()=>third.shadow.querySelector('#ks-save'));third.shadow.querySelector('#ks-save').click();await wait(()=>third.shadow.querySelector('#ks-answer').textContent.includes('读一页'));assert.equal(saves,1);assert.equal(explanations,2);assert.equal(Object.keys(bg.data).filter(k=>k.startsWith('draft:')).length,0);
});

test('v08 quick quote defaults to the question in its link and supports undo without opening a panel',async t=>{
 let clips=[],saved=0;const bg=background(async(url,options)=>{const pathname=new URL(url).pathname;
 if(pathname==='/api/state')return {ok:true,json:async()=>({clips,problems:[{id:'p1',title:'轻松学习'}]})};
 if(pathname==='/api/clips'){saved++;const clip={...JSON.parse(options.body),id:'quick1'};clips.push(clip);return {ok:true,json:async()=>clip};}
 if(pathname==='/api/clips/delete'){clips=[];return {ok:true,json:async()=>({ok:true})};}
 throw Error('unexpected');},{token:'synthetic'});
 const p=page(bg,'#kanshan-problem=p1');t.after(p.close);await p.select(1);assert.equal(saved,1);assert.equal(clips[0].kind,'金句');assert.equal(clips[0].problemId,'p1');assert.equal(p.shadow.querySelector('.panel'),null);p.shadow.querySelector('.save-toast button').click();await wait(()=>clips.length===0);
 await p.select(0);assert.equal(p.shadow.querySelector('#ks-problem').value,'p1');p.shadow.querySelector('#ks-problem').value='';p.shadow.querySelector('#ks-problem').dispatchEvent(new p.w.Event('change'));p.w.dispatchEvent(new p.w.Event('focus'));await new Promise(r=>setTimeout(r,50));assert.equal(p.shadow.querySelector('#ks-problem').value,'');
});
test('v08 restores an existing pairing on the local page and respects explicit disconnect',async t=>{
 const bg=background(async(url,options)=>({ok:options.headers.Authorization==='Bearer renewed',status:options.headers.Authorization==='Bearer renewed'?200:401,json:async()=>({clips:[],problems:[]})}),{token:'expired'});
 const dom=new JSDOM('<body></body>',{url:'http://127.0.0.1:47840/',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;let tick,fetches=0;
 w.AbortSignal=AbortSignal;w.setInterval=fn=>{tick=fn;};w.chrome={runtime:{sendMessage:m=>bg.send(m,{tab:{url:w.location.href}})}};w.fetch=async()=>{fetches++;return {ok:true,json:async()=>({token:'renewed'})};};
 w.eval(file('connect.js'));await wait(()=>bg.data.token==='renewed');assert.equal(fetches,1);
 await bg.send({action:'DISCONNECT'});await tick();assert.equal(bg.data.token,undefined);assert.equal(fetches,1);
});

function localBridge(bg,fetchImpl){
 const dom=new JSDOM('<body></body>',{url:'http://127.0.0.1:47840/',runScripts:'outside-only'});
 const w=dom.window,messages=[];let tick,retry;
 w.AbortSignal=AbortSignal;w.setInterval=fn=>{tick=fn;};w.setTimeout=fn=>{retry=fn;};
 w.postMessage=(data,target)=>{assert.equal(target,w.location.origin);messages.push(data);};
 w.chrome={runtime:{sendMessage:m=>bg.send(m,{tab:{url:w.location.href}})}};w.fetch=fetchImpl;
 w.eval(file('connect.js'));
 return {w,messages,tick:()=>tick(),retry:()=>retry(),close:()=>w.close(),manual(origin=w.location.origin,source=w){w.dispatchEvent(new w.MessageEvent('message',{origin,source,data:{source:'kanshan-reading-page',action:'CONNECT'}}));}};
}

test('v09 first install automatically pairs through the authenticated reading page without exposing its token',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kanshan-auto-pair-'));
 const app=createReadingServer({dir,encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>{app.dispose();app.server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+app.server.address().port;
 const {code}=await (await fetch(origin+'/api/demo-launch')).json();
 const session=await fetch(origin+'/api/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code})});
 const cookie=session.headers.get('set-cookie').split(';')[0];
 const bg=background((url,options)=>fetch(String(url).replace('http://127.0.0.1:47840',origin),options));
 const bridge=localBridge(bg,(url,options)=>{assert.equal(url,'/api/connection');assert.equal(options.credentials,'same-origin');return fetch(origin+url,{...options,headers:{Cookie:cookie}});});t.after(bridge.close);
 await wait(()=>bridge.messages.some(m=>m.state==='connected'));
 assert.equal(bg.data.token,app.token);assert.equal(bg.data.pairingPaused,false);
 assert.ok(!JSON.stringify(bridge.messages).includes(app.token));
 assert.equal(bridge.w.document.getElementById('kanshan-extension-connect'),null);
 assert.equal((await fetch(origin+'/api/state')).status,401);
});

test('v09 waits for the page session and retries without storing an unverified connection',async t=>{
 let ready=false,fetches=0;
 const bg=background(async(url,options)=>({ok:options.headers.Authorization==='Bearer verified',status:200,json:async()=>({clips:[]})}));
 const bridge=localBridge(bg,async()=>{fetches++;return ready?{ok:true,json:async()=>({token:'verified'})}:{ok:false,status:401};});t.after(bridge.close);
 await wait(()=>bridge.messages.some(m=>m.state==='waiting'));
 assert.equal(bg.data.token,undefined);ready=true;bridge.retry();
 await wait(()=>bg.data.token==='verified');assert.equal(fetches,2);
});

test('v09 respects explicit disconnect and only resumes from a trusted local request',async t=>{
 let fetches=0;
 const bg=background(async()=>({ok:true,json:async()=>({clips:[]})}),{pairingPaused:true});
 const bridge=localBridge(bg,async()=>{fetches++;return {ok:true,json:async()=>({token:'resumed'})};});t.after(bridge.close);
 await wait(()=>bridge.messages.some(m=>m.state==='paused'));assert.equal(fetches,0);
 bridge.manual('https://evil.example');bridge.manual(bridge.w.location.origin,null);
 await new Promise(r=>setTimeout(r,30));assert.equal(fetches,0);
 bridge.manual();await wait(()=>bg.data.token==='resumed');assert.equal(bg.data.pairingPaused,false);
 await bg.send({action:'DISCONNECT'});bridge.tick();await wait(()=>bridge.messages.at(-1)?.state==='paused');
 assert.equal(bg.data.token,undefined);assert.equal(fetches,1);
});

test('v09 a disconnect during verification prevents automatic pairing from being committed',async()=>{
 let finish;
 const bg=background(()=>new Promise(resolve=>{finish=resolve;}));
 const pairing=bg.send({action:'CONNECT',token:'pending',automatic:true},{tab:{url:'http://127.0.0.1:47840/'}});
 await wait(()=>!!finish);await bg.send({action:'DISCONNECT'});
 finish({ok:true,json:async()=>({clips:[]})});
 assert.ok((await pairing).error);assert.equal(bg.data.token,undefined);assert.equal(bg.data.pairingPaused,true);
});

test('v09 recognizes its own popup tab but rejects another extension page',async()=>{
 const bg=background(async()=>({ok:true,json:async()=>({clips:[]})}),{token:'verified'});
 const own={tab:{url:'chrome-extension://'+'a'.repeat(32)+'/popup.html'}};
 const other={tab:{url:'chrome-extension://'+'b'.repeat(32)+'/popup.html'}};
 assert.equal((await bg.send({action:'STATUS'},own)).data.connected,true);
 assert.ok((await bg.send({action:'STATUS'},other)).error);
});

test('v09 restores a saved connection after service recovery without a fresh page session',async t=>{
 let online=true,pageFetches=0;
 const bg=background(async()=>{if(!online)throw Error('offline');return {ok:true,json:async()=>({clips:[]})};},{token:'retained'});
 const bridge=localBridge(bg,async()=>{pageFetches++;throw Error('page session expired');});t.after(bridge.close);
 await wait(()=>bridge.messages.at(-1)?.state==='connected');assert.equal(pageFetches,0);
 online=false;bridge.tick();await wait(()=>bridge.messages.at(-1)?.state==='waiting');
 online=true;bridge.retry();await wait(()=>bridge.messages.at(-1)?.state==='connected');
 assert.equal(pageFetches,1);assert.equal(bg.data.token,'retained');
});
