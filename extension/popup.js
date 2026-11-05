const status=document.querySelector('#status');
async function send(message){const r=await chrome.runtime.sendMessage(message);if(r?.error)throw Error(r.error);return r?.data;}
async function check(){status.textContent='正在检查连接…';try{const s=await send({action:'STATUS'});status.textContent=s.connected?`已连接看山 · 已收好 ${s.clips} 段文字`:'尚未连接 · 打开阅读伙伴后自动连接';}catch(e){status.textContent=e.message+' 已配对的连接会在桌宠恢复后自动重试。';}}
document.querySelector('#open').onclick=()=>send({action:'OPEN_WORKBENCH'}).catch(e=>status.textContent=e.message);
document.querySelector('#check').onclick=check;
document.querySelector('#disconnect').onclick=async()=>{try{await send({action:'DISCONNECT'});status.textContent='已断开连接，本机笔记保持保存。';}catch(e){status.textContent=e.message;}};
document.querySelector('#read').onclick=async()=>{try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!/^https:\/\/(www|zhuanlan)\.zhihu\.com\//.test(tab?.url||''))throw Error('请先打开一篇知乎回答或文章。');await chrome.tabs.sendMessage(tab.id,{action:'OPEN_READER'});window.close();}catch(e){status.textContent=e.message.includes('Receiving end')?'请刷新知乎页面，再打开插件。':e.message;}};
check();