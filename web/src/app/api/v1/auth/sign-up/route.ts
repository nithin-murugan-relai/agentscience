import { NextResponse } from "next/server";

const DEPRECATED_MESSAGE =
  "CLI sign-up now happens in the browser through Clerk. Create your account on the web, then connect the CLI with the device flow or an API token.";

export async function POST() {
  return NextResponse.json(
    {
      error: DEPRECATED_MESSAGE,
      code: "PASSWORD_AUTH_REMOVED",
    },
    { status: 410 }
  );
}
