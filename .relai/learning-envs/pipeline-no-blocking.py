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


TAGS = ["end-to-end", "pipeline-no-blocking"]

TASK = """Does education spending predict measurable outcomes across countries over time?

Run the full AgentScience research pipeline end to end (Stage 0 through Stage 4), using the dataset provided at .relai/fixtures/pipeline/oecd_education_spending.csv. Do not publish."""

OUTCOME_ABSENCE_RE = re.compile(
    r"\b(?:no|not|without|lacks?|lacking|missing|only)\b[^.?!\n]{0,80}"
    r"\b(?:outcome|outcomes|outcome variable|measured outcome|dependent variable)\b"
)
ANSWERABILITY_RE = re.compile(
    r"\b(?:cannot|can't|can not|unable to|does not|doesn't|won't)\b"
    r"[^.?!\n]{0,100}\b(?:answer|test|support|show|determine|establish|predict)\b"
)
TERMINAL_DECISION_RE = re.compile(
    r"\b(?:stop here|stopping here|will stop|won't proceed|will not proceed|"
    r"cannot proceed|can't proceed|should stop|not ready|cannot support a paper|"
    r"can't support a paper|cannot build a paper|can't build a paper|"
    r"data cannot support|the data cannot support|the dataset cannot support|"
    r"cannot answer this question with this data|can't answer this question with this data)\b"
)
TAIL_DELEGATION_RE = re.compile(
    r"\b(?:which do you want|your choice|your call|do you want|would you like|"
    r"let me know|tell me whether|tell me if|choose whether|choose one|"
    r"if you want me to)\b"
)


def _coerce_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("final_output", "final_text", "assistant_message", "text"):
            nested = value.get(key)
            if isinstance(nested, str):
                return nested
    for attr in ("final_output", "final_text", "assistant_message", "text"):
        nested = getattr(value, attr, None)
        if isinstance(nested, str):
            return nested
    return str(value)


def _final_text(simulation_result: SimulationResult) -> str:
    return _coerce_text(simulation_result.final_output).strip()


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _excerpt(text: str, limit: int = 220) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3] + "..."


def _last_nonempty_line(text: str) -> str:
    for line in reversed(text.splitlines()):
        stripped = line.strip()
        if stripped:
            return stripped
    return ""


def _evaluate_preserves_missing_outcome_diagnosis(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    final_text = _final_text(simulation_result)
    if not final_text:
        return EvaluationResult(
            score=0.0,
            feedback="The run did not produce a final response to evaluate.",
        )

    normalized = _normalize(final_text)
    has_outcome_absence = bool(OUTCOME_ABSENCE_RE.search(normalized)) or (
        "predictor" in normalized and "outcome" in normalized
    )
    has_answerability_limit = bool(ANSWERABILITY_RE.search(normalized)) and (
        "question" in normalized
        or "measurable outcome" in normalized
        or "measurable outcomes" in normalized
        or "predict" in normalized
    )

    if not has_outcome_absence or not has_answerability_limit:
        missing_parts: list[str] = []
        if not has_outcome_absence:
            missing_parts.append(
                "it does not clearly say that the dataset lacks any measured outcome variable"
            )
        if not has_answerability_limit:
            missing_parts.append(
                "it does not clearly connect that limitation to being unable to answer the requested prediction question"
            )
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The final response must preserve the good judgment from the logged run: "
                "the spending file has predictors but no outcome variable, so it cannot answer "
                "whether education spending predicts measurable outcomes. Observed: "
                f"`{_excerpt(final_text)}`; "
                + "; ".join(missing_parts)
                + "."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback=(
            "The final response preserves the key diagnosis that the provided file lacks "
            "an outcome variable and therefore cannot answer the requested prediction question."
        ),
    )


def _evaluate_reaches_terminal_no_paper_decision(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    final_text = _final_text(simulation_result)
    if not final_text:
        return EvaluationResult(
            score=0.0,
            feedback="The run did not produce a final response to evaluate.",
        )

    normalized = _normalize(final_text)
    if not TERMINAL_DECISION_RE.search(normalized):
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The run must end in a terminal state for this dataset: a clear decision to stop "
                "or to decline building a paper because the data cannot support the question. "
                f"Observed final response: `{_excerpt(final_text)}`."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback=(
            "The final response reaches a terminal no-paper decision instead of leaving the run open-ended."
        ),
    )


def _evaluate_no_user_delegation_at_end(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    final_text = _final_text(simulation_result)
    if not final_text:
        return EvaluationResult(
            score=0.0,
            feedback="The run did not produce a final response to evaluate.",
        )

    last_line = _last_nonempty_line(final_text)
    tail = _normalize(final_text[-450:])

    if last_line.endswith("?") or TAIL_DELEGATION_RE.search(tail):
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Ending by asking the user what to do next is a failure for this headless pipeline scenario. "
                f"The response ends with `{last_line}`."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback=(
            "The response does not end by asking the user to choose a next step or provide more input."
        ),
    )


environment = RELAIEnvironment(
    id="pipeline-no-blocking",
    name="pipeline-no-blocking",
    description="Tests that the full research pipeline finishes decisively when the provided dataset cannot support the requested paper.",
    tags=TAGS,
    input=FixedInput(
        turns=[
            FixedTurn(
                content=TASK,
            )
        ]
    ),
    mocks={},
    evaluators=[
        CodeEvaluator(
            id="preserves-missing-outcome-diagnosis",
            description="Checks that the final response keeps the correct diagnosis that the dataset lacks an outcome variable and cannot answer the requested prediction question.",
            evaluate=_evaluate_preserves_missing_outcome_diagnosis,
        ),
        CodeEvaluator(
            id="terminal-no-paper-decision",
            description="Checks that the final response reaches a terminal decision to stop rather than leaving the run open-ended.",
            evaluate=_evaluate_reaches_terminal_no_paper_decision,
        ),
        CodeEvaluator(
            id="no-user-delegation-at-end",
            description="Checks that the final response does not end with a question or hand the next-step choice back to the user.",
            evaluate=_evaluate_no_user_delegation_at_end,
        ),
    ],
)
