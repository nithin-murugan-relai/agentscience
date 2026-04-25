import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { isUserFacingError } from "@/lib/errors";
import { updateProfileForUser } from "@/lib/platform";
import { getPublicationProfileStatus } from "@/lib/publication-profile";
import { profileUpdateSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const user = await getApiUser(request);

  if (!user) {
    return unauthorizedJson();
  }

  const publicationProfile = getPublicationProfileStatus(user);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    handle: user.handle,
    email: user.email ?? null,
    bio: user.bio,
    institution: user.institution,
    publicationProfileCompletedAt: user.publicationProfileCompletedAt?.toISOString() ?? null,
    publicationProfileComplete: publicationProfile.publicationProfileComplete,
    publishNameRequired: publicationProfile.publishNameRequired,
    role: user.role,
    researchInterests: user.researchInterests,
  });
}

export async function PATCH(request: Request) {
  const user = await getApiUser(request);

  if (!user) {
    return unauthorizedJson();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = profileUpdateSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid profile payload." },
      { status: 400 }
    );
  }

  let profile;
  try {
    profile = await updateProfileForUser(user.id, payload.data);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
  const publicationProfile = getPublicationProfileStatus(profile);

  return NextResponse.json({
    ...profile,
    publicationProfileCompletedAt: profile.publicationProfileCompletedAt?.toISOString() ?? null,
    publicationProfileComplete: publicationProfile.publicationProfileComplete,
    publishNameRequired: publicationProfile.publishNameRequired,
  });
}
