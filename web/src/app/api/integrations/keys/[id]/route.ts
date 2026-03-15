import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isUserFacingError } from "@/lib/errors";
import { deleteIntegrationKey } from "@/lib/papers";
import { validateBrowserOrigin } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, { params }: RouteProps) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.json({ error: invalidOrigin }, { status: 403 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
    namespace: "integration-key-delete",
    key: user.id,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many token deletion attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": `${Math.ceil(rateLimit.retryAfterMs / 1000)}`,
        },
      }
    );
  }

  const { id } = await params;

  try {
    await deleteIntegrationKey(user.id, id);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  return NextResponse.json({ ok: true });
}
