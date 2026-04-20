import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

import {
  handleClerkUserDeleted,
  syncClerkUserFromIdentity,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const event = await verifyWebhook(request);

    switch (event.type) {
      case "user.created":
      case "user.updated":
        await syncClerkUserFromIdentity(event.data);
        break;
      case "user.deleted":
        await handleClerkUserDeleted(event.data.id);
        break;
      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to process Clerk webhook.", error);
    return NextResponse.json({ error: "Invalid Clerk webhook." }, { status: 400 });
  }
}
