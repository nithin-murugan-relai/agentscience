import { createHash } from "node:crypto";

import {
  GENERATED_PERSONALITY_CONTENT_HASH,
  GENERATED_PERSONALITY_FILES,
} from "./generated/personalityData.js";
import type { LoadedPersonality, PersonalityManifest } from "./types.js";

interface GeneratedFileRecord {
  readonly encoding: "utf8" | "base64";
  readonly content: string;
}

const REQUIRED_SKILLS = ["agentscience", "platform", "research-publish"] as const;

let cachedPersonality: LoadedPersonality | undefined;
const generatedFiles = GENERATED_PERSONALITY_FILES as Record<string, GeneratedFileRecord>;

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid personality manifest: "${field}" must be a non-empty string.`);
  }
}

function validateManifest(input: unknown): PersonalityManifest {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid personality manifest: expected an object.");
  }

  const manifest = input as Record<string, unknown>;
  assertString(manifest.id, "id");
  assertString(manifest.displayName, "displayName");
  assertString(manifest.version, "version");
  assertString(manifest.entrySkill, "entrySkill");

  if (!Array.isArray(manifest.skills) || manifest.skills.some((entry) => typeof entry !== "string")) {
    throw new Error("Invalid personality manifest: \"skills\" must be an array of strings.");
  }

  for (const requiredSkill of REQUIRED_SKILLS) {
    if (!manifest.skills.includes(requiredSkill)) {
      throw new Error(`Invalid personality manifest: missing required skill "${requiredSkill}".`);
    }
  }

  if (!manifest.skills.includes(manifest.entrySkill)) {
    throw new Error("Invalid personality manifest: entrySkill must exist in skills.");
  }

  return {
    id: manifest.id,
    displayName: manifest.displayName,
    version: manifest.version,
    skills: [...manifest.skills],
    entrySkill: manifest.entrySkill,
  };
}

function readGeneratedTextFile(path: string): string {
  const entry = generatedFiles[path];
  if (!entry || entry.encoding !== "utf8") {
    throw new Error(`Missing generated personality text file: ${path}`);
  }
  return entry.content;
}

function computeContentHash(): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        Object.entries(GENERATED_PERSONALITY_FILES)
          .map(([path, record]) => [path, record] as const)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([path, record]) => [path, record]),
      ),
    )
    .digest("hex");
}

export function loadPersonality(): LoadedPersonality {
  if (cachedPersonality) {
    return cachedPersonality;
  }

  const manifest = validateManifest(JSON.parse(readGeneratedTextFile("manifest.json")));
  const skills = Object.fromEntries(
    REQUIRED_SKILLS.map((skillId) => [skillId, readGeneratedTextFile(`skills/${skillId}.md`)]),
  );
  const assets = Object.fromEntries(
    Object.entries(generatedFiles).flatMap(([path, entry]) => {
      if (!path.startsWith("assets/") || entry.encoding !== "base64") {
        return [];
      }

      return [[path.slice("assets/".length), Buffer.from(entry.content, "base64")] as const];
    }),
  );

  const contentHash = computeContentHash();
  if (contentHash !== GENERATED_PERSONALITY_CONTENT_HASH) {
    throw new Error(
      `Generated personality content hash mismatch. Expected ${GENERATED_PERSONALITY_CONTENT_HASH} but computed ${contentHash}. Run npm run build in packages/personality.`,
    );
  }

  cachedPersonality = {
    version: manifest.version,
    contentHash,
    manifest,
    personality: readGeneratedTextFile("personality.md"),
    methodology: readGeneratedTextFile("methodology.md"),
    skills,
    assets,
  };

  return cachedPersonality;
}
