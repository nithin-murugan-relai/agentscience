"""RELAI learning environment generated from a sandboxed log/feedback pass."""

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


TAGS = [
    "end-to-end",
    "research-build-starts-with-supported-subcommands",
]

TASK = (
    "Run the AgentScience research pipeline to BUILD (do not publish) a paper "
    "bundle for the idea 'Does city latitude predict the seasonal amplitude of "
    "daily temperature?' using workspace ./research-runs/relai-demo-1 and the "
    "canonical agentscience CLI per the research-publish skill."
)

SUPPORTED_RESEARCH_SUBCOMMANDS = (
    "init",
    "template",
    "list",
    "literature",
    "compile",
    "check-figures",
)
UNSUPPORTED_RESEARCH_SUBCOMMANDS = ("build", "run")
EARLY_PIPELINE_CALL_DEADLINE = 5

TOOL_LINE_RE = re.compile(r"^TOOL\s+([^:]+):\s*(.*)$")
RESEARCH_SUBCOMMAND_RE = re.compile(r"\bagentscience\s+research\s+([a-z-]+)\b")
SOURCE_FILE_RE = re.compile(
    r"(^|/)(project/)?(cli/bin/agentscience|cli/lib/[^\\s'\"]+|bin/agentscience)$"
)
SOURCE_BASH_RE = re.compile(
    r"\b(cat|sed|grep|awk|head|tail|less|more)\b.*"
    r"((^|[ /])(project/)?(cli/bin/agentscience|cli/lib/|bin/agentscience)\b)"
)
RESULT_ERROR_MARKERS = (
    "Unknown research subcommand",
    "EXIT:1",
    "requires --",
    "Traceback",
    "command not found",
)
SOURCE_OUTPUT_MARKERS = (
    'import "../cli/bin/agentscience";',
    "async function handleResearch(",
    "Unknown research subcommand: ${subcommand}",
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

    for method_name in ("model_dump", "dict"):
        method = getattr(value, method_name, None)
        if callable(method):
            try:
                if method_name == "model_dump":
                    return _to_plain_data(method(mode="python"), depth + 1)
                return _to_plain_data(method(), depth + 1)
            except TypeError:
                try:
                    return _to_plain_data(method(), depth + 1)
                except Exception:
                    pass
            except Exception:
                pass

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
    if isinstance(value, list):
        for item in value:
            _collect_strings(item, sink)


def _extract_transcript(simulation_result: SimulationResult) -> tuple[str, str]:
    data = _to_plain_data(simulation_result)
    strings: list[str] = []
    _collect_strings(data, strings)

    transcript_candidates = [
        text
        for text in strings
        if "TOOL " in text and ("RESULT:" in text or "ASSISTANT:" in text)
    ]
    transcript = max(transcript_candidates, key=len, default="")
    blob = "\n".join(strings)
    if not transcript and "TOOL " in blob and "RESULT:" in blob:
        transcript = blob
    return transcript, blob


def _parse_tool_records(transcript: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    for raw_line in transcript.splitlines():
        line = raw_line.strip()
        tool_match = TOOL_LINE_RE.match(line)
        if tool_match:
            if current is not None:
                records.append(current)
            current = {
                "name": tool_match.group(1).strip(),
                "detail": tool_match.group(2).strip(),
                "results": [],
            }
            continue
        if line.startswith("RESULT:") and current is not None:
            current["results"].append(line.removeprefix("RESULT:").strip())

    if current is not None:
        records.append(current)
    return records


def _research_subcommands(detail: str) -> list[str]:
    return [match.group(1) for match in RESEARCH_SUBCOMMAND_RE.finditer(detail)]


def _joined_results(record: dict[str, Any]) -> str:
    results = record.get("results", [])
    return "\n".join(result for result in results if isinstance(result, str))


def _early_tool_summary(records: list[dict[str, Any]]) -> str:
    summary_parts = []
    for index, record in enumerate(records[:EARLY_PIPELINE_CALL_DEADLINE], start=1):
        detail = record.get("detail", "") or record.get("name", "")
        summary_parts.append(f"{index}: {detail}")
    return "; ".join(summary_parts) if summary_parts else "no tool calls recorded"


def _evaluate_supported_subcommands_only(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    transcript, blob = _extract_transcript(simulation_result)
    if not transcript:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Could not locate the run transcript needed to verify whether the "
                "agent stayed on supported `agentscience research` subcommands."
            ),
        )

    records = _parse_tool_records(transcript)
    unsupported_hits: list[str] = []
    for index, record in enumerate(records, start=1):
        for subcommand in _research_subcommands(record.get("detail", "")):
            if subcommand in UNSUPPORTED_RESEARCH_SUBCOMMANDS:
                unsupported_hits.append(
                    f"tool call {index} used `agentscience research {subcommand}`"
                )

    unknown_error_present = "Unknown research subcommand" in blob
    if unsupported_hits or unknown_error_present:
        reasons = list(unsupported_hits)
        if unknown_error_present:
            reasons.append(
                'the transcript includes the error `"Unknown research subcommand"`'
            )
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The agent must drive this build with supported `agentscience "
                "research` subcommands only. Observed "
                + "; ".join(reasons)
                + ". Use supported subcommands such as `init`, `template`, "
                "`list`, `literature`, `compile`, or `check-figures` instead."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback=(
            "The transcript stays on supported `agentscience research` "
            "subcommands and avoids unknown-subcommand failures."
        ),
    )


def _evaluate_no_source_rediscovery(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    transcript, blob = _extract_transcript(simulation_result)
    if not transcript:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Could not locate the run transcript needed to verify that the "
                "agent relied on CLI help and supported commands instead of "
                "reading AgentScience CLI source files."
            ),
        )

    records = _parse_tool_records(transcript)
    source_hits: list[str] = []
    for index, record in enumerate(records, start=1):
        name = str(record.get("name", ""))
        detail = str(record.get("detail", ""))
        if name == "Read" and SOURCE_FILE_RE.search(detail):
            source_hits.append(f"tool call {index} read `{detail}`")
        elif name == "Bash" and SOURCE_BASH_RE.search(detail):
            source_hits.append(f"tool call {index} inspected source via `{detail}`")

    for marker in SOURCE_OUTPUT_MARKERS:
        if marker in blob:
            source_hits.append(f"the transcript exposed CLI source content like `{marker}`")
            break

    if source_hits:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The agent should verify the CLI contract through supported help "
                "and runtime commands, not by reading CLI source code. Observed "
                + "; ".join(source_hits)
                + "."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback=(
            "The transcript verifies the command surface without reading the "
            "AgentScience CLI source files."
        ),
    )


def _evaluate_early_supported_pipeline_command(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    transcript, _ = _extract_transcript(simulation_result)
    if not transcript:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Could not locate the run transcript needed to verify whether a "
                "supported pipeline command was reached by tool call 5."
            ),
        )

    records = _parse_tool_records(transcript)
    first_successful_supported_call: tuple[int, str] | None = None

    for index, record in enumerate(records, start=1):
        supported_subcommands = [
            subcommand
            for subcommand in _research_subcommands(record.get("detail", ""))
            if subcommand in SUPPORTED_RESEARCH_SUBCOMMANDS
        ]
        if not supported_subcommands:
            continue

        result_text = _joined_results(record)
        if any(marker in result_text for marker in RESULT_ERROR_MARKERS):
            continue

        first_successful_supported_call = (index, supported_subcommands[0])
        break

    if first_successful_supported_call is None:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Preflight checks like `runtime status`, `auth whoami`, `config "
                "get`, and `ls` are fine, but the run never reaches a successful "
                "supported `agentscience research` subcommand. The first five tool "
                f"calls were: {_early_tool_summary(records)}."
            ),
        )

    call_index, subcommand = first_successful_supported_call
    if call_index > EARLY_PIPELINE_CALL_DEADLINE:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The first successful supported pipeline command must land by tool "
                f"call {EARLY_PIPELINE_CALL_DEADLINE}. Observed "
                f"`agentscience research {subcommand}` at tool call {call_index}. "
                f"The first five tool calls were: {_early_tool_summary(records)}."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback=(
            "A supported `agentscience research` subcommand succeeds within the "
            f"first {EARLY_PIPELINE_CALL_DEADLINE} tool calls."
        ),
    )


environment = RELAIEnvironment(
    id="pipeline-supported-subcommands",
    name="Supported Research Pipeline Start",
    description="Tests that an AgentScience build starts with supported research commands instead of dead subcommands or source spelunking.",
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
            id="supported-research-subcommands-only",
            description="Checks that the agent avoids unsupported `research build/run` calls and unknown-subcommand errors.",
            evaluate=_evaluate_supported_subcommands_only,
        ),
        CodeEvaluator(
            id="no-cli-source-rediscovery",
            description="Checks that the agent does not read CLI source files to rediscover the supported command surface.",
            evaluate=_evaluate_no_source_rediscovery,
        ),
        CodeEvaluator(
            id="early-supported-pipeline-command",
            description="Checks that a successful supported `agentscience research` subcommand is reached by tool call 5.",
            evaluate=_evaluate_early_supported_pipeline_command,
        ),
    ],
)
