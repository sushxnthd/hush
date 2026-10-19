#!/usr/bin/env python3
import hashlib, json, pathlib, sys

root=pathlib.Path(__file__).resolve().parents[2]
artifact=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else root/'research/pcc-runtime-product/semantic_path_digest_result.json')
data=json.loads(artifact.read_text())
source=(root/'src/context-kernel-base.js').read_text()
runtime=(root/'src/private-decision.js').read_text()
checks=[]
def check(name, ok): checks.append((name,bool(ok)))
check('receipt hashes private path list', 'privatePathsHash:sha256(canonicalize(privatePaths))' in runtime)
strip=source[source.index('function stripSemanticPaths'):source.index('function consentSummary')]
check('semantic sanitizer failed to remove digest in tested revision', 'privatePathsHash' not in strip)
check('one authorized result', data['distinctAuthorizedResults']==1)
check('all observations split', data['distinctDigests']==data['frozenCohortSize'])
check('all paths recovered', data['exactRecoveries']==data['frozenCohortSize'])
for row in data['rows']:
  expected=hashlib.sha256(json.dumps([row['actualPath']],separators=(',',':')).encode()).hexdigest()
  check(f"digest-{row['index']}", row['digest']==expected)
  check(f"recovery-{row['index']}", row['recoveredPath']==row['actualPath'])
failed=[name for name,ok in checks if not ok]
report={'schema':'hush.semantic-path-digest-audit.v1','checks':len(checks),'passed':len(checks)-len(failed),'failed':failed}
print(json.dumps(report,indent=2))
raise SystemExit(bool(failed))
