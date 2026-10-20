# MCP stream single-writer boundary result

## Decision

**Decisive falsification of multi-process receipt completeness.** The PR #37
terminal lifecycle mechanism remains valid for its stated single-runtime
partition, but its storage layer cannot support a broader shared-store or
overlapping-process claim.

## SCIENCE ledger

The frozen experiment synchronized two Node processes after each had loaded the
same empty `receipts.json` snapshot. Each appended a distinct receipt using the
production `Store.addReceipt` path.

| Condition | Trials | Valid JSON | Both distinct receipts durable | Lost-update trials |
|---|---:|---:|---:|---:|
| Two synchronized processes | 100 | 100 | 0 | 100 |
| One process, two sequential appends | 1 | 1 | 1 | 0 |

The frozen prediction survived exactly. Every concurrent file was parseable and
contained one receipt from one worker. Atomic replacement therefore prevented a
torn file while the snapshot read-modify-write cycle lost one logically
completed append.

An independent source/result audit passed **12/12** checks. It verifies the
production sequence:

1. load the full receipt array into process memory;
2. push to that private array;
3. atomically replace the full JSON snapshot.

Two complete 100-round executions were byte-identical because the artifact
records only stable counts and excludes scheduling-dependent winner identity.

## CONSEQUENCE ledger

The primitive requires an explicit single-writer boundary. A follow-up source
audit found that the production server already acquires `runtime.lock` before
constructing `Store`; this initial artifact therefore tests the unsafe storage
primitive directly, not the complete startup path. The production closure is
evaluated separately in `MCP_STREAM_RUNTIME_LOCK_RESULT.md`.

Without the existing startup lease, overlapping instances could erase a prior
attempt, opened state, terminal result, or unrelated receipt even though every
individual write appears atomic and the file remains valid. A transactional
append log remains the stronger alternative if multi-process service is ever
required.

## Smallest supported claim

Whole-file atomic replacement does not make `Store.addReceipt` an atomic
multi-process append. The current exactly-once stream-terminal result is valid
only under a single-writer runtime assumption.

## Limits

- This is not a filesystem or atomic-rename novelty claim.
- The probe tests two local Node processes on one filesystem; it does not cover
  network filesystems, containers, or distributed consensus.
- It does not falsify the five single-runtime lifecycle cases from PR #37.
- It does not yet supply the positive lease correction.

## Reproduce

```bash
node research/pcc-runtime-product/run_mcp_stream_single_writer_probe.mjs /tmp/result.json
python research/pcc-runtime-product/audit_mcp_stream_single_writer.py /tmp/result.json
```
