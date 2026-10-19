#!/usr/bin/env python3
import json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2]
data=json.loads(pathlib.Path(sys.argv[1]).read_text())
source=(root/'src/context-kernel-base.js').read_text()
runtime=(root/'src/private-decision.js').read_text()
strip=source[source.index('function stripSemanticPaths'):source.index('function consentSummary')]
checks={
 'semantic sanitizer deletes digest':'delete out.receipt.privatePathsHash' in strip,
 'semantic sanitizer emits fixed binding marker':'out.receipt.privateCapabilitiesBound=true' in strip,
 'low-level receipt retained':'privatePathsHash:sha256(canonicalize(privatePaths))' in runtime,
 'results preserved':data['distinctAuthorizedResults']==1,
 'no digest exposures':data['digestExposures']==0,
 'no raw path exposures':data['rawPathExposures']==0,
 'fiber closed':data['distinctObservations']==1,
 'all row markers fixed':all(r['observation']['privateCapabilitiesBound'] is True for r in data['rows'])
}
failed=[k for k,v in checks.items() if not v]
print(json.dumps({'schema':'hush.semantic-path-digest-correction-audit.v1','checks':len(checks),'passed':len(checks)-len(failed),'failed':failed},indent=2))
raise SystemExit(bool(failed))
