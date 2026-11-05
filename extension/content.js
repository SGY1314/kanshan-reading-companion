(()=>{
if(document.getElementById('kanshan-reader-host'))return;
const host=document.createElement('div');host.id='kanshan-reader-host';host.style.cssText='position:fixed;z-index:2147483646;top:0;left:0;';document.documentElement.append(host);
const shadow=host.attachShadow({mode:'closed'});
const style=document.createElement('style');style.textContent=`:host{all:initial;font:13px/1.8 "Microsoft YaHei",sans-serif;color:#303626}*{box-sizing:border-box}button,input,textarea,select{font:inherit}button{background:transparent;border:1px solid #c9ccbd;color:#303626;padding:7px 11px;cursor:pointer}button:hover{border-color:#717e53}button:disabled{opacity:.5}.bar{position:fixed;display:flex;gap:4px;padding:4px;background:#faf9f6;border:1px solid #c9ccbd;box-shadow:0 3px 14px #3036260c}.panel{position:fixed;right:18px;top:75px;width:min(390px,calc(100vw - 36px));max-height:calc(100vh - 95px);overflow:auto;padding:26px;color:#303626;background:#faf9f6;border:1px solid #c9ccbd;box-shadow:0 4px 20px #30362612}.top{display:flex;align-items:center;justify-content:space-between;gap:12px}.top b{font:20px SimSun,serif}.top button{border:0;font-size:20px}p{margin:12px 0;color:#646b58;font-size:12px;line-height:1.85}.quote{font:20px/1.9 SimSun,serif;color:#384534;margin:14px 0;padding:10px 13px;max-height:148px;overflow:auto;white-space:pre-wrap;line-height:1.95;border-left:2px solid #858f6a;background:#eeefe7}label{display:block;margin-top:14px;font-size:12px}textarea,select{display:block;width:100%;margin-top:6px;padding:9px 11px;color:#303626;background:transparent;border:1px solid #c9ccbd;outline:none}textarea:focus,select:focus{border-color:#717e53}textarea{min-height:82px;resize:vertical;line-height:1.8}.primary{width:100%;margin-top:16px;color:#fff;border-color:#303626;background:#303626}.status{font-size:12px;color:#535e42;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:12px}.answer{color:#434b39;white-space:pre-wrap;font-size:13px;margin-top:16px;line-height:1.95}.badge{position:fixed;right:20px;bottom:22px;padding:9px 15px;color:#303626;background:#faf9f6;border:1px solid #c9ccbd}.help{font-size:11px;line-height:1.8}`;shadow.append(style);
const root=document.createElement('div');shadow.append(root);
const badge=document.createElement('button');badge.className='badge';badge.textContent='山 · 阅读伙伴';shadow.append(badge);
const markStyle=document.createElement('style');markStyle.textContent='::highlight(kanshan-saved){background-color:rgba(140,155,100,.24);color:inherit}::highlight(kanshan-current){background-color:rgba(140,155,100,.38);color:inherit}';document.documentElement.append(markStyle);
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let draft=null, library=null, bar=null, highlights=[], lastLocation=location.href, timer;
async function call(method,path,body){let r;try{r=await chrome.runtime.sendMessage({method,path,body});}catch{throw new Error('插件连接已失效，请刷新页面并确认桌宠在运行。');}if(!r||r.error)throw new Error(r?.error||'无法连接桌宠');return r.data;}
async function draftMessage(operation,value){const r=await chrome.runtime.sendMessage({action:'DRAFT',operation,draft:value});if(r?.error)throw Error(r.error);return r?.data;}
let draftTimer;
let draftWrites=Promise.resolve();
function persistDraft(value){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{draftWrites=draftWrites.then(()=>draftMessage('put',value)).catch(()=>{});},160);}
function clearDraft(){clearTimeout(draftTimer);return draftWrites.then(()=>draftMessage('clear')).catch(()=>{});}
function currentProblem(){const id=new URLSearchParams(location.hash.slice(1)).get('kanshan-problem');return library?.problems?.some(p=>p.id===id)?id:'';}
let quickBusy=false,toastTimer;
const toast=document.createElement('div');toast.className='save-toast';toast.setAttribute('role','status');shadow.append(toast);
style.textContent+='.save-toast:empty{display:none}.save-toast{position:fixed;right:20px;bottom:78px;max-width:330px;padding:12px 16px;background:#faf9f6;border:1px solid #c9ccbd;color:#394332;box-shadow:0 4px 20px #30362612}.save-toast button{margin-left:12px;border:0;border-bottom:1px solid #a9af9d;padding:0 2px}';
async function quickSave(){
 if(quickBusy||!draft)return;quickBusy=true;bar?.remove();const active=draft;
 try{library=await call('GET','/api/state');const item=await call('POST','/api/clips',{...active,range:undefined,kind:'金句',note:'',stance:'值得尝试',problemId:currentProblem()});library.clips.unshift(item);restore();clearTimeout(toastTimer);toast.innerHTML='已收好这句金句<button>撤销</button>';toast.querySelector('button').onclick=async e=>{e.target.disabled=true;try{await call('POST','/api/clips/delete',{id:item.id});library.clips=library.clips.filter(c=>c.id!==item.id);restore();toast.textContent='已撤销保存';}catch(err){toast.textContent=err.message;}};toastTimer=setTimeout(()=>toast.replaceChildren(),7000);
 }catch(e){draft=active;await openEditor('金句');const status=root.querySelector('#ks-status');if(status)status.textContent=e.message;}finally{quickBusy=false;}
}
function showError(msg){root.innerHTML=`<section class="panel"><div class="top"><b>看山·阅读伙伴</b><button id="ks-close">×</button></div><p class="status">${esc(msg)}</p><p>点击浏览器工具栏里的看山插件，可检查连接。</p></section>`;root.querySelector('#ks-close').onclick=()=>root.replaceChildren();}
function selectionDraft(){
 const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
 const range=selection.getRangeAt(0).cloneRange();if(host.contains(range.commonAncestorContainer))return null;
 const node=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
 if(node.closest('input,textarea,[contenteditable="true"]'))return null;
 const container=node.closest('.RichText,.Post-RichTextContainer,article,.AnswerItem');if(!container)return null;
 if(!container.contains(range.startContainer)||!container.contains(range.endContainer))return null;
 const quote=range.toString();if(!quote.trim()||quote.length>12000)return null;
 const before=range.cloneRange();before.selectNodeContents(container);before.setEnd(range.startContainer,range.startOffset);
 const after=range.cloneRange();after.selectNodeContents(container);after.setStart(range.endContainer,range.endOffset);
 const answer=node.closest('.AnswerItem');let author=answer?.querySelector('.AuthorInfo-name')?.textContent||document.querySelector('.Post-Author .AuthorInfo-name')?.textContent||'';
 let url=location.href.split('#')[0];
 if(answer){try{const zop=JSON.parse(answer.getAttribute('data-zop')||'{}');if(zop.itemId)url='https://www.zhihu.com/answer/'+zop.itemId;if(zop.authorName)author=zop.authorName;}catch{}const canonical=answer.querySelector('meta[itemprop="url"]')?.content;if(canonical&&/^https:\/\/www\.zhihu\.com\//.test(canonical))url=canonical;}
 return {quote:quote.trim(),url,title:document.querySelector('h1')?.textContent||document.title,author,prefix:before.toString().slice(-80),suffix:after.toString().slice(0,80),context:before.toString().slice(-800)+quote+after.toString().slice(0,800),range};
}
function selectionChanged(e){if(e.composedPath().includes(host))return;setTimeout(()=>{const d=selectionDraft();bar?.remove();bar=null;if(!d||root.querySelector('#ks-note'))return;draft=d;const rect=d.range.getBoundingClientRect();bar=document.createElement('div');bar.className='bar';bar.style.left=Math.max(8,Math.min(rect.left,innerWidth-330))+'px';bar.style.top=Math.max(8,Math.min(rect.bottom+8,innerHeight-55))+'px';for(const [label,kind]of[['划线批注','划线'],['保存金句','金句'],['解释一下','解释']]){const b=document.createElement('button');b.textContent=label;b.onmousedown=e=>e.preventDefault();b.onclick=()=>kind==='金句'?quickSave():openEditor(kind);bar.append(b);}shadow.append(bar);},20);}
document.addEventListener('mouseup',selectionChanged);
document.addEventListener('keyup',e=>{if(e.key==='Escape'){bar?.remove();bar=null;}else if(e.key.startsWith('Arrow')||e.key==='Shift')selectionChanged(e);});
async function openEditor(kind){
 bar?.remove();if(!draft)return;const active=draft;kind=kind||active.kind||'划线';active.kind=kind;let connectionError='';root.innerHTML=`<section class="panel"><p>正在连接看山…</p></section>`;
 try{library=await call('GET','/api/state');}catch(e){connectionError=e.message;library={problems:[],clips:[]};}
 root.innerHTML=`<section class="panel"><div class="top"><b>${kind==='解释'?'一起读懂这段话':kind==='金句'?'收好这句喜欢的话':'给这段话留个想法'}</b><button id="ks-close">×</button></div><div class="quote">${esc(active.quote)}</div><p>${esc(active.author||'作者未识别')} · ${esc(active.title)}</p><label>我的批注<textarea id="ks-note" maxlength="4000" placeholder="我赞同什么？还有什么没想明白？"></textarea></label><label>我的态度<select id="ks-stance">${['值得尝试','解释了原因','我有疑问','不适合我'].map(s=>`<option>${s}</option>`).join('')}</select></label><label>加入问题<select id="ks-problem"><option value="">自由阅读 · 暂不关联问题</option>${library.problems.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('')}</select></label>${kind==='解释'?'<p class="help">点击下方按钮会先保存摘录，再将这段原文、前后各最多 800 字上下文、标题、批注与在阅读记忆中主动填写的目标和限制发送给你配置的模型。不会发送整页。</p>':'<p class="help">本次先保存到本机；如果已允许自动兴趣学习，有限摘录与批注也可能随分析发送给你配置的模型。</p>'}<button id="ks-save" class="primary">${kind==='解释'?'保存并发送给 AI 解释':'保存到看山的笔记'}</button><div id="ks-status" class="status" role="status"></div><div id="ks-answer" class="answer"></div></section>`;
 root.querySelector('#ks-close').setAttribute('aria-label','关闭并保留草稿');
 let completed=false;
 const note=root.querySelector('#ks-note'),stance=root.querySelector('#ks-stance'),problem=root.querySelector('#ks-problem'),status=root.querySelector('#ks-status');
 note.value=active.note||'';stance.value=active.stance||'值得尝试';problem.value=Object.prototype.hasOwnProperty.call(active,'problemId')?active.problemId:currentProblem();if(!problem.value)problem.value='';if(Object.prototype.hasOwnProperty.call(active,'problemId'))problem.dataset.userChosen='true';problem.addEventListener('change',()=>problem.dataset.userChosen='true');
 function snapshot(){active.note=note.value;active.stance=stance.value;active.problemId=problem.value;const {range,...value}=active;return value;}
 for(const field of [note,stance,problem])field.addEventListener('input',()=>persistDraft(snapshot()));
 root.querySelector('#ks-close').onclick=()=>{if(!completed)persistDraft(snapshot());root.replaceChildren();badge.textContent=completed?'山 · 阅读伙伴':'山 · 有一笔未完成';};
 status.textContent=connectionError||'写下你的想法，也可以只收好这段原文。';
 persistDraft(snapshot());
 if(active.savedId)root.querySelectorAll('textarea,select').forEach(x=>x.disabled=true);
 let saved=active.savedId?{id:active.savedId}:null;
 root.querySelector('#ks-save').onclick=async e=>{const b=e.target;b.disabled=true;root.querySelector('#ks-close').disabled=true;const status=root.querySelector('#ks-status');try{
  if(!saved){status.textContent='正在保存…';if(connectionError){const fresh=await call('GET','/api/state');if(active.problemId&&!fresh.problems.some(p=>p.id===active.problemId))throw Error('关联问题已不存在，请关闭面板重新选择。');}saved=await call('POST','/api/clips',{...active,range:undefined,kind:kind==='金句'?'金句':'划线',note:root.querySelector('#ks-note').value,stance:root.querySelector('#ks-stance').value,problemId:root.querySelector('#ks-problem').value});active.savedId=saved.id;await clearDraft();if(kind==='解释')await draftMessage('put',snapshot());root.querySelectorAll('textarea,select').forEach(x=>x.disabled=true);if(CSS.highlights){const mark=active.range||locate(active);if(mark)highlights.push(mark);CSS.highlights.set('kanshan-saved',new Highlight(...highlights));}}
  status.textContent='已保存在本机阅读笔记。';
  if(kind==='解释'){b.textContent='正在解释…';const r=await call('POST','/api/explain',{id:saved.id});if(root.querySelector('#ks-answer'))root.querySelector('#ks-answer').textContent=r.answer;status.textContent='摘录和 AI 解释均已保存。';b.textContent='已收好';await clearDraft();}else b.textContent='已收好';completed=true;badge.textContent='山 · 阅读伙伴';
 }catch(err){status.textContent=(saved?'摘录已保存。':'')+err.message;b.disabled=false;b.textContent=saved?'重新发送给 AI':'重试保存';}finally{root.querySelector('#ks-close').disabled=false;}};
}
function nodesText(scope){const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('script,style,noscript,button,textarea')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});let n,text='',nodes=[];while(n=walker.nextNode()){nodes.push({node:n,start:text.length});text+=n.textContent;}return {text,nodes};}
function locate(clip){
 const candidates=[...document.querySelectorAll('.RichText')];if(!candidates.length)candidates.push(...document.querySelectorAll('article'));
 const matches=[];
 for(const scope of candidates){const {text,nodes}=nodesText(scope);let at=-1;while((at=text.indexOf(clip.quote,at+1))>=0){const before=text.slice(0,at).trimEnd(),after=text.slice(at+clip.quote.length).trimStart();const score=(clip.prefix&&before.endsWith(clip.prefix.trim())?1:0)+(clip.suffix&&after.startsWith(clip.suffix.trim())?1:0);matches.push({scope,text,nodes,at,score});}}
 matches.sort((a,b)=>b.score-a.score);if(!matches.length||(matches.length>1&&matches[0].score===matches[1].score))return null;
 const {nodes,at}=matches[0];const end=at+clip.quote.length;const startNode=nodes.find((n,i)=>n.start<=at&&(!nodes[i+1]||nodes[i+1].start>at));const endNode=nodes.find(n=>n.start<end&&n.start+n.node.textContent.length>=end);if(!startNode||!endNode)return null;
 const range=document.createRange();range.setStart(startNode.node,at-startNode.start);range.setEnd(endNode.node,end-endNode.start);return range;
}
function related(c){try{const a=new URL(c.url),b=new URL(location.href);if(a.pathname===b.pathname)return true;const answerId=a.pathname.match(/\/answer\/(\d+)/)?.[1];if(answerId&&b.pathname.includes('/answer/'))return b.pathname.endsWith('/answer/'+answerId);if(answerId&&b.pathname.startsWith('/question/'))return !![...document.querySelectorAll('.AnswerItem')].find(n=>{try{return String(JSON.parse(n.dataset.zop||'{}').itemId)===answerId;}catch{return false;}});return false;}catch{return false;}}
let located=false;
function restore(){if(!library)return;highlights=[];let targetId;try{targetId=decodeURIComponent(location.hash.replace(/^#kanshan=/,''));}catch{}for(const c of library.clips.filter(related)){const range=locate(c);if(range){highlights.push(range);if(c.id===targetId&&!located){located=true;range.startContainer.parentElement.scrollIntoView({block:'center',behavior:'smooth'});if(CSS.highlights)CSS.highlights.set('kanshan-current',new Highlight(range));}}}if(CSS.highlights)CSS.highlights.set('kanshan-saved',new Highlight(...highlights));}
badge.onclick=async()=>{try{const pending=await draftMessage('get');if(pending?.quote){draft=pending;await openEditor(pending.kind);return;}library=await call('GET','/api/state');restore();let id;try{id=decodeURIComponent(location.hash.replace(/^#kanshan=/,''));}catch{}const c=library.clips.find(c=>c.id===id);if(c&&!located){root.innerHTML=`<section class="panel"><div class="top"><b>摘录还在，原文位置变了</b><button id="ks-close">×</button></div><p>可能需要展开全文，或作者已修改原文。看山保存了当时的摘录：</p><div class="quote">${esc(c.quote)}</div></section>`;root.querySelector('#ks-close').onclick=()=>root.replaceChildren();}else{showError('已连接看山。当前页面恢复了 '+highlights.length+' 处划线。选中文字开始记录。');}}catch(e){showError(e.message);}};
chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(message.action==='OPEN_READER'){badge.click();reply({ok:true});}});
draftMessage('get').then(d=>{if(d?.quote)badge.textContent='山 · 有一笔未完成';}).catch(()=>{});
let reconnecting=false;
async function reconnect(){if(reconnecting||document.hidden)return;reconnecting=true;try{library=await call('GET','/api/state');restore();if(!badge.textContent.includes('未完成'))badge.textContent='山 · 阅读伙伴';const select=root.querySelector('#ks-problem');if(select&&!select.disabled){const value=select.value;select.innerHTML='<option value="">自由阅读 · 暂不关联问题</option>'+library.problems.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.title)+'</option>').join('');select.value=select.dataset.userChosen?value:(value||currentProblem());if(!select.value)select.value='';}}catch{if(!badge.textContent.includes('未完成'))badge.textContent='山 · 等待连接';}finally{reconnecting=false;}}
reconnect();setInterval(reconnect,15000);window.addEventListener('focus',reconnect);document.addEventListener('visibilitychange',reconnect);chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes.token)void reconnect();});
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{if(lastLocation!==location.href){lastLocation=location.href;located=false;}restore();},700);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{located=false;restore();});
})();
