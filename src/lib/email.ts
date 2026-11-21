import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export type EmailDeliveryMode = "resend" | "smtp" | "dev";

export interface SendEmailResult {
  sent: boolean;
  mode: EmailDeliveryMode;
  error?: string;
}

export function getAppBaseUrl(): string {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.trim()}`
      : "");

  const base = configured || "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.NOTIFICATION_FROM_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "Nunca Foi ICPC <onboarding@resend.dev>";

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        return {
          sent: false,
          mode: "resend",
          error: `Resend HTTP ${response.status}: ${bodyText || response.statusText}`,
        };
      }

      return { sent: true, mode: "resend" };
    } catch (err) {
      return {
        sent: false,
        mode: "resend",
        error: err instanceof Error ? err.message : "Falha ao enviar via Resend.",
      };
    }
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const port = Number(process.env.SMTP_PORT || 587);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });

      return { sent: true, mode: "smtp" };
    } catch (err) {
      return {
        sent: false,
        mode: "smtp",
        error: err instanceof Error ? err.message : "Falha ao enviar via SMTP.",
      };
    }
  }

  console.info(
    [
      "============================================================",
      "[DEV EMAIL PREVIEW] Nenhum provedor de e-mail configurado.",
      `Para: ${params.to}`,
      `Assunto: ${params.subject}`,
      params.text,
      "============================================================",
    ].join("\n")
  );

  return { sent: false, mode: "dev" };
}

export async function sendAccountVerificationEmail(params: {
  to: string;
  name: string;
  teamName?: string | null;
  code: string;
  activationUrl: string;
}): Promise<SendEmailResult> {
  const safeName = escapeHtml(params.name);
  const safeTeam = params.teamName ? escapeHtml(params.teamName) : null;
  const safeCode = escapeHtml(params.code);
  const safeUrl = escapeHtml(params.activationUrl);

  const teamSentenceHtml = safeTeam
    ? ` na equipe <strong>${safeTeam}</strong>`
    : "";
  const teamSentenceText = params.teamName
    ? ` na equipe ${params.teamName}`
    : "";

  const subject = "Nunca Foi ICPC — Código de verificação e criação de senha";

  const text = [
    `Olá, ${params.name}!`,
    "",
    `Sua conta foi cadastrada no Nunca Foi ICPC${teamSentenceText}.`,
    "Para validar seu e-mail e criar sua senha de acesso, utilize o código abaixo:",
    "",
    `Código de verificação: ${params.code}`,
    "",
    `Acesse o link de ativação (válido por 24 horas):`,
    params.activationUrl,
    "",
    "Se você não esperava este cadastro, pode ignorar esta mensagem.",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 32px 16px;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden;">
        <div style="display: flex; height: 4px; width: 100%;">
          <div style="flex: 1; background-color: #2563eb;"></div>
          <div style="flex: 1; background-color: #eab308;"></div>
          <div style="flex: 1; background-color: #dc2626;"></div>
        </div>
        <div style="padding: 28px;">
          <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; font-size: 18px; color: #f4f4f5; margin-bottom: 4px;">
            Nunca Foi <span style="color: #facc15;">ICPC</span>
          </div>
          <div style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #a1a1aa; margin-bottom: 18px;">
            International Collegiate Programming Contest
          </div>
          <h1 style="margin: 0 0 12px; font-size: 20px; color: #fafafa;">
            Olá, ${safeName}!
          </h1>
        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #d4d4d8;">
          Seu cadastro foi realizado pelo Administrador Global${teamSentenceHtml}. Para confirmar seu e-mail e definir sua senha, acesse o link abaixo e informe o código de verificação:
        </p>
        <div style="background-color: #09090b; border: 1px solid #3f3f46; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #a1a1aa; margin-bottom: 6px;">
            Código de verificação
          </div>
          <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 30px; font-weight: 700; letter-spacing: 0.25em; color: #a5b4fc;">
            ${safeCode}
          </div>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${safeUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 10px;">
            Validar e-mail e criar senha
          </a>
        </div>
        <p style="margin: 16px 0 0; font-size: 12px; line-height: 1.5; color: #a1a1aa; word-break: break-all;">
          Ou copie este link no navegador (válido por 24 horas):<br />
          <a href="${safeUrl}" style="color: #818cf8;">${safeUrl}</a>
        </p>
        </div>
      </div>
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
  });
}

export async function issueVerificationForUser(
  user: { id: string; name: string; email: string },
  teamName?: string | null
): Promise<{
  code: string;
  activationUrl: string;
  emailSent: boolean;
  deliveryMode: EmailDeliveryMode;
  emailError?: string;
}> {
  await prisma.verificationToken.deleteMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
  });

  const token = crypto.randomBytes(24).toString("hex");
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      token,
      code,
      expiresAt,
    },
  });

  const activationUrl = `${getAppBaseUrl()}/ativar?token=${token}`;
  const result = await sendAccountVerificationEmail({
    to: user.email,
    name: user.name,
    teamName,
    code,
    activationUrl,
  });

  return {
    code,
    activationUrl,
    emailSent: result.sent,
    deliveryMode: result.mode,
    emailError: result.error,
  };
}
