const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {createReadingMemory,readingUrl}=require('../memory.cjs');
const {createReadingTracker}=require('../extension/reading.js');
const {createInterestLearning}=require('../interests.cjs');
test('memory opt-in, canonical links, cumulative deduplication, forgetting and retention',()=>{
  let clock=Date.now(),writes=0;const db={};
  const m=createReadingMemory({db,persist:()=>writes++,now:()=>clock});
  const event={url:'https://www.zhihu.com/question/12/answer/34?source=test',title:'阅读方法',kind:'read',sessionId:'session-12345',activeSeconds:20};
  assert.equal(m.record(event).reason,'paused');m.configure({enabled:true});
  assert.equal(readingUrl(event.url),'https://www.zhihu.com/answer/34');assert.equal(readingUrl('https://www.zhihu.com/search?q=test'),null);
  assert.throws(()=>m.record({...event,url:'https://evil.example/p/1'}),/独立链接/);
  const first=m.record(event);assert.equal(first.signalChanged,true);assert.equal(m.record(event).reason,'duplicate');
  m.record({...event,activeSeconds:25});m.record({...event,kind:'open'});
  assert.equal(m.state().records[0].activeSeconds,25);assert.equal(m.state().records[0].visits,1);assert.equal(m.state().records[0].opens,1);
  assert.ok(m.seen(event.url));assert.ok(!('sessions' in m.state()));
  m.configure({enabled:false});assert.equal(m.record({...event,activeSeconds:40}).reason,'paused');
  m.configure({enabled:true});m.forget(first.item.id);assert.equal(m.record(event).reason,'forgotten');assert.equal(m.seen(event.url),undefined);
  m.restore(first.item.url);m.record(event);assert.equal(m.state().records.length,1);
  clock+=91*86400000;assert.equal(m.state().records.length,0);assert.ok(writes>5);
  m.configure({preferences:'每天十分钟'});m.clear();assert.equal(m.state().enabled,false);assert.equal(m.state().preferences,'');
});
test('tracker counts foreground reading, skips background time and unrelated pages, and obeys pause',async()=>{
  const dom=new JSDOM('<h1>阅读方法</h1><article>正文</article>',{url:'https://www.zhihu.com/question/12/answer/34'});
  let clock=100000,visible='visible',focused=true,enabled=true;const events=[];
  Object.defineProperty(dom.window.document,'visibilityState',{get:()=>visible});dom.window.document.hasFocus=()=>focused;
  const location={href:dom.window.location.href};
  const tracker=createReadingTracker({document:dom.window.document,location,now:()=>clock,makeId:()=> 'session-12345',send:async(method,path,body)=>{
    if(path==='/api/memory/status')return{enabled};events.push(body);return{recorded:true};
  }});
  await tracker.tick();clock+=5000;await tracker.tick();assert.equal(events.at(-1).activeSeconds,5);
  visible='hidden';dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));clock+=60000;await tracker.tick();
  visible='visible';focused=true;dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));await tracker.tick();assert.equal(events.at(-1).activeSeconds,5);
  clock+=5000;await tracker.tick();assert.equal(events.at(-1).activeSeconds,10);
  focused=false;clock+=5000;await tracker.tick();assert.equal(events.at(-1).activeSeconds,10);
  focused=true;clock+=5000;await tracker.tick();clock+=5000;await tracker.tick();assert.equal(events.at(-1).activeSeconds,15);
  enabled=false;clock+=10000;await tracker.tick();const count=events.length;clock+=10000;await tracker.tick();assert.equal(events.length,count);
  enabled=true;location.href='https://www.zhihu.com/search?q=test';clock+=10000;await tracker.tick();clock+=5000;await tracker.tick();assert.equal(events.length,count);
  tracker.stop();dom.window.close();
});
test('read signals are neutral attention, not endorsement; forgotten evidence disappears',async t=>{
  const stamp=new Date().toISOString();const db={interests:[],clips:[],feedbackDetails:{},memory:{records:[1,2].map(i=>({id:String(i),url:'https://www.zhihu.com/answer/'+i,title:'阅读方法',activeSeconds:30,visits:1,lastReadAt:stamp})),preferences:'每天十分钟'}};
  let prompt;const learning=createInterestLearning({getDB:()=>db,persist:()=>{},isConfigured:()=>true,ai:async p=>{prompt=p;return JSON.stringify({topics:[{topic:'阅读方法',reason:'用户喜欢并赞同',confidence:.95,evidenceIds:['read:1','read:2']}]});}});t.after(()=>learning.dispose());
  await learning.refresh();const topic=db.learning.topics[0];assert.equal(topic.basis,'attention');assert.equal(topic.horizon,'recent');assert.ok(topic.reason.includes('不代表喜欢或赞同'));assert.equal(topic.confidence,.7);assert.ok(learning.effective()[0].weight<.5);
  assert.ok(!prompt.includes('https://'));assert.ok(prompt.includes('每天十分钟'));
  db.memory.records.pop();learning.schedule();assert.equal(db.learning.topics.length,0);
  db.memory.records[0].activeSeconds=0;await assert.rejects(()=>learning.refresh(),/两篇/);
});
test('changing memory during an analysis invalidates the in-flight result',async t=>{
  const stamp=new Date().toISOString();const db={interests:[],clips:[],feedbackDetails:{},memory:{records:[1,2].map(i=>({id:String(i),url:'https://www.zhihu.com/answer/'+i,title:'阅读方法',activeSeconds:20,visits:1,lastReadAt:stamp}))}};
  let resolve;const learning=createInterestLearning({getDB:()=>db,persist:()=>{},isConfigured:()=>true,ai:()=>new Promise(r=>resolve=r)});t.after(()=>learning.dispose());
  const pending=learning.refresh();learning.schedule();resolve(JSON.stringify({topics:[{topic:'阅读方法',reason:'阅读过',confidence:.8,evidenceIds:['read:1','read:2']}]}));assert.equal((await pending).cancelled,true);assert.equal(db.learning.topics.length,0);
});
test('sustained interest needs positive sources across days; reading alone cannot establish it',async t=>{
 const clock=Date.now();const db={interests:[],feedbackDetails:{},clips:[0,1,2].map((i)=>({id:String(i),url:'https://www.zhihu.com/answer/'+i,title:'阅读方法',quote:'拆小练习',note:'试试看',stance:'值得尝试',kind:'划线',createdAt:new Date(clock-i*4*86400000).toISOString()}))};
 const learning=createInterestLearning({getDB:()=>db,now:()=>clock,persist:()=>{},isConfigured:()=>true,ai:async()=>JSON.stringify({topics:[{topic:'阅读方法',reason:'持续正向摘录',confidence:.8,evidenceIds:['clip:0','clip:1','clip:2']} ]})});t.after(()=>learning.dispose());
 await learning.refresh();assert.equal(db.learning.topics[0].horizon,'longTerm');
 db.clips[2].stance='我有疑问';learning.schedule();assert.equal(db.learning.topics[0].horizon,'recent');assert.equal(db.learning.topics[0].basis,'interest');
});
test('record cap and expired sessions are enforced on startup',()=>{
 const clock=Date.now();const db={memory:{records:Array.from({length:505},(_,i)=>({id:String(i),url:'https://www.zhihu.com/answer/'+i,lastAt:new Date(clock-i*1000).toISOString()})),sessions:{old:{url:'x',at:clock-8*86400000,seconds:10}}}};
 let saved=0;const memory=createReadingMemory({db,now:()=>clock,persist:()=>saved++});assert.equal(memory.state().records.length,500);assert.equal(Object.keys(db.memory.sessions).length,0);assert.equal(saved,1);
});
