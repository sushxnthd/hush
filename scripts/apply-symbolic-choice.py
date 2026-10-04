from pathlib import Path

p=Path('src/partition-firewall.js')
s=p.read_text()
needle="""  candidateValues(field,{limit=this.maxDomainSize}={}){
"""
insert="""  candidateIntervals(field){
    const state=this.fields.get(String(field));
    if(!state) return null;
    return state.intervals.map(([lo,hi])=>[lo,hi]);
  }

"""
assert needle in s and 'candidateIntervals(field)' not in s
s=s.replace(needle,insert+needle,1)
p.write_text(s)

p=Path('src/private-decision.js')
s=p.read_text()
old="""              initialCandidates:status.initialCandidates,
              remainingCandidates:status.remainingCandidates,
              values:()=>this.partitionFirewall.candidateValues(field,{limit:this.jointChoiceFirewall.maxJointStates})
"""
new="""              initialCandidates:status.initialCandidates,
              remainingCandidates:status.remainingCandidates,
              intervals:this.partitionFirewall.candidateIntervals(field),
              values:()=>this.partitionFirewall.candidateValues(field,{limit:this.jointChoiceFirewall.maxJointStates})
"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

p=Path('package.json')
s=p.read_text()
s=s.replace('node --check src/joint-choice-firewall.js && node --check src/native-mcp.js', 'node --check src/joint-choice-firewall.js && node --check src/symbolic-choice-counter.js && node --check src/native-mcp.js')
p.write_text(s)
print('symbolic choice integration applied')
