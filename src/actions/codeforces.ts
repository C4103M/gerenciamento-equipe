"use server";

import type { Difficulty, ProposalStatus } from "@prisma/client";
import { revalidatePath, updateTag } from "next/cache";
import { requireTeamMember } from "@/lib/auth";
import { CACHE_TAGS, getCachedTopics } from "@/lib/cache";
import {
  aggregateCodeforcesSubmissions,
  fetchCodeforcesProblem,
  fetchCodeforcesUserStatus,
  formatCodeforcesTitle,
  mapCfRatingToDifficulty,
  mapCfTagsToTopicIds,
  parseCodeforcesRef,
} from "@/lib/codeforces";
import { NotificationService } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sanitizeHttpUrl } from "@/lib/url";
import type { TopicItem } from "@/types";

const MAX_BATCH_ITEMS = 500;
const MAX_TITLE_LENGTH = 300;
const MAX_NOTES_LENGTH = 10000;

export type SyncItemAction =
  | "NEW_SOLVED"
  | "NEW_ATTEMPTED"
  | "UPSOLVE_REVIEW"
  | "UPDATE_ATTEMPTS"
  | "LINK_PROPOSAL";

export interface SyncMatchingProposalInfo {
  proposalId: string;
  proposerName: string;
  proposalTitle: string;
  currentStatus: ProposalStatus;
  targetStatus: "FEITO" | "TENTOU";
}

export interface SyncPreviewItem {
  key: string;
  memberId: string;
  memberName: string;
  externalId: string;
  code: string;
  title: string;
  canonicalUrl: string;
  rating: number | null;
  rawTags: string[];
  action: SyncItemAction;
  solved: boolean;
  needsReview: boolean;
  attemptCount: number;
  perceivedDifficulty: Difficulty;
  topicIds: string[];
  activityAt: string;
  existingLogId: string | null;
  existingAttemptCount: number | null;
  notes: string;
  matchingProposals: SyncMatchingProposalInfo[];
}

export interface MemberSyncPreview {
  memberId: string;
  memberName: string;
  cfHandle: string;
  totalSubmissionsFetched: number;
  totalProblemsFound: number;
  alreadySyncedCount: number;
  skippedGraceCount: number;
  skippedUnresolvedCount: number;
  items: SyncPreviewItem[];
}

export interface SyncCommitItem {
  externalId: string;
  title: string;
  canonicalUrl: string;
  rating: number | null;
  action: SyncItemAction;
  solved: boolean;
  needsReview: boolean;
  attemptCount: number;
  perceivedDifficulty: Difficulty;
  topicIds: string[];
  activityAt: string;
  existingLogId: string | null;
  notes: string;
}

export interface BatchCommitSummary {
  createdSolved: number;
  createdAttempted: number;
  upsolvedReview: number;
  updatedAttempts: number;
  proposalsUpdated: number;
  skippedDuplicates: number;
}

export interface CodeforcesLookupResult {
  title: string;
  canonicalUrl: string;
  externalId: string;
  contestId: number;
  index: string;
  rating: number | null;
  suggestedDifficulty: Difficulty | null;
  matchedTopicIds: string[];
  rawTags: string[];
}

const FALLBACK_TOPICS_TO_ENSURE = [
  {
    name: "Implementação / Ad-Hoc",
    slug: "implementacao-ad-hoc",
    color: "#94a3b8",
    isDefault: true,
  },
  {
    name: "Ordenação",
    slug: "ordenacao",
    color: "#f59e0b",
    isDefault: true,
  },
] as const;

async function ensureCodeforcesFallbackTopics(): Promise<TopicItem[]> {
  const existing = await getCachedTopics();

  const existingSlugs = new Set(existing.map((t) => t.slug));
  const missing = FALLBACK_TOPICS_TO_ENSURE.filter(
    (t) => !existingSlugs.has(t.slug)
  );

  if (missing.length === 0) {
    return existing;
  }

  await prisma.topic.createMany({
    data: missing.map((topic) => ({
      name: topic.name,
      slug: topic.slug,
      color: topic.color,
      isDefault: topic.isDefault,
    })),
    skipDuplicates: true,
  });

  updateTag(CACHE_TAGS.topics);

  return prisma.topic.findMany({
    select: { id: true, name: true, slug: true, color: true },
    orderBy: { name: "asc" },
  });
}

function getCanonicalExternalId(
  storedExternalId: string | null,
  url: string
): string | null {
  if (storedExternalId) return storedExternalId;
  return parseCodeforcesRef(url)?.externalId ?? null;
}

function logPriority(log: {
  solved: boolean;
  needsReview: boolean;
  updatedAt: Date;
}): number {
  if (log.needsReview && !log.solved) return 4;
  if (log.needsReview) return 3;
  if (log.solved) return 2;
  return 1;
}

export async function lookupCodeforcesProblemAction(rawInput: string): Promise<{
  data?: CodeforcesLookupResult;
  error?: string;
}> {
  await requireTeamMember();

  const ref = parseCodeforcesRef(rawInput);
  if (!ref) {
    return {
      error:
        "Informe uma URL válida do Codeforces ou código (ex: 1800E2).",
    };
  }

  const [cfResult, allTopics] = await Promise.all([
    fetchCodeforcesProblem(ref.contestId, ref.index, { isGym: ref.isGym }),
    ensureCodeforcesFallbackTopics(),
  ]);

  if (cfResult.error || !cfResult.problem) {
    return {
      error: cfResult.error ?? "Não foi possível obter os dados do problema.",
    };
  }

  const problem = cfResult.problem;
  const matchedTopicIds = mapCfTagsToTopicIds(
    problem.tags,
    allTopics,
    "implementacao-ad-hoc"
  );

  return {
    data: {
      title: formatCodeforcesTitle(
        problem.contestId,
        problem.index,
        problem.name
      ),
      canonicalUrl: ref.canonicalUrl,
      externalId: ref.externalId,
      contestId: problem.contestId,
      index: problem.index,
      rating: problem.rating,
      suggestedDifficulty: mapCfRatingToDifficulty(problem.rating),
      matchedTopicIds,
      rawTags: problem.tags,
    },
  };
}

export async function previewMemberCodeforcesSyncAction(params: {
  memberId: string;
  scope: "all" | "recent200";
  graceMinutes: number;
  includeUnresolved: boolean;
}): Promise<{
  preview?: MemberSyncPreview;
  error?: string;
}> {
  const currentUser = await requireTeamMember();

  const targetMember = await prisma.user.findUnique({
    where: { id: params.memberId },
    select: {
      id: true,
      name: true,
      teamId: true,
      cfHandle: true,
    },
  });

  if (!targetMember || targetMember.teamId !== currentUser.teamId) {
    return { error: "Membro não encontrado nesta equipe." };
  }

  const cfHandle = targetMember.cfHandle?.trim();
  if (!cfHandle) {
    return {
      error: `${targetMember.name} não possui handle do Codeforces cadastrado.`,
    };
  }

  const count = params.scope === "recent200" ? 200 : undefined;
  const cfStatusResult = await fetchCodeforcesUserStatus(cfHandle, count);
  if (cfStatusResult.error || !cfStatusResult.submissions) {
    return {
      error:
        cfStatusResult.error ??
        `Erro ao buscar submissões de ${targetMember.name} no Codeforces.`,
    };
  }

  const graceMinutes = Math.max(0, Math.floor(params.graceMinutes));
  const aggregated = aggregateCodeforcesSubmissions(
    cfStatusResult.submissions,
    graceMinutes
  );

  const [existingLogs, openProposals, allTopics] = await Promise.all([
    prisma.problemLog.findMany({
      where: {
        teamId: currentUser.teamId,
        userId: targetMember.id,
      },
      select: {
        id: true,
        url: true,
        externalId: true,
        externalRating: true,
        perceivedDifficulty: true,
        solved: true,
        needsReview: true,
        attemptCount: true,
        notes: true,
        updatedAt: true,
        topics: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.proposedProblem.findMany({
      where: {
        teamId: currentUser.teamId,
        assigneeId: targetMember.id,
        status: { in: ["PENDENTE", "VISUALIZADO", "TENTOU"] },
      },
      select: {
        id: true,
        title: true,
        url: true,
        externalId: true,
        status: true,
        suggestedDifficulty: true,
        proposer: { select: { name: true } },
      },
    }),
    ensureCodeforcesFallbackTopics(),
  ]);

  const logByExternalId = new Map<string, (typeof existingLogs)[number]>();
  for (const log of existingLogs) {
    const extId = getCanonicalExternalId(log.externalId, log.url);
    if (!extId) continue;
    const prev = logByExternalId.get(extId);
    if (
      !prev ||
      logPriority(log) > logPriority(prev) ||
      (logPriority(log) === logPriority(prev) &&
        log.updatedAt.getTime() > prev.updatedAt.getTime())
    ) {
      logByExternalId.set(extId, log);
    }
  }

  const proposalsByExternalId = new Map<
    string,
    Array<(typeof openProposals)[number]>
  >();
  for (const proposal of openProposals) {
    const extId = getCanonicalExternalId(proposal.externalId, proposal.url);
    if (!extId) continue;
    const list = proposalsByExternalId.get(extId);
    if (list) {
      list.push(proposal);
    } else {
      proposalsByExternalId.set(extId, [proposal]);
    }
  }

  let alreadySyncedCount = 0;
  let skippedGraceCount = 0;
  let skippedUnresolvedCount = 0;
  const items: SyncPreviewItem[] = [];

  for (const item of aggregated) {
    const existingLog = logByExternalId.get(item.externalId);
    const matchingRaw = proposalsByExternalId.get(item.externalId) ?? [];
    const matchingProposals: SyncMatchingProposalInfo[] = matchingRaw.map(
      (p) => ({
        proposalId: p.id,
        proposerName: p.proposer.name,
        proposalTitle: p.title,
        currentStatus: p.status,
        targetStatus: item.solved ? "FEITO" : "TENTOU",
      })
    );

    const mappedTopics = mapCfTagsToTopicIds(
      item.tags,
      allTopics,
      "implementacao-ad-hoc"
    );
    const difficultyFromRating: Difficulty =
      mapCfRatingToDifficulty(item.rating) ??
      matchingRaw[0]?.suggestedDifficulty ??
      "MEDIO";

    if (!existingLog) {
      if (item.solved) {
        items.push({
          key: `${targetMember.id}:${item.externalId}`,
          memberId: targetMember.id,
          memberName: targetMember.name,
          externalId: item.externalId,
          code: item.code,
          title: item.title,
          canonicalUrl: item.canonicalUrl,
          rating: item.rating,
          rawTags: item.tags,
          action: "NEW_SOLVED",
          solved: true,
          needsReview: false,
          attemptCount: item.attemptCount,
          perceivedDifficulty: difficultyFromRating,
          topicIds: mappedTopics,
          activityAt: item.activityAt,
          existingLogId: null,
          existingAttemptCount: null,
          notes: "",
          matchingProposals,
        });
      } else {
        if (!params.includeUnresolved) {
          skippedUnresolvedCount += 1;
          continue;
        }
        if (item.withinGraceWindow) {
          skippedGraceCount += 1;
          continue;
        }
        items.push({
          key: `${targetMember.id}:${item.externalId}`,
          memberId: targetMember.id,
          memberName: targetMember.name,
          externalId: item.externalId,
          code: item.code,
          title: item.title,
          canonicalUrl: item.canonicalUrl,
          rating: item.rating,
          rawTags: item.tags,
          action: "NEW_ATTEMPTED",
          solved: false,
          needsReview: true,
          attemptCount: item.attemptCount,
          perceivedDifficulty: difficultyFromRating,
          topicIds: mappedTopics,
          activityAt: item.activityAt,
          existingLogId: null,
          existingAttemptCount: null,
          notes: "",
          matchingProposals,
        });
      }
      continue;
    }

    const existingTopicIds =
      existingLog.topics.length > 0
        ? existingLog.topics.map((t) => t.id)
        : mappedTopics;

    if (item.solved) {
      const activityMs = new Date(item.activityAt).getTime();
      const isNewerOk = activityMs > existingLog.updatedAt.getTime();
      const shouldUpsolve =
        !existingLog.solved || (existingLog.needsReview && isNewerOk);

      if (shouldUpsolve) {
        items.push({
          key: `${targetMember.id}:${item.externalId}`,
          memberId: targetMember.id,
          memberName: targetMember.name,
          externalId: item.externalId,
          code: item.code,
          title: item.title,
          canonicalUrl: item.canonicalUrl,
          rating: item.rating,
          rawTags: item.tags,
          action: "UPSOLVE_REVIEW",
          solved: true,
          needsReview: false,
          attemptCount: Math.max(existingLog.attemptCount, item.attemptCount),
          perceivedDifficulty:
            mapCfRatingToDifficulty(item.rating) ??
            existingLog.perceivedDifficulty,
          topicIds: existingTopicIds,
          activityAt: item.activityAt,
          existingLogId: existingLog.id,
          existingAttemptCount: existingLog.attemptCount,
          notes: existingLog.notes ?? "",
          matchingProposals,
        });
        continue;
      }

      if (matchingProposals.length > 0) {
        items.push({
          key: `${targetMember.id}:${item.externalId}`,
          memberId: targetMember.id,
          memberName: targetMember.name,
          externalId: item.externalId,
          code: item.code,
          title: item.title,
          canonicalUrl: item.canonicalUrl,
          rating: item.rating,
          rawTags: item.tags,
          action: "LINK_PROPOSAL",
          solved: true,
          needsReview: existingLog.needsReview,
          attemptCount: Math.max(existingLog.attemptCount, item.attemptCount),
          perceivedDifficulty: existingLog.perceivedDifficulty,
          topicIds: existingTopicIds,
          activityAt: item.activityAt,
          existingLogId: existingLog.id,
          existingAttemptCount: existingLog.attemptCount,
          notes: existingLog.notes ?? "",
          matchingProposals,
        });
        continue;
      }

      if (item.attemptCount > existingLog.attemptCount) {
        items.push({
          key: `${targetMember.id}:${item.externalId}`,
          memberId: targetMember.id,
          memberName: targetMember.name,
          externalId: item.externalId,
          code: item.code,
          title: item.title,
          canonicalUrl: item.canonicalUrl,
          rating: item.rating,
          rawTags: item.tags,
          action: "UPDATE_ATTEMPTS",
          solved: true,
          needsReview: existingLog.needsReview,
          attemptCount: item.attemptCount,
          perceivedDifficulty: existingLog.perceivedDifficulty,
          topicIds: existingTopicIds,
          activityAt: item.activityAt,
          existingLogId: existingLog.id,
          existingAttemptCount: existingLog.attemptCount,
          notes: existingLog.notes ?? "",
          matchingProposals: [],
        });
        continue;
      }

      alreadySyncedCount += 1;
      continue;
    }

    // Existing log + unresolved CF submissions
    const hasPendingProposalUpdate = matchingRaw.some(
      (p) => p.status !== "TENTOU"
    );
    if (
      !existingLog.solved &&
      (item.attemptCount > existingLog.attemptCount || hasPendingProposalUpdate)
    ) {
      items.push({
        key: `${targetMember.id}:${item.externalId}`,
        memberId: targetMember.id,
        memberName: targetMember.name,
        externalId: item.externalId,
        code: item.code,
        title: item.title,
        canonicalUrl: item.canonicalUrl,
        rating: item.rating,
        rawTags: item.tags,
        action: "UPDATE_ATTEMPTS",
        solved: false,
        needsReview: true,
        attemptCount: Math.max(existingLog.attemptCount, item.attemptCount),
        perceivedDifficulty: existingLog.perceivedDifficulty,
        topicIds: existingTopicIds,
        activityAt: item.activityAt,
        existingLogId: existingLog.id,
        existingAttemptCount: existingLog.attemptCount,
        notes: existingLog.notes ?? "",
        matchingProposals,
      });
      continue;
    }

    alreadySyncedCount += 1;
  }

  return {
    preview: {
      memberId: targetMember.id,
      memberName: targetMember.name,
      cfHandle,
      totalSubmissionsFetched: cfStatusResult.submissions.length,
      totalProblemsFound: aggregated.length,
      alreadySyncedCount,
      skippedGraceCount,
      skippedUnresolvedCount,
      items,
    },
  };
}

export async function commitMemberCodeforcesSyncBatchAction(params: {
  memberId: string;
  items: SyncCommitItem[];
  markSyncedNow?: boolean;
}): Promise<{
  summary?: BatchCommitSummary;
  error?: string;
}> {
  const currentUser = await requireTeamMember();

  if (params.items.length > MAX_BATCH_ITEMS) {
    return {
      error: `A sincronização em lote suporta no máximo ${MAX_BATCH_ITEMS} itens por vez.`,
    };
  }

  const sanitizedItems: Array<
    SyncCommitItem & {
      safeUrl: string;
      cleanTitle: string;
      cleanNotes: string | null;
    }
  > = [];

  for (const item of params.items) {
    const cleanTitle = item.title.trim();
    if (cleanTitle.length < 2 || cleanTitle.length > MAX_TITLE_LENGTH) {
      return {
        error: `Título inválido na sincronização (deve ter entre 2 e ${MAX_TITLE_LENGTH} caracteres).`,
      };
    }
    const safeUrl = sanitizeHttpUrl(item.canonicalUrl);
    if (!safeUrl) {
      return {
        error: `URL inválida detectada no item "${cleanTitle}".`,
      };
    }
    const cleanNotes = item.notes?.trim() || null;
    if (cleanNotes && cleanNotes.length > MAX_NOTES_LENGTH) {
      return {
        error: `Observação do item "${cleanTitle}" excede o limite de ${MAX_NOTES_LENGTH} caracteres.`,
      };
    }
    sanitizedItems.push({
      ...item,
      safeUrl,
      cleanTitle,
      cleanNotes,
    });
  }

  const targetMember = await prisma.user.findUnique({
    where: { id: params.memberId },
    select: {
      id: true,
      name: true,
      teamId: true,
    },
  });

  if (!targetMember || targetMember.teamId !== currentUser.teamId) {
    return { error: "Membro não encontrado nesta equipe." };
  }

  const summary: BatchCommitSummary = {
    createdSolved: 0,
    createdAttempted: 0,
    upsolvedReview: 0,
    updatedAttempts: 0,
    proposalsUpdated: 0,
    skippedDuplicates: 0,
  };

  const notifiedUserIds = new Set<string>();

  if (sanitizedItems.length > 0) {
    const [allTopics, existingLogsForMember, openProposals] = await Promise.all([
      ensureCodeforcesFallbackTopics(),
      prisma.problemLog.findMany({
        where: {
          teamId: currentUser.teamId,
          userId: targetMember.id,
        },
        select: {
          id: true,
          url: true,
          externalId: true,
          externalRating: true,
          attemptCount: true,
          solved: true,
          notes: true,
        },
      }),
      prisma.proposedProblem.findMany({
        where: {
          teamId: currentUser.teamId,
          assigneeId: targetMember.id,
          status: { in: ["PENDENTE", "VISUALIZADO", "TENTOU"] },
        },
        include: {
          proposer: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
    ]);

    const validTopicIds = new Set(allTopics.map((t) => t.id));
    const fallbackTopic =
      allTopics.find((t) => t.slug === "implementacao-ad-hoc") ?? allTopics[0];

    const existingByExternalId = new Map<
      string,
      (typeof existingLogsForMember)[number]
    >();
    const existingById = new Map<
      string,
      (typeof existingLogsForMember)[number]
    >();

    for (const log of existingLogsForMember) {
      existingById.set(log.id, log);
      const extId = getCanonicalExternalId(log.externalId, log.url);
      if (extId && !existingByExternalId.has(extId)) {
        existingByExternalId.set(extId, log);
      }
    }

    const proposalsByExternalId = new Map<
      string,
      Array<(typeof openProposals)[number]>
    >();
    for (const proposal of openProposals) {
      const extId = getCanonicalExternalId(proposal.externalId, proposal.url);
      if (!extId) continue;
      const list = proposalsByExternalId.get(extId);
      if (list) {
        list.push(proposal);
      } else {
        proposalsByExternalId.set(extId, [proposal]);
      }
    }

    const updatedProposalIds = new Set<string>();

    const syncMatchingProposals = async (
      externalId: string,
      resultingLogId: string,
      targetStatus: "FEITO" | "TENTOU",
      linkedProposalIds?: string[]
    ) => {
      const candidates = proposalsByExternalId.get(externalId) ?? [];
      const seenIds = new Set<string>();
      const allToUpdate: Array<(typeof openProposals)[number]> = [];

      for (const p of candidates) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          allToUpdate.push(p);
        }
      }

      if (linkedProposalIds && linkedProposalIds.length > 0) {
        for (const p of openProposals) {
          if (linkedProposalIds.includes(p.id) && !seenIds.has(p.id)) {
            seenIds.add(p.id);
            allToUpdate.push(p);
          }
        }
      }

      const proposalsToCommit: Array<(typeof openProposals)[number]> = [];
      for (const proposal of allToUpdate) {
        if (updatedProposalIds.has(proposal.id)) continue;
        if (
          proposal.status === targetStatus &&
          proposal.resultingLogId === resultingLogId
        ) {
          continue;
        }
        updatedProposalIds.add(proposal.id);
        proposalsToCommit.push(proposal);
      }

      if (proposalsToCommit.length === 0) return;

      const now = new Date();
      await Promise.all(
        proposalsToCommit.map((proposal) =>
          prisma.proposedProblem.update({
            where: { id: proposal.id },
            data: {
              status: targetStatus,
              resultingLogId,
              viewedAt: proposal.viewedAt ?? now,
            },
          })
        )
      );

      summary.proposalsUpdated += proposalsToCommit.length;

      const statusChangedProposals = proposalsToCommit.filter(
        (proposal) =>
          proposal.status !== targetStatus &&
          proposal.proposer.id !== targetMember.id
      );
      if (statusChangedProposals.length > 0) {
        await NotificationService.notifyProposalStatusUpdatedBatch(
          statusChangedProposals.map((proposal) => ({
            proposerId: proposal.proposer.id,
            proposerEmail: proposal.proposer.email,
            assigneeName: targetMember.name,
            problemTitle: proposal.title,
            status: targetStatus,
            proposedProblemId: proposal.id,
          }))
        );
        for (const proposal of statusChangedProposals) {
          notifiedUserIds.add(proposal.proposer.id);
        }
      }
    };

    const CHUNK_SIZE = 8;
    for (let i = 0; i < sanitizedItems.length; i += CHUNK_SIZE) {
      const chunk = sanitizedItems.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (item) => {
          const cleanTopics = Array.from(new Set(item.topicIds)).filter((id) =>
            validTopicIds.has(id)
          );
          if (cleanTopics.length === 0 && fallbackTopic) {
            cleanTopics.push(fallbackTopic.id);
          }

          const attemptCount = Math.max(1, Math.floor(item.attemptCount || 1));
          const rating =
            typeof item.rating === "number" && Number.isFinite(item.rating)
              ? Math.round(item.rating)
              : null;
          const activityDate = new Date(item.activityAt);
          const safeActivityDate = Number.isNaN(activityDate.getTime())
            ? new Date()
            : activityDate;
          const trimmedNotes = item.cleanNotes;

          if (
            item.action === "NEW_SOLVED" ||
            item.action === "NEW_ATTEMPTED"
          ) {
            const already = existingByExternalId.get(item.externalId);
            if (already) {
              summary.skippedDuplicates += 1;
              await syncMatchingProposals(
                item.externalId,
                already.id,
                already.solved ? "FEITO" : "TENTOU"
              );
              return;
            }

            const isSolved = item.action === "NEW_SOLVED";
            const created = await prisma.problemLog.create({
              data: {
                teamId: currentUser.teamId,
                userId: targetMember.id,
                title: item.cleanTitle,
                url: item.safeUrl,
                platform: "CODEFORCES",
                externalId: item.externalId,
                externalRating: rating,
                perceivedDifficulty: item.perceivedDifficulty,
                solved: isSolved,
                needsReview: !isSolved,
                attemptCount,
                notes: trimmedNotes,
                createdAt: safeActivityDate,
                topics: {
                  connect: cleanTopics.map((id) => ({ id })),
                },
              },
              select: { id: true },
            });

            existingByExternalId.set(item.externalId, {
              id: created.id,
              url: item.safeUrl,
              externalId: item.externalId,
              externalRating: rating,
              attemptCount,
              solved: isSolved,
              notes: trimmedNotes,
            });

            if (isSolved) {
              summary.createdSolved += 1;
            } else {
              summary.createdAttempted += 1;
            }

            await syncMatchingProposals(
              item.externalId,
              created.id,
              isSolved ? "FEITO" : "TENTOU"
            );
            return;
          }

          if (item.action === "UPSOLVE_REVIEW") {
            const existing =
              (item.existingLogId
                ? existingById.get(item.existingLogId)
                : undefined) ?? existingByExternalId.get(item.externalId);

            if (!existing) {
              summary.skippedDuplicates += 1;
              return;
            }

            const updated = await prisma.problemLog.update({
              where: { id: existing.id },
              data: {
                solved: true,
                needsReview: false,
                reviewedAt: safeActivityDate,
                attemptCount: Math.max(existing.attemptCount, attemptCount),
                perceivedDifficulty: item.perceivedDifficulty,
                notes: trimmedNotes || existing.notes,
                externalId: existing.externalId ?? item.externalId,
                externalRating: existing.externalRating ?? rating,
                ...(cleanTopics.length > 0
                  ? {
                      topics: {
                        connect: cleanTopics.map((id) => ({ id })),
                      },
                    }
                  : {}),
              },
              select: {
                id: true,
                fromProposals: { select: { id: true } },
              },
            });

            summary.upsolvedReview += 1;
            await syncMatchingProposals(
              item.externalId,
              updated.id,
              "FEITO",
              updated.fromProposals.map((p) => p.id)
            );
            return;
          }

          if (item.action === "UPDATE_ATTEMPTS") {
            const existing =
              (item.existingLogId
                ? existingById.get(item.existingLogId)
                : undefined) ?? existingByExternalId.get(item.externalId);

            if (!existing) {
              summary.skippedDuplicates += 1;
              return;
            }

            await prisma.problemLog.update({
              where: { id: existing.id },
              data: {
                attemptCount: Math.max(existing.attemptCount, attemptCount),
                externalId: existing.externalId ?? item.externalId,
                externalRating: existing.externalRating ?? rating,
              },
            });

            summary.updatedAttempts += 1;
            await syncMatchingProposals(
              item.externalId,
              existing.id,
              existing.solved ? "FEITO" : "TENTOU"
            );
            return;
          }

          if (item.action === "LINK_PROPOSAL") {
            const existing =
              (item.existingLogId
                ? existingById.get(item.existingLogId)
                : undefined) ?? existingByExternalId.get(item.externalId);

            if (!existing) {
              summary.skippedDuplicates += 1;
              return;
            }

            if (
              attemptCount > existing.attemptCount ||
              !existing.externalId ||
              (rating !== null && existing.externalRating !== rating)
            ) {
              await prisma.problemLog.update({
                where: { id: existing.id },
                data: {
                  attemptCount: Math.max(existing.attemptCount, attemptCount),
                  externalId: existing.externalId ?? item.externalId,
                  externalRating: existing.externalRating ?? rating,
                },
              });
            }

            await syncMatchingProposals(
              item.externalId,
              existing.id,
              existing.solved ? "FEITO" : "TENTOU"
            );
          }
        })
      );
    }
  }

  if (params.markSyncedNow) {
    await prisma.user.update({
      where: { id: targetMember.id },
      data: { cfLastSyncedAt: new Date() },
    });
  }

  if (sanitizedItems.length > 0 || params.markSyncedNow) {
    updateTag(CACHE_TAGS.teamStats(currentUser.teamId));
    updateTag(CACHE_TAGS.teamMembers(currentUser.teamId));
    updateTag(CACHE_TAGS.userNav(targetMember.id));
    for (const userId of notifiedUserIds) {
      updateTag(CACHE_TAGS.userNav(userId));
    }

    revalidatePath("/");
    revalidatePath("/questoes");
    revalidatePath("/revisao");
    revalidatePath("/propostos");
    revalidatePath("/notificacoes");
    revalidatePath("/membros");
  }

  return { summary };
}
