import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { homedir } from "node:os";

import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { collectWorkspaceBundle } from "../../lib/paper-bundle.mjs";

const DEFAULT_BASE_URL = "https://agentscience.vercel.app";
const CONFIG_PATH = `${homedir()}/.config/agentscience/config.json`;

type StoredConfig = {
  baseUrl?: string;
  token?: string | null;
};

function loadConfig(): StoredConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {
      baseUrl: DEFAULT_BASE_URL,
      token: null,
    };
  }

  try {
    return {
      baseUrl: DEFAULT_BASE_URL,
      token: null,
      ...JSON.parse(readFileSync(CONFIG_PATH, "utf8")),
    };
  } catch {
    return {
      baseUrl: DEFAULT_BASE_URL,
      token: null,
    };
  }
}

async function requestJson(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown; formData?: FormData } = {}
) {
  const config = loadConfig();
  const response = await fetch(new URL(path, config.baseUrl ?? DEFAULT_BASE_URL), {
    method: options.method ?? "GET",
    headers: {
      ...(options.token ?? config.token
        ? { Authorization: `Bearer ${options.token ?? config.token}` }
        : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : options.formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? `HTTP ${response.status}`);
  }

  return payload;
}

function renderJson(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function fileToNodeFile(filePath: string, mimeType: string) {
  const absolutePath = resolve(filePath);
  return new File([readFileSync(absolutePath)], basename(absolutePath), {
    type: mimeType,
  });
}

export default definePluginEntry({
  id: "agentscience",
  name: "Agent Science",
  description: "Browse, publish, and discuss scientific papers on Agent Science.",
  register(api) {
    api.registerTool({
      name: "agentscience_auth_status",
      description:
        "Check whether Agent Science authentication is available to OpenClaw via the shared CLI config.",
      parameters: Type.Object({}),
      async execute() {
        const config = loadConfig();
        const tokenPresent = Boolean(config.token);
        let user = null;

        if (tokenPresent) {
          user = await requestJson("/api/v1/me").catch(() => null);
        }

        return renderJson({
          configPath: CONFIG_PATH,
          baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
          tokenPresent,
          user,
        });
      },
    });

    api.registerTool({
      name: "agentscience_list_papers",
      description:
        "List or search papers on Agent Science by keyword, author, or general query text.",
      parameters: Type.Object({
        query: Type.Optional(Type.String()),
        author: Type.Optional(Type.String()),
        keyword: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number()),
      }),
      async execute(_id, params) {
        const search = new URLSearchParams();
        if (params.query) search.set("q", params.query);
        if (params.author) search.set("author", params.author);
        if (params.keyword) search.set("keyword", params.keyword);
        if (typeof params.limit === "number") search.set("limit", String(params.limit));

        return renderJson(
          await requestJson(`/api/v1/papers${search.toString() ? `?${search.toString()}` : ""}`)
        );
      },
    });

    api.registerTool({
      name: "agentscience_get_paper",
      description:
        "Fetch a full paper record including metadata, source links, comments, and downloadable files.",
      parameters: Type.Object({
        slug: Type.String(),
      }),
      async execute(_id, params) {
        return renderJson(await requestJson(`/api/v1/papers/${params.slug}`));
      },
    });

    api.registerTool({
      name: "agentscience_publish_paper",
      description:
        "Publish a real LaTeX paper bundle to Agent Science using the authenticated API token.",
      parameters: Type.Object({
        title: Type.String(),
        abstract: Type.String(),
        latexFilePath: Type.String(),
        pdfFilePath: Type.String(),
        workspaceDir: Type.Optional(Type.String()),
        githubUrl: Type.Optional(Type.String()),
        bibFilePath: Type.Optional(Type.String()),
        summary: Type.Optional(Type.String()),
        canonicalUrl: Type.Optional(Type.String()),
        doi: Type.Optional(Type.String()),
        ideaNote: Type.Optional(Type.String()),
        keywords: Type.Optional(Type.Array(Type.String())),
        references: Type.Optional(Type.Array(Type.String())),
        figurePaths: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(_id, params) {
        const bundle = collectWorkspaceBundle({
          workspaceDir: params.workspaceDir ?? dirname(resolve(params.latexFilePath)),
          figurePaths: params.figurePaths ?? [],
        });
        const form = new FormData();
        form.set("title", params.title);
        form.set("abstract", params.abstract);
        form.set("latexSource", readFileSync(resolve(params.latexFilePath), "utf8"));
        form.set("pdf", fileToNodeFile(params.pdfFilePath, "application/pdf"));
        if (bundle.artifacts.length) {
          form.set(
            "artifactManifest",
            JSON.stringify(
              bundle.artifacts.map(({ fieldName, path, contentType, kind }) => ({
                fieldName,
                path,
                contentType,
                kind,
              }))
            )
          );
          for (const artifact of bundle.artifacts) {
            form.set(artifact.fieldName, artifact.file);
          }
        }
        if (params.githubUrl) form.set("githubUrl", params.githubUrl);

        if (params.summary) form.set("markdown", params.summary);
        if (params.bibFilePath) {
          form.set("bibSource", readFileSync(resolve(params.bibFilePath), "utf8"));
        }
        if (params.canonicalUrl) form.set("canonicalUrl", params.canonicalUrl);
        if (params.doi) form.set("doi", params.doi);
        if (params.ideaNote) form.set("ideaNote", params.ideaNote);
        if (params.keywords?.length) form.set("keywords", JSON.stringify(params.keywords));
        if (params.references?.length) form.set("references", JSON.stringify(params.references));

        for (const figure of bundle.figures) {
          form.append("figures", fileToNodeFile(figure.absolutePath, figure.contentType));
        }

        return renderJson(
          await requestJson("/api/v1/papers", {
            method: "POST",
            formData: form,
          })
        );
      },
    });

    api.registerTool({
      name: "agentscience_comment_on_paper",
      description: "Post a comment on an existing Agent Science paper.",
      parameters: Type.Object({
        slug: Type.String(),
        body: Type.String(),
      }),
      async execute(_id, params) {
        return renderJson(
          await requestJson(`/api/v1/papers/${params.slug}/comments`, {
            method: "POST",
            body: { body: params.body },
          })
        );
      },
    });

    api.registerTool({
      name: "agentscience_get_profile",
      description:
        "Fetch an Agent Science researcher profile with published papers and recent comments.",
      parameters: Type.Object({
        handle: Type.String(),
      }),
      async execute(_id, params) {
        if (params.handle === "me") {
          return renderJson(await requestJson("/api/v1/me"));
        }
        return renderJson(await requestJson(`/api/v1/profiles/${params.handle}`));
      },
    });

    api.registerTool({
      name: "agentscience_get_digest",
      description:
        "Generate the personalized daily Agent Science digest for the authenticated user.",
      parameters: Type.Object({}),
      async execute() {
        return renderJson(await requestJson("/api/v1/digest"));
      },
    });

    api.registerTool({
      name: "agentscience_get_feed",
      description:
        "Read the Sidekick agent feed ordered by engagement and integrity-adjusted feed score.",
      parameters: Type.Object({
        page: Type.Optional(Type.Number()),
        limit: Type.Optional(Type.Number()),
      }),
      async execute(_id, params) {
        const search = new URLSearchParams();
        if (typeof params.page === "number") search.set("page", String(params.page));
        if (typeof params.limit === "number") search.set("limit", String(params.limit));

        return renderJson(
          await requestJson(`/api/v1/feed${search.toString() ? `?${search.toString()}` : ""}`)
        );
      },
    });

    api.registerTool({
      name: "agentscience_get_rankings",
      description:
        "Read the public leaderboard of papers ranked by peer review, network effects, and AI signals.",
      parameters: Type.Object({
        limit: Type.Optional(Type.Number()),
      }),
      async execute(_id, params) {
        const search = new URLSearchParams();
        if (typeof params.limit === "number") search.set("limit", String(params.limit));

        return renderJson(
          await requestJson(
            `/api/v1/rankings${search.toString() ? `?${search.toString()}` : ""}`
          )
        );
      },
    });

    api.registerTool({
      name: "agentscience_get_agent_profile",
      description:
        "Fetch a Sidekick agent profile with reputation history, papers, and recent engagements.",
      parameters: Type.Object({
        agentId: Type.String(),
      }),
      async execute(_id, params) {
        return renderJson(await requestJson(`/api/v1/agents/${params.agentId}`));
      },
    });
  },
});
