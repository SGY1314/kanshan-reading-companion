const crypto = require('node:crypto');
const short = (value,max) => String(value || '').replace(/<[^>]*>/g,'').trim().slice(0,max);
function readingUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const answer = /^\/(?:question\/\d+\/)?answer\/(\d+)\/?$/.exec(url.pathname);
    if (['www.zhihu.com','zhihu.com'].includes(url.hostname) && answer) return 'https://www.zhihu.com/answer/'+answer[1];
    const post = /^\/p\/(\d+)\/?$/.exec(url.pathname);
    if (url.hostname === 'zhuanlan.zhihu.com' && post) return 'https://zhuanlan.zhihu.com/p/'+post[1];
  } catch {}
  return null;
}
function createReadingMemory({db,persist,now=Date.now}) {
  db.memory = {enabled:false,avoidSeen:true,preferences:'',records:[],excluded:[],sessions:{},...db.memory};
  const memory = db.memory;
  function prune() {
    const before=JSON.stringify([memory.records,memory.sessions]);
    const cutoff = now()-90*86400000;
    memory.records = memory.records.filter(r=>Date.parse(r.lastAt)>=cutoff).sort((a,b)=>Date.parse(b.lastAt)-Date.parse(a.lastAt)).slice(0,500);
    memory.sessions = Object.fromEntries(Object.entries(memory.sessions).filter(([,s])=>s.at>=now()-7*86400000).sort((a,b)=>b[1].at-a[1].at).slice(0,2000));
    if(before!==JSON.stringify([memory.records,memory.sessions]))persist();
  }
  prune();
  function state() { prune(); const {sessions,...publicState}=memory; return publicState; }
  function record(body) {
    if (!memory.enabled) return {recorded:false,reason:'paused'};
    const url = readingUrl(body.url);
    if (!url) throw Error('阅读记忆只记录知乎回答或文章的独立链接');
    if (memory.excluded.some(r=>r.url===url)) return {recorded:false,reason:'forgotten'};
    if (!['open','read'].includes(body.kind)) throw Error('无效阅读事件');
    const seconds = Math.floor(Number(body.activeSeconds));
    if (body.kind === 'read' && (!/^[a-zA-Z0-9-]{8,80}$/.test(String(body.sessionId || '')) || !Number.isFinite(seconds) || seconds<0 || seconds>86400)) throw Error('无效阅读时长或会话');
    prune();
    const stamp = new Date(now()).toISOString();
    let item = memory.records.find(r=>r.url===url);
    const previousSeconds = item?.activeSeconds || 0;
    let delta=0, newSession=false;
    if (body.kind === 'read') {
      const session = memory.sessions[body.sessionId];
      if (session && session.url!==url) throw Error('阅读会话来源不一致');
      if (session && seconds<=session.seconds) return {recorded:false,reason:'duplicate'};
      if (!session && seconds<1) return {recorded:false,reason:'empty'};
      delta=Math.min(60,Math.floor(seconds)-(session?.seconds || 0));
      newSession=!session;
      memory.sessions[body.sessionId]={url,seconds:Math.floor(seconds),at:now()};
    }
    if (!item) {
      item={id:crypto.randomUUID(),url,title:short(body.title,300),author:short(body.author,120),firstAt:stamp,lastAt:stamp,lastReadAt:null,opens:0,visits:0,activeSeconds:0};
      memory.records.unshift(item);
    }
    item.title=short(body.title,300) || item.title;
    item.author=short(body.author,120) || item.author;
    item.lastAt=stamp;
    if (body.kind==='open') item.opens++;
    else {item.visits+=Number(newSession);item.activeSeconds+=delta;item.lastReadAt=stamp;}
    prune();persist();
    return {recorded:true,signalChanged:body.kind==='read' && item.activeSeconds>=20 && (previousSeconds<20 || newSession),item};
  }
  function configure(body) {
    if (typeof body.enabled==='boolean') memory.enabled=body.enabled;
    if (typeof body.avoidSeen==='boolean') memory.avoidSeen=body.avoidSeen;
    if (typeof body.preferences==='string') memory.preferences=short(body.preferences,2000);
    persist();return state();
  }
  function forget(id) {
    const item = memory.records.find(r=>r.id===id);
    if (!item) throw Error('这条阅读记录已经移除');
    memory.excluded=[...memory.excluded.filter(r=>r.url!==item.url),{url:item.url,title:item.title}].slice(-500);
    memory.records=memory.records.filter(r=>r.id!==id);
    memory.sessions=Object.fromEntries(Object.entries(memory.sessions).filter(([,s])=>s.url!==item.url));
    persist();return state();
  }
  function restore(url) {memory.excluded=memory.excluded.filter(r=>r.url!==url);persist();return state();}
  function clear() {memory.enabled=false;memory.preferences='';memory.records=[];memory.excluded=[];memory.sessions={};persist();return state();}
  function seen(url) {const canonical=readingUrl(url);return memory.records.find(r=>r.url===canonical && r.activeSeconds>=20 && Date.parse(r.lastReadAt)>=now()-30*86400000);}
  return {state,record,configure,forget,restore,clear,seen};
}
module.exports = {createReadingMemory,readingUrl};
