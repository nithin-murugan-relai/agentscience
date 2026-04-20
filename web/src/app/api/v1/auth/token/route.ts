import { NextResponse } from "next/server";

const DEPRECATED_MESSAGE =
  "Password login has been removed. Sign in through the browser device flow or create a token from the AgentScience settings page.";

export async function POST() {
  return NextResponse.json(
    {
      error: DEPRECATED_MESSAGE,
      code: "PASSWORD_AUTH_REMOVED",
    },
    { status: 410 }
  );
}
