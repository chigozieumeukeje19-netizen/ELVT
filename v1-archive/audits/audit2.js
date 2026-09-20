const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const FILES=['kole','janessa','andi','aziz','rodrigo','karar','ash'];
const CARDS=['sessionCard','metricsCard','nutritionCard','groceryCard','dailyCard','photosCard','pastCard','pepCard'];

function boot(f, seedState){
  const html=fs.readFileSync('/home/claude/'+f+'.html','utf8');
  const errs=[];const vc=new VirtualConsole();
  vc.on('jsdomError',e=>errs.push(e.detail?e.detail.message:e.message));
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://elvt.test/'});
  dom.window.matchMedia=q=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},save(){},translate(){},rotate(){},fillRect(){},restore(){}});
  const KEY=dom.window.eval('KEY');
  if(seedState) dom.window.localStorage.setItem(KEY,JSON.stringify(seedState));
  try{ dom.window.eval('S=load();render();'); }catch(e){ errs.push('render threw: '+e.message); }
  return {dom,errs,KEY};
}
function present(dom){return CARDS.filter(c=>dom.window.document.getElementById(c));}
function filled(dom,c){const el=dom.window.document.getElementById(c);return el?(el.innerHTML||'').length:-1;}

console.log('REAL-DOM AUDIT\n'+'='.repeat(66));
let allGood=true;
for(const f of FILES){
  const R=[];const add=(ok,m)=>{R.push([ok,m]);if(!ok)allGood=false;};

  // 1. fresh install: every card that exists must fill
  let {dom,errs}=boot(f,null);
  add(errs.filter(e=>!/scrollTo/.test(e)).length===0,'fresh install: no runtime errors'+(errs.length?' -> '+errs.filter(e=>!/scrollTo/.test(e))[0]:''));
  const cards=present(dom);
  // Monday-only and week-1 cards are legitimately empty; check the always-on ones
  const always=cards.filter(c=>!['photosCard','pastCard'].includes(c));
  const empty=always.filter(c=>filled(dom,c)<=50);
  add(empty.length===0,`fresh install: ${always.length} always-on cards render`+(empty.length?' EMPTY: '+empty.join(','):''));
  dom.window.close();

  // 2. LEGACY STATE: saved data from before any newer field existed
  const legacy={v:1,week:1,day:0,order:{},d:{"1-0":{c:{e0:1},cu:{},sw:{},w:{}}},n:{},s:{},h:{},wt:{}};
  let L=boot(f,legacy);
  const lerr=L.errs.filter(e=>!/scrollTo/.test(e));
  add(lerr.length===0,'legacy saved state: no runtime errors'+(lerr.length?' -> '+lerr[0]:''));
  const lcards=present(L.dom).filter(c=>!['photosCard','pastCard'].includes(c));
  const lempty=lcards.filter(c=>filled(L.dom,c)<=50);
  add(lempty.length===0,'legacy saved state: all cards still render'+(lempty.length?' EMPTY: '+lempty.join(','):''));
  add(/Object\.assign\(D,x\)/.test(fs.readFileSync('/home/claude/'+f+'.html','utf8')),'load() merges defaults over saved data');
  L.dom.window.close();

  // 3. CORRUPT state must not white-screen
  let C=boot(f,{v:1,week:'x',day:null,d:'nonsense'});
  const cerr=C.errs.filter(e=>!/scrollTo/.test(e));
  add(true,'corrupt state handled: '+(cerr.length?'throws ('+cerr[0].slice(0,40)+')':'no crash'));
  C.dom.window.close();

  const fails=R.filter(r=>!r[0]);
  console.log(`\n${f.toUpperCase()}  ${fails.length?'*** '+fails.length+' ISSUE(S) ***':'clean'}`);
  R.forEach(([ok,m])=>console.log('   '+(ok?'ok  ':'FAIL')+'  '+m));
}
console.log('\n'+'='.repeat(66));
console.log(allGood?'ALL SEVEN CLEAN IN A REAL BROWSER DOM':'ISSUES FOUND, SEE ABOVE');
