let liveProblemId='';
function problemArticleUrl(url){const parsed=new URL(url);if(liveProblemId)parsed.hash='kanshan-problem='+encodeURIComponent(liveProblemId);return parsed.href;}
let liveConfig={},liveResults=[],liveQuery='',liveLoading=false,liveError='',configReady=false,configRevision=0;
const recommendationState={key:'',rows:[],loading:false,error:'',generation:0,pool:[],busy:false,turn:0};
const sessionReady=fetch('/api/demo-launch').then(async response=>{if(!response.ok)throw Error('请用启动脚本运行 阅读伙伴后刷新页面');const {code}=await response.json();const login=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});if(!login.ok)throw Error('本机连接失败，请刷新页面');});
async function liveApi(method,pathname,body){await sessionReady;const response=await fetch(pathname,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(75000)});const result=await response.json();if(!response.ok)throw Error(result.error||'请求失败');return result;}
sessionReady.catch(()=>{});
function connectionPanel(){
 return `<section class="paper connection-panel">${liveConfig.credentialsUnavailable?'<p class="credential-notice" role="alert">旧连接凭证暂时无法解密，请重新填写知乎 Access Secret 和模型 API Key 后保存。已有笔记与插件连接仍可使用；替换时会保留旧凭证的加密备份。</p>':''}<form id="connection-form"><div class="connection-grid">
 <section class="connection-section" aria-labelledby="zhihu-heading"><div class="connection-section-heading"><h3 id="zhihu-heading">知乎搜索</h3><span class="connection-status">${liveConfig.zhihuConfigured?'已保存 · 待搜索验证':'未配置'}</span></div><div class="connection-field"><label for="zhihu-secret">Access Secret</label><input id="zhihu-secret" name="zhihuKey" type="password" autocomplete="off" placeholder="${liveConfig.zhihuConfigured?'留空保留已保存凭证':'填写知乎开放平台 Access Secret'}"><p class="meta field-help"><a href="https://developer.zhihu.com/profile" target="_blank" rel="noopener noreferrer">前往知乎开放平台获取 ↗</a></p></div></section>
 <section class="connection-section" aria-labelledby="model-heading"><div class="connection-section-heading"><h3 id="model-heading">阅读模型</h3><span class="connection-status">${liveConfig.aiConfigured?'已保存 · 待调用验证':'未配置'}</span></div><div class="model-fields"><div class="connection-field"><label for="model-base">API 根地址</label><input id="model-base" name="baseUrl" type="url" value="${esc(liveConfig.baseUrl||'')}" placeholder="https://你的服务商/v1"></div><div class="connection-field"><label for="model-name">模型名称</label><input id="model-name" name="model" value="${esc(liveConfig.model||'')}" placeholder="填写模型标识"></div><div class="connection-field model-key-field"><label for="model-key">API Key</label><input id="model-key" name="aiKey" type="password" autocomplete="off" placeholder="${liveConfig.aiConfigured?'留空保留已保存凭证':'填写模型 API Key'}"></div></div></section>
 </div><div class="connection-actions"><div class="actions"><button class="solid">保存配置</button><button type="button" class="line" data-live="test-ai">测试模型连接</button></div><span class="meta">凭证加密保存在本机</span></div><p class="meta" id="connection-message" role="status"></p></form></section>`;
}

function recommendationCards(){
 return [0,1].map(i=>{
  const r=recommendationState.rows[i];
  if(r)return `<article class="home-card recommendation" data-recommendation="${i}"><div class="card-heading"><span class="kicker">知乎推荐</span></div><h2>${esc(r.title)}</h2><p class="card-description recommendation-summary">${esc(r.summary)}</p><div class="home-card-bottom"><span class="meta">${esc(r.author||'作者未提供')}</span><a class="solid external-article" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">查看原文</a></div><div class="recommendation-feedback"><button type="button" class="plain" data-live="swap-recommendation" data-slot="${i}" ${recommendationState.busy?'disabled':''}>换一篇</button><button type="button" class="plain" data-live="dismiss-recommendation" data-slot="${i}" ${recommendationState.busy?'disabled':''}>不感兴趣</button></div></article>`;
  const waiting=!configReady||recommendationState.loading;
  const title=waiting?'正在找你感兴趣的知乎帖子…':!liveConfig.zhihuConfigured?(i===0?'找一篇感兴趣的文章':'也看看不同的想法'):!db.interests.length?'从一个感兴趣的话题开始。':recommendationState.error?'这次推荐暂时没有取到。':'暂时没有更多匹配的帖子。';
  const detail=waiting?'根据你保存的阅读兴趣检索，结果将在这里显示。':!liveConfig.zhihuConfigured?(i===0?'连接知乎后，按你关注的话题推荐原文。':'另一篇推荐，也许会带来新的思路。'):!db.interests.length?'点击“调整偏好”，添加你想了解的主题。':recommendationState.error||'可以调整兴趣，或在顶部搜索具体问题。';
  return `<article class="home-card recommendation recommendation-placeholder"><div class="card-heading"><span class="kicker">知乎推荐</span></div><h2>${title}</h2><p class="card-description" role="status">${esc(detail)}</p>${!liveConfig.zhihuConfigured&&!waiting?`<div class="home-card-bottom"><button type="button" class="text-link" data-live="config">连接知乎</button></div>`:''}${liveConfig.zhihuConfigured&&db.interests.length&&!waiting?`<div class="home-card-bottom"><button class="line" data-live="retry-recommendation" data-slot="${i}">再找一篇 ↗</button></div>`:''}</article>`;
 }).join('');
}
function updateRecommendationCards(){
 if(page!=='home')return;
 const nodes=[...document.querySelectorAll('.home-cards>.recommendation')];
 const template=document.createElement('template');template.innerHTML=recommendationCards();
 nodes.forEach((node,i)=>{if(template.content.children[0])node.replaceWith(template.content.children[0]);});
}
function recommendationUrlKey(url){try{const u=new URL(url);const answer=/\/answer\/(\d+)/.exec(u.pathname);return answer?'https://www.zhihu.com/answer/'+answer[1]:u.origin+u.pathname.replace(/\/$/,'');}catch{return '';}}
function recommendationReason(row,interests){
 const content=row.title+' '+row.summary;
 for(const q of db.questions.slice(0,3)){
  const parts=q.title.replace(/如何|怎样|怎么|什么|有没有|能不能|一种|一个|我的|自己的|保持|[，。？！?、：:]/g,' ').split(/\s+/).filter(t=>t.length>=2);
  if(parts.some(t=>content.includes(t)))return {interestReason:'与你最近问的「'+q.title+'」有关',questionMatch:1};
 }
 const matches=interests.filter(t=>content.includes(t));
 return {interestReason:matches.length?'与你关注的「'+matches.join('、')+'」有关':row.reason||'根据你保存的阅读兴趣检索',questionMatch:0};
}
function recommendationCandidates(results,interests){
 const skipped=new Set(db.recommendationSkipped||[]),dedupe=new Set();
 return results.filter(r=>{const key=recommendationUrlKey(r.url);if(!key||r.seen||skipped.has(key)||dedupe.has(key))return false;dedupe.add(key);return true;}).map(r=>({...r,...recommendationReason(r,interests),matchCount:interests.filter(t=>(r.title+' '+r.summary).includes(t)).length})).sort((a,b)=>b.questionMatch-a.questionMatch||b.matchCount-a.matchCount);
}
function ensureRecommendations(){
 if(!configReady)return;
 const interests=typeof effectiveTopics==='function'?effectiveTopics():[...db.interests];
 const key=JSON.stringify([interests,!!liveConfig.zhihuConfigured,configRevision,db.questions.slice(0,3).map(q=>q.title)]);
 if(key===recommendationState.key)return;
 const generation=++recommendationState.generation;
 Object.assign(recommendationState,{key,rows:[],pool:[],error:'',loading:false,busy:false});
 if(!liveConfig.zhihuConfigured||!interests.length)return;
 recommendationState.loading=true;
 liveApi('POST','/api/search',{query:interests.join(' ')}).then(result=>{
  if(generation!==recommendationState.generation)return;
  recommendationState.pool=recommendationCandidates(result.results,interests);
  recommendationState.rows=recommendationState.pool.slice(0,2);
 }).catch(e=>{if(generation===recommendationState.generation)recommendationState.error=e.message;}).finally(()=>{if(generation===recommendationState.generation){recommendationState.loading=false;updateRecommendationCards();}});
}
async function replaceRecommendation(slot,dismiss=false,retry=false){
 if(recommendationState.busy||recommendationState.loading)return;
 if(!Number.isInteger(slot)||slot<0||slot>1)return;const current=recommendationState.rows[slot];if(!current&&!retry)return;
 const generation=recommendationState.generation;recommendationState.busy=true;updateRecommendationCards();
 try{
  if(dismiss&&current)await liveApi('POST','/api/feedback',{url:current.url,title:current.title,summary:current.summary,value:'dislike'});
  if(generation!==recommendationState.generation)return;
  if(current){db.recommendationSkipped=[...new Set([...(db.recommendationSkipped||[]),recommendationUrlKey(current.url)])].slice(-300);save();}
  recommendationState.rows[slot]=null;recommendationState.error='';
  const excluded=new Set([...(db.recommendationSkipped||[]),...recommendationState.rows.filter(Boolean).map(r=>recommendationUrlKey(r.url))]);
  let next=recommendationState.pool.find(r=>!excluded.has(recommendationUrlKey(r.url)));
  if(!next){
   recommendationState.loading=true;updateRecommendationCards();
   const interests=typeof effectiveTopics==='function'?effectiveTopics():db.interests;
   const term=interests[(recommendationState.turn++)%interests.length]||'';
   const result=await liveApi('POST','/api/search',{query:term});
   if(generation!==recommendationState.generation)return;
   const fresh=recommendationCandidates(result.results,interests);recommendationState.pool.push(...fresh);next=fresh.find(r=>!excluded.has(recommendationUrlKey(r.url)));
  }
  if(generation!==recommendationState.generation)return;
  recommendationState.rows[slot]=next||null;
  if(!next)recommendationState.error='这次没有找到未展示的帖子，已为你避开刚才那篇。可以搜索一个具体问题。';
  toast(dismiss?'记住啦，这篇就不再推荐了。':next?'给你换了一篇，看看喜欢吗？':'这次没找到新文章，换个话题试试？');
 }catch(err){if(generation===recommendationState.generation){recommendationState.error=err.message;toast(err.message);}}
 finally{if(generation===recommendationState.generation){recommendationState.busy=false;recommendationState.loading=false;updateRecommendationCards();}}
}

const originalDemoRender=render;
render=function(){
 if(page==='search'){
  $('#location').textContent='阅读空间 / 知乎搜索';document.querySelectorAll('nav button').forEach(n=>n.classList.remove('active'));
  $('#app').innerHTML=heading('','搜索结果','来自知乎的文章与回答。')+`<form id="live-search" class="hero-search"><input name="q" required maxlength="300" aria-label="搜索知乎帖子" value="${esc(liveQuery)}"><button ${liveLoading?'disabled':''}>${liveLoading?'正在搜索…':'搜索知乎'}</button></form><div class="actions">${btn('返回今日阅读','page','home','line')}</div><p role="status" class="meta">${esc(liveError|| (liveLoading?'正在检索，请稍等…':`找到 ${liveResults.length} 条结果`))}</p>`+liveResults.map(r=>`<article class="paper search-result"><span class="kicker">知乎原文 / ${esc(r.author||'作者未提供')}</span><h3>${esc(r.title)}</h3><p class="card-description">${esc(r.summary)}</p><a class="solid external-article" href="${esc(problemArticleUrl(r.url))}" target="_blank" rel="noopener noreferrer">查看原文</a></article>`).join('');return;
 }
 if(page==='connections'){document.querySelectorAll('nav button').forEach(n=>n.classList.remove('active'));$('#location').textContent='阅读空间 / 知乎与模型配置';$('#app').innerHTML='<div class="fade page-column">'+heading('','连接设置','配置知乎搜索、阅读模型与划线插件。')+connectionPanel()+(typeof pluginPanel==='function'?pluginPanel():'')+'</div>';return;}
 if(page==='home')ensureRecommendations();
 originalDemoRender();

 if(page==='home'){
  const searchForm=$('#zhihu-search');searchForm.removeAttribute('action');searchForm.removeAttribute('target');
 }
};
async function searchZhihu(queryText,preserveProblem=false){if(!preserveProblem)liveProblemId='';liveQuery=queryText.trim();if(!liveQuery)return;page='search';liveLoading=true;liveResults=[];liveError='';render();try{const result=await liveApi('POST','/api/search',{query:liveQuery});liveResults=result.results;if(preserveProblem&&typeof problemMapping!=='undefined'){const q=db.questions.find(q=>problemMapping[q.id]===liveProblemId);if(q&&typeof rememberQuestionPosts==='function')rememberQuestionPosts(q,result.results,result.query);}}catch(e){liveError=e.message;}finally{liveLoading=false;if(page==='search')render();}}
async function modelTask(pathname,payload){return liveApi('POST',pathname,{...payload,confirm:true});}
document.addEventListener('submit',async e=>{
 const f=e.target;if(!['zhihu-search','live-search','connection-form'].includes(f.id))return;e.preventDefault();e.stopImmediatePropagation();
 if(f.id!=='connection-form'){if(liveLoading){toast('搜索正在进行，请稍等。');return;}await searchZhihu(String(new FormData(f).get('q')||''),f.id==='live-search');return;}
 const button=f.querySelector('button:not([type])');button.disabled=true;const status=$('#connection-message');
 try{liveConfig=await liveApi('POST','/api/config',{...liveConfig,...Object.fromEntries(new FormData(f)),interests:db.interests,aiLearning:false});configRevision++;render();$('#connection-message').textContent='配置已保存。知乎请用搜索验证；模型可点击测试连接。';toast('连接配置已安全保存。');}catch(err){status.textContent=err.message;}finally{button.disabled=false;}
},true);
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-live],[data-action=explain],[data-action=plan]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
 const action=b.dataset.live||b.dataset.action;
 if(action==='retry-recommendation'){await replaceRecommendation(Number(b.dataset.slot),false,true);return;}
 if(action==='swap-recommendation'||action==='dismiss-recommendation'){await replaceRecommendation(Number(b.dataset.slot),action==='dismiss-recommendation');return;}
 if(action==='refresh-recommendations'){recommendationState.key='';ensureRecommendations();updateRecommendationCards();return;}
 if(action==='config'){page='connections';render();window.scrollTo(0,0);return;}
 b.disabled=true;
 try{
  if(action==='test-ai'){
   if(!liveConfig.aiConfigured)throw Error('请先保存完整模型配置');
   if(!confirm('向已保存的模型发送一句连接测试，可能产生少量模型费用。继续吗？'))return;
   b.textContent='正在连接…';const result=await modelTask('/api/demo/test',{});if($('#connection-message'))$('#connection-message').textContent='模型实测连接成功：'+result.answer;toast('模型实测连接成功。');
  }
  if(action==='explain'){
   if(!selected)throw Error('先选中需要解释的文字，或点击「摘录这一句」');
   const note=$('#annotation-note').value;
   if(!confirm('发送给已配置的模型：\n\n'+selected+'\n\n批注：'+(note||'无')+'\n\n仅发送上述选段、批注与标题，可能消耗模型额度。'))return;
   b.textContent='正在解读…';const result=await modelTask('/api/demo/explain',{quote:selected,note,title:currentArticle.title});$('#explanation').hidden=false;$('#explanation').textContent=result.answer;$('#explanation').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  if(action==='plan'){
   if(!db.notes.length)throw Error('请先保存至少一条摘录');
   const question=db.questions.find(q=>q.id===b.dataset.id);if(!question)return;captureQuestionDraft(question);save();const ids=[...document.querySelectorAll('[data-evidence-question="'+question.id+'"]:checked')].map(n=>n.value);const evidence=db.notes.filter(n=>ids.includes(n.id)).slice(0,20);if(!evidence.length)throw Error('请在本问题下选择用于方案的摘录');
   if(!confirm('将发送问题「'+question.title+'」、补充限制和最近 '+evidence.length+' 条摘录及批注，以及已有建议和你的反馈给已配置的模型。可能消耗模型额度，继续吗？'))return;
   b.textContent='正在整理…';const result=await modelTask('/api/demo/plan',{question:question.title,context:question.context,evidence,previousActions:[...(question.actions||[]),...(question.planHistory||[]).slice(0,3).flatMap(h=>h.actions||[]).filter(a=>a.status||a.feedback)]});const target=db.questions.find(q=>q.id===question.id);if(target){if(target.plan||target.actions?.length){target.planHistory||=[];target.planHistory.unshift({plan:target.plan,actions:JSON.parse(JSON.stringify(target.actions||[])),createdAt:target.planCreatedAt||new Date().toISOString()});target.planHistory=target.planHistory.slice(0,12);}target.plan=result.answer;target.actions=(result.actions||[{text:result.answer}]).map(a=>({id:crypto.randomUUID(),text:a.text,status:'',feedback:''}));target.planCreatedAt=new Date().toISOString();target.planSource='model';target.planEvidenceIds=evidence.map(n=>n.id);save();if(page==='questions')render();}toast('解决方案已生成，可以编辑行动步骤。');
  }
 }catch(err){toast(err.message);if(action==='test-ai'&&$('#connection-message'))$('#connection-message').textContent=err.message;}
 finally{b.disabled=false;if(action==='test-ai')b.textContent='测试模型连接';if(action==='explain')b.textContent='解释选中文字';if(action==='plan')b.textContent=db.questions.find(q=>q.id===b.dataset.id)?.plan?'根据反馈调整建议':'生成具体解决方案';}
},true);
document.querySelector('.site-actions').insertAdjacentHTML('beforeend','<button type="button" class="header-connection" data-live="config">连接设置</button>');
liveApi('GET','/api/state').then(result=>{liveConfig=result.config;configReady=true;if(page==='home')render();else if(page==='connections'&&!document.querySelector('#connection-form input:focus'))render();}).catch(e=>toast(e.message));
render();
