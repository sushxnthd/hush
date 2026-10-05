# Hush Context Kernel

## Thesis

**AI should query you, not copy you.**

The default architecture for personal AI gives a model or agent a copy of the context it needs: messages, documents, memory, credentials, calendar events, financial facts, health facts, or other private state. Access controls can limit which copy is released, but once the value enters model context it is no longer under the user's local control.

Hush's experimental Context Kernel changes the abstraction from **data access** to **context computation**.

An agent receives an opaque, revocable, task-bound context lease. It can request bounded computations such as:

- does this fact exist?
- is a private numeric value above/below a threshold?
- does a value satisfy a range?
- return a masked representation
- escalate to exact disclosure when explicitly necessary

The raw value remains behind the Hush boundary unless exact disclosure is separately authorized.

## Why predicate access is not enough

A sequence of individually low-information answers can compose into a high-information disclosure.

For example, a yes/no oracle over salary can be queried adaptively:

1. salary > 500000?
2. salary > 750000?
3. salary > 625000?
4. ...

A conventional per-field policy may treat each answer as the same already-approved boolean disclosure. An attacker can then binary-search the exact value.

The Context Kernel therefore treats the **query trajectory** as the privacy object, not an isolated API call.

## Experimental primitives

### Privacy trajectories

Hush mints an opaque trajectory identifier for one user-authorized task. The identifier, not agent-supplied prose, is the cumulative privacy-accounting scope.

Every delegated agent or sub-agent lease inherits that trajectory. Renaming the agent or claiming a new natural-language purpose does not create a fresh privacy budget.

### Context leases

A lease is bound to:

- privacy trajectory
- agent
- destination/sink
- private context atom
- expiry

Leases are opaque and revocable. Revoking the trajectory invalidates every lease under the task.

### Compositional query accounting

Repeating the exact same predicate has zero marginal cost. A distinct predicate over the same private atom is treated as additional information.

This is intentionally stricter than field-level accounting because adaptive predicate changes can reveal new information even when every response has the same type (`boolean`).

### Progressive disclosure

The intended runtime should prefer the minimum useful disclosure:

`presence -> boolean -> derived/coarse -> masked -> exact`

Exact disclosure is an escalation, not the default retrieval primitive.

## Current falsification test

The current synthetic reconstruction test places a hidden value in the integer domain `0..999999` and gives an adversarial agent a greater-than predicate.

- unrestricted predicate access can binary-search the exact value
- naive per-field boolean accounting also permits reconstruction because later predicates appear free
- the current Hush compositional prototype interrupts the adaptive sequence before exact reconstruction

This test demonstrates one security invariant only. It is **not** evidence of general privacy safety.

## Novelty hypothesis

The claim worth testing is not that opaque handles, zero-knowledge predicates, information-flow control, inference attacks, or privacy budgets are individually new. They are not.

The research hypothesis is narrower:

> A provider-neutral personal context runtime that combines task-bound context leases, cross-agent privacy trajectories, minimum-disclosure computation, and compositional disclosure accounting can materially reduce recoverable private information while preserving agent task utility.

That hypothesis must survive comparison against strong existing approaches and real agent traces before Hush should make any breakthrough claim.

## Falsification program

A result should count as progress only if it survives adversarial evaluation. Priority attacks:

1. adaptive threshold/binary-search reconstruction
2. multi-agent collusion inside one task
3. multiple external sinks colluding after receiving partial answers
4. purpose laundering / task renaming
5. sink aliasing and destination canonicalization attacks
6. logically equivalent predicates expressed with different syntax
7. high-cardinality membership queries
8. malicious transformations that are nominally coarse but effectively identifying
9. prompt injection attempting to alter privacy metadata
10. real MCP/A2A traces with measured task success, leakage, approval rate and latency

## Product consequence

If the hypothesis holds, Hush is not primarily a vault or permission dashboard.

It becomes the **context syscall layer between AI and a person's life**: models request the smallest computation they need, while the user's private state and cumulative information exposure remain under a neutral local boundary.
