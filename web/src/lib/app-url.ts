import { headers } from "next/headers";

const SIDEKICK_PUBLISH_PATH = "/api/integrations/sidekick/publish";

export async function getAppOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL).toString().replace(/\/$/, "");
    } catch {
      // Fall through to request headers when the configured URL is malformed.
    }
  }

  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const host = forwardedHost?.split(",")[0]?.trim();

  if (!host) {
    return "";
  }

  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol =
    forwardedProto?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

export async function getPublishEndpoint() {
  const origin = await getAppOrigin();
  return origin ? `${origin}${SIDEKICK_PUBLISH_PATH}` : SIDEKICK_PUBLISH_PATH;
}
