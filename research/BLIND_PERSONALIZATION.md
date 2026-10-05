# Blind Personalization: the Hush breakthrough hypothesis

## One-line product

**Private Mode for every AI: connect your life once, let any AI personalize for you, and keep the profile that powers the personalization under your control.**

## The inversion

Most personalized AI systems move user context toward the model:

```text
user data -> retrieval / memory -> model context -> personalized answer
```

Hush's proposed abstraction moves the decision toward the user instead:

```text
public candidates + bounded decision program
                    |
                    v
        Hush on private user state
                    |
                    v
          bounded personalized result
```

The remote agent should ask Hush to **compute with** private context rather than asking Hush to **copy** private context into its prompt.

This is the product idea behind **blind personalization**.

## Example: travel

The user asks an agent:

> Book me a good Tokyo trip next month under my normal travel budget.

A conventional deeply personalized agent may need a large profile: exact budget, calendar, home airport, passport data, airline loyalty, seat habits, past trips, payment credentials, and perhaps health/accessibility constraints.

Under blind personalization:

1. the cloud agent searches public flight/hotel inventory;
2. it sends candidate options to Hush;
3. Hush filters/ranks locally using the user's private state;
4. the agent receives only the chosen/viable candidate identifiers or another deliberately bounded result;
5. when an exact passport/address/card value is finally required by an authorized booking action, Hush brokers it directly to the destination rather than placing it in model context;
6. the user receives one trajectory receipt describing what was computed, disclosed, and executed.

The agent can be highly personalized without owning the personal profile that made the personalization possible.

## Private Decision Programs

The current prototype introduces a small declarative language for computations over private state.

Supported experimental outputs include:

- boolean predicates;
- coarse numeric buckets;
- `choose` over public candidate sets using private constraints/preferences.

There is deliberately no `returnRawSecret()` operation in this language.

The runtime is designed so the output domain is known before execution.

## Explicit information-capacity budgets

Suppose a private secret is `S` and a controlled program returns `Y` from a finite set `Ω`.

Regardless of the model or the distribution of `S`:

```text
I(S;Y) <= H(Y) <= log2(|Ω|)
```

For an adaptive transcript `Y1..Yn`, the chain rule gives the conservative explicit-channel bound:

```text
I(S;Y1..Yn) <= sum_i log2(|Ω_i|)
```

Hush can therefore attach a hard information-capacity budget to a task trajectory.

Examples:

- yes/no predicate -> at most 1 explicit bit;
- one of 4 buckets -> at most 2 explicit bits;
- choose one of 15 candidates or return no match -> 16 outputs -> at most 4 explicit bits.

Repeating the exact same deterministic decision against the same private-state revision is free; a changed program or changed private profile is charged again.

This is intentionally conservative. It bounds the controlled explicit result channel, **not all possible leakage**. Timing, crashes, side effects, covert channels, destination behavior, and anything bypassing Hush remain separate problems.

## Why this is more than a privacy toggle

The consumer value is not primarily "better redaction." It is **portable deep personalization**.

The same user-owned private context could improve:

- travel decisions;
- shopping and product selection;
- scheduling;
- job matching;
- financial eligibility checks;
- communication choices;
- accessibility-aware decisions;
- browser and agent actions;

without forcing every model provider or application to build and retain its own complete profile of the user.

For developers, the new API shape becomes:

> **Send candidates and a decision request, not the user's profile.**

For users, the promise becomes:

> **Switch AI providers without rebuilding who you are.**

## Why we are not calling this a scientific breakthrough yet

Important adjacent ideas already exist:

- personal/user-owned context stores;
- local and federated privacy-preserving recommendation;
- data minimization and task-conditioned context projection;
- information-flow control;
- cumulative/inference-leakage budgets;
- zero-knowledge predicates;
- opaque handles/tokenization and local secret rebinding;
- on-device ranking.

The mathematical entropy bound above is also standard information theory, not a new theorem.

The narrower Hush hypothesis is that these ideas become substantially more useful when turned into a **provider-neutral runtime contract for personal AI**:

1. one user-controlled private state;
2. one cross-agent task trajectory;
3. agents submit bounded decision programs instead of demanding raw profiles;
4. explicit output capacity is known and budgeted before execution;
5. exact values can remain sealed until an authorized destination actually needs them;
6. the same interface works across models, agents, MCP tools, browsers, and applications.

That combination needs strong evidence before we claim novelty or superiority.

## The benchmark that would make this hard to ignore

Build real tasks in travel, shopping, scheduling and browser automation and compare:

### Baseline A — raw personalization
The agent receives all personal context it requests.

### Baseline B — redaction/minimization
A privacy layer removes or coarsens sensitive context before the model sees it.

### Baseline C — governed retrieval
The agent retrieves approved pieces of personal context on demand.

### Hush — blind personalization
The agent sends candidate decisions to private context and receives bounded outputs; exact private values are brokered only to authorized execution targets.

Measure:

- task success;
- exact sensitive values visible to the model;
- recoverable private information under adaptive attacks;
- explicit output-channel capacity;
- approval interruptions;
- latency;
- portability across model providers.

A compelling target is to preserve at least 90–95% of raw-context task utility while making exact sensitive values unnecessary in model context for the supported workflows and keeping approval friction low. Those are targets, not current results.

## Current prototype evidence

The current synthetic flight demo supplies 15 public candidates and uses three private travel fields locally. Hush returns one candidate ID from 15 possibilities or `null`:

- raw private values returned: 0;
- explicit output cardinality: 16;
- worst-case explicit-channel capacity: 4 bits;
- task trajectory budget: 4 bits;
- a second distinct 4-bit decision in that same trajectory: denied.

Separately, the adaptive predicate benchmark shows why composition matters: naive field-level boolean accounting allows exact recovery of a hidden value in 20 threshold queries, while the current Hush trajectory prototype stops the sequence on query 6 with 31,250 candidates still possible.

Both are synthetic mechanism tests, not real-world privacy claims.

## The killer demo to build next

A user should be able to say:

> **Book me the best Tokyo trip next month under my normal budget.**

and watch a real cloud agent finish the task while a Hush panel shows:

```text
Private context used locally
  calendar availability       yes
  travel budget               yes
  airline preference          yes
  passport validity           yes
  payment credential          brokered at execution

Raw values shown to model      0
Bounded decisions              4
Exact disclosures              0
Authorized destination writes  1 booking
```

If that works across multiple major AI clients with comparable task success to giving the model the full profile, Hush stops looking like another security product. It starts looking like infrastructure for a different way of personalizing AI.
