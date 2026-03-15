import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getUniqueConstraintTargets, isUserFacingError } from "@/lib/errors";
import { createManualPaper, getRankedPapers } from "@/lib/papers";
import { buildPathWithNext, validateBrowserOrigin } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { toSearchParams } from "@/lib/utils";
import { paperFormSchema } from "@/lib/validation";

export async function GET() {
  const papers = await getRankedPapers();
  return NextResponse.json(papers);
}

export async function POST(request: Request) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.redirect(
      new URL(`/publish${toSearchParams({ error: invalidOrigin })}`, request.url),
      { status: 303 }
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL(buildPathWithNext("/sign-in", "/publish"), request.url), {
      status: 303,
    });
  }

  const rateLimit = await checkRateLimit({
    namespace: "paper-create",
    key: user.id,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.redirect(
      new URL(
        `/publish${toSearchParams({
          error: "Too many publish attempts. Try again later.",
        })}`,
        request.url
      ),
      {
        status: 303,
        headers: {
          "Retry-After": `${Math.ceil(rateLimit.retryAfterMs / 1000)}`,
        },
      }
    );
  }

  const formData = await request.formData();
  const payload = paperFormSchema.safeParse({
    title: formData.get("title"),
    abstract: formData.get("abstract"),
    markdown: formData.get("markdown"),
    latexSource: formData.get("latexSource"),
    pdfUrl: formData.get("pdfUrl"),
    canonicalUrl: formData.get("canonicalUrl"),
    doi: formData.get("doi"),
    keywords: formData.get("keywords"),
    references: formData.get("references"),
    ideaNote: formData.get("ideaNote"),
  });

  if (!payload.success) {
    return NextResponse.redirect(
      new URL(
        `/publish${toSearchParams({
          error: payload.error.issues[0]?.message ?? "Invalid paper payload.",
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  let paper;

  try {
    paper = await createManualPaper(user.id, payload.data);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.redirect(
        new URL(`/publish${toSearchParams({ error: error.message })}`, request.url),
        { status: 303 }
      );
    }

    const uniqueTargets = getUniqueConstraintTargets(error);
    if (uniqueTargets.includes("doi")) {
      return NextResponse.redirect(
        new URL(
          `/publish${toSearchParams({
            error: "A paper with that DOI already exists.",
          })}`,
          request.url
        ),
        { status: 303 }
      );
    }

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath("/publish");

  return NextResponse.redirect(new URL(`/papers/${paper?.slug}`, request.url), {
    status: 303,
  });
}
