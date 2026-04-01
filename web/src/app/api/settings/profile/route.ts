import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { updateProfileForUser } from "@/lib/platform";
import { buildPathWithNext, validateBrowserOrigin } from "@/lib/request";
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
    bio: formData.get("bio"),
    institution: formData.get("institution"),
    researchInterests: parseList(String(formData.get("researchInterests") ?? "")).slice(0, 20),
    digestEnabled: formData.get("digestEnabled") === "on",
    digestEmailEnabled: formData.get("digestEmailEnabled") === "on",
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

  await updateProfileForUser(user.id, payload.data);

  revalidatePath("/settings");
  revalidatePath(`/profiles/${user.handle}`);

  return NextResponse.redirect(new URL("/settings", request.url), { status: 303 });
}
