import { UserFacingError } from "@/lib/errors";

const NON_PUBLISHING_NAMES = new Set([
  "agent science",
  "agentscience",
  "agentscience research",
  "agent science research",
  "researcher",
]);

export type PublicationProfileUser = {
  readonly name: string;
  readonly institution: string | null;
  readonly publicationProfileCompletedAt: Date | null;
};

export function getPublicationProfileStatus(user: PublicationProfileUser) {
  const name = user.name.trim();
  const hasPublishName = name.length >= 2 && !NON_PUBLISHING_NAMES.has(name.toLowerCase());

  return {
    hasPublishName,
    publicationProfileComplete:
      hasPublishName &&
      (user.publicationProfileCompletedAt !== null || user.institution !== null),
    publishNameRequired: !hasPublishName,
    institution: user.institution,
  };
}

export function requirePublicationProfile(user: PublicationProfileUser) {
  const status = getPublicationProfileStatus(user);

  if (!status.hasPublishName) {
    throw new UserFacingError(
      "Add the name you want to publish with before submitting papers.",
      409
    );
  }

  return status;
}
