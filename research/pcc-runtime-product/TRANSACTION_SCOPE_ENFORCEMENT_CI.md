# Transaction-scope enforcement: CI state

Scientific/fix commit tested: `13be9d730bca279379af5438cb9511de0f4cd1bc`

Observed on 2026-10-21 after all triggered workflows reached terminal state.
This record commit changes documentation only.

## Passed

- `transaction-scope-enforcement` — exact artifact reproduced twice,
  independent checker, focused broker tests, and full repository regression
- `transaction-scope-enforcement-gap` — predecessor unscoped artifact reproduced
  byte-for-byte and historical audit provenance preserved
- `ci` — repository-wide tests

Local complete regression: 356/356 passing.

## Preserved failure and correction

Run <https://github.com/sushxnthd/hush/actions/runs/39563774297> failed the
predecessor artifact comparison because the first implementation added null
scope fields to legacy unscoped request hashes. Commit
`13be9d730bca279379af5438cb9511de0f4cd1bc` conditionally binds scope fields
only for scoped transactions. The successor and predecessor workflows then
both passed, proving scoped commitment binding and byte-identical unscoped
compatibility simultaneously.

The branch is research-validated, not production-release-certified. The
inherited exact-source release evidence remains historical and is not claimed
to certify this changed source.
