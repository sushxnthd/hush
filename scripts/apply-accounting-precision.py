from pathlib import Path

p=Path('src/partition-firewall.js')
s=p.read_text()
s=s.replace("const {_posterior,...safe}=x;", "const {_posterior,_marginalKnowledgeBits,_totalKnowledgeBits,...safe}=x;", 1)
old="""      marginalKnowledgeBits:Number(marginalBits.toFixed(9)),
      totalKnowledgeBits:Number(totalKnowledgeBits.toFixed(9)),
      maxKnowledgeBits:this.maxKnowledgeBits,
      minRemaining:this.minRemaining,
      _posterior:posterior
"""
new="""      marginalKnowledgeBits:Number(marginalBits.toFixed(9)),
      totalKnowledgeBits:Number(totalKnowledgeBits.toFixed(9)),
      maxKnowledgeBits:this.maxKnowledgeBits,
      minRemaining:this.minRemaining,
      _marginalKnowledgeBits:marginalBits,
      _totalKnowledgeBits:totalKnowledgeBits,
      _posterior:posterior
"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

p=Path('src/joint-choice-firewall.js')
s=p.read_text()
s=s.replace("const {_observation,...safe}=assessment;", "const {_observation,_marginalKnowledgeBits,_totalKnowledgeBits,...safe}=assessment;", 1)
old="""      observationsComposed:relevant.length,
      analysis,
      _observation:{v:1,fields:requested,program:structuredClone(program),result:structuredClone(result)}
"""
new="""      observationsComposed:relevant.length,
      analysis,
      _marginalKnowledgeBits:marginalKnowledgeBits,
      _totalKnowledgeBits:totalKnowledgeBits,
      _observation:{v:1,fields:requested,program:structuredClone(program),result:structuredClone(result)}
"""
assert old in s
s=s.replace(old,new,1)
old="""    if(!assessment||assessment.decision!=='allow'||!assessment._observation) return false;
    if(assessment.marginalKnowledgeBits<=1e-12) return true;
"""
new="""    if(!assessment||assessment.decision!=='allow'||!assessment._observation) return false;
    const exactMarginal=assessment._marginalKnowledgeBits??assessment.marginalKnowledgeBits;
    if(exactMarginal<=1e-12) return true;
"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

p=Path('src/private-decision.js')
s=p.read_text()
old="""    const realizedAssessment=jointAssessment?.decision==='allow'?jointAssessment:partitionAssessment?.decision==='allow'?partitionAssessment:null;
    const bits=repeat?0:(realizedAssessment?realizedAssessment.marginalKnowledgeBits:nominalBits);
"""
new="""    const realizedAssessment=jointAssessment?.decision==='allow'?jointAssessment:partitionAssessment?.decision==='allow'?partitionAssessment:null;
    const exactRealizedBits=realizedAssessment?(realizedAssessment._marginalKnowledgeBits??realizedAssessment.marginalKnowledgeBits):null;
    const bits=repeat?0:(realizedAssessment?exactRealizedBits:nominalBits);
"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s)
print('privacy accounting precision hardening applied')
