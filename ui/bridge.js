(() => {
  const launch = new URLSearchParams(location.hash.slice(1)).get('launch');
  if (launch) history.replaceState(null,'',location.pathname);
  async function request(method,route,body) {
    const response = await fetch(route,{method,credentials:'same-origin',headers:body === undefined ? {} : {'Content-Type':'application/json'},body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(75000)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '连接中断，请保持桌宠运行。');
    return result;
  }
  const ready = launch ? request('POST','/api/session',{code:launch}) : Promise.resolve();
  ready.catch(()=>{});
  const api = async (method,route,body) => { await ready; return request(method,route,body); };
  window.kanshan = {
    api,
    open: url => {
      const target = new URL(url);
      if (target.protocol !== 'https:' || !(target.hostname === 'zhihu.com' || target.hostname.endsWith('.zhihu.com'))) throw new Error('仅支持知乎链接');
      window.open(target.href,'_blank','noopener,noreferrer');
    },
    copyToken: async () => {
      const {token} = await api('GET','/api/connection');
      await navigator.clipboard.writeText(token);
    },
    extension: () => api('POST','/api/extension',{}),
    export: async text => {
      const url = URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));
      const a = document.createElement('a');
      a.href = url; a.download = '看山阅读笔记.md'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      return true;
    },
    onChange: callback => {
      let previous, busy = false;
      const poll = async () => {
        if (busy || document.hidden) return;
        busy = true;
        try {
          const {revision} = await api('GET','/api/revision');
          if (previous !== undefined && previous !== revision) await callback();
          previous = revision;
        } catch {} finally { busy = false; }
      };
      poll();
      const timer = setInterval(poll,2000);
      addEventListener('pagehide',()=>clearInterval(timer),{once:true});
    }
  };
})();
