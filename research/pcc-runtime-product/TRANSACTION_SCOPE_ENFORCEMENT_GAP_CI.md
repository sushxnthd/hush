# Transaction-scope enforcement gap: CI state

Scientific commit tested: `5963ef941a8c5ac30bcbc5889e928e90dbac589c`

Observed on 2026-10-21 after every pull-request workflow reached a terminal
state. This record commit changes documentation only.

## Passed

- `transaction-scope-enforcement-gap` — deterministic reproduction twice,
  committed-artifact comparison, independent audit, and full test suite
- `ci`
- `codeql`
- `research-superiority`
- `cumulative-authorization-join`
- `mcp-stream-terminal-correction`
- `mcp-stream-single-writer-boundary`
- `scheduler-fiber-composition`
- `Trace envelope minimality`
- `Matched-output trace enforcement`
- `MCP GET complete mediation`
- `MCP POST complete mediation`
- `MCP DELETE complete mediation`

## Preserved failed gate

- `production-readiness / Inspect exact-source release evidence` — **failed**
  as expected. The signed historical release evidence does not certify the
  changed branch source. This is not an experimental failure and was not waived,
  regenerated, or relabeled.

The scientific claim is therefore reproducible and regression-clean, but the
branch remains deliberately not production-release-certified.
