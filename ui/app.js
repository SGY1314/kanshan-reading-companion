const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const articles=[
 {id:1,topic:'学习方法',title:'为什么读了很多书，\n却依然过不好这一生？',author:'看山编辑部',time:8,desc:'也许阅读的意义，不是立刻改变人生，而是让某个时刻的你，多一种选择。',body:'我们常常在合上一本书的时候，期待自己已经成为另一个人。但阅读带来的改变，往往比我们想象得更安静。\n\n它可能是在下一次争论时，你忽然愿意先听一听；也可能是在面对一个陌生问题时，你想起曾经读到的另一种解释。\n\n阅读不是收集别人的答案，而是练习提出自己的问题。\n\n如果想把阅读变成生活的一部分，不妨从一件很小的事情开始：读完一段，让自己停下来，写下「这和我有什么关系」。不用总结整本书，也不用急着认同作者。\n\n值得留下的，不只是那些写得漂亮的句子，还有你读到这里时，发生的那一点想法。'},
 {id:2,topic:'心理与自我',title:'独处，是一个人最好的增值期吗？',author:'看山编辑部',time:6,desc:'从「一个人待着」到「和自己相处」，中间还有一段路。',body:'独处不是把世界关在门外，而是暂时把注意力收回来。\n\n有人在安静中恢复精力，也有人需要通过交谈整理想法。这两种方式没有高低之分。\n\n与其问独处是否让人变得更好，不如问：这段时间里，我是否更清楚自己需要什么？\n\n试着留出十分钟，不带着必须进步的任务。散一会儿步，写几行字，或者只是看一看窗外。让休息本身也拥有意义。'},
 {id:3,topic:'生活观察',title:'把日子过慢一点，\n究竟是在浪费时间吗？',author:'看山编辑部',time:5,desc:'效率之外，我们还可以怎样度量一天。',body:'我们习惯用完成了多少事情来评价一天，却很少问自己：今天有没有一个真正记得住的时刻？\n\n把日子过慢一点，并不是拒绝行动。它是在行动之间，给感受留一点位置。\n\n同样的一杯茶，在赶时间时只是解渴，在慢下来时却可能成为一天的停顿。\n\n你不必把每一分钟都过成有用的样子。试着选择一件日常的小事，把注意力完整地交给它。'},
 {id:4,topic:'学习方法',title:'每天只有二十分钟，\n还能认真学点东西吗？',author:'看山编辑部',time:7,desc:'一个小到能够开始，又值得持续的问题。',body:'时间有限的时候，最重要的事情可能不是找出更多时间，而是缩小一次学习的范围。\n\n把「学习一门语言」换成「听懂今天的一段对话」，你会更容易知道自己从哪里开始。\n\n尝试用前两分钟确定问题，接着花十五分钟寻找解释，最后三分钟不看资料，用自己的话讲一遍。\n\n小步行动的价值，是让你有机会得到反馈，而不是承诺某种必然的成功。'}
];
let db;try{db=JSON.parse(localStorage.getItem('kanshan-design-demo-v1'));}catch{}
db ||= {later:[],notes:[],questions:[],memory:[],interests:['心理与自我','学习方法','生活观察'],record:true};
db.autoInterest ??= true;
for(const q of db.questions)if(q.plan&&!Array.isArray(q.actions))q.actions=[{id:crypto.randomUUID(),text:q.plan,status:'',feedback:''}];
let page='home',topic='全部',query='',currentArticle=null,selected='',interestDraft=null;
const labels={home:'今日阅读',questions:'带着问题',notes:'我的摘录',later:'留到后来',memory:'阅读足迹',settings:'阅读偏好'};
function save(){localStorage.setItem('kanshan-design-demo-v1',JSON.stringify(db));$('#note-count').textContent=db.notes.length;updateHomePersonalCards();}
function toast(text){const message=String(text??'');$('#toast-message').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,Math.min(9000,Math.max(3800,message.length*100)));}
function btn(text,action,id='',cls='plain'){return `<button class="${cls}" data-action="${action}" data-id="${id}">${text}</button>`;}
function heading(n,title,sub){return `<div class="page-heading${n==='notes'||n==='questions'?' intro-inset':''}"><h1 class="page-title">${title}</h1><p class="intro">${sub}</p></div>`;}
function interestInputSize(value){return Math.max(6,Math.min(22,[...value].reduce((width,char)=>width+(char.codePointAt(0)>255?2:1),0)+1));}
function journalCard(n,index){
 const title=n.title||articles.find(a=>a.id===n.articleId)?.title.replace(/\n/g,'')||'知乎阅读';
 return `<article class="journal-entry"><div class="journal-card"><div class="journal-source">${esc(title)}</div><div class="journal-copy"><blockquote>${esc(n.quote)}</blockquote>${n.note?`<div class="journal-thought"><p>${esc(n.note)}</p></div>`:''}</div></div><div class="journal-actions">${n.url?`<a class="plain external-article" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">查看原文</a>`:btn('查看原文','read',n.articleId)}${btn('修改批注','edit-note',n.id)}${btn('移除','delete-note',n.id)}</div></article>`;
}
function story(a){return `<article class="side-story" data-action="read" data-id="${a.id}" tabindex="0" role="button"><div class="kicker">${a.topic} <span> / ${a.time} 分钟</span></div><h3>${esc(a.title).replace(/\n/g,'<br>')}</h3><p>${esc(a.desc)}</p><span class="text-link">去读一读 ↗</span></article>`;}
function latestSaved(items){
 return items.map((item,index)=>({item,index,time:Date.parse(item.createdAt)||0})).sort((a,b)=>b.time-a.time||a.index-b.index)[0]?.item;
}
function homePersonalCards(){
 const quotes=db.notes.filter(n=>n.kind==='金句'||(!n.kind&&!n.remoteId));
 const note=latestSaved(quotes),question=latestSaved(db.questions);
 return `<article class="home-card excerpt-card"><div class="card-heading"><span class="kicker">最近的摘录</span></div><h2>${note?'留住一句好文字':'还没有摘录'}</h2><blockquote>${note?esc(note.quote):'读到喜欢的句子，用插件保存到这里。'}</blockquote>${note?.note?`<p class="card-description">${esc(note.note)}</p>`:''}<div class="home-card-bottom"><span class="meta">${quotes.length} 条摘录</span>${btn('查看摘录','page','notes','text-link')}</div></article><article class="home-card question-card"><div class="card-heading"><span class="kicker">正在探索</span></div><h2>${esc(question?.title||'有什么想弄明白的？')}</h2><p class="card-description">${esc(question?.context||'记下一个问题，带着它寻找答案。')}</p><div class="home-card-bottom"><span class="meta">${db.questions.length} 个问题</span>${btn(question?'继续探索':'记下问题','page','questions','text-link')}</div></article>`;
}
function updateHomePersonalCards(){
 if(page!=='home')return;
 const template=document.createElement('template');template.innerHTML=homePersonalCards();
 for(const cls of ['excerpt-card','question-card']){const old=document.querySelector('.home-cards>.'+cls),next=template.content.querySelector('.'+cls);if(old&&next)old.replaceWith(next);}
}
function home(){
 return `<section class="hero"><div class="hero-copy"><div class="pet-scene"><button type="button" class="pet-play" aria-label="和看山打个招呼" title="和看山打个招呼"><img src="kanshan.png" alt="看山"></button><span class="pet-label"></span></div><h1>世界很大，<br>先读懂一点点</h1><p lang="en">Read with questions.<br>Leave with your own thoughts.</p></div><form id="zhihu-search" class="hero-search terminal-search" role="search" aria-label="知乎搜索" action="https://www.zhihu.com/search" method="get" target="_blank" rel="noopener noreferrer"><input type="hidden" name="type" value="content"><div class="terminal-bar"><span class="terminal-window-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>kanshan — search</span></div><div class="terminal-body"><p class="terminal-path">~/reading</p><p class="terminal-help" lang="en">Type a topic. Press Enter to search.</p><label class="terminal-input-row" for="home-search-query"><span class="terminal-prompt" aria-hidden="true">➜</span><span class="terminal-command" aria-hidden="true">search</span><span class="terminal-query"><input id="home-search-query" name="q" required maxlength="300" placeholder=" " aria-label="搜索知乎帖子" autocomplete="off"><span class="terminal-cursor" aria-hidden="true"></span></span></label><div class="terminal-bottom"><span class="terminal-hint">↵ enter</span><button type="submit" aria-label="在知乎搜索"><span aria-hidden="true">[</span> 搜索知乎 <span aria-hidden="true">]</span></button></div></div></form></section><div class="toolbar interest-summary"><span class="label">我的兴趣</span><div class="interest-tags">${db.interests.map(t=>`<span class="interest-tag">${esc(t)}</span>`).join('')||'<span class="meta">还没有填写兴趣</span>'}</div>${btn('调整偏好','page','settings','plain preference-button')}</div><div class="home-cards personal-cards">${homePersonalCards()}</div><div class="section-head"><h2>今日阅读</h2></div><div class="home-cards">${typeof recommendationCards==='function'?recommendationCards():[1,2].map(i=>`<article class="home-card recommendation"><div class="card-heading"><span class="kicker">知乎推荐</span></div><h2>正在寻找文章</h2><p class="card-description">正在连接本机服务…</p></article>`).join('')}</div>`;
}
function questionUrl(url,q){
 try{const u=new URL(url);if(u.protocol!=='https:'||!(u.hostname==='zhihu.com'||u.hostname.endsWith('.zhihu.com')))return '';if(typeof problemMapping!=='undefined'&&problemMapping[q.id])u.hash='kanshan-problem='+encodeURIComponent(problemMapping[q.id]);return u.href;}catch{return '';}
}
function questionCard(q){
 const notes=db.notes.filter(n=>n.problemId===q.id||q.planEvidenceIds?.includes(n.id)),posts=(q.posts||[]).filter(p=>questionUrl(p.url,q));
 const actions=q.actions||[],statuses=['准备试试','试过了','不适合'];
 return `<article class="paper question-thread" data-question="${esc(q.id)}"><div class="thread-heading"><span class="kicker">正在探索</span><span class="meta">${posts.length} 篇帖子 · ${notes.length} 条摘录 · ${actions.length} 条行动</span></div><div class="question-detail"><div class="detail-label">问题</div><h3>${esc(q.title)}</h3><label class="detail-label" for="context-${esc(q.id)}">我的补充</label><textarea id="context-${esc(q.id)}" data-question-context="${esc(q.id)}" maxlength="1000" aria-label="我的补充">${esc(q.context||'')}</textarea>${btn('保存补充','save-context',q.id,'plain')}</div><div class="actions">${btn('去阅读，找线索','discover',q.id,'solid')}${btn(q.plan?'根据反馈调整建议':'生成具体解决方案','plan',q.id,'line')}<button type="button" class="ghost-icon" data-action="delete-question" data-id="${esc(q.id)}" aria-label="移除问题" title="移除问题">×</button></div><section class="thread-section"><h4>找到的帖子 <small>${posts.length}</small></h4>${posts.length?posts.map(p=>`<div class="thread-post"><a class="external-article" href="${esc(questionUrl(p.url,q))}" target="_blank" rel="noopener noreferrer">${esc(p.title)} ↗</a><p>${esc(p.summary||'')}</p><span class="meta">${esc(p.author||'知乎原文')}${p.openedAt?' · 已打开':''}</span></div>`).join(''):'<p class="thread-empty">点“去阅读，找线索”，找到的帖子会留在这个问题下。</p>'}</section><section class="thread-section"><h4>留下的金句与批注 <small>${notes.length}</small></h4>${notes.length?notes.map(n=>`<div class="thread-quote"><blockquote>${esc(n.quote)}</blockquote>${n.note?`<p>${esc(n.note)}</p>`:''}<span class="meta">${esc(n.title||'阅读摘录')}</span>${questionUrl(n.url,q)?` <a class="plain external-article" href="${esc(questionUrl(n.url,q))}" target="_blank" rel="noopener noreferrer">回到原文 ↗</a>`:''}</div>`).join(''):'<p class="thread-empty">从这个问题打开帖子，再用插件保存金句，会自动关联到这里。</p>'}</section>${typeof evidencePicker==='function'?evidencePicker(q):''}${q.plan||actions.length?`<section class="thread-section action-plan"><h4>行动建议</h4><p class="meta">选一个状态，也可以记下实际感受。下次调整建议会参考这些反馈。</p><label class="detail-label">建议说明</label><textarea data-plan="${esc(q.id)}" aria-label="修改解决方案">${esc(q.plan||'')}</textarea>${actions.map((a,i)=>`<div class="action-step" data-step="${esc(a.id)}"><span class="kicker">行动 ${String(i+1).padStart(2,'0')}</span><textarea data-step-text="${esc(a.id)}" aria-label="修改行动 ${i+1}" maxlength="1500">${esc(a.text)}</textarea><div class="action-statuses" role="group" aria-label="行动 ${i+1} 的状态">${statuses.map(status=>`<button type="button" class="line${a.status===status?' selected':''}" data-action="action-status" data-id="${esc(q.id)}" data-step-id="${esc(a.id)}" data-status="${status}" aria-pressed="${a.status===status}">${status}</button>`).join('')}</div><label class="detail-label">试过后的感受，或不适合的原因</label><textarea data-step-feedback="${esc(a.id)}" maxlength="1000" aria-label="行动 ${i+1} 的反馈" placeholder="例如：十分钟还是有点长，五分钟比较轻松。">${esc(a.feedback||'')}</textarea></div>`).join('')}${btn('保存建议与反馈','save-plan',q.id,'line')}</section>`:''}${q.planHistory?.length?`<details class="plan-history"><summary>此前的建议与反馈 · ${q.planHistory.length} 次</summary>${q.planHistory.map(h=>`<div class="history-entry"><span class="meta">${esc(new Date(h.createdAt).toLocaleString('zh-CN'))}</span><p>${esc(h.plan)}</p>${(h.actions||[]).map(a=>`<p>${esc(a.text)}<small>${esc(a.status||'尚未反馈')}${a.feedback?' · '+esc(a.feedback):''}</small></p>`).join('')}</div>`).join('')}</details>`:''}</article>`;
}
function captureQuestionDraft(q){
 const section=[...document.querySelectorAll('[data-question]')].find(n=>n.dataset.question===q.id);if(!section)return;
 const context=section.querySelector('[data-question-context]'),plan=section.querySelector('[data-plan]');
 if(context)q.context=context.value.slice(0,1000);if(plan)q.plan=plan.value;
 for(const a of q.actions||[]){const text=[...section.querySelectorAll('[data-step-text]')].find(n=>n.dataset.stepText===a.id),feedback=[...section.querySelectorAll('[data-step-feedback]')].find(n=>n.dataset.stepFeedback===a.id);if(text)a.text=text.value.slice(0,1500);if(feedback)a.feedback=feedback.value.slice(0,1000);}
}
function render(){
 if(page!=='settings')interestDraft=null;else interestDraft ||= [...db.interests];
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#location').textContent='阅读空间 / '+labels[page];$('#note-count').textContent=db.notes.length;
 let html='';
 if(page==='home')html=home();
 if(page==='notes')html=heading('notes','我的摘录','喜欢的句子，和读到这里时的想法')+(db.notes.length?'<div class="journal-grid">'+db.notes.map(journalCard).join('')+'</div>':'<div class="empty">读一篇内容，选中文字，留下第一条批注。</div>');
 if(page==='questions')html=heading('questions','带着问题','从一个具体的问题开始')+`<form id="question-form" class="paper"><label>你最近想弄明白什么？</label><div class="form-row"><input name="title" required maxlength="150" placeholder="例如：忙碌的时候，怎样保持学习？" aria-label="问题标题"><button class="solid">记下问题</button></div><label>想补充的目标或限制</label><textarea name="context" maxlength="1000" placeholder="例如：每天能用多少时间，希望有什么改变。"></textarea></form>`+db.questions.map(questionCard).join('');
 if(page==='settings')html=heading('','阅读偏好','选择你想了解的话题')+`<form id="preferences" class="paper"><div class="preferences-heading"><h3>兴趣标签</h3><button type="button" class="plain add-interest" data-action="add-interest"><span aria-hidden="true">＋</span> 添加兴趣</button></div><div class="interest-editor">${interestDraft.map((t,i)=>`<div class="interest-row"><input name="interest" required maxlength="30" size="${interestInputSize(t)}" aria-label="兴趣 ${i+1}" placeholder="兴趣主题" value="${esc(t)}"><button type="button" class="ghost-icon" data-action="remove-interest" data-id="${i}" aria-label="移除兴趣 ${i+1}" title="移除这项兴趣">×</button></div>`).join('')}</div><div class="preferences-footer"><div id="learning-settings"></div><button class="solid">保存偏好</button></div></form>`;
 $('#app').innerHTML=`<div class="fade${page==='questions'||page==='notes'||page==='settings'?' page-column':''}">${html}</div>`;
}
function openArticle(id){
 currentArticle=articles.find(a=>a.id===Number(id));selected='';const a=currentArticle;
 $('#reader-content').innerHTML=`<div class="reader-top"><span>看山阅读室 / 示例文章 · ${a.time} 分钟</span>${btn('关闭 ×','close')}</div><div class="reader-body"><div class="eyebrow">${a.topic} / READING ROOM</div><h2>${esc(a.title).replace(/\n/g,'<br>')}</h2><p class="meta">${a.author}　·　为前端演示编写，非知乎原帖</p><div class="prose" id="prose">${esc(a.body)}</div><div class="actions">${btn('选好一句后，留下批注 ↓','annotate','','plain')}${btn('解释选中文字','explain','','plain')}</div><div class="annotation"><small id="selection-label">在上方正文中选中文字，或点击「摘录这一句」试试。</small><textarea id="annotation-note" placeholder="这句话让你想到了什么？" aria-label="我的批注"></textarea><div class="actions">${btn('保存摘录与批注','save-note','','solid')}${btn('摘录这一句','sample-selection')}</div><p class="meta" id="explanation" hidden></p></div></div>`;
 $('#reader').showModal();
}
function articleRipple(link,x,y){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 link.querySelectorAll('.button-ripple').forEach(node=>node.remove());
 const rect=link.getBoundingClientRect(),size=Math.hypot(rect.width,rect.height)*2;
 const ripple=document.createElement('span');ripple.className='button-ripple';ripple.setAttribute('aria-hidden','true');
 ripple.style.width=ripple.style.height=size+'px';ripple.style.left=(x-rect.left-size/2)+'px';ripple.style.top=(y-rect.top-size/2)+'px';
 link.append(ripple);ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});setTimeout(()=>ripple.remove(),650);
}
document.addEventListener('pointerdown',e=>{const link=e.target.closest('a.solid.external-article');if(link&&e.button===0)articleRipple(link,e.clientX,e.clientY);},true);
document.addEventListener('keydown',e=>{const link=e.target.closest('a.solid.external-article');if(link&&e.key==='Enter'){const rect=link.getBoundingClientRect();articleRipple(link,rect.left+rect.width/2,rect.top+rect.height/2);}},true);
document.addEventListener('mouseup',()=>{const selection=window.getSelection();if(selection?.toString().trim()&&$('#prose')?.contains(selection.anchorNode)&&$('#prose')?.contains(selection.focusNode)){selected=selection.toString().slice(0,4000);$('#selection-label').textContent='选中的文字：'+selected;}});
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-page]');if(nav){page=nav.dataset.page;render();window.scrollTo(0,0);return;}
 const target=e.target.closest('[data-action]');if(!target)return;const {action,id}=target.dataset;
 if(action==='page'){page=id;render();window.scrollTo(0,0);}
 if(action==='read')openArticle(id);
 if(action==='close'){$('#reader').close();render();}
 if(action==='sample-selection'){selected='阅读不是收集别人的答案，而是练习提出自己的问题。';if(currentArticle.id!==1)selected=currentArticle.body.split('\n\n')[0];$('#selection-label').textContent='选中的文字：'+selected;$('#annotation-note').focus();}
 if(action==='annotate'){$('#annotation-note').focus();if(!selected)toast('先在正文中选中一段文字，也可以试试「摘录这一句」。');}
 if(action==='save-note'){if(!selected){toast('先选中一句想留下的文字。');return;}db.notes.unshift({id:crypto.randomUUID(),quote:selected,note:$('#annotation-note').value,articleId:currentArticle.id,kind:'金句',createdAt:new Date().toISOString()});save();toast('这句话和你的想法，都收好了。');$('#annotation-note').value='';}
 if(action==='explain'){$('#explanation').hidden=false;$('#explanation').textContent='示例解读（未调用模型）：这段文字把阅读看作主动思考的过程。你可以问自己：我认同哪一点？有没有反例？可以在生活中做一个怎样的小尝试？';$('#explanation').scrollIntoView({behavior:'smooth',block:'nearest'});}
 if(action==='delete-note'){db.notes=db.notes.filter(n=>n.id!==id);save();render();}
 if(action==='edit-note'){const n=db.notes.find(n=>n.id===id);$('#reader-content').innerHTML=`<div class="reader-top"><span>修改批注</span>${btn('关闭 ×','close')}</div><form id="edit-note" class="reader-body" data-id="${id}"><p class="note-quote">${esc(n.quote)}</p><textarea name="note" aria-label="修改批注">${esc(n.note)}</textarea><div class="actions"><button class="solid">保存想法</button></div></form>`;$('#reader').showModal();}
 if(action==='plan'){const q=db.questions.find(q=>q.id===id);if(!db.notes.length){toast('先留下几条摘录，再来整理自己的思路。');return;}q.plan='我想探索的问题：'+q.title+'\n\n从摘录开始：\n'+db.notes.slice(0,3).map((n,i)=>`${i+1}. ${n.quote}\n我的想法：${n.note||'还需要进一步想一想'}`).join('\n\n')+'\n\n今天可以做的一件小事：选出一条最相关的观点，写下一个能够尝试的行动。\n\n还需要验证：这条建议适合我的实际限制吗？';save();render();toast('已生成前端示例思路，可以直接修改。');}
 if(action==='save-plan'||action==='save-context'){const q=db.questions.find(q=>q.id===id);if(!q)return;captureQuestionDraft(q);save();if(typeof syncReading==='function')void syncReading();toast(action==='save-context'?'补充已保存。':'建议和反馈已保存。');}
 if(action==='action-status'){const q=db.questions.find(q=>q.id===id);if(!q)return;captureQuestionDraft(q);const step=q.actions?.find(a=>a.id===target.dataset.stepId);if(!step||!['准备试试','试过了','不适合'].includes(target.dataset.status))return;step.status=target.dataset.status;step.updatedAt=new Date().toISOString();save();for(const b of target.parentElement.querySelectorAll('button')){const active=b.dataset.status===step.status;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}toast('已记下，下次调整建议会参考。');}
 if(action==='add-interest'||action==='remove-interest'){
  interestDraft=[...document.querySelectorAll('#preferences [name=interest]')].map(input=>input.value);
  if(action==='add-interest'){if(interestDraft.length>=6){toast('最多添加六个兴趣，先把好奇心留给这些方向。');return;}interestDraft.push('');}
  else interestDraft.splice(Number(id),1);
  render();if(action==='add-interest')document.querySelector('.interest-row:last-child input')?.focus();
 }
 if(action==='delete-question'){db.questions=db.questions.filter(q=>q.id!==id);save();render();}
 if(action==='reset'){if(confirm('重置全部 Demo 数据？这不会影响正式项目。')){localStorage.removeItem('kanshan-design-demo-v1');location.reload();}}
});
document.addEventListener('submit',e=>{if(e.target.id==='zhihu-search')return;e.preventDefault();const f=e.target,data=new FormData(f);if(f.id==='search'){query=String(data.get('q')).trim();render();}if(f.id==='question-form'){db.questions.unshift({id:crypto.randomUUID(),title:data.get('title'),context:data.get('context'),plan:'',createdAt:new Date().toISOString()});save();render();toast('问题记下了，带着它去读一读。');}if(f.id==='preferences'){const interests=data.getAll('interest').map(x=>String(x).trim());if(interests.some(x=>!x)){toast('请填写兴趣名称，或移除空白项。');return;}if(new Set(interests).size!==interests.length){toast('这个兴趣已经有了，换一个主题试试。');return;}db.interests=interests.slice(0,6);interestDraft=[...db.interests];topic='全部';save();toast('阅读方向已更新。');render();}if(f.id==='edit-note'){db.notes.find(n=>n.id===f.dataset.id).note=data.get('note');save();$('#reader').close();render();}});
document.addEventListener('input',e=>{if(e.target.matches('#preferences [name=interest]'))e.target.size=interestInputSize(e.target.value);});
document.addEventListener('change',e=>{if(e.target.matches('[data-step-text],[data-step-feedback],[data-question-context],[data-plan]')){const q=db.questions.find(q=>q.id===e.target.closest('[data-question]')?.dataset.question);if(q){captureQuestionDraft(q);save();}}if(e.target.id==='record'){db.record=e.target.checked;save();toast(db.record?'已开启 Demo 阅读足迹。':'已暂停记录。');}});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.side-story')){e.preventDefault();openArticle(e.target.dataset.id);}});
$('#today').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric'});save();render();
