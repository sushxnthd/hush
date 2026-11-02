import {createServer} from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,rmdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';

// Research-only provider replica. Two OS processes share a file. No fsync,
// network partition, malicious provider or real credential is modeled.
const file=process.env.HUSH069_FILE,mode=process.env.HUSH069_MODE;
if(!file||!['stale','guarded'].includes(mode))throw Error('INVALID_FIXTURE_CONFIGURATION');
const lock=file+'.lock';
let phase='idle',release=null;
function read(){
  try{
    const s=JSON.parse(readFileSync(file,'utf8'));
    if(s.v!==1||typeof s.revoked!=='boolean'||![s.pending,s.effects,s.epoch].every(Number.isSafeInteger)||
      s.pending<0||s.effects<0||s.epoch<0)return null;
    return s;
  }catch{return null;}
}
function save(s){
  const temp=file+'.'+randomBytes(8).toString('hex')+'.tmp';
  writeFileSync(temp,JSON.stringify(s),{mode:0o600});
  renameSync(temp,file);
}
function locked(fn){
  try{mkdirSync(lock);}catch{return {status:503,body:{status:'LOCK_UNAVAILABLE'}};}
  try{return fn();}finally{rmdirSync(lock);}
}
const server=createServer(async(req,res)=>{
  const send=(code,obj)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(obj));};
  let body='';for await(const c of req)body+=c.toString('utf8');
  if(req.url==='/phase')return send(200,{phase});
  if(req.url==='/state')return send(200,read()||{status:'STATE_UNAVAILABLE'});
  if(req.url==='/release'&&req.method==='POST'){
    if(!release)return send(409,{status:'NOT_WAITING'});
    const wake=release;release=null;wake();return send(200,{status:'RELEASED'});
  }
  if(req.url==='/enqueue'&&req.method==='POST'){
    let v;try{v=JSON.parse(body);}catch{return send(400,{status:'BAD_JSON'});}
    if(typeof v.credential!=='string'||!v.credential.startsWith('HUSH069_TEST_'))return send(400,{status:'INVALID'});
    const result=locked(()=>{
      const s=read();if(!s)return {status:503,body:{status:'STATE_UNAVAILABLE'}};
      if(s.revoked)return {status:403,body:{status:'REVOKED'}};
      s.pending++;save(s);return {status:202,body:{status:'QUEUED'}};
    });return send(result.status,result.body);
  }
  if(req.url==='/revoke'&&req.method==='POST'){
    const result=locked(()=>{
      const s=read();if(!s)return {status:503,body:{status:'STATE_UNAVAILABLE'}};
      s.revoked=true;s.epoch++;save(s);
      return {status:200,body:{status:'REVOKED',epoch:s.epoch}};
    });return send(result.status,result.body);
  }
  if(req.url==='/commit'&&req.method==='POST'){
    if(phase!=='idle')return send(409,{status:'BUSY'});
    let stale;
    if(mode==='stale'){
      stale=read();if(!stale)return send(503,{status:'STATE_UNAVAILABLE'});
      if(stale.revoked||!stale.pending)return send(403,{status:'NOT_AUTHORIZED'});
    }
    phase=mode==='stale'?'checked':'waiting';
    await new Promise(resolve=>{release=resolve;});
    phase='committing';
    let result;
    if(mode==='stale'){
      stale.pending--;stale.effects++;save(stale);
      result={status:200,body:{status:'COMMITTED_FROM_STALE_SNAPSHOT'}};
    }else{
      result=locked(()=>{
        const s=read();if(!s)return {status:503,body:{status:'STATE_UNAVAILABLE'}};
        if(s.revoked||!s.pending)return {status:403,body:{status:'REVOKED_AT_COMMIT'}};
        s.pending--;s.effects++;save(s);
        return {status:200,body:{status:'COMMITTED'}};
      });
    }
    phase='idle';return send(result.status,result.body);
  }
  send(404,{status:'UNKNOWN'});
});
server.listen(0,'127.0.0.1',()=>process.stdout.write('PORT '+server.address().port+'\n'));
