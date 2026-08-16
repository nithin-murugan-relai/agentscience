from __future__ import annotations

import json
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


BENCHMARK_ID = "discoverybench-official"
BENCHMARK_NAME = "discoverybench-official"
DATASET_REF_ID = "b6c9fb17-9fce-4006-834f-107ba0f1325c"
DATASET_TYPE = "synth"
REQUIRED_COLUMNS = [
    "task_id",
    "question",
    "data_path",
    "columns",
    "expected_finding",
]
PAYLOAD_KEYS = (
    "assistant_message",
    "final_output",
    "text",
    "output",
    "result",
)
SCORE_KEYS = (
    "final_score",
    "variable_score",
    "relationship_score",
    "scoring_error",
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


def _display_name(task_id: str) -> str:
    return task_id.replace("_", " ").replace("-", " ").strip().title()


def _row_payload(
    task_id: str,
    question: str,
    data_path: str,
    columns: str,
    expected_finding: str,
) -> str:
    return json.dumps(
        {
            "task_id": task_id,
            "question": question,
            "data_path": data_path,
            "columns": columns,
            "expected_finding": expected_finding,
            "dataset_type": DATASET_TYPE,
        },
        ensure_ascii=True,
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


def _collect_strings(value: Any, sink: list[str]) -> None:
    if isinstance(value, str):
        sink.append(value)
        return
    if isinstance(value, dict):
        for item in value.values():
            _collect_strings(item, sink)
        return
    if isinstance(value, (list, tuple, set)):
        for item in value:
            _collect_strings(item, sink)


def _candidate_payload_strings(value: Any) -> list[str]:
    candidates: list[str] = []

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            for key in PAYLOAD_KEYS:
                maybe = node.get(key)
                if isinstance(maybe, str):
                    candidates.append(maybe)
            for item in node.values():
                visit(item)
            return
        if isinstance(node, list):
            for item in node:
                visit(item)

    visit(value)
    return candidates


def _parse_payload_from_result(
    simulation_result: SimulationResult,
) -> tuple[dict[str, Any] | None, str]:
    plain = _to_plain_data(simulation_result)

    for candidate in _candidate_payload_strings(plain):
        try:
            payload = json.loads(candidate)
        except Exception:
            continue
        if isinstance(payload, dict) and any(key in payload for key in SCORE_KEYS):
            return payload, candidate

    strings: list[str] = []
    _collect_strings(plain, strings)
    for candidate in strings:
        text = candidate.strip()
        if not text.startswith("{"):
            continue
        try:
            payload = json.loads(text)
        except Exception:
            continue
        if isinstance(payload, dict) and any(key in payload for key in SCORE_KEYS):
            return payload, candidate

    return None, ""


def _truncate(text: str, limit: int = 400) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3] + "..."


def _format_score(value: Any) -> str:
    if isinstance(value, (int, float)):
        return f"{float(value):.2f}"
    return "n/a"


def _score_feedback(
    payload: dict[str, Any],
    *,
    metric_key: str,
    metric_label: str,
) -> str:
    variable_score = _format_score(payload.get("variable_score"))
    relationship_score = _format_score(payload.get("relationship_score"))
    final_score = _format_score(payload.get("final_score"))
    answer_preview = _truncate(_coerce_text(payload.get("answer")))
    score_text = (
        f"variable_score={variable_score}, "
        f"relationship_score={relationship_score}, "
        f"final_score={final_score}."
    )

    scoring_error = _coerce_text(payload.get("scoring_error"))
    if scoring_error:
        return (
            f"DiscoveryBench scoring failed before the agent answer could be graded: "
            f"{scoring_error}. {score_text} Answer preview: {answer_preview or '[empty answer]'}"
        )

    metric_value = payload.get(metric_key)
    if not isinstance(metric_value, (int, float)):
        return (
            f"The adapter payload is missing `{metric_key}`, so the benchmark could not "
            f"read the {metric_label} score. {score_text} "
            f"Answer preview: {answer_preview or '[empty answer]'}"
        )

    if float(metric_value) >= 1.0:
        return (
            f"DiscoveryBench gave full credit on {metric_label}. {score_text} "
            f"Answer preview: {answer_preview or '[empty answer]'}"
        )

    return (
        f"DiscoveryBench deducted points on {metric_label}; score={float(metric_value):.2f}. "
        f"{score_text} Answer preview: {answer_preview or '[empty answer]'}"
    )


def _make_discoverybench_evaluator(
    *,
    evaluator_id: str,
    metric_key: str,
    metric_label: str,
    description: str,
) -> CodeEvaluator:
    def evaluate(simulation_result: SimulationResult) -> EvaluationResult:
        payload, _ = _parse_payload_from_result(simulation_result)
        if payload is None:
            return EvaluationResult(
                score=0.0,
                feedback=(
                    "The simulator did not return the expected DiscoveryBench JSON "
                    "payload in the assistant message, so the benchmark could not "
                    f"read `{metric_key}`."
                ),
            )

        scoring_error = _coerce_text(payload.get("scoring_error"))
        if scoring_error:
            return EvaluationResult(
                score=0.0,
                feedback=_score_feedback(
                    payload,
                    metric_key=metric_key,
                    metric_label=metric_label,
                ),
            )

        metric_value = payload.get(metric_key)
        if not isinstance(metric_value, (int, float)):
            return EvaluationResult(
                score=0.0,
                feedback=_score_feedback(
                    payload,
                    metric_key=metric_key,
                    metric_label=metric_label,
                ),
            )

        return EvaluationResult(
            score=float(metric_value),
            feedback=_score_feedback(
                payload,
                metric_key=metric_key,
                metric_label=metric_label,
            ),
        )

    return CodeEvaluator(
        id=evaluator_id,
        description=description,
        evaluate=evaluate,
    )


DISCOVERYBENCH_VARIABLES_EVALUATOR = _make_discoverybench_evaluator(
    evaluator_id="discoverybench-variables",
    metric_key="variable_score",
    metric_label="variable coverage",
    description=(
        "Passes through DiscoveryBench's variable score for whether the answer "
        "names the same quantities as the published finding."
    ),
)

DISCOVERYBENCH_RELATIONSHIP_EVALUATOR = _make_discoverybench_evaluator(
    evaluator_id="discoverybench-relationship",
    metric_key="relationship_score",
    metric_label="relationship direction or form",
    description=(
        "Passes through DiscoveryBench's relationship score for whether the answer "
        "states the same direction or functional form as the published finding."
    ),
)

DISCOVERYBENCH_FINAL_SCORE_EVALUATOR = _make_discoverybench_evaluator(
    evaluator_id="discoverybench-final-score",
    metric_key="final_score",
    metric_label="headline final score",
    description=(
        "Passes through DiscoveryBench's strict final score from the adapter payload."
    ),
)


def build_environment(row_fields, sample_index):
    task_id = _required_text(row_fields, "task_id")
    question = _required_text(row_fields, "question")
    data_path = _required_text(row_fields, "data_path")
    columns = _required_text(row_fields, "columns")
    expected_finding = _required_text(row_fields, "expected_finding")

    del sample_index

    return RELAIEnvironment(
        id=task_id,
        name=f"{_display_name(task_id)} DiscoveryBench Sample",
        description=(
            "Tests whether the agent analyzes the provided dataset and reaches the "
            "same finding that DiscoveryBench's published evaluator rewards."
        ),
        tags=["end-to-end"],
        input=FixedInput(
            turns=[
                FixedTurn(
                    content=_row_payload(
                        task_id=task_id,
                        question=question,
                        data_path=data_path,
                        columns=columns,
                        expected_finding=expected_finding,
                    )
                )
            ]
        ),
        mocks={},
        evaluators=[
            DISCOVERYBENCH_VARIABLES_EVALUATOR,
            DISCOVERYBENCH_RELATIONSHIP_EVALUATOR,
            DISCOVERYBENCH_FINAL_SCORE_EVALUATOR,
        ],
    )


benchmark = RELAIBenchmark(
    schema_version="relai.benchmark.v1",
    id=BENCHMARK_ID,
    name=BENCHMARK_NAME,
    description=(
        "DiscoveryBench evaluation rows for AgentScience, scored by the simulator's "
        "pass-through of DiscoveryBench's own evaluator."
    ),
    dataset_ref=StoredBenchmarkCsv(id=DATASET_REF_ID),
    agent_target="agentscience",
    required_columns=REQUIRED_COLUMNS,
    build_environment=build_environment,
)
