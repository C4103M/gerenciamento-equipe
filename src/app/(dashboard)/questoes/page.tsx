import type { Metadata } from "next";
import { QuestoesClient } from "@/components/QuestoesClient";
import { requireTeamMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MemberSummary, ProblemLogItem, TopicItem } from "@/types";

export const metadata: Metadata = {
  title: "Questões — Nunca Foi ICPC",
};

const MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  cfHandle: true,
  lcHandle: true,
  avatarColor: true,
} as const;

const TOPIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  color: true,
} as const;

export default async function QuestoesPage() {
  const currentUser = await requireTeamMember();

  const [problemLogsRaw, topicsRaw, membersRaw] = await Promise.all([
    prisma.problemLog.findMany({
      where: { teamId: currentUser.teamId },
      include: {
        user: { select: MEMBER_SELECT },
        topics: {
          select: TOPIC_SELECT,
          orderBy: { name: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.topic.findMany({
      select: TOPIC_SELECT,
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { teamId: currentUser.teamId },
      select: MEMBER_SELECT,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const initialProblems: ProblemLogItem[] = problemLogsRaw.map((log) => ({
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
  }));

  const topics: TopicItem[] = topicsRaw;
  const members: MemberSummary[] = membersRaw;

  return (
    <QuestoesClient
      currentUserId={currentUser.id}
      initialProblems={initialProblems}
      topics={topics}
      members={members}
    />
  );
}
