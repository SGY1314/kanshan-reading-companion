const fox=document.querySelector('#fox'),caption=document.querySelector('#pet-caption'),bubble=document.querySelector('#bubble');
const behavior=createPetBehavior();
const idleStates=['reading','sittingReading','thinking','annotating','closeReading','swaying','stretching','dozing','waking','greeting'];
const lines={sittingReading:'坐下来，一页一页慢慢读',reading:'陪你读一会儿',thinking:'这一句，想再琢磨一下',annotating:'在页边留一点自己的想法',closeReading:'把这一页，再读仔细一点',swaying:'不着急，慢慢读就好',stretching:'读累了，伸个小懒腰',dozing:'读累了，眯一小会儿',waking:'醒啦，继续陪你读',greeting:'你来啦，一起读一会儿',dragging:'慢一点，我还没站稳呢',landing:'站稳啦，继续陪你',tidying:'蹲下来，整理一下思绪',edge:'就在这里，陪你读一会儿'};
let idleTimer,transitionTimer,actionTimer,feedbackTimer,pointer=null,dragging=false,suppressClick=false,dragPending=null,serial=0,feedbackPending=false,feedbackPrevious='reading',feedbackEdge='';
function clearFeedback(){clearTimeout(feedbackTimer);delete document.body.dataset.feedback;}
function setState(state,edge=''){clearFeedback();document.body.dataset.state=state;document.body.dataset.edge=edge;caption.textContent=lines[state]||lines.reading;}
function scheduleIdle(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(document.body.dataset.state!=='reading'||pointer||dragging)return;perform(behavior.next());},behavior.delay());}
function readAgain(){clearTimeout(actionTimer);setState('reading');if(feedbackPending)playSaved();else scheduleIdle();}
function perform(state){if(!behavior.duration(state)||pointer||dragging||!idleStates.includes(document.body.dataset.state))return;clearTimeout(idleTimer);clearTimeout(actionTimer);setState(state);actionTimer=setTimeout(()=>state==='dozing'?perform('waking'):readAgain(),behavior.duration(state));}
function playSaved(){if(!feedbackPending||pointer||dragging||![...idleStates,'edge'].includes(document.body.dataset.state))return;if(document.body.dataset.feedback==='saved'){clearTimeout(feedbackTimer);feedbackTimer=setTimeout(finishFeedback,1600);feedbackPending=false;return;}feedbackPending=false;feedbackPrevious=document.body.dataset.state;feedbackEdge=document.body.dataset.edge||'';clearTimeout(idleTimer);clearTimeout(actionTimer);setState('reading');document.body.dataset.feedback='saved';caption.textContent='这句话，替你收好啦';sound('save');feedbackTimer=setTimeout(finishFeedback,1600);}
function finishFeedback(){clearFeedback();if(feedbackPrevious==='edge'){setState('edge',feedbackEdge);return;}if(feedbackPrevious==='dozing'||feedbackPrevious==='waking')perform('waking');else if(['thinking','annotating','closeReading','swaying'].includes(feedbackPrevious))perform(feedbackPrevious);else readAgain();}
window.kanshan.onSaved?.(()=>{feedbackPending=true;playSaved();});
window.kanshan.onFrequency?.(value=>{behavior.setFrequency(value);if(document.body.dataset.state==='reading'&&!document.body.dataset.feedback)scheduleIdle();});
window.kanshan.frequency?.().then(value=>{behavior.setFrequency(value);if(document.body.dataset.state==='reading')scheduleIdle();}).catch(()=>{});
function previewMotion(state){
 if(pointer||dragging)return;
 behavior.active();clearTimeout(transitionTimer);clearTimeout(actionTimer);clearTimeout(idleTimer);hideBubble();setState('reading');
 if(state==='saved'){feedbackPending=true;playSaved();return;}
 if(state==='landing'){settle({});return;}
 if(state==='dragging'){setState('dragging');transitionTimer=setTimeout(()=>settle({}),3200);return;}
 const edges={edgeLeft:'left',edgeRight:'right',edgeTop:'top'};
 if(edges[state]){setState('edge',edges[state]);transitionTimer=setTimeout(readAgain,5000);return;}
 perform(state);
}
window.kanshan.onMotion?.(previewMotion);
function settle(result){clearTimeout(transitionTimer);hideBubble();sound('land');if(result?.edge){setState('edge',result.edge);return;}setState('landing');transitionTimer=setTimeout(()=>{setState('tidying');transitionTimer=setTimeout(readAgain,3600);},1100);}
fox.addEventListener('pointerenter',()=>{behavior.active();if(document.body.dataset.state==='dozing')perform('waking');else if(document.body.dataset.state==='reading'&&!document.body.dataset.feedback)perform('greeting');});
fox.addEventListener('pointerdown',e=>{if(e.button!==0||pointer)return;behavior.active();hideBubble();sound('click');window.kanshan.interact?.();clearFeedback();clearTimeout(idleTimer);clearTimeout(actionTimer);clearTimeout(transitionTimer);serial++;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,serial};dragging=false;suppressClick=false;fox.setPointerCapture(e.pointerId);});
fox.addEventListener('pointermove',e=>{if(!pointer||e.pointerId!==pointer.id||dragging||Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)<6)return;dragging=true;suppressClick=true;setState('dragging');const current=pointer.serial;dragPending=Promise.resolve(window.kanshan.dragStart()).catch(()=>({cancelled:true})).then(result=>{if(result?.cancelled&&current===serial){dragging=false;readAgain();}return result;});});
async function release(e){if(!pointer||e.pointerId!==pointer.id)return;const didDrag=dragging,current=pointer.serial;pointer=null;if(fox.hasPointerCapture(e.pointerId))fox.releasePointerCapture(e.pointerId);if(!didDrag){readAgain();return;}try{await dragPending;const result=await window.kanshan.dragEnd();if(current===serial){if(result?.thrown)setState('dragging');else settle(result);}}catch{readAgain();}finally{dragging=false;}}
fox.addEventListener('pointerup',release);fox.addEventListener('pointercancel',release);
fox.addEventListener('click',e=>{if(suppressClick){e.preventDefault();suppressClick=false;return;}window.kanshan.show();});
document.querySelector('#menu').onclick=()=>{hideBubble();window.kanshan.interact?.();window.kanshan.menu();};
document.addEventListener('contextmenu',e=>{e.preventDefault();window.kanshan.menu();});
window.addEventListener('blur',()=>{if(pointer)void release({pointerId:pointer.id});});
window.kanshan.onReset?.(()=>{serial++;pointer=null;dragging=false;behavior.active();clearTimeout(transitionTimer);hideBubble();readAgain();});
scheduleIdle();

let bubbleTimer,shrinkTimer,audioContext,petSettings={sound:true};
function sound(kind){if(!petSettings.sound)return;try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;audioContext??=new Ctx();if(audioContext.state==='suspended')audioContext.resume();const now=audioContext.currentTime,gain=audioContext.createGain(),osc=audioContext.createOscillator();const table={click:[660,.05],land:[170,.12],save:[880,.08]};const [freq,length]=table[kind]||table.click;osc.type='sine';osc.frequency.setValueAtTime(freq,now);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='land'?.07:.035,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+length);osc.connect(gain).connect(audioContext.destination);osc.start(now);osc.stop(now+length+.02);}catch{}}
function hideBubble(){clearTimeout(bubbleTimer);clearTimeout(shrinkTimer);if(bubble)bubble.dataset.on='0';document.body.dataset.bubble='0';document.body.style.setProperty('--bubble-h','0px');shrinkTimer=setTimeout(()=>window.kanshan.setBubble?.(0),220);}
function say(text,hold){if(!bubble||!text)return;clearTimeout(shrinkTimer);bubble.textContent=String(text).slice(0,80);const height=Math.min(150,Math.ceil(bubble.scrollHeight||0));if(!height)return;window.kanshan.setBubble?.(height);document.body.style.setProperty('--bubble-h',height+'px');document.body.dataset.bubble='1';bubble.dataset.on='1';clearTimeout(bubbleTimer);bubbleTimer=setTimeout(hideBubble,hold||9000);}
function applyConfig(next){if(!next||typeof next!=='object')return;petSettings={...petSettings,...next};}
window.kanshan.onSay?.(({text,hold})=>say(text,hold));
window.kanshan.onLanded?.(({edge})=>settle({edge}));
window.kanshan.onConfig?.(applyConfig);
const initialSettings=window.kanshan.settings?.();
if(initialSettings&&typeof initialSettings.then==='function')initialSettings.then(applyConfig).catch(()=>{});
