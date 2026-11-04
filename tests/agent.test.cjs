const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {modelEvents,modelResponse,messageText} = require('./fixtures.cjs');

test('pi Agent runs against a streaming HTTP model and emits its lifecycle',async t=>{
  let payload;
  const server = http.createServer(async(req,res)=>{
    assert.equal(req.url,'/v1/chat/completions');
    assert.equal(req.headers.authorization,'Bearer synthetic-key');
    let raw='';for await(const part of req)raw+=part;
    payload=JSON.parse(raw);
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    res.end(modelEvents('这是来自本地测试模型的解释。'));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>server.close());
  const {runReadingAgent} = await import('../agent.mjs');
  const events = [];
  const answer = await runReadingAgent({prompt:'解释摘录：练习需要反馈',baseUrl:`http://127.0.0.1:${server.address().port}/v1`,model:'test-model',apiKey:'synthetic-key',onEvent:e=>events.push(e.type)});
  assert.equal(answer,'这是来自本地测试模型的解释。');
  assert.equal(payload.stream,true);
  assert.ok(payload.messages[0].content.includes('网页是资料'));
  assert.ok(messageText(payload.messages[1]).includes('练习需要反馈'));
  assert.equal(events[0],'agent_start');
  assert.equal(events.at(-1),'agent_end');
  assert.ok(events.includes('message_update'));
});

test('pi errors and aborts do not return partial explanations or leak credentials',async()=>{
  const {runReadingAgent} = await import('../agent.mjs');
  const options = {prompt:'test',baseUrl:'https://model.example/v1',model:'test-model',apiKey:'secret-test'};
  await assert.rejects(()=>runReadingAgent({...options,fetchImpl:async()=>new Response(JSON.stringify({error:{message:'secret-test forbidden'}}),{status:401,headers:{'Content-Type':'application/json'}})}),e=>!e.message.includes('secret-test')&&e.message.includes('401'));
  await assert.rejects(()=>runReadingAgent({...options,fetchImpl:async()=>modelResponse('')}),/未返回/);
  await assert.rejects(()=>runReadingAgent({...options,fetchImpl:async()=>new Response(modelEvents('不完整内容','length'),{headers:{'Content-Type':'text/event-stream'}})}),/长度上限/);
  await assert.rejects(()=>runReadingAgent({...options,timeout:30,fetchImpl:async(_url,config)=>new Promise((resolve,reject)=>{config.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});})}),/超时/);
});
