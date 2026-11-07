import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ActionBroker} from '../src/action-broker.js';
import {canonicalize,sha256} from '../src/core.js';

// Intentionally insecure APPLICATION projection of a real broker receipt.
// The HTTP observer never receives the private adapter result. This is not a
// demonstrated vulnerability in a shipped Hush endpoint.
const PUBLIC_BODY=JSON.stringify({decision:'allow',resultVisible:false,status:'allow'});
const REQUEST={adapter:'receipt54',action:'read',agent:'observer',sink:'http',
               arguments:{public:'constant'}};

function offlineDigest(flag){
  return sha256(canonicalize({privateFlag:flag}));
}

async function world(privateFlag,{projectDigest=true}={}){
  let approvals=0,executions=0,credentialResolutions=0;
  const broker=new ActionBroker({secretResolver:async()=>{
    credentialResolutions++;
    throw Error('credentials must not be resolved');
  }});
  broker.registerAdapter({name:'receipt54',actions:['read'],execute:async()=>{
    executions++;
    return {privateFlag};
  }});
  let internalRequestHash=null;
  const server=createServer(async(req,res)=>{
    try{
      if(req.url!=='/receipt'){res.writeHead(404).end();return;}
      const ticket=broker.request(REQUEST);
      internalRequestHash=ticket.requestHash;
      broker.approve(ticket.actionId);
      approvals++;
      const outcome=await broker.execute({actionId:ticket.actionId,agent:'observer',sink:'http'});
      assert.equal(outcome.decision,'allow');
      assert.equal(outcome.result.privateFlag,privateFlag);
      assert.equal(outcome.receipt.status,'allow');
      const body=projectDigest?
        JSON.stringify({decision:'allow',resultVisible:false,status:'allow',
                        resultDigest:outcome.receipt.resultDigest}):
        PUBLIC_BODY;
      res.writeHead(200,{'content-type':'application/json'});
      res.end(body);
    }catch(error){res.writeHead(500).end(String(error));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/receipt`,{
      signal:AbortSignal.timeout(8000)
    });
    assert.equal(response.status,200);
    const body=await response.text();
    return {body,approvals,executions,credentialResolutions,internalRequestHash,
            receiptCount:broker.receiptLog().length};
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
}

test('HUSH-054: postapproval public result digest permits private-result dictionary recovery',async()=>{
  const zero=await world('zero'),one=await world('one');
  const a=JSON.parse(zero.body),b=JSON.parse(one.body);
  assert.equal(a.decision,'allow');
  assert.equal(b.decision,'allow');
  assert.equal(a.resultVisible,false);
  assert.equal(b.resultVisible,false);
  assert.notEqual(a.resultDigest,b.resultDigest);
  assert.equal(a.resultDigest,offlineDigest('zero'));
  assert.equal(b.resultDigest,offlineDigest('one'));
  const recover=digest=>['zero','one'].find(flag=>offlineDigest(flag)===digest);
  assert.equal(recover(a.resultDigest),'zero');
  assert.equal(recover(b.resultDigest),'one');
  assert.equal(zero.internalRequestHash,one.internalRequestHash);
  for(const run of [zero,one]){
    assert.equal(run.approvals,1);
    assert.equal(run.executions,1);
    assert.equal(run.credentialResolutions,0);
    assert.equal(run.receiptCount,1);
    assert.equal(run.body.includes('privateFlag'),false);
  }
  const controlZero=await world('zero',{projectDigest:false});
  const controlOne=await world('one',{projectDigest:false});
  assert.equal(controlZero.body,PUBLIC_BODY);
  assert.equal(controlOne.body,PUBLIC_BODY);
  assert.equal(controlZero.body,controlOne.body);
});
