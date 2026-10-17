# PCC preparation timing-oracle result

## Result

**PASS WITHIN TESTED RESOLUTION.** The corrected PCC preparation path did not
show a usable elapsed-time signal distinguishing a firewall-withheld equality
result from an allowed result under the frozen in-process protocol.

| Measure | Frozen run | Independent repeat |
|---|---:|---:|
| Paired target/control comparisons | 500 | 500 |
| Adjusted median latency ratio | 1.00052 | 1.00510 |
| Majority direction | 251/500 | 256/500 |
| Exact two-sided sign-test p | 0.9643 | 0.6228 |
| Consistent 100-pair blocks | 2/5 | 3/5 |
| Leakage gates passed | 0/4 | 0/4 |

The preregistered failure threshold required all of: at least a 5% adjusted
median effect, 65% direction consistency, `p < 0.001`, and the same direction
in at least four of five blocks. Neither run passed any gate.

## Interpretation

The earlier response-level correction does not merely hide a large, stable
in-process timing difference on this machine. The residual adjusted median was
0.052% in the frozen run and 0.510% in the repeat, with near-random directions.
This weakens the specific result-dependent timing hypothesis at the tested
resolution; it is not evidence of constant-time execution.

## Provenance

- Frozen protocol commit: `14c2505e6083b73b1c0f2e362e8df421aa931cb3`.
- Frozen raw artifact SHA-256:
  `c7dd915c45159c5a240178331a2c4bfebbf7dc21e27b8c5ef03af8a62cfe490a`.
- Repeat raw artifact SHA-256:
  `5167ee34d70c91949d145f41595b73cf058e46efa6b2fcc080ae744fdce647e3`.
- Runtime: Node.js v24.19.0, Linux x64.
- No timed release was approved or consumed.

## Reproduce

```bash
node research/pcc-runtime-product/run_timing_oracle_probe.mjs \
  --output /tmp/timing_oracle_replay.json
```

Timing artifacts are intentionally not expected to be byte-identical. Compare
the frozen gates and conclusion, not raw nanoseconds.

## Boundary

This is one in-process runtime, one equality predicate, one 1,024-value domain,
and a preregistered 5% effect threshold. Network timing, cross-process attacks,
cache/CPU adversaries, other predicates and domain sizes, standing consent, and
formal constant-time or noninterference guarantees remain untested. The broader
scientific breakthrough gate remains **INCONCLUSIVE**.
