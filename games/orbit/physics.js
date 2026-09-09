/* Browser adaptation of game/orbit-game.py. AU, years, solar masses.
 * Fixed-step velocity Verlet replaces the desktop REBOUND IAS15 integrator. */
(function (root) {
  const G = 4 * Math.PI ** 2;
  function create(random = Math.random) {
    const bodies = [{x:0,y:0,vx:0,vy:0,m:1}, {x:1,y:0,vx:0,vy:Math.sqrt(G),m:3e-6}];
    for (let i=0;i<10;i++) {
      const m=3e-6*(.2+1.8*random()), r=.8+.7*random(), f=random()*2*Math.PI, v=Math.sqrt(G/r);
      bodies.push({x:r*Math.cos(f),y:r*Math.sin(f),vx:-v*Math.sin(f),vy:v*Math.cos(f),m});
    }
    return {bodies,t:0,alive:true,collected:0};
  }
  function frame(p,s) {
    const vx=p.vx-s.vx,vy=p.vy-s.vy,v=Math.hypot(vx,vy)||1;
    const u=[vx/v,vy/v]; let n=[-u[1],u[0]];
    if(n[0]*(p.x-s.x)+n[1]*(p.y-s.y)<0) n=n.map(x=>-x);
    return {u,n};
  }
  function elements(p,s) {
    const x=p.x-s.x,y=p.y-s.y,vx=p.vx-s.vx,vy=p.vy-s.vy;
    const r=Math.hypot(x,y),mu=G*(s.m+p.m),v2=vx*vx+vy*vy,rv=x*vx+y*vy;
    const ex=((v2-mu/r)*x-rv*vx)/mu,ey=((v2-mu/r)*y-rv*vy)/mu;
    const e=Math.hypot(ex,ey),a=1/(2/r-v2/mu),omega=e>1e-8?Math.atan2(ey,ex):0;
    const f=Math.atan2(y,x)-omega,h=x*vy-y*vx;
    const E=e<1?2*Math.atan2(Math.sqrt(1-e)*Math.sin(f/2),Math.sqrt(1+e)*Math.cos(f/2)):NaN;
    return {a,e,omega,f,M:E-e*Math.sin(E),P:a>0?2*Math.PI*Math.sqrt(a**3/mu):NaN,inc:h>=0?0:Math.PI};
  }
  function accelerations(b) {
    const acc=b.map(()=>[0,0]);
    for(let i=0;i<b.length;i++) for(let j=i+1;j<b.length;j++) {
      const dx=b[j].x-b[i].x,dy=b[j].y-b[i].y,d=Math.max(Math.hypot(dx,dy),1e-5),k=G/d**3;
      acc[i][0]+=k*b[j].m*dx; acc[i][1]+=k*b[j].m*dy;
      acc[j][0]-=k*b[i].m*dx; acc[j][1]-=k*b[i].m*dy;
    }
    return acc;
  }
  const planetRadius = q => Math.max(3,Math.cbrt(q.m)*180);
  function touchesShip(p,s,q,view) {
    const {u}=frame(p,s),dx=(q.x-p.x)*view.scale,dy=(q.y-p.y)*view.scale;
    // Circle against the ship's rotated sprite rectangle, in CSS pixels.
    const x=dx*u[0]+dy*u[1],y=-dx*u[1]+dy*u[0];
    const outsideX=Math.max(0,Math.abs(x)-view.width/2);
    const outsideY=Math.max(0,Math.abs(y)-view.height/2);
    return Math.hypot(outsideX,outsideY)<=planetRadius(q);
  }
  function step(state,keys,dt=.00025,view=null) {
    if(!state.alive)return;
    const b=state.bodies,p=b[1],s=b[0],{u,n}=frame(p,s);
    const tangent=Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown'));
    const normal=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
    const tx=tangent*u[0]+normal*n[0],ty=tangent*u[1]+normal*n[1],norm=Math.hypot(tx,ty);
    if(norm){p.vx+=15*tx/norm*dt;p.vy+=15*ty/norm*dt;}
    let acc=accelerations(b);
    b.forEach((q,i)=>{q.vx+=acc[i][0]*dt/2;q.vy+=acc[i][1]*dt/2;q.x+=q.vx*dt;q.y+=q.vy*dt;});
    acc=accelerations(b);
    b.forEach((q,i)=>{q.vx+=acc[i][0]*dt/2;q.vy+=acc[i][1]*dt/2;});
    state.t+=dt;
    if(Math.hypot(p.x-s.x,p.y-s.y)<.035){state.alive=false;return;}
    for(let j=b.length-1;j>=2;j--) if(view?touchesShip(p,s,b[j],view):Math.hypot(p.x-b[j].x,p.y-b[j].y)<Math.cbrt(p.m)) {
      p.m+=b[j].m*5;b.splice(j,1);state.collected++;
    }
  }
  const api={create,frame,elements,step,planetRadius,touchesShip};
  if(typeof module!=='undefined')module.exports=api;else root.OrbitPhysics=api;
})(globalThis);
