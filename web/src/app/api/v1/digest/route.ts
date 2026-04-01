import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { buildDigestForUser } from "@/lib/platform";

export async function GET(request: Request) {
  const user = await getApiUser(request);

  if (!user) {
    return unauthorizedJson();
  }

  return NextResponse.json(await buildDigestForUser(user.id));
}
