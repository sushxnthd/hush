# AgentDAM-compatible fail-closed boundary evaluator — result

## Gate result: PASS

The first frozen synthetic run passed all 11 machine gates. A second run was
byte-identical.

| Arm | Denominator | Task success | Privacy success | Disclosed cases |
|---|---:|---:|---:|---:|
| Raw context | 12 | 12 | 0 | 12 |
| AgentDAM privacy-prompt fixture | 12 | 12 | 0 | 12 |
| Strict redaction | 12 | 0 | 12 | 0 |
| PCC fixture | 12 | 12 | 12 | 0 |
| OCELOT-style fixture | 12 | 12 | 12 | 0 |
| MNC-style fixture | 12 | 12 | 12 | 0 |

These are deliberately constructed dry-run fixtures. The table validates
measurement symmetry and expected tradeoffs; it is not a system comparison.

## Adversarial evaluator checks

| Perturbation | Observed fail-closed behavior |
|---|---|
| Missing PCC trace | denominator remained 12; valid/task/privacy count fell to 11 |
| Missing provider boundary array | denominator remained 12; valid/task/privacy count fell to 11 |
| Private token in retry | 1 disclosed case; privacy count fell to 11 |
| Declared alias in error | 1 disclosed case; privacy count fell to 11 |
| Duplicate trace | protocol invalidated; all arm privacy successes forced to zero |
| Errored task | denominator remained 12; task successes fell to 11 |

## Evidence

- Upstream task-source pin: `facebookresearch/ai-agent-privacy` at
  `5d4068a404b624ed24ebbe5fb49ba5f644557912`.
- Manifest SHA-256:
  `0db35706ddabb4ee7c613867f68e3422ac34cb10c2eb7b009deb2ed0f6439c1d`.
- Baseline row digest:
  `b1d766366445194c3d57a327cac68a53d53e00fb4727c4c7380cb948b1bdb6e8`.
- Complete result SHA-256:
  `523d8d8e34e4ff292790207120f7eadc8b7fb395455b8aaab2fad0ca3234d1f8`.
- Focused evaluator tests: 7/7.

During the first full-suite run, an unrelated probabilistic test harness issue
was exposed: replacing the final two base64url characters with `AA` is a no-op
when they are already `AA`, so the test did not always mutate ciphertext. The
test now flips a decoded ciphertext byte deterministically. This changes no
runtime behavior or security claim and is preserved as test-infrastructure
failure mining.

## Smallest supported claim

The evaluator now preserves an immutable case-arm denominator, treats missing
evidence as both utility and privacy failure, and measures retained retry/error
payloads in addition to normal model/tool/provider/action/receipt paths. It is
ready for synthetic adapter integration tests.

It is **not** ready for confirmatory AgentDAM execution: the actual AgentDAM
adapter, licensed subset manifest, local model, semantic/inference judge, and
faithful OCELOT/MNC controls remain unimplemented. No AgentDAM task outcome has
been inspected.

## Reproduce

```bash
node research/pcc-runtime-product/run_agentdam_boundary_dryrun.mjs \
  --output /tmp/agentdam_boundary_dryrun.json
sha256sum /tmp/agentdam_boundary_dryrun.json
node --test test/agentdam-boundary-evaluator.test.js
```
