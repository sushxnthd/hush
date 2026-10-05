from pathlib import Path

# Extend the symbolic analyzer so the current protected output may be a
# predicate or bucket while prior cross-field observations remain choose calls.
p=Path('src/symbolic-choice-counter.js')
s=p.read_text()
marker="function splitBox(box,fields){"
assert marker in s
insert=r'''
function classifyPredicate(program,box,fields,evaluateProgram){
  const field=String(program?.private||'');
  const range=box[field];
  if(!range) return {known:false};
  if(range[0]===range[1]) return {known:true,result:evaluateProgram(program,exactAssignment(box,fields))};
  const [lo,hi]=range;
  const op=String(program?.op||'');
  const raw=program?.value;

  if(op==='eq'||op==='neq'){
    const v=Number(raw);
    const equalPossible=Number.isSafeInteger(v)&&v>=lo&&v<=hi;
    const equalCertain=lo===hi&&lo===v;
    if(!equalPossible) return {known:true,result:op==='neq'};
    if(equalCertain) return {known:true,result:op==='eq'};
    return {known:false};
  }

  if(op==='in'||op==='notIn'){
    if(!Array.isArray(raw)) return {known:false};
    const values=[...new Set(raw.map(Number).filter(value=>Number.isSafeInteger(value)&&value>=lo&&value<=hi))];
    const covered=values.length;
    const width=hi-lo+1;
    if(covered===0) return {known:true,result:op==='notIn'};
    if(covered===width) return {known:true,result:op==='in'};
    return {known:false};
  }

  const x=Number(raw);
  if(!Number.isFinite(x)) return {known:false};
  if(op==='lt'){
    if(hi<x) return {known:true,result:true};
    if(lo>=x) return {known:true,result:false};
  }else if(op==='lte'){
    if(hi<=x) return {known:true,result:true};
    if(lo>x) return {known:true,result:false};
  }else if(op==='gt'){
    if(lo>x) return {known:true,result:true};
    if(hi<=x) return {known:true,result:false};
  }else if(op==='gte'){
    if(lo>=x) return {known:true,result:true};
    if(hi<x) return {known:true,result:false};
  }
  return {known:false};
}

function classifyBucket(program,box,fields,evaluateProgram){
  const field=String(program?.private||'');
  const range=box[field];
  if(!range) return {known:false};
  if(range[0]===range[1]) return {known:true,result:evaluateProgram(program,exactAssignment(box,fields))};
  const thresholds=Array.isArray(program?.thresholds)?program.thresholds.map(Number):[];
  if(!thresholds.length||!thresholds.every(Number.isFinite)) return {known:false};
  const bucketAt=value=>{
    let bucket=0;
    while(bucket<thresholds.length&&value>thresholds[bucket]) bucket++;
    return bucket;
  };
  const a=bucketAt(range[0]),b=bucketAt(range[1]);
  return a===b?{known:true,result:a}:{known:false};
}

function classifyProgram(program,box,fields,evaluateProgram){
  const kind=String(program?.kind||'');
  if(kind==='choose') return classifyChoice(program,box,fields,evaluateProgram);
  if(kind==='predicate') return classifyPredicate(program,box,fields,evaluateProgram);
  if(kind==='bucket') return classifyBucket(program,box,fields,evaluateProgram);
  if(isSingleton(box,fields)) return {known:true,result:evaluateProgram(program,exactAssignment(box,fields))};
  return {known:false};
}

'''
s=s.replace(marker,insert+marker,1)
s=s.replace("const classification=classifyChoice(program,box,ordered,evaluateProgram);","const classification=classifyProgram(program,box,ordered,evaluateProgram);",1)
s=s.replace("const classification=classifyChoice(observation.program,box,ordered,evaluateProgram);","const classification=classifyProgram(observation.program,box,ordered,evaluateProgram);",1)
p.write_text(s)

# Expose a conservative overlap check so single-field predicate/bucket calls keep
# their existing partition-only accounting unless a prior choose release actually
# links that field into a connected posterior.
p=Path('src/joint-choice-firewall.js')
s=p.read_text()
old="""  resetField(field){
    const key=String(field||'');
    const before=this.observations.length;
    this.observations=this.observations.filter(observation=>!observation.fields.includes(key));
    return before!==this.observations.length;
  }

  evaluate({fields,getFieldState,program,result,evaluateProgram}={}){"""
new="""  resetField(field){
    const key=String(field||'');
    const before=this.observations.length;
    this.observations=this.observations.filter(observation=>!observation.fields.includes(key));
    return before!==this.observations.length;
  }

  hasObservationFor(fields=[]){
    const requested=uniqueFields(fields);
    return requested.length>0&&this.observations.some(observation=>intersects(requested,observation.fields));
  }

  evaluate({fields,getFieldState,program,result,evaluateProgram}={}){"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

# Run connected joint-posterior assessment for choose programs as before, and for
# predicate/bucket outputs only when they overlap a prior choose observation.
# This closes mixed-channel composition without changing standalone partition
# accounting semantics. Predicate/bucket effects remain persisted by the partition
# firewall, so only choose observations are appended to the joint observation log.
p=Path('src/private-decision.js')
s=p.read_text()
old="""    if(compiled.kind==='choose' && privatePaths.length>=1 && this.jointChoiceFirewall) {
      const protectedCount=privatePaths.filter(path=>this.partitionFirewall?.hasField(path)).length;
      const allProtected=protectedCount===privatePaths.length;
      if(protectedCount>0 && !allProtected){"""
new="""    const shouldComposeJoint=compiled.kind==='choose'||Boolean(this.jointChoiceFirewall?.hasObservationFor?.(privatePaths));
    if(shouldComposeJoint && privatePaths.length>=1 && this.jointChoiceFirewall) {
      const protectedCount=privatePaths.filter(path=>this.partitionFirewall?.hasField(path)).length;
      const allProtected=protectedCount===privatePaths.length;
      if(compiled.kind==='choose' && protectedCount>0 && !allProtected){"""
assert old in s
s=s.replace(old,new,1)
old="""      if(allProtected){
        const compiledCache=new Map();"""
new="""      if(allProtected && protectedCount>0){
        const compiledCache=new Map();"""
assert old in s
s=s.replace(old,new,1)
old="if(jointAssessment?.decision==='allow') this.jointChoiceFirewall.commit(jointAssessment);"
new="if(compiled.kind==='choose' && jointAssessment?.decision==='allow') this.jointChoiceFirewall.commit(jointAssessment);"
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

# Turn the existing falsification into a regression test for the successor guard.
p=Path('test/mixed-channel-composition.test.js')
s=p.read_text()
s=s.replace(
  "test('v0.9 specialized guards permit a default-policy mixed choose-then-predicate transcript above the connected knowledge limit',()=>{",
  "test('connected posterior blocks a mixed choose-then-predicate transcript above the knowledge limit',()=>{",
  1
)
old="""  // This deliberately captures the v0.9 composition gap. The successor connected
  // posterior guard must change this outcome to DENY before releasing `true`.
  assert.equal(final.decision,'allow');
  assert.equal(final.result,true);
  assert.equal(final.partition?.totalKnowledgeBits,1);"""
new="""  // The predicate is harmless in isolation, but conditioned on both prior choices
  // it collapses the connected posterior from two states to one (8 -> 9 bits).
  assert.equal(final.decision,'deny');
  assert.equal(final.capacity.accounting,'realized-joint-choice');
  assert.equal(final.joint?.beforeCandidates,2);
  assert.equal(final.joint?.afterCandidates,1);
  assert.equal(final.joint?.totalKnowledgeBits,9);
  assert.equal(Object.hasOwn(final,'result'),false);"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

print('connected posterior composition patch applied')
