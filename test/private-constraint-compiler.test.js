import test from 'node:test';
import assert from 'node:assert/strict';
import {compilePrivateConstraint,normalizeConstraintContract,ConstraintCompilationError} from '../src/private-constraint-compiler.js';

const speedContract={
  id:'flight.maximum-groundspeed',
  privateRef:{category:'flight'},
  extractor:{kind:'number',anchors:['maximum','groundspeed'],units:['mph','miles per hour'],min:0,max:500},
  release:{op:'identity',label:'Maximum planned groundspeed',unit:'mph'}
};

test('compiles a useful numeric constraint without copying fused private prose',()=>{
  const source='I checked the mission plan, and the maximum planned groundspeed is 110 mph, although the pilot said each extra hour reduces what they earn.';
  const result=compilePrivateConstraint(source,speedContract);
  assert.equal(result.value,110);
  assert.equal(result.statement,'Maximum planned groundspeed: 110 mph.');
  assert.equal(result.rawSourceIncluded,false);
  assert.equal(result.rawPrivatePathIncluded,false);
  const visible=JSON.stringify(result);
  assert.equal(visible.includes('extra hour'),false);
  assert.equal(visible.includes('reduces what they earn'),false);
});

test('can release only a derived boolean instead of the exact private number',()=>{
  const result=compilePrivateConstraint(
    'Maximum planned groundspeed is 110 mph. The operator is under financial pressure.',
    {...speedContract,id:'flight.speed-within-limit',release:{op:'compare',label:'Groundspeed within 100 mph limit',operator:'lte',arg:100,trueLabel:'yes',falseLabel:'no'}}
  );
  assert.equal(result.value,false);
  assert.equal(result.statement,'Groundspeed within 100 mph limit: no.');
  assert.equal(result.statement.includes('110'),false);
});

test('fails closed on ambiguous numeric evidence',()=>{
  assert.throws(
    ()=>compilePrivateConstraint('Maximum groundspeed was revised from 90 mph to 110 mph.',speedContract),
    error=>error instanceof ConstraintCompilationError&&error.code==='constraint_evidence_ambiguous'
  );
});

test('compiles enum evidence from fused text using an allowlist',()=>{
  const contract={
    id:'pilot.recency',
    extractor:{kind:'enum',anchors:['certificate','knowledge'],values:[
      {value:'current',label:'current',aliases:['current aeronautical knowledge','certificate is current']},
      {value:'expired',label:'expired',aliases:['expired','out of date']}
    ]},
    release:{label:'Pilot certification and knowledge status'}
  };
  const result=compilePrivateConstraint('The pilot has current aeronautical knowledge, although a relative insists the certificate must be out of date.',contract);
  assert.equal(result.value,'current');
  assert.equal(result.statement,'Pilot certification and knowledge status: current.');
  assert.equal(result.statement.includes('relative'),false);
});

test('supports structured private fields without exposing sibling fields',()=>{
  const result=compilePrivateConstraint(
    {mission:{speed:110},privateNote:'bankruptcy details'},
    {...speedContract,id:'structured.speed',privateField:'mission.speed',extractor:{kind:'number',min:0,max:500},release:{label:'Maximum planned groundspeed',unit:'mph'}}
  );
  assert.equal(result.statement,'Maximum planned groundspeed: 110 mph.');
  assert.equal(JSON.stringify(result).includes('bankruptcy'),false);
});

test('normalization rejects unsafe private paths',()=>{
  assert.throws(
    ()=>normalizeConstraintContract({...speedContract,privateField:'__proto__.secret'}),
    error=>error instanceof ConstraintCompilationError&&error.code==='invalid_constraint_contract'
  );
});

test('numeric anchors reject unrelated numbers in other source segments',()=>{
  const source='The pilot has 12 years of experience. Maximum planned groundspeed is 110 mph. Their rent increased by 20 percent.';
  const result=compilePrivateConstraint(source,speedContract);
  assert.equal(result.value,110);
});
