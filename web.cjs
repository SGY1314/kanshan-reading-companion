const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function createWeb({token, route, revision, openExtension = async () => {}}) {
  const launches = new Map();
  const sessions = new Map();
  const assets = new Set(['index.html','app.js','bridge.js','style.css','kanshan.png','icon.png','favicon.ico']);
  const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};
  const reject = (message, status) => { throw Object.assign(new Error(message), {status}); };
  function launchUrl(port) {
    const now = Date.now();
    for (const [code, until] of launches) if (until < now) launches.delete(code);
    const code = crypto.randomBytes(32).toString('hex');
    launches.set(code, now + 60000);
    return `http://127.0.0.1:${port}/#launch=${code}`;
  }
  async function handle(req, res, port) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if (![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)) reject('无效主机',403);
    const origin = req.headers.origin;
    const sameOrigin = origin === `http://${req.headers.host}`;
    const pathname = new URL(req.url,'http://localhost').pathname;
    if (req.method === 'GET' && !pathname.startsWith('/api/')) {
      if (origin && !sameOrigin) reject('不允许的来源',403);
      const name = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!assets.has(name)) reject('页面不存在',404);
      res.setHeader('Content-Type',types[path.extname(name)]);
      res.end(fs.readFileSync(path.join(__dirname,'ui',name === 'favicon.ico' ? 'icon.ico' : name)));
      return;
    }
    const isExtension = /^chrome-extension:\/\/[a-p]{32}$/.test(origin || '');
    if (origin && !sameOrigin && !isExtension) reject('不允许的来源',403);
    let body;
    async function readBody() {
      if (body) return body;
      const chunks = []; let size = 0;
      for await (const part of req) { size += part.length; if (size > 600000) reject('请求过大',413); chunks.push(part); }
      const raw = Buffer.concat(chunks).toString('utf8');
      try { body = raw ? JSON.parse(raw) : {}; } catch { reject('JSON 格式错误',400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) reject('请求正文必须是对象',400);
      return body;
    }
    if (pathname === '/api/session' && req.method === 'POST') {
      if (!sameOrigin || !req.headers['content-type']?.startsWith('application/json')) reject('请从桌宠打开阅读界面',403);
      const {code} = await readBody();
      const until = launches.get(code);
      launches.delete(code);
      if (!until || until < Date.now()) reject('打开链接已失效，请重新点击桌宠。',401);
      const session = crypto.randomBytes(32).toString('hex');
      for (const [key, expiry] of sessions) if (expiry < Date.now()) sessions.delete(key);
      sessions.set(session,Date.now()+12*60*60*1000);
      res.setHeader('Set-Cookie',`kanshan_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
      res.end(JSON.stringify({ok:true}));
      return;
    }
    const session = /(?:^|;\s*)kanshan_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    const paired = req.headers.authorization === 'Bearer '+token;
    const browser = session && sessions.get(session) > Date.now();
    if (!paired && !browser) reject('请点击桌宠打开阅读界面，或检查插件连接码。',401);
    if (browser && !paired && (isExtension || (req.method !== 'GET' && (!sameOrigin || !req.headers['content-type']?.startsWith('application/json'))))) reject('不允许的来源',403);
    if (pathname === '/api/connection' && req.method === 'GET' && browser) {
      res.end(JSON.stringify({token}));
      return;
    }
    if (pathname === '/api/extension' && req.method === 'POST' && browser) {
      await openExtension();
      res.end(JSON.stringify({ok:true}));
      return;
    }
    if (pathname === '/api/revision' && req.method === 'GET') {
      res.end(JSON.stringify({revision:revision()}));
      return;
    }
    const result = await route(req.method,pathname,await readBody());
    res.end(JSON.stringify(result));
  }
  return {handle,launchUrl,dispose:()=>{launches.clear();sessions.clear();}};
}
module.exports = {createWeb};
