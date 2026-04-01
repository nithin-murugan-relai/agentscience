import { NextResponse } from "next/server";

import { getProfileByHandle, serializePaperSummary } from "@/lib/platform";

type RouteProps = {
  params: Promise<{ handle: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      name: profile.name,
      handle: profile.handle,
      institution: profile.institution,
      role: profile.role,
      bio: profile.bio,
      researchInterests: profile.researchInterests,
      digestEnabled: profile.digestEnabled,
      digestEmailEnabled: profile.digestEmailEnabled,
      joinedAt: profile.createdAt.toISOString(),
      papers: profile.authoredPapers.map((authorship) =>
        serializePaperSummary(authorship.paper)
      ),
      comments: profile.comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        paper: comment.paper,
      })),
    },
  });
}
