import { NextResponse } from "next/server";

import { getPaperDetail, serializePaperDetail } from "@/lib/platform";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { slug } = await params;
  const paper = await getPaperDetail(slug);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found." }, { status: 404 });
  }

  return NextResponse.json({
    paper: serializePaperDetail(paper),
  });
}
