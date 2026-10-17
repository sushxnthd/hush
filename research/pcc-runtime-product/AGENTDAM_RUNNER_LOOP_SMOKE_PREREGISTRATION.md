# Pinned AgentDAM runner-loop overlay — no-outcome smoke preregistration

## Purpose

Test whether Hush's boundary overlay can attach to the released AgentDAM
execution loop itself, rather than only calling synthetic adapter functions.
No benchmark configuration, task, outcome, remote model, browser site or paid
service may be used.

## Pinned code

- upstream revision: `5d4068a404b624ed24ebbe5fb49ba5f644557912`;
- runner blob: `099b25a89af58401692aa6d46bfd3e61f63c5cb9`;
- PromptAgent blob: `3341c4f368080e9b5991234362162151b63509c7`;
- provider blob: `ca4cc6ccce01517b6cb1c60483b7848118bfc8e8`.

The smoke harness must execute the pinned `run_agentdam.test()` loop and the
pinned `PromptAgent.next_action()` method loaded from those files. Heavy
dependencies are replaced by deterministic local module doubles before import;
after import, the overlay may patch only the runner's constructor, environment,
action-description and evaluator integration symbols plus PromptAgent's
module-global `call_llm` symbol.

## Frozen synthetic conditions

Run one raw and one PCC arm. Each arm receives one local JSON task with no
storage state or image. The raw intent contains `RUNNER_PRIVATE_00`; the PCC
intent omits it. The prompt constructor deliberately rejects the first model
response and accepts the second, exercising PromptAgent's real parse-retry
loop. The synthetic environment emits one Playwright-style provider request
and terminates after one action. The evaluator returns task score 1.

## Frozen predictions and gates

1. pinned revision, blob IDs and integration anchors verify;
2. both real runner-loop invocations complete without a benchmark data read;
3. exactly two valid fixed-denominator traces are produced;
4. each trace contains two model requests and one retry;
5. each trace contains one tool request, browser action, provider request and
   receipt, with zero errors;
6. raw discloses the protected canary and PCC does not;
7. both arms retain task success;
8. all eight machine gates pass on first execution; and
9. an independent invocation produces byte-identical manifest, traces and
   evaluation output.

Any missing boundary, import mismatch, runner exception, duplicate trace or
digest failure is a FAIL. The protocol must not silently reduce its denominator.

## Claim boundary

A PASS would validate source-pinned, benchmark-free attachment to the released
runner and PromptAgent control flow. It would not validate a real browser,
provider, model, semantic judge, AgentDAM task result, external privacy, or PCC
advantage. Real timing capture and faithful OCELOT/MNC controls remain separate
requirements.
