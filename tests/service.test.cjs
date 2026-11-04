const {modelResponse,messageText} = require('./fixtures.cjs');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {createService} = require('../service.cjs');
function setup(t,fetchImpl){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kanshan-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return createService({dir,encrypt:s=>Buffer.from(s),decrypt:b=>b.toString(),fetchImpl});}
test('offline library persists, validates source, and preserves evidence after deletion',async t=>{
 const s=setup(t);const p=await s.route('POST','/api/problems',{title:'如何开始学习',context:'每天十分钟'});
 await assert.rejects(()=>s.route('POST','/api/clips',{quote:'test',url:'https://evil.example/'}),/知乎/);
 const c=await s.route('POST','/api/clips',{quote:'先从小任务开始',url:'https://www.zhihu.com/answer/123',problemId:p.id,note:'我想试试'});
 assert.equal(s.state().clips[0].id,c.id);
 await s.route('POST','/api/clips/update',{id:c.id,stance:'我有疑问',note:'需要验证'});
 assert.equal(s.state().clips[0].stance,'我有疑问');
 await assert.rejects(()=>s.route('POST','/api/plan',{problemId:p.id,clipIds:[]}),/至少/);
 await assert.rejects(()=>s.route('POST','/api/explain',{id:c.id}),/配置|填写/);
 assert.equal(c.quote,'先从小任务开始');
});
test('search contract, secret redaction and AI evidence/stance survive model request',async t=>{
 let payload;const s=setup(t,async(url,options)=>{
  if(String(url).includes('zhihu_search')){assert.equal(new URL(url).searchParams.get('Count'),'10');assert.equal(options.headers.Authorization,'Bearer zhihu-test');return {ok:true,json:async()=>({Code:0,Data:{Items:[{Title:'学习方法',AuthorName:'测试作者',ContentText:'<em>心理学</em>学习',Url:'https://www.zhihu.com/answer/123'},{Title:'bad',Url:'https://example.com'}]}})};}
  payload=JSON.parse(options.body);return modelResponse('今天试做一个小任务。资料不足，需要验证。');
 });
 await s.route('POST','/api/config',{zhihuKey:'zhihu-test',aiKey:'ai-test',baseUrl:'https://model.example/v1',model:'test-model',interests:['心理学']});
 assert.ok(!JSON.stringify(await s.route('GET','/api/state')).includes('zhihu-test'));
 const found=await s.route('POST','/api/search',{query:'学习'});assert.equal(found.results.length,1);assert.equal(found.results[0].summary,'心理学学习');
 await s.route('POST','/api/feedback',{url:found.results[0].url,title:'学习',value:'dislike'});assert.equal((await s.route('POST','/api/search',{query:'学习'})).results.length,0);
 const p=await s.route('POST','/api/problems',{title:'怎样学习'});
 const c=await s.route('POST','/api/clips',{quote:'需要长时间练习',url:'https://www.zhihu.com/answer/123',problemId:p.id,stance:'不适合我',note:'我只有十分钟'});
 const plan=await s.route('POST','/api/plan',{problemId:p.id,clipIds:[c.id]});
 assert.ok(messageText(payload.messages[1]).includes('不适合我'));assert.ok(messageText(payload.messages[1]).includes('我只有十分钟'));assert.equal(plan.evidence[0].ref,c.id.slice(0,8));
 await s.route('POST','/api/clips/delete',{id:c.id});assert.equal(p.plans[0].evidence[0].quote,'需要长时间练习');
 await s.route('POST','/api/config',{...s.configState(),clearAI:true});assert.equal(s.configState().aiConfigured,false);assert.equal(s.configState().zhihuConfigured,true);
});
test('loopback service rejects absent pairing token and hostile origin',async t=>{
 const s=setup(t);await new Promise(r=>s.server.listen(0,'127.0.0.1',r));t.after(()=>s.server.close());const port=s.server.address().port;
 const request=async headers=>{const r=await fetch(`http://127.0.0.1:${port}/api/state`,{headers:{Host:'127.0.0.1:47831',...headers}});return r;};
 assert.equal((await request({})).status,401);
 assert.equal((await request({Authorization:'Bearer '+s.token,Origin:'https://evil.example'})).status,403);
 const r=await request({Authorization:'Bearer '+s.token});assert.equal(r.status,200);assert.deepEqual((await r.json()).clips,[]);
});
test('library and pairing survive restart',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kanshan-persist-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const options={dir,encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()};const a=createService(options);await a.route('POST','/api/clips',{quote:'hello',url:'https://zhuanlan.zhihu.com/p/1'});const b=createService(options);assert.equal(b.state().clips.length,1);assert.equal(a.token,b.token);
});
test('remote failures are actionable and never fabricate content',async t=>{
 const s=setup(t,async()=>({ok:false,status:429}));await s.route('POST','/api/config',{zhihuKey:'test'});await assert.rejects(()=>s.route('POST','/api/search',{query:'test'}),/429/);
});
test('manual profile analysis requires confirmation and learned topics affect real search requests',async t=>{
 let prompt,query;
 const s=setup(t,async(url,options)=>{if(String(url).includes('zhihu_search')){query=new URL(url).searchParams.get('Query');return{ok:true,json:async()=>({Code:0,Data:{Items:[{Title:'学习习惯',ContentText:'学习习惯的小步练习',AuthorName:'作者',Url:'https://www.zhihu.com/answer/88'}]}})};}
 prompt=messageText(JSON.parse(options.body).messages[1]);const signals=JSON.parse(prompt.split('\n').at(-1)).signals;return modelResponse(JSON.stringify({topics:[{topic:'学习习惯',reason:'两篇资料都涉及练习',confidence:.8,evidenceIds:signals.map(s=>s.id)}]}));});
 t.after(()=>s.dispose());await s.route('POST','/api/config',{zhihuKey:'z',aiKey:'a',baseUrl:'https://model.example/v1',model:'m',interests:['阅读']});
 await s.route('POST','/api/clips',{title:'学习',quote:'先试十分钟',url:'https://www.zhihu.com/answer/1'});await s.route('POST','/api/clips',{title:'练习',quote:'小步练习',url:'https://www.zhihu.com/answer/2'});
 await assert.rejects(()=>s.route('POST','/api/interests/refresh',{}),/预览并确认/);await s.route('POST','/api/interests/refresh',{confirm:true});assert.ok(!prompt.includes('https://www.zhihu.com/'));
 const search=await s.route('POST','/api/search',{});assert.ok(query.includes('学习习惯'));assert.ok(search.results[0].reason.includes('阅读偏好'));
});
