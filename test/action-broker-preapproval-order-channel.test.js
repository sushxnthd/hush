import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ActionBroker} from '../src/action-broker.js';

// This is an intentionally insecure HTTP *wrapper/scheduler*, NOT a claimed
// exploit of a shipped Hush endpoint. Real broker requests remain unapproved.
const parity={'00':0,'01':1,'10':1,'11':0};
const PUBLIC_BODY=JSON.stringify({decision:'ask',approved:false});

async function world(privateBit,{fixedOrder=false}={}){
  let executions=0,credentialResolutions=0,approvals=0,commits=0;
  const broker=new ActionBroker({secretResolver:async()=>{
    credentialResolutions++;throw Error('unexpected secret resolution');
  }});
  broker.registerAdapter({name:'order52',actions:['noop'],authorizationScopes:{noop:parity},
    execute:async()=>{executions++;throw Error('unexpected adapter execution');}});
  broker.registerAuthorizationTransaction({
    transactionId:'tx',worlds:Object.keys(parity),globalAuthorization:parity
  });
  const pending=new Map();
  let firstSent=false,firstPath=null;
  const server=createServer((req,res)=>{
    if(req.url==='/ack'){
      if(!firstSent || pending.size!==2){res.writeHead(409).end();return;}
      const secondPath=firstPath==='/a'?'/b':'/a';
      const second=pending.get(secondPath);
      second.writeHead(200,{'content-type':'application/json'});
      second.end(PUBLIC_BODY);
      pending.clear();
      res.writeHead(204).end();
      return;
    }
    if(!['/a','/b'].includes(req.url)||pending.has(req.url)){
      res.writeHead(400).end();return;
    }
    const ticket=broker.request({
      adapter:'order52',action:'noop',transactionId:'tx',
      agent:'observer',sink:'local-http',arguments:{public:'constant'}
    });
    assert.equal(ticket.decision,'ask');
    pending.set(req.url,res);
    if(pending.size===2){
      firstPath=fixedOrder||privateBit===0?'/a':'/b';
      const first=pending.get(firstPath);
      firstSent=true;
      first.writeHead(200,{'content-type':'application/json'});
      first.end(PUBLIC_BODY);
    }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const observed=[];
  try{
    const read=async(path)=>{
      const res=await fetch(base+path,{signal:AbortSignal.timeout(8000)});
      assert.equal(res.status,200);
      const body=await res.text();
      observed.push({path,body});
      // The external observer acknowledges the first response before the
      // second is released. This avoids flaky wall-clock timing inference.
      if(observed.length===1){
        const ack=await fetch(base+'/ack',{signal:AbortSignal.timeout(8000)});
        assert.equal(ack.status,204);
      }
      return body;
    };
    const [a,b]=await Promise.all([read('/a'),read('/b')]);
    assert.equal(a,PUBLIC_BODY);
    assert.equal(b,PUBLIC_BODY);
    assert.equal(observed.length,2);
    assert.equal(broker.tickets.size,2);
    return {
      order:observed.map(x=>x.path).join(','),
      payloads:Object.fromEntries(observed.map(x=>[x.path,x.body])),
      approvals,executions,credentialResolutions,commits
    };
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
}

test('HUSH-052: individually identical unapproved responses leak via completion order',async()=>{
  const zero=await world(0),one=await world(1);
  assert.deepEqual(zero.payloads,one.payloads);
  assert.equal(zero.order,'/a,/b');
  assert.equal(one.order,'/b,/a');
  const recover=order=>order.startsWith('/a')?0:1;
  assert.equal(recover(zero.order),0);
  assert.equal(recover(one.order),1);
  for(const run of [zero,one]){
    assert.equal(run.approvals,0);
    assert.equal(run.executions,0);
    assert.equal(run.credentialResolutions,0);
    assert.equal(run.commits,0);
  }
  const fixedZero=await world(0,{fixedOrder:true});
  const fixedOne=await world(1,{fixedOrder:true});
  assert.deepEqual(fixedZero.payloads,fixedOne.payloads);
  assert.equal(fixedZero.order,'/a,/b');
  assert.equal(fixedOne.order,'/a,/b');
});
