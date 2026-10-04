import test from 'node:test';
import assert from 'node:assert/strict';
import {countChoicePosterior,SymbolicAnalysisLimitError} from '../src/symbolic-choice-counter.js';

function get(root,path){
  const key=String(path);
  if(Object.hasOwn(root,key)) return root[key];
  return key.split('.').reduce((node,part)=>node[part],root);
}

function evaluate(program,assignment){
  const candidates=[...program.candidates].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const feasible=candidates.filter(candidate=>(program.constraints??[]).every(rule=>{
    const c=candidate[rule.candidate],p=get(assignment,rule.private);
    if(rule.op==='candidateLtePrivate') return c<=p;
    if(rule.op==='candidateGtePrivate') return c>=p;
    if(rule.op==='candidateEqPrivate') return c===p;
    if(rule.op==='privateLteCandidate') return p<=c;
    if(rule.op==='privateGteCandidate') return p>=c;
    throw new Error('unsupported test constraint');
  }));
  if(!feasible.length) return null;
  const scored=feasible.map(candidate=>({id:String(candidate.id),score:(program.preferences??[]).reduce((sum,pref)=>{
    const c=candidate[pref.candidate];
    if(pref.kind==='matchPrivate') return sum+(c===get(assignment,pref.private)?Number(pref.weight??1):0);
    if(pref.kind==='lowerPublic') return sum-Number(c)/Number(pref.scale??1)*Number(pref.weight??1);
    if(pref.kind==='higherPublic') return sum+Number(c)/Number(pref.scale??1)*Number(pref.weight??1);
    if(pref.kind==='nearPrivate') return sum-Math.abs(Number(c)-Number(get(assignment,pref.private)))/Number(pref.scale??1)*Number(pref.weight??1);
    throw new Error('unsupported test preference');
  },0)}));
  scored.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  return scored[0].id;
}

function rareBitsProgram(width){
  const rare={id:'rare',bias:width-0.5};
  const fallback={id:'fallback',bias:0};
  const preferences=[];
  for(let i=0;i<width;i++){
    rare[`bit${i}`]=1;
    fallback[`bit${i}`]=0;
    preferences.push({kind:'matchPrivate',candidate:`bit${i}`,private:`secret.bit${i}`,weight:1});
  }
  preferences.push({kind:'lowerPublic',candidate:'bias',weight:1,scale:1});
  return {kind:'choose',candidates:[rare,fallback],preferences};
}

function bitStates(width){
  const states=Object.create(null),fields=[];
  for(let i=0;i<width;i++){
    const field=`secret.bit${i}`;
    fields.push(field);
    states[field]={initialCandidates:2,remainingCandidates:2,intervals:[[0,1]]};
  }
  return {fields,states};
}

test('symbolic branch-and-bound counts a 32-bit rare winner without enumerating 2^32 states',()=>{
  const {fields,states}=bitStates(32);
  const out=countChoicePosterior({fields,fieldStates:states,program:rareBitsProgram(32),result:'rare',evaluateProgram:evaluate,maxNodes:10000});
  assert.equal(out.beforeCandidates,2**32);
  assert.equal(out.afterCandidates,1);
  assert.equal(out.method,'symbolic-branch-and-bound');
  assert.ok(out.nodesVisited<200,`expected pruning, visited ${out.nodesVisited}`);
});

test('symbolic branch-and-bound counts the huge common branch exactly',()=>{
  const {fields,states}=bitStates(32);
  const out=countChoicePosterior({fields,fieldStates:states,program:rareBitsProgram(32),result:'fallback',evaluateProgram:evaluate,maxNodes:10000});
  assert.equal(out.beforeCandidates,2**32);
  assert.equal(out.afterCandidates,2**32-1);
  assert.ok(out.nodesVisited<200,`expected pruning, visited ${out.nodesVisited}`);
});

test('symbolic counter resolves a million-value threshold choice with logarithmic splitting',()=>{
  const field='secret.value';
  const threshold=734219;
  const program={
    kind:'choose',
    candidates:[{id:'below',cut:0,rank:0},{id:'at-or-above',cut:threshold,rank:1}],
    constraints:[{op:'candidateLtePrivate',candidate:'cut',private:field}],
    preferences:[{kind:'higherPublic',candidate:'rank',weight:1,scale:1}]
  };
  const out=countChoicePosterior({
    fields:[field],
    fieldStates:{[field]:{initialCandidates:1_000_000,remainingCandidates:1_000_000,intervals:[[0,999999]]}},
    program,
    result:'at-or-above',
    evaluateProgram:evaluate,
    maxNodes:1000
  });
  assert.equal(out.beforeCandidates,1_000_000);
  assert.equal(out.afterCandidates,1_000_000-threshold);
  assert.ok(out.nodesVisited<100,`expected logarithmic splitting, visited ${out.nodesVisited}`);
});

test('prior overlapping choice observation is composed before the new posterior count',()=>{
  const fields=['secret.a','secret.b'];
  const fieldStates={
    'secret.a':{initialCandidates:2,remainingCandidates:2,intervals:[[0,1]]},
    'secret.b':{initialCandidates:2,remainingCandidates:2,intervals:[[0,1]]}
  };
  const first={kind:'choose',candidates:[{id:'one',a:1,bias:0},{id:'other',a:0,bias:0.5}],preferences:[{kind:'matchPrivate',candidate:'a',private:'secret.a',weight:1},{kind:'higherPublic',candidate:'bias',weight:1,scale:1}]};
  const second={kind:'choose',candidates:[{id:'one',b:1,bias:0},{id:'other',b:0,bias:0.5}],preferences:[{kind:'matchPrivate',candidate:'b',private:'secret.b',weight:1},{kind:'higherPublic',candidate:'bias',weight:1,scale:1}]};
  const out=countChoicePosterior({fields,fieldStates,observations:[{fields:['secret.a'],program:first,result:'one'}],program:second,result:'one',evaluateProgram:evaluate,maxNodes:100});
  assert.equal(out.beforeCandidates,2);
  assert.equal(out.afterCandidates,1);
});

test('symbolic analysis fails closed when a program cannot be bounded within the work budget',()=>{
  const fields=['secret.a','secret.b','secret.c','secret.d'];
  const fieldStates=Object.fromEntries(fields.map(field=>[field,{initialCandidates:16,remainingCandidates:16,intervals:[[0,15]]}]));
  const program={kind:'choose',candidates:[{id:'a',x:0},{id:'b',x:1}],preferences:[{kind:'unsupported-private-shape',candidate:'x',private:'secret.a',weight:1}]};
  assert.throws(()=>countChoicePosterior({fields,fieldStates,program,result:'a',evaluateProgram:()=> 'a',maxNodes:20}),SymbolicAnalysisLimitError);
});
