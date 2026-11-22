"use server";

import type { Difficulty, ProposalStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/auth";
import { parseCodeforcesRef } from "@/lib/codeforces";
import { NotificationService } from "@/lib/notifications";
import { detectPlatform } from "@/lib/platform";
import { prisma } from "@/lib/prisma";

export interface ProposeProblemInput {
  assigneeIds: string[];
  title: string;
  url: string;
  topicIds: string[];
  suggestedDifficulty?: Difficulty | null;
  message?: string;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function proposeProblemAction(
  input: ProposeProblemInput
): Promise<{ error?: string; count?: number }> {
  const proposer = await requireTeamMember();

  const assigneeIds = Array.from(new Set(input.assigneeIds)).filter(
    (id) => id && id !== proposer.id
  );
  const title = input.title.trim();
  const cfRef = parseCodeforcesRef(input.url);
  const url = cfRef ? cfRef.canonicalUrl : normalizeUrl(input.url);
  const externalId = cfRef ? cfRef.externalId : null;
  const topicIds = Array.from(new Set(input.topicIds)).filter(Boolean);

  if (assigneeIds.length === 0) {
    return { error: "Selecione pelo menos 1 membro da equipe para propor." };
  }
  if (title.length < 2) {
    return { error: "Informe o título da questão." };
  }
  if (!url) {
    return { error: "Informe o link da questão (Codeforces, LeetCode, etc.)." };
  }
  if (topicIds.length === 0) {
    return { error: "Selecione pelo menos 1 tópico." };
  }

  const assignees = await prisma.user.findMany({
    where: {
      id: { in: assigneeIds },
      teamId: proposer.teamId,
    },
    select: { id: true, email: true, name: true },
  });

  if (assignees.length === 0) {
    return { error: "Membro destinatário não encontrado nesta equipe." };
  }

  const platform = detectPlatform(url);

  for (const assignee of assignees) {
    const proposal = await prisma.proposedProblem.create({
      data: {
        teamId: proposer.teamId,
        proposerId: proposer.id,
        assigneeId: assignee.id,
        title,
        url,
        platform,
        externalId,
        suggestedDifficulty: input.suggestedDifficulty || null,
        message: input.message?.trim() || null,
        status: "PENDENTE",
        topics: {
          connect: topicIds.map((id) => ({ id })),
        },
      },
    });

    await NotificationService.notifyProblemProposed({
      assigneeId: assignee.id,
      assigneeEmail: assignee.email,
      proposerName: proposer.name,
      problemTitle: title,
      proposedProblemId: proposal.id,
    });
  }

  revalidatePath("/");
  revalidatePath("/propostos");
  revalidatePath("/notificacoes");

  return { count: assignees.length };
}

export async function markProposalViewedAction(
  proposalId: string
): Promise<{ error?: string }> {
  const user = await requireTeamMember();

  const proposal = await prisma.proposedProblem.findUnique({
    where: { id: proposalId },
    include: {
      proposer: { select: { id: true, email: true, name: true } },
    },
  });

  if (!proposal || proposal.teamId !== user.teamId) {
    return { error: "Proposta não encontrada." };
  }
  if (proposal.assigneeId !== user.id) {
    return { error: "Apenas o destinatário pode marcar como visualizado." };
  }
  if (proposal.status !== "PENDENTE") {
    return {};
  }

  await prisma.proposedProblem.update({
    where: { id: proposalId },
    data: {
      status: "VISUALIZADO",
      viewedAt: new Date(),
    },
  });

  await NotificationService.notifyProposalStatusUpdated({
    proposerId: proposal.proposer.id,
    proposerEmail: proposal.proposer.email,
    assigneeName: user.name,
    problemTitle: proposal.title,
    status: "VISUALIZADO",
    proposedProblemId: proposal.id,
  });

  revalidatePath("/propostos");
  revalidatePath("/notificacoes");
  return {};
}

export async function updateProposalStatusAction(
  proposalId: string,
  params: {
    status: ProposalStatus;
    perceivedDifficulty?: Difficulty;
    notes?: string;
    attemptCount?: number;
  }
): Promise<{ error?: string }> {
  const user = await requireTeamMember();

  const proposal = await prisma.proposedProblem.findUnique({
    where: { id: proposalId },
    include: {
      topics: { select: { id: true } },
      proposer: { select: { id: true, email: true, name: true } },
    },
  });

  if (!proposal || proposal.teamId !== user.teamId) {
    return { error: "Proposta não encontrada." };
  }
  if (proposal.assigneeId !== user.id) {
    return {
      error: "Apenas o membro que recebeu a questão pode alterar o status.",
    };
  }

  const nextStatus = params.status;
  const difficulty =
    params.perceivedDifficulty ?? proposal.suggestedDifficulty ?? "MEDIO";
  const topicIds = proposal.topics.map((t) => ({ id: t.id }));
  const parsedAttemptCount =
    typeof params.attemptCount === "number" &&
    Number.isFinite(params.attemptCount) &&
    params.attemptCount >= 1
      ? Math.floor(params.attemptCount)
      : null;

  let resultingLogId = proposal.resultingLogId;

  if (nextStatus === "TENTOU" || nextStatus === "FEITO") {
    const solved = nextStatus === "FEITO";
    const needsReview = !solved;

    if (resultingLogId) {
      await prisma.problemLog.update({
        where: { id: resultingLogId },
        data: {
          perceivedDifficulty: difficulty,
          solved,
          needsReview,
          reviewedAt: solved ? new Date() : null,
          attemptCount: parsedAttemptCount ?? { increment: 1 },
          notes: params.notes?.trim() || undefined,
        },
      });
    } else {
      const log = await prisma.problemLog.create({
        data: {
          teamId: proposal.teamId,
          userId: user.id,
          title: proposal.title,
          url: proposal.url,
          platform: proposal.platform,
          externalId:
            proposal.externalId ??
            parseCodeforcesRef(proposal.url)?.externalId ??
            null,
          perceivedDifficulty: difficulty,
          solved,
          needsReview,
          attemptCount: parsedAttemptCount ?? 1,
          notes:
            params.notes?.trim() ||
            `Questão proposta por ${proposal.proposer.name}.`,
          topics: {
            connect: topicIds,
          },
        },
        select: { id: true },
      });
      resultingLogId = log.id;
    }
  }

  await prisma.proposedProblem.update({
    where: { id: proposalId },
    data: {
      status: nextStatus,
      resultingLogId,
      viewedAt: proposal.viewedAt ?? new Date(),
    },
  });

  if (proposal.status !== nextStatus) {
    await NotificationService.notifyProposalStatusUpdated({
      proposerId: proposal.proposer.id,
      proposerEmail: proposal.proposer.email,
      assigneeName: user.name,
      problemTitle: proposal.title,
      status: nextStatus,
      proposedProblemId: proposal.id,
    });
  }

  revalidatePath("/");
  revalidatePath("/questoes");
  revalidatePath("/revisao");
  revalidatePath("/propostos");
  revalidatePath("/notificacoes");
  revalidatePath("/membros");

  return {};
}

export async function deleteProposalAction(
  proposalId: string
): Promise<{ error?: string }> {
  const user = await requireTeamMember();

  const proposal = await prisma.proposedProblem.findUnique({
    where: { id: proposalId },
    select: { proposerId: true, teamId: true },
  });

  if (!proposal || proposal.teamId !== user.teamId) {
    return { error: "Proposta não encontrada." };
  }
  if (proposal.proposerId !== user.id) {
    return { error: "Apenas quem propôs a questão pode removê-la." };
  }

  await prisma.proposedProblem.delete({ where: { id: proposalId } });

  revalidatePath("/");
  revalidatePath("/propostos");
  revalidatePath("/notificacoes");
  return {};
}
