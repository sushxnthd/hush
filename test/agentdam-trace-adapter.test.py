import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "research" / "pcc-runtime-product"))

from agentdam_trace_adapter import BoundaryTrace


class AdapterTests(unittest.TestCase):
    def test_model_request_and_retry_are_retained(self):
        attempts = {"count": 0}

        def call(config, prompt):
            attempts["count"] += 1
            if attempts["count"] == 1:
                raise TimeoutError("first attempt")
            return "ok"

        module = SimpleNamespace(call_llm=call)
        trace = BoundaryTrace("c0", "pcc")
        with trace.patch_agent_module(module):
            with self.assertRaises(TimeoutError):
                module.call_llm({"model": "local"}, {"approved": True})
            self.assertEqual(module.call_llm({"model": "local"}, {"approved": True}), "ok")
        self.assertEqual(len(trace.boundaries["model_request"]), 2)
        self.assertEqual(len(trace.boundaries["retry"]), 1)
        self.assertEqual(len(trace.boundaries["error"]), 1)

    def test_finalization_is_one_shot_and_status_bound(self):
        trace = BoundaryTrace("c0", "pcc")
        with self.assertRaises(ValueError):
            trace.finalize(status="completed", task_success=False)
        result = trace.finalize(status="failed", task_success=False)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(len(result["traceSha256"]), 64)
        with self.assertRaises(RuntimeError):
            trace.finalize(status="failed", task_success=False)

    def test_unknown_boundary_fails_closed(self):
        trace = BoundaryTrace("c0", "pcc")
        with self.assertRaises(ValueError):
            trace.add("unknown", {})


if __name__ == "__main__":
    unittest.main()
