const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createInterestLearning}=require('../interests.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check){for(let i=0;i<150;i++){if(check())return;await sleep(5);}throw Error('Interest analysis timed out');}
function fixture(t,extra={}){
 const db={interests:['阅读'],clips:[],feedbackDetails:{}};let calls=0;
 const ai=async prompt=>{calls++;assert.ok(!prompt.includes('https://'));return JSON.stringify({topics:[{topic:'学习习惯',reason:'两篇资料都关注小步练习',confidence:.8,evidenceIds:db.clips.slice(0,2).map(c=>'clip:'+c.id)}]});};
 const controller=createInterestLearning({getDB:()=>db,ai,persist:()=>{},isConfigured:()=>true,debounceMs:3,cooldownMs:60,...extra});
 t.after(()=>controller.dispose());
 const add=(id,url='https://www.zhihu.com/answer/'+id,stance='值得尝试')=>db.clips.push({id,url,title:'学习习惯',quote:'a'.repeat(600),note:'b'.repeat(600),stance,kind:'划线',createdAt:new Date().toISOString()});
 return{db,controller,add,calls:()=>calls};
}
test('manual learning is grounded, bounded, independent of fixed interests and used in ranking',async t=>{
 const f=fixture(t);f.add('1');f.add('2');const preview=f.controller.preview();assert.equal(preview.signals[0].quote.length,160);assert.equal(preview.signals[0].note.length,200);assert.ok(!JSON.stringify(preview).includes('https://'));
 await f.controller.refresh();assert.deepEqual(f.db.interests,['阅读']);assert.equal(f.db.learning.topics[0].topic,'学习习惯');assert.ok(f.controller.effective().some(t=>t.topic==='学习习惯'&&t.source==='ai'));
 f.controller.control('pin','学习习惯');assert.deepEqual(f.db.interests,['阅读','学习习惯']);assert.equal(f.db.learning.topics.length,0);
});
test('one article, duplicate selections and negative stances cannot establish a topic',async t=>{
 const f=fixture(t);f.add('1');f.add('2','https://www.zhihu.com/answer/1?utm_source=another');await assert.rejects(()=>f.controller.refresh(),/两篇/);assert.equal(f.calls(),0);
 f.db.clips[1].url='https://www.zhihu.com/answer/2';f.db.clips[1].stance='不适合我';await assert.rejects(()=>f.controller.refresh(),/两篇/);assert.equal(f.calls(),0);
});
test('automatic analysis is opt-in, batches three actions and observes cooldown',async t=>{
 const f=fixture(t);f.add('1');f.add('2');f.controller.schedule();f.controller.schedule();f.controller.schedule();await sleep(10);assert.equal(f.calls(),0);
 f.controller.setEnabled(true);await until(()=>f.calls()===1&&!f.controller.busy);f.controller.schedule();f.controller.schedule();f.controller.schedule();await sleep(10);assert.equal(f.calls(),1);await until(()=>f.calls()===2&&!f.controller.busy);
 f.controller.setEnabled(false);f.controller.schedule();f.controller.schedule();f.controller.schedule();await sleep(70);assert.equal(f.calls(),2);
});
test('dismissal is remembered, malformed data preserves profile, removed evidence is pruned',async t=>{
 let bad=false;let f;
 f=fixture(t,{ai:async()=>bad?'not JSON':JSON.stringify({topics:[{topic:'学习习惯',reason:'重复阅读练习资料',confidence:.8,evidenceIds:['clip:1','clip:2']}]})});f.add('1');f.add('2');await f.controller.refresh();bad=true;await assert.rejects(()=>f.controller.refresh(),/有效兴趣数据/);assert.equal(f.db.learning.topics.length,1);
 bad=false;f.controller.control('dismiss','学习习惯');assert.ok(f.db.learning.blocked.includes('学习习惯'));await assert.rejects(()=>f.controller.refresh(),/缺少有效依据/);assert.equal(f.db.learning.topics.length,0);
 f.controller.control('reset');await f.controller.refresh();f.db.clips.pop();f.controller.schedule();assert.equal(f.db.learning.topics.length,0);
});
test('turning off learning while a request runs discards its result',async t=>{
 let resolve;const f=fixture(t,{ai:()=>new Promise(r=>resolve=r)});f.add('1');f.add('2');f.controller.setEnabled(true);const pending=f.controller.refresh({automatic:true});await until(()=>!!resolve);f.controller.setEnabled(false);resolve(JSON.stringify({topics:[{topic:'学习习惯',reason:'资料支持',confidence:.8,evidenceIds:['clip:1','clip:2']}]}));const r=await pending;assert.equal(r.cancelled,true);assert.deepEqual(f.db.learning.topics,[]);
});
test('old topics lose weight and expiry excludes old evidence',async t=>{
 let clock=Date.now();const f=fixture(t,{now:()=>clock});f.add('1');f.add('2');await f.controller.refresh();const weight=f.controller.effective().find(t=>t.source==='ai').weight;clock+=15*86400000;assert.ok(f.controller.effective().find(t=>t.source==='ai').weight<weight);clock+=16*86400000;assert.equal(f.controller.effective().filter(t=>t.source==='ai').length,0);
});
