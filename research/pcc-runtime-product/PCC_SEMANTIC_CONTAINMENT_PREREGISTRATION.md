# Frozen protocol: PCC–semantic disclosure containment boundary

**Frozen:** 16 October 2026  
**Classification:** exact mechanism-identifiability / benchmark-control theorem  
**Active HUSH kernel:** compute-before-disclose advantage over OCELOT-style semantic declassification  
**Branch:** `breakthrough-engine/pcc-cleanroom-replication`

## Precise question

Can compute-before-disclose have a strict information-theoretic privacy–utility
advantage over a semantic-declassification mechanism whose allowed candidate
channels include the exact task-output channel?

Let a finite private state be (X), a public task be a deterministic function
(f:X\to Y), and exact task utility require the released value (f(x)).
PCC evaluates (f) locally and releases the channel

[
C_{\mathrm{PCC}}(x)=f(x).
]

Define the **output-complete semantic control** as a semantic-declassification
candidate class that contains the task-output operator (g_f(x)=f(x)), charges
leakage from the realized channel, and may select (g_f).

## Frontier

OCELOT already authorizes the least-disclosing useful candidate variant under a
posterior-risk budget. Operational data-minimization work searches a
transformation space for the least revealing disclosure preserving utility.
HUSH's unresolved claim has been that local compute-before-disclose occupies a
strictly better privacy–utility point.

The strongest matched control must therefore include the output channel itself.
Otherwise an apparent PCC advantage can be caused entirely by an artificially
weaker candidate class.

This protocol does not claim that the published OCELOT implementation already
contains arbitrary task-output operators. It asks what can be attributed to
**compute location alone** once candidate-channel capacity is matched.

## Exact hypothesis

### Containment theorem

For every finite deterministic task (f), prior (p), and leakage or risk
functional depending only on the joint law of private state and released
transcript:

1. the output-complete semantic control can choose (g_f=f);
2. its released transcript is pointwise identical to PCC's transcript;
3. exact task utility is identical;
4. Shannon mutual information, posterior Bayes vulnerability, realized
   min-entropy charge, pointwise maximal leakage, and every other
   channel-determined privacy functional are identical.

Therefore compute-before-disclose has no strict attainable-frontier advantage
over an output-complete semantic-declassification class. PCC is a member of that
class at the channel level.

The statement extends inductively to adaptive deterministic trajectories when
the semantic control is allowed to emit the same history-conditioned output
channel at each step.

## Strongest alternative explanation

PCC may still be superior because its compiler and trusted runtime can verify
the task program, bind actions and approvals, maintain lifecycle-stable
composition, or resist a malicious semantic proposer. Those are operational
trust and assurance differences, not consequences of the observable channel
being computed locally.

A published comparator may also restrict candidate operators to redaction or
abstraction. PCC can outperform that restricted implementation, but such a
result does not prove an inherent mechanism-level privacy frontier separation.

## Cheapest decisive falsification

Enumerate finite tasks for:

- secret cardinality (n=2,ldots,7);
- output alphabet (m=2,ldots,min(4,n));
- every deterministic function (f:[n]\to[m]);
- a fixed exact rational prior family including uniform, skewed, and
  zero-support priors.

For PCC and its matched output-complete semantic channel, require exact equality
of:

- output on every state;
- exact-task utility;
- output probabilities;
- posterior distributions;
- Bayes vulnerability;
- Shannon mutual information;
- realized min-entropy charges;
- pointwise maximal leakage values.

A separately written audit must verify the theorem through partition
statistics, without importing the primary verifier.

## Controls

1. **Raw context:** release (x); exact utility, generally maximal disclosure.
2. **Static denial:** release a constant; zero disclosure, fails nonconstant
   exact tasks.
3. **Restricted semantic class:** optional redaction/abstraction operators; may
   be worse than PCC because (f) is absent.
4. **Output-complete semantic class:** contains (f); must exactly match PCC.
5. **PCC:** locally compute and release (f(x)).

## Gates

All must pass:

1. zero PCC/output-complete transcript disagreements;
2. zero utility disagreements;
3. zero posterior or privacy-metric disagreements;
4. raw release is never less informative than task output under the checked
   metrics;
5. static denial fails every nonconstant exact task;
6. independent audit exact agreement;
7. deterministic byte-identical rerun.

## Publishable success condition

An exact proof and independent exhaustive verification of the candidate-class
containment boundary, with a benchmark design consequence: no HUSH evaluation
may attribute a privacy–utility improvement to compute-before-disclose unless
it includes a task-output-channel oracle control or explicitly states the
comparator's operator restriction.

## Project-relevance threshold

HUSH's superiority suite must gain an **output-channel oracle control**.
Future claims must separate:

- attainable channel frontier;
- verification/assurance;
- lifecycle composition;
- provider-boundary enforcement;
- approval and action semantics;
- latency and operational reliability.

## Kill condition

Kill the theorem if a finite deterministic task is found where an allowed
semantic operator (g_f=f) produces a different transcript, utility, posterior,
or channel-determined leakage from PCC. Kill the project consequence if the
HUSH claim is explicitly only against a fixed restricted operator library and
never attributes the difference to compute location.

## Claim boundary

This does not show that OCELOT's released implementation equals PCC, that PCC
has no product advantage, or that arbitrary LLM tasks admit a certified local
program. It shows that compute location alone cannot create a strict
information-theoretic frontier advantage once the comparator's observable
candidate channel class contains PCC's output.
