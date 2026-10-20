# Frozen protocol: scheduler-fiber composition

Frozen before generating the exhaustive result.

## Active kernel

- **Question.** When do deterministic runtime components that each satisfy
  staged observable-fiber closure remain safe after a concurrent scheduler
  interleaves their events?
- **Frontier.** Observational determinism and concurrent noninterference already
  identify secret-influenced scheduling as a covert channel. Hush presently
  checks emitted traces, but has no component-level certificate that says when
  safe local traces compose.
- **Objective.** Prove a sharp finite composition criterion, implement a
  fail-closed checker returning the first violating world pair and prefix, and
  reproduce an exhaustive frozen count with an independent checker.
- **Strongest alternative.** Per-component prefix safety may be sufficient;
  schedule order may add no information once every component's own events are
  authorized.
- **Cheapest decisive falsification.** Exhaust all two-component, four-world
  systems below. If any schedule that is constant on current authorization
  fibers leaks, or any fiber-varying schedule remains safe with observable
  component tags, reject the proposed iff criterion.
- **Unseen prediction.** Two components whose local one-event traces are each
  constant on authorization fibers will still leak a hidden bit whenever their
  execution order depends on that bit. A final auditor that canonicalizes the
  event multiset will accept every such execution and miss the leak.
- **Publishable threshold.** Exact proof, exhaustive enumeration, independent
  implementation, adversarial counterexample, reproducible artifact, and a
  working certificate checker. Broad novelty is not claimed unless a priority
  audit supports it.
- **Project-consequence threshold.** Require every concurrent Hush emission
  boundary to prove that its scheduler choice factors through the current
  authorized transcript and public history, or fail closed before emission.
- **Kill condition.** Any counterexample to sufficiency, necessity in the
  observable-tag model, or independent-count reproduction kills the kernel.

## Frozen model and prediction

Worlds are `(public_bit, hidden_bit)` in `{0,1}^2`. Current authorization
reveals only `public_bit`, producing two fibers of size two. Components `A` and
`B` each emit one tagged event; their payload functions range over every binary
function of `public_bit`, so both components are prefix-safe by construction.
The scheduler chooses either `AB` or `BA` independently in each of the four
worlds.

This gives 16 component-payload pairs times 16 scheduler functions = 256
systems. Frozen exact prediction:

- all 256 pass a final canonical-multiset audit;
- 64 have scheduler choices constant on both authorization fibers and pass
  ordered-prefix closure;
- 192 have a fiber-varying scheduler, fail ordered-prefix closure, and expose a
  witness at the first event;
- criterion disagreements: zero.

Component tags are explicitly observable. Without observable tags, equal next
events can mask a schedule difference; therefore scheduler factorization is
universally necessary over distinguishable components, not necessary for every
fixed untagged trace.

## The proposed law

At every reachable public history and authorization fiber, assume each enabled
component's next tagged observation is constant on that fiber. The composite
prefix is safe if the scheduler's selected component is also constant on the
fiber. Conversely, if the scheduler varies on a fiber, two distinguishable
constant-output components give an immediate one-event leak. Thus public
scheduler factorization is sufficient for a fixed safe component family and
necessary for universal composition.

## Priority anchors

- Zdancewic and Myers, *Observational Determinism for Concurrent Program
  Security* (CSFW 2003).
- Sabelfeld and Myers, *Language-Based Information-Flow Security*, IEEE JSAC
  21(1), 2003.
- Clarkson and Schneider, *Hyperproperties*, Journal of Computer Security 18,
  2010.

These establish the classical context. The intended contribution is the sharp
authorization-fiber scheduler contract and executable Hush integration, not a
claim to invent concurrent noninterference.
