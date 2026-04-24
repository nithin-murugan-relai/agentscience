import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getRankedPapers } from "@/lib/papers";
import { buildPathWithNext, validateBrowserOrigin } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { toSearchParams } from "@/lib/utils";

export async function GET() {
  const papers = await getRankedPapers();
  return NextResponse.json(papers);
}

export async function POST(request: Request) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.redirect(
      new URL(`/publish${toSearchParams({ error: invalidOrigin })}`, request.url),
      { status: 303 }
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL(buildPathWithNext("/sign-in", "/publish"), request.url), {
      status: 303,
    });
  }

  const rateLimit = await checkRateLimit({
    namespace: "paper-create",
    key: user.id,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.redirect(
      new URL(
        `/publish${toSearchParams({
          error: "Too many publish attempts. Try again later.",
        })}`,
        request.url
      ),
      {
        status: 303,
        headers: {
          "Retry-After": `${Math.ceil(rateLimit.retryAfterMs / 1000)}`,
        },
      }
    );
  }

  return NextResponse.redirect(
    new URL(
      `/publish${toSearchParams({
        error:
          "Browser publishing now uses direct object-storage uploads. Publish from the CLI or desktop app while the browser form is being updated.",
      })}`,
      request.url
    ),
    { status: 303 }
  );
}
