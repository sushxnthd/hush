import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ActionBroker} from '../src/action-broker.js';
import {canonicalize,sha256} from '../src/core.js';

// Intentionally insecure surrounding HTTP projection of a REAL broker ticket.
// The private argument is injected by trusted server code, not the HTTP client.
// This is not a demonstrated vulnerability in a shipped Hush endpoint.
const PUBLIC_BODY=JSON.stringify({decision:'ask',approved:false});
const PUBLIC_REQUEST={
  adapter:'hash53',action:'noop',agent:'observer',sink:'ticket',
  purpose:'unspecified',category:'general',resource:'*'
};

function offlineCandidateHash(privateFlag){
  // Independent offline dictionary calculation, without calling ActionBroker.
  const binding={...PUBLIC_REQUEST,arguments:{privateFlag},credentialRefs:[]};
  return sha256(canonicalize(binding));
}

async function world(privateFlag,{projectHash=true}={}){
  let executions=0,credentialResolutions=0,providerCommits=0;
  const broker=new ActionBroker({secretResolver:async()=>{
    credentialResolutions++;throw Error('credential resolver must not run');
  }});
  broker.registerAdapter({
    name:'hash53',actions:['noop'],
    execute:async()=>{executions++;providerCommits++;throw Error('adapter must not run');}
  });
  const server=createServer((req,res)=>{
    if(req.url!=='/ticket'){res.writeHead(404).end();return;}
    const ticket=broker.request({...PUBLIC_REQUEST,arguments:{privateFlag}});
    assert.equal(ticket.decision,'ask');
    assert.equal(ticket.rawCredentialIncluded,false);
    const body=projectHash?
      JSON.stringify({decision:ticket.decision,approved:false,requestHash:ticket.requestHash}):
      PUBLIC_BODY;
    res.writeHead(200,{'content-type':'application/json'});
    res.end(body);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/ticket`,{
      signal:AbortSignal.timeout(8000)
    });
    assert.equal(response.status,200);
    const body=await response.text();
    assert.equal(broker.tickets.size,1);
    return {body,executions,credentialResolutions,providerCommits};
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
}

test('HUSH-053: preapproval public request hash permits offline dictionary recovery',async()=>{
  const zero=await world('zero'),one=await world('one');
  const a=JSON.parse(zero.body),b=JSON.parse(one.body);
  assert.equal(a.decision,'ask');
  assert.equal(b.decision,'ask');
  assert.equal(a.approved,false);
  assert.equal(b.approved,false);
  assert.notEqual(a.requestHash,b.requestHash);
  assert.equal(a.requestHash,offlineCandidateHash('zero'));
  assert.equal(b.requestHash,offlineCandidateHash('one'));
  const candidates=['zero','one'];
  const recover=hash=>candidates.find(value=>offlineCandidateHash(value)===hash);
  assert.equal(recover(a.requestHash),'zero');
  assert.equal(recover(b.requestHash),'one');
  for(const run of [zero,one]){
    assert.equal(run.executions,0);
    assert.equal(run.credentialResolutions,0);
    assert.equal(run.providerCommits,0);
    assert.equal(run.body.includes('privateFlag'),false);
  }
  const projectedZero=await world('zero',{projectHash:false});
  const projectedOne=await world('one',{projectHash:false});
  assert.equal(projectedZero.body,PUBLIC_BODY);
  assert.equal(projectedOne.body,PUBLIC_BODY);
  assert.equal(projectedZero.body,projectedOne.body);
});
