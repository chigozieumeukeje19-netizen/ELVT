const fs=require('fs'),vm=require('vm');
const FILES=['kole','janessa','andi','aziz','rodrigo','karar','ash'];
const results={}, drives={}, keys={};

function boot(f){
  const h=fs.readFileSync('/home/claude/'+f+'.html','utf8');
  const js=h.split('<script>')[1].split('</script>')[0];
  const store={}; let pageY=1500; const scrollCalls=[];
  const mk=id=>store[id]||(store[id]={id,innerHTML:'',textContent:'',classList:{add(){},remove(){}},
    querySelector:()=>({offsetLeft:400,offsetWidth:52}),scrollLeft:0,clientWidth:340,value:'',focus(){}});
  const ctx={window:{matchMedia:()=>({matches:false}),get pageYOffset(){return pageY;},
      scrollTo:(a,b)=>scrollCalls.push(typeof a==='object'?a.top:b)},
    navigator:{userAgent:'iPhone',maxTouchPoints:5},
    localStorage:{_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v}},
    document:{documentElement:{scrollTop:1500},getElementById:mk,
      createElement:()=>({style:{},getContext:()=>({}),remove(){}}),body:{appendChild(){}}},
    requestAnimationFrame:()=>{},innerWidth:400,innerHeight:800,setTimeout:()=>{},clearTimeout:()=>{},console:{log(){},error(){}}};
  vm.createContext(ctx); vm.runInContext(js,ctx);
  return {h,js,ctx,store,scrollCalls};
}

for(const f of FILES){
  const R=[]; const add=(ok,msg)=>R.push([ok,msg]);
  let B;
  try{ B=boot(f); }catch(e){ results[f]=[[false,'BOOT FAILED: '+e.message]]; continue; }
  const {h,js,ctx,store,scrollCalls}=B;
  const run=code=>vm.runInContext(code,ctx);

  // 1. syntax
  try{ new vm.Script(js); add(true,'JS parses'); }catch(e){ add(false,'SYNTAX: '+e.message); }

  // 2. scroll never jumps on re-render
  scrollCalls.length=0;
  run("S.week=1;S.day=0;render();");
  add(!scrollCalls.includes(0) && !h.includes('scrollIntoView'),
      'render() never scrolls page to top');

  // 3. every one of 84 days renders with items
  const bad=run(`(()=>{let b=[];for(let w=1;w<=12;w++)for(let d=0;d<7;d++){S.week=w;S.day=d;
    const s=session(w,d); if(!s.title||!s.items.length)b.push(w+'-'+d);} return b;})()`);
  add(bad.length===0,'all 84 days render'+(bad.length?' FAILED at '+bad.join(','):''));

  // 4. countdown strictly decrements and reflects viewed day
  const cd=run(`(()=>{let last=null,bad=0,n=0,lbl='';for(let w=1;w<=12;w++)for(let d=0;d<7;d++){
    S.week=w;S.day=d;countdown();
    const v=parseInt(document.getElementById('cdN').textContent,10);
    const L=document.getElementById('cdL').textContent;
    if(L!==lbl){last=null;lbl=L;}            // label change = new phase, restart the sequence
    if(!isNaN(v)){n++;if(last!==null&&Math.abs(v-last)!==1)bad++;last=v;}} return {bad,n};})()`);
  add(cd.bad===0 && cd.n>60,`countdown sequential across ${cd.n} days`);

  // 5. photos Monday only
  const ph=run(`(()=>{let mon=0,leak=0;for(let w=1;w<=12;w++)for(let d=0;d<7;d++){S.week=w;S.day=d;render();
    const x=document.getElementById('photosCard').innerHTML;
    if(d===0){if(x.length>50)mon++;}else if(x!=='')leak++;} return {mon,leak};})()`);
  add(ph.mon===12&&ph.leak===0,`photos on 12 Mondays, ${ph.leak} leaks`);

  // 6. no video shared across DIFFERENT exercise names
  const vid=run(`(()=>{const m={};for(const k in EX){(m[EX[k].v]=m[EX[k].v]||[]).push(EX[k].n);}
    return Object.entries(m).filter(([v,n])=>new Set(n).size>1).map(([v,n])=>v+': '+[...new Set(n)].join(' / '));})()`);
  add(vid.length===0,'no reused videos'+(vid.length?' -> '+vid.join(' ; '):''));

  // 7. every onclick handler actually exists
  let html='';
  run("S.week=1;S.day=0;render();");
  for(const id of Object.keys(store)) html+=store[id].innerHTML||'';
  const fns=[...new Set([...html.matchAll(/onclick="(\w+)\(/g)].map(m=>m[1]))];
  const missing=fns.filter(fn=>run(`typeof ${fn}`)!=='function');
  add(missing.length===0,`${fns.length} onclick handlers defined`+(missing.length?' MISSING: '+missing.join(','):''));

  // 8. weight-log only on rep-based work
  const wl=run(`(()=>{let bad=[];for(let w=1;w<=12;w++)for(let d=0;d<7;d++){S.week=w;S.day=d;
    session(w,d).items.forEach(i=>{ if(i.wt && !/sets|reps|\\u00d7/.test(i.meta||'')) bad.push(w+'-'+d+' '+i.n); });}
    return [...new Set(bad)];})()`);
  add(wl.length===0,'weight-log only on set-based work'+(wl.length?' -> '+wl.slice(0,3).join(', '):''));

  // 9. user text is escaped (XSS / layout break)
  const esc=run(`(()=>{try{S.week=1;S.day=0;const id=session(1,0).items[0].id;
    const st=dstate(1,0);st.cu[id]='<img src=x onerror=alert(1)>';
    sessionCard();const o=document.getElementById('sessionCard').innerHTML;
    delete st.cu[id]; return o.includes('&lt;img') && !/<img src=x/.test(o);}catch(e){return 'ERR '+e.message;}})()`);
  add(esc===true,'custom text is escaped');

  // 10. storage key + drive folder uniqueness
  const K=run("KEY"); keys[K]=(keys[K]||[]).concat(f);
  const dm=h.match(/drive\.google\.com\/drive\/(?:u\/\d\/)?folders\/([A-Za-z0-9_-]+)/);
  if(dm){ drives[dm[1]]=(drives[dm[1]]||[]).concat(f); }
  add(true,'storage key '+K);

  // 11. week switching preserves prior week data
  const keep=run(`(()=>{S.week=1;S.day=0;const st=dstate(1,0);st.c['x']=1;
    S.week=5;render();S.week=1;render();return dstate(1,0).c['x']===1;})()`);
  add(keep===true,'week switching is non-destructive');

  // 12. streak never throws / never negative
  const stk=run("(()=>{try{const n=streak();return (typeof n==='number'&&n>=0)?true:'bad '+n;}catch(e){return 'THREW '+e.message;}})()");
  add(stk===true,'streak computes cleanly');

  results[f]=R;
}

// cross-file checks
console.log('='.repeat(74));
for(const f of FILES){
  const R=results[f], fails=R.filter(r=>!r[0]);
  console.log(`\n${f.toUpperCase()}  ${fails.length?'*** '+fails.length+' ISSUE(S) ***':'clean'}`);
  R.forEach(([ok,m])=>console.log('   '+(ok?'ok  ':'FAIL')+'  '+m));
}
console.log('\n'+'='.repeat(74));
console.log('\nCROSS-CLIENT CHECKS');
const dupK=Object.entries(keys).filter(([k,v])=>v.length>1);
console.log('  storage keys unique per client:',dupK.length===0?'yes':'NO -> '+JSON.stringify(dupK));
const dupD=Object.entries(drives).filter(([k,v])=>v.length>1);
console.log('  Drive folders unique per client:',dupD.length===0?'yes':'NO -> '+JSON.stringify(dupD));
console.log('  clients with a Drive link:',Object.values(drives).flat().length,'of',FILES.length,
            Object.values(drives).flat().length<FILES.length?'-> missing: '+FILES.filter(f=>!Object.values(drives).flat().includes(f)):'');
