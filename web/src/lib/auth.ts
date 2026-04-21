import { createHash } from "node:crypto";
import { cache } from "react";

import type { User } from "@prisma/client";
import { auth, clerkClient, currentUser as currentClerkUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

type ClerkEmailAddress = {
  id?: string | null;
  emailAddress?: string | null;
  email_address?: string | null;
};

type ClerkIdentityLike = {
  id?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  primaryEmailAddressId?: string | null;
  primary_email_address_id?: string | null;
  emailAddresses?: ClerkEmailAddress[] | null;
  email_addresses?: ClerkEmailAddress[] | null;
};

type NormalizedClerkIdentity = {
  clerkId: string;
  name: string;
  email: string | null;
  handleCandidates: string[];
};

function normalizeEmailAddress(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function getEmailList(identity: ClerkIdentityLike) {
  return identity.emailAddresses ?? identity.email_addresses ?? [];
}

function getPrimaryEmailAddress(identity: ClerkIdentityLike) {
  const primaryEmailAddressId =
    identity.primaryEmailAddressId ?? identity.primary_email_address_id ?? null;
  const emailAddresses = getEmailList(identity);

  const primaryMatch = primaryEmailAddressId
    ? emailAddresses.find((emailAddress) => emailAddress.id === primaryEmailAddressId)
    : null;

  const firstEmail = primaryMatch ?? emailAddresses[0] ?? null;
  return normalizeEmailAddress(firstEmail?.emailAddress ?? firstEmail?.email_address ?? null);
}

function buildDisplayName(identity: ClerkIdentityLike, email: string | null) {
  const firstName = identity.firstName ?? identity.first_name ?? "";
  const lastName = identity.lastName ?? identity.last_name ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) {
    return fullName;
  }

  if (identity.username?.trim()) {
    return identity.username.trim();
  }

  if (email) {
    return email.split("@")[0];
  }

  return "Researcher";
}

function uniqueHandleCandidates(values: Array<string | null | undefined>) {
  const candidates = new Set<string>();

  for (const value of values) {
    const slug = slugify(value ?? "").slice(0, 32);

    if (slug) {
      candidates.add(slug);
    }
  }

  return [...candidates];
}

function normalizeClerkIdentity(identity: ClerkIdentityLike): NormalizedClerkIdentity | null {
  const clerkId = identity.id?.trim();

  if (!clerkId) {
    return null;
  }

  const email = getPrimaryEmailAddress(identity);
  const name = buildDisplayName(identity, email);
  const emailHandle = email ? email.split("@")[0] : null;
  const handleCandidates = uniqueHandleCandidates([
    identity.username,
    emailHandle,
    name,
    `${name}-${clerkId.slice(-6)}`,
    `researcher-${clerkId.slice(-6)}`,
  ]);

  return {
    clerkId,
    name,
    email,
    handleCandidates,
  };
}

async function findAvailableHandle(candidates: string[]) {
  const seedCandidates = candidates.length > 0 ? candidates : ["researcher"];

  for (const candidate of seedCandidates) {
    for (let suffix = 0; suffix < 1000; suffix += 1) {
      const suffixText = suffix === 0 ? "" : `-${suffix + 1}`;
      const maxBaseLength = 32 - suffixText.length;
      const base = candidate.slice(0, maxBaseLength).replace(/-+$/g, "");
      const handle = `${base}${suffixText}`;

      if (!handle) {
        continue;
      }

      const existing = await prisma.user.findUnique({
        where: { handle },
        select: { id: true },
      });

      if (!existing) {
        return handle;
      }
    }
  }

  throw new Error("Unable to allocate a unique handle.");
}

async function syncClerkIdentity(identity: NormalizedClerkIdentity) {
  const existingByClerkId = await prisma.user.findUnique({
    where: { clerkId: identity.clerkId },
  });

  if (existingByClerkId) {
    if (existingByClerkId.name !== identity.name) {
      return prisma.user.update({
        where: { id: existingByClerkId.id },
        data: { name: identity.name },
      });
    }

    return existingByClerkId;
  }

  if (identity.email) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: identity.email },
    });

    if (existingByEmail && !existingByEmail.clerkId) {
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          clerkId: identity.clerkId,
          name: identity.name,
        },
      });
    }
  }

  return prisma.user.create({
    data: {
      clerkId: identity.clerkId,
      name: identity.name,
      handle: await findAvailableHandle(identity.handleCandidates),
    },
  });
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function syncClerkUserFromIdentity(identity: ClerkIdentityLike) {
  const normalizedIdentity = normalizeClerkIdentity(identity);

  if (!normalizedIdentity) {
    throw new Error("Clerk identity payload is missing an id.");
  }

  return syncClerkIdentity(normalizedIdentity);
}

const getSyncedUserForClerkId = cache(async (clerkId: string): Promise<User> => {
  const existing = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (existing) {
    return existing;
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);
  return syncClerkUserFromIdentity(clerkUser);
});

async function getAuthenticatedClerkUserId() {
  try {
    const { userId } = await auth();
    return userId;
  } catch (error) {
    if (process.env.NODE_ENV === "test") {
      return null;
    }

    throw error;
  }
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await getAuthenticatedClerkUserId();

  if (!userId) {
    return null;
  }

  return getSyncedUserForClerkId(userId);
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

export async function getCurrentUserEmailAddress() {
  const clerkUser = await currentClerkUser();
  return clerkUser ? getPrimaryEmailAddress(clerkUser) : null;
}

export async function handleClerkUserDeleted(clerkId: string | null | undefined) {
  if (!clerkId) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) {
    return;
  }

  await prisma.$transaction([
    prisma.integrationKey.deleteMany({
      where: { userId: user.id },
    }),
    prisma.deviceCode.deleteMany({
      where: { userId: user.id },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        clerkId: null,
      },
    }),
  ]);
}
