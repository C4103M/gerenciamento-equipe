"use server";

import type { Difficulty } from "@prisma/client";
import { revalidatePath, updateTag } from "next/cache";
import type {
  BatchCommitSummary,
  SyncCommitItem,
  SyncItemAction,
  SyncMatchingProposalInfo,
} from "@/actions/codeforces";
import { requireTeamMember } from "@/lib/auth";
import { CACHE_TAGS, getCachedTopics } from "@/lib/cache";
import {
  aggregateLeetCodeSubmissions,
  fetchLeetCodeQuestion,
  fetchLeetCodeQuestionsBatch,
  fetchLeetCodeUserRecentSubmissions,
  formatLeetCodeTitle,
  type LcDifficulty,
  mapLcDifficultyToDifficulty,
  mapLcTagsToTopicIds,
  parseLeetCodeRef,
} from "@/lib/leetcode";
import { NotificationService } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sanitizeHttpUrl } from "@/lib/url";
import type { TopicItem } from "@/types";

const MAX_BATCH_ITEMS = 500;
const MAX_TITLE_LENGTH = 300;
const MAX_NOTES_LENGTH = 10000;

export interface LeetCodeLookupResult {
  title: string;
  canonicalUrl: string;
  externalId: string;
  titleSlug: string;
  frontendId: string | null;
  lcDifficulty: LcDifficulty | null;
  isPaidOnly: boolean;
  suggestedDifficulty: Difficulty | null;
  matchedTopicIds: string[];
  rawTags: string[];
}

export interface LeetCodeSyncPreviewItem {
  key: string;
  memberId: string;
  memberName: string;
  externalId: string;
  code: string;
  title: string;
  canonicalUrl: string;
  rating: number | null;
  lcDifficulty: LcDifficulty | null;
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

export interface LeetCodeMemberSyncPreview {
  memberId: string;
  memberName: string;
  lcHandle: string;
  totalAcFetched: number;
  totalRecentSubmissionsFetched: number;
  totalProblemsFound: number;
  alreadySyncedCount: number;
  skippedGraceCount: number;
  skippedUnresolvedCount: number;
  items: LeetCodeSyncPreviewItem[];
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

async function ensureLeetCodeFallbackTopics(): Promise<TopicItem[]> {
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

function getCanonicalLcExternalId(
  storedExternalId: string | null,
  url: string
): string | null {
  if (storedExternalId) return storedExternalId;
  return parseLeetCodeRef(url)?.externalId ?? null;
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

export async function lookupLeetCodeProblemAction(rawInput: string): Promise<{
  data?: LeetCodeLookupResult;
  error?: string;
}> {
  await requireTeamMember();

  const ref = parseLeetCodeRef(rawInput);
  if (!ref) {
    return {
      error:
        "Informe uma URL válida do LeetCode (ex: https://leetcode.com/problems/two-sum/) ou código (ex: LC two-sum).",
    };
  }

  const [lcResult, allTopics] = await Promise.all([
    fetchLeetCodeQuestion(ref.titleSlug),
    ensureLeetCodeFallbackTopics(),
  ]);

  if (lcResult.error || !lcResult.problem) {
    return {
      error: lcResult.error ?? "Não foi possível obter os dados do problema.",
    };
  }

  const problem = lcResult.problem;
  const matchedTopicIds = mapLcTagsToTopicIds(
    problem.tags.map((t) => t.slug),
    allTopics,
    "implementacao-ad-hoc"
  );

  return {
    data: {
      title: formatLeetCodeTitle(
        problem.frontendId,
        problem.title,
        problem.titleSlug
      ),
      canonicalUrl: ref.canonicalUrl,
      externalId: ref.externalId,
      titleSlug: problem.titleSlug,
      frontendId: problem.frontendId,
      lcDifficulty: problem.difficulty,
      isPaidOnly: problem.isPaidOnly,
      suggestedDifficulty: mapLcDifficultyToDifficulty(problem.difficulty),
      matchedTopicIds,
      rawTags: problem.tags.map((t) => t.name),
    },
  };
}

export async function previewMemberLeetCodeSyncAction(params: {
  memberId: string;
  graceMinutes: number;
  includeUnresolved: boolean;
}): Promise<{
  preview?: LeetCodeMemberSyncPreview;
  error?: string;
}> {
  const currentUser = await requireTeamMember();

  const targetMember = await prisma.user.findUnique({
    where: { id: params.memberId },
    select: {
      id: true,
      name: true,
      teamId: true,
      lcHandle: true,
    },
  });

  if (!targetMember || targetMember.teamId !== currentUser.teamId) {
    return { error: "Membro não encontrado nesta equipe." };
  }

  const lcHandle = targetMember.lcHandle?.trim();
  if (!lcHandle) {
    return {
      error: `${targetMember.name} não possui handle do LeetCode cadastrado.`,
    };
  }

  const lcResult = await fetchLeetCodeUserRecentSubmissions(lcHandle);
  if (lcResult.error || !lcResult.recentAc || !lcResult.recentAll) {
    return {
      error:
        lcResult.error ??
        `Erro ao buscar submissões de ${targetMember.name} no LeetCode.`,
    };
  }

  const uniqueSlugs = Array.from(
    new Set([
      ...lcResult.recentAc.map((s) => s.titleSlug?.trim().toLowerCase()),
      ...lcResult.recentAll.map((s) => s.titleSlug?.trim().toLowerCase()),
    ])
  ).filter((slug): slug is string => Boolean(slug));

  const [metadataBySlug, existingLogs, openProposals, allTopics] =
    await Promise.all([
      fetchLeetCodeQuestionsBatch(uniqueSlugs),
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
      ensureLeetCodeFallbackTopics(),
    ]);

  const graceMinutes = Math.max(0, Math.floor(params.graceMinutes));
  const aggregated = aggregateLeetCodeSubmissions(
    lcResult.recentAc,
    lcResult.recentAll,
    metadataBySlug,
    graceMinutes
  );

  const logByExternalId = new Map<string, (typeof existingLogs)[number]>();
  for (const log of existingLogs) {
    const extId = getCanonicalLcExternalId(log.externalId, log.url);
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
    const extId = getCanonicalLcExternalId(proposal.externalId, proposal.url);
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
  const items: LeetCodeSyncPreviewItem[] = [];

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

    const mappedTopics = mapLcTagsToTopicIds(
      item.tagSlugs,
      allTopics,
      "implementacao-ad-hoc"
    );
    const difficultyFromLc: Difficulty =
      mapLcDifficultyToDifficulty(item.lcDifficulty) ??
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
          rating: null,
          lcDifficulty: item.lcDifficulty,
          rawTags: item.tagNames,
          action: "NEW_SOLVED",
          solved: true,
          needsReview: false,
          attemptCount: item.attemptCount,
          perceivedDifficulty: difficultyFromLc,
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
          rating: null,
          lcDifficulty: item.lcDifficulty,
          rawTags: item.tagNames,
          action: "NEW_ATTEMPTED",
          solved: false,
          needsReview: true,
          attemptCount: item.attemptCount,
          perceivedDifficulty: difficultyFromLc,
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
      const effectiveAcAt = item.latestAcAt ?? item.activityAt;
      const latestAcMs = new Date(effectiveAcAt).getTime();
      const isNewerOk = latestAcMs > existingLog.updatedAt.getTime();
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
          rating: null,
          lcDifficulty: item.lcDifficulty,
          rawTags: item.tagNames,
          action: "UPSOLVE_REVIEW",
          solved: true,
          needsReview: false,
          attemptCount: Math.max(existingLog.attemptCount, item.attemptCount),
          perceivedDifficulty:
            mapLcDifficultyToDifficulty(item.lcDifficulty) ??
            existingLog.perceivedDifficulty,
          topicIds: existingTopicIds,
          activityAt: effectiveAcAt,
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
          rating: null,
          lcDifficulty: item.lcDifficulty,
          rawTags: item.tagNames,
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
          rating: null,
          lcDifficulty: item.lcDifficulty,
          rawTags: item.tagNames,
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

    // Existing log + unresolved LC submissions
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
        rating: null,
        lcDifficulty: item.lcDifficulty,
        rawTags: item.tagNames,
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
      lcHandle,
      totalAcFetched: lcResult.recentAc.length,
      totalRecentSubmissionsFetched: lcResult.recentAll.length,
      totalProblemsFound: aggregated.length,
      alreadySyncedCount,
      skippedGraceCount,
      skippedUnresolvedCount,
      items,
    },
  };
}

export async function commitMemberLeetCodeSyncBatchAction(params: {
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
      ensureLeetCodeFallbackTopics(),
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
      const extId = getCanonicalLcExternalId(log.externalId, log.url);
      if (extId && !existingByExternalId.has(extId)) {
        existingByExternalId.set(extId, log);
      }
    }

    const proposalsByExternalId = new Map<
      string,
      Array<(typeof openProposals)[number]>
    >();
    for (const proposal of openProposals) {
      const extId = getCanonicalLcExternalId(proposal.externalId, proposal.url);
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
                platform: "LEETCODE",
                externalId: item.externalId,
                externalRating: null,
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
              externalRating: null,
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

            if (attemptCount > existing.attemptCount || !existing.externalId) {
              await prisma.problemLog.update({
                where: { id: existing.id },
                data: {
                  attemptCount: Math.max(existing.attemptCount, attemptCount),
                  externalId: existing.externalId ?? item.externalId,
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
      data: { lcLastSyncedAt: new Date() },
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
