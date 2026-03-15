import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isUserFacingError } from "@/lib/errors";
import { addReviewForUser } from "@/lib/papers";
import { buildPathWithNext, getSafeRedirectPath, validateBrowserOrigin } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { toSearchParams } from "@/lib/utils";
import { reviewFormSchema } from "@/lib/validation";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const invalidOrigin = validateBrowserOrigin(request);
  const user = await getCurrentUser();
  const { slug } = await params;
  const defaultRedirectTo = `/papers/${slug}`;

  if (invalidOrigin) {
    return NextResponse.redirect(
      new URL(
        `${defaultRedirectTo}${toSearchParams({
          error: invalidOrigin,
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  if (!user) {
    return NextResponse.redirect(new URL(buildPathWithNext("/sign-in", defaultRedirectTo), request.url), {
      status: 303,
    });
  }

  const rateLimit = await checkRateLimit({
    namespace: "review-submit",
    key: user.id,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.redirect(
      new URL(
        `${defaultRedirectTo}${toSearchParams({
          error: "Too many review attempts. Try again later.",
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

  const formData = await request.formData();
  const payload = reviewFormSchema.safeParse({
    summary: formData.get("summary"),
    strengths: formData.get("strengths"),
    concerns: formData.get("concerns"),
    novelty: formData.get("novelty"),
    rigor: formData.get("rigor"),
    clarity: formData.get("clarity"),
    reproducibility: formData.get("reproducibility"),
    verdict: formData.get("verdict"),
    redirectTo: formData.get("redirectTo"),
  });
  const redirectTo = getSafeRedirectPath(
    (formData.get("redirectTo") as string | null) ?? defaultRedirectTo,
    defaultRedirectTo
  );

  if (!payload.success) {
    return NextResponse.redirect(
      new URL(
        `${redirectTo}${toSearchParams({
          error: payload.error.issues[0]?.message ?? "Invalid review.",
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  try {
    await addReviewForUser(user.id, slug, payload.data);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.redirect(
        new URL(
          `${redirectTo}${toSearchParams({
            error: error.message,
          })}`,
          request.url
        ),
        { status: 303 }
      );
    }

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath(redirectTo);

  return NextResponse.redirect(new URL(redirectTo, request.url), {
    status: 303,
  });
}
