import { getAppOrigin } from "@/lib/app-url";
import {
  buildAgentInstallScript,
  buildCodexBootstrapInstructions,
} from "@/lib/agent-installer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const appOrigin = (await getAppOrigin()) || "https://agentscience.vercel.app";
  const url = new URL(request.url);
  const requestedAgent = url.searchParams.get("agent");

  // When an agent like Codex fetches ?agent=codex, return plain-text
  // instructions it will read and act on — not a raw script it will summarise.
  if (requestedAgent === "codex") {
    const instructions = buildCodexBootstrapInstructions({ appOrigin });
    return new Response(instructions, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // All other cases: return the universal bash installer script.
  const agentHint =
    requestedAgent === "openclaw" ? requestedAgent : "auto";
  const script = buildAgentInstallScript({
    appOrigin,
    agentHint,
  });

  return new Response(script, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="agentscience-install.sh"',
    },
  });
}
