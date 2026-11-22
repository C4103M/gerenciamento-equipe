"use server";

import type { Difficulty } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/auth";
import { parseCodeforcesRef } from "@/lib/codeforces";
import { NotificationService } from "@/lib/notifications";
import { detectPlatform } from "@/lib/platform";
import { prisma } from "@/lib/prisma";

export interface ProblemLogInput {
  title: string;
  url: string;
  topicIds: string[];
  perceivedDifficulty: Difficulty;
  solved: boolean;
  needsReview?: boolean;
  notes?: string;
  attemptCount?: number;
  externalId?: string | null;
  externalRating?: number | null;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function resolveProblemReference(
  rawUrl: string,
  fallbackExternalId?: string | null
): { url: string; externalId: string | null } {
  const cfRef = parseCodeforcesRef(rawUrl);
  if (cfRef) {
    return { url: cfRef.canonicalUrl, externalId: cfRef.externalId };
  }
  return {
    url: normalizeUrl(rawUrl),
    externalId: fallbackExternalId?.trim() || null,
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
  const { url, externalId } = resolveProblemReference(
    input.url,
    input.externalId
  );
  const topicIds = Array.from(new Set(input.topicIds)).filter(Boolean);
  const attemptCount = normalizeAttemptCount(input.attemptCount);
  const externalRating =
    typeof input.externalRating === "number" &&
    Number.isFinite(input.externalRating)
      ? Math.round(input.externalRating)
      : null;

  if (title.length < 2) {
    return { error: "Informe o título da questão." };
  }
  if (!url) {
    return { error: "Informe o link da questão (Codeforces, LeetCode, etc.)." };
  }
  if (topicIds.length === 0) {
    return { error: "Selecione pelo menos 1 tópico." };
  }

  const platform = detectPlatform(url);
  const needsReview = !input.solved ? true : Boolean(input.needsReview);

  const created = await prisma.problemLog.create({
    data: {
      teamId: user.teamId,
      userId: user.id,
      title,
      url,
      platform,
      externalId,
      externalRating,
      perceivedDifficulty: input.perceivedDifficulty,
      solved: input.solved,
      needsReview,
      attemptCount,
      notes: input.notes?.trim() || null,
      topics: {
        connect: topicIds.map((id) => ({ id })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/");
  revalidatePath("/questoes");
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
  const { url, externalId } = resolveProblemReference(
    input.url,
    input.externalId
  );
  const topicIds = Array.from(new Set(input.topicIds)).filter(Boolean);
  const attemptCount = normalizeAttemptCount(input.attemptCount);
  const externalRating =
    input.externalRating !== undefined
      ? typeof input.externalRating === "number" &&
        Number.isFinite(input.externalRating)
        ? Math.round(input.externalRating)
        : null
      : externalId && externalId === existing.externalId
        ? existing.externalRating
        : null;

  if (title.length < 2) {
    return { error: "Informe o título da questão." };
  }
  if (!url) {
    return { error: "Informe o link da questão." };
  }
  if (topicIds.length === 0) {
    return { error: "Selecione pelo menos 1 tópico." };
  }

  const platform = detectPlatform(url);
  const needsReview = !input.solved ? true : Boolean(input.needsReview);

  await prisma.problemLog.update({
    where: { id },
    data: {
      title,
      url,
      platform,
      externalId,
      externalRating,
      perceivedDifficulty: input.perceivedDifficulty,
      solved: input.solved,
      needsReview,
      reviewedAt: input.solved && !needsReview ? existing.reviewedAt : null,
      attemptCount,
      notes: input.notes?.trim() || null,
      topics: {
        set: topicIds.map((topicId) => ({ id: topicId })),
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/questoes");
  revalidatePath("/revisao");
  revalidatePath("/membros");

  return {};
}

export async function resolveReviewProblemAction(
  id: string,
  params: {
    perceivedDifficulty: Difficulty;
    notes?: string;
    attemptCount?: number;
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
      notes: params.notes?.trim() || existing.notes,
    },
  });

  for (const proposal of existing.fromProposals) {
    if (proposal.status !== "FEITO") {
      await prisma.proposedProblem.update({
        where: { id: proposal.id },
        data: { status: "FEITO" },
      });

      await NotificationService.notifyProposalStatusUpdated({
        proposerId: proposal.proposer.id,
        proposerEmail: proposal.proposer.email,
        assigneeName: user.name,
        problemTitle: proposal.title,
        status: "FEITO",
        proposedProblemId: proposal.id,
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/questoes");
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

  revalidatePath("/");
  revalidatePath("/questoes");
  revalidatePath("/revisao");
  revalidatePath("/membros");
  return {};
}
