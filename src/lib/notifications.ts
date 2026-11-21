import type { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PROPOSAL_STATUS_META } from "@/lib/platform";

export const NotificationService = {
  async notifyProblemProposed(params: {
    assigneeId: string;
    assigneeEmail: string;
    proposerName: string;
    problemTitle: string;
    proposedProblemId: string;
  }) {
    const title = `Novo desafio de ${params.proposerName}`;
    const body = `${params.proposerName} propôs a questão "${params.problemTitle}" para você resolver.`;

    await prisma.notification.create({
      data: {
        userId: params.assigneeId,
        type: "PROBLEM_PROPOSED",
        title,
        body,
        link: `/propostos?tab=recebidos&id=${params.proposedProblemId}`,
        proposedProblemId: params.proposedProblemId,
      },
    });

    await this.sendEmailNotificationIfConfigured({
      toEmail: params.assigneeEmail,
      subject: `[Nunca Foi Sort()] ${title}`,
      body,
    });
  },

  async notifyProposalStatusUpdated(params: {
    proposerId: string;
    proposerEmail: string;
    assigneeName: string;
    problemTitle: string;
    status: ProposalStatus;
    proposedProblemId: string;
  }) {
    const statusLabel = PROPOSAL_STATUS_META[params.status].label;
    const title = `${params.assigneeName}: ${statusLabel}`;

    const bodyMap: Record<ProposalStatus, string> = {
      PENDENTE: `${params.assigneeName} voltou o status de "${params.problemTitle}" para Pendente.`,
      VISUALIZADO: `${params.assigneeName} visualizou a questão "${params.problemTitle}" que você propôs.`,
      TENTOU: `${params.assigneeName} tentou "${params.problemTitle}" (enviada automaticamente para a lista de revisão).`,
      FEITO: `${params.assigneeName} conseguiu resolver "${params.problemTitle}"!`,
      DESCARTADO: `${params.assigneeName} marcou "${params.problemTitle}" como descartado.`,
    };

    const body = bodyMap[params.status];

    await prisma.notification.create({
      data: {
        userId: params.proposerId,
        type: "PROPOSAL_STATUS_UPDATED",
        title,
        body,
        link: `/propostos?tab=enviados&id=${params.proposedProblemId}`,
        proposedProblemId: params.proposedProblemId,
      },
    });

    await this.sendEmailNotificationIfConfigured({
      toEmail: params.proposerEmail,
      subject: `[Nunca Foi Sort()] ${title}`,
      body,
    });
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
