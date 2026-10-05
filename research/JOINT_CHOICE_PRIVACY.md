# Joint-choice privacy: recommendation results as reconstruction queries

## Research question

Hush's `choose` primitive lets an agent submit public candidates while private preferences and constraints remain local. Returning only a candidate id is substantially better than returning the private profile, but the chosen id is still an observation about that profile.

The core question is:

> Can an adversarial agent design the public candidate set itself so that the candidate Hush selects acts as a high-information probe of several private fields at once?

The answer in the synthetic construction below is **yes**. Output-cardinality accounting alone can badly underprice the realized information contained in a rare winning candidate.

Preference elicitation and information-seeking recommendation queries have substantial prior art. Hush does not claim that a choice can reveal preferences as a new discovery. The contribution being tested here is a system mechanism for measuring and blocking that realized joint leakage before a provider-neutral AI runtime releases the selected result.

## Falsifying the old accounting rule

The original benchmark defines 16 private binary attributes:

```text
secret.bit0 ... secret.bit15 ∈ {0,1}
```

There are `2^16 = 65,536` possible joint profiles. The adversarial caller submits only two public candidates. Public attributes and preference weights are chosen so that one candidate wins for exactly one private profile and the fallback wins for the other 65,535.

The ordinary `choose` interface has three possible explicit outputs: two candidate ids plus `null`, so cardinality-only accounting assigns:

```text
log2(3) = 1.584963 bits
```

But the rare winner leaves exactly one feasible private profile:

```text
log2(65,536 / 1) = 16 bits
```

This is a concrete counterexample to treating output alphabet size as a sufficient pointwise leakage measure for multi-field personalization.

## v0.8: realized joint-choice accounting

`JointChoiceReconstructionFirewall` performs pre-release posterior accounting for protected `choose` programs.

For referenced private fields, Hush:

1. requires declared finite domains when any protected field participates;
2. composes prior released `choose` observations through overlapping field sets;
3. computes how many private states remain consistent with those previous releases;
4. computes how many would remain if the currently selected result were released;
5. measures

```text
marginal joint gain = log2(states before / states after)
```

and cumulative knowledge relative to the original connected domain;
6. withholds the selected result before release when the configured knowledge limit would be exceeded.

A protected field cannot be mixed with an undeclared dummy field to force a downgrade to nominal accounting. Single protected-field choices use the same realized choice mechanism, and fresh tasks, agent identities or sinks do not reset prior joint observations.

### Overlapping observations

The firewall builds connected field components through released observations. For example:

```text
query 1: A + B
query 2: B + C
query 3: C + D
```

later analysis treats `A,B,C,D` as a connected reconstruction problem rather than four unrelated budgets.

### Persistence

Allowed informative choice observations are stored inside encrypted Context Kernel state. Restarting Hush does not reset the joint reconstruction history. If an involved private field changes or is removed, observations involving that field are invalidated rather than being applied to the new value.

## v0.9: scalable symbolic analysis

Exact Cartesian enumeration was safe but became an availability and utility problem once connected state spaces grew beyond roughly 100,000 states. v0.9 therefore adds an exact **symbolic interval branch-and-bound** path for the currently modeled finite-integer `choose` semantics.

Instead of enumerating every profile, the analyzer represents the current feasible state as boxes over integer intervals. For each box it derives candidate-feasibility and score bounds. If one candidate is provably the winner everywhere in that box, the entire region is counted at once. Only ambiguous boxes are split.

This preserves exact support counts for the supported semantics while making highly structured attacks tractable at much larger scales.

### 32-bit falsification test

The scalable benchmark defines 32 binary private fields:

```text
secret.bit0 ... secret.bit31 ∈ {0,1}
```

so the declared joint state contains:

```text
2^32 = 4,294,967,296 profiles
```

Two public candidates are constructed so that `rare` wins for exactly the all-ones profile and `fallback` wins everywhere else.

The integrated runtime verifies:

- rare branch before candidates: **4,294,967,296**;
- rare branch after candidates: **1**;
- realized rare-branch knowledge: **32 bits**;
- decision: **DENY before release**;
- analysis method: **symbolic branch-and-bound**;
- the selected result is absent from the denied response.

For the common branch:

- posterior states: **4,294,967,295**;
- decision: **ALLOW**;
- realized leakage is positive but below the public nine-decimal display resolution;
- the observation is still persisted internally using unrounded accounting precision.

The standalone symbolic tests also resolve a one-million-value threshold choice without enumerating all one million values.

### Work-budget behavior

Symbolic analysis is bounded by a node budget. If an unsupported or adversarial program cannot be certified within that budget, Hush does not guess. It falls back to exact enumeration only when the currently feasible state is small enough. Otherwise the result is withheld.

This prevents the privacy analyzer itself from becoming an unbounded compute path while preserving fail-closed behavior.

## Reproducible results

| Condition | Result |
|---|---:|
| Original private attributes | 16 binary fields |
| Original joint profiles | 65,536 |
| Public candidates | 2 |
| Nominal cardinality charge | 1.584963 bits |
| Original rare-branch realized knowledge | **16 bits** |
| Cardinality-only runtime | **ALLOW rare winner** |
| Joint guard | **DENY before release** |
| Common branch realized gain | **0.000022014 bits** |
| Scaled private attributes | **32 binary fields** |
| Scaled joint profiles | **4,294,967,296** |
| Scaled rare-branch realized knowledge | **32 bits** |
| Scaled rare winner | **DENY before release** |
| Scaled analysis | **symbolic branch-and-bound** |
| Scaled common winner | **ALLOW** |
| Sub-nanobit common leakage retained internally | **Yes** |

The automated suite additionally verifies mixed-domain downgrade attacks, rotating-task/agent/sink attacks, transitive overlapping-field composition, restart persistence, field-update invalidation, native MCP withholding and symbolic-analysis work-budget failure.

## Precision invariant

Privacy enforcement must not use values that have been rounded for presentation. v0.9 therefore keeps exact floating-point marginal/total knowledge internally while exposing rounded values in public telemetry.

This matters once the state space is large. For example, removing one state from `2^32` possibilities leaks only about `3.36e-10` bits. The public report may display `0.000000000`, but the internal observation is still recorded and composes with later releases.

## What this result supports

The defensible claim is:

> For declared finite integer domains and the currently modeled `choose` constraints/preferences, Hush can detect adversarial candidate-set queries whose realized winning candidate reveals substantially more joint private information than the output alphabet suggests, can compose prior overlapping releases, and can withhold high-information results before release. Structured joint spaces with billions of states can be analyzed symbolically without explicit Cartesian enumeration.

This does **not** establish general privacy of recommendation systems or arbitrary AI personalization.

## Current limitations

The v0.9 mechanism does not yet solve:

- categorical, set-valued, continuous or arbitrary structured private domains;
- correlated/non-uniform priors or semantic harm metrics beyond support-size reduction;
- every possible future `choose` operation or arbitrary user-defined computation;
- symbolic programs whose decision boundaries cannot be certified within the configured work budget;
- timing, failure, network, resource-use or other side channels;
- public auxiliary information outside the declared Hush state;
- compromised local hosts or traffic that bypasses Hush;
- information revealed through the consequences of real-world actions after authorization.

## Next falsification target

The next important research problem is **unified posterior accounting across different output mechanisms**.

Today predicate/bucket partition state and `choose` observation state are both persistent, but they are specialized mechanisms. An attacker may alternate between predicates, buckets, recommendations and eventually authorized actions so that information from one channel sharpens another.

The next falsification program should construct mixed-channel adaptive attacks and test whether a single connected posterior/knowledge model can compose them without destroying benign personalization utility.
