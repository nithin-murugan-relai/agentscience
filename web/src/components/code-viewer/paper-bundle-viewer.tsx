"use client";

import { useState, useCallback, useEffect } from "react";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

type BundleTab = "code" | "figures" | "pdf";

type ArtifactEntry = {
  id: string;
  kind: string;
  path: string;
  contentType: string;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
  textContent: string | null;
};

type FigureEntry = {
  id: string;
  fileName: string;
  caption: string | null;
  downloadUrl: string;
  mimeType: string;
};

type TreeNode = {
  directories: Map<string, TreeNode>;
  files: ArtifactEntry[];
};

function createTreeNode(): TreeNode {
  return {
    directories: new Map(),
    files: [],
  };
}

function buildArtifactTree(artifacts: ArtifactEntry[]) {
  const root = createTreeNode();

  for (const artifact of artifacts) {
    const segments = artifact.path.split("/").filter(Boolean);
    const fileName = segments.pop();

    if (!fileName) {
      continue;
    }

    let current = root;
    for (const segment of segments) {
      if (!current.directories.has(segment)) {
        current.directories.set(segment, createTreeNode());
      }
      current = current.directories.get(segment) as TreeNode;
    }
    current.files.push(artifact);
  }

  return root;
}

function artifactLanguageFromPath(filePath: string) {
  const extension = filePath.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "bib":
      return "bibtex";
    case "java":
      return "java";
    case "jl":
      return "julia";
    case "js":
      return "javascript";
    case "json":
    case "jsonl":
      return "json";
    case "md":
      return "markdown";
    case "py":
      return "python";
    case "r":
      return "r";
    case "rb":
      return "ruby";
    case "rs":
      return "rust";
    case "sh":
      return "bash";
    case "sql":
      return "sql";
    case "tex":
      return "latex";
    case "toml":
      return "toml";
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "yaml":
    case "yml":
      return "yaml";
    case "css":
      return "css";
    case "html":
      return "html";
    default:
      return "text";
  }
}

function isProseFile(filePath: string) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ext === "md" || ext === "txt" || ext === "log";
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function looksLikeCsv(artifact: ArtifactEntry) {
  return artifact.path.toLowerCase().endsWith(".csv") || artifact.contentType === "text/csv";
}

function parseCsvPreview(value: string) {
  return value
    .trim()
    .split(/\r?\n/)
    .slice(0, 12)
    .map((row) => row.split(",").slice(0, 8));
}

/* ── file icon helper ──────────────────────────────────────── */

function fileIcon(filePath: string) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py":
      return (
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[#3572A5]" fill="currentColor">
          <path d="M7.938 0C4.898 0 4.292.573 4.292 2.354v1.73h3.73v.577H2.923C1.085 4.661 0 5.824 0 8.021c0 2.197.896 3.36 2.923 3.36h1.73v-2.083c0-1.442.67-2.354 2.354-2.354h3.646c1.442 0 2.354-.573 2.354-2.354V2.354C13 .573 12.343 0 9.646 0H7.938zM5.77 1.384a.72.72 0 11.001 1.44.72.72 0 010-1.44z" />
          <path d="M12.347 4.661v2.083c0 1.442-.67 2.354-2.354 2.354H6.347c-1.442 0-2.354.573-2.354 2.354v2.236C3.993 15.427 4.65 16 7.347 16h1.646C12.095 16 12.7 15.427 12.7 13.646v-1.73H8.97v-.577h5.099C15.907 11.339 17 10.176 17 7.979c0-2.197-.896-3.36-2.923-3.36h-1.73zm-2.116 7.955a.72.72 0 110 1.44.72.72 0 010-1.44z" />
        </svg>
      );
    case "tex":
      return (
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[#008080]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 2h5l3 3v9H4V2z" />
          <path d="M6 8h4M6 10.5h4" />
        </svg>
      );
    case "json":
    case "jsonl":
      return (
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[#cb8a04]" fill="currentColor">
          <path d="M4.5 3C3.12 3 2 4.12 2 5.5v1c0 .83-.67 1.5-1.5 1.5v1c.83 0 1.5.67 1.5 1.5v1C2 12.88 3.12 14 4.5 14h1v-1.5h-1a1 1 0 01-1-1V10a2 2 0 00-.75-1.56L2.5 8.25l.25-.19A2 2 0 003.5 6.5V5a1 1 0 011-1h1V2.5h-1zM11.5 3C12.88 3 14 4.12 14 5.5v1c0 .83.67 1.5 1.5 1.5v1c-.83 0-1.5.67-1.5 1.5v1c0 1.38-1.12 2.5-2.5 2.5h-1v-1.5h1a1 1 0 001-1V10a2 2 0 01.75-1.56l.25-.19-.25-.19A2 2 0 0112.5 6.5V5a1 1 0 00-1-1h-1V2.5h1z" />
        </svg>
      );
    case "md":
      return (
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[#519aba]" fill="currentColor">
          <path d="M14 3H2a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1zM3.5 10.5v-5l2 2.5 2-2.5v5m2-5h2l-1.5 2.5h1.5l-2 2.5" />
        </svg>
      );
    case "bib":
      return (
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[#a0522d]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="1.5" width="12" height="13" rx="1.5" />
          <path d="M5.5 5h5M5.5 8h5M5.5 11h3" />
        </svg>
      );
    case "pdf":
      return (
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[#e34c26]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 2h5l3 3v9H4V2z" />
          <path d="M6 7.5h4" />
        </svg>
      );
    case "csv":
      return (
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[#4caf50]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <path d="M2 6h12M2 10h12M6 2v12M10 2v12" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 2h5l3 3v9H4V2z" />
        </svg>
      );
  }
}

/* ── collapsible directory ──────────────────────────────────── */

function DirectoryGroup({
  name,
  children,
  depth,
  defaultOpen = true,
}: {
  name: string;
  children: React.ReactNode;
  depth: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-1 text-[11px] uppercase tracking-[0.06em] text-ink-faint transition-colors hover:text-ink-light"
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <svg
          viewBox="0 0 10 10"
          className={`h-2.5 w-2.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          fill="currentColor"
        >
          <path d="M3 1l4 4-4 4z" />
        </svg>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-ink-faint" fill="currentColor">
          <path d="M1.5 2A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5V5.5A1.5 1.5 0 0014.5 4H8L6.5 2z" />
        </svg>
        {name}
      </button>
      {open && children}
    </div>
  );
}

/* ── sidebar tree ──────────────────────────────────────────── */

function renderTree(
  node: TreeNode,
  currentPath: string,
  selectedId: string,
  onSelect: (artifactId: string) => void,
  depth = 0
): React.ReactNode[] {
  const directoryEntries = [...node.directories.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const fileEntries = [...node.files].sort((left, right) => left.path.localeCompare(right.path));
  const children: React.ReactNode[] = [];

  for (const [name, childNode] of directoryEntries) {
    const nextPath = currentPath ? `${currentPath}/${name}` : name;
    children.push(
      <DirectoryGroup key={`dir-${nextPath}`} name={name} depth={depth}>
        {renderTree(childNode, nextPath, selectedId, onSelect, depth + 1)}
      </DirectoryGroup>
    );
  }

  for (const artifact of fileEntries) {
    const selected = artifact.id === selectedId;
    const fileName = artifact.path.split("/").at(-1) ?? artifact.path;
    children.push(
      <button
        key={artifact.id}
        type="button"
        onClick={() => onSelect(artifact.id)}
        className={`group flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-[5px] text-left text-[13px] transition-colors ${
          selected
            ? "bg-snow-white-dark text-ink"
            : "text-ink-light hover:bg-snow-white-dark/60 hover:text-ink"
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        {fileIcon(fileName)}
        <span className="truncate">{fileName}</span>
      </button>
    );
  }

  return children;
}

/* ── main component ─────────────────────────────────────────── */

export function PaperBundleViewer({
  artifacts,
  figures,
  pdfUrl,
  paperTitle,
  initialTab,
}: {
  artifacts: ArtifactEntry[];
  figures: FigureEntry[];
  pdfUrl: string | null;
  paperTitle: string;
  initialTab: BundleTab;
}) {
  const [activeTab, setActiveTab] = useState<BundleTab>(initialTab);
  const [selectedArtifactId, setSelectedArtifactId] = useState(artifacts[0]?.id ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedFigureId, setExpandedFigureId] = useState<string | null>(null);
  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null;
  const tree = buildArtifactTree(artifacts);
  const tabs: Array<{ id: BundleTab; label: string; disabled: boolean }> = [
    { id: "code", label: "Code", disabled: artifacts.length === 0 },
    { id: "figures", label: "Figures", disabled: figures.length === 0 },
    { id: "pdf", label: "PDF", disabled: !pdfUrl },
  ];

  /* close sidebar on small screens by default */
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const handleSelectArtifact = useCallback((artifactId: string) => {
    setSelectedArtifactId(artifactId);
  }, []);

  const shouldWrap = selectedArtifact ? isProseFile(selectedArtifact.path) : false;

  return (
    <section id="bundle" className="border-t border-rule py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-ink">
            Research Bundle
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-light">
            Browse the uploaded workspace directly on Agent Science. Code, figures, and the compiled
            paper stay attached to the publication instead of living in an external repo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 font-[family-name:var(--font-mono)] text-xs text-ink-faint">
          <span className="rounded-[var(--radius-sm)] border border-rule px-3 py-1">
            {artifacts.length} code artifacts
          </span>
          <span className="rounded-[var(--radius-sm)] border border-rule px-3 py-1">
            {figures.length} figures
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-[var(--radius-sm)] px-4 py-2 text-sm ${
              activeTab === tab.id
                ? "bg-ink text-snow-white"
                : "border border-rule text-ink-light hover:border-ink-faint hover:text-ink"
            } ${tab.disabled ? "cursor-not-allowed opacity-40" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "code" ? (
        artifacts.length === 0 ? (
          <div className="mt-6 rounded-[var(--radius-md)] border border-dashed border-rule px-6 py-12 text-sm text-ink-light">
            No code artifacts were uploaded with this paper.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-rule bg-snow-white">
            {/* toolbar */}
            <div className="flex items-center justify-between border-b border-rule bg-snow-white-dark px-2 py-1.5">
              <div className="flex min-w-0 items-center gap-1">
                {/* sidebar toggle */}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="shrink-0 rounded-[var(--radius-sm)] p-1.5 text-ink-faint transition-colors hover:bg-snow-white hover:text-ink-light"
                  title={sidebarOpen ? "Hide file explorer" : "Show file explorer"}
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                    <path d="M1 3.5A1.5 1.5 0 012.5 2h11A1.5 1.5 0 0115 3.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zM2.5 3a.5.5 0 00-.5.5v9a.5.5 0 00.5.5H6V3H2.5zM7 3v10h6.5a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5H7z" />
                  </svg>
                </button>

                {/* breadcrumb path */}
                {selectedArtifact && (
                  <div className="flex min-w-0 items-center gap-0.5 px-1 text-[13px]">
                    {selectedArtifact.path.split("/").map((segment, i, arr) => (
                      <span key={i} className="flex shrink-0 items-center gap-0.5">
                        {i > 0 && <span className="text-ink-faint">/</span>}
                        <span className={i === arr.length - 1 ? "text-ink" : "text-ink-faint"}>
                          {segment}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2 pl-2">
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-ink-faint">
                  {selectedArtifact ? formatBytes(selectedArtifact.sizeBytes) : null}
                </span>
                {selectedArtifact && (
                  <a
                    href={selectedArtifact.downloadUrl}
                    className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-rule bg-snow-white px-2.5 py-1 text-xs text-ink transition-colors hover:bg-snow-white-dark"
                  >
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" />
                    </svg>
                    Download
                  </a>
                )}
              </div>
            </div>

            <div className="flex" style={{ height: "clamp(480px, 70vh, 800px)" }}>
              {/* sidebar */}
              {sidebarOpen && (
                <aside
                  className="flex w-56 shrink-0 flex-col border-r border-rule bg-snow-white-dark lg:w-60"
                >
                  <div className="flex-1 overflow-y-auto overscroll-contain px-1.5 py-2">
                    {renderTree(tree, "", selectedArtifact?.id ?? "", handleSelectArtifact)}
                  </div>
                </aside>
              )}

              {/* code pane */}
              <div className="flex min-w-0 flex-1 flex-col overflow-auto">
                {selectedArtifact?.textContent ? (
                  looksLikeCsv(selectedArtifact) ? (
                    <div className="p-4">
                      <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                        CSV preview (first 12 rows)
                      </div>
                      <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-rule">
                        <table className="min-w-full text-left font-[family-name:var(--font-mono)] text-[13px]">
                          <tbody>
                            {parseCsvPreview(selectedArtifact.textContent).map((row, rowIndex) => (
                              <tr
                                key={`${selectedArtifact.id}-${rowIndex}`}
                                className={
                                  rowIndex === 0
                                    ? "bg-snow-white-dark text-ink"
                                    : "border-t border-rule text-ink-light"
                                }
                              >
                                {row.map((cell, cellIndex) => (
                                  <td key={`${rowIndex}-${cellIndex}`} className="whitespace-nowrap px-3 py-2 text-xs">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <SyntaxHighlighter
                      language={artifactLanguageFromPath(selectedArtifact.path)}
                      style={oneLight}
                      showLineNumbers
                      wrapLongLines={shouldWrap}
                      customStyle={{
                        margin: 0,
                        padding: "12px 0",
                        background: "#F5F2ED",
                        fontSize: "13px",
                        lineHeight: "1.6",
                        minHeight: "100%",
                      }}
                      lineNumberStyle={{
                        minWidth: "3rem",
                        paddingRight: "1rem",
                        color: "#B5AFA8",
                        textAlign: "right",
                        userSelect: "none",
                      }}
                      codeTagProps={{
                        style: {
                          fontFamily:
                            "var(--font-mono), 'IBM Plex Mono', 'Menlo', monospace",
                          ...(shouldWrap
                            ? { whiteSpace: "pre-wrap", wordBreak: "break-word" }
                            : {}),
                        },
                      }}
                    >
                      {selectedArtifact.textContent}
                    </SyntaxHighlighter>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-faint">
                    <div>
                      <svg viewBox="0 0 24 24" className="mx-auto mb-3 h-8 w-8 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Binary file — download to view locally
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : null}

      {activeTab === "figures" ? (
        figures.length === 0 ? (
          <div className="mt-6 rounded-[var(--radius-md)] border border-dashed border-rule px-6 py-12 text-sm text-ink-light">
            No figures were uploaded with this paper.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {figures.map((figure) => (
                <button
                  key={figure.id}
                  type="button"
                  onClick={() => setExpandedFigureId(expandedFigureId === figure.id ? null : figure.id)}
                  className={`group overflow-hidden rounded-[var(--radius-md)] border text-left transition-all ${
                    expandedFigureId === figure.id
                      ? "border-ink-faint"
                      : "border-rule hover:border-ink-faint"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={figure.downloadUrl}
                    alt={figure.caption ?? figure.fileName}
                    className="h-56 w-full object-cover"
                  />
                  <div className="flex items-center justify-between bg-snow-white px-4 py-3">
                    <div>
                      <div className="text-sm text-ink">{figure.fileName}</div>
                      {figure.caption ? (
                        <p className="mt-0.5 text-sm text-ink-light">{figure.caption}</p>
                      ) : null}
                    </div>
                    <span className="text-xs text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
                      Click to expand
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* expanded figure lightbox */}
            {expandedFigureId && (() => {
              const figure = figures.find((f) => f.id === expandedFigureId);
              if (!figure) return null;
              return (
                <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-rule">
                  <div className="flex items-center justify-between border-b border-rule bg-snow-white px-5 py-3">
                    <div>
                      <div className="text-sm text-ink">{figure.fileName}</div>
                      {figure.caption && (
                        <p className="mt-0.5 text-sm text-ink-light">{figure.caption}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={figure.downloadUrl}
                        download
                        className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-rule bg-snow-white px-3 py-1.5 text-xs text-ink transition-colors hover:bg-snow-white-dark"
                      >
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" />
                        </svg>
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => setExpandedFigureId(null)}
                        className="rounded-[var(--radius-sm)] p-1.5 text-ink-faint transition-colors hover:bg-snow-white-dark hover:text-ink"
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-center bg-snow-white-dark p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={figure.downloadUrl}
                      alt={figure.caption ?? figure.fileName}
                      className="max-h-[70vh] max-w-full object-contain"
                    />
                  </div>
                </div>
              );
            })()}
          </>
        )
      ) : null}

      {activeTab === "pdf" ? (
        pdfUrl ? (
          <div className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-rule">
            <iframe src={pdfUrl} title={`${paperTitle} PDF`} className="h-[900px] w-full" />
          </div>
        ) : (
          <div className="mt-6 rounded-[var(--radius-md)] border border-dashed border-rule px-6 py-12 text-sm text-ink-light">
            No compiled PDF is available for this paper.
          </div>
        )
      ) : null}
    </section>
  );
}
