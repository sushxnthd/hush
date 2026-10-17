# PCC–semantic disclosure containment boundary — result

**Date:** 16 October 2026  
**Frozen protocol:** `b37403b728a4ed56e765acfcf63334d650ce4dbe`  
**Verified workflow head:** `3332559147db6f33ad048ec972f9a0ddeadf74e7`  
**Workflow:** [PCC semantic containment run 38879312468](https://github.com/sushxnthd/hush/actions/runs/38879312468) — PASS  
**Artifact:** `pcc-semantic-containment`, ID `12036169590`, digest `sha256:735d1ea06ec95861664bb3ba6189e34ec885fb644e2cc1e017e59d4276f843e3`

## Decision

The proposed **inherent privacy–utility frontier advantage** of
compute-before-disclose over an output-complete semantic-declassification
baseline is **falsified by class containment**.

This is not a finding that PCC lacks value. It identifies what its value can and
cannot be: HUSH must win on verification, trusted local execution, action
binding, composition identity, provider-boundary enforcement, robustness or
operational cost—not on an observable information channel that a matched
semantic control is also allowed to emit.

## Exact theorem

Let (X) be a finite private state, (f:X\to Y) a deterministic public task,
and exact utility require output (f(x)). PCC locally computes and releases

[
C_{\mathrm{PCC}}(x)=f(x).
]

Let a semantic-declassification candidate class contain the task-output
operator (g_f=f). Then the semantic mechanism can select

[
C_{\mathrm{SEM}}(x)=g_f(x)=f(x)=C_{\mathrm{PCC}}(x).
]

Consequently, for every prior on (X):

1. the released transcripts are pointwise identical;
2. exact task utility is identical;
3. the joint laws ((X,C_{\mathrm{PCC}}(X))) and
   ((X,C_{\mathrm{SEM}}(X))) are identical;
4. every privacy or leakage functional determined by that joint law is
   identical, including Shannon mutual information, posterior Bayes
   vulnerability, realized min-entropy charge and pointwise maximal leakage.

For adaptive deterministic trajectories, apply the same construction to the
history-conditioned task channel at each round; equality follows inductively.

Thus PCC is contained in an output-complete semantic candidate class at the
observable-channel level. Strict dominance can only arise from an explicit
restriction on the comparator's operator class or from non-channel system
properties.

## Exact evidence

The primary verifier exhaustively enumerated all deterministic functions for:

- private-state sizes (n=2,ldots,7);
- output alphabets (m=2,ldots,min(4,n));
- uniform, skewed and zero-support exact rational priors.

| Gate | Count | Failures |
|---|---:|---:|
| Deterministic tasks | 25,279 | 0 |
| Nonconstant exact tasks | 25,236 | 0 |
| Prior/task cases | 597,151 | 0 |
| State transcript comparisons | 168,247 | 0 |
| Exact privacy-metric comparisons | 4,180,057 | 0 |
| Raw-channel dominance checks | 597,151 | 0 |
| Static-denial utility checks | 25,236 | 0 |
| Independent partition checks | 75,794 | 0 |

Both primary and independent executions reran byte-identically.

Primary:

- canonical payload: `d8ec370574c8c9bf31a8ee341fd8631eb2715d79c8a0bb499a11e0467b9c4051`
- file SHA-256: `3d051ad7d9ad9ee0661b428f5f36f79d816531e4c37709edb5d7d09e9e1a362b`

Independent audit:

- canonical payload: `3df4f61114c2aa6262b0632bf275618f8ad4420ff6c97fafa558d3d8e19ac762`
- file SHA-256: `aa223da1e1941c26836b7f4ca303ff16da6440a5cca769199b6eba788dc9a841`

The exhaustive computation is validation of the implementation and boundary
cases. The theorem itself follows immediately from channel equality.

## Strongest controls

- **Raw context:** releases (x), retains exact utility, and Blackwell-dominates
  the task-output channel.
- **Static denial:** releases a constant and therefore fails every nonconstant
  exact task.
- **Restricted semantic transformations:** can be worse than PCC when the task
  output is absent from the candidate library.
- **Output-complete semantic control:** emits (f(x)) and exactly matches PCC.
- **PCC:** computes (f(x)) locally and emits the same task output.

Only the restricted semantic arm can exhibit an attainable-frontier gap, and
that gap is attributable to candidate-class restriction rather than compute
location alone.

## Prior-art interpretation

Historical novelty is not asserted.

- OCELOT already authorizes the least-disclosing useful candidate release under
  a cumulative posterior-risk budget and deterministic verification:
  https://arxiv.org/abs/2606.12341
- Zhou, Mireshghallah and Li formalize data minimization as finding the least
  privacy-revealing transformation that preserves task utility:
  https://arxiv.org/abs/2510.03662
- The containment argument is a direct channel-equality/class-inclusion
  observation consistent with standard statistical-experiment and data
  processing theory.

The result is valuable as a **claim-identifiability boundary and benchmark
control**, not as a new general information-theory theorem.

## SCIENCE ledger

### True

- Channel-matched PCC and output-complete semantic declassification have
  identical attainable privacy–utility points for deterministic exact-output
  tasks.
- No channel-determined leakage metric can distinguish them.
- A comparison against only raw context, field retrieval, redaction or
  abstraction cannot identify an inherent compute-location advantage.

### Falsified

- **Falsified:** compute-before-disclose alone guarantees a strictly better
  information-theoretic privacy–utility frontier than the strongest semantic
  declassification class.
- **Falsified:** a PCC win against a restricted transformation library is
  sufficient evidence of mechanism-level superiority.

### Still open

- Whether PCC's compiler/verifier rejects unsafe candidates more reliably than
  an untrusted semantic proposer plus verifier.
- Whether lifecycle-stable exact composition yields fewer catastrophic privacy
  failures under adaptive attacks and prior shift.
- Whether HUSH's action and approval binding provides a capability unavailable
  to OCELOT-style release mediation.
- Whether these assurance gains survive external model/tool benchmarks.

## CONSEQUENCE ledger

The HUSH superiority suite now includes an `outputOracle` arm with the same
task output and zero exact-private-input exposure as PCC. A new hard gate,
`outputChannelContainmentConfirmed`, requires equivalence.

This changes the interpretation of HUSH evidence:

- raw-context and coarse-minimization wins remain useful engineering evidence;
- they no longer support an inherent frontier claim;
- future strict claims must measure verifier soundness, adversarial failure
  rate, composition durability, provider-boundary coverage, approval/action
  binding, latency or deployment reliability;
- any OCELOT comparison must state whether its operator class includes the
  task-output channel.

Relevant implementation commits:

- `4e0fba1c264bc77ed3fc2ea0885264952735d165` — output-channel oracle control;
- `91e0f1dbaa59d53f818315cf54d8b4987be3884e` — protocol claim amendment.

## Smallest supported claim

> For deterministic finite tasks, PCC has no strict observable-channel
> privacy–utility advantage over a semantic-declassification candidate class
> that contains the PCC task-output channel. HUSH's remaining possible
> advantage is assurance and enforcement, not channel capacity.

## Claim boundary

This does not prove that the published OCELOT implementation already supports
arbitrary task-output operators, that PCC and OCELOT have equal verifier
soundness, or that PCC has no product advantage. It also does not cover
stochastic tasks, unverifiable open-ended generation, side channels, latency,
malicious local code or incorrect task specifications.

## Kernel decision

The prior active kernel is narrowed rather than abandoned:

> Can HUSH provide a prospectively validated **assurance advantage**—lower
> catastrophic leakage under matched observable channels—through compiler
> verification, persistent exact composition and approval-bound action
> execution?

A future run must compare matched output channels while adversarially varying
candidate provenance, verifier errors, adaptive composition, lifecycle identity
and prior shift. Utility-frontier comparisons without the output-channel oracle
control are no longer discriminating.
