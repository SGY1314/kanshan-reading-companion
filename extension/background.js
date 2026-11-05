const base='http://127.0.0.1:47840';
const routes=new Map([['/api/state','GET'],['/api/clips','POST'],['/api/clips/update','POST'],['/api/clips/delete','POST'],['/api/explain','POST'],['/api/memory/status','GET'],['/api/memory/visit','POST']]);
function source(sender){if(!sender.tab)return 'popup';try{const u=new URL(sender.tab.url);if(typeof chrome.runtime.getURL==='function'&&u.href===chrome.runtime.getURL('popup.html'))return 'popup';if(u.origin===base)return 'local';if(u.protocol==='https:'&&['www.zhihu.com','zhuanlan.zhihu.com'].includes(u.hostname))return 'zhihu';}catch{}return '';}
async function request(token,path,method='GET',body){
 if(!token)throw Error('还没有连接看山，请打开阅读伙伴网页自动连接。');
 let r;try{r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body||{}):undefined,signal:AbortSignal.timeout(70000)});}catch{throw Error('看山暂时没有响应。请启动桌宠后重试，批注草稿会保留。');}
 if(r.status===401||r.status===403)throw Error('连接已失效，请打开阅读伙伴网页自动恢复。');
 let data;try{data=await r.json();}catch{throw Error('返回内容无法读取，请重试。');}if(!r.ok)throw Error(data.error||'操作失败，请重试。');return data;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 const from=source(sender);if(!from||!message||typeof message!=='object'){reply({error:'不允许的插件请求'});return;}
 (async()=>{
  if(message.action==='CONNECT'&&['popup','local'].includes(from)){if(message.automatic&&(await chrome.storage.local.get('pairingPaused')).pairingPaused)throw Error('自动连接已暂停');const token=String(message.token||'').trim();if(!token||token.length>512)throw Error('连接信息无效，请刷新阅读伙伴网页');const state=await request(token,'/api/state');if(message.automatic&&(await chrome.storage.local.get('pairingPaused')).pairingPaused)throw Error('自动连接已暂停');await chrome.storage.local.set({token,pairingPaused:false});return {connected:true,clips:state.clips?.length||0};}
  if(message.action==='PAIR_STATUS'&&from==='local'){const {token}=await chrome.storage.local.get('token');const {pairingPaused}=await chrome.storage.local.get('pairingPaused');return {paired:!!token,paused:!!pairingPaused};}
  if(message.action==='DISCONNECT'&&from==='popup'){await chrome.storage.local.set({pairingPaused:true});await chrome.storage.local.remove('token');return {connected:false};}
  if(message.action==='OPEN_WORKBENCH'&&['popup','zhihu'].includes(from)){await chrome.storage.local.set({pairingPaused:false});await chrome.tabs.create({url:base+'/'});return {};}
  if(message.action==='STATUS'&&['popup','local'].includes(from)){const {token}=await chrome.storage.local.get('token');if(!token)return {connected:false};const state=await request(token,'/api/state');return {connected:true,clips:state.clips?.length||0};}
  if(message.action==='DRAFT'&&from==='zhihu'){
   const key='draft:'+sender.tab.url.split('#')[0];
   if(message.operation==='get')return (await chrome.storage.local.get(key))[key]||null;
   if(message.operation==='clear'){await chrome.storage.local.remove(key);return {};}
   if(message.operation!=='put')throw Error('未知草稿操作');
   const d=message.draft||{};let u;try{u=new URL(d.url);}catch{throw Error('摘录地址无效');}if(u.protocol!=='https:'||!['www.zhihu.com','zhuanlan.zhihu.com'].includes(u.hostname))throw Error('只保存知乎原文草稿');
   const clean={};for(const [field,limit]of Object.entries({quote:12000,note:4000,title:400,author:200,url:2000,context:24000,prefix:100,suffix:100,stance:30,problemId:200,kind:10,savedId:200}))clean[field]=String(d[field]||'').slice(0,limit);
   clean.updatedAt=Date.now();const all=await chrome.storage.local.get(null);const old=Object.entries(all).filter(([k])=>k.startsWith('draft:')&&k!==key).sort((a,b)=>(b[1].updatedAt||0)-(a[1].updatedAt||0)).slice(29).map(([k])=>k);if(old.length)await chrome.storage.local.remove(old);await chrome.storage.local.set({[key]:clean});return {};
  }
  if(from==='local'||routes.get(message.path)!==message.method)throw Error('不允许的插件请求');
  const {token}=await chrome.storage.local.get('token');return request(token,message.path,message.method,message.body);
 })().then(data=>reply({data})).catch(e=>reply({error:e.message}));return true;
});
