#!/usr/bin/env python3
"""Exercise the AgentDAM trace overlay with synthetic module/page doubles only."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from types import SimpleNamespace

from agentdam_trace_adapter import BoundaryTrace, verify_checkout


ARMS = ["raw", "pcc"]
CASES = [
    {"id": f"adapter-{index}", "protected": [f"ADAPTER_PRIVATE_{index:02d}"]}
    for index in range(6)
]


class FakeRequest:
    method = "POST"
    url = "https://provider.example.invalid/submit"
    post_data = '{"choice":"public-A"}'


class FakePage:
    def __init__(self):
        self.listener = None

    def on(self, event, listener):
        if event != "request":
            raise ValueError("unexpected event")
        self.listener = listener

    def emit_request(self):
        self.listener(FakeRequest())


def run_case(case, arm):
    attempts = {"count": 0}

    def fake_call_llm(config, prompt):
        attempts["count"] += 1
        if case["id"] == "adapter-5" and attempts["count"] == 1:
            raise TimeoutError("synthetic timeout")
        return "click [1]"

    module = SimpleNamespace(call_llm=fake_call_llm)
    trace = BoundaryTrace(case["id"], arm)
    page = FakePage()
    trace.attach_page(page)
    prompt = {"task": "submit public choice", "approved": True}
    if arm == "raw":
        prompt["privateContext"] = case["protected"][0]

    with trace.patch_agent_module(module):
        try:
            module.call_llm({"model": "synthetic-local"}, prompt)
        except TimeoutError:
            # Mirror PromptAgent/provider retry: the wrapper records both the
            # failed attempt and the subsequent request.
            module.call_llm({"model": "synthetic-local"}, prompt)

    action = {"action_type": "CLICK", "element_id": 1}
    trace.record_action("click [1]", action)
    page.emit_request()
    trace.receipt({"taskScore": 1, "privacyJudgeUsed": False})
    return trace.finalize(status="completed", task_success=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkout", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--traces", type=Path, required=True)
    args = parser.parse_args()

    upstream = verify_checkout(args.checkout)
    manifest = {
        "protocol": "hush-boundary-eval-v1",
        "purpose": "AgentDAM overlay synthetic integration; no benchmark outcomes",
        "upstream": {"repository": "facebookresearch/ai-agent-privacy", **upstream},
        "arms": ARMS,
        "cases": CASES,
    }
    traces = [run_case(case, arm) for case in CASES for arm in ARMS]
    args.manifest.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    args.traces.write_text(json.dumps(traces, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"manifest": str(args.manifest), "traces": len(traces), "upstream": upstream}, sort_keys=True))


if __name__ == "__main__":
    main()
