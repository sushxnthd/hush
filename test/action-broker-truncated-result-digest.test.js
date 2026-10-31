import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createServer} from 'node:http';
import {ActionBroker} from '../src/action-broker.js';
import {canonicalize} from '../src/core.js';

// Frozen HUSH-059: real loopback HTTP provider, actual ActionBroker, two
// otherwise-identical provider worlds. No production provider is contacted.
const EXPECT_LEAK=process.env.HUSH059_EXPECT_LEAK==='1';
const pad='p'.repeat(140_000);
const candidate=bit=>({publicPadding:pad,privateChoice:bit});
const hash=value=>crypto.createHash('sha256').update(canonicalize(value)).digest('hex');

async function world(bit,{approve=true,small=false}={}){
  let effects=0;
  const receiver=createServer(async(req,res)=>{
    effects++;
    for await (const _ of req) {}
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify(small?{public:'small-safe'}:candidate(bit)));
  });
  await new Promise(resolve=>receiver.listen(0,'127.0.0.1',resolve));
  try{
    const broker=new ActionBroker();
    broker.registerAdapter({
      name:'hush059',actions:['read'],
      execute:async()=>{
        const r=await fetch('http://127.0.0.1:'+receiver.address().port+'/private');
        assert.equal(r.status,200);
        return await r.json();
      }
    });
    const t=broker.request({adapter:'hush059',action:'read',agent:'untrusted-agent',sink:'local'});
    if(approve) broker.approve(t.actionId);
    const outcome=await broker.execute({actionId:t.actionId,agent:'untrusted-agent',sink:'local'});
    return {outcome,effects};
  }finally{
    await new Promise(resolve=>receiver.close(resolve));
  }
}

test('HUSH-059 two-world private bit reconstruction from truncated digest',async()=>{
  const a=await world(0),b=await world(1);
  assert.equal(a.effects,1);
  assert.equal(b.effects,1);
  assert.equal(a.outcome.decision,'allow');
  assert.equal(b.outcome.decision,'allow');
  assert.equal(a.outcome.result.truncated,true);
  assert.equal(b.outcome.result.truncated,true);
  assert.equal(JSON.stringify(a.outcome).includes(pad),false);
  assert.equal(JSON.stringify(b.outcome).includes(pad),false);
  if(EXPECT_LEAK){
    assert.equal(a.outcome.result.digest,hash(candidate(0)));
    assert.equal(b.outcome.result.digest,hash(candidate(1)));
    assert.notEqual(a.outcome.result.digest,b.outcome.result.digest);
  }else{
    assert.equal(Object.hasOwn(a.outcome.result,'digest'),false);
    assert.equal(Object.hasOwn(b.outcome.result,'digest'),false);
    assert.deepEqual(a.outcome.result,b.outcome.result);
    assert.equal(a.outcome.receipt.resultDigest,hash(a.outcome.result));
    assert.equal(b.outcome.receipt.resultDigest,hash(b.outcome.result));
    assert.equal(a.outcome.receipt.resultDigest,b.outcome.receipt.resultDigest);
    assert.notEqual(a.outcome.receipt.resultDigest,hash(candidate(0)));
    assert.notEqual(b.outcome.receipt.resultDigest,hash(candidate(1)));
  }
});

test('HUSH-059 unapproved request never reaches private provider',async()=>{
  const a=await world(1,{approve:false});
  assert.equal(a.effects,0);
  assert.equal(a.outcome.decision,'ask');
  assert.equal(Object.hasOwn(a.outcome,'result'),false);
});

test('HUSH-059 small explicitly approved result remains readable',async()=>{
  const a=await world(0,{small:true});
  assert.equal(a.effects,1);
  assert.equal(a.outcome.decision,'allow');
  assert.equal(a.outcome.result.public,'small-safe');
  assert.deepEqual(Object.keys(a.outcome.result),['public']);
});
