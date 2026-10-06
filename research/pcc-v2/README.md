# PCC v2 Research Track

Private Constraint Compilation v2 separates private context into three local trust lanes before any AI sees it:

1. **raw private facts** — exact sensitive values;
2. **trusted task facts** — context already classified locally as task-relevant;
3. **derived abstractions** — policy-approved coarse forms such as bands, categories, summaries, ranges, anonymized identities, or location granularity.

A raw fact cannot inherit permission from a policy clause that authorizes only a coarser representation.

## Evidence ladder

- POLAR P1: development only. Final development result: privacy 1.000, utility 1.000, minimal success 1.000 across 1,571 cases, with 0/11,376 protected targets disclosed.
- POLAR P2: untouched preregistered confirmation. privacy 1.000, utility 1.000, minimal success 1.000 across 1,570 cases, with 0/11,366 protected targets disclosed versus 11,366/11,366 under raw context.

See `P2_CONFIRMATORY_PROTOCOL.md` and `P2_CONFIRMATORY_RESULTS.md` for frozen provenance, gates, limitations, and hashes.

## Current research claim

The result supports a narrow claim: on the tested external structured-context regime, policy-aware local compilation can preserve benchmark utility while replacing raw protected-value disclosure with task-sufficient representations.

It does not establish universal semantic privacy, arbitrary unstructured-text transformation, independent reproduction, or immunity to every inference or side channel.
