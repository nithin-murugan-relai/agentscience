import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getUniqueConstraintTargets, isUserFacingError } from "@/lib/errors";
import { getRankedPapers } from "@/lib/papers";
import { createBundledPaper } from "@/lib/platform";
import {
  optionalStringField,
  parseArtifactUploads,
  toUploadDescriptor,
} from "@/lib/paper-upload";
import { buildPathWithNext, validateBrowserOrigin } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseList, toSearchParams } from "@/lib/utils";
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
    title: optionalStringField(formData.get("title")),
    abstract: optionalStringField(formData.get("abstract")),
    markdown: optionalStringField(formData.get("markdown")),
    latexSource: optionalStringField(formData.get("latexSource")),
    bibSource: optionalStringField(formData.get("bibSource")),
    pdfUrl: optionalStringField(formData.get("pdfUrl")),
    canonicalUrl: optionalStringField(formData.get("canonicalUrl")),
    githubUrl: optionalStringField(formData.get("githubUrl")),
    doi: optionalStringField(formData.get("doi")),
    keywords: optionalStringField(formData.get("keywords")),
    references: optionalStringField(formData.get("references")),
    ideaNote: optionalStringField(formData.get("ideaNote")),
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

  const pdfFile = formData.get("pdf");
  let artifacts;

  try {
    artifacts = await parseArtifactUploads(formData);
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/publish${toSearchParams({
          error: error instanceof Error ? error.message : "Invalid artifact bundle.",
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  const figures = await Promise.all(
    formData
      .getAll("figures")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .map((entry) => toUploadDescriptor(entry))
  );

  let paper;

  try {
    paper = await createBundledPaper(user.id, {
      ...payload.data,
      references: payload.data.references,
      pdf:
        pdfFile instanceof File && pdfFile.size > 0
          ? await toUploadDescriptor(pdfFile)
          : null,
      figures,
      artifacts,
      keywords:
        payload.data.keywords.length > 0
          ? payload.data.keywords
          : parseList(String(formData.get("keywords") ?? "")),
    });
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
