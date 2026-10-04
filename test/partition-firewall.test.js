import test from 'node:test';
import assert from 'node:assert/strict';
import {PartitionAwareReconstructionFirewall} from '../src/partition-firewall.js';

test('rare true equality branch is recognized as high realized leakage',()=>{
  const f=new PartitionAwareReconstructionFirewall({maxKnowledgeBits:8});
  f.registerField('secret',{type:'integer',min:0,max:999999});
  const out=f.evaluate({field:'secret',program:{kind:'predicate',private:'secret',op:'eq',value:734219},result:true});
  assert.equal(out.decision,'deny');
  assert.equal(out.beforeCandidates,1_000_000);
  assert.equal(out.afterCandidates,1);
  assert.ok(out.marginalKnowledgeBits>19.9);
  assert.equal(f.status('secret').remainingCandidates,1_000_000);
});

test('rare false equality branch costs almost nothing and may be released',()=>{
  const f=new PartitionAwareReconstructionFirewall({maxKnowledgeBits:8});
  f.registerField('secret',{type:'integer',min:0,max:999999});
  const out=f.assessAndCommit({field:'secret',program:{kind:'predicate',private:'secret',op:'eq',value:1},result:false});
  assert.equal(out.decision,'allow');
  assert.equal(out.afterCandidates,999999);
  assert.ok(out.marginalKnowledgeBits<0.00001);
  assert.equal(f.status('secret').remainingCandidates,999999);
});

test('semantically redundant predicates do not consume realized knowledge twice',()=>{
  const f=new PartitionAwareReconstructionFirewall({maxKnowledgeBits:8});
  f.registerField('secret',{type:'integer',min:0,max:999999});
  const a=f.assessAndCommit({field:'secret',program:{kind:'predicate',private:'secret',op:'gt',value:500000},result:true});
  const b=f.assessAndCommit({field:'secret',program:{kind:'predicate',private:'secret',op:'gte',value:500001},result:true});
  assert.equal(a.decision,'allow');
  assert.equal(b.decision,'allow');
  assert.equal(b.beforeCandidates,b.afterCandidates);
  assert.equal(b.marginalKnowledgeBits,0);
});

test('balanced adaptive refinement reaches the same knowledge budget independent of wording',()=>{
  const f=new PartitionAwareReconstructionFirewall({maxKnowledgeBits:8.01});
  f.registerField('secret',{type:'integer',min:0,max:999999});
  let lo=0,hi=999999;
  const secret=734219;
  for(let i=0;i<8;i++){
    const mid=Math.floor((lo+hi)/2);
    const result=secret>mid;
    const out=f.assessAndCommit({field:'secret',program:{kind:'predicate',private:'secret',op:i%2===0?'gt':'gte',value:i%2===0?mid:mid+1},result});
    assert.equal(out.decision,'allow');
    if(result) lo=mid+1; else hi=mid;
  }
  assert.ok(f.status('secret').remainingCandidates<=3907);
  const mid=Math.floor((lo+hi)/2);
  const ninth=f.evaluate({field:'secret',program:{kind:'predicate',private:'secret',op:'gt',value:mid},result:secret>mid});
  assert.equal(ninth.decision,'deny');
});

test('membership predicates are partition-accounted rather than priced only by output count',()=>{
  const f=new PartitionAwareReconstructionFirewall({maxKnowledgeBits:8});
  f.registerField('secret',{type:'integer',min:0,max:999999});
  const out=f.evaluate({field:'secret',program:{kind:'predicate',private:'secret',op:'in',value:[734219,734220]},result:true});
  assert.equal(out.decision,'deny');
  assert.equal(out.afterCandidates,2);
  assert.ok(out.marginalKnowledgeBits>18.9);
});

test('snapshot and restore preserve the feasible partition',()=>{
  const f=new PartitionAwareReconstructionFirewall({maxKnowledgeBits:8});
  f.registerField('secret',{type:'integer',min:0,max:999999});
  f.assessAndCommit({field:'secret',program:{kind:'predicate',private:'secret',op:'gt',value:500000},result:true});
  const g=new PartitionAwareReconstructionFirewall({maxKnowledgeBits:8}).restore(f.snapshot());
  assert.deepEqual(g.status('secret'),f.status('secret'));
});
