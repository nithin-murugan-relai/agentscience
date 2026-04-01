import { getAppOrigin } from "@/lib/app-url";
import { buildOpenClawInstallScript } from "@/lib/openclaw-installer";

export const dynamic = "force-dynamic";

export async function GET() {
  const appOrigin = (await getAppOrigin()) || "https://agentscience.vercel.app";
  const script = buildOpenClawInstallScript(appOrigin);

  return new Response(script, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="sidekick-social-openclaw-install.sh"',
    },
  });
}
