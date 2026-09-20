const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const APPS=['janessa','andi','kole','karar','aziz','rodrigo','ash'];
function boot(f){
  const html=fs.readFileSync('/home/claude/'+f+'.html','utf8');
  const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.detail?e.detail.message:e.message));
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://elvt.test/'});
  dom.window.matchMedia=q=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},save(){},translate(){},rotate(){},fillRect(){},restore(){}});
  return {dom,errs,ev:c=>{try{return dom.window.eval(c)}catch(e){return 'ERR:'+e.message}}};
}
const fmt=d=>d?new Date(d).toDateString().slice(4):'-';
console.log('WHAT EACH APP ACTUALLY SAYS\n'+'='.repeat(78));
for(const f of APPS){
  const {dom,ev}=boot(f);
  const start=ev('typeof START!=="undefined"?START.getTime():null');
  const end=ev('typeof END!=="undefined"?END.getTime():(typeof RACE!=="undefined"?RACE.getTime():null)');
  const key=ev('KEY');
  const wks=ev('W.length');
  const today=ev('JSON.stringify(todayIdx())');
  const drive=(fs.readFileSync('/home/claude/'+f+'.html','utf8').match(/folders\/([A-Za-z0-9_-]+)/)||[])[1];
  const meals=ev('typeof MEALS!=="undefined"?MEALS.length:(typeof MEALS_BASE!=="undefined"?MEALS_BASE.length:(typeof BASE_MEALS!=="undefined"?BASE_MEALS.length:0))');
  const tgt=ev('typeof TARGET!=="undefined"?JSON.stringify(TARGET):(typeof TARGET_BASE!=="undefined"?JSON.stringify(TARGET_BASE):(typeof macrosFor!=="undefined"?"day-specific":"none"))');
  const mealsum=ev('(()=>{const M=(typeof MEALS!=="undefined")?MEALS:(typeof MEALS_BASE!=="undefined"?MEALS_BASE:(typeof BASE_MEALS!=="undefined"?BASE_MEALS:[]));const t=[0,0,0,0];M.forEach(m=>m.m.forEach((v,i)=>t[i]+=v));return JSON.stringify(t);})()');
  const split=ev('(()=>{const D=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];const o=[];for(let d=0;d<7;d++){S.week=1;S.day=d;o.push(D[d]+" "+session(1,d).title);}return o.join(" | ");})()');
  const habits=ev('typeof HABITS!=="undefined"?HABITS.map(h=>h.n).join(", "):"none"');
  const ex=ev('Object.keys(EX).length'), uv=ev('new Set(Object.values(EX).map(e=>e.v)).size');
  console.log(`\n${f.toUpperCase()}`);
  console.log(`  program      ${fmt(start)}  ->  ${fmt(end)}   (${wks} weeks)   today: ${today}`);
  console.log(`  storage      ${key}      drive: ${drive}`);
  console.log(`  nutrition    target ${tgt}   meals ${meals} summing ${mealsum}`);
  console.log(`  split        ${split}`);
  console.log(`  habits       ${habits}`);
  console.log(`  exercises    ${ex} movements, ${uv} unique videos`);
  dom.window.close();
}
