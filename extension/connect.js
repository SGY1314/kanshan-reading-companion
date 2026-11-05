(()=>{
 if(window.__kanshanExtensionBridge)return;
 window.__kanshanExtensionBridge=true;
 const origin='http://127.0.0.1:47840';
 if(location.origin!==origin)return;
 let busy=false,connected=false,state='connecting',retryTimer;
 const publish=next=>{state=next;window.postMessage({source:'kanshan-extension',action:'STATUS',state},origin);};
 const send=async message=>{const result=await chrome.runtime.sendMessage(message);if(result?.error)throw Error(result.error);return result?.data;};
 async function resume(manual=false){
  if(busy){publish(state);return;}
  busy=true;clearTimeout(retryTimer);
  try{
   const pairing=await send({action:'PAIR_STATUS'});
   if(pairing?.paused&&!manual){connected=false;publish('paused');return;}
   if(pairing?.paired&&!manual){try{const health=await send({action:'STATUS'});if(health?.connected){connected=true;publish('connected');return;}}catch{}connected=false;}
   publish('connecting');
   const response=await fetch('/api/connection',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('等待阅读伙伴就绪');
   const {token}=await response.json();
   const result=await send({action:'CONNECT',token,automatic:!manual});
   if(!result?.connected)throw Error('连接未完成');
   connected=true;publish('connected');
  }catch{
   connected=false;
   try{if((await send({action:'PAIR_STATUS'}))?.paused){publish('paused');return;}}catch{}
   publish('waiting');retryTimer=setTimeout(()=>void resume(),1500);
  }finally{busy=false;}
 }
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==origin)return;
  const message=event.data;
  if(message?.source!=='kanshan-reading-page')return;
  if(message.action==='STATUS'){publish(state);if(!connected)void resume();}
  if(message.action==='CONNECT')void resume(true);
 });
 window.addEventListener('focus',()=>void resume());
 const timer=setInterval(()=>void resume(),10000);
 window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(retryTimer);},{once:true});
 void resume();
})();
