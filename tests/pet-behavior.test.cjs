const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const {createPetBehavior}=require('../ui/pet-behavior.js');
test('idle behavior avoids repetition, sleeps after inactivity and honors frequency',()=>{
 let time=0;const b=createPetBehavior({now:()=>time,random:()=>0});assert.equal(b.next(),'closeReading');assert.equal(b.next(),'thinking');assert.equal(b.delay(),12000);
 b.setFrequency('quiet');assert.equal(b.delay(),24000);time=120001;assert.notEqual(b.next(),'dozing');time=240001;assert.equal(b.next(),'dozing');assert.notEqual(b.next(),'dozing');b.active();time+=10000;assert.notEqual(b.next(),'dozing');b.setFrequency('lively');assert.equal(b.delay(),7000);assert.equal(b.setFrequency('invalid'),'lively');
});
test('pet returns from poses, wakes on approach, merges saves and queues them during landing',()=>{
 const dom=new JSDOM('<body data-state="reading"><button id="fox"></button><div id="pet-caption"></div><button id="menu"></button></body>',{runScripts:'outside-only'});const w=dom.window;let time=0,id=0;const timers=new Map(),events={};
 w.Date.now=()=>time;w.Math.random=()=>0;w.setTimeout=(fn,delay)=>{timers.set(++id,{fn,at:time+delay});return id;};w.clearTimeout=key=>timers.delete(key);
 const advance=ms=>{const target=time+ms;for(;;){const due=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;time=due[1].at;timers.delete(due[0]);due[1].fn();}time=target;};
 w.kanshan={onSaved:fn=>events.saved=fn,onMotion:fn=>events.motion=fn,onFrequency:fn=>events.frequency=fn,onReset:fn=>events.reset=fn,show(){},menu(){}};
 for(const file of ['pet-behavior.js','pet.js'])w.eval(fs.readFileSync(path.join(__dirname,'../ui',file),'utf8'));
 const state=()=>w.document.body.dataset.state;
 for(const [pose,duration]of [['sittingReading',10500],['closeReading',6500],['swaying',6000],['stretching',4200]]){events.motion(pose);assert.equal(state(),pose);advance(duration);assert.equal(state(),'reading');}
 events.motion('dozing');w.document.querySelector('#fox').dispatchEvent(new w.Event('pointerenter'));assert.equal(state(),'waking');advance(1800);assert.equal(state(),'reading');
 events.motion('closeReading');events.saved();assert.equal(w.document.body.dataset.feedback,'saved');advance(800);events.saved();advance(1000);assert.equal(w.document.body.dataset.feedback,'saved');advance(600);assert.equal(state(),'closeReading');advance(6500);assert.equal(state(),'reading');
 events.motion('dragging');assert.equal(state(),'dragging');advance(3200);assert.equal(state(),'landing');advance(1100);assert.equal(state(),'tidying');advance(3600);assert.equal(state(),'reading');
 for(const [motion,edge]of [['edgeLeft','left'],['edgeRight','right'],['edgeTop','top']]){events.motion(motion);assert.equal(state(),'edge');assert.equal(w.document.body.dataset.edge,edge);advance(5000);assert.equal(state(),'reading');}
 events.motion('edgeLeft');events.saved();assert.equal(w.document.body.dataset.feedback,'saved');advance(1600);assert.equal(state(),'edge');assert.equal(w.document.body.dataset.edge,'left');events.reset();
 events.motion('landing');advance(1100);assert.equal(state(),'tidying');events.motion('greeting');advance(3600);assert.equal(state(),'reading');
 w.eval("setState('landing')");events.saved();assert.equal(w.document.body.dataset.feedback,undefined);w.eval('readAgain()');assert.equal(w.document.body.dataset.feedback,'saved');advance(1600);assert.equal(state(),'reading');dom.window.close();
});
