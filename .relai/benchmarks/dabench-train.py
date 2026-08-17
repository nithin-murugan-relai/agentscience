from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from relai import (
    CodeEvaluator,
    EvaluationResult,
    FixedInput,
    FixedTurn,
    RELAIBenchmark,
    RELAIEnvironment,
    SimulationResult,
    StoredBenchmarkCsv,
)


BENCHMARK_ID = "dabench-train"
BENCHMARK_NAME = "dabench-train"
DATASET_REF_ID = "d82f9ee9-b70d-4e4c-9e5e-b2293c6837dc"
REQUIRED_COLUMNS = [
    "task_id",
    "question",
    "data_path",
    "constraints",
    "answer_format",
    "expected_answer",
]
FIELD_PATTERN = re.compile(r"@([a-zA-Z0-9_]+)\[([^\]]+)\]")
PREFERRED_OUTPUT_KEYS = (
    "final_output",
    "final_text",
    "assistant_message",
    "text",
    "output",
    "result",
)


def _coerce_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if value is None:
        return ""
    return str(value).strip()


def _required_text(row_fields: Any, key: str) -> str:
    value = row_fields.get(key) if isinstance(row_fields, dict) else None
    text = _coerce_text(value)
    if not text:
        raise ValueError(f"Benchmark row is missing required `{key}`.")
    return text


def _benchmark_repo_root() -> Path:
    here = Path(__file__).resolve().parent
    if (here / "pyproject.toml").exists() or (here / "src").exists():
        return here
    if here.name == "benchmarks" and here.parent.name == ".relai":
        candidate = here.parent.parent
        if (candidate / "pyproject.toml").exists() or (candidate / "src").exists():
            return candidate
    return Path.cwd().resolve()


def _resolve_data_path(data_path: str) -> str:
    path = Path(data_path)
    if path.is_absolute():
        return str(path)

    candidate_roots = [_benchmark_repo_root(), Path.cwd().resolve()]
    for root in candidate_roots:
        candidate = (root / path).resolve()
        if candidate.exists():
            return str(candidate)

    search_root = Path.cwd().resolve()
    matches = sorted(search_root.glob(f"**/{path.as_posix()}"))
    if matches:
        return str(matches[0].resolve())

    return str((candidate_roots[0] / path).resolve())


def _build_task(
    *,
    question: str,
    data_path: str,
    constraints: str,
    answer_format: str,
) -> str:
    return (
        f"{question}\n\n"
        f"Data file:\n{_resolve_data_path(data_path)}\n\n"
        f"Constraints:\n{constraints}\n\n"
        f"Answer in exactly this format:\n{answer_format}\n\n"
        "Put the formatted answer on its own line at the end of your reply, "
        "because it is parsed automatically."
    )


def _to_plain_data(value: Any, depth: int = 0) -> Any:
    if depth > 8:
        return repr(value)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {
            str(key): _to_plain_data(item, depth + 1)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [_to_plain_data(item, depth + 1) for item in value]

    for method_name in ("model_dump", "dict", "to_dict"):
        method = getattr(value, method_name, None)
        if not callable(method):
            continue
        try:
            if method_name == "model_dump":
                return _to_plain_data(method(mode="python"), depth + 1)
            return _to_plain_data(method(), depth + 1)
        except Exception:
            continue

    if hasattr(value, "__dict__"):
        try:
            return _to_plain_data(vars(value), depth + 1)
        except Exception:
            pass

    return repr(value)


def _find_nested_value(value: Any, key: str) -> Any:
    if isinstance(value, dict):
        if key in value:
            return value[key]
        for item in value.values():
            nested = _find_nested_value(item, key)
            if nested is not None:
                return nested
    if isinstance(value, list):
        for item in value:
            nested = _find_nested_value(item, key)
            if nested is not None:
                return nested
    return None


def _collect_output_strings(value: Any, sink: list[str]) -> None:
    if isinstance(value, str):
        text = value.strip()
        if text:
            sink.append(text)
        return
    if isinstance(value, dict):
        for key in PREFERRED_OUTPUT_KEYS:
            if key in value:
                _collect_output_strings(value[key], sink)
        for item in value.values():
            _collect_output_strings(item, sink)
        return
    if isinstance(value, (list, tuple, set)):
        for item in value:
            _collect_output_strings(item, sink)


def _extract_final_answer(simulation_result: SimulationResult) -> str:
    candidates: list[str] = []
    data = _to_plain_data(simulation_result)
    final_output = getattr(simulation_result, "final_output", None)
    if final_output is not None:
        _collect_output_strings(_to_plain_data(final_output), candidates)
    _collect_output_strings(_find_nested_value(data, "final_output"), candidates)
    _collect_output_strings(_find_nested_value(data, "final_text"), candidates)
    if not candidates:
        return ""
    return max(candidates, key=len).strip()


def _extract_row_fields(simulation_result: SimulationResult) -> dict[str, Any] | None:
    metadata = getattr(simulation_result, "metadata", None)
    if isinstance(metadata, dict):
        benchmark_metadata = metadata.get("benchmark")
        if isinstance(benchmark_metadata, dict):
            row_fields = benchmark_metadata.get("row_fields")
            if isinstance(row_fields, dict):
                return row_fields

    data = _to_plain_data(simulation_result)
    benchmark_metadata = _find_nested_value(data, "benchmark")
    if isinstance(benchmark_metadata, dict):
        row_fields = benchmark_metadata.get("row_fields")
        if isinstance(row_fields, dict):
            return row_fields

    row_fields = _find_nested_value(data, "row_fields")
    if isinstance(row_fields, dict):
        return row_fields
    return None


def _parse_expected_answer_text(expected_answer_text: str) -> dict[str, str]:
    try:
        payload = json.loads(expected_answer_text)
    except Exception as exc:
        raise ValueError(
            f"Benchmark row has invalid `expected_answer` JSON: {exc}."
        ) from exc

    if not isinstance(payload, dict) or not payload:
        raise ValueError(
            "Benchmark row `expected_answer` must be a non-empty JSON object."
        )

    normalized: dict[str, str] = {}
    for raw_key, raw_value in payload.items():
        key = _coerce_text(raw_key)
        if not key:
            raise ValueError(
                "Benchmark row `expected_answer` contains an empty field name."
            )
        normalized[key] = _coerce_text(raw_value)
    return normalized


def _extract_answer_fields(final_answer: str) -> dict[str, str]:
    extracted: dict[str, str] = {}
    for match in FIELD_PATTERN.finditer(final_answer):
        extracted[match.group(1)] = match.group(2)
    return extracted


def _try_parse_finite_float(value: str) -> float | None:
    text = value.strip()
    if not text:
        return None
    try:
        number = float(text)
    except Exception:
        return None
    if not math.isfinite(number):
        return None
    return number


def _values_match(observed: str, expected: str) -> bool:
    if observed == expected:
        return True
    observed_number = _try_parse_finite_float(observed)
    expected_number = _try_parse_finite_float(expected)
    if observed_number is None or expected_number is None:
        return False
    return abs(observed_number - expected_number) < 1e-6


def _tail(text: str, limit: int = 200) -> str:
    if len(text) <= limit:
        return text
    return text[-limit:]


def _evaluate_row(
    simulation_result: SimulationResult,
) -> tuple[int, int, int, int, str]:
    row_fields = _extract_row_fields(simulation_result)
    if row_fields is None:
        raise ValueError(
            "Simulation metadata is missing `benchmark.row_fields`, so the "
            "benchmark cannot read `expected_answer`."
        )

    expected_answer_text = _required_text(row_fields, "expected_answer")
    expected_fields = _parse_expected_answer_text(expected_answer_text)
    final_answer = _extract_final_answer(simulation_result)
    extracted_fields = _extract_answer_fields(final_answer)

    total_fields = len(expected_fields)
    correct_fields = 0
    missing_fields = 0
    field_feedback: list[str] = []

    for field_name, expected_value in expected_fields.items():
        observed_value = extracted_fields.get(field_name)
        if observed_value is None:
            missing_fields += 1
            field_feedback.append(
                f"{field_name}: expected `{expected_value}`, observed missing"
            )
            continue
        if _values_match(observed_value, expected_value):
            correct_fields += 1
        field_feedback.append(
            f"{field_name}: expected `{expected_value}`, observed `{observed_value}`"
        )

    wrong_fields = total_fields - correct_fields - missing_fields
    if not extracted_fields:
        tail = _tail(final_answer)
        if tail:
            prefix = (
                "Missing required tagged format: no `@name[value]` fields were "
                f"found in the final reply. Reply tail: `{tail}`."
            )
        else:
            prefix = (
                "Missing required tagged format: the benchmark could not locate "
                "any final reply text to parse."
            )
    elif missing_fields and wrong_fields:
        prefix = (
            f"Wrong content for {wrong_fields} field(s) and missing required "
            f"output for {missing_fields} field(s)."
        )
    elif missing_fields:
        prefix = f"Missing required output for {missing_fields} field(s)."
    elif wrong_fields:
        prefix = f"Wrong content for {wrong_fields} field(s)."
    else:
        prefix = f"All {total_fields} expected field(s) matched."

    feedback = f"{prefix} Field checks: " + "; ".join(field_feedback)
    return total_fields, correct_fields, missing_fields, wrong_fields, feedback


def _evaluate_dabench_correct(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    try:
        total_fields, correct_fields, _, _, feedback = _evaluate_row(simulation_result)
    except ValueError as exc:
        return EvaluationResult(score=0.0, feedback=str(exc))

    score = 1.0 if correct_fields == total_fields else 0.0
    return EvaluationResult(score=score, feedback=feedback)


def _evaluate_dabench_field_accuracy(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    try:
        total_fields, correct_fields, _, _, feedback = _evaluate_row(simulation_result)
    except ValueError as exc:
        return EvaluationResult(score=0.0, feedback=str(exc))

    return EvaluationResult(
        score=correct_fields / total_fields,
        feedback=feedback,
    )


def build_environment(row_fields, sample_index):
    task_id = _required_text(row_fields, "task_id")
    question = _required_text(row_fields, "question")
    data_path = _required_text(row_fields, "data_path")
    constraints = _required_text(row_fields, "constraints")
    answer_format = _required_text(row_fields, "answer_format")
    _parse_expected_answer_text(_required_text(row_fields, "expected_answer"))

    del sample_index

    return RELAIEnvironment(
        id=task_id,
        name=f"DABench {task_id}",
        description=(
            "Tests whether the agent answers a CSV-backed data-analysis task and "
            "emits the required tagged output fields."
        ),
        tags=["end-to-end"],
        input=FixedInput(
            turns=[
                FixedTurn(
                    content=_build_task(
                        question=question,
                        data_path=data_path,
                        constraints=constraints,
                        answer_format=answer_format,
                    )
                )
            ]
        ),
        mocks={},
        evaluators=[
            CodeEvaluator(
                id="dabench-correct",
                description=(
                    "Scores 1.0 only when every expected tagged answer field "
                    "matches the row's `expected_answer`."
                ),
                evaluate=_evaluate_dabench_correct,
            ),
            CodeEvaluator(
                id="dabench-field-accuracy",
                description=(
                    "Scores the fraction of expected tagged answer fields that "
                    "match the row's `expected_answer`."
                ),
                evaluate=_evaluate_dabench_field_accuracy,
            ),
        ],
    )


benchmark = RELAIBenchmark(
    schema_version="relai.benchmark.v1",
    id=BENCHMARK_ID,
    name=BENCHMARK_NAME,
    description=(
        "DABench training tasks for AgentScience that require exact tagged "
        "answers for CSV-backed data-analysis questions."
    ),
    dataset_ref=StoredBenchmarkCsv(id=DATASET_REF_ID),
    agent_target="agentscience",
    required_columns=REQUIRED_COLUMNS,
    build_environment=build_environment,
)
