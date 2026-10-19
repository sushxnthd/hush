# Semantic private-path digest dictionary oracle

## Smallest supported claim

Hush's production `hush_private_query` surface hides literal private paths but, in the tested revision, returns `receipt.privatePathsHash = SHA256(canonicalize(privatePaths))`. For a finite candidate dictionary this deterministic, unsalted digest is an exact equality oracle for the hidden path selected by the semantic compiler.

This is a concrete violation of observable-fiber closure: 32 worlds used the same public semantic request and produced the same authorized Boolean result, yet exposed 32 distinct digest observations and permitted 32/32 exact path recoveries.

This is not a SHA-256 break, a private-value recovery, or a remote timing exploit. It is a deterministic dictionary attack on a low-entropy internal identifier.

## Frozen experiment

- 32 plausible private-path candidates, fixed before execution.
- One record per world, with identical public metadata (`Planning ceiling`, `planning`, `budget`) and identical private value 1500.
- Identical semantic MCP request in every world: test whether the planning ceiling is at least 1000.
- Attacker dictionary: compute the documented production digest for each candidate path and match the returned receipt field.
- No thresholds or candidate paths were changed after observation.

## Result

| Quantity | Result |
|---|---:|
| Worlds | 32 |
| Distinct authorized results | 1 |
| Distinct exposed digests | 32 |
| Exact path recoveries | 32/32 |
| Recovery rate | 100% |
| Independent audit | 69/69 checks |
| Duplicate artifact | byte-identical |
| Focused MCP tests | 12/12 pass |

## Mechanism and law

Let `R(s)` be the authorized release and `O(s)` any auxiliary observation. A necessary and sufficient finite deterministic condition for the auxiliary channel to add no distinguishing power beyond `R` is

`R(s1) = R(s2) => O(s1) = O(s2)`.

Equivalently, `O` must factor through `R`. Here the result is constant on the 32-world release fiber, while the returned path digest is injective on that cohort. Hashing the hidden identifier does not restore closure when the identifier comes from an enumerable dictionary.

The factorization statement is classical noninterference/post-processing reasoning; no broad theorem novelty is claimed. The new project result is the mechanism-derived prediction and exact production counterexample on Hush's semantic MCP surface.

## SCIENCE ledger

- **True:** a deterministic hash of a low-entropy hidden capability identifier is itself a recoverable capability identifier under dictionary knowledge.
- **Alternative explanation rejected:** the attack does not depend on different private values, metadata, queries, results, timing, or errors; only the internal path differs.
- **Limit:** the experiment proves recovery within the frozen dictionary. It does not measure how well an attacker can enumerate arbitrary user-defined paths in the wild.

## CONSEQUENCE ledger

The semantic agent-facing surface must not return `privatePathsHash`, even though the low-level compatibility surface may retain it for clients that already supplied the paths. Receipts intended for internal audit must be separated from externally released semantic receipts. The frozen correction gate is: remove the digest from `hush_private_query`, preserve authorized results, collapse the projected observation to one value across the unchanged 32 worlds, and retain the original failure artifact.

## Reproduction

```bash
node research/pcc-runtime-product/run_semantic_path_digest_probe.mjs > research/pcc-runtime-product/semantic_path_digest_result.json
python3 research/pcc-runtime-product/audit_semantic_path_digest.py research/pcc-runtime-product/semantic_path_digest_result.json
node --test test/native-mcp.test.js
```
