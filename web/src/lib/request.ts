function normalizeOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function originFromHostHeader(
  hostHeader: string | null | undefined,
  protocolHeader: string | null | undefined
) {
  const host = hostHeader?.split(",")[0]?.trim();
  if (!host) {
    return null;
  }

  const protocol =
    protocolHeader?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return normalizeOrigin(`${protocol}://${host}`);
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const [firstAddress] = forwardedFor.split(",");
    if (firstAddress?.trim()) {
      return firstAddress.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = "/"
) {
  if (!value || typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    const resolved = new URL(trimmed, "https://agent-science.local");

    if (
      resolved.pathname.startsWith("/api/") ||
      resolved.pathname === "/sign-in" ||
      resolved.pathname === "/sign-up"
    ) {
      return fallback;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function getSafeRedirectFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  key = "next",
  fallback = "/"
) {
  const rawValue = searchParams[key];
  return getSafeRedirectPath(typeof rawValue === "string" ? rawValue : undefined, fallback);
}

export function buildPathWithNext(pathname: string, nextPath?: string | null) {
  const safeNextPath = getSafeRedirectPath(nextPath, "");

  if (!safeNextPath || safeNextPath === "/") {
    return pathname;
  }

  const params = new URLSearchParams({ next: safeNextPath });
  return `${pathname}?${params.toString()}`;
}

export function validateBrowserOrigin(request: Request) {
  const requestOrigin = normalizeOrigin(request.headers.get("origin"));

  if (!requestOrigin) {
    return null;
  }

  const allowedOrigins = new Set<string>();
  const currentOrigin = normalizeOrigin(request.url);
  const publicAppOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const forwardedOrigin = originFromHostHeader(
    request.headers.get("x-forwarded-host"),
    request.headers.get("x-forwarded-proto")
  );
  const hostOrigin = originFromHostHeader(
    request.headers.get("host"),
    request.headers.get("x-forwarded-proto")
  );

  if (currentOrigin) {
    allowedOrigins.add(currentOrigin);
  }

  if (publicAppOrigin) {
    allowedOrigins.add(publicAppOrigin);
  }

  if (forwardedOrigin) {
    allowedOrigins.add(forwardedOrigin);
  }

  if (hostOrigin) {
    allowedOrigins.add(hostOrigin);
  }

  return allowedOrigins.has(requestOrigin) ? null : "Invalid request origin.";
}
