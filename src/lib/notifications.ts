import type { ProposalStatus } from "@prisma/client";
import { PROPOSAL_STATUS_META } from "@/lib/platform";
import { prisma } from "@/lib/prisma";

function buildProposalStatusMessage(params: {
  assigneeName: string;
  problemTitle: string;
  status: ProposalStatus;
}): { title: string; body: string } {
  const statusLabel = PROPOSAL_STATUS_META[params.status].label;
  const title = `${params.assigneeName}: ${statusLabel}`;

  const bodyMap: Record<ProposalStatus, string> = {
    PENDENTE: `${params.assigneeName} voltou o status de "${params.problemTitle}" para Pendente.`,
    VISUALIZADO: `${params.assigneeName} visualizou a questão "${params.problemTitle}" que você propôs.`,
    TENTOU: `${params.assigneeName} tentou "${params.problemTitle}" (enviada automaticamente para a lista de revisão).`,
    FEITO: `${params.assigneeName} conseguiu resolver "${params.problemTitle}"!`,
    DESCARTADO: `${params.assigneeName} marcou "${params.problemTitle}" como descartado.`,
  };

  return { title, body: bodyMap[params.status] };
}

export const NotificationService = {
  async notifyProblemProposed(params: {
    assigneeId: string;
    assigneeEmail: string;
    proposerName: string;
    problemTitle: string;
    proposedProblemId: string;
  }) {
    await this.notifyProblemProposedBatch([params]);
  },

  async notifyProblemProposedBatch(
    items: Array<{
      assigneeId: string;
      assigneeEmail: string;
      proposerName: string;
      problemTitle: string;
      proposedProblemId: string;
    }>
  ) {
    if (items.length === 0) return;

    await prisma.notification.createMany({
      data: items.map((item) => ({
        userId: item.assigneeId,
        type: "PROBLEM_PROPOSED" as const,
        title: `Novo desafio de ${item.proposerName}`,
        body: `${item.proposerName} propôs a questão "${item.problemTitle}" para você resolver.`,
        link: `/propostos?tab=recebidos&id=${item.proposedProblemId}`,
        proposedProblemId: item.proposedProblemId,
      })),
    });

    await Promise.all(
      items.map((item) =>
        this.sendEmailNotificationIfConfigured({
          toEmail: item.assigneeEmail,
          subject: `[Nunca Foi Sort()] Novo desafio de ${item.proposerName}`,
          body: `${item.proposerName} propôs a questão "${item.problemTitle}" para você resolver.`,
        })
      )
    );
  },

  async notifyProposalStatusUpdated(params: {
    proposerId: string;
    proposerEmail: string;
    assigneeName: string;
    problemTitle: string;
    status: ProposalStatus;
    proposedProblemId: string;
  }) {
    await this.notifyProposalStatusUpdatedBatch([params]);
  },

  async notifyProposalStatusUpdatedBatch(
    items: Array<{
      proposerId: string;
      proposerEmail: string;
      assigneeName: string;
      problemTitle: string;
      status: ProposalStatus;
      proposedProblemId: string;
    }>
  ) {
    if (items.length === 0) return;

    const payloads = items.map((item) => {
      const msg = buildProposalStatusMessage(item);
      return {
        item,
        ...msg,
      };
    });

    await prisma.notification.createMany({
      data: payloads.map(({ item, title, body }) => ({
        userId: item.proposerId,
        type: "PROPOSAL_STATUS_UPDATED" as const,
        title,
        body,
        link: `/propostos?tab=enviados&id=${item.proposedProblemId}`,
        proposedProblemId: item.proposedProblemId,
      })),
    });

    await Promise.all(
      payloads.map(({ item, title, body }) =>
        this.sendEmailNotificationIfConfigured({
          toEmail: item.proposerEmail,
          subject: `[Nunca Foi Sort()] ${title}`,
          body,
        })
      )
    );
  },

  /**
   * Hook preparado para envio de e-mail no futuro (ex: Resend).
   * Atualmente registra apenas in-app para manter o fluxo desacoplado.
   */
  async sendEmailNotificationIfConfigured(params: {
    toEmail: string;
    subject: string;
    body: string;
  }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return;
    }

    // Futuro: integrar SDK / API do Resend aqui e atualizar Notification.emailSent = true
    void params;
  },
};
