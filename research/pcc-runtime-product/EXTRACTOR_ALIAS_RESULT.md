# PCC extractor-alias composition result

## Decisive result

The preregistered security-consistency gate **FAILED**. PCC's realized-posterior
protection can be partitioned by semantically equivalent extractor metadata.

| Same source, secret 500, domain 0..1023 | Shared extractor | Harmless extractor alias |
|---|---:|---:|
| `secret >= 500` released | yes | yes |
| `secret <= 500` released | **denied** | **yes** |
| Independent candidates after observations | 524 | **1** |
| Exact secret reconstructed | no | **yes** |
| PCC posterior ledgers | 1 | **2** |

The first release left 524 candidates and recorded 0.966577 realized bits. With
an identical extractor, the second comparison used the same posterior and was
denied because its joint result would identify the secret. Adding the harmless
anchor `balance` to the second extractor changed no extraction behavior for the
numeric source, but it changed the opaque PCC field key. The second comparison
therefore began from all 1,024 candidates, left 501 candidates, and was released
at 1.031333 bits. An independent set intersection reduced the two public
observations to exactly `[500]`.

## Mechanism and claim boundary

The failure is **privacy-ledger aliasing**: accounting is sound within one key,
but syntactic extractor identity creates multiple keys for the same private
scalar. This is a deterministic minimal counterexample to safe composition of
separately authored trusted PCC contracts.

It is not a remote arbitrary-code exploit: registering contracts is a trusted
local action. It nevertheless matters for product safety because independently
installed or evolved trusted integrations can describe the same source with
different anchors, units, or other extraction metadata. The earlier scheduling
result remains valid for its fixed contracts, but the firewall must not be
described as alias-invariant until corrected and prospectively retested.

## Evidence and next discrimination

- Frozen protocol/runner commit: `fd0232e18576396de0386b5c0ff4069078be69ae`.
- Raw result: `extractor_alias_probe.json`.
- Actual encrypted Context Kernel and PCC approval/consumption path used.
- Independent candidate intersection used; it does not import Hush's partition
  implementation.

The cheapest correction is to bind the posterior to the private source
location and an opaque digest of the extracted scalar, not to the extractor's
syntax. Differing extractors that recover the same scalar must share a ledger;
extractors that recover different scalars must remain distinct. Differing
declared domains for that same logical scalar must fail closed. The frozen probe
must then reverse from FAIL to PASS, followed by an alias-family sweep and the
full regression suite.
