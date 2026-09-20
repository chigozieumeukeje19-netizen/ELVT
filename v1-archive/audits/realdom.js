const fs=require('fs');
const {JSDOM}=require('jsdom');
const files=process.argv.slice(2);
(async()=>{
for(const f of files){
  const html=fs.readFileSync('/home/claude/'+f+'.html','utf8');
  const errs=[];
  const vc=new (require('jsdom').VirtualConsole)();
  vc.on('jsdomError',e=>errs.push(e.message+(e.detail?' :: '+e.detail.message:'')));
  vc.on('error',(...a)=>errs.push('console.error '+a.join(' ')));
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://elvt.test/'});
  dom.window.matchMedia = dom.window.matchMedia || (q=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
  dom.window.HTMLCanvasElement.prototype.getContext = ()=>({clearRect(){},save(){},translate(){},rotate(){},fillRect(){},restore(){},set fillStyle(v){}});
  try{ dom.window.eval('render();'); }catch(e){ errs.push('render() threw: '+e.message); }
  await new Promise(r=>setTimeout(r,120));
  const d=dom.window.document;
  const ids=['sessionCard','metricsCard','nutritionCard','groceryCard','dailyCard','photosCard','pastCard','pepCard'];
  const filled=ids.filter(i=>d.getElementById(i)).map(i=>({id:i,len:(d.getElementById(i).innerHTML||'').length}));
  console.log('\n=== '+f.toUpperCase()+' ===');
  if(errs.length){ console.log('  *** RUNTIME ERRORS ***'); errs.forEach(e=>console.log('   '+e.split('\n')[0])); }
  filled.forEach(x=>console.log('   '+(x.len>50?'ok   ':'EMPTY').padEnd(6)+x.id.padEnd(15)+x.len+' chars'));
  const empty=filled.filter(x=>x.len<=50).map(x=>x.id);
  console.log('   -> '+(errs.length===0&&empty.length===0?'RENDERS FULLY':'BROKEN: '+(empty.join(', ')||'js error')));
  dom.window.close();
}
})();
