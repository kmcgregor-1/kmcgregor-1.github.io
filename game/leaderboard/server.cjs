const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const MAX_FILE = 4096, MAX_ROWS = 100;
const valid = s => s && typeof s.name==='string' && /^[A-Z]{3}$/.test(s.name) && Number.isInteger(s.score) && s.score >= 1 && s.score <= 999;
function createService({directory, origin, now = Date.now, minGameMs = 5000} = {}) {
  if (!directory || !origin) throw new Error('DATA_DIR and SITE_ORIGIN are required');
  fs.mkdirSync(directory, {recursive:true, mode:0o700});
  // Separate the seconds leaderboard from legacy point scores without deleting them.
  const file = path.join(directory, 'fastest-times.txt');
  let scores = [];
  if (fs.existsSync(file)) {
    if (fs.statSync(file).size > MAX_FILE) throw new Error('Score file exceeds size limit');
    scores = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => {
      const [name, value] = line.split('\t'); return {name, score:Number(value)};
    });
    if (scores.length > MAX_ROWS || !scores.every(valid)) throw new Error('Invalid score file');
  }
  const buckets = new Map(), sessions = new Map();
  let globalWindow = now(), globalRequests = 0, writeWindow = now(), writes = 0;
  function prune(t) {
    for (const [k,b] of buckets) if (t-b.time >= 600000) buckets.delete(k);
    for (const [k,s] of sessions) if (t-s.time >= 3600000) sessions.delete(k);
  }
  function reply(res, code, payload) {res.writeHead(code, {'Content-Type':'application/json'});res.end(JSON.stringify(payload));}
  const server = http.createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const t=now();prune(t);
    if(t-globalWindow>=60000){globalWindow=t;globalRequests=0;}
    if(++globalRequests>600) return reply(res,429,{error:'Server busy. Try again later.'});
    // Never trust user-supplied forwarding headers. Behind a proxy, this safely
    // shares one bucket unless the deployment supplies an authenticated IP layer.
    const ip=req.socket.remoteAddress;
    if(req.headers.origin && req.headers.origin!==origin) return reply(res,403,{error:'Origin not allowed'});
    if(req.headers.origin===origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
      res.writeHead(204);return res.end();
    }
    if(req.method==='GET'&&req.url==='/scores')return reply(res,200,{scores});
    if(req.method!=='POST'||!['/sessions','/scores'].includes(req.url))return reply(res,404,{error:'Not found'});
    if(req.headers.origin!==origin)return reply(res,403,{error:'Origin required'});
    if(!buckets.has(ip)){if(buckets.size>=10000)return reply(res,503,{error:'Try later'});buckets.set(ip,{time:t,requests:0});}
    const bucket=buckets.get(ip);
    if(++bucket.requests>12)return reply(res,429,{error:'Submission limit reached. Try again in ten minutes.'});
    if(req.headers['content-type']!=='application/json')return reply(res,415,{error:'JSON required'});
    if(Number(req.headers['content-length'])>512)return reply(res,413,{error:'Request too large'});
    let length=0,chunks=[];
    try {
      for await(const chunk of req){length+=chunk.length;if(length>512){reply(res,413,{error:'Request too large'});return;}chunks.push(chunk);}
      const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(!data||typeof data!=='object'||Array.isArray(data))return reply(res,400,{error:'Invalid request'});
      if(req.url==='/sessions'){
        if(sessions.size>=1000)return reply(res,503,{error:'Too many active games'});
        const token=randomBytes(24).toString('hex');sessions.set(token,{ip,time:t});return reply(res,201,{token});
      }
      const session=sessions.get(data.token);
      if(!session||session.ip!==ip||now()-session.time>=3600000)return reply(res,403,{error:'Game session expired. Start a new game.'});
      if(now()-session.time<minGameMs)return reply(res,429,{error:'Please wait a moment before submitting.'});
      if(!valid(data))return reply(res,400,{error:'Use three letters A–Z and a valid score'});
      if(now()-writeWindow>=60000){writeWindow=now();writes=0;}
      if(writes>=10)return reply(res,429,{error:'Leaderboard busy. Try again in a minute.'});
      const next=[...scores,{name:data.name,score:data.score}].sort((a,b)=>a.score-b.score).slice(0,MAX_ROWS);
      const text=next.map(s=>`${s.name}\t${s.score}\n`).join('');
      if(Buffer.byteLength(text)>MAX_FILE)throw new Error('Storage limit');
      // Synchronous atomic replacement serializes writes in this single process.
      // Two bounded files at most; never append submissions or request logs.
      fs.writeFileSync(file+'.tmp',text,{mode:0o600});fs.renameSync(file+'.tmp',file);
      scores=next;writes++;sessions.delete(data.token);
      return reply(res,201,{scores});
    }catch(error){if(!res.headersSent)reply(res,error instanceof SyntaxError?400:500,{error:'Unable to save score'});}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=2000;server.maxConnections=100;
  return server;
}
if(require.main===module){
  const server=createService({directory:process.env.DATA_DIR,origin:process.env.SITE_ORIGIN});
  server.listen(Number(process.env.PORT||8080),process.env.HOST||'127.0.0.1');
}
module.exports={createService};
