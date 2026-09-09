(() => {
  const P=OrbitPhysics,canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
  const spaceship=new Image();
  spaceship.src='spaceship.png';
  const sunSprite=new Image();
  sunSprite.src='sun.png';
  const shipWidth=36;
  const shipHeight=()=>spaceship.naturalWidth?shipWidth*spaceship.naturalHeight/spaceship.naturalWidth:shipWidth;
  function viewScale(){
    const s=state.bodies[0],p=state.bodies[1],rect=canvas.getBoundingClientRect();
    return Math.min(rect.width,rect.height)*.45/Math.max(1.7,Math.hypot(p.x-s.x,p.y-s.y)*1.2);
  }
  const hud=document.querySelector('#hud'),play=document.querySelector('#play'),status=document.querySelector('#status');
  let state=P.create(),running=false,guide=false,last=0,accumulator=0,w=0,h=0,finished=false,seconds=0;
  const keys=new Set(),stars=Array.from({length:220},()=>[Math.random(),Math.random(),Math.random()]);
  function pause(){running=false;keys.clear();play.textContent='Resume';}
  function toggle(){if(!state.alive||finished||OrbitScores.isOpen())return;running=!running;last=performance.now();keys.clear();play.textContent=running?'Pause':'Resume';status.textContent=running?'In flight':'Paused';if(running){OrbitScores.start();canvas.focus();}}
  play.onclick=toggle;
  document.querySelector('#reset').onclick=()=>{state=P.create();running=false;finished=false;seconds=0;keys.clear();accumulator=0;OrbitScores.reset();play.textContent='Start';status.textContent='Ready to start · New planetary system.';};
  document.querySelector('#high-scores').onclick=()=>{pause();OrbitScores.open();};
  document.querySelector('#guide').onclick=e=>{guide=!guide;e.target.setAttribute('aria-pressed',guide);};
  canvas.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')){e.preventDefault();keys.add(e.key);}if(e.code==='Space'){e.preventDefault();if(!e.repeat)toggle();}});
  window.addEventListener('keyup',e=>keys.delete(e.key));
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  canvas.addEventListener('blur',()=>keys.clear());
  document.querySelectorAll('[data-key]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{e.preventDefault();if(!running&&state.alive)toggle();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.key));
    button.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();keys.add(button.dataset.key);}});
    button.addEventListener('keyup',()=>keys.delete(button.dataset.key));
    button.addEventListener('blur',()=>keys.delete(button.dataset.key));
  });
  function draw(){
    const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    if(w!==rect.width||h!==rect.height){w=rect.width;h=rect.height;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
    ctx.fillStyle='#081322';ctx.fillRect(0,0,w,h);
    stars.forEach(([x,y,b])=>{ctx.fillStyle=`rgba(205,224,255,${.2+b*.5})`;ctx.fillRect(x*w,y*h,1+b,1+b);});
    const s=state.bodies[0],p=state.bodies[1],o=P.elements(p,s);
    const scale=viewScale();
    const xy=(x,y)=>[w/2+(x-s.x)*scale,h/2-(y-s.y)*scale];
    function path(points,color,dashed=false){ctx.beginPath();points.forEach(([x,y],i)=>{const q=xy(x,y);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.setLineDash(dashed?[4,5]:[]);ctx.stroke();ctx.setLineDash([]);}
    function dot(x,y,r,color){ctx.beginPath();ctx.arc(...xy(x,y),r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();}
    if(o.a>0&&o.e<1){
      const points=Array.from({length:241},(_,i)=>{const f=i/240*2*Math.PI,r=o.a*(1-o.e**2)/(1+o.e*Math.cos(f));return [s.x+r*Math.cos(f+o.omega),s.y+r*Math.sin(f+o.omega)];});
      path(points,'#547999');
      if(guide){
        path(Array.from({length:161},(_,i)=>[s.x+o.a*Math.cos(i/160*2*Math.PI),s.y+o.a*Math.sin(i/160*2*Math.PI)]),'#ac82db',true);
        const angle=o.M+o.omega,c=Math.cos(angle),sn=Math.sin(angle),gx=s.x+o.a*c,gy=s.y+o.a*sn,ae=o.a*Math.min(o.e,.2);
        path(Array.from({length:161},(_,i)=>{const f=i/160*2*Math.PI,x=-ae*Math.cos(f),y=2*ae*Math.sin(f);return[gx+x*c-y*sn,gy+x*sn+y*c];}),'#d4abff');
        path([[s.x,s.y],[gx,gy],[p.x,p.y]],'#795a9b');dot(gx,gy,3,'#d4abff');
      }
    }
    if(sunSprite.complete&&sunSprite.naturalWidth){
      const [x,y]=xy(s.x,s.y),size=48,height=size*sunSprite.naturalHeight/sunSprite.naturalWidth;
      ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(sunSprite,x-size/2,y-height/2,size,height);ctx.restore();
    }else{dot(s.x,s.y,11,'#ffd27a');dot(s.x,s.y,6,'#fff0bb');}
    state.bodies.slice(2).forEach(q=>dot(q.x,q.y,P.planetRadius(q),'#9ad8bf'));
    if(state.alive){
      const pos=xy(p.x,p.y);
      ctx.save();ctx.translate(...pos);ctx.rotate(-Math.atan2(p.vy-s.vy,p.vx-s.vx));
      if(keys.size&&running){ctx.beginPath();ctx.moveTo(-16,-4);ctx.lineTo(-27,0);ctx.lineTo(-16,4);ctx.fillStyle='#ffb66f';ctx.fill();}
      if(spaceship.complete&&spaceship.naturalWidth){
        ctx.imageSmoothingEnabled=false;
        const size=shipWidth,height=shipHeight();
        ctx.drawImage(spaceship,-size/2,-height/2,size,height);
      }else{
        ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-7,-5);ctx.lineTo(-4,0);ctx.lineTo(-7,5);ctx.closePath();ctx.fillStyle='#a5e6ff';ctx.fill();
      }
      ctx.restore();
    }
    const num=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):'—',deg=n=>num(((n*180/Math.PI)%360+360)%360,1);
    hud.textContent=`ORBITAL ELEMENTS\nt       ${num(state.t)} yr\na       ${num(o.a)} AU\ne       ${num(o.e)}\ni       ${deg(o.inc)}°\nω       ${deg(o.omega)}°\nf       ${deg(o.f)}°\nM       ${deg(o.M)}°\nPeriod  ${num(o.P)} yr\nCollected ${state.collected}`;
  }
  function tick(now){
    const wallElapsed=Math.max(0,(now-last)/1000),elapsed=Math.min(wallElapsed,.05);last=now;
    if(running&&state.alive&&!finished){
      seconds=Math.min(999,seconds+wallElapsed);
      accumulator+=elapsed*.12;
      while(accumulator>=.00025&&state.alive&&state.collected<10&&seconds<999){P.step(state,keys,.00025,{scale:viewScale(),width:shipWidth,height:shipHeight()});accumulator-=.00025;}
      if(!state.alive||state.collected===10||seconds>=999){
        const won=state.alive&&state.collected===10;
        finished=true;pause();play.textContent=won?'You win!':'Game over';
        status.textContent=won?'All ten planets collected! Reset to play again.':seconds>=999?'Time up! Reset to try again.':'Ship lost. Reset to try a new planetary system.';
        OrbitScores.open({won,collected:state.collected,score:Math.ceil(seconds),timedOut:seconds>=999});
      }
    }else accumulator=0;
    document.querySelector('#arcade-time').textContent=String(Math.ceil(seconds)).padStart(3,'0');
    draw();requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
