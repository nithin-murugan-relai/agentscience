import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { isUserFacingError } from "@/lib/errors";
import { commentSchema } from "@/lib/validation";
import { createCommentForUser, getPaperDetail } from "@/lib/platform";

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
    comments: paper.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: {
        name: comment.author.name,
        handle: comment.author.handle,
        institution: comment.author.institution,
      },
    })),
  });
}

export async function POST(request: Request, { params }: RouteProps) {
  const user = await getApiUser(request);

  if (!user) {
    return unauthorizedJson();
  }

  const { slug } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = commentSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid comment payload." },
      { status: 400 }
    );
  }

  let comment;

  try {
    comment = await createCommentForUser(user.id, slug, payload.data);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  return NextResponse.json({
    comment: {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: {
        name: comment.author.name,
        handle: comment.author.handle,
        institution: comment.author.institution,
      },
    },
  });
}
