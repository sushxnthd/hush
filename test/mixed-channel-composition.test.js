import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateDecisionRuntime} from '../src/private-decision.js';

const QUERIES=10;
const WIDTH=2*QUERIES+1;

function majorityProgram(a,b,c){
  return {
    kind:'choose',
    candidates:[
      {id:'ones',a:1,b:1,c:1},
      {id:'zeros',a:0,b:0,c:0}
    ],
    preferences:[
      {kind:'matchPrivate',candidate:'a',private:a,weight:1},
      {kind:'matchPrivate',candidate:'b',private:b,weight:1},
      {kind:'matchPrivate',candidate:'c',private:c,weight:1}
    ]
  };
}

function supportCounts(queryCount=QUERIES){
  // Count assignments satisfying majority(bit[2i],bit[2i+1],bit[2i+2])=1
  // while retaining the first bit so we can price the final predicate exactly.
  let dp=new Map();
  for(let x=0;x<=1;x++) for(let y=0;y<=1;y++) for(let z=0;z<=1;z++){
    if(x+y+z<2) continue;
    const key=`${x}:${z}`;
    dp.set(key,(dp.get(key)??0)+1);
  }
  for(let i=1;i<queryCount;i++){
    const next=new Map();
    for(const [key,count] of dp){
      const [first,overlap]=key.split(':').map(Number);
      for(let x=0;x<=1;x++) for(let y=0;y<=1;y++){
        if(overlap+x+y<2) continue;
        const nextKey=`${first}:${y}`;
        next.set(nextKey,(next.get(nextKey)??0)+count);
      }
    }
    dp=next;
  }
  let before=0,afterFirstOne=0;
  for(const [key,count] of dp){
    const [first]=key.split(':').map(Number);
    before+=count;
    if(first===1) afterFirstOne+=count;
  }
  return {before,afterFirstOne};
}

test('v0.9 specialized guards permit a mixed choose-then-predicate transcript above the connected knowledge limit',()=>{
  const runtime=new PrivateDecisionRuntime();
  for(let i=0;i<WIDTH;i++) runtime.setPrivate(`secret.bit${i}`,1,{domain:{type:'integer',min:0,max:1}});

  let lastChoice=null;
  for(let i=0;i<QUERIES;i++){
    const t=runtime.beginTrajectory({purpose:`majority-${i}`,maxBits:2,sinkMaxBits:2});
    lastChoice=runtime.run({
      trajectoryId:t.trajectoryId,
      agent:`agent-${i}`,
      sink:`sink-${i}.example`,
      program:majorityProgram(`secret.bit${2*i}`,`secret.bit${2*i+1}`,`secret.bit${2*i+2}`)
    });
    assert.equal(lastChoice.decision,'allow',`majority query ${i+1} should be released by v0.9`);
    assert.equal(lastChoice.result,'ones');
  }

  const counts=supportCounts();
  assert.equal(counts.before,11482);
  assert.equal(counts.afterFirstOne,8119);
  const jointBeforeLeak=WIDTH-Math.log2(counts.before);
  const trueCombinedLeak=WIDTH-Math.log2(counts.afterFirstOne);
  assert.ok(jointBeforeLeak<8);
  assert.ok(trueCombinedLeak>8);
  assert.ok(lastChoice.joint?.totalKnowledgeBits<8);

  const t=runtime.beginTrajectory({purpose:'final-predicate',maxBits:2,sinkMaxBits:2});
  const final=runtime.run({
    trajectoryId:t.trajectoryId,
    agent:'predicate-agent',
    sink:'predicate.example',
    program:{kind:'predicate',private:'secret.bit0',op:'eq',value:1}
  });

  // This assertion deliberately captures the v0.9 gap. The successor unified
  // posterior guard must change this outcome to deny before release.
  assert.equal(final.decision,'allow');
  assert.equal(final.result,true);
  assert.equal(final.partition?.totalKnowledgeBits,1);
  assert.ok(trueCombinedLeak>8);
});
