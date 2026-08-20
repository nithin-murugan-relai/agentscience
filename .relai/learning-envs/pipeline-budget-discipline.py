from __future__ import annotations

import re
from typing import Any

from relai import (
    CodeEvaluator,
    EvaluationResult,
    FixedInput,
    FixedTurn,
    RELAIEnvironment,
    SimulationResult,
)


TAGS = ["end-to-end", "pipeline-budget-discipline"]
TURN_CAP = 151
DATASET_PATH = "/Users/mns/developer/benchmarking/pipeline-probe/arms/base/credit-balance/Credit.csv"
TASK = f"""What predicts credit balance, and do the effects differ by student status or income band?

Run the full AgentScience research pipeline end to end (Stage 0 through Stage 4) on the dataset at {DATASET_PATH}. Do not publish."""

ARTIFACT_PATH_RE = re.compile(r"(/[A-Za-z0-9._~\- /]+?\.(?:pdf|tex|md|csv))")
DONE_MARKERS = (
    "ran",
    "completed",
    "finished",
    "analyzed",
    "analysed",
    "fit",
    "fitted",
    "compiled",
    "produced",
    "created",
    "wrote",
    "checked",
    "validated",
)
FINDING_MARKERS = (
    "found",
    "finding",
    "findings",
    "result",
    "results",
    "conclusion",
    "conclusions",
    "verdict",
    "shows",
    "showed",
    "suggests",
    "suggested",
)
DOMAIN_MARKERS = ("balance", "income", "student", "students", "income band")
REMAINING_PATTERNS = (
    r"\bremaining\b",
    r"\bremains\b",
    r"\bwhat remains\b",
    r"\bnext steps?\b",
    r"\bnext step\b",
    r"\bstill need\b",
    r"\bpending\b",
    r"\bleft to do\b",
    r"\bfollow-up\b",
    r"\blimitation\b",
    r"\blimitations\b",
    r"\bno remaining\b",
    r"\bnothing remains\b",
    r"\bno further work\b",
)


def _to_plain_data(value: Any, depth: int = 0) -> Any:
    if depth > 8:
        return repr(value)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _to_plain_data(item, depth + 1) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_plain_data(item, depth + 1) for item in value]

    for method_name in ("model_dump", "dict", "to_dict"):
        method = getattr(value, method_name, None)
        if callable(method):
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


def _find_nested_values(value: Any, key: str, sink: list[Any]) -> None:
    if isinstance(value, dict):
        if key in value:
            sink.append(value[key])
        for item in value.values():
            _find_nested_values(item, key, sink)
        return
    if isinstance(value, list):
        for item in value:
            _find_nested_values(item, key, sink)


def _extract_final_text(simulation_result: SimulationResult) -> str:
    final_output = getattr(simulation_result, "final_output", None)
    if isinstance(final_output, str):
        return final_output.strip()
    data = _to_plain_data(final_output)
    strings: list[str] = []
    _collect_strings(data, strings)
    if strings:
        return max(strings, key=len).strip()
    return ""


def _extract_transcript_and_blob(simulation_result: SimulationResult) -> tuple[str, str]:
    data = _to_plain_data(simulation_result)
    strings: list[str] = []
    _collect_strings(data, strings)
    blob = "\n".join(strings)

    transcript_values: list[Any] = []
    _find_nested_values(data, "agent_transcript", transcript_values)
    transcript_candidates = [
        item for item in transcript_values if isinstance(item, str) and "TOOL " in item
    ]
    if transcript_candidates:
        return max(transcript_candidates, key=len), blob

    fallback_candidates = [
        text for text in strings if "TOOL " in text and ("RESULT:" in text or "ASSISTANT:" in text)
    ]
    if fallback_candidates:
        return max(fallback_candidates, key=len), blob
    return "", blob


def _extract_num_turns(simulation_result: SimulationResult) -> int | None:
    data = _to_plain_data(simulation_result)
    values: list[Any] = []
    _find_nested_values(data, "num_turns", values)
    numeric_values = [int(value) for value in values if isinstance(value, (int, float))]
    if numeric_values:
        return max(numeric_values)

    transcript, blob = _extract_transcript_and_blob(simulation_result)
    for source in (transcript, blob):
        match = re.search(r"\bnum_turns\b[^0-9]{0,20}(\d+)", source)
        if match:
            return int(match.group(1))
    return None


def _normalize(text: str) -> str:
    return " ".join(text.casefold().split())


def _shorten(text: str, limit: int = 220) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3] + "..."


def _extract_artifact_paths(simulation_result: SimulationResult) -> list[str]:
    transcript, blob = _extract_transcript_and_blob(simulation_result)
    candidates = ARTIFACT_PATH_RE.findall("\n".join([transcript, blob]))
    seen: set[str] = set()
    artifacts: list[str] = []
    for candidate in candidates:
        cleaned = candidate.strip().rstrip('.,;)')
        if cleaned.endswith(".csv") and cleaned == DATASET_PATH:
            continue
        if cleaned not in seen and (
            "/paper/" in cleaned
            or cleaned.endswith("paper.pdf")
            or cleaned.endswith("paper.tex")
            or cleaned.endswith("experiment-log.md")
            or cleaned.endswith("abstract.txt")
        ):
            seen.add(cleaned)
            artifacts.append(cleaned)
    return artifacts


def _mentions_artifact(final_text: str, artifact_path: str) -> bool:
    normalized = _normalize(final_text)
    variants = {
        artifact_path,
        artifact_path.split("/")[-1],
        "/".join(artifact_path.split("/")[-2:]),
    }
    return any(_normalize(variant) in normalized for variant in variants if variant)


def _evaluate_nonempty_final_response(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    final_text = _extract_final_text(simulation_result)
    if final_text:
        return EvaluationResult(
            score=1.0,
            feedback="The run produced a final response instead of ending in silence.",
        )
    return EvaluationResult(
        score=0.0,
        feedback=(
            "The run must end with a final response. This scenario fails when the agent "
            "uses the full budget and returns nothing, even if analysis artifacts exist on disk."
        ),
    )


def _evaluate_lands_before_turn_cap(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    num_turns = _extract_num_turns(simulation_result)
    if num_turns is None:
        return EvaluationResult(
            score=0.0,
            feedback="Could not recover `num_turns` from the simulation result, so budget-discipline could not be verified.",
        )
    if num_turns >= TURN_CAP:
        return EvaluationResult(
            score=0.0,
            feedback=(
                f"The run used {num_turns} turns. It must land before the reproduced {TURN_CAP}-turn cap instead of exhausting it and going silent."
            ),
        )
    return EvaluationResult(
        score=1.0,
        feedback=f"The run landed in {num_turns} turns, below the reproduced {TURN_CAP}-turn cap.",
    )


def _evaluate_closing_report_covers_status(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    final_text = _extract_final_text(simulation_result)
    if not final_text:
        return EvaluationResult(
            score=0.0,
            feedback="No final response was available to verify the closing report.",
        )

    normalized = _normalize(final_text)
    has_done = any(marker in normalized for marker in DONE_MARKERS)
    has_findings = any(marker in normalized for marker in FINDING_MARKERS) and any(
        marker in normalized for marker in DOMAIN_MARKERS
    )
    has_remaining = any(re.search(pattern, normalized) for pattern in REMAINING_PATTERNS)

    missing: list[str] = []
    if not has_done:
        missing.append("what work was completed")
    if not has_findings:
        missing.append("what was found about credit balance, student status, or income band")
    if not has_remaining:
        missing.append("what remains, limitations, or an explicit statement that nothing remains")

    if missing:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The final response must land the run with a real closing report that states "
                + ", ".join(missing)
                + f". Observed final response: `{_shorten(final_text)}`."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback="The final response reports completed work, findings, and remaining work or limitations.",
    )


def _evaluate_reports_artifact_locations_when_created(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    final_text = _extract_final_text(simulation_result)
    artifacts = _extract_artifact_paths(simulation_result)
    if not artifacts:
        return EvaluationResult(
            score=1.0,
            feedback="No reportable artifact path was detected in the transcript, so artifact-location reporting was not required.",
        )
    if not final_text:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The transcript shows artifacts were created, but the run returned no final response telling the user where they are."
            ),
        )

    for artifact in artifacts:
        if _mentions_artifact(final_text, artifact):
            return EvaluationResult(
                score=1.0,
                feedback=f"The final response reports an artifact location (`{artifact}`).",
            )

    return EvaluationResult(
        score=0.0,
        feedback=(
            "The transcript shows artifacts were created, but the final response does not say where they are. "
            f"Observed artifacts include `{artifacts[0]}`. Final response: `{_shorten(final_text)}`."
        ),
    )


environment = RELAIEnvironment(
    id="pipeline-budget-discipline",
    name="pipeline-budget-discipline",
    description="Runs the full credit-balance research pipeline and expects the run to land with a closing report before the turn budget is exhausted.",
    tags=TAGS,
    input=FixedInput(turns=[FixedTurn(content=TASK)]),
    mocks={},
    evaluators=[
        CodeEvaluator(
            id="nonempty-final-response",
            description="Checks that the run ends with a final response instead of silence.",
            evaluate=_evaluate_nonempty_final_response,
        ),
        CodeEvaluator(
            id="lands-before-turn-cap",
            description="Checks that the run lands before exhausting the reproduced 151-turn budget.",
            evaluate=_evaluate_lands_before_turn_cap,
        ),
        CodeEvaluator(
            id="closing-report-covers-status",
            description="Checks that the final response states completed work, findings, and what remains or any limitations.",
            evaluate=_evaluate_closing_report_covers_status,
        ),
        CodeEvaluator(
            id="reports-artifact-locations-when-created",
            description="Checks that the final response tells the user where created artifacts are when the run produced them.",
            evaluate=_evaluate_reports_artifact_locations_when_created,
        ),
    ],
)
