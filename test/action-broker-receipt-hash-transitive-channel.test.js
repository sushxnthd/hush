import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ActionBroker} from '../src/action-broker.js';
import {canonicalize,sha256} from '../src/core.js';

// Intentionally insecure APPLICATION receipt projection, not a shipped endpoint.
// This tests whether removing resultDigest alone protects a low-trust reader.
const REQUEST={adapter:'receipt55',action:'read',agent:'observer',
               sink:'loopback',arguments:{public:'constant'}};
const PUBLIC_BODY=JSON.stringify({decision:'allow',status:'completed',resultVisible:false});

function candidateReceiptHash(projectedReceipt,privateFlag){
  // Independent offline oracle: no broker methods, no private adapter output.
  const body={...projectedReceipt,resultDigest:sha256(canonicalize({privateFlag}))};
  delete body.hash;
  return sha256(canonicalize(body));
}

async function world(privateFlag,{projectReceipt=true}={}){
  let approvals=0,executions=0,credentialResolutions=0;
  const broker=new ActionBroker({secretResolver:async()=>{
    credentialResolutions++;
    throw Error('No credentials should resolve');
  }});
  broker.registerAdapter({name:'receipt55',actions:['read'],execute:async()=>{
    executions++;
    return {privateFlag};
  }});
  let internalRequestHash=null;
  const server=createServer(async(req,res)=>{
    try{
      if(req.url!=='/public-status'){res.writeHead(404).end();return;}
      const ticket=broker.request(REQUEST);
      internalRequestHash=ticket.requestHash;
      broker.approve(ticket.actionId);
      approvals++;
      const outcome=await broker.execute({
        actionId:ticket.actionId,agent:'observer',sink:'loopback'
      });
      assert.equal(outcome.decision,'allow');
      assert.equal(outcome.result.privateFlag,privateFlag);
      const projectedReceipt={...outcome.receipt};
      delete projectedReceipt.resultDigest;
      // Deliberately retain receipt.hash, which commits to resultDigest.
      const body=projectReceipt?JSON.stringify({
        decision:'allow',status:'completed',resultVisible:false,
        receipt:projectedReceipt
      }):PUBLIC_BODY;
      res.writeHead(200,{'content-type':'application/json'});
      res.end(body);
    }catch(error){res.writeHead(500).end(String(error));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const response=await fetch(
      `http://127.0.0.1:${server.address().port}/public-status`,
      {signal:AbortSignal.timeout(8000)}
    );
    assert.equal(response.status,200);
    return {body:await response.text(),approvals,executions,
            credentialResolutions,internalRequestHash,
            receiptCount:broker.receiptLog().length};
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
}

test('HUSH-055: removing resultDigest but retaining receipt hash still leaks private result',async()=>{
  const zero=await world('zero');
  const one=await world('one');
  const a=JSON.parse(zero.body),b=JSON.parse(one.body);
  for(const response of [a,b]){
    assert.equal(response.decision,'allow');
    assert.equal(response.resultVisible,false);
    assert.equal(response.status,'completed');
    assert.equal('resultDigest' in response.receipt,false);
    assert.match(response.receipt.hash,/^[a-f0-9]{64}$/);
  }
  const recover=receipt=>['zero','one'].filter(
    candidate=>candidateReceiptHash(receipt,candidate)===receipt.hash
  );
  assert.deepEqual(recover(a.receipt),['zero']);
  assert.deepEqual(recover(b.receipt),['one']);
  assert.notEqual(candidateReceiptHash(a.receipt,'one'),a.receipt.hash);
  assert.notEqual(candidateReceiptHash(b.receipt,'zero'),b.receipt.hash);
  assert.equal(zero.internalRequestHash,one.internalRequestHash);
  for(const run of [zero,one]){
    assert.equal(run.approvals,1);
    assert.equal(run.executions,1);
    assert.equal(run.credentialResolutions,0);
    assert.equal(run.receiptCount,1);
    assert.equal(run.body.includes('privateFlag'),false);
    assert.equal(run.body.includes('resultDigest'),false);
  }
});

test('HUSH-055: strict allowlisted public projection is indistinguishable in tested result worlds',async()=>{
  const zero=await world('zero',{projectReceipt:false});
  const one=await world('one',{projectReceipt:false});
  assert.equal(zero.body,PUBLIC_BODY);
  assert.equal(one.body,PUBLIC_BODY);
  assert.equal(zero.body,one.body);
  assert.equal(zero.internalRequestHash,one.internalRequestHash);
  for(const run of [zero,one]){
    assert.equal(run.approvals,1);
    assert.equal(run.executions,1);
    assert.equal(run.receiptCount,1);
    assert.equal(run.credentialResolutions,0);
  }
});
