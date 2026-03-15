import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isUserFacingError } from "@/lib/errors";
import { createIdeaForUser, getRecentIdeas } from "@/lib/papers";
import { buildPathWithNext, validateBrowserOrigin } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { ideaFormSchema } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(await getRecentIdeas());
}

export async function POST(request: Request) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(invalidOrigin)}`, request.url),
      { status: 303 }
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL(buildPathWithNext("/sign-in", "/"), request.url), {
      status: 303,
    });
  }

  const rateLimit = await checkRateLimit({
    namespace: "idea-create",
    key: user.id,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.redirect(
      new URL("/?error=Too%20many%20notes.%20Try%20again%20later.", request.url),
      {
        status: 303,
        headers: {
          "Retry-After": `${Math.ceil(rateLimit.retryAfterMs / 1000)}`,
        },
      }
    );
  }

  const formData = await request.formData();
  const payload = ideaFormSchema.safeParse({
    content: formData.get("content"),
    paperSlug: formData.get("paperSlug"),
  });

  if (!payload.success) {
    return NextResponse.redirect(new URL("/", request.url), {
      status: 303,
    });
  }

  try {
    await createIdeaForUser(user.id, payload.data);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error.message)}`, request.url),
        { status: 303 }
      );
    }

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/rankings");

  return NextResponse.redirect(new URL("/", request.url), {
    status: 303,
  });
}
