from pathlib import Path

p=Path('src/private-decision.js')
s=p.read_text()

old="if(privatePaths.length===1 && this.partitionFirewall?.hasField(privatePaths[0])) {"
new="if(compiled.kind!=='choose' && privatePaths.length===1 && this.partitionFirewall?.hasField(privatePaths[0])) {"
assert old in s
s=s.replace(old,new,1)

old="if(compiled.kind==='choose' && privatePaths.length>1 && this.jointChoiceFirewall) {\n      const allProtected=privatePaths.every(path=>this.partitionFirewall?.hasField(path));\n      if(allProtected){"
new="if(compiled.kind==='choose' && privatePaths.length>=1 && this.jointChoiceFirewall) {\n      const protectedCount=privatePaths.filter(path=>this.partitionFirewall?.hasField(path)).length;\n      const allProtected=protectedCount===privatePaths.length;\n      if(protectedCount>0 && !allProtected){\n        return {decision:'deny',reason:'Protected private fields cannot be mixed with undeclared fields in an analyzable choice.',capacity:{marginalBits:0,nominalBits:Number(nominalBits.toFixed(6)),spentBits:Number(t.spentBits.toFixed(6)),maxBits:t.maxBits,sinkSpentBits:Number((t.sinkSpent.get(sinkKey)??0).toFixed(6)),sinkMaxBits:t.sinkMaxBits,cardinality:compiled.cardinality,repeat,accounting:'fail-closed-mixed-domain'}};\n      }\n      if(allProtected){"
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

p=Path('src/joint-choice-firewall.js')
s=p.read_text()
old="if(requested.length<2) return {decision:'skip',reason:'Joint choice accounting requires at least two private fields.'};"
new="if(requested.length<1) return {decision:'skip',reason:'Choice accounting requires at least one private field.'};"
assert old in s
s=s.replace(old,new,1)
old="})).filter(observation=>observation.fields.length>=2);"
new="})).filter(observation=>observation.fields.length>=1);"
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

print('choice hardening applied')
