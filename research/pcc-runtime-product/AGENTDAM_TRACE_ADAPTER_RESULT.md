# Pinned AgentDAM trace overlay — result

## Verdict

**PASS (capability-building only).** The frozen synthetic integration passed all
9/9 gates on its first execution. A second clean invocation produced
byte-identical manifest, trace and evaluation files.

## Exact result

| Arm | Valid | Task success | Privacy success | Disclosed cases |
|---|---:|---:|---:|---:|
| Raw | 6/6 | 6/6 | 0/6 | 6/6 |
| PCC | 6/6 | 6/6 | 6/6 | 0/6 |

Both arms retained the forced case-5 timeout, error, retry and two model
attempts. Every trace had a digest. The evaluator kept all 12 case-arm records
in the denominator.

The adapter rejected a checkout unless all of these matched:

- revision `5d4068a404b624ed24ebbe5fb49ba5f644557912`;
- runner blob `099b25a89af58401692aa6d46bfd3e61f63c5cb9`;
- PromptAgent blob `3341c4f368080e9b5991234362162151b63509c7`;
- OpenAI-provider blob `ca4cc6ccce01517b6cb1c60483b7848118bfc8e8`;
- the exact model-call, browser-action and receipt integration anchors.

## Reproducibility

Focused checks: Python adapter tests 3/3; boundary evaluator tests 7/7. The
complete Hush Node test suite passed 320/320 after the adapter dry run.

Pretty-printed artifact SHA-256 values:

- manifest: `5e9456fdb429d2ab24d658bbaf332f0e298e167d285ee5c7230aca6f3be1b8bd`;
- traces: `a1923c2670da7b6685af018b44e34083fe77a129887febf82973fd22e9ca4f86`;
- result: `0f56e2176f2f85a2305bfbf75167fbd1697a2b4b53b73901a75f9c055817c9ee`.

The machine result also embeds a canonical compact-object result digest:
`df129bfc94be6dfbf45e27252239cad66f2c2a1a5b05847e0ff67d96dcb11f99`.

```bash
git clone https://github.com/facebookresearch/ai-agent-privacy.git /tmp/agentdam
git -C /tmp/agentdam checkout --detach \
  5d4068a404b624ed24ebbe5fb49ba5f644557912
python3 research/pcc-runtime-product/run_agentdam_adapter_dryrun.py \
  --checkout /tmp/agentdam \
  --manifest /tmp/agentdam-adapter-manifest.json \
  --traces /tmp/agentdam-adapter-traces.json
node research/pcc-runtime-product/evaluate_agentdam_adapter_dryrun.mjs \
  --manifest /tmp/agentdam-adapter-manifest.json \
  --traces /tmp/agentdam-adapter-traces.json \
  --output /tmp/agentdam-adapter-result.json
```

## Claim boundary

This proves that the pinned runner surfaces needed by the overlay can be
verified and that exact model requests, browser/provider requests, actions,
receipts, errors and retries can be normalized into the frozen fail-closed
schema under synthetic module/page doubles. It does **not** validate AgentDAM
task performance, semantic privacy, a live Playwright/provider path, a local
model, or any PCC advantage on external tasks. No benchmark outcome was opened.

## Next discrimination

Freeze licensed subset IDs and hashes, pinned local model and semantic judge,
then connect the same overlay at the real runner loop and execute a no-outcome
smoke test. Only after that freeze should the matched external arms be opened.
