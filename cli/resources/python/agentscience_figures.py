"""AgentScience figure helpers.

Use this module from paper workspace plotting scripts to save Matplotlib figures
with source-aware layout validation. The helper writes a JSON sidecar next to
each saved figure so `agentscience research check-figures` can report concrete
layout failures before presentation or publish.
"""

from __future__ import annotations

import json
import math
import textwrap
from pathlib import Path
from typing import Any, Iterable


class FigureLayoutError(RuntimeError):
    """Raised when a figure fails AgentScience layout validation."""

    def __init__(self, issues: list[dict[str, Any]]):
        self.issues = issues
        super().__init__("AgentScience figure layout check failed: " + "; ".join(issue["message"] for issue in issues[:3]))


def wrap_text(value: str | None, width: int = 64) -> str | None:
    if value is None:
        return None
    return "\n".join(textwrap.wrap(str(value), width=width, break_long_words=False)) or str(value)


def figure_size_for(
    *,
    rows: int = 1,
    cols: int = 1,
    categories: int = 0,
    max_label_chars: int = 0,
    base_width: float = 4.2,
    base_height: float = 3.2,
) -> tuple[float, float]:
    width = max(base_width * cols, 4.8 + 0.055 * max_label_chars)
    height = max(base_height * rows, 2.8 + 0.34 * categories)
    return (min(width, 14.0), min(height, 12.0))


def subplots(*args: Any, **kwargs: Any):
    """Create Matplotlib subplots with safe AgentScience defaults."""

    import matplotlib.pyplot as plt

    kwargs.setdefault("layout", "constrained")
    return plt.subplots(*args, **kwargs)


def apply_labels(
    ax: Any,
    *,
    title: str | None = None,
    xlabel: str | None = None,
    ylabel: str | None = None,
    title_width: int = 54,
    label_width: int = 64,
) -> None:
    if title is not None:
        ax.set_title(wrap_text(title, title_width))
    if xlabel is not None:
        ax.set_xlabel(wrap_text(xlabel, label_width))
    if ylabel is not None:
        ax.set_ylabel(wrap_text(ylabel, label_width))


def _bbox_to_dict(box: Any) -> dict[str, float]:
    return {
        "x0": float(box.x0),
        "y0": float(box.y0),
        "x1": float(box.x1),
        "y1": float(box.y1),
        "width": float(box.width),
        "height": float(box.height),
    }


def _intersection_area(left: Any, right: Any) -> float:
    x0 = max(left.x0, right.x0)
    y0 = max(left.y0, right.y0)
    x1 = min(left.x1, right.x1)
    y1 = min(left.y1, right.y1)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    return float((x1 - x0) * (y1 - y0))


def _short_text(value: str, limit: int = 72) -> str:
    compact = " ".join(str(value).split())
    return compact if len(compact) <= limit else compact[: limit - 1] + "..."


def validate_matplotlib_figure(fig: Any, *, overlap_px: float = 2.0) -> list[dict[str, Any]]:
    """Return source-aware Matplotlib layout issues for a live figure."""

    import matplotlib.text as mtext

    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    figure_box = fig.bbox
    issues: list[dict[str, Any]] = []
    text_entries: list[dict[str, Any]] = []

    for text in fig.findobj(match=mtext.Text):
        value = text.get_text()
        if not text.get_visible() or not value or not str(value).strip():
            continue
        box = text.get_window_extent(renderer=renderer)
        if not math.isfinite(box.width) or not math.isfinite(box.height) or box.width <= 0 or box.height <= 0:
            continue
        label = _short_text(value)
        if box.x0 < figure_box.x0 - overlap_px or box.y0 < figure_box.y0 - overlap_px or box.x1 > figure_box.x1 + overlap_px or box.y1 > figure_box.y1 + overlap_px:
            issues.append(
                {
                    "code": "text_outside_canvas",
                    "severity": "error",
                    "message": f'Text "{label}" extends outside the Matplotlib canvas.',
                    "text": label,
                    "bbox": _bbox_to_dict(box),
                }
            )
        text_entries.append({"text": label, "bbox": box})

    for index, left in enumerate(text_entries):
        for right in text_entries[index + 1 :]:
            area = _intersection_area(left["bbox"], right["bbox"])
            if area <= overlap_px * overlap_px:
                continue
            smaller = min(
                max(left["bbox"].width * left["bbox"].height, 1.0),
                max(right["bbox"].width * right["bbox"].height, 1.0),
            )
            if area / smaller < 0.08:
                continue
            issues.append(
                {
                    "code": "text_overlap",
                    "severity": "error",
                    "message": f'Text "{left["text"]}" overlaps "{right["text"]}".',
                    "texts": [left["text"], right["text"]],
                    "overlapAreaPx": area,
                }
            )
            if len(issues) >= 24:
                return issues

    return issues


def _background_rgba(image: Any) -> tuple[int, int, int, int]:
    width, height = image.size
    sample_points = [
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
    ]
    samples = [image.getpixel(point) for point in sample_points]
    return tuple(sorted(channel)[len(channel) // 2] for channel in zip(*samples))  # type: ignore[return-value]


def _pixel_distance(left: tuple[int, int, int, int], right: tuple[int, int, int, int]) -> int:
    return abs(left[0] - right[0]) + abs(left[1] - right[1]) + abs(left[2] - right[2]) + abs(left[3] - right[3])


def validate_saved_image(path: str | Path) -> list[dict[str, Any]]:
    """Return raster-level issues for a saved image when Pillow is available."""

    issues: list[dict[str, Any]] = []
    try:
        from PIL import Image
    except Exception:
        return [
            {
                "code": "pillow_unavailable",
                "severity": "warning",
                "message": "Saved-image edge validation skipped because Pillow is unavailable.",
            }
        ]

    image_path = Path(path)
    try:
        image = Image.open(image_path).convert("RGBA")
    except Exception as error:
        return [
            {
                "code": "image_unreadable",
                "severity": "error",
                "message": f"Could not read saved figure image: {error}",
            }
        ]

    width, height = image.size
    if width < 600 or height < 400:
        issues.append(
            {
                "code": "small_figure",
                "severity": "warning",
                "message": f"Figure is only {width}x{height}px; text may be hard to inspect in the paper viewer.",
                "width": width,
                "height": height,
            }
        )

    background = _background_rgba(image)
    min_x, min_y = width, height
    max_x, max_y = -1, -1
    dark_rows = [0 for _ in range(height)]
    background_luma = 0.2126 * background[0] + 0.7152 * background[1] + 0.0722 * background[2]

    for y in range(height):
        row_dark = 0
        for x in range(width):
            pixel = image.getpixel((x, y))
            if pixel[3] > 16 and _pixel_distance(pixel, background) > 32:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
            luma = 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2]
            if pixel[3] > 32 and luma < min(210, background_luma - 35):
                row_dark += 1
        dark_rows[y] = row_dark

    if max_x < 0:
        issues.append(
            {
                "code": "blank_figure",
                "severity": "error",
                "message": "Figure appears blank or indistinguishable from its background.",
            }
        )
        return issues

    hard_margin = max(2, int(min(width, height) * 0.004))
    soft_margin = max(8, int(min(width, height) * 0.015))
    edges = {
        "left": min_x,
        "top": min_y,
        "right": width - 1 - max_x,
        "bottom": height - 1 - max_y,
    }
    for edge, margin in edges.items():
        if margin <= hard_margin:
            issues.append(
                {
                    "code": "content_touches_edge",
                    "severity": "error",
                    "message": f"Figure content touches the {edge} edge; labels or annotations may be clipped.",
                    "edge": edge,
                    "marginPx": margin,
                }
            )
        elif margin <= soft_margin:
            issues.append(
                {
                    "code": "low_edge_margin",
                    "severity": "warning",
                    "message": f"Figure content is very close to the {edge} edge ({margin}px margin).",
                    "edge": edge,
                    "marginPx": margin,
                }
            )

    threshold = max(6, int(width * 0.006))
    bands: list[tuple[int, int]] = []
    start: int | None = None
    for y, count in enumerate(dark_rows[: max(1, int(height * 0.28))]):
        if count >= threshold and start is None:
            start = y
        elif count < threshold and start is not None:
            if y - start >= 2:
                bands.append((start, y - 1))
            start = None
    if start is not None:
        bands.append((start, int(height * 0.28)))

    for left, right in zip(bands, bands[1:]):
        gap = right[0] - left[1] - 1
        if gap <= max(3, int(height * 0.008)):
            issues.append(
                {
                    "code": "crowded_top_text",
                    "severity": "error",
                    "message": "Top text bands are crowded; suptitle, subplot titles, or annotations may be overlapping.",
                    "gapPx": gap,
                }
            )
            break

    return issues


def save_figure(
    fig: Any,
    path: str | Path,
    *,
    dpi: int = 300,
    bbox_inches: str = "tight",
    pad_inches: float = 0.15,
    fail_on_issue: bool = True,
    extra_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Validate and save a Matplotlib figure with an AgentScience QA sidecar."""

    figure_path = Path(path)
    figure_path.parent.mkdir(parents=True, exist_ok=True)
    issues = validate_matplotlib_figure(fig)

    if not issues:
        fig.savefig(figure_path, dpi=dpi, bbox_inches=bbox_inches, pad_inches=pad_inches)
        issues = validate_saved_image(figure_path)

    report = {
        "version": 1,
        "source": "agentscience_figures.py",
        "ok": not any(issue.get("severity") == "error" for issue in issues),
        "path": str(figure_path),
        "issues": [issue for issue in issues if issue.get("severity") == "error"],
        "warnings": [issue for issue in issues if issue.get("severity") != "error"],
        "metadata": extra_metadata or {},
    }
    sidecar_path = Path(str(figure_path) + ".agentscience-figure-check.json")
    sidecar_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if fail_on_issue and report["issues"]:
        raise FigureLayoutError(report["issues"])

    return report
