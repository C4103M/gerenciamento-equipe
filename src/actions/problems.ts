"use server";

import type { Difficulty } from "@prisma/client";
import { revalidatePath, updateTag } from "next/cache";
import { requireTeamMember } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache";
import { parseCodeforcesRef } from "@/lib/codeforces";
import { parseLeetCodeRef } from "@/lib/leetcode";
import { NotificationService } from "@/lib/notifications";
import { detectPlatform } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { resolveSubmittedSolution } from "@/lib/solutions";
import { sanitizeHttpUrl } from "@/lib/url";
import type { SolutionAttachMode } from "@/types";

const MAX_TITLE_LENGTH = 300;
const MAX_NOTES_LENGTH = 10000;

export interface ProblemLogInput {
  title: string;
  url: string;
  topicIds: string[];
  perceivedDifficulty: Difficulty;
  solved: boolean;
  needsReview?: boolean;
  notes?: string;
  solutionMode?: SolutionAttachMode;
  solutionUrl?: string | null;
  solutionCode?: string | null;
  allowAutoSolutionLink?: boolean;
  attemptCount?: number;
  externalId?: string | null;
  externalRating?: number | null;
}

function resolveProblemReference(
  rawUrl: string,
  fallbackExternalId?: string | null
): { url: string; externalId: string | null } | null {
  const cfRef = parseCodeforcesRef(rawUrl);
  if (cfRef) {
    return { url: cfRef.canonicalUrl, externalId: cfRef.externalId };
  }
  const lcRef = parseLeetCodeRef(rawUrl);
  if (lcRef) {
    return { url: lcRef.canonicalUrl, externalId: lcRef.externalId };
  }
  const safeUrl = sanitizeHttpUrl(rawUrl);
  if (!safeUrl) {
    return null;
  }
  return {
    url: safeUrl,
    externalId: fallbackExternalId?.trim().slice(0, 120) || null,
  };
}

function normalizeAttemptCount(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

export async function createProblemLogAction(input: ProblemLogInput): Promise<{
  error?: string;
  id?: string;
}> {
  const user = await requireTeamMember();

  const title = input.title.trim();
  const ref = resolveProblemReference(input.url, input.externalId);
  const topicIds = Array.from(new Set(input.topicIds)).filter(Boolean);
  const attemptCount = normalizeAttemptCount(input.attemptCount);
  const notes = input.notes?.trim() || null;
  const externalRating =
    typeof input.externalRating === "number" &&
    Number.isFinite(input.externalRating)
      ? Math.round(input.externalRating)
      : null;

  if (title.length < 2 || title.length > MAX_TITLE_LENGTH) {
    return {
      error: `O título da questão deve ter entre 2 e ${MAX_TITLE_LENGTH} caracteres.`,
    };
  }
  if (!ref) {
    return {
      error: "Informe um link válido (http:// ou https://) para a questão.",
    };
  }
  if (topicIds.length === 0) {
    return { error: "Selecione pelo menos 1 tópico." };
  }
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return {
      error: `As observações não podem exceder ${MAX_NOTES_LENGTH} caracteres.`,
    };
  }

  const solutionCheck = await resolveSubmittedSolution({
    solved: input.solved,
    problemUrl: ref.url,
    userCfHandle: user.cfHandle,
    solutionMode: input.solutionMode,
    solutionUrl: input.solutionUrl,
    solutionCode: input.solutionCode,
    allowAutoResolve: input.allowAutoSolutionLink,
  });
  if (solutionCheck.error) {
    return { error: solutionCheck.error };
  }

  const platform = detectPlatform(ref.url);
  const needsReview = !input.solved ? true : Boolean(input.needsReview);

  const created = await prisma.problemLog.create({
    data: {
      teamId: user.teamId,
      userId: user.id,
      title,
      url: ref.url,
      platform,
      externalId: ref.externalId,
      externalRating,
      perceivedDifficulty: input.perceivedDifficulty,
      solved: input.solved,
      needsReview,
      attemptCount,
      notes,
      solutionUrl: solutionCheck.solutionUrl,
      solutionCode: solutionCheck.solutionCode,
      topics: {
        connect: topicIds.map((id) => ({ id })),
      },
    },
    select: { id: true },
  });

  updateTag(CACHE_TAGS.teamStats(user.teamId));
  updateTag(CACHE_TAGS.userNav(user.id));
  revalidatePath("/");
  revalidatePath("/questoes");
  revalidatePath("/questoes/[id]", "page");
  revalidatePath("/revisao");
  revalidatePath("/membros");

  return { id: created.id };
}

export async function updateProblemLogAction(
  id: string,
  input: ProblemLogInput
): Promise<{ error?: string }> {
  const user = await requireTeamMember();

  const existing = await prisma.problemLog.findUnique({
    where: { id },
    select: {
      userId: true,
      teamId: true,
      reviewedAt: true,
      externalId: true,
      externalRating: true,
    },
  });

  if (!existing || existing.teamId !== user.teamId) {
    return { error: "Questão não encontrada." };
  }
  if (existing.userId !== user.id) {
    return { error: "Você só pode editar as questões que você cadastrou." };
  }

  const title = input.title.trim();
  const ref = resolveProblemReference(input.url, input.externalId);
  const topicIds = Array.from(new Set(input.topicIds)).filter(Boolean);
  const attemptCount = normalizeAttemptCount(input.attemptCount);
  const notes = input.notes?.trim() || null;

  if (title.length < 2 || title.length > MAX_TITLE_LENGTH) {
    return {
      error: `O título da questão deve ter entre 2 e ${MAX_TITLE_LENGTH} caracteres.`,
    };
  }
  if (!ref) {
    return {
      error: "Informe um link válido (http:// ou https://) para a questão.",
    };
  }
  if (topicIds.length === 0) {
    return { error: "Selecione pelo menos 1 tópico." };
  }
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return {
      error: `As observações não podem exceder ${MAX_NOTES_LENGTH} caracteres.`,
    };
  }

  const solutionCheck = await resolveSubmittedSolution({
    solved: input.solved,
    problemUrl: ref.url,
    userCfHandle: user.cfHandle,
    solutionMode: input.solutionMode,
    solutionUrl: input.solutionUrl,
    solutionCode: input.solutionCode,
    allowAutoResolve: input.allowAutoSolutionLink,
  });
  if (solutionCheck.error) {
    return { error: solutionCheck.error };
  }

  const externalRating =
    input.externalRating !== undefined
      ? typeof input.externalRating === "number" &&
        Number.isFinite(input.externalRating)
        ? Math.round(input.externalRating)
        : null
      : ref.externalId && ref.externalId === existing.externalId
        ? existing.externalRating
        : null;

  const platform = detectPlatform(ref.url);
  const needsReview = !input.solved ? true : Boolean(input.needsReview);

  await prisma.problemLog.update({
    where: { id },
    data: {
      title,
      url: ref.url,
      platform,
      externalId: ref.externalId,
      externalRating,
      perceivedDifficulty: input.perceivedDifficulty,
      solved: input.solved,
      needsReview,
      reviewedAt: input.solved && !needsReview ? existing.reviewedAt : null,
      attemptCount,
      notes,
      solutionUrl: solutionCheck.solutionUrl,
      ...(solutionCheck.updateSolutionCode
        ? { solutionCode: solutionCheck.solutionCode }
        : {}),
      topics: {
        set: topicIds.map((topicId) => ({ id: topicId })),
      },
    },
  });

  updateTag(CACHE_TAGS.teamStats(user.teamId));
  updateTag(CACHE_TAGS.userNav(user.id));
  revalidatePath("/");
  revalidatePath("/questoes");
  revalidatePath("/questoes/[id]", "page");
  revalidatePath("/revisao");
  revalidatePath("/propostos");
  revalidatePath("/membros");

  return {};
}

export async function resolveReviewProblemAction(
  id: string,
  params: {
    perceivedDifficulty: Difficulty;
    notes?: string;
    attemptCount?: number;
    solutionMode?: SolutionAttachMode;
    solutionUrl?: string | null;
    solutionCode?: string | null;
    allowAutoSolutionLink?: boolean;
  }
): Promise<{ error?: string }> {
  const user = await requireTeamMember();

  const existing = await prisma.problemLog.findUnique({
    where: { id },
    include: {
      fromProposals: {
        include: {
          proposer: {
            select: { id: true, email: true, name: true },
          },
        },
      },
    },
  });

  if (!existing || existing.teamId !== user.teamId) {
    return { error: "Questão não encontrada." };
  }
  if (existing.userId !== user.id) {
    return { error: "Você só pode concluir revisões da sua própria lista." };
  }

  const trimmedNotes = params.notes?.trim();
  if (trimmedNotes && trimmedNotes.length > MAX_NOTES_LENGTH) {
    return {
      error: `As observações não podem exceder ${MAX_NOTES_LENGTH} caracteres.`,
    };
  }

  const solutionCheck = await resolveSubmittedSolution({
    solved: true,
    problemUrl: existing.url,
    userCfHandle: user.cfHandle,
    solutionMode: params.solutionMode,
    solutionUrl: params.solutionUrl,
    solutionCode: params.solutionCode,
    allowAutoResolve: params.allowAutoSolutionLink,
  });
  if (solutionCheck.error) {
    return { error: solutionCheck.error };
  }

  const hasExplicitAttemptCount =
    typeof params.attemptCount === "number" &&
    Number.isFinite(params.attemptCount) &&
    params.attemptCount >= 1;

  await prisma.problemLog.update({
    where: { id },
    data: {
      solved: true,
      needsReview: false,
      reviewedAt: new Date(),
      attemptCount: hasExplicitAttemptCount
        ? Math.floor(params.attemptCount!)
        : { increment: 1 },
      perceivedDifficulty: params.perceivedDifficulty,
      notes: trimmedNotes || existing.notes,
      solutionUrl: solutionCheck.solutionUrl,
      ...(solutionCheck.updateSolutionCode
        ? { solutionCode: solutionCheck.solutionCode }
        : {}),
    },
  });

  const proposalsToComplete = existing.fromProposals.filter(
    (proposal) => proposal.status !== "FEITO"
  );

  if (proposalsToComplete.length > 0) {
    await prisma.proposedProblem.updateMany({
      where: {
        id: { in: proposalsToComplete.map((p) => p.id) },
      },
      data: { status: "FEITO" },
    });

    const proposalsToNotify = proposalsToComplete.filter(
      (proposal) => proposal.proposer.id !== user.id
    );

    if (proposalsToNotify.length > 0) {
      await NotificationService.notifyProposalStatusUpdatedBatch(
        proposalsToNotify.map((proposal) => ({
          proposerId: proposal.proposer.id,
          proposerEmail: proposal.proposer.email,
          assigneeName: user.name,
          problemTitle: proposal.title,
          status: "FEITO" as const,
          proposedProblemId: proposal.id,
        }))
      );

      const notifiedProposers = new Set(
        proposalsToNotify.map((p) => p.proposer.id)
      );
      for (const proposerId of notifiedProposers) {
        updateTag(CACHE_TAGS.userNav(proposerId));
      }
    }
  }

  updateTag(CACHE_TAGS.teamStats(user.teamId));
  updateTag(CACHE_TAGS.userNav(user.id));
  revalidatePath("/");
  revalidatePath("/questoes");
  revalidatePath("/questoes/[id]", "page");
  revalidatePath("/revisao");
  revalidatePath("/propostos");
  revalidatePath("/notificacoes");
  revalidatePath("/membros");

  return {};
}

export async function toggleNeedsReviewAction(
  id: string,
  needsReview: boolean
): Promise<{ error?: string }> {
  const user = await requireTeamMember();

  const existing = await prisma.problemLog.findUnique({
    where: { id },
    select: { userId: true, teamId: true, solved: true },
  });

  if (!existing || existing.teamId !== user.teamId) {
    return { error: "Questão não encontrada." };
  }
  if (existing.userId !== user.id) {
    return { error: "Sem permissão para alterar esta questão." };
  }
  if (!existing.solved && !needsReview) {
    return {
      error:
        "Questões marcadas como não resolvidas permanecem na lista de revisão até serem resolvidas.",
    };
  }

  await prisma.problemLog.update({
    where: { id },
    data: { needsReview },
  });

  updateTag(CACHE_TAGS.teamStats(user.teamId));
  updateTag(CACHE_TAGS.userNav(user.id));
  revalidatePath("/");
  revalidatePath("/questoes");
  revalidatePath("/revisao");
  return {};
}

export async function deleteProblemLogAction(
  id: string
): Promise<{ error?: string }> {
  const user = await requireTeamMember();

  const existing = await prisma.problemLog.findUnique({
    where: { id },
    select: { userId: true, teamId: true },
  });

  if (!existing || existing.teamId !== user.teamId) {
    return { error: "Questão não encontrada." };
  }
  if (existing.userId !== user.id) {
    return { error: "Você só pode excluir questões cadastradas por você." };
  }

  await prisma.problemLog.delete({ where: { id } });

  updateTag(CACHE_TAGS.teamStats(user.teamId));
  updateTag(CACHE_TAGS.userNav(user.id));
  revalidatePath("/");
  revalidatePath("/questoes");
  revalidatePath("/revisao");
  revalidatePath("/membros");
  return {};
}

export async function getProblemSolutionCodeAction(
  problemLogId: string
): Promise<{
  solutionCode?: string | null;
  error?: string;
}> {
  const user = await requireTeamMember();

  const log = await prisma.problemLog.findUnique({
    where: { id: problemLogId },
    select: {
      teamId: true,
      solved: true,
      solutionCode: true,
    },
  });

  if (!log || log.teamId !== user.teamId) {
    return { error: "Questão não encontrada." };
  }

  return {
    solutionCode: log.solved ? log.solutionCode : null,
  };
}
