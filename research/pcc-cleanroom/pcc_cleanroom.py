"""Clean-room PCC mechanism from the public written specification.

No candidate Hush compiler or evaluator is imported.  The deliberately small
surface makes the privacy boundary inspectable: extract one bounded integer,
compute one predicate locally, and render one fixed-schema boolean.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re


class CompilationError(ValueError):
    """The contract cannot be evaluated unambiguously and must fail closed."""


@dataclass(frozen=True)
class NumericPredicateContract:
    field: str
    label: str
    op: str
    threshold: int
    capture_pattern: str
    minimum: int = 0
    maximum: int = 4095

    def __post_init__(self) -> None:
        if self.op not in {"lt", "le", "eq", "ge", "gt"}:
            raise CompilationError("unsupported predicate")
        if not self.field or not self.label:
            raise CompilationError("field and label are required")
        if self.minimum > self.maximum:
            raise CompilationError("invalid numeric bounds")
        try:
            compiled = re.compile(self.capture_pattern, re.IGNORECASE)
        except re.error as exc:
            raise CompilationError("invalid capture pattern") from exc
        if compiled.groups != 1:
            raise CompilationError("capture pattern must contain exactly one group")


@dataclass(frozen=True)
class Release:
    text: str
    value: bool
    receipt: dict[str, object]


_INTEGER = re.compile(r"(?<![\w.])-?\d+(?![\w.])")


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _extract_unique_integer(source: str, contract: NumericPredicateContract) -> int:
    values = []
    pattern = re.compile(contract.capture_pattern, re.IGNORECASE)
    for token in pattern.findall(source):
        value = int(token)
        if contract.minimum <= value <= contract.maximum:
            values.append(value)
    unique = set(values)
    if len(unique) != 1:
        raise CompilationError("expected exactly one bounded candidate")
    return unique.pop()


def _evaluate(value: int, op: str, threshold: int) -> bool:
    if op == "lt":
        return value < threshold
    if op == "le":
        return value <= threshold
    if op == "eq":
        return value == threshold
    if op == "ge":
        return value >= threshold
    return value > threshold


def compile_numeric_predicate(source: str, contract: NumericPredicateContract) -> Release:
    if not isinstance(source, str) or not source.strip():
        raise CompilationError("source is required")
    extracted = _extract_unique_integer(source, contract)
    result = _evaluate(extracted, contract.op, contract.threshold)
    text = f"{contract.label}: {'true' if result else 'false'}"
    public_contract = {
        "field": contract.field,
        "label": contract.label,
        "op": contract.op,
        "threshold": contract.threshold,
        "capture_pattern": contract.capture_pattern,
        "bounds": [contract.minimum, contract.maximum],
    }
    receipt = {
        "version": 1,
        "mechanism": "pcc-cleanroom-numeric-predicate",
        "contract_sha256": _digest(json.dumps(public_contract, sort_keys=True, separators=(",", ":"))),
        "source_sha256": _digest(source),
        "release_sha256": _digest(text),
        "source_included": False,
        "private_value_included": False,
    }
    return Release(text=text, value=result, receipt=receipt)

