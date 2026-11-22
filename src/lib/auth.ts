import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";
import type { TeamSummary } from "@/types";

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
});

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      cfHandle: true,
      lcHandle: true,
      avatarColor: true,
      createdAt: true,
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          inviteCode: true,
          description: true,
          maxMembers: true,
        },
      },
    },
  });

  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (user) {
    return user;
  }

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  redirect("/api/auth/clear-session");
}

export async function requireGlobalAdmin() {
  const user = await requireUser();
  if (user.role !== "GLOBAL_ADMIN") {
    redirect("/");
  }
  return user;
}

export async function requireTeamMember(): Promise<
  Awaited<ReturnType<typeof requireUser>> & {
    teamId: string;
    team: TeamSummary;
  }
> {
  const user = await requireUser();
  if (!user.teamId || !user.team) {
    if (user.role === "GLOBAL_ADMIN") {
      redirect("/admin");
    }
    redirect("/sem-equipe");
  }
  return {
    ...user,
    teamId: user.teamId,
    team: user.team,
  };
}
