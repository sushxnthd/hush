# AgentDAM external-study source, license and subset freeze

## Status

**Source/subset provenance: PASS. External execution: BLOCKED. Outcomes: UNOPENED.**

This capability-building step freezes a deterministic 36-case research subset
from the pinned AgentDAM release without using task content or outcomes. The
verifier extracted only `task_id`, recomputed every source SHA-256 and Git blob,
and reproduced 12 IDs each from GitLab, Reddit and Shopping using the frozen
rule in `agentdam_external_freeze_manifest.json`.

## Supported claim

At upstream revision
`5d4068a404b624ed24ebbe5fb49ba5f644557912`, the three released AgentDAM task
files and supporting sources match the frozen hashes, and the revision-bound
ID-only selection deterministically identifies the same 36 cases. This is a
protocol/provenance result, not external evidence for PCC.

## License boundary

The upstream repository states that most released material, including
`agentdam/data`, is CC BY-NC 4.0. It also states that the generated
`agentdam/data/wa_format` output is subject to the Llama 3.1 terms. The public
study package therefore records upstream paths, IDs, blob hashes and content
hashes rather than copying task payloads. This is a conservative research
packaging decision, not legal advice. Any downstream release must preserve the
applicable attribution and noncommercial/use-specific terms.

## Zero-spend execution blocker

The pinned README supports a local vLLM endpoint, but its example launches a
70B model across eight GPUs and the benchmark additionally requires Python
3.10/3.11, Playwright, and standalone GitLab, Shopping and Reddit services.
The present clean environment has Python 3.12, no visible GPU, no Docker daemon,
no Playwright CLI, and none of the audited Python packages (`beartype`,
`openai`, `playwright`, `tiktoken`, `torch`, `vllm`). Accordingly the verifier
fails the execution gate closed. No paid API or benchmark outcome was used.

Even in a compatible environment, outcomes must remain unopened until a pinned
local model/quantization, semantic judge, exact timing policy, and faithful
OCELOT-style and MNC-style matched controls are frozen.

## Reproduce

```bash
git clone https://github.com/facebookresearch/ai-agent-privacy.git /tmp/agentdam
git -C /tmp/agentdam checkout 5d4068a404b624ed24ebbe5fb49ba5f644557912
python3 research/pcc-runtime-product/verify_agentdam_external_freeze.py \
  /tmp/agentdam \
  --output /tmp/agentdam_external_freeze_result.json
sha256sum /tmp/agentdam_external_freeze_result.json
```

The result is deterministic for a fixed checkout and execution environment.
The two-run canonical result SHA-256 in this environment is
`b07a5863e614db04ccbeb432f86e89d971a4edb731de9dddd8ee49a89914a192`.

## Discovery Engine record

- **Hypothesis:** a genuinely external, cross-domain AgentDAM cohort can be
  frozen reproducibly under zero-spend and redistribution-safe constraints.
- **Mechanism:** revision-pinned file hashes plus task-ID-only deterministic
  sampling separate study selection from task content and outcomes.
- **Preregistered prediction:** all source hashes and selections reproduce;
  task outcomes remain unopened; execution fails closed if any source,
  environment or control prerequisite is absent.
- **Observed:** source/subset provenance passed; execution is blocked.
- **Residual/surprise:** source selection is cheap, but the released zero-spend
  model path has a much larger compute/runtime footprint than the adapter smoke.
- **Assumption weakened:** “open benchmark” does not imply a locally executable
  or unrestricted reproducibility package.
- **Competing explanation:** a smaller local model may execute the benchmark,
  but changing the model changes the frozen study and may make task success too
  low to discriminate privacy mechanisms.
- **Uncertainty:** compatibility of smaller quantized models, semantic-judge
  reliability, and fidelity of matched OCELOT/MNC controls are untested.
- **Evidence provenance:** manifest and verifier in this directory; upstream
  revision and every audited blob/content hash are frozen there.
- **Cheapest next discriminating experiment:** implement and test the semantic
  judge and matched controls on synthetic/open development fixtures, then run a
  no-outcome startup check in a genuinely compatible zero-spend environment.

Breakthrough gate: **INCONCLUSIVE**.
