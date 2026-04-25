import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getUniqueConstraintTargets, isUserFacingError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth";
import { updateProfileForUser } from "@/lib/platform";
import { buildPathWithNext, getSafeRedirectPath, validateBrowserOrigin } from "@/lib/request";
import { parseList, toSearchParams } from "@/lib/utils";
import { profileUpdateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const invalidOrigin = validateBrowserOrigin(request);

  if (invalidOrigin) {
    return NextResponse.redirect(
      new URL(`/settings${toSearchParams({ error: invalidOrigin })}`, request.url),
      { status: 303 }
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL(buildPathWithNext("/sign-in", "/settings"), request.url), {
      status: 303,
    });
  }

  const formData = await request.formData();
  const payload = profileUpdateSchema.safeParse({
    name: formData.get("name"),
    handle: formData.get("handle"),
    bio: formData.get("bio"),
    institution: formData.get("institution"),
    researchInterests: parseList(String(formData.get("researchInterests") ?? "")).slice(0, 20),
    publicationProfileCompleted: formData.get("publicationProfileCompleted") === "true",
  });

  if (!payload.success) {
    return NextResponse.redirect(
      new URL(
        `/settings${toSearchParams({
          error: payload.error.issues[0]?.message ?? "Invalid settings payload.",
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  try {
    await updateProfileForUser(user.id, payload.data);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.redirect(
        new URL(
          `/settings${toSearchParams({
            error: error.message,
          })}`,
          request.url
        ),
        { status: 303 }
      );
    }

    const uniqueTargets = getUniqueConstraintTargets(error);

    if (uniqueTargets.includes("handle")) {
      return NextResponse.redirect(
        new URL(
          `/settings${toSearchParams({
            error: "That handle is already taken.",
          })}`,
          request.url
        ),
        { status: 303 }
      );
    }

    throw error;
  }

  revalidatePath("/settings");
  revalidatePath(`/profiles/${user.handle}`);

  if (payload.data.handle && payload.data.handle !== user.handle) {
    revalidatePath(`/profiles/${payload.data.handle}`);
  }

  const nextPath = getSafeRedirectPath(String(formData.get("redirect_url") ?? ""), "/settings");
  return NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });
}
