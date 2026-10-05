from pathlib import Path

# Extend the symbolic analyzer so the *current* protected output may be a
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
    const values=[...new Set(raw.filter(value=>Number.isSafeInteger(value)&&value>=lo&&value<=hi))];
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

# Run the connected joint posterior assessment for every protected PDP output,
# not only choose. Predicate/bucket effects continue to live in the partition
# firewall; we therefore do not persist them again in the choose-observation log.
p=Path('src/private-decision.js')
s=p.read_text()
old="if(compiled.kind==='choose' && privatePaths.length>=1 && this.jointChoiceFirewall) {\n      const protectedCount=privatePaths.filter(path=>this.partitionFirewall?.hasField(path)).length;\n      const allProtected=protectedCount===privatePaths.length;\n      if(protectedCount>0 && !allProtected){"
new="if(privatePaths.length>=1 && this.jointChoiceFirewall) {\n      const protectedCount=privatePaths.filter(path=>this.partitionFirewall?.hasField(path)).length;\n      const allProtected=protectedCount===privatePaths.length;\n      if(compiled.kind==='choose' && protectedCount>0 && !allProtected){"
assert old in s
s=s.replace(old,new,1)
old="      if(allProtected){\n        const compiledCache=new Map();"
new="      if(allProtected && protectedCount>0){\n        const compiledCache=new Map();"
assert old in s
s=s.replace(old,new,1)
old="if(jointAssessment?.decision==='allow') this.jointChoiceFirewall.commit(jointAssessment);"
new="if(compiled.kind==='choose' && jointAssessment?.decision==='allow') this.jointChoiceFirewall.commit(jointAssessment);"
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

print('connected posterior composition patch applied')
