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
    "research-answer-covers-each-factor-with-one-clear-conclusion",
]

TASK = """Research question: Is there a relationship between the levels of tourist activity, pollution control, and eco-tourism in marine conservation areas, and the number of species found in those areas?

Data is in this directory:
.relai/fixtures/discoverybench/marine-conservation_2_1

Columns:
  - marine_conservation_in_schools: Binary indicator if the local schools' curriculum includes marine conservation topics
  - fishing_industry_presence: A score from 0 to 10 indicating the presence of the fishing industry
  - local_community_involvement: The involvement of local communities in conservation efforts, rated from 1 (least involved) to 5 (most involved)
  - water_temperature_celsius: Average water temperature in Celsius
  - illegal_fishing_rate: The average number of illegal fishing activities reported per month
  - protection_status: Indicates if the area is protected from commercial fishing
  - pollution_control_index: Index rating from 0 to 100 indicating the level of pollution control measures in place
  - conservation_funding: Annual conservation funding received in US dollars
  - local_awareness_campaigns: Number of local awareness campaigns for marine conservation per year
  - is_marine_conservation_zone: Binary indicator if the area is designated as a marine conservation zone
  - illegal_fishing_reports: Number of reports filed for illegal fishing activities in the marine area per month.
  - local_gov_environmental_policy_score: A score from 0 to 10 evaluating the degree of involvement of local governments in enforcing environmental policies
  - marine_biodiversity_index: A numeric index representing the variety of species found in a region, where higher numbers indicate greater biodiversity.
  - average_tourist_rating_visibility: Average rating provided by tourists on the visibility of marine life, scale from 1 to 5
  - reported_marine_pollution_incidents: Number of reported incidents of marine pollution in the area per year
  - predatory_fish_lifespan_years: Average lifespan of predatory fish species in years
  - area_id: Unique identifier for a marine protected area
  - number_of_species: Number of different species found in the area
  - research_grants_count: Number of active environmental research grants in the marine area
  - pollution_index: Numerical index representing the level of pollution, from 1 (least polluted) to 100 (most polluted)
  - has_international_cooperation: Binary indicating whether there is international cooperation in marine conservation efforts
  - environmental_surveillance_count: The number of times environmental surveillance patrols occurred in a region within a year.
  - tourist_visits_annual: Annual number of tourists visiting the marine area
  - marine_pollution_incidents: Number of recorded marine pollution incidents per year in the area.
  - eco_friendly_business_percentile: The percentile ranking of the area based on the percentage of businesses that are eco-friendly and support marine conservation
  - protected_marine_reserves_count: Number of marine reserves officially designated as protected areas
  - marine_patrol_interventions_per_month: Number of marine patrol interventions conducted per month in the marine area.
  - marine_conservation_funding: Total annual funding (in thousands of dollars) allocated for marine conservation in the area.
  - marine_fauna_disruptions: The monthly count of events that negatively affect marine life, such as pollution or unauthorized sea traffic
  - is_eco_tourism_area: Binary indicator if the area is recognized for eco-tourism
  - fishing_vessels_count: Number of registered fishing vessels operating in the marine area
  - commercial_fishing_restrictions: Categorical rating of the strictness of fishing regulations, from 1 (least strict) to 5 (most strict)
  - fishery_compliance_score: Score from 0 to 100 indicating the compliance level of fisheries with local regulations
  - recent_environmental_violations: A binary indicator where 1 means environmental violations were reported in the past year and 0 means no violations.

Analyse the data and state what you find. Name the variables involved and the direction of any relationship. If the data does not support a finding, say so."""

OUTCOME_ALIASES = (
    "number_of_species",
    "number of species",
    "species found",
)
FACTOR_ALIASES = {
    "tourist activity": (
        "tourist_visits_annual",
        "average_tourist_rating_visibility",
        "tourist activity",
        "tourist visits",
    ),
    "pollution control": (
        "pollution_control_index",
        "pollution control",
    ),
    "eco-tourism": (
        "is_eco_tourism_area",
        "eco_friendly_business_percentile",
        "eco-tourism",
        "eco tourism",
    ),
}
PREFERRED_OUTPUT_KEYS = (
    "final_output",
    "final_text",
    "assistant_message",
    "text",
    "output",
    "result",
)
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")
NO_SUPPORT_PATTERN = (
    r"no (?:supported |clear |reliable )?relationship"
    r"|not supported"
    r"|no evidence"
    r"|cannot determine"
    r"|can't determine"
    r"|could not determine"
    r"|unable to determine"
    r"|unanswerable"
    r"|insufficient variation"
    r"|not enough variation"
    r"|no variation"
    r"|constant"
    r"|degenerate"
    r"|not estimable"
    r"|unable to estimate"
)
POLLUTION_POSITIVE_PATTERN = (
    r"positive(?:ly)? (?:relationship|association)"
    r"|positively related"
    r"|positively associated"
    r"|associated with (?:more|higher)"
    r"|higher .*?(?:more|higher) .*?species"
    r"|increase(?:s|d)? .*?(?:number_of_species|number of species|species found)"
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


def _extract_transcript(simulation_result: SimulationResult) -> tuple[str, str]:
    data = _to_plain_data(simulation_result)
    strings: list[str] = []
    _collect_strings(data, strings)
    blob = "\n".join(strings)

    metadata_transcript = _find_nested_value(data, "agent_transcript")
    if isinstance(metadata_transcript, str) and "TOOL " in metadata_transcript:
        return metadata_transcript, blob

    transcript_candidates = [
        text
        for text in strings
        if "TOOL " in text and ("RESULT:" in text or "ASSISTANT:" in text)
    ]
    transcript = max(transcript_candidates, key=len, default="")
    if not transcript and "TOOL " in blob and "RESULT:" in blob:
        transcript = blob
    return transcript, blob


def _parse_tool_records(transcript: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    buffer: list[str] = []

    def flush() -> None:
        if current is not None:
            current["output"] = "\n".join(buffer).strip()
            records.append(current)

    for raw_line in transcript.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("TOOL "):
            flush()
            name_and_detail = stripped.removeprefix("TOOL ")
            if ":" in name_and_detail:
                name, detail = name_and_detail.split(":", 1)
            else:
                name, detail = name_and_detail, ""
            current = {
                "name": name.strip(),
                "detail": detail.strip(),
                "output": "",
            }
            buffer = []
            continue
        if stripped.startswith("ASSISTANT:"):
            flush()
            current = None
            buffer = []
            continue
        if current is None:
            continue
        if stripped.startswith("RESULT:"):
            buffer.append(stripped.removeprefix("RESULT:").strip())
        else:
            buffer.append(raw_line)

    flush()
    return records


def _record_covers_factor(record: dict[str, str], factor_aliases: tuple[str, ...]) -> bool:
    haystack = f"{record.get('detail', '')}\n{record.get('output', '')}".lower()
    return any(alias in haystack for alias in factor_aliases) and any(
        alias in haystack for alias in OUTCOME_ALIASES
    )


def _shorten(text: str, limit: int = 180) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3] + "..."


def _collect_output_strings(value: Any, sink: list[str]) -> None:
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned and "TOOL " not in cleaned and "RESULT:" not in cleaned:
            sink.append(cleaned)
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


def _normalize_text(text: str) -> str:
    return " ".join(
        text.replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("`", "'")
        .replace("–", "-")
        .replace("—", "-")
        .casefold()
        .split()
    )


def _split_sentences(text: str) -> list[str]:
    parts = []
    for raw_part in SENTENCE_SPLIT_RE.split(text.strip()):
        part = raw_part.strip(" -*#>\t")
        if part:
            parts.append(part)
    return parts


def _sentence_mentions_factor(sentence: str, factor_name: str) -> bool:
    return any(alias in sentence for alias in FACTOR_ALIASES[factor_name])


def _sentence_mentions_outcome(sentence: str) -> bool:
    return any(alias in sentence for alias in OUTCOME_ALIASES)


def _factor_resolution_present(
    sentence: str,
    factor_aliases: tuple[str, ...],
    resolution_pattern: str,
) -> bool:
    for alias in factor_aliases:
        alias_re = re.escape(alias)
        if re.search(
            rf"{alias_re}.{{0,120}}(?:{resolution_pattern})",
            sentence,
        ):
            return True
        if re.search(
            rf"(?:{resolution_pattern}).{{0,120}}{alias_re}",
            sentence,
        ):
            return True
    return False


def _evaluate_factor_coverage(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    transcript, _ = _extract_transcript(simulation_result)
    if not transcript:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Could not locate the run transcript needed to verify whether "
                "tourist activity, pollution control, and eco-tourism were each "
                "checked against `number_of_species` before the answer was given."
            ),
        )

    records = _parse_tool_records(transcript)
    evidence: dict[str, str] = {}
    missing: list[str] = []

    for factor_name, aliases in FACTOR_ALIASES.items():
        matched = None
        for record in records:
            if _record_covers_factor(record, aliases):
                matched = record
                break
        if matched is None:
            missing.append(
                f"{factor_name} ({', '.join(f'`{alias}`' for alias in aliases[:2])})"
            )
            continue
        evidence[factor_name] = _shorten(
            matched.get("detail", "") or matched.get("output", "")
        )

    if missing:
        covered = "; ".join(
            f"{factor}: {snippet}" for factor, snippet in evidence.items()
        ) or "none"
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Every factor named in the research question must be checked "
                "against `number_of_species` before any factor is called "
                "unanswerable or omitted. Missing transcript evidence for "
                + ", ".join(missing)
                + f". Covered evidence: {covered}."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback=(
            "The transcript shows tourist activity, pollution control, and "
            "eco-tourism were each checked against `number_of_species` before "
            "the final answer."
        ),
    )


def _evaluate_plain_conclusion(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    final_answer = _extract_final_answer(simulation_result)
    if not final_answer:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Could not locate the final answer text needed to verify the "
                "required closing conclusion sentence."
            ),
        )

    sentences = _split_sentences(final_answer)
    if not sentences:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The final answer did not contain a readable conclusion sentence."
            ),
        )

    best_candidate = ""
    best_issues: list[str] | None = None

    for candidate in sentences[-2:]:
        normalized = _normalize_text(candidate)
        issues: list[str] = []

        if not _sentence_mentions_outcome(normalized):
            issues.append("the closing sentence does not explicitly name `number_of_species` or number of species")
        for factor_name in FACTOR_ALIASES:
            if not _sentence_mentions_factor(normalized, factor_name):
                issues.append(f"the closing sentence does not mention {factor_name}")

        if not _factor_resolution_present(
            normalized,
            FACTOR_ALIASES["pollution control"],
            POLLUTION_POSITIVE_PATTERN,
        ):
            issues.append(
                "the closing sentence does not state that pollution control is positively related to number of species"
            )

        for factor_name in ("tourist activity", "eco-tourism"):
            if not _factor_resolution_present(
                normalized,
                FACTOR_ALIASES[factor_name],
                NO_SUPPORT_PATTERN,
            ):
                issues.append(
                    f"the closing sentence does not clearly state that {factor_name} has no supported or estimable relationship"
                )

        if best_issues is None or len(issues) < len(best_issues):
            best_candidate = candidate
            best_issues = issues

    if best_issues:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The answer must close with one plain conclusion sentence near "
                "the end that names each factor and commits to its relationship "
                "form. Observed closing sentence: "
                f"`{_shorten(best_candidate, 220)}`. "
                + "; ".join(best_issues)
                + "."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback=(
            "The answer ends with one clear conclusion sentence that names all "
            "three factors, states pollution control is positively related to "
            "`number_of_species`, and preserves honest no-support conclusions "
            "for tourist activity and eco-tourism."
        ),
    )


environment = RELAIEnvironment(
    id="discoverybench-state-the-finding",
    name="Marine Factors Need Full Coverage",
    description="Tests that a marine-conservation analysis checks every named factor and ends with one plain conclusion sentence.",
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
            id="factor-coverage-before-conclusion",
            description="Checks that tourist activity, pollution control, and eco-tourism are each tested against `number_of_species` in the run transcript.",
            evaluate=_evaluate_factor_coverage,
        ),
        CodeEvaluator(
            id="one-plain-closing-conclusion",
            description="Checks that the answer ends with one plain conclusion sentence that names every factor and gives the expected relationship form.",
            evaluate=_evaluate_plain_conclusion,
        ),
    ],
)
