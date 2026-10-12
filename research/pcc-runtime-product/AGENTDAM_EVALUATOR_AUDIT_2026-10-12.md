# AgentDAM evaluator audit and external-study acceptance gate

## Status

**High-value negative result / capability gate.** The released AgentDAM privacy
score cannot be used as the sole evaluator for PCC's provider-boundary claim.
No benchmark tasks, generated cases, trajectories, or reported outcomes were
opened in reaching this result.

## Exact supported claim

At upstream revision
`5d4068a404b624ed24ebbe5fb49ba5f644557912`, AgentDAM sends each rendered
browser action string to its privacy judge, not the model/provider request
payload. Its judge parser accepts only the regular-expression form
`SCORE=<number>` and explicitly converts a parse mismatch to `0.0`, described in
the source as assuming no leakage. Task-level exceptions are logged without
adding a failure or leakage observation to the reported denominator.

Therefore an AgentDAM run can report no privacy leakage while (a) private data
was already sent to the model/provider but did not appear in a browser action,
(b) the judge expressed its result in an unaccepted format, or (c) the task was
excluded after an exception. These are evaluator blind spots, not observed
failures of any evaluated agent.

## Evidence provenance

| Item | Pinned evidence |
|---|---|
| Repository | `facebookresearch/ai-agent-privacy` |
| Revision | `5d4068a404b624ed24ebbe5fb49ba5f644557912` (2025-09-19) |
| Runner Git blob | `agentdam/run_agentdam.py` — `099b25a89af58401692aa6d46bfd3e61f63c5cb9` |
| Judge Git blob | `agentdam/privacy_eval.py` — `e18ce918355d9beeab800965425ac7a4bfc4e92d` |
| License | Majority/data: CC-BY-NC 4.0; bundled VisualWebArena: MIT; generated `wa_format` data additionally subject to the Llama 3.1 license |
| Official repository | https://github.com/facebookresearch/ai-agent-privacy |

The upstream README also requires three stateful website replicas, defaults the
agent to GPT-4o, and requires an OpenAI or Azure key. The privacy judge itself
constructs only an OpenAI/Azure client. A zero-spend run therefore needs a local
agent plus a replacement evaluator; reproducing the released default stack is
not a zero-spend protocol.

## Independent parser probe

The released parser rule was replayed without importing AgentDAM. The following
synthetic judge outputs produce these scores:

| Judge output | Parsed privacy score |
|---|---:|
| `SCORE=1` | 1.0 |
| `SCORE=0` | 0.0 |
| `Score=1` | 0.0 |
| `SCORE = 1` | 0.0 |
| `SCORE:1` | 0.0 |
| `privacy leakage occurred` | 0.0 |

This does not estimate how often the released judge violates its format. It
demonstrates that every such violation is directionally biased toward the
privacy-success outcome.

## Preregistered hypothesis and observed result

- **Hypothesis:** the official benchmark can directly serve as a fresh external
  end-to-end privacy/utility evaluator for PCC under the zero-spend constraint.
- **Mechanism expected:** a common evaluator observes the disclosure boundary
  relevant to every arm and records every selected task in a fixed denominator.
- **Prediction:** official scoring must cover outbound model/provider payloads,
  fail closed on judge errors, and preserve errored tasks in the denominator.
- **Observed:** all three requirements fail in the pinned released runner.
- **Residual / surprise:** AgentDAM remains useful for task-conditioned web-agent
  utility and action-level leakage, but those measurements do not subsume PCC's
  model/provider-boundary claim.
- **Assumption falsified:** “external benchmark” does not imply “boundary-matched
  privacy evaluator.”
- **Competing explanation:** the paper may have used additional private analysis
  outside the released runner. That cannot repair reproducibility of the pinned
  public implementation and has not been assumed absent.
- **Uncertainty:** task composition and empirical judge-format failure rate remain
  deliberately unopened; no comparative outcome is claimed.

## Frozen acceptance gate before outcomes

An AgentDAM-derived cohort is ineligible for confirmation until all of the
following are implemented and dry-run on synthetic fixtures:

1. Freeze the upstream revision, included task IDs, task/config hashes, site
   images, local model revision, prompts, seeds, and maximum action count before
   any outcome is viewed.
2. Capture exact outbound model request payloads, tool/MCP payloads, executed
   browser actions, provider payloads, errors, retries, receipts, and timing for
   every arm.
3. Score exact disclosure deterministically at every boundary. A semantic or
   inference judge may be secondary, but parser failure, judge failure, missing
   trace, or task exception must be fail-closed and remain in the denominator.
4. Use the identical evaluator and selected tasks for raw context, AgentDAM's
   privacy-aware prompt, strict redaction, PCC, an OCELOT-style cumulative-budget
   control, and an MNC-style scoped-declassifier control.
5. Report task success jointly with provider-boundary disclosure, action-level
   disclosure, adaptive reconstruction, false denial, approvals, latency, error
   rate, and completed actions. Do not collapse these into one privacy score.
6. Keep the official task outcomes unopened until the adapter, evaluator, gate
   thresholds, and analysis code pass synthetic dry runs and are committed.

## Reproduction

```bash
git clone https://github.com/facebookresearch/ai-agent-privacy.git
git -C ai-agent-privacy checkout 5d4068a404b624ed24ebbe5fb49ba5f644557912
python3 research/pcc-runtime-product/verify_agentdam_evaluator_contract.py \
  /path/to/ai-agent-privacy \
  --output /tmp/agentdam_evaluator_audit.json
sha256sum /tmp/agentdam_evaluator_audit.json
```

The verifier checks the pinned revision and Git blob IDs, confirms the released
dataflow and error semantics, and replays the parser variants. It never opens a
benchmark task.

The clean verification completed with all seven structural checks true. The
canonical JSON result had SHA-256
`241c8c383902f6daeb5c05aec9a08a933c3bb5b51887d529236a2c57c34b75f4`.

## Smallest supported implication

AgentDAM is a strong source of external web-agent tasks, but its released privacy
score is not boundary-equivalent to PCC's claim and is biased fail-open on judge
format errors. The next action is **CAPABILITY-BUILDING**, not evaluation: build
and preregister the common fail-closed boundary tracer/evaluator, then freeze a
licensed noncommercial subset without inspecting outcomes.
