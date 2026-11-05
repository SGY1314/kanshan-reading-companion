let learnedProfile={enabled:true,topics:[],updatedAt:null},problemMapping={},syncBusy=false,interestBusy=false,interestTimer;
function effectiveTopics(){return [...new Set([...db.interests,...learnedProfile.topics.map(t=>t.topic)])];}
function refreshHomeInterests(){
 const tags=$('.interest-tags');if(!tags)return;
 tags.innerHTML=db.interests.map(t=>`<span class="interest-tag">${esc(t)}</span>`).join('')+learnedProfile.topics.map(t=>`<span class="interest-tag learned-tag" title="${esc(t.reason)}">${esc(t.topic)}<small>近期</small></span>`).join('');
 if(!effectiveTopics().length)tags.innerHTML='<span class="meta">还没有填写兴趣</span>';
 ensureRecommendations();updateRecommendationCards();
}
function rememberQuestionPosts(q,results,query){
 const existing=new Map((q.posts||[]).map(p=>[recommendationUrlKey(p.url),p]));
 for(const r of results){if(!questionUrl(r.url,q))continue;const key=recommendationUrlKey(r.url);existing.set(key,{...existing.get(key),title:r.title,url:r.url,summary:r.summary,author:r.author,query,foundAt:existing.get(key)?.foundAt||new Date().toISOString()});}
 q.posts=[...existing.values()].slice(-40);save();
}
function evidencePicker(q){return `<details class="evidence-picker"><summary>用于方案的摘录 · 选择依据</summary>${db.notes.length?db.notes.map(n=>`<label class="evidence-row"><input type="checkbox" data-evidence-question="${esc(q.id)}" value="${esc(n.id)}" ${n.problemId===q.id||q.planEvidenceIds?.includes(n.id)?'checked':''}><span>${esc(n.quote)}<small>${esc(n.title||'阅读摘录')}${n.note?' · '+esc(n.note):''}</small></span></label>`).join(''):'<p class="meta">打开知乎帖子，用插件划线并关联这个问题。</p>'}</details>`;}
let pluginBridgeState='unavailable',pluginBridgeTimer;
const pluginStates={unavailable:'安装插件后，刷新本页即可自动连接',connecting:'正在连接插件…',connected:'插件已连接',waiting:'等待本机服务，稍后自动重试',paused:'自动连接已暂停'};
function updatePluginConnection(){const status=$('#plugin-connection-status'),button=$('[data-experience=connect-plugin]');if(status)status.textContent=pluginStates[pluginBridgeState];if(button){button.disabled=pluginBridgeState==='connecting';button.textContent=pluginBridgeState==='paused'?'恢复连接':'重新连接';}}
function requestPluginConnection(manual=false){
 if(manual){pluginBridgeState='connecting';updatePluginConnection();clearTimeout(pluginBridgeTimer);pluginBridgeTimer=setTimeout(()=>{pluginBridgeState='unavailable';updatePluginConnection();},3000);}
 window.postMessage({source:'kanshan-reading-page',action:manual?'CONNECT':'STATUS'},location.origin);
}
window.addEventListener('message',event=>{
 if(event.source!==window||event.origin!==location.origin)return;
 const message=event.data;
 if(message?.source!=='kanshan-extension'||message.action!=='STATUS'||!Object.hasOwn(pluginStates,message.state))return;
 clearTimeout(pluginBridgeTimer);pluginBridgeState=message.state;updatePluginConnection();
});
function pluginPanel(){
 return `<section class="paper plugin-panel"><h3>连接划线插件</h3><ol class="plugin-steps"><li><div class="plugin-step-copy"><h4>安装插件</h4><p>在 Chrome 或 Edge 的扩展管理页开启开发者模式，选择“加载已解压的扩展程序”，加载打开的插件文件夹。</p></div><button type="button" class="line" data-experience="extension">打开插件文件夹</button></li><li><div class="plugin-step-copy"><h4>自动连接</h4><p id="plugin-connection-status" role="status">${pluginStates[pluginBridgeState]}</p></div><button type="button" class="line" data-experience="connect-plugin" ${pluginBridgeState==='connecting'?'disabled':''}>${pluginBridgeState==='paused'?'恢复连接':'重新连接'}</button></li></ol></section>`;
}
function learningPanel(){return `<div class="learning-panel"><label class="learning-switch" for="auto-interest"><span>动态更新兴趣</span><span class="learning-toggle"><input id="auto-interest" type="checkbox" role="switch" ${learnedProfile.enabled?'checked':''}><span class="learning-particles" aria-hidden="true">${'<i></i>'.repeat(8)}</span></span></label></div>`;}
const experienceRender=render;
render=function(){
 experienceRender();
 if(page==='connections')requestPluginConnection();
 if(page==='settings')$('#learning-settings').innerHTML=learningPanel();
 if(page==='home'){
  const tags=$('.interest-tags');
  if(tags)tags.insertAdjacentHTML('beforeend',learnedProfile.topics.map(t=>`<span class="interest-tag learned-tag" title="${esc(t.reason)}">${esc(t.topic)}<small>近期</small></span>`).join(''));
 }
};
async function syncReading(){
 if(syncBusy)return;syncBusy=true;
 try{
  const result=await liveApi('POST','/api/demo/sync',{questions:db.questions});
  const reverse=Object.fromEntries(Object.entries(result.mapping).map(([a,b])=>[b,a]));problemMapping=result.mapping;
  const before=JSON.stringify(db.notes.filter(n=>n.remoteId));
  const imported=result.clips.map(n=>({id:'remote:'+n.id,remoteId:n.id,quote:n.quote,note:n.note,title:n.title,url:n.url,kind:n.kind,problemId:reverse[n.problemId]||'',createdAt:n.createdAt}));
  db.notes=[...imported,...db.notes.filter(n=>!n.remoteId)];
  learnedProfile=result.profile;db.autoInterest=learnedProfile.enabled;
  if(before!==JSON.stringify(imported)){
   save();
   if(page==='notes'||page==='questions'){
    const fieldKey=n=>JSON.stringify([n.closest('form')?.id,n.name,n.dataset.plan,n.dataset.evidenceQuestion,n.dataset.stepText,n.dataset.stepFeedback,n.dataset.questionContext,n.type,n.dataset.evidenceQuestion?n.value:'']);
    const drafts=new Map([...document.querySelectorAll('#app input,#app textarea')].map(n=>[fieldKey(n),{value:n.value,checked:n.checked}]));
    db.questions.forEach(captureQuestionDraft);render();
    for(const n of document.querySelectorAll('#app input,#app textarea')){const old=drafts.get(fieldKey(n));if(old){n.value=old.value;n.checked=old.checked;}}
   }
   scheduleLearning();
  }
 }catch(e){if(page==='connections')toast(e.message);}finally{syncBusy=false;}
}
function scheduleLearning(){clearTimeout(interestTimer);interestTimer=setTimeout(()=>void updateInterests(false),10000);}
async function updateInterests(force){
 if(interestBusy||!learnedProfile.enabled)return;
 if(!liveConfig.aiConfigured){if(force)toast('请先在“知乎与模型配置”中保存模型');return;}
 interestBusy=true;const status=$('#learning-status');if(status)status.textContent='正在根据阅读更新…';
 try{
  const before=JSON.stringify(learnedProfile.topics);
  const result=await liveApi('POST','/api/demo/learn',{force,interests:db.interests,questions:db.questions,notes:db.notes});
  learnedProfile=result.profile;
  if(before!==JSON.stringify(learnedProfile.topics)){recommendationState.key='';if(page==='home')refreshHomeInterests();else if(page==='settings'&&$('.learning-panel'))$('.learning-panel').outerHTML=learningPanel();}
  if(force)toast(result.skipped?'暂时没有新的阅读信号。':'阅读兴趣已更新。');
  if($('#learning-status'))$('#learning-status').textContent=learnedProfile.updatedAt?'已更新 · '+new Date(learnedProfile.updatedAt).toLocaleTimeString('zh-CN'):'等待新的阅读信号';
 }catch(e){if($('#learning-status'))$('#learning-status').textContent=e.message;if(force)toast(e.message);}finally{interestBusy=false;}
}
const experienceSave=save;
save=function(){experienceSave();scheduleLearning();};
document.addEventListener('submit',async e=>{
 if(e.target.id==='question-form'||e.target.id==='preferences')setTimeout(()=>void syncReading(),0);
 if(e.target.id==='edit-note'){
  const n=db.notes.find(n=>n.id===e.target.dataset.id);if(!n?.remoteId)return;
  e.preventDefault();e.stopImmediatePropagation();
  try{const note=String(new FormData(e.target).get('note')||'');await liveApi('POST','/api/clips/update',{id:n.remoteId,note});n.note=note;save();$('#reader').close();render();}catch(err){toast(err.message);}
 }
},true);
document.addEventListener('change',async e=>{
 if(e.target.id!=='auto-interest')return;
 const input=e.target;input.disabled=true;
 try{learnedProfile=await liveApi('POST','/api/demo/profile',{enabled:input.checked});db.autoInterest=learnedProfile.enabled;save();if(input.checked)scheduleLearning();else clearTimeout(interestTimer);}catch(err){input.checked=!input.checked;toast(err.message);}finally{input.disabled=false;}
});
document.addEventListener('click',async e=>{
 if(e.target.closest('[data-action=delete-question]'))setTimeout(()=>void syncReading(),0);
 const b=e.target.closest('[data-experience],[data-action=discover],[data-action=delete-note],a.external-article');if(!b)return;
 if(b.matches('a.external-article')){if(b.closest('.recommendation')){db.recommendationSkipped=[...new Set([...(db.recommendationSkipped||[]),recommendationUrlKey(b.href)])].slice(-300);save();}for(const q of db.questions){const post=q.posts?.find(p=>recommendationUrlKey(p.url)===recommendationUrlKey(b.href));if(post){post.openedAt=new Date().toISOString();save();}}scheduleLearning();return;}
 if(b.dataset.action==='delete-note'&&!db.notes.find(n=>n.id===b.dataset.id)?.remoteId)return;
 e.preventDefault();e.stopImmediatePropagation();if(b.dataset.experience==='connect-plugin'){requestPluginConnection(true);return;}b.disabled=true;
 try{
  if(b.dataset.action==='discover'){
   const q=db.questions.find(n=>n.id===b.dataset.id);if(!q)return;captureQuestionDraft(q);save();
   await syncReading();liveProblemId=problemMapping[q.id]||'';page='search';liveQuery='';liveResults=[];liveLoading=true;liveError='';render();
   try{const result=await modelTask('/api/demo/discover',{question:q.title,context:q.context});liveQuery=result.query;liveResults=result.results;rememberQuestionPosts(q,result.results,result.query);}
   catch(err){liveError=err.message;}finally{liveLoading=false;if(page==='search')render();}
  }
  if(b.dataset.action==='delete-note'){const n=db.notes.find(n=>n.id===b.dataset.id);await liveApi('POST','/api/clips/delete',{id:n.remoteId});db.notes=db.notes.filter(item=>item!==n);save();render();}
  if(b.dataset.experience==='extension')await liveApi('POST','/api/extension',{});
  if(b.dataset.experience==='learn')await updateInterests(true);
  if(b.dataset.experience==='dismiss'){learnedProfile=await liveApi('POST','/api/demo/profile',{dismiss:b.dataset.topic});recommendationState.key='';render();}
 }catch(err){toast(err.message);}finally{b.disabled=false;}
},true);
sessionReady.then(async()=>{await syncReading();await liveApi('POST','/api/demo/profile',{enabled:learnedProfile.enabled});if(page==='home'||page==='settings')render();scheduleLearning();}).catch(e=>toast(e.message));
setInterval(()=>{if(document.visibilityState==='visible'){void syncReading();void updateInterests(false);}},30000);
window.addEventListener('focus',()=>void syncReading());
const petMoves=[{name:'hop',line:'「 好呀，陪你再读一会儿。 」'},{name:'peek',line:'「 让我也看看，你在读什么？ 」'},{name:'nod',line:'「 嗯嗯，我在认真听。 」'},{name:'waddle',line:'「 溜达一下，再回来读。 」'},{name:'happy',line:'「 又遇到一句喜欢的话啦。 」'}];
let lastPetMove=-1,petFinish;
function playWithKanshan(button,interactive=false){
 if(!button?.isConnected||document.visibilityState!=='visible')return;
 const next=(lastPetMove+1+Math.floor(Math.random()*(petMoves.length-1)))%petMoves.length;lastPetMove=next;
 const move=petMoves[next],label=button.closest('.pet-scene')?.querySelector('.pet-label');
 clearTimeout(petFinish);button.removeAttribute('data-pet-motion');
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches){void button.offsetWidth;button.dataset.petMotion=move.name;}
 if(label){if(interactive)label.setAttribute('aria-live','polite');label.textContent=move.line;}
 petFinish=setTimeout(()=>{button.removeAttribute('data-pet-motion');if(label){label.removeAttribute('aria-live');label.textContent='';}},2800);
}
document.addEventListener('click',e=>{const button=e.target.closest('.pet-play');if(button)playWithKanshan(button,true);});
document.addEventListener('pointerover',e=>{const button=e.target.closest('.pet-play');if(button&&!button.contains(e.relatedTarget)&&!button.hasAttribute('data-pet-motion'))playWithKanshan(button);});
render();
