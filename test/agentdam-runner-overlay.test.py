import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "research" / "pcc-runtime-product"))

from agentdam_trace_adapter import BoundaryTrace


class Page:
    def __init__(self):
        self.listener = None

    def on(self, event, listener):
        self.listener = listener


class Environment:
    def __init__(self):
        self.page = Page()

    def reset(self):
        raise RuntimeError("reset failed")

    def step(self):
        return None


class RunnerOverlayTests(unittest.TestCase):
    def test_runner_symbols_restore_and_environment_errors_are_retained(self):
        agent = SimpleNamespace(call_llm=lambda config, prompt: "ok")
        runner = SimpleNamespace(
            ScriptBrowserEnv=lambda: Environment(),
            get_action_description=lambda action: "click [1]",
            evaluator_router=lambda: (lambda: 1),
        )
        originals = (runner.ScriptBrowserEnv, runner.get_action_description, runner.evaluator_router, agent.call_llm)
        trace = BoundaryTrace("c0", "pcc")
        with trace.patch_runner_module(runner, agent):
            env = runner.ScriptBrowserEnv()
            with self.assertRaises(RuntimeError):
                env.reset()
            self.assertEqual(runner.get_action_description({"action_type": "CLICK"}), "click [1]")
            self.assertEqual(runner.evaluator_router()(), 1)
        self.assertEqual((runner.ScriptBrowserEnv, runner.get_action_description, runner.evaluator_router, agent.call_llm), originals)
        self.assertEqual(len(trace.boundaries["error"]), 1)
        self.assertEqual(len(trace.boundaries["tool_request"]), 1)
        self.assertEqual(len(trace.boundaries["receipt"]), 1)


if __name__ == "__main__":
    unittest.main()
