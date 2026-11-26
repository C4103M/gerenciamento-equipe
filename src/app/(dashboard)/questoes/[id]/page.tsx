import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  type OverviewLogItem,
  type OverviewProposalItem,
  type ProblemOverviewData,
  ProblemOverviewClient,
} from "@/components/ProblemOverviewClient";
import { getCurrentUser, requireTeamMember } from "@/lib/auth";
import { getCachedTeamMembers, getCachedTopics } from "@/lib/cache";
import { parseCodeforcesRef } from "@/lib/codeforces";
import { parseLeetCodeRef } from "@/lib/leetcode";
import { prisma } from "@/lib/prisma";
import { getLogIdsWithSolutionCode } from "@/lib/solutions";
import type { TopicItem } from "@/types";

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

const OVERVIEW_LOG_SELECT = {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!user?.teamId) {
    return { title: "Questão — Nunca Foi ICPC" };
  }

  const [log, proposal] = await Promise.all([
    prisma.problemLog.findFirst({
      where: { id, teamId: user.teamId },
      select: { title: true },
    }),
    prisma.proposedProblem.findFirst({
      where: { id, teamId: user.teamId },
      select: { title: true },
    }),
  ]);

  const title = log?.title ?? proposal?.title;
  return {
    title: title ? `${title} — Nunca Foi ICPC` : "Questão — Nunca Foi ICPC",
  };
}

export default async function ProblemOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, currentUser] = await Promise.all([
    params,
    requireTeamMember(),
  ]);

  const anchorLog = await prisma.problemLog.findFirst({
    where: { id, teamId: currentUser.teamId },
    select: {
      id: true,
      title: true,
      url: true,
      platform: true,
      externalId: true,
      externalRating: true,
      topics: { select: TOPIC_SELECT, orderBy: { name: "asc" } },
    },
  });

  const anchorProposal = !anchorLog
    ? await prisma.proposedProblem.findFirst({
        where: { id, teamId: currentUser.teamId },
        select: {
          id: true,
          title: true,
          url: true,
          platform: true,
          externalId: true,
          resultingLogId: true,
          topics: { select: TOPIC_SELECT, orderBy: { name: "asc" } },
        },
      })
    : null;

  const anchor = anchorLog ?? anchorProposal;
  if (!anchor) {
    notFound();
  }

  const canonicalExternalId =
    anchor.externalId ??
    parseCodeforcesRef(anchor.url)?.externalId ??
    parseLeetCodeRef(anchor.url)?.externalId ??
    null;

  const trimmedUrl = anchor.url.trim();
  const strippedUrl = trimmedUrl.replace(/\/+$/, "");
  const urlVariants = Array.from(
    new Set(
      [
        trimmedUrl,
        strippedUrl,
        strippedUrl ? `${strippedUrl}/` : "",
      ].filter(Boolean)
    )
  );

  const anchorLogId = anchorLog?.id ?? anchorProposal?.resultingLogId ?? null;
  const anchorProposalId = anchorProposal?.id ?? null;

  const logOrConditions: Prisma.ProblemLogWhereInput[] = [];
  if (anchorLogId) {
    logOrConditions.push({ id: anchorLogId });
  }
  if (canonicalExternalId) {
    logOrConditions.push({ externalId: canonicalExternalId });
  }
  if (urlVariants.length > 0) {
    logOrConditions.push({ url: { in: urlVariants } });
  }

  const [matchedLogsRaw, members, allTopics] = await Promise.all([
    prisma.problemLog.findMany({
      where: {
        teamId: currentUser.teamId,
        OR: logOrConditions,
      },
      select: OVERVIEW_LOG_SELECT,
      orderBy: [{ solved: "desc" }, { createdAt: "desc" }],
    }),
    getCachedTeamMembers(currentUser.teamId),
    getCachedTopics(),
  ]);

  const matchedLogIds = matchedLogsRaw.map((log) => log.id);

  const proposalOrConditions: Prisma.ProposedProblemWhereInput[] = [];
  if (anchorProposalId) {
    proposalOrConditions.push({ id: anchorProposalId });
  }
  if (canonicalExternalId) {
    proposalOrConditions.push({ externalId: canonicalExternalId });
  }
  if (urlVariants.length > 0) {
    proposalOrConditions.push({ url: { in: urlVariants } });
  }
  if (matchedLogIds.length > 0) {
    proposalOrConditions.push({ resultingLogId: { in: matchedLogIds } });
  }

  const proposalsRaw = await prisma.proposedProblem.findMany({
    where: {
      teamId: currentUser.teamId,
      OR: proposalOrConditions,
    },
    include: {
      proposer: { select: MEMBER_SELECT },
      assignee: { select: MEMBER_SELECT },
      topics: { select: TOPIC_SELECT, orderBy: { name: "asc" } },
      resultingLog: {
        select: {
          id: true,
          solved: true,
          solutionUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const idsWithCode = await getLogIdsWithSolutionCode([
    ...matchedLogsRaw.filter((log) => log.solved).map((log) => log.id),
    ...proposalsRaw
      .map((p) => (p.resultingLog?.solved ? p.resultingLog.id : ""))
      .filter(Boolean),
  ]);

  const logs: OverviewLogItem[] = matchedLogsRaw.map((log) => ({
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

  const proposals: OverviewProposalItem[] = proposalsRaw.map((p) => ({
    id: p.id,
    proposerId: p.proposerId,
    assigneeId: p.assigneeId,
    title: p.title,
    url: p.url,
    platform: p.platform,
    suggestedDifficulty: p.suggestedDifficulty,
    message: p.message,
    status: p.status,
    resultingLogId: p.resultingLogId,
    solutionUrl: p.resultingLog?.solved ? p.resultingLog.solutionUrl : null,
    hasSolutionCode: Boolean(
      p.resultingLog?.solved && idsWithCode.has(p.resultingLog.id)
    ),
    viewedAt: p.viewedAt ? p.viewedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    proposer: {
      ...p.proposer,
      cfLastSyncedAt: p.proposer.cfLastSyncedAt
        ? p.proposer.cfLastSyncedAt.toISOString()
        : null,
      lcLastSyncedAt: p.proposer.lcLastSyncedAt
        ? p.proposer.lcLastSyncedAt.toISOString()
        : null,
    },
    assignee: {
      ...p.assignee,
      cfLastSyncedAt: p.assignee.cfLastSyncedAt
        ? p.assignee.cfLastSyncedAt.toISOString()
        : null,
      lcLastSyncedAt: p.assignee.lcLastSyncedAt
        ? p.assignee.lcLastSyncedAt.toISOString()
        : null,
    },
    topics: p.topics,
  }));

  const combinedTopicsMap = new Map<string, TopicItem>();
  for (const t of anchor.topics) {
    combinedTopicsMap.set(t.id, t);
  }
  for (const log of logs) {
    for (const t of log.topics) {
      combinedTopicsMap.set(t.id, t);
    }
  }
  for (const proposal of proposals) {
    for (const t of proposal.topics) {
      combinedTopicsMap.set(t.id, t);
    }
  }

  const combinedTopics = Array.from(combinedTopicsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );

  const problemData: ProblemOverviewData = {
    anchorId: anchor.id,
    title: anchorLog?.title ?? matchedLogsRaw[0]?.title ?? anchor.title,
    url: anchorLog?.url ?? matchedLogsRaw[0]?.url ?? anchor.url,
    platform: anchorLog?.platform ?? matchedLogsRaw[0]?.platform ?? anchor.platform,
    externalId: canonicalExternalId,
    externalRating:
      anchorLog?.externalRating ??
      matchedLogsRaw.find((log) => log.externalRating !== null)
        ?.externalRating ??
      null,
    topics: combinedTopics,
  };

  return (
    <ProblemOverviewClient
      currentUserId={currentUser.id}
      problem={problemData}
      logs={logs}
      proposals={proposals}
      members={members}
      allTopics={allTopics}
    />
  );
}
