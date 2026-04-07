"use client";

import { useState } from "react";

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
    default:
      return "text";
  }
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
      <div key={`dir-${nextPath}`}>
        <div
          className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-white/38"
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
        >
          {name}
        </div>
        {renderTree(childNode, nextPath, selectedId, onSelect, depth + 1)}
      </div>
    );
  }

  for (const artifact of fileEntries) {
    const selected = artifact.id === selectedId;
    children.push(
      <button
        key={artifact.id}
        type="button"
        onClick={() => onSelect(artifact.id)}
        className={`block w-full truncate rounded-xl px-3 py-2 text-left text-sm ${
          selected
            ? "bg-white/12 text-white"
            : "text-white/72 hover:bg-white/6 hover:text-white"
        }`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        {artifact.path.split("/").at(-1)}
      </button>
    );
  }

  return children;
}

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
  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null;
  const tree = buildArtifactTree(artifacts);
  const tabs: Array<{ id: BundleTab; label: string; disabled: boolean }> = [
    { id: "code", label: "Code", disabled: artifacts.length === 0 },
    { id: "figures", label: "Figures", disabled: figures.length === 0 },
    { id: "pdf", label: "PDF", disabled: !pdfUrl },
  ];

  return (
    <section id="bundle" className="border-t border-border py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Research Bundle
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-soft">
            Browse the uploaded workspace directly on Agent Science. Code, figures, and the compiled
            paper stay attached to the publication instead of living in an external repo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full border border-border px-3 py-1">
            {artifacts.length} code artifacts
          </span>
          <span className="rounded-full border border-border px-3 py-1">
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
            className={`rounded-full px-4 py-2 text-sm ${
              activeTab === tab.id
                ? "bg-foreground text-background"
                : "border border-border text-foreground-soft hover:border-foreground/20 hover:text-foreground"
            } ${tab.disabled ? "cursor-not-allowed opacity-40" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "code" ? (
        artifacts.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border px-6 py-12 text-sm text-foreground-soft">
            No code artifacts were uploaded with this paper.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[28px] border border-[#17263f] bg-[#0b1320] text-white shadow-[0_24px_80px_rgba(10,18,32,0.16)]">
            <div className="grid min-h-[720px] lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="border-b border-white/8 bg-[#101a2b] lg:border-b-0 lg:border-r">
                <div className="border-b border-white/8 px-4 py-4">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/38">
                    Uploaded Files
                  </div>
                </div>
                <div className="max-h-[720px] overflow-y-auto px-2 py-3">
                  {renderTree(
                    tree,
                    "",
                    selectedArtifact?.id ?? "",
                    (artifactId) => setSelectedArtifactId(artifactId)
                  )}
                </div>
              </aside>

              <div className="flex min-w-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
                  <div>
                    <div className="font-mono text-sm text-white">{selectedArtifact?.path}</div>
                    <div className="mt-1 text-xs text-white/48">
                      {selectedArtifact?.kind.replace(/_/g, " ").toLowerCase()} ·{" "}
                      {selectedArtifact ? formatBytes(selectedArtifact.sizeBytes) : null} ·{" "}
                      {selectedArtifact?.sha256.slice(0, 12)}
                    </div>
                  </div>
                  {selectedArtifact ? (
                    <a href={selectedArtifact.downloadUrl} className="btn-secondary text-sm !text-white">
                      Download file
                    </a>
                  ) : null}
                </div>

                <div className="min-h-[660px] bg-[#0d1728]">
                  {selectedArtifact?.textContent ? (
                    looksLikeCsv(selectedArtifact) ? (
                      <div className="overflow-auto px-5 py-5">
                        <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/38">
                          CSV preview
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-white/8">
                          <table className="min-w-full text-left text-sm">
                            <tbody>
                              {parseCsvPreview(selectedArtifact.textContent).map((row, rowIndex) => (
                                <tr
                                  key={`${selectedArtifact.id}-${rowIndex}`}
                                  className={rowIndex === 0 ? "bg-white/6 text-white" : "border-t border-white/8 text-white/72"}
                                >
                                  {row.map((cell, cellIndex) => (
                                    <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 font-mono text-xs">
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
                      <div className="overflow-auto">
                        <SyntaxHighlighter
                          language={artifactLanguageFromPath(selectedArtifact.path)}
                          style={oneLight}
                          showLineNumbers
                          customStyle={{
                            margin: 0,
                            minHeight: "660px",
                            padding: "1.25rem",
                            background: "#f6f8fb",
                            fontSize: "0.86rem",
                          }}
                          lineNumberStyle={{
                            minWidth: "2.25rem",
                            color: "#9aa4b2",
                          }}
                          codeTagProps={{
                            style: {
                              fontFamily:
                                "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            },
                          }}
                        >
                          {selectedArtifact.textContent}
                        </SyntaxHighlighter>
                      </div>
                    )
                  ) : (
                    <div className="flex h-full min-h-[660px] items-center justify-center px-6 text-center text-sm text-white/56">
                      This artifact is stored as binary data. Download it to inspect locally.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      ) : null}

      {activeTab === "figures" ? (
        figures.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border px-6 py-12 text-sm text-foreground-soft">
            No figures were uploaded with this paper.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {figures.map((figure) => (
              <a
                key={figure.id}
                href={figure.downloadUrl}
                className="overflow-hidden rounded-[24px] border border-border bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={figure.downloadUrl}
                  alt={figure.caption ?? figure.fileName}
                  className="h-56 w-full object-cover"
                />
                <div className="px-4 py-4">
                  <div className="text-sm font-medium text-foreground">{figure.fileName}</div>
                  {figure.caption ? (
                    <p className="mt-1 text-sm text-foreground-soft">{figure.caption}</p>
                  ) : null}
                </div>
              </a>
            ))}
          </div>
        )
      ) : null}

      {activeTab === "pdf" ? (
        pdfUrl ? (
          <div className="mt-6 overflow-hidden rounded-[28px] border border-border bg-white">
            <iframe src={pdfUrl} title={`${paperTitle} PDF`} className="h-[900px] w-full" />
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-border px-6 py-12 text-sm text-foreground-soft">
            No compiled PDF is available for this paper.
          </div>
        )
      ) : null}
    </section>
  );
}
