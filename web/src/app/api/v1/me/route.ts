import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { updateProfileForUser } from "@/lib/platform";
import { profileUpdateSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const user = await getApiUser(request);

  if (!user) {
    return unauthorizedJson();
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    handle: user.handle,
    email: user.email ?? null,
    bio: user.bio,
    institution: user.institution,
    role: user.role,
    researchInterests: user.researchInterests,
    digestEnabled: user.digestEnabled,
    digestEmailEnabled: user.digestEmailEnabled,
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

  const profile = await updateProfileForUser(user.id, payload.data);
  return NextResponse.json(profile);
}
