import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/methodology
 *
 * Serves the canonical Agent Science research methodology document as plain
 * text. Any agent can fetch this to learn the full research pipeline, quality
 * standards, and personality.
 */
export async function GET() {
  const methodologyPath = join(process.cwd(), "src", "lib", "methodology.md");
  const content = readFileSync(methodologyPath, "utf8");

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
