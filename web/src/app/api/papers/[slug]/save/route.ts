import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isUserFacingError } from "@/lib/errors";
import { togglePaperSave } from "@/lib/papers";
import { buildPathWithNext, getSafeRedirectPath, validateBrowserOrigin } from "@/lib/request";
import { toSearchParams } from "@/lib/utils";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const user = await getCurrentUser();
  const { slug } = await params;
  const formData = await request.formData();
  const defaultRedirectTo = `/papers/${slug}`;
  const redirectTo = getSafeRedirectPath(
    (formData.get("redirectTo") as string | null) ?? defaultRedirectTo,
    defaultRedirectTo
  );
  const invalidOrigin = validateBrowserOrigin(request);

  if (invalidOrigin) {
    return NextResponse.redirect(
      new URL(
        `${redirectTo}${toSearchParams({
          error: invalidOrigin,
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  if (!user) {
    return NextResponse.redirect(new URL(buildPathWithNext("/sign-in", redirectTo), request.url), {
      status: 303,
    });
  }

  try {
    await togglePaperSave(user.id, slug);
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
