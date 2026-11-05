function createPetBehavior({now=Date.now,random=Math.random,frequency='natural'}={}){
 const settings={quiet:{min:24000,max:42000,sleep:240000},natural:{min:12000,max:23000,sleep:120000},lively:{min:7000,max:13000,sleep:90000}};
 const durations={sittingReading:10500,closeReading:6500,swaying:6000,stretching:4200,dozing:14000,waking:1800,greeting:1800,thinking:6500,annotating:7500};
 let mode=settings[frequency]?frequency:'natural',lastActivity=now(),lastDoze=-Infinity,lastAction='';
 return {
  setFrequency(value){if(settings[value])mode=value;return mode;},
  frequency:()=>mode,
  active(){lastActivity=now();},
  delay(){const s=settings[mode];return s.min+random()*(s.max-s.min);},
  duration(state){return durations[state]||0;},
  next(){const time=now(),s=settings[mode];if(time-lastActivity>=s.sleep&&time-lastDoze>=s.sleep){lastDoze=time;lastAction='dozing';return 'dozing';}const choices=mode==='quiet'?['closeReading','thinking','annotating','swaying','sittingReading']:['closeReading','thinking','annotating','swaying','stretching','sittingReading'];const available=choices.filter(s=>s!==lastAction);lastAction=available[Math.min(available.length-1,Math.floor(random()*available.length))];return lastAction;}
 };
}
if(typeof module!=='undefined')module.exports={createPetBehavior};
