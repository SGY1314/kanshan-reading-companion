const allowed = new Set(['/api/state','/api/clips','/api/explain']);
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!allowed.has(message.path)||!['GET','POST'].includes(message.method))return;
  if(sender.tab){try{const u=new URL(sender.tab.url);if(u.protocol!=='https:'||!['www.zhihu.com','zhuanlan.zhihu.com'].includes(u.hostname))return;}catch{return;}}
  (async()=>{
    const {token}=await chrome.storage.local.get('token');
    if(!token)throw new Error('请先点击浏览器工具栏的看山插件，粘贴桌宠连接码。');
    let r;try{r=await fetch('http://127.0.0.1:47831'+message.path,{method:message.method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:message.method==='POST'?JSON.stringify(message.body||{}):undefined,signal:AbortSignal.timeout(70000)});}catch{throw new Error('看山没有响应。请启动桌宠，再重试；未保存的文字仍在当前面板。');}
    const data=await r.json();if(!r.ok)throw new Error(data.error||'保存失败');reply({data});
  })().catch(e=>reply({error:e.message}));return true;
});
