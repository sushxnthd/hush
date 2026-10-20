#!/usr/bin/env python3
import json
import pathlib
import sys

root=pathlib.Path(__file__).resolve().parents[2]
result_path=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).with_name('mcp_stream_single_writer_result.json')
result=json.loads(result_path.read_text())
core=(root/'src'/'core.js').read_text()
checks={
    'protocol':result['protocol']=='mcp-stream-single-writer-boundary-v1',
    '100_rounds':result['rounds']==100,
    'all_json_valid':result['concurrent']['validJsonRounds']==100,
    'all_lost_update':result['concurrent']['lostUpdateRounds']==100,
    'no_full_concurrent_append':result['concurrent']['bothReceiptsDurable']==0,
    'only_one_durable':result['concurrent']['observedDurableCounts']==[1],
    'sequential_two':result['sequential']['durableReceipts']==2,
    'sequential_distinct':result['sequential']['distinctWorkers']==2,
    'gate':result['scientificGate']=='FAIL_MULTI_WRITER_APPEND',
    'load_snapshot':"this.receipts=this.load('receipts.json',[])" in core,
    'push_then_snapshot_save':"addReceipt(r){this.receipts.push(r);this.save('receipts.json',this.receipts)}" in core,
    'atomic_replace_not_append':'atomicWriteJson(path.join(this.dir,f),v)' in core,
}
for name,passed in checks.items(): print(f"{'PASS' if passed else 'FAIL'} {name}")
print(f"{sum(checks.values())}/{len(checks)}")
if not all(checks.values()): raise SystemExit(1)
