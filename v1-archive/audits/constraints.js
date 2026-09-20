const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
function boot(f){
  const dom=new JSDOM(fs.readFileSync('/home/claude/'+f+'.html','utf8'),{runScripts:'dangerously',url:'https://elvt.test/',virtualConsole:new VirtualConsole()});
  dom.window.matchMedia=q=>({matches:false,addListener(){},removeListener(){}});
  dom.window.HTMLCanvasElement.prototype.getContext=()=>({});
  return {dom,ev:c=>{try{return dom.window.eval(c)}catch(e){return 'ERR '+e.message}}};
}
// every exercise name that appears anywhere in the 84 days
const allNames=ev=>ev(`(()=>{const s=new Set();for(let w=1;w<=12;w++)for(let d=0;d<7;d++){S.week=w;S.day=d;session(w,d).items.forEach(i=>s.add(i.n));}return JSON.stringify([...s]);})()`);
const CHECKS={
 janessa:[['no barbell back squat',n=>!n.some(x=>/back squat/i.test(x))],
          ['no conventional deadlift',n=>!n.some(x=>/^deadlift|conventional deadlift/i.test(x))],
          ['no barbell squat of any kind',n=>!n.some(x=>/barbell squat/i.test(x))],
          ['5 lifting days + 2 recovery',(n,ev)=>ev(`(()=>{let l=0;for(let d=0;d<7;d++){S.week=4;S.day=d;if(session(4,d).tag==='Lift'||session(4,d).tag==='Deload')l++;}return l;})()`)===5]],
 andi:[['knee routine is a tracked daily habit',(n,ev)=>ev('HABITS.some(h=>/knee/i.test(h.n))')===true],
       ['no calorie tracking anywhere',(n,ev)=>ev('typeof MEALS==="undefined"||MEALS.length===0')===true],
       ['no protein powder or bars in any food content',()=> !/protein powder|protein bar/i.test(fs.readFileSync('/home/claude/andi.html','utf8'))],
       ['runs are walk-run intervals, never plain runs',(n,ev)=>/walk/i.test(ev(`(()=>{S.week=3;S.day=1;return session(3,1).note+session(3,1).items.map(i=>i.meta).join(' ');})()`))]],
 karar:[['no barbell bench press anywhere',n=>!n.some(x=>/barbell bench|bench press/i.test(x)&&!/dumbbell|db /i.test(x))],
        ['chest pressing is dumbbell only',n=>n.filter(x=>/press/i.test(x)&&/chest|bench|flat|incline/i.test(x)).every(x=>/DB|dumbbell/i.test(x))],
        ['zone 2 is walking, never running',(n,ev)=>ev(`(()=>{S.week=1;S.day=1;return session(1,1).title;})()`).toLowerCase().includes('walk')],
        ['Thursday is a true rest day',(n,ev)=>ev(`(()=>{S.week=1;S.day=3;return session(1,3).tag;})()`)==='Rest'],
        ['3 lifting days only',(n,ev)=>ev(`(()=>{let l=0;for(let d=0;d<7;d++){S.week=1;S.day=d;const t=session(1,d).tag;if(t==='Lift'||t==='Deload')l++;}return l;})()`)===3]],
 aziz:[['two full rest days',(n,ev)=>ev(`(()=>{let r=0;for(let d=0;d<7;d++){S.week=1;S.day=d;if(session(1,d).tag==='Rest')r++;}return r;})()`)===2],
       ['exactly one run',(n,ev)=>ev(`(()=>{let r=0;for(let d=0;d<7;d++){S.week=1;S.day=d;if(session(1,d).tag==='Run')r++;}return r;})()`)===1],
       ['no walking lunge (knee)',n=>!n.some(x=>/lunge/i.test(x))],
       ['leg press noted moderate depth',n=>n.some(x=>/moderate depth/i.test(x))]],
 rodrigo:[['Wednesday is a full rest day',(n,ev)=>ev(`(()=>{S.week=1;S.day=2;return session(1,2).tag;})()`)==='Rest'],
          ['exactly 2 strength days',(n,ev)=>ev(`(()=>{let s=0;for(let d=0;d<7;d++){S.week=1;S.day=d;if(session(1,d).items.some(i=>i.swap&&i.ex))s++;}return s;})()`)===2],
          ['long run carries during-run fuelling',(n,ev)=>ev(`(()=>{S.week=1;S.day=5;return session(1,5).items.map(i=>i.n+i.meta).join(' ');})()`).toLowerCase().includes('carb')],
          ['race lands on week 10 Sunday',(n,ev)=>ev(`(()=>{S.week=10;S.day=6;return session(10,6).tag;})()`)==='Race']],
 kole:[['every lift session opens with a warm-up',(n,ev)=>ev(`(()=>{let ok=true;for(let d of [0,2,3,4,5]){S.week=1;S.day=d;if(!/Warm-Up/.test(session(1,d).items[0].n))ok=false;}return ok;})()`)===true],
       ['every lift session ends with a cool-down',(n,ev)=>ev(`(()=>{let ok=true;for(let d of [0,2,3,4,5]){S.week=1;S.day=d;const it=session(1,d).items;if(!/Cool-Down/.test(it[it.length-1].n))ok=false;}return ok;})()`)===true],
       ['water is in oz not ml',()=>/WATER_GOAL=100/.test(fs.readFileSync('/home/claude/kole.html','utf8'))],
       ['energy and mood card present',(n,ev)=>ev('typeof metricsCard==="function"')===true],
       ['all 5 meal lines tickable once top-up chosen',(n,ev)=>ev(`(()=>{S.week=1;S.day=0;setTopup(0);return mealsToday().filter(m=>!m.pick||m.chosen).length;})()`)===5]],
 ash:[['weight log is in kg not lbs',()=>/\+' kg'/.test(fs.readFileSync('/home/claude/ash.html','utf8'))],
      ['Zone 2 ceiling of 145 stated',()=>/145/.test(fs.readFileSync('/home/claude/ash.html','utf8'))],
      ['no mention of Jiu Jitsu anywhere',()=>!/jiu.?jitsu/i.test(fs.readFileSync('/home/claude/ash.html','utf8'))],
      ['fixed 5-meal plan',(n,ev)=>ev('MEALS.length')===5]]
};
console.log('CLIENT CONSTRAINT CHECK\n'+'='.repeat(70));
let bad=0;
for(const f of Object.keys(CHECKS)){
  const {dom,ev}=boot(f);
  const names=JSON.parse(allNames(ev));
  console.log('\n'+f.toUpperCase());
  for(const [label,fn] of CHECKS[f]){
    let ok;try{ok=fn(names,ev);}catch(e){ok='ERR '+e.message;}
    if(ok!==true)bad++;
    console.log('   '+(ok===true?'ok  ':'FAIL')+'  '+label+(ok===true?'':'   -> '+ok));
  }
  dom.window.close();
}
console.log('\n'+'='.repeat(70));
console.log(bad===0?'ALL CLIENT CONSTRAINTS ENFORCED IN CODE':bad+' CONSTRAINT FAILURE(S)');
