import { NextResponse } from "next/server";

import { getPaperDetail } from "@/lib/platform";

type RouteProps = {
  params: Promise<{ slug: string; artifactId: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { slug, artifactId } = await params;
  const paper = await getPaperDetail(slug);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found." }, { status: 404 });
  }

  const artifact = paper.artifacts.find((item) => item.id === artifactId);

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  }

  if (artifact.textContent != null) {
    return new NextResponse(artifact.textContent, {
      headers: {
        "Content-Type": `${artifact.contentType}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
      },
    });
  }

  if (!artifact.bytes) {
    return NextResponse.json({ error: "Artifact contents unavailable." }, { status: 404 });
  }

  return new NextResponse(artifact.bytes, {
    headers: {
      "Content-Type": artifact.contentType,
      "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
    },
  });
}
