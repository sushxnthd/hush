# Pinned AgentDAM runner-loop overlay — no-outcome smoke result

## Verdict

**PASS (capability-building only).** All 8/8 preregistered gates passed on the
first execution. An independent invocation produced byte-identical manifest,
trace and evaluation files.

## Decisive result

The harness loaded and executed the pinned upstream `run_agentdam.test()` loop
and `PromptAgent.next_action()` method. The first synthetic model response was
deliberately malformed, so PromptAgent's released parse-retry control flow—not
a local imitation—issued the second model request.

| Arm | Valid | Task success | Model requests | Retry | Action/provider/receipt | Disclosed |
|---|---:|---:|---:|---:|---:|---:|
| Raw | 1/1 | 1/1 | 2 | 1 | 1 / 1 / 1 | 1/1 |
| PCC | 1/1 | 1/1 | 2 | 1 | 1 / 1 / 1 | 0/1 |

Both traces contained zero error records and a valid digest. All expected arms
remained in the fixed denominator.

Verification after the smoke: trace-adapter tests 3/3, runner-overlay tests
1/1, boundary-evaluator tests 7/7, and the complete Hush suite 320/320.

## Provenance and reproduction

- revision: `5d4068a404b624ed24ebbe5fb49ba5f644557912`;
- runner blob: `099b25a89af58401692aa6d46bfd3e61f63c5cb9`;
- PromptAgent blob: `3341c4f368080e9b5991234362162151b63509c7`;
- provider blob: `ca4cc6ccce01517b6cb1c60483b7848118bfc8e8`;
- canonical evaluation digest:
  `5b4d16b8d98b3e739a72aff549a89e9d254841dfcd50f67e06b2b0fe29e883eb`;
- pretty manifest SHA-256:
  `155c6b54bb8c999dd0953f2f32f6090da9f060ade48eb9d38385c20cf8193f4b`;
- pretty trace SHA-256:
  `2bce591bfc955655017b6bd11edd57fe9a69cd8962130fb263106e6f959b3e9e`;
- pretty result SHA-256:
  `edc4df7b6f98e180ed20c47e414c608e39f1bfa35cc025499406931cd5fd7469`.

```bash
git clone https://github.com/facebookresearch/ai-agent-privacy.git /tmp/agentdam
git -C /tmp/agentdam checkout --detach \
  5d4068a404b624ed24ebbe5fb49ba5f644557912
python3 research/pcc-runtime-product/run_agentdam_runner_loop_smoke.py \
  --checkout /tmp/agentdam \
  --manifest /tmp/agentdam-runner-manifest.json \
  --traces /tmp/agentdam-runner-traces.json
node research/pcc-runtime-product/evaluate_agentdam_runner_loop_smoke.mjs \
  --manifest /tmp/agentdam-runner-manifest.json \
  --traces /tmp/agentdam-runner-traces.json \
  --output /tmp/agentdam-runner-result.json
```

## Smallest supported claim

The source-pinned overlay can attach to the released AgentDAM runner and
PromptAgent control flow and retain exact model, retry, action, provider and
receipt boundaries under dependency-isolated local fixtures. This closes the
synthetic runner-integration uncertainty identified after the first adapter dry
run.

## Limitations

The browser environment, provider, prompt constructor, render helper and
evaluator were deterministic local doubles. Dependency isolation allowed the
two exact upstream source files to run without installing their heavyweight
stack, but it is not a clean-environment AgentDAM installation. This result
does not validate a live browser or provider, a local model, semantic privacy,
timing leakage, any AgentDAM task, or PCC superiority. No benchmark outcome was
opened.

## Next discrimination

Freeze the licensed task subset IDs and hashes, local-model revision, semantic
judge, exact timing capture and faithful OCELOT/MNC control specifications.
Then perform one clean-environment, no-outcome dependency/browser startup check
before opening the matched external study.
