import { randomBytes, createHash } from "node:crypto";
import { cache } from "react";

import { addDays } from "date-fns";
import { type User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "agent_science_session";
const SESSION_DURATION_DAYS = 30;
const MAX_ACTIVE_SESSIONS = 12;
const SESSION_TOUCH_INTERVAL_MS = 15 * 60 * 1000;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = addDays(new Date(), SESSION_DURATION_DAYS);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${userId}))
    `;

    await transaction.session.deleteMany({
      where: {
        userId,
        expiresAt: {
          lt: now,
        },
      },
    });

    await transaction.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        expiresAt,
      },
    });

    const overflowSessions = await transaction.session.findMany({
      where: {
        userId,
        expiresAt: {
          gte: now,
        },
      },
      orderBy: [
        {
          lastUsedAt: "desc",
        },
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: {
        id: true,
      },
      skip: MAX_ACTIVE_SESSIONS,
    });

    if (overflowSessions.length > 0) {
      await transaction.session.deleteMany({
        where: {
          id: {
            in: overflowSessions.map((session) => session.id),
          },
        },
      });
    }
  });

  return token;
}

export function applySessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

async function getUserFromCookieStore() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    }).catch(() => undefined);
    return null;
  }

  if (Date.now() - session.lastUsedAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    }).catch(() => undefined);
  }

  return session.user;
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  return getUserFromCookieStore();
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}
