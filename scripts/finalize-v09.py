from pathlib import Path

p=Path('src/server.js')
s=p.read_text()
assert "version:'0.8.0'" in s
s=s.replace("version:'0.8.0'","version:'0.9.0'",1)
p.write_text(s)

p=Path('README.md')
s=p.read_text()
old="""But output alphabet size is not enough to measure how informative the result that actually occurred was. v0.7 therefore added single-field realized partition accounting; v0.8 extends the same idea to analyzable **multi-field `choose` decisions**.
"""
new="""But output alphabet size is not enough to measure how informative the result that actually occurred was. v0.7 added single-field realized partition accounting; v0.8 extended the same idea to protected `choose` decisions; and v0.9 adds exact symbolic region counting so structured joint spaces can be analyzed without explicit Cartesian enumeration.
"""
assert old in s
s=s.replace(old,new,1)
s=s.replace('Supakeep v0.8 can combine:', 'Supakeep v0.9 can combine:',1)
s=s.replace("Supakeep v0.8's **JointChoiceReconstructionFirewall** computes that posterior before release and withholds the rare winner.", "The **JointChoiceReconstructionFirewall** computes that posterior before release and withholds the rare winner.",1)
s=s.replace('| v0.8 joint guard | **DENY before release** |','| v0.9 joint guard | **DENY before release** |',1)
old="""The current exact prototype enumerates up to **100,000 feasible joint states**. If a connected joint state exceeds that analysis limit, the guard fails closed instead of silently reverting to weaker cardinality accounting.
"""
new="""v0.9 removes the old hard 100,000-state enumeration boundary for supported `choose` semantics. It first performs exact symbolic interval branch-and-bound, counting whole private-state regions whenever the winner can be proven invariant. A 32-field binary benchmark therefore analyzes **4,294,967,296** possible joint profiles, detects a **32-bit** rare-winner disclosure, and denies it before release. The common branch leaves 4,294,967,295 profiles feasible and is allowed.

If symbolic analysis exceeds its configured work budget, Supakeep falls back to exact enumeration only when the remaining state is small enough; otherwise it withholds the result. Internal accounting retains unrounded leakage even when public telemetry rounds a tiny marginal value to zero.
"""
assert old in s
s=s.replace(old,new,1)
needle='- joint-choice realized privacy guard for analyzable multi-field `choose` programs;\n'
assert needle in s
s=s.replace(needle,needle+'- symbolic branch-and-bound for scalable exact choice-support counting;\n',1)
p.write_text(s)
print('v0.9 metadata finalized')
