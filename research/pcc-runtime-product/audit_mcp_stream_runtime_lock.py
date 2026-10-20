#!/usr/bin/env python3
import json, pathlib, sys

root=pathlib.Path(__file__).resolve().parents[2]
result=json.loads((pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).with_name('mcp_stream_runtime_lock_result.json')).read_text())
server=(root/'src'/'server.js').read_text()
lock=(root/'src'/'runtime-lock.js').read_text()
checks={
 'protocol':result['protocol']=='mcp-stream-runtime-lock-closure-v1',
 '50_rounds':result['rounds']==50,
 'all_live_rejected':result['liveContenderRejected']==50,
 'all_dead_recovered':result['deadOwnerRecovered']==50,
 'gate':result['scientificGate']=='PASS',
 'lock_before_store':server.index('acquireRuntimeLock(dataDir)') < server.index('new Store(dataDir)'),
 'exclusive_create':"fs.openSync(file,'wx'" in lock,
 'live_pid_check':'processAlive(Number(owner.pid))' in lock,
 'fail_closed_code':"code:'HUSH_ALREADY_RUNNING'" in lock,
}
for name,passed in checks.items(): print(f"{'PASS' if passed else 'FAIL'} {name}")
print(f"{sum(checks.values())}/{len(checks)}")
if not all(checks.values()): raise SystemExit(1)
