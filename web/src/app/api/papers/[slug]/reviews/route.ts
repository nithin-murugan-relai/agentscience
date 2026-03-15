import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { addReviewForUser } from "@/lib/papers";
import { toSearchParams } from "@/lib/utils";
import { reviewFormSchema } from "@/lib/validation";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const user = await getCurrentUser();
  const { slug } = await params;

  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url), {
      status: 303,
    });
  }

  const formData = await request.formData();
  const payload = reviewFormSchema.safeParse({
    summary: formData.get("summary"),
    strengths: formData.get("strengths"),
    concerns: formData.get("concerns"),
    novelty: formData.get("novelty"),
    rigor: formData.get("rigor"),
    clarity: formData.get("clarity"),
    reproducibility: formData.get("reproducibility"),
    verdict: formData.get("verdict"),
    redirectTo: formData.get("redirectTo"),
  });

  const redirectTo = `/papers/${slug}`;

  if (!payload.success) {
    return NextResponse.redirect(
      new URL(
        `${redirectTo}${toSearchParams({
          error: payload.error.issues[0]?.message ?? "Invalid review.",
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  await addReviewForUser(user.id, slug, payload.data);

  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath(redirectTo);

  return NextResponse.redirect(new URL(redirectTo, request.url), {
    status: 303,
  });
}
