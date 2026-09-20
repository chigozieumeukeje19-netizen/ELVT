const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const ALL=['janessa','andi','kole','karar','aziz','rodrigo','ash'];
const TRACKS=['janessa','kole','karar','aziz','rodrigo','ash']; // andi has no calorie tracker by design
function boot(f){
  const dom=new JSDOM(fs.readFileSync('/home/claude/'+f+'.html','utf8'),{runScripts:'dangerously',url:'https://elvt.test/',virtualConsole:new VirtualConsole()});
  dom.window.matchMedia=q=>({matches:false,addListener(){},removeListener(){}});
  dom.window.HTMLCanvasElement.prototype.getContext=()=>({});
  return {dom,src:fs.readFileSync('/home/claude/'+f+'.html','utf8'),
    fn:n=>{try{return dom.window.eval('typeof '+n)==='function'}catch(e){return false}},
    ev:c=>{try{return dom.window.eval(c)}catch(e){return 'ERR '+e.message}}};
}
const CORE=[
 ['exercise checkbox',      b=>b.fn('toggle')],
 ['customise (pencil)',     b=>b.fn('editItem')&&b.fn('saveCustom')],
 ['exercise swap',          b=>b.fn('swapEx')&&b.fn('doSwap')],
 ['day swap',               b=>b.fn('daySwap')&&b.fn('doDaySwap')],
 ['weight log',             b=>b.fn('logWeight')&&b.fn('saveWeight')],
 ['Monday weigh-in',        b=>b.fn('logMorningWeight')],
 ['Monday photos + weigh-in', b=>b.fn('photosCard')&&b.fn('logMorningWeight')&&!/drive\.google\.com/.test(b.src)],
 ['past weeks',             b=>b.fn('pastCard')],
 ['streak',                 b=>b.fn('streak')],
 ['countdown',              b=>b.fn('countdown')],
 ['daily habits',           b=>b.fn('dailyCard')],
 ['week + day strips',      b=>b.fn('weekStrip')&&b.fn('dayStrip')],
 ['back to today',          b=>b.fn('jumpToday')],
 ['add to home screen',     b=>b.fn('openA2')],
 ['confetti',               b=>b.fn('confetti')],
 ['NO notes fields',        b=>!/textarea/i.test(b.src)],
];
const NUTRI=[
 ['meal checkboxes',        b=>b.fn('toggleMeal')],
 ['custom day target',      b=>b.fn('customTarget')&&b.fn('saveTarget')&&b.fn('resetTarget')],
 ['manual food log',        b=>b.fn('addExtra')&&b.fn('saveExtra')&&b.fn('delExtra')],
 ['per-week or per-day target', b=>b.fn('targetFor')||b.fn('macrosFor')],
 ['meals move with target', b=>b.fn('mealsToday')||b.fn('macrosFor')],
];
const SPECIAL={
 janessa:[['swap list',b=>b.fn('swapList')],['grocery list',b=>b.fn('groceryCard')],['protocol card',b=>b.fn('pepCard')]],
 andi   :[['swap list',b=>b.fn('swapList')],['grocery list',b=>b.fn('groceryCard')],['recipes',b=>b.fn('recipes')],
          ['knee routine habit',b=>b.ev('HABITS.some(h=>/knee/i.test(h.n))')===true]],
 kole   :[['tap-to-log library',b=>b.fn('quickAdd')],['top-up picker',b=>b.fn('pickTopup')],
          ['energy/mood card',b=>b.fn('metricsCard')],['grocery list',b=>b.fn('groceryCard')],
          ['warm-ups',b=>/wuUpper/.test(b.src)]],
 karar  :[['swap list',b=>b.fn('swapList')],['grocery list',b=>b.fn('groceryCard')]],
 aziz   :[['swap list',b=>b.fn('swapList')],['grocery list',b=>b.fn('groceryCard')]],
 rodrigo:[['swap list',b=>b.fn('swapList')],['metrics card',b=>b.fn('metricsCard')],
          ['protocol card',b=>b.fn('pepCard')],['grocery list',b=>b.fn('groceryCard')]],
 ash    :[['swap list',b=>b.fn('swapList')],['grocery list',b=>b.fn('groceryCard')]],
};
console.log('FEATURE COMPLETENESS — nothing deleted that should stay\n'+'='.repeat(66));
let miss=[];
for(const f of ALL){
  const b=boot(f);
  const rows=[...CORE, ...(TRACKS.includes(f)?NUTRI:[]), ...(SPECIAL[f]||[])];
  const bad=rows.filter(([l,fn])=>{try{return fn(b)!==true}catch(e){return true}});
  console.log(`\n${f.toUpperCase().padEnd(9)} ${rows.length} features   ${bad.length?'*** MISSING '+bad.length+' ***':'all present'}`);
  bad.forEach(([l])=>{console.log('   MISSING  '+l);miss.push(f+': '+l);});
  b.dom.window.close();
}
console.log('\n'+'='.repeat(66));
console.log(miss.length?'GAPS:\n  '+miss.join('\n  '):'NOTHING MISSING ACROSS ALL SEVEN');
