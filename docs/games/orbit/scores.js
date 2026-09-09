/* Bounded browser storage; exported text is regenerated, never appended. */
(() => {
  const KEY='orbit-fastest-times-v2',LIMIT=100,MAX_BYTES=12000;
  const dialog=document.querySelector('#score-dialog'),form=document.querySelector('#score-form');
  const input=document.querySelector('#initials'),message=document.querySelector('#score-message');
  let scores=[],pending=null;
  const API=(window.ORBIT_SCORE_API||'').replace(/\/$/,'');
  let tokenPromise=null,saving=false,generation=0;
  async function request(route,data){
    const response=await fetch(API+route,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});
    const body=await response.json();if(!response.ok)throw new Error(body.error||'Leaderboard unavailable');return body;
  }
  function start(){if(API&&!tokenPromise)tokenPromise=request('/sessions',{}).then(x=>x.token).catch(()=>null);}
  function reset(){tokenPromise=null;pending=null;generation++;}
  function valid(x){return x&&/^[A-Z]{3}$/.test(x.name)&&Number.isInteger(x.score)&&x.score>=1&&x.score<=999;}
  try{const raw=localStorage.getItem(KEY);if(raw&&raw.length<=MAX_BYTES){const parsed=JSON.parse(raw);if(Array.isArray(parsed))scores=parsed.filter(valid).slice(0,LIMIT);}}catch{}
  function render(){
    scores.sort((a,b)=>a.score-b.score);
    const list=document.querySelector('#score-list');list.replaceChildren();
    scores.forEach((entry,index)=>{
      const li=document.createElement('li');
      for(const text of [String(index+1).padStart(2,'0'),entry.name,`${String(entry.score).padStart(3,'0')} s`]){
        const span=document.createElement('span');span.textContent=text;li.append(span);
      }
      list.append(li);
    });
    if(!scores.length){const li=document.createElement('li');li.className='score-empty';li.textContent=API?'LOADING…':'NO SCORES YET';list.append(li);}
  }
  function open(result=null){
    dialog.classList.toggle('leaderboard-only',!result);
    pending=result?.won?result:null;
    document.querySelector('#score-title').textContent=result?(result.won?'YOU WIN!':result.timedOut?'TIME UP!':'GAME OVER'):'Fastest times';
    document.querySelector('#score-summary').textContent=result?`${result.collected}/10 planets collected · ${result.score} seconds. ${result.won?'System cleared!':'Finish all ten to qualify for the leaderboard.'}`:(API?'Shared top 100 completion times — fastest first.':'Top 100 completion times on this browser — fastest first.');
    form.hidden=!pending;message.textContent=API?'Loading shared leaderboard…':'Times are saved on this browser. Download a text copy below.';
    if(API){scores=[];const current=++generation;request('/scores').then(data=>{if(current!==generation)return;scores=data.scores.filter(valid).slice(0,LIMIT);render();if(!scores.length)document.querySelector('#score-list').firstChild.textContent='NO SCORES YET';message.textContent='Shared leaderboard · Top 100 scores.';}).catch(()=>{if(current===generation){message.textContent='Shared leaderboard unavailable. Please try again later.';document.querySelector('#score-list').firstChild.textContent='SCORES UNAVAILABLE';}});}
    render();if(!dialog.open)dialog.showModal();if(result)input.focus();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!pending||saving)return;
    const name=input.value.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(name)){message.textContent='Enter exactly three letters (A–Z).';return;}
    if(API){
      saving=true;const result=pending,current=++generation;
      try{
        const token=await tokenPromise;if(!token)throw new Error('No online game session. Reset and start a new game to submit.');
        const data=await request('/scores',{name,score:result.score,token});
        if(current!==generation)return;
        scores=data.scores.filter(valid).slice(0,LIMIT);pending=null;form.hidden=true;message.textContent='Score saved to the shared leaderboard.';render();
      }catch(error){if(current===generation)message.textContent=error.message;}finally{saving=false;}
      return;
    }
    scores.push({name,score:pending.score});scores.sort((a,b)=>a.score-b.score);scores=scores.slice(0,LIMIT);
    pending=null;form.hidden=true;
    try{localStorage.setItem(KEY,JSON.stringify(scores));message.textContent='Score saved on this browser.';}catch{message.textContent='Browser storage unavailable. Download your scores to keep them.';}
    render();
  });
  document.querySelector('#close-scores').onclick=()=>dialog.close();
  document.querySelector('#download-scores').onclick=()=>{
    const text='ORBIT GAME — FASTEST TIMES (SECONDS)\n'+scores.map((s,i)=>`${String(i+1).padStart(3)}  ${s.name}  ${s.score} s`).join('\n')+'\n';
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='orbit-high-scores.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  window.OrbitScores={open,start,reset,isOpen:()=>dialog.open};
})();
