import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { MemberSummary, NotificationItem, TopicItem } from "@/types";

export const CACHE_TAGS = {
  topics: "topics",
  teamMembers: (teamId: string) => `team-members:${teamId}`,
  teamStats: (teamId: string) => `team-stats:${teamId}`,
  userNav: (userId: string) => `user-nav:${userId}`,
} as const;

export interface UserNavData {
  unreadNotifications: number;
  recentNotifications: NotificationItem[];
  myReviewCount: number;
  myPendingProposalsCount: number;
}

/** Cached global topic list, invalidated when topics are created. */
export const getCachedTopics = unstable_cache(
  async (): Promise<TopicItem[]> => {
    return prisma.topic.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
      },
      orderBy: { name: "asc" },
    });
  },
  ["global-topics"],
  {
    tags: [CACHE_TAGS.topics],
    revalidate: 300,
  }
);

/** Cached team member list with JSON-serialized sync timestamps. */
export async function getCachedTeamMembers(
  teamId: string
): Promise<MemberSummary[]> {
  return unstable_cache(
    async (): Promise<MemberSummary[]> => {
      const membersRaw = await prisma.user.findMany({
        where: { teamId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          cfHandle: true,
          lcHandle: true,
          cfLastSyncedAt: true,
          lcLastSyncedAt: true,
          avatarColor: true,
          role: true,
          teamId: true,
        },
      });

      return membersRaw.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        cfHandle: m.cfHandle,
        lcHandle: m.lcHandle,
        cfLastSyncedAt: m.cfLastSyncedAt ? m.cfLastSyncedAt.toISOString() : null,
        lcLastSyncedAt: m.lcLastSyncedAt ? m.lcLastSyncedAt.toISOString() : null,
        avatarColor: m.avatarColor,
        role: m.role,
        teamId: m.teamId,
      }));
    },
    ["team-members", teamId],
    {
      tags: [CACHE_TAGS.teamMembers(teamId)],
      revalidate: 60,
    }
  )();
}

/** Cached navbar notification and counter summary for the authenticated user. */
export async function getCachedUserNavData(
  userId: string,
  teamId: string | null
): Promise<UserNavData> {
  const tags = [
    CACHE_TAGS.userNav(userId),
    ...(teamId ? [CACHE_TAGS.teamStats(teamId)] : []),
  ];

  return unstable_cache(
    async (): Promise<UserNavData> => {
      const [
        unreadNotifications,
        recentNotificationsRaw,
        myReviewCount,
        myPendingProposalsCount,
      ] = await Promise.all([
        prisma.notification.count({
          where: { userId, read: false },
        }),
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
        teamId
          ? prisma.problemLog.count({
              where: {
                userId,
                teamId,
                needsReview: true,
              },
            })
          : Promise.resolve(0),
        teamId
          ? prisma.proposedProblem.count({
              where: {
                assigneeId: userId,
                teamId,
                status: { in: ["PENDENTE", "VISUALIZADO"] },
              },
            })
          : Promise.resolve(0),
      ]);

      return {
        unreadNotifications,
        recentNotifications: recentNotificationsRaw.map((n) => ({
          id: n.id,
          userId: n.userId,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          read: n.read,
          emailSent: n.emailSent,
          proposedProblemId: n.proposedProblemId,
          createdAt: n.createdAt.toISOString(),
        })),
        myReviewCount,
        myPendingProposalsCount,
      };
    },
    ["user-nav", userId, teamId ?? "no-team"],
    {
      tags,
      revalidate: 30,
    }
  )();
}
