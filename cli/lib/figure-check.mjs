import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const FIGURE_EXTENSIONS = new Set([".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const SIDECAR_SUFFIX = ".agentscience-figure-check.json";

function isFigurePath(filePath) {
  return FIGURE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function walkFiles(rootDir) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const entries = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walkFiles(absolutePath));
    } else if (entry.isFile()) {
      entries.push(absolutePath);
    }
  }
  return entries;
}

function collectFigurePaths({ workspaceDir, explicitFigures = [] }) {
  if (explicitFigures.length > 0) {
    return explicitFigures.map((figurePath) => {
      const cwdResolved = resolve(figurePath);
      return existsSync(cwdResolved) ? cwdResolved : resolve(workspaceDir, figurePath);
    });
  }

  return walkFiles(join(workspaceDir, "figures"))
    .filter(isFigurePath)
    .sort((left, right) => left.localeCompare(right));
}

function normalizeIssue(issue, fallbackSeverity = "error") {
  if (typeof issue === "string") {
    return {
      code: "figure_issue",
      severity: fallbackSeverity,
      message: issue,
    };
  }

  if (issue && typeof issue === "object") {
    return {
      code: typeof issue.code === "string" ? issue.code : "figure_issue",
      severity: issue.severity === "warning" ? "warning" : fallbackSeverity,
      message: typeof issue.message === "string" ? issue.message : JSON.stringify(issue),
      ...issue,
    };
  }

  return {
    code: "figure_issue",
    severity: fallbackSeverity,
    message: String(issue),
  };
}

function loadSidecar(figurePath) {
  const sidecarPath = `${figurePath}${SIDECAR_SUFFIX}`;
  if (!existsSync(sidecarPath)) {
    return {
      path: sidecarPath,
      present: false,
      issues: [],
      warnings: [
        {
          code: "missing_source_qa",
          severity: "warning",
          message:
            "No source-aware figure QA sidecar found. Save Matplotlib figures through code/agentscience_figures.py to catch text overlap before publish.",
        },
      ],
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(sidecarPath, "utf8"));
    return {
      path: sidecarPath,
      present: true,
      ok: parsed?.ok === true,
      issues: (parsed?.issues ?? []).map((issue) => normalizeIssue(issue, "error")),
      warnings: (parsed?.warnings ?? []).map((issue) => normalizeIssue(issue, "warning")),
    };
  } catch (error) {
    return {
      path: sidecarPath,
      present: true,
      ok: false,
      issues: [
        {
          code: "invalid_sidecar",
          severity: "error",
          message: `Could not parse figure QA sidecar: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        },
      ],
      warnings: [],
    };
  }
}

function parsePngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3 && offset + 8 < buffer.length) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function parseWebpDimensions(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  const type = buffer.toString("ascii", 12, 16);
  if (type === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (type === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (type === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

function parseSvgDimensions(text) {
  const widthMatch = text.match(/\bwidth=["']?([0-9.]+)(?:px)?["']?/i);
  const heightMatch = text.match(/\bheight=["']?([0-9.]+)(?:px)?["']?/i);
  if (widthMatch && heightMatch) {
    return {
      width: Number(widthMatch[1]),
      height: Number(heightMatch[1]),
    };
  }

  const viewBoxMatch = text.match(/\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
  if (viewBoxMatch) {
    return {
      width: Number(viewBoxMatch[1]),
      height: Number(viewBoxMatch[2]),
    };
  }
  return null;
}

function readFigureDimensions(figurePath) {
  const extension = extname(figurePath).toLowerCase();
  const buffer = readFileSync(figurePath);
  if (extension === ".png") {
    return parsePngDimensions(buffer);
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return parseJpegDimensions(buffer);
  }
  if (extension === ".webp") {
    return parseWebpDimensions(buffer);
  }
  if (extension === ".svg") {
    return parseSvgDimensions(buffer.toString("utf8"));
  }
  return null;
}

function findPython(workspaceDir) {
  const candidates = [
    process.env.AGENTSCIENCE_MANAGED_PYTHON_PATH,
    process.platform === "win32"
      ? join(workspaceDir, ".venv", "Scripts", "python.exe")
      : join(workspaceDir, ".venv", "bin", "python"),
    "python3",
    "python",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      stdio: "pipe",
    });
    if (result.status === 0) {
      return candidate;
    }
  }

  return null;
}

const RASTER_ANALYSIS_SCRIPT = String.raw`
import json
import sys

try:
    from PIL import Image
except Exception as error:
    print(json.dumps({"ok": False, "error": "pillow_unavailable", "message": str(error)}))
    raise SystemExit(0)

def background_rgba(image):
    width, height = image.size
    samples = [
        image.getpixel((0, 0)),
        image.getpixel((width - 1, 0)),
        image.getpixel((0, height - 1)),
        image.getpixel((width - 1, height - 1)),
    ]
    return tuple(sorted(channel)[len(channel) // 2] for channel in zip(*samples))

def pixel_distance(left, right):
    return abs(left[0] - right[0]) + abs(left[1] - right[1]) + abs(left[2] - right[2]) + abs(left[3] - right[3])

def analyze(path):
    issues = []
    warnings = []
    try:
        image = Image.open(path).convert("RGBA")
    except Exception as error:
        return {"path": path, "issues": [{"code": "image_unreadable", "severity": "error", "message": f"Could not read saved figure image: {error}"}], "warnings": []}

    width, height = image.size
    if width < 600 or height < 400:
        warnings.append({"code": "small_figure", "severity": "warning", "message": f"Figure is only {width}x{height}px; text may be hard to inspect in the paper viewer.", "width": width, "height": height})

    background = background_rgba(image)
    background_luma = 0.2126 * background[0] + 0.7152 * background[1] + 0.0722 * background[2]
    min_x, min_y = width, height
    max_x, max_y = -1, -1
    dark_rows = [0 for _ in range(height)]

    for y in range(height):
        dark = 0
        for x in range(width):
            pixel = image.getpixel((x, y))
            if pixel[3] > 16 and pixel_distance(pixel, background) > 32:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
            luma = 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2]
            if pixel[3] > 32 and luma < min(210, background_luma - 35):
                dark += 1
        dark_rows[y] = dark

    if max_x < 0:
        issues.append({"code": "blank_figure", "severity": "error", "message": "Figure appears blank or indistinguishable from its background."})
        return {"path": path, "width": width, "height": height, "issues": issues, "warnings": warnings}

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
            issues.append({"code": "content_touches_edge", "severity": "error", "message": f"Figure content touches the {edge} edge; labels or annotations may be clipped.", "edge": edge, "marginPx": margin})
        elif margin <= soft_margin:
            warnings.append({"code": "low_edge_margin", "severity": "warning", "message": f"Figure content is very close to the {edge} edge ({margin}px margin).", "edge": edge, "marginPx": margin})

    threshold = max(6, int(width * 0.006))
    bands = []
    start = None
    top_limit = max(1, int(height * 0.28))
    for y, count in enumerate(dark_rows[:top_limit]):
        if count >= threshold and start is None:
            start = y
        elif count < threshold and start is not None:
            if y - start >= 2:
                bands.append((start, y - 1))
            start = None
    if start is not None:
        bands.append((start, top_limit))
    for left, right in zip(bands, bands[1:]):
        gap = right[0] - left[1] - 1
        if gap <= max(3, int(height * 0.008)):
            issues.append({"code": "crowded_top_text", "severity": "error", "message": "Top text bands are crowded; suptitle, subplot titles, or annotations may be overlapping.", "gapPx": gap})
            break

    return {"path": path, "width": width, "height": height, "issues": issues, "warnings": warnings}

paths = json.load(sys.stdin)
print(json.dumps({"ok": True, "figures": [analyze(path) for path in paths]}))
`;

function runRasterAnalysis(workspaceDir, figurePaths) {
  const rasterPaths = figurePaths.filter((figurePath) =>
    [".png", ".jpg", ".jpeg", ".webp"].includes(extname(figurePath).toLowerCase()),
  );
  if (rasterPaths.length === 0) {
    return new Map();
  }

  const python = findPython(workspaceDir);
  if (!python) {
    return new Map(
      rasterPaths.map((figurePath) => [
        figurePath,
        {
          issues: [],
          warnings: [
            {
              code: "python_unavailable",
              severity: "warning",
              message: "Saved-image edge validation skipped because Python is unavailable.",
            },
          ],
        },
      ]),
    );
  }

  const result = spawnSync(python, ["-c", RASTER_ANALYSIS_SCRIPT], {
    input: JSON.stringify(rasterPaths),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    return new Map(
      rasterPaths.map((figurePath) => [
        figurePath,
        {
          issues: [],
          warnings: [
            {
              code: "raster_analysis_failed",
              severity: "warning",
              message: `Saved-image edge validation failed: ${result.stderr || result.stdout || "unknown error"}`,
            },
          ],
        },
      ]),
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return new Map();
  }

  if (!parsed.ok && parsed.error === "pillow_unavailable") {
    return new Map(
      rasterPaths.map((figurePath) => [
        figurePath,
        {
          issues: [],
          warnings: [
            {
              code: "pillow_unavailable",
              severity: "warning",
              message: "Saved-image edge validation skipped because Pillow is unavailable.",
            },
          ],
        },
      ]),
    );
  }

  return new Map(
    (parsed.figures ?? []).map((entry) => [
      entry.path,
      {
        width: entry.width,
        height: entry.height,
        issues: (entry.issues ?? []).map((issue) => normalizeIssue(issue, "error")),
        warnings: (entry.warnings ?? []).map((issue) => normalizeIssue(issue, "warning")),
      },
    ]),
  );
}

function checkSvgText(figurePath) {
  const warnings = [];
  const text = readFileSync(figurePath, "utf8");
  if (!/\bviewBox=|\bwidth=/.test(text)) {
    warnings.push({
      code: "svg_missing_dimensions",
      severity: "warning",
      message: "SVG does not declare dimensions or a viewBox; paper layout may be unpredictable.",
    });
  }
  if (!/<text\b/i.test(text)) {
    warnings.push({
      code: "svg_text_not_inspectable",
      severity: "warning",
      message: "SVG has no inspectable text nodes; overlap checks are limited to image-level validation.",
    });
  }
  return { issues: [], warnings };
}

export async function checkWorkspaceFigures({ workspaceDir, explicitFigures = [] }) {
  const resolvedWorkspace = resolve(workspaceDir);
  const figurePaths = collectFigurePaths({ workspaceDir: resolvedWorkspace, explicitFigures });
  const rasterResults = runRasterAnalysis(resolvedWorkspace, figurePaths);

  const figures = figurePaths.map((figurePath) => {
    const issues = [];
    const warnings = [];
    let dimensions = null;

    if (!existsSync(figurePath)) {
      issues.push({
        code: "figure_missing",
        severity: "error",
        message: `Figure file not found: ${figurePath}`,
      });
    } else if (!statSync(figurePath).isFile()) {
      issues.push({
        code: "figure_not_file",
        severity: "error",
        message: `Figure path is not a file: ${figurePath}`,
      });
    } else {
      try {
        dimensions = readFigureDimensions(figurePath);
      } catch (error) {
        warnings.push({
          code: "dimension_read_failed",
          severity: "warning",
          message: `Could not read figure dimensions: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        });
      }
      if (!dimensions) {
        warnings.push({
          code: "unknown_dimensions",
          severity: "warning",
          message: "Could not determine figure dimensions.",
        });
      }

      const sidecar = loadSidecar(figurePath);
      issues.push(...sidecar.issues);
      warnings.push(...sidecar.warnings);

      const rasterResult =
        extname(figurePath).toLowerCase() === ".svg"
          ? checkSvgText(figurePath)
          : rasterResults.get(figurePath);
      if (rasterResult) {
        issues.push(...(rasterResult.issues ?? []));
        warnings.push(...(rasterResult.warnings ?? []));
        if (!dimensions && rasterResult.width && rasterResult.height) {
          dimensions = {
            width: rasterResult.width,
            height: rasterResult.height,
          };
        }
      }
    }

    return {
      path: relative(resolvedWorkspace, figurePath).replace(/\\/g, "/"),
      fileName: basename(figurePath),
      dimensions,
      ok: issues.length === 0,
      issues,
      warnings,
    };
  });

  return {
    ok: figures.every((figure) => figure.ok),
    workspace: resolvedWorkspace,
    figureCount: figures.length,
    figures,
  };
}
