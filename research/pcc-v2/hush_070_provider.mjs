import {createServer} from 'node:http';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {randomBytes} from 'node:crypto';

// Research-only loopback provider. Local rename is NOT power-loss durability.
const file=process.env.HUSH070_FILE;
const mode=process.env.HUSH070_MODE;
const crashFirst=process.env.HUSH070_CRASH_FIRST==='1';
if(!file||!['naive','guarded'].includes(mode))throw Error('BAD_FIXTURE_CONFIGURATION');
function read(){
  const s=JSON.parse(readFileSync(file,'utf8'));
  if(s.v!==1||!Number.isSafeInteger(s.effects)||!Number.isSafeInteger(s.crashes)||
     !Array.isArray(s.keys)||s.effects<0||s.crashes<0)throw Error('INVALID_STATE');
  return s;
}
function save(s){
  const temp=file+'.'+randomBytes(8).toString('hex')+'.tmp';
  writeFileSync(temp,JSON.stringify(s),{mode:0o600});
  renameSync(temp,file);
}
const server=createServer(async(req,res)=>{
  const send=(code,obj)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(obj));};
  if(req.url!=='/effect'||req.method!=='POST')return send(404,{status:'NOT_FOUND'});
  let raw='';for await(const chunk of req)raw+=chunk.toString();
  let body;try{body=JSON.parse(raw)}catch{return send(400,{status:'BAD_JSON'})}
  const key=body.idempotency_key;
  if(typeof key!=='string'||!/^HUSH070_[A-Za-z0-9_]{1,40}$/.test(key)||
     typeof body.credential!=='string'||!body.credential.startsWith('HUSH070_TEST_'))
    return send(400,{status:'INVALID_REQUEST'});
  const s=read();
  if(mode==='guarded'&&s.keys.includes(key))return send(200,{status:'ALREADY_COMMITTED'});
  s.effects++;
  if(mode==='guarded')s.keys.push(key);
  const crash=crashFirst&&s.crashes===0;
  if(crash)s.crashes++;
  save(s); // effect and idempotency key share the synthetic file transaction
  if(crash){server.close();setImmediate(()=>process.exit(74));return;}
  send(200,{status:'COMMITTED'});
});
server.listen(0,'127.0.0.1',()=>process.stdout.write('PORT '+server.address().port+'\n'));
