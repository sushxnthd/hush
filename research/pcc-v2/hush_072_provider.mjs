import {createServer} from 'node:http';
import fs from 'node:fs';

const ledger=process.argv[2];
if(!ledger) throw new Error('HUSH072_LEDGER_REQUIRED');
let releaseCommit;
const committed=new Promise(resolve=>{releaseCommit=resolve;});
let count=0;
const server=createServer(async(req,res)=>{
  if(req.method!=='POST'||req.url!=='/effect'){res.writeHead(404);res.end();return;}
  let body='';
  for await(const chunk of req) body+=chunk.toString('utf8');
  let parsed;
  try{parsed=JSON.parse(body);}catch{res.writeHead(400);res.end();return;}
  if(!Number.isInteger(parsed?.privateBit)||![0,1].includes(parsed.privateBit)){
    res.writeHead(400);res.end();return;
  }
  process.send?.({phase:'provider_arrived'});
  await committed;
  const fd=fs.openSync(ledger,'a',0o600);
  try{fs.writeSync(fd,JSON.stringify({event:'effect',bit:parsed.privateBit})+'\n');fs.fsyncSync(fd);}
  finally{fs.closeSync(fd);}
  count++;
  process.send?.({phase:'provider_committed',count});
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({privateBit:parsed.privateBit,public:'ok'}));
});
process.on('message',msg=>{
  if(msg?.phase==='release_commit') releaseCommit();
});
server.listen(0,'127.0.0.1',()=>process.send?.({phase:'ready',port:server.address().port}));
