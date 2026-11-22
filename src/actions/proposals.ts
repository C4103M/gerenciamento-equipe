"use server";

import type { Difficulty, ProposalStatus } from "@prisma/client";
import { revalidatePath, updateTag } from "next/cache";
import { requireTeamMember } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache";
import { parseCodeforcesRef } from "@/lib/codeforces";
import { NotificationService } from "@/lib/notifications";
import { detectPlatform } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { sanitizeHttpUrl } from "@/lib/url";

const MAX_TITLE_LENGTH = 300;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_NOTES_LENGTH = 10000;

export interface ProposeProblemInput {
  assigneeIds: string[];
  title: string;
  url: string;
  topicIds: string[];
  suggestedDifficulty?: Difficulty | null;
  message?: string;
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
  const url = cfRef ? cfRef.canonicalUrl : sanitizeHttpUrl(input.url);
  const externalId = cfRef ? cfRef.externalId : null;
  const topicIds = Array.from(new Set(input.topicIds)).filter(Boolean);
  const message = input.message?.trim() || null;

  if (assigneeIds.length === 0) {
    return { error: "Selecione pelo menos 1 membro da equipe para propor." };
  }
  if (title.length < 2 || title.length > MAX_TITLE_LENGTH) {
    return {
      error: `O título da questão deve ter entre 2 e ${MAX_TITLE_LENGTH} caracteres.`,
    };
  }
  if (!url) {
    return {
      error: "Informe um link válido (http:// ou https://) para a questão.",
    };
  }
  if (topicIds.length === 0) {
    return { error: "Selecione pelo menos 1 tópico." };
  }
  if (message && message.length > MAX_MESSAGE_LENGTH) {
    return {
      error: `A mensagem não pode exceder ${MAX_MESSAGE_LENGTH} caracteres.`,
    };
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

  const createdProposals = await Promise.all(
    assignees.map((assignee) =>
      prisma.proposedProblem.create({
        data: {
          teamId: proposer.teamId,
          proposerId: proposer.id,
          assigneeId: assignee.id,
          title,
          url,
          platform,
          externalId,
          suggestedDifficulty: input.suggestedDifficulty || null,
          message,
          status: "PENDENTE",
          topics: {
            connect: topicIds.map((id) => ({ id })),
          },
        },
        select: { id: true, assigneeId: true },
      })
    )
  );

  const assigneeById = new Map(assignees.map((a) => [a.id, a]));
  await NotificationService.notifyProblemProposedBatch(
    createdProposals.map((proposal) => {
      const assignee = assigneeById.get(proposal.assigneeId)!;
      return {
        assigneeId: assignee.id,
        assigneeEmail: assignee.email,
        proposerName: proposer.name,
        problemTitle: title,
        proposedProblemId: proposal.id,
      };
    })
  );

  updateTag(CACHE_TAGS.teamStats(proposer.teamId));
  for (const assignee of assignees) {
    updateTag(CACHE_TAGS.userNav(assignee.id));
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

  updateTag(CACHE_TAGS.teamStats(user.teamId));
  updateTag(CACHE_TAGS.userNav(user.id));
  updateTag(CACHE_TAGS.userNav(proposal.proposer.id));
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

  const trimmedNotes = params.notes?.trim();
  if (trimmedNotes && trimmedNotes.length > MAX_NOTES_LENGTH) {
    return {
      error: `As observações não podem exceder ${MAX_NOTES_LENGTH} caracteres.`,
    };
  }

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
          notes: trimmedNotes || undefined,
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
            trimmedNotes || `Questão proposta por ${proposal.proposer.name}.`,
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

  updateTag(CACHE_TAGS.teamStats(user.teamId));
  updateTag(CACHE_TAGS.userNav(user.id));
  updateTag(CACHE_TAGS.userNav(proposal.proposer.id));
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
    select: { proposerId: true, assigneeId: true, teamId: true },
  });

  if (!proposal || proposal.teamId !== user.teamId) {
    return { error: "Proposta não encontrada." };
  }
  if (proposal.proposerId !== user.id) {
    return { error: "Apenas quem propôs a questão pode removê-la." };
  }

  await prisma.proposedProblem.delete({ where: { id: proposalId } });

  updateTag(CACHE_TAGS.teamStats(user.teamId));
  updateTag(CACHE_TAGS.userNav(proposal.assigneeId));
  revalidatePath("/");
  revalidatePath("/propostos");
  revalidatePath("/notificacoes");
  return {};
}
