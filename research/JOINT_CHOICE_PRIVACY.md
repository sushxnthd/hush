# Joint-choice privacy: recommendation results as reconstruction queries

## Research question

Supakeep's `choose` primitive lets an agent submit public candidates while private preferences and constraints remain local. Returning only a candidate id is substantially better than returning the private profile, but the chosen id is still an observation about that profile.

The v0.8 research question is:

> Can an adversarial agent design the public candidate set itself so that the candidate Supakeep selects acts as a high-information probe of several private fields at once?

The answer in the synthetic construction below is **yes**. Output-cardinality accounting alone can badly underprice the realized information contained in a rare winning candidate.

Preference elicitation and information-seeking recommendation queries have substantial prior art. Supakeep does not claim that a choice can reveal preferences as a new discovery. The contribution being tested here is a system mechanism for measuring and blocking that realized joint leakage before a provider-neutral AI runtime releases the selected result.

## Falsifying the old accounting rule

The benchmark defines 16 private binary attributes:

```text
secret.bit0 ... secret.bit15 ∈ {0,1}
```

Under the declared finite-domain model there are:

```text
2^16 = 65,536
```

possible joint profiles.

The adversarial caller submits only two public candidates, `rare-profile` and `fallback`. Each candidate has 16 public bit-like attributes. The private decision program awards one point for every candidate attribute that matches its corresponding private bit. A public bias term penalizes `rare-profile` by 15.5 points.

Consequently:

- `rare-profile` wins only when all 16 private bits are `1`;
- `fallback` wins for every other one of the 65,535 profiles.

The ordinary `choose` interface has three possible explicit outputs: the two candidate ids plus `null`. Cardinality-only accounting therefore assigns:

```text
log2(3) = 1.584963 bits
```

But on the rare branch the selected id leaves exactly one feasible private profile:

```text
log2(65,536 / 1) = 16 bits
```

The benchmark therefore produces a concrete counterexample to treating output alphabet size as a sufficient pointwise leakage measure for multi-field personalization.

## v0.8 mechanism

`JointChoiceReconstructionFirewall` performs pre-release posterior accounting for analyzable multi-field `choose` programs.

For all private fields referenced by the choice program, Supakeep:

1. requires declared finite domains;
2. obtains each field's currently feasible values from the single-field partition firewall;
3. forms the feasible joint state space;
4. composes prior released `choose` observations whose private-field sets overlap the current one;
5. evaluates the new public candidate program over every feasible joint assignment;
6. keeps only assignments that would produce the result Supakeep is about to release;
7. measures the realized shrinkage:

```text
marginal joint gain = log2(joint states before / joint states after)
```

and cumulative knowledge relative to the original declared joint domain;
8. denies the result before release if it exceeds the configured joint knowledge budget or minimum-posterior requirement.

### Why overlapping observations matter

An attacker should not be able to evade joint accounting by changing field groups across calls, for example:

```text
query 1: A + B
query 2: B + C
query 3: C + D
```

The firewall therefore builds a connected component through overlapping historical observations. In the example above, later analysis can compose evidence across `A,B,C,D` rather than treating each exact field set as an independent budget.

### Persistence

Allowed informative choice observations are stored inside the encrypted Context Kernel state. Restarting Supakeep does not reset the joint reconstruction history. If a private field changes or is removed, observations involving that field are invalidated rather than being applied to a new private value.

### Fail-closed scalability boundary

The current exact prototype enumerates at most 100,000 feasible joint states. If the connected state space is larger than the analyzable limit, Supakeep withholds the result instead of silently reverting to weaker cardinality accounting.

This is safe but can reduce utility. Replacing enumeration with a scalable symbolic or conservative inference representation is the next major research problem.

## Reproducible result

The current synthetic benchmark reports:

| Condition | Result |
|---|---:|
| Private attributes | 16 binary fields |
| Possible joint profiles | 65,536 |
| Public candidates | 2 |
| Explicit output cardinality | 3 |
| Nominal cardinality charge | 1.584963 bits |
| Realized rare-branch knowledge | 16 bits |
| Cardinality-only runtime | **ALLOW rare winner** |
| v0.8 joint guard | **DENY before release** |
| Result included in denied response | **No** |
| Common branch posterior | 65,535 profiles |
| Common branch realized gain | **0.000022014 bits** |
| Common branch decision | **ALLOW** |

This is useful in both directions. The guard blocks a tiny-output result when it is unusually informative while allowing the overwhelmingly common result at a nearly zero realized charge.

The automated suite also verifies that:

- the same already-released deterministic choice in a fresh task adds zero new joint knowledge;
- joint observations survive encrypted Context Kernel restart;
- persisted ciphertext does not contain the private path or selected candidate string used by the persistence test;
- the public joint-choice footprint omits the selected result so privacy telemetry does not itself become a disclosure channel.

## What this result supports

The defensible claim is narrow:

> For declared finite integer domains whose currently feasible Cartesian product fits within the exact analysis limit, Supakeep can detect a class of adversarial multi-field candidate-set queries where the realized winning candidate reveals far more joint private information than the output alphabet suggests, and can withhold that result before release.

It does **not** establish general privacy of recommendation systems or arbitrary AI personalization.

## Current limitations

The exact v0.8 mechanism does not yet solve:

- joint state spaces above the enumeration limit;
- continuous or high-dimensional private variables;
- categorical/structured domains that are not represented by the current finite-integer domain model;
- correlated priors or non-uniform probability models;
- leakage through timing, failures, resource use or other side channels;
- inference from public auxiliary information outside the declared Supakeep state;
- compromised local hosts or traffic that bypasses Supakeep;
- privacy consequences of real-world actions after an authorized choice is executed.

The feasible-set metric also measures support-size reduction, not every possible semantic notion of privacy harm.

## Next falsification target

The next required research step is **scalable joint inference without explicit Cartesian enumeration**.

A useful successor should preserve v0.8's pre-release guarantee while handling much larger and richer private state. Candidate approaches to test include symbolic decision diagrams, SAT/SMT-style constraint representations, abstract interpretation, or conservative upper bounds on posterior shrinkage.

The falsification criterion is straightforward: construct adversarial overlapping choice programs over a state space too large for v0.8 enumeration, then determine whether the scalable guard can prevent exact or high-confidence reconstruction without collapsing benign personalization utility.
