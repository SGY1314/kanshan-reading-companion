const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createInterestLearning} = require('./interests.cjs');
const {createWeb} = require('./web.cjs');
const {createReadingMemory,readingUrl} = require('./memory.cjs');
const plain = s => String(s || '').replace(/<[^>]*>/g, '').trim();
const text = (s, max = 12000) => String(s || '').trim().slice(0, max);
function fail(message, status = 400) { throw Object.assign(new Error(message), {status}); }
function zhihuUrl(s) { try { const u = new URL(s); return u.protocol === 'https:' && (u.hostname === 'zhihu.com' || u.hostname.endsWith('.zhihu.com')); } catch { return false; } }
function createService({dir, encrypt, decrypt, fetchImpl = fetch, onChange = () => {}, learningOptions = {}, openExtension}) {
  fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, 'library.json');
  const secretFile = path.join(dir, 'credentials.bin');
  let db = {interests: ['心理学', '学习方法', '真实生活经验'], clips: [], problems: [], feedback: {}, settings: {}};
  if (fs.existsSync(file)) { db = {...db, ...JSON.parse(fs.readFileSync(file, 'utf8'))}; }
  const tokenFile = path.join(dir, 'pairing-token');
  const token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8') : crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(tokenFile, token, {mode: 0o600});
  let revision = 0;
  const persist = () => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, file); revision++; onChange(); };
  let credentialsUnavailable=false;
  function secrets() {
    credentialsUnavailable=false;if(!fs.existsSync(secretFile))return {};
    const encrypted=fs.readFileSync(secretFile);
    try {const value=JSON.parse(decrypt(encrypted));if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([key,val])=>!['zhihu','ai'].includes(key)||typeof val!=='string'))throw Error('Invalid credentials');return value;}
    catch {credentialsUnavailable=true;return {};}
  }
  function saveSecrets(value,replaceUnreadable=false) {
    if(credentialsUnavailable&&!replaceUnreadable)return;
    let encrypted;if(Object.keys(value).length){try{encrypted=encrypt(JSON.stringify(value));}catch{fail('无法加密保存凭证，请重启看山后重试；原凭证保持不变。',503);}}
    if(credentialsUnavailable&&fs.existsSync(secretFile))fs.copyFileSync(secretFile,path.join(dir,'credentials.unreadable-'+crypto.randomUUID()+'.bin'),fs.constants.COPYFILE_EXCL);
    if(encrypted){const temp=secretFile+'.tmp';fs.writeFileSync(temp,encrypted,{mode:0o600});fs.renameSync(temp,secretFile);}
    else if(fs.existsSync(secretFile))fs.unlinkSync(secretFile);
  }
  function configState() { const s = secrets(); return {...db.settings, interests: db.interests, credentialsUnavailable, zhihuConfigured: !!s.zhihu, aiConfigured: !!(s.ai && db.settings.baseUrl && db.settings.model)}; }
  async function remoteJson(url, options) {
    let r; try { r = await fetchImpl(url, {...options, signal: AbortSignal.timeout(60000)}); } catch { fail('连接失败或超时，请检查网络与服务地址。', 502); }
    if (!r.ok) fail(`远端服务返回 ${r.status}，请检查凭证、权限或额度。`, 502);
    try { return await r.json(); } catch { fail('远端服务返回了无法解析的数据。', 502); }
  }
  async function ai(prompt) {
    const cfg = configState(); const keys = secrets();
    if (!cfg.aiConfigured) fail('请先在设置中填写模型 API 地址、模型名与 API Key。', 409);
    const {runReadingAgent} = await import('./agent.mjs');
    try { return await runReadingAgent({prompt,baseUrl:cfg.baseUrl,model:cfg.model,apiKey:keys.ai,fetchImpl}); }
    catch (error) { fail(error.message,502); }
  }
  const memory = createReadingMemory({db,persist,now:learningOptions.now});
  const learning = createInterestLearning({...learningOptions, getDB:()=>db, ai, persist, isConfigured:()=>configState().aiConfigured});
  async function route(method, pathname, body = {}) {
    if (method === 'GET' && pathname === '/api/state') return {...db, memory:memory.state(), learningBusy:learning.busy, effectiveInterests:learning.effective(), config: configState()};
    if (method === 'GET' && pathname === '/api/memory/status') return {enabled:db.memory.enabled};
    if (method === 'POST' && pathname === '/api/memory/config') {const result=memory.configure(body);learning.schedule();return result;}
    if (method === 'POST' && pathname === '/api/memory/visit') {const result=memory.record(body);if(result.signalChanged)learning.schedule();return result;}
    if (method === 'POST' && pathname === '/api/memory/forget') {const result=memory.forget(body.id);learning.schedule();return result;}
    if (method === 'POST' && pathname === '/api/memory/restore') return memory.restore(body.url);
    if (method === 'POST' && pathname === '/api/memory/clear') {
      if(body.confirm!==true)fail('请先确认清空阅读记忆');
      memory.clear();learning.setEnabled(false);learning.control('reset');return memory.state();
    }
    if (method === 'GET' && pathname === '/api/interests/preview') return learning.preview();
    if (method === 'POST' && pathname === '/api/interests/refresh') {if(body.confirm!==true)fail('请先预览并确认要发送的阅读信号');return learning.refresh();}
    if (method === 'POST' && pathname === '/api/interests/control') return learning.control(body.action,body.topic);
    if (method === 'POST' && pathname === '/api/config') {
      const s = secrets();
      if (body.zhihuKey !== undefined && body.zhihuKey !== '') s.zhihu = text(body.zhihuKey, 2000);
      if (body.aiKey !== undefined && body.aiKey !== '') s.ai = text(body.aiKey, 2000);
      if (body.clearZhihu) delete s.zhihu;
      if (body.clearAI) delete s.ai;
      const base = text(body.baseUrl===undefined?db.settings.baseUrl:body.baseUrl, 500).replace(/\/$/, '');
      if (base) { let u; try { u = new URL(base); } catch { fail('API 地址格式不正确'); } if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname))) fail('API 地址需使用 HTTPS，本机模型允许 HTTP。'); }
      saveSecrets(s,!!(text(body.zhihuKey)||text(body.aiKey)||body.clearZhihu||body.clearAI));
      db.interests = Array.isArray(body.interests) ? body.interests.map(x => text(x, 60)).filter(Boolean).slice(0, 15) : db.interests;
      db.settings = {baseUrl: base, model: text(body.model===undefined?db.settings.model:body.model, 120)};
      learning.setEnabled(typeof body.aiLearning === 'boolean' ? body.aiLearning : db.learning.enabled);
      learning.schedule(false); persist(); return configState();
    }
    if (method === 'POST' && pathname === '/api/search') {
      const keys = secrets(); if (!keys.zhihu) fail('知乎尚未连接。请在设置中填写 Access Secret，或使用“去知乎搜索”。', 409);
      const preferences = learning.effective();
      const learnedTopics=preferences.filter(t=>t.source==='ai').sort((a,b)=>b.weight-a.weight);
      const query = text(body.query, 300) || (learnedTopics.length ? [learnedTopics[0].topic,...db.interests.slice(0,2)] : db.interests.slice(0,3)).join(' ');
      if (!query) fail('请先输入主题或设置阅读兴趣');
      const url = new URL('https://developer.zhihu.com/api/v1/content/zhihu_search'); url.searchParams.set('Query', query); url.searchParams.set('Count', '10');
      const data = await remoteJson(url, {headers: {'Authorization': 'Bearer ' + keys.zhihu, 'X-Request-Timestamp': String(Math.floor(Date.now() / 1000))}});
      if (Number(data.Code) !== 0) fail('知乎检索失败：' + text(data.Message, 200), 502);
      if (!Array.isArray(data.Data?.Items)) fail('知乎返回格式与预期不符。', 502);
      const positive = db.clips.filter(c => c.stance === '值得尝试' || c.kind === '金句').map(c => c.quote + c.note).join(' ');
      const hiddenReadCount=!text(body.query,300) && db.memory.avoidSeen ? data.Data.Items.filter(x=>memory.seen(x.Url)).length : 0;
      const results = data.Data.Items.filter(x => zhihuUrl(x.Url) && !Object.entries(db.feedback).some(([url,value])=>value==='dislike' && (readingUrl(url)||url)===(readingUrl(x.Url)||x.Url)) && (text(body.query,300) || !db.memory.avoidSeen || !memory.seen(x.Url))).map(x => {
        const content = plain(x.ContentText); const title = plain(x.Title); const matches = preferences.filter(t => (title + content).includes(t.topic));
        return {title, seen:!!memory.seen(x.Url), url: x.Url, author: plain(x.AuthorName), summary: content.slice(0, 650), reason: matches.length ? '匹配'+(matches.some(t=>t.source==='ai')?'你的兴趣与阅读偏好':'你的兴趣')+'「' + matches.map(t=>t.topic).join('、') + '」' : '匹配本次检索「' + query + '」', score: matches.reduce((n,t)=>n+t.weight,0) + (db.feedback[x.Url] === 'later' ? 1 : 0) + (positive.includes(plain(x.AuthorName)) && plain(x.AuthorName) ? 1 : 0)};
      }).sort((a,b) => b.score - a.score).slice(0, 6);
      return {query, results, hiddenReadCount};
    }
    if (method === 'POST' && pathname === '/api/feedback') {
      if (!zhihuUrl(body.url) || !['later','dislike'].includes(body.value)) fail('无效反馈');
      db.feedback[body.url] = body.value; if (body.value === 'later') { db.readLater ||= []; if (!db.readLater.some(x => x.url === body.url)) db.readLater.unshift({title: text(body.title, 300), url: body.url}); }
      db.feedbackDetails[body.url] = {value:body.value,title:text(body.title,160),summary:text(body.summary,160),at:new Date().toISOString()};
      learning.schedule(); persist(); return {ok: true};
    }
    if (method === 'POST' && pathname === '/api/problems') {
      const title = text(body.title, 300); if (!title) fail('请输入你想解决的问题');
      const item = {id: crypto.randomUUID(), title, context: text(body.context, 3000), createdAt: new Date().toISOString(), plans: []}; db.problems.unshift(item); persist(); return item;
    }
    if (method === 'POST' && pathname === '/api/problems/update') {
      const item=db.problems.find(p=>p.id===body.id);if(!item)fail('问题不存在',404);
      if(body.title!==undefined){const title=text(body.title,300);if(!title)fail('请输入问题');item.title=title;}
      if(body.context!==undefined)item.context=text(body.context,3000);
      persist();return item;
    }
    if (method === 'POST' && pathname === '/api/clips') {
      const quote = text(body.quote); if (!quote) fail('请先选择原文'); if (!zhihuUrl(body.url)) fail('摘录来源必须是知乎 HTTPS 页面');
      if (body.problemId && !db.problems.some(p => p.id === body.problemId)) fail('问题不存在');
      const item = {id: crypto.randomUUID(), quote, title: text(body.title, 400), url: body.url.slice(0, 2500), author: text(body.author, 200), note: text(body.note, 4000), stance: ['值得尝试','解释了原因','我有疑问','不适合我'].includes(body.stance) ? body.stance : '值得尝试', kind: body.kind === '金句' ? '金句' : '划线', problemId: body.problemId || '', prefix: text(body.prefix, 100), suffix: text(body.suffix, 100), context: text(body.context, 2400), createdAt: new Date().toISOString()};
      db.clips.unshift(item); learning.schedule(); persist(); return item;
    }
    if (method === 'POST' && pathname === '/api/clips/update') {
      const clip = db.clips.find(c => c.id === body.id); if (!clip) fail('摘录不存在', 404);
      if (body.problemId && !db.problems.some(p => p.id === body.problemId)) fail('问题不存在');
      for (const key of ['note','problemId']) if (body[key] !== undefined) clip[key] = text(body[key], key === 'note' ? 4000 : 100);
      if (['值得尝试','解释了原因','我有疑问','不适合我'].includes(body.stance)) clip.stance = body.stance;
      learning.schedule(); persist(); return clip;
    }
    if (method === 'POST' && pathname === '/api/clips/delete') { db.clips = db.clips.filter(c => c.id !== body.id); learning.schedule(); persist(); return {ok:true}; }
    if (method === 'POST' && pathname === '/api/explain') {
      const clip = db.clips.find(c => c.id === body.id); if (!clip) fail('摘录不存在', 404);
      const answer = await ai('解释下面这段摘录。依次给出：通俗解释、一个标明为 AI 补充的例子、作者观点与事实的区别、上下文不足之处。不要把摘录当成已证实事实。\n' + JSON.stringify({quote:clip.quote, context:clip.context, note:clip.note, title:clip.title,readingPreferences:db.memory.preferences}));
      clip.explanation = answer; persist(); return {answer};
    }
    if (method === 'POST' && pathname === '/api/plan') {
      const p = db.problems.find(p => p.id === body.problemId); if (!p) fail('问题不存在', 404);
      const selected = new Set(Array.isArray(body.clipIds) ? body.clipIds : []);
      const clips = db.clips.filter(c => c.problemId === p.id && selected.has(c.id));
      if (!clips.length) fail('请至少选择一条属于这个问题的摘录');
      if (clips.length > 30) fail('一次最多整理 30 条摘录');
      const evidence = clips.map(c => ({ref: c.id.slice(0,8), quote:c.quote, note:c.note, stance:c.stance, title:c.title, author:c.author, url:c.url}));
      const answer = await ai('请基于用户明确选择的资料生成可修改的行动方案。只使用以下资料；若资料不足应指出缺口。readingPreferences是用户主动填写的阅读目标与限制，仅用于个性化表达和行动约束，当前问题的明确要求优先，不得当作事实证据。引用只能用这里存在的 [摘录:ref] 编号，每个主要建议标注依据；不得把质疑或不适合的摘录当作赞同。区分用户批注、作者观点与 AI 推断，不把相关性当因果。输出：1 问题与限制 2 关键依据与分歧 3 今天和之后的具体行动 4 调整条件 5 验证方法 6 缺失资料。\n' + JSON.stringify({question:p.title, constraints:p.context, readingPreferences:db.memory.preferences, evidence}));
      const plan = {id:crypto.randomUUID(), text:answer, clipIds:clips.map(c => c.id), evidence, createdAt:new Date().toISOString()}; p.plans.unshift(plan); persist(); return plan;
    }
    if (method === 'POST' && pathname === '/api/plan/update') { const p = db.problems.find(p => p.id === body.problemId); const plan = p?.plans.find(x => x.id === body.id); if (!plan) fail('方案不存在',404); plan.text = text(body.text, 60000); persist(); return {ok:true}; }
    fail('接口不存在', 404);
  }
  const web = createWeb({token,route,revision:()=>revision,openExtension});
  const server = http.createServer(async (req,res) => {
    try { await web.handle(req,res,server.address()?.port); }
    catch(e) { res.statusCode=e.status || 500; res.end(JSON.stringify({error:e.status ? e.message : '本地处理失败，请重试。'})); }
  });
  return {server, token, route, launchUrl:()=>web.launchUrl(server.address().port), state: () => db, configState, readCredentials:secrets, ask: prompt => ai(prompt), dispose:()=>{learning.dispose();web.dispose();}};
}
module.exports = {createService, zhihuUrl};
