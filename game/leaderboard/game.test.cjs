const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const physics=require('../../docs/games/orbit/physics.js');
test('every planet is collectible regardless of mass',()=>{
  const state=physics.create();state.bodies=state.bodies.slice(0,2);
  state.bodies.push({x:1.005,y:0,vx:0,vy:Math.sqrt(4*Math.PI**2),m:6e-6});
  physics.step(state,new Set());assert(state.alive);assert.equal(state.collected,1);
});
test('seconds timer, pause, reset, completion score, timeout',()=>{
  let frame,now=0,result,state,win=false;
  const nodes=new Map(),ctx=new Proxy({},{get:()=>()=>{}});
  function node(id){if(!nodes.has(id))nodes.set(id,{textContent:'',addEventListener(){},focus(){},setAttribute(){},getContext:()=>ctx,getBoundingClientRect:()=>({width:800,height:420})});return nodes.get(id);}
  const sandbox={console,Math,Set,performance:{now:()=>now},Image:class{},requestAnimationFrame:f=>frame=f,
    document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){}},window:{devicePixelRatio:1,addEventListener(){}},
    OrbitScores:{start(){},reset(){},isOpen:()=>false,open:r=>result=r},
    OrbitPhysics:{...physics,create(){return state=physics.create();},step(){if(win)state.collected=10;}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../docs/games/orbit/game.js'),'utf8'),sandbox);
  const tick=t=>{now=t;frame(t);};
  tick(0);node('#play').onclick();tick(1000);assert.equal(node('#arcade-time').textContent,'001');
  node('#play').onclick();tick(10000);assert.equal(node('#arcade-time').textContent,'001');
  node('#play').onclick();win=true;tick(11000);assert(result.won);assert.equal(result.score,2);
  node('#reset').onclick();tick(12000);assert.equal(node('#arcade-time').textContent,'000');
  win=false;node('#play').onclick();tick(1011000);assert.equal(node('#arcade-time').textContent,'999');assert(result.timedOut);assert(!result.won);
});
