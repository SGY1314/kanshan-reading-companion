(()=>{
if(document.getElementById('kanshan-reader-host'))return;
const host=document.createElement('div');host.id='kanshan-reader-host';host.style.cssText='position:fixed;z-index:2147483646;top:0;left:0;';document.documentElement.append(host);
const shadow=host.attachShadow({mode:'closed'});
const style=document.createElement('style');style.textContent=`:host{all:initial;color:#304332;font:13px/1.7 "Microsoft YaHei",sans-serif}*{box-sizing:border-box}button,input,textarea,select{font:inherit}button{cursor:pointer;border:1px solid #dce3d3;background:#fffef8;color:#45603e;border-radius:6px;padding:7px 10px}button:hover{background:#eaf0e2}button:disabled{opacity:.55;cursor:wait}.bar{position:fixed;display:flex;gap:4px;padding:5px;background:#fffef8;border:1px solid #dce3d3;border-radius:9px;box-shadow:0 7px 25px #23321c26}.panel{position:fixed;right:18px;top:75px;width:355px;max-height:calc(100vh - 95px);overflow:auto;padding:20px;background:#fffef8;border:1px solid #dce3d3;border-radius:13px;box-shadow:0 10px 45px #23321c30}.top{display:flex;align-items:center;justify-content:space-between}.top b{font-size:17px}p{margin:12px 0;color:#7a866c;font-size:12px}.quote{border-left:3px solid #afc59a;background:#f0f3e9;padding:10px;max-height:145px;overflow:auto;white-space:pre-wrap;margin:12px 0}label{display:block;font-size:12px;margin-top:13px;color:#758469}textarea,select{display:block;width:100%;padding:8px;background:white;border:1px solid #d6dfcb;border-radius:6px;margin-top:5px;color:#304332}textarea{min-height:80px;resize:vertical}.primary{background:#42624b;color:white;margin-top:14px}.status{font-size:12px;color:#688254;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:12px}.answer{white-space:pre-wrap;font-size:13px;margin-top:16px;line-height:1.9}.badge{position:fixed;right:20px;bottom:22px;border-radius:20px;box-shadow:0 3px 15px #23321c18;padding:9px 14px;background:#fffef8}.help{color:#88927c;font-size:11px}h3{font-size:15px}`;shadow.append(style);
const root=document.createElement('div');shadow.append(root);
const badge=document.createElement('button');badge.className='badge';badge.textContent='山 · 阅读伙伴';shadow.append(badge);
const markStyle=document.createElement('style');markStyle.textContent='::highlight(kanshan-saved){background-color:#e4eab3;color:inherit}::highlight(kanshan-current){background-color:#b8dba5;color:inherit}';document.documentElement.append(markStyle);
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let draft=null, library=null, bar=null, highlights=[], lastLocation=location.href, timer;
async function call(method,path,body){let r;try{r=await chrome.runtime.sendMessage({method,path,body});}catch{throw new Error('插件连接已失效，请刷新页面并确认桌宠在运行。');}if(!r||r.error)throw new Error(r?.error||'无法连接桌宠');return r.data;}
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
document.addEventListener('mouseup',e=>{if(e.composedPath().includes(host))return;setTimeout(()=>{const d=selectionDraft();bar?.remove();bar=null;if(!d)return;draft=d;const rect=d.range.getBoundingClientRect();bar=document.createElement('div');bar.className='bar';bar.style.left=Math.max(8,Math.min(rect.left,innerWidth-330))+'px';bar.style.top=Math.max(8,Math.min(rect.bottom+8,innerHeight-55))+'px';for(const [label,kind]of[['划线批注','划线'],['保存金句','金句'],['解释一下','解释']]){const b=document.createElement('button');b.textContent=label;b.onmousedown=e=>e.preventDefault();b.onclick=()=>openEditor(kind);bar.append(b);}shadow.append(bar);},20);});
async function openEditor(kind){
 bar?.remove();if(!draft)return;root.innerHTML=`<section class="panel"><p>正在连接看山…</p></section>`;
 try{library=await call('GET','/api/state');}catch(e){showError(e.message);return;}
 root.innerHTML=`<section class="panel"><div class="top"><b>${kind==='解释'?'一起读懂这段话':kind==='金句'?'收好这句喜欢的话':'给这段话留个想法'}</b><button id="ks-close">×</button></div><div class="quote">${esc(draft.quote)}</div><p>${esc(draft.author||'作者未识别')} · ${esc(draft.title)}</p><label>我的批注<textarea id="ks-note" maxlength="4000" placeholder="我赞同什么？还有什么没想明白？"></textarea></label><label>我的态度<select id="ks-stance">${['值得尝试','解释了原因','我有疑问','不适合我'].map(s=>`<option>${s}</option>`).join('')}</select></label><label>加入问题<select id="ks-problem"><option value="">自由阅读 · 暂不关联问题</option>${library.problems.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('')}</select></label>${kind==='解释'?'<p class="help">点击下方按钮会先保存摘录，再将这段原文、前后各最多 800 字上下文、标题与批注发送给你配置的模型。不会发送整页。</p>':'<p class="help">本次只保存到本机，不会发送给 AI。</p>'}<button id="ks-save" class="primary">${kind==='解释'?'保存并发送给 AI 解释':'保存到看山的笔记'}</button><div id="ks-status" class="status" role="status"></div><div id="ks-answer" class="answer"></div></section>`;
 root.querySelector('#ks-close').onclick=()=>root.replaceChildren();
 let saved=null;
 root.querySelector('#ks-save').onclick=async e=>{const b=e.target;b.disabled=true;const status=root.querySelector('#ks-status');try{
  if(!saved){status.textContent='正在保存…';saved=await call('POST','/api/clips',{...draft,range:undefined,kind:kind==='金句'?'金句':'划线',note:root.querySelector('#ks-note').value,stance:root.querySelector('#ks-stance').value,problemId:root.querySelector('#ks-problem').value});root.querySelectorAll('textarea,select').forEach(x=>x.disabled=true);if(CSS.highlights){highlights.push(draft.range);CSS.highlights.set('kanshan-saved',new Highlight(...highlights));}}
  status.textContent='已保存在本机阅读笔记。';
  if(kind==='解释'){b.textContent='正在解释…';const r=await call('POST','/api/explain',{id:saved.id});if(root.querySelector('#ks-answer'))root.querySelector('#ks-answer').textContent=r.answer;status.textContent='摘录和 AI 解释均已保存。';b.textContent='已收好';}else b.textContent='已收好';
 }catch(err){status.textContent=(saved?'摘录已保存。':'')+err.message;b.disabled=false;b.textContent=saved?'重新发送给 AI':'重试保存';}};
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
badge.onclick=async()=>{try{library=await call('GET','/api/state');restore();let id;try{id=decodeURIComponent(location.hash.replace(/^#kanshan=/,''));}catch{}const c=library.clips.find(c=>c.id===id);if(c&&!located){root.innerHTML=`<section class="panel"><div class="top"><b>摘录还在，原文位置变了</b><button id="ks-close">×</button></div><p>可能需要展开全文，或作者已修改原文。看山保存了当时的摘录：</p><div class="quote">${esc(c.quote)}</div></section>`;root.querySelector('#ks-close').onclick=()=>root.replaceChildren();}else{showError('已连接看山。当前页面恢复了 '+highlights.length+' 处划线。选中文字开始记录。');}}catch(e){showError(e.message);}};
call('GET','/api/state').then(s=>{library=s;restore();}).catch(()=>{});
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{if(lastLocation!==location.href){lastLocation=location.href;located=false;}restore();},700);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{located=false;restore();});
})();
