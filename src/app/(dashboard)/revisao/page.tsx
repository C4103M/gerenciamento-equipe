import type { Prisma } from "@prisma/client";
import {
  RevisaoClient,
  type ReviewProblemItem,
} from "@/components/RevisaoClient";
import { requireTeamMember } from "@/lib/auth";
import { getCachedTopics } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export default async function RevisaoPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    topic?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const [resolvedParams, currentUser] = await Promise.all([
    searchParams,
    requireTeamMember(),
  ]);

  const scope: "mine" | "team" =
    resolvedParams.scope === "team" ? "team" : "mine";
  const topic = resolvedParams.topic?.trim() || "all";
  const q = resolvedParams.q?.trim() ?? "";

  const parsedPage = Number.parseInt(resolvedParams.page ?? "1", 10);
  const requestedPage =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const andConditions: Prisma.ProblemLogWhereInput[] = [
    { needsReview: true, teamId: currentUser.teamId },
  ];

  if (scope === "mine") {
    andConditions.push({ userId: currentUser.id });
  }
  if (topic !== "all") {
    andConditions.push({ topics: { some: { id: topic } } });
  }
  if (q) {
    andConditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { url: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { topics: { some: { name: { contains: q, mode: "insensitive" } } } },
        {
          fromProposals: {
            some: { proposer: { name: { contains: q, mode: "insensitive" } } },
          },
        },
      ],
    });
  }

  const where: Prisma.ProblemLogWhereInput =
    andConditions.length === 1 ? andConditions[0] : { AND: andConditions };

  const reviewInclude = {
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
      orderBy: { name: "asc" as const },
    },
    fromProposals: {
      include: {
        proposer: {
          select: { name: true },
        },
      },
    },
  };

  const [initialLogsRaw, filteredCount, myTotalCount, teamTotalCount, topics] =
    await Promise.all([
      prisma.problemLog.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: "asc" },
        take: PAGE_SIZE,
        skip: (requestedPage - 1) * PAGE_SIZE,
      }),
      prisma.problemLog.count({ where }),
      prisma.problemLog.count({
        where: {
          needsReview: true,
          teamId: currentUser.teamId,
          userId: currentUser.id,
        },
      }),
      prisma.problemLog.count({
        where: {
          needsReview: true,
          teamId: currentUser.teamId,
        },
      }),
      getCachedTopics(),
    ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const reviewLogsRaw =
    requestedPage > totalPages && filteredCount > 0
      ? await prisma.problemLog.findMany({
          where,
          include: reviewInclude,
          orderBy: { createdAt: "asc" },
          take: PAGE_SIZE,
          skip: (currentPage - 1) * PAGE_SIZE,
        })
      : initialLogsRaw;

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

  return (
    <RevisaoClient
      currentUserId={currentUser.id}
      problems={problems}
      filteredCount={filteredCount}
      myTotalCount={myTotalCount}
      teamTotalCount={teamTotalCount}
      currentPage={currentPage}
      pageSize={PAGE_SIZE}
      topics={topics}
      initialScope={scope}
      initialTopicId={topic}
      initialSearch={q}
    />
  );
}
