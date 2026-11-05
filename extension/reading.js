function createReadingTracker({document,location,send,now=Date.now,makeId=()=>crypto.randomUUID()}) {
  let current=null,enabled=false,busy=false,last=now(),lastConfig=0,stopped=false,dirty=false,wasEligible=false;
  function article() {
    const url=new URL(location.href);
    const answer=/^\/(?:question\/\d+\/)?answer\/(\d+)\/?$/.exec(url.pathname);
    const post=/^\/p\/(\d+)\/?$/.exec(url.pathname);
    if (url.protocol!=='https:' || !((url.hostname==='www.zhihu.com' && answer)||(url.hostname==='zhuanlan.zhihu.com' && post))) return null;
    if (!document.querySelector('.RichText,.Post-RichTextContainer,article')) return null;
    return {url:answer?'https://www.zhihu.com/answer/'+answer[1]:'https://zhuanlan.zhihu.com/p/'+post[1],title:(document.querySelector('h1')?.textContent || document.title).slice(0,300),author:(document.querySelector('.AuthorInfo-name')?.textContent || '').slice(0,120)};
  }
  function accrue() {
    const instant=now(),elapsed=Math.max(0,Math.min(5,(instant-last)/1000));last=instant;
    const eligible=enabled && document.visibilityState==='visible' && document.hasFocus();
    const count=wasEligible && eligible;wasEligible=eligible;
    const page=article();
    if (!page) {current=null;return;}
    if (!current || current.url!==page.url) {current={...page,sessionId:makeId(),activeSeconds:0,sent:0};return;}
    Object.assign(current,page);
    if (count) {current.activeSeconds+=elapsed;dirty=true;}
  }
  async function flush() {
    if (stopped || busy || !enabled || !current || !dirty || Math.floor(current.activeSeconds)<=current.sent) return;
    const snapshot={...current};busy=true;
    try {
      const result=await send('POST','/api/memory/visit',{...snapshot,kind:'read',activeSeconds:Math.floor(snapshot.activeSeconds)});
      if (current?.sessionId===snapshot.sessionId) {current.sent=Math.floor(snapshot.activeSeconds);dirty=current.activeSeconds>current.sent;}
      if (result.reason==='paused') enabled=false;
    } catch {} finally {busy=false;}
  }
  async function tick() {
    if (stopped) return;
    if (!lastConfig || now()-lastConfig>=10000) {
      lastConfig=now();
      try {const config=await send('GET','/api/memory/status');if(enabled!==config.enabled){last=now();wasEligible=false;}enabled=config.enabled;} catch {enabled=false;}
    }
    accrue();await flush();
  }
  function boundary() {accrue();last=now();void flush();}
  document.addEventListener('visibilitychange',boundary);
  document.defaultView?.addEventListener('blur',boundary);
  document.defaultView?.addEventListener('focus',()=>{last=now();});
  return {tick,stop(){stopped=true;document.removeEventListener('visibilitychange',boundary);document.defaultView?.removeEventListener('blur',boundary);},get enabled(){return enabled;}};
}
if (typeof module!=='undefined' && module.exports) module.exports={createReadingTracker};
else {
  const tracker=createReadingTracker({document,location,send:async(method,path,body)=>{
    const result=await chrome.runtime.sendMessage({method,path,body});
    if (!result || result.error) throw Error(result?.error || '看山未连接');
    return result.data;
  }});
  void tracker.tick();
  setInterval(()=>void tracker.tick(),5000);
}
