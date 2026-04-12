import { NextResponse } from "next/server";

import { getLatestDesktopDownloadUrl } from "@/lib/desktop-release";

export function GET() {
  return NextResponse.redirect(getLatestDesktopDownloadUrl("mac", "arm64"), { status: 307 });
}
