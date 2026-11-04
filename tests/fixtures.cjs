function modelEvents(answer,finishReason='stop') {
  const chunk = (delta,finish_reason=null) => JSON.stringify({id:'local-test',object:'chat.completion.chunk',created:1,model:'test-model',choices:[{index:0,delta,finish_reason}]});
  return `data: ${chunk({role:'assistant',content:answer})}\n\ndata: ${chunk({},finishReason)}\n\ndata: [DONE]\n\n`;
}
const modelResponse = answer => new Response(modelEvents(answer),{headers:{'Content-Type':'text/event-stream'}});
const messageText = message => typeof message.content === 'string' ? message.content : message.content.filter(c=>c.type==='text').map(c=>c.text).join('');
module.exports = {modelEvents,modelResponse,messageText};
