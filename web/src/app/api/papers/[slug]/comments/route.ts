import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isUserFacingError } from "@/lib/errors";
import { createCommentForUser } from "@/lib/platform";
import { buildPathWithNext, getSafeRedirectPath, validateBrowserOrigin } from "@/lib/request";
import { toSearchParams } from "@/lib/utils";
import { commentSchema } from "@/lib/validation";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const { slug } = await params;
  const defaultRedirectTo = `/papers/${slug}`;
  const formData = await request.formData();
  const redirectTo = getSafeRedirectPath(
    (formData.get("redirectTo") as string | null) ?? defaultRedirectTo,
    defaultRedirectTo
  );
  const invalidOrigin = validateBrowserOrigin(request);

  if (invalidOrigin) {
    return NextResponse.redirect(
      new URL(`${redirectTo}${toSearchParams({ error: invalidOrigin })}`, request.url),
      { status: 303 }
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL(buildPathWithNext("/sign-in", redirectTo), request.url), {
      status: 303,
    });
  }

  const payload = commentSchema.safeParse({
    body: formData.get("body"),
  });

  if (!payload.success) {
    return NextResponse.redirect(
      new URL(
        `${redirectTo}${toSearchParams({
          error: payload.error.issues[0]?.message ?? "Invalid comment.",
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  try {
    await createCommentForUser(user.id, slug, payload.data);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.redirect(
        new URL(`${redirectTo}${toSearchParams({ error: error.message })}`, request.url),
        { status: 303 }
      );
    }

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath(redirectTo);

  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
}
