import {
  RevisaoClient,
  type ReviewProblemItem,
} from "@/components/RevisaoClient";
import { requireTeamMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TopicItem } from "@/types";

export default async function RevisaoPage() {
  const currentUser = await requireTeamMember();

  const [reviewLogsRaw, topicsRaw] = await Promise.all([
    prisma.problemLog.findMany({
      where: { needsReview: true, teamId: currentUser.teamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            cfHandle: true,
            lcHandle: true,
            avatarColor: true,
          },
        },
        topics: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
          orderBy: { name: "asc" },
        },
        fromProposals: {
          include: {
            proposer: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.topic.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const problems: ReviewProblemItem[] = reviewLogsRaw.map((log) => ({
    id: log.id,
    userId: log.userId,
    title: log.title,
    url: log.url,
    platform: log.platform,
    perceivedDifficulty: log.perceivedDifficulty,
    solved: log.solved,
    notes: log.notes,
    needsReview: log.needsReview,
    reviewedAt: log.reviewedAt ? log.reviewedAt.toISOString() : null,
    attemptCount: log.attemptCount,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    user: log.user,
    topics: log.topics,
    fromProposalProposerName: log.fromProposals[0]?.proposer.name ?? null,
  }));

  const topics: TopicItem[] = topicsRaw;

  return (
    <RevisaoClient
      currentUserId={currentUser.id}
      problems={problems}
      topics={topics}
    />
  );
}
