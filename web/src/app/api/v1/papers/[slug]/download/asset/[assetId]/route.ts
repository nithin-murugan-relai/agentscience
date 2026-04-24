import { NextResponse } from "next/server";

import { getPaperDetail } from "@/lib/platform";

type RouteProps = {
  params: Promise<{ slug: string; assetId: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { slug, assetId } = await params;
  const paper = await getPaperDetail(slug);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found." }, { status: 404 });
  }

  const asset = paper.assets.find((item) => item.id === assetId);

  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  if (asset.textContent) {
    return new NextResponse(asset.textContent, {
      headers: {
        "Content-Type": `${asset.mimeType}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${asset.fileName}"`,
      },
    });
  }

  return NextResponse.redirect(asset.downloadUrl ?? asset.blobUrl, { status: 307 });
}
