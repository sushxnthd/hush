# Private Constraint Compilation

Status: experimental architectural primitive.

Private Constraint Compilation (PCC) is the local transformation layer used when a useful task constraint is fused with private context in the same source value. Retrieval cannot safely solve this class: releasing the source leaks the private detail, while dropping the source loses utility.

PCC runs inside Hush before model context is created. A locally trusted, declarative contract selects one private record, extracts a bounded typed value, and renders a fixed-schema statement. Source prose is never copied into the caller-visible result.

## Security invariant

For every successful compilation:

1. the contract, not the remote agent, defines the extractor and output schema;
2. extraction is bounded to typed atoms (`boolean`, `number`, `enum`, or `date_bucket`);
3. output wording comes from the contract label/unit, never from private source prose;
4. the private path and source value are omitted from the result and receipt;
5. ambiguous or missing evidence fails closed;
6. disclosure is bound to agent, sink, purpose, TTL, consent, and one-shot consumption.

This is intentionally different from sanitization. Sanitization rewrites a private value for release. PCC computes a new, task-sufficient fact and releases only that derived fact.

## Example

Private source:

`The maximum planned groundspeed is 110 mph, although a crew member said the pilot is under financial pressure.`

Trusted contract:

- type: `number`
- anchors: `maximum`, `groundspeed`
- unit aliases: `mph`, `miles per hour`
- output label: `Maximum planned groundspeed`
- output unit: `mph`

Caller-visible result:

`Maximum planned groundspeed: 110 mph.`

The private explanation is never part of the output surface.

## Claim boundary

PCC is a mechanism, not a proof of universal privacy. Contracts can be wrong, extractors can miss evidence, and a derived value can itself be sensitive. Its purpose is to make compute-before-disclose explicit, testable, and fail-closed so later external evaluations can measure the privacy/utility tradeoff without relying on raw-context release.
