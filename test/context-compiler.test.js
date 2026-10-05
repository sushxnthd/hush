import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSemanticProgram,resolvePrivateRef,ContextSelectionError} from '../src/context-compiler.js';

const records=[
  {id:'1',path:'travel.maxBudget',label:'Maximum travel budget',category:'travel',tags:['budget','flight']},
  {id:'2',path:'travel.preferredAirline',label:'Preferred airline',category:'travel',tags:['airline','preference']},
  {id:'3',path:'finance.monthlyBudget',label:'Monthly household budget',category:'finance',tags:['budget','household']}
];

test('semantic resolver selects by non-secret metadata rather than path text',()=>{
  assert.equal(resolvePrivateRef(records,{query:'preferred airline'}),'travel.preferredAirline');
  assert.equal(resolvePrivateRef(records,{category:'finance',tags:['budget']}),'finance.monthlyBudget');
});

test('semantic resolver fails closed on a top-score tie',()=>{
  const tied=[
    {id:'1',path:'a.secret',label:'Travel budget',category:'travel',tags:['budget']},
    {id:'2',path:'b.secret',label:'Travel budget',category:'travel',tags:['budget']}
  ];
  assert.throws(()=>resolvePrivateRef(tied,{query:'travel budget'}),error=>{
    assert.ok(error instanceof ContextSelectionError);
    assert.equal(error.code,'context_ambiguous');
    assert.equal(error.candidateCount,2);
    assert.equal(error.message.includes('a.secret'),false);
    assert.equal(error.message.includes('b.secret'),false);
    return true;
  });
});

test('semantic compiler rejects raw private paths',()=>{
  assert.throws(()=>compileSemanticProgram(records,{kind:'predicate',private:'travel.maxBudget',op:'gte',value:1000}),error=>{
    assert.equal(error.code,'raw_path_forbidden');
    return true;
  });
});

test('semantic choose compiler binds private clauses but preserves public-only preferences',()=>{
  const compiled=compileSemanticProgram(records,{
    kind:'choose',
    candidates:[{id:'a',price:1000,airline:'ANA'}],
    constraints:[{op:'candidateLtePrivate',candidate:'price',privateRef:{query:'travel budget'}}],
    preferences:[
      {kind:'matchPrivate',candidate:'airline',privateRef:{query:'preferred airline'},weight:10},
      {kind:'lowerPublic',candidate:'price',scale:1000,weight:1}
    ]
  });
  assert.equal(compiled.constraints[0].private,'travel.maxBudget');
  assert.equal(compiled.preferences[0].private,'travel.preferredAirline');
  assert.equal(Object.hasOwn(compiled.preferences[1],'private'),false);
  assert.equal(Object.hasOwn(compiled.preferences[1],'privateRef'),false);
});
