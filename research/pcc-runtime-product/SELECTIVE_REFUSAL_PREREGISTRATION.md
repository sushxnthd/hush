# PCC selective-refusal oracle — frozen protocol

## Hypothesis

Delaying a result-dependent firewall denial until consumption does not eliminate
the leak when consent is already granted. The requester can distinguish a
released result from a generic privacy denial, so selective refusal reveals the
very predicate branch the firewall intended to withhold.

## Mechanism

For query `secret == 500` over domain `0..1023`, the true branch has a
one-candidate posterior and exceeds the eight-bit limit; the false branch keeps
1,023 candidates and is allowed. With matching `always` consent, no interactive
approval separates preparation from consumption.

## Frozen differential

- World A: `secret=500`.
- World B: `secret=501`.
- Identical trusted equality contract, agent, sink, consent rule, and domain.
- Observe only the normal prepare→consume interface.
- No private store or internal transaction inspection.

## Preregistered prediction

The current implementation will prepare both worlds as `allow`, then return a
generic privacy `deny` in World A and an allowed `false` constraint in World B.
An observer will therefore infer whether the equality is true with no new human
interaction.

The gate is **FAIL** if the two public transcripts differ and identify the
equality result. Otherwise it is **PASS**.

## Prospective correction prediction

A result-independent worst-case branch check should reject the equality query
before private-result release in both worlds. Balanced threshold comparisons
whose every feasible branch stays within budget should remain available.

## Boundary

This tests a trusted, registered bounded-integer contract under standing local
consent. It is not a remote arbitrary-query exploit, and it does not address
semantic inference, malicious trusted contracts, timing, or general programs.
