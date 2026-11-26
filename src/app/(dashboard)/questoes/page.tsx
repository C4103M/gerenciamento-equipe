import type { Difficulty, Platform, Prisma } from "@prisma/client";
import type { Metadata } from "next";
import { QuestoesClient } from "@/components/QuestoesClient";
import { requireTeamMember } from "@/lib/auth";
import { getCachedTeamMembers, getCachedTopics } from "@/lib/cache";
import {
  buildPrismaProblemPeriodWhere,
  parsePeriodSearchParams,
} from "@/lib/period";
import { prisma } from "@/lib/prisma";
import { getLogIdsWithSolutionCode } from "@/lib/solutions";
import type { MemberSummary, ProblemLogItem, TopicItem } from "@/types";

export const metadata: Metadata = {
  title: "Questões — Nunca Foi ICPC",
};

const PAGE_SIZE = 20;

const VALID_PLATFORMS = new Set<Platform>([
  "CODEFORCES",
  "LEETCODE",
  "ATCODER",
  "BEECROWD",
  "CSES",
  "OUTRO",
]);

const VALID_DIFFICULTIES = new Set<Difficulty>([
  "FACIL",
  "MEDIO",
  "DIFICIL",
  "MUITO_DIFICIL",
]);

const MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  cfHandle: true,
  lcHandle: true,
  cfLastSyncedAt: true,
  lcLastSyncedAt: true,
  avatarColor: true,
} as const;

const TOPIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  color: true,
} as const;

const PROBLEM_LOG_SELECT = {
  id: true,
  userId: true,
  title: true,
  url: true,
  platform: true,
  externalId: true,
  externalRating: true,
  perceivedDifficulty: true,
  solved: true,
  notes: true,
  solutionUrl: true,
  needsReview: true,
  reviewedAt: true,
  attemptCount: true,
  createdAt: true,
  updatedAt: true,
  user: { select: MEMBER_SELECT },
  topics: {
    select: TOPIC_SELECT,
    orderBy: { name: "asc" as const },
  },
} as const;

type StatusFilter = "ALL" | "SOLVED" | "REVIEW";

function parseStatusFilter(raw?: string): StatusFilter {
  if (raw === "SOLVED" || raw === "REVIEW") return raw;
  return "ALL";
}

export default async function QuestoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    member?: string;
    topic?: string;
    platform?: string;
    difficulty?: string;
    status?: string;
    periodo?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const [resolvedParams, currentUser] = await Promise.all([
    searchParams,
    requireTeamMember(),
  ]);

  const q = resolvedParams.q?.trim() ?? "";
  const member = resolvedParams.member?.trim() || "ALL";
  const topic = resolvedParams.topic?.trim() || "ALL";
  const platform: "ALL" | Platform =
    resolvedParams.platform &&
    VALID_PLATFORMS.has(resolvedParams.platform as Platform)
      ? (resolvedParams.platform as Platform)
      : "ALL";
  const difficulty: "ALL" | Difficulty =
    resolvedParams.difficulty &&
    VALID_DIFFICULTIES.has(resolvedParams.difficulty as Difficulty)
      ? (resolvedParams.difficulty as Difficulty)
      : "ALL";
  const status = parseStatusFilter(resolvedParams.status);
  const periodFilter = parsePeriodSearchParams(resolvedParams);

  const parsedPage = Number.parseInt(resolvedParams.page ?? "1", 10);
  const requestedPage =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const andConditions: Prisma.ProblemLogWhereInput[] = [
    { teamId: currentUser.teamId },
  ];

  if (q) {
    andConditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (member !== "ALL") {
    andConditions.push({ userId: member });
  }
  if (topic !== "ALL") {
    andConditions.push({ topics: { some: { id: topic } } });
  }
  if (platform !== "ALL") {
    andConditions.push({ platform });
  }
  if (difficulty !== "ALL") {
    andConditions.push({ perceivedDifficulty: difficulty });
  }
  if (status === "SOLVED") {
    andConditions.push({ solved: true });
  } else if (status === "REVIEW") {
    andConditions.push({ needsReview: true });
  }

  const periodWhere = buildPrismaProblemPeriodWhere(periodFilter);
  if (Object.keys(periodWhere).length > 0) {
    andConditions.push(periodWhere as Prisma.ProblemLogWhereInput);
  }

  const where: Prisma.ProblemLogWhereInput =
    andConditions.length === 1 ? andConditions[0] : { AND: andConditions };

  const hasActiveFilters =
    q.length > 0 ||
    member !== "ALL" ||
    topic !== "ALL" ||
    platform !== "ALL" ||
    difficulty !== "ALL" ||
    status !== "ALL" ||
    periodFilter.preset !== "all";

  const [initialLogsRaw, filteredCount, totalTeamCountRaw, topics, members] =
    await Promise.all([
      prisma.problemLog.findMany({
        where,
        select: PROBLEM_LOG_SELECT,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        skip: (requestedPage - 1) * PAGE_SIZE,
      }),
      prisma.problemLog.count({ where }),
      hasActiveFilters
        ? prisma.problemLog.count({ where: { teamId: currentUser.teamId } })
        : Promise.resolve(null),
      getCachedTopics(),
      getCachedTeamMembers(currentUser.teamId),
    ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const problemLogsRaw =
    requestedPage > totalPages && filteredCount > 0
      ? await prisma.problemLog.findMany({
          where,
          select: PROBLEM_LOG_SELECT,
          orderBy: { createdAt: "desc" },
          take: PAGE_SIZE,
          skip: (currentPage - 1) * PAGE_SIZE,
        })
      : initialLogsRaw;

  const idsWithCode = await getLogIdsWithSolutionCode(
    problemLogsRaw.filter((log) => log.solved).map((log) => log.id)
  );

  const initialProblems: ProblemLogItem[] = problemLogsRaw.map((log) => ({
    id: log.id,
    userId: log.userId,
    title: log.title,
    url: log.url,
    platform: log.platform,
    externalId: log.externalId,
    externalRating: log.externalRating,
    perceivedDifficulty: log.perceivedDifficulty,
    solved: log.solved,
    notes: log.notes,
    solutionUrl: log.solutionUrl,
    hasSolutionCode: idsWithCode.has(log.id),
    needsReview: log.needsReview,
    reviewedAt: log.reviewedAt ? log.reviewedAt.toISOString() : null,
    attemptCount: log.attemptCount,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    user: {
      ...log.user,
      cfLastSyncedAt: log.user.cfLastSyncedAt
        ? log.user.cfLastSyncedAt.toISOString()
        : null,
      lcLastSyncedAt: log.user.lcLastSyncedAt
        ? log.user.lcLastSyncedAt.toISOString()
        : null,
    },
    topics: log.topics,
  }));

  const serializedTopics: TopicItem[] = topics;
  const serializedMembers: MemberSummary[] = members;

  return (
    <QuestoesClient
      currentUserId={currentUser.id}
      initialProblems={initialProblems}
      filteredCount={filteredCount}
      totalTeamCount={totalTeamCountRaw ?? filteredCount}
      currentPage={currentPage}
      pageSize={PAGE_SIZE}
      topics={serializedTopics}
      members={serializedMembers}
      initialFilters={{
        q,
        member,
        topic,
        platform,
        difficulty,
        status,
        period: periodFilter,
      }}
    />
  );
}
