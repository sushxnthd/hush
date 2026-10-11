# PCC pre-approval metadata disclosure: frozen result

## Verdict

**FAIL.** Preparation metadata disclosed unapproved private predicate results
through two independent mechanisms.

| Public pre-approval channel | Frozen observation | Private result recovered |
|---|---:|---:|
| Realized posterior size, single release | 524 of 1,024 candidates | `secret >= 500` is true |
| Serialized size, balanced release | 108 bytes vs false reference 132 | `secret >= 512` is true |
| Realized posterior size, bundle | 300 of 1,024 candidates | Both predicates are true |

No release was approved or consumed. The safe preparation responses had
`decision: ask`, yet their `outputBytes`, `afterCandidates`, and
`totalKnowledgeBits` fields were functions of the withheld result.

The balanced size test is important: both branches retained exactly 512
candidates and exactly one bit of knowledge. Unequal public labels alone made
the serialized size identify the branch. Conversely, the bundle had no public
output-size field, but its realized candidate count still exposed the result
combination.

## Evidence

- Preregistered prediction commit: `7112b95aaa801c2ca71d9120557b76bcd05943fc`
- Raw artifact SHA-256:
  `6387be722bbaed07d631b30a062af900134784f6b68970a5e007e34e69fcabb8`
- Declared domain: integer 0..1023
- Approvals: 0
- Consumptions: 0

## Assumption falsified

Hiding `statement` and `value` from preparation responses is insufficient.
Result-dependent metadata is itself a release and can bypass the approval
boundary.

## Cheapest discriminating correction

Remove serialized output size and realized posterior statistics from all safe
pre-approval single and bundle metadata. Preserve only result-independent
budget/capacity information and pre-query candidate count. Return realized
accounting with the approved consumed output and receipt, then rerun the
unchanged probe and full regression suite.

## Claim boundary

This is an agent-facing metadata disclosure in the local runtime. It is not
evidence of provider-boundary transmission, timing leakage, or arbitrary
side-channel resistance.
