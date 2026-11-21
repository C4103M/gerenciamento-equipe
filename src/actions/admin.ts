"use server";

import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createSession, requireGlobalAdmin } from "@/lib/auth";
import { type EmailDeliveryMode, issueVerificationForUser } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export interface TeamInput {
  name: string;
  inviteCode: string;
  maxMembers: number;
  description?: string;
}

function normalizeInviteCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

export async function createTeamAction(
  input: TeamInput
): Promise<{ error?: string; id?: string }> {
  await requireGlobalAdmin();

  const name = input.name.trim();
  const inviteCode = normalizeInviteCode(input.inviteCode);
  const maxMembers = Number.isFinite(input.maxMembers)
    ? Math.max(1, Math.min(50, Math.trunc(input.maxMembers)))
    : 3;
  const description = input.description?.trim() || null;

  if (name.length < 2) {
    return { error: "O nome da equipe deve ter pelo menos 2 caracteres." };
  }
  if (inviteCode.length < 3) {
    return {
      error:
        "O código de convite deve ter pelo menos 3 caracteres (letras/números).",
    };
  }

  const baseSlug = slugify(name) || "equipe";
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.team.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const existingCode = await prisma.team.findUnique({
    where: { inviteCode },
    select: { id: true },
  });
  if (existingCode) {
    return { error: "Já existe uma equipe utilizando este código de convite." };
  }

  const team = await prisma.team.create({
    data: {
      name,
      slug,
      inviteCode,
      maxMembers,
      description,
    },
    select: { id: true },
  });

  revalidatePath("/admin");
  return { id: team.id };
}

export async function updateTeamAction(
  teamId: string,
  input: TeamInput
): Promise<{ error?: string }> {
  await requireGlobalAdmin();

  const existing = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "Equipe não encontrada." };
  }

  const name = input.name.trim();
  const inviteCode = normalizeInviteCode(input.inviteCode);
  const maxMembers = Number.isFinite(input.maxMembers)
    ? Math.max(1, Math.min(50, Math.trunc(input.maxMembers)))
    : 3;
  const description = input.description?.trim() || null;

  if (name.length < 2) {
    return { error: "O nome da equipe deve ter pelo menos 2 caracteres." };
  }
  if (inviteCode.length < 3) {
    return { error: "O código de convite deve ter pelo menos 3 caracteres." };
  }

  const codeConflict = await prisma.team.findFirst({
    where: { inviteCode, id: { not: teamId } },
    select: { id: true },
  });
  if (codeConflict) {
    return { error: "Outro time já está utilizando este código de convite." };
  }

  await prisma.team.update({
    where: { id: teamId },
    data: {
      name,
      inviteCode,
      maxMembers,
      description,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/", "layout");
  revalidatePath("/membros");
  return {};
}

export async function deleteTeamAction(
  teamId: string
): Promise<{ error?: string }> {
  const admin = await requireGlobalAdmin();

  const existing = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "Equipe não encontrada." };
  }

  await prisma.team.delete({ where: { id: teamId } });

  if (admin.teamId === teamId) {
    await createSession({
      userId: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      teamId: null,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return {};
}

export interface AdminVerificationResult {
  error?: string;
  emailSent?: boolean;
  deliveryMode?: EmailDeliveryMode;
  emailError?: string;
  devPreview?: {
    email: string;
    code: string;
    activationUrl: string;
  };
}

export async function createTeamMemberByAdminAction(input: {
  teamId?: string | null;
  role?: UserRole;
  name: string;
  email: string;
  cfHandle?: string;
  lcHandle?: string;
  avatarColor?: string;
}): Promise<AdminVerificationResult> {
  await requireGlobalAdmin();

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const teamId = input.teamId?.trim() || null;
  const role: UserRole = input.role === "GLOBAL_ADMIN" ? "GLOBAL_ADMIN" : "MEMBER";
  const cfHandle = input.cfHandle?.trim() || null;
  const lcHandle = input.lcHandle?.trim() || null;
  const avatarColor =
    input.avatarColor && /^#[0-9a-fA-F]{6}$/.test(input.avatarColor)
      ? input.avatarColor
      : "#6366f1";

  if (name.length < 2) {
    return { error: "Nome deve ter pelo menos 2 caracteres." };
  }
  if (!email || !email.includes("@")) {
    return { error: "Informe um e-mail válido." };
  }

  let teamName: string | null = null;
  if (teamId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { _count: { select: { members: true } } },
    });
    if (!team) {
      return { error: "Equipe não encontrada." };
    }
    if (team.maxMembers > 0 && team._count.members >= team.maxMembers) {
      return {
        error: `A equipe "${team.name}" já atingiu o limite de ${team.maxMembers} membros.`,
      };
    }
    teamName = team.name;
  }

  const duplicate = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (duplicate) {
    return { error: "Já existe um usuário cadastrado com este e-mail." };
  }

  const created = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: null,
      emailVerifiedAt: null,
      role,
      teamId,
      cfHandle,
      lcHandle,
      avatarColor,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const verification = await issueVerificationForUser(created, teamName);

  revalidatePath("/admin");
  revalidatePath("/membros");

  return {
    emailSent: verification.emailSent,
    deliveryMode: verification.deliveryMode,
    emailError: verification.emailError,
    devPreview:
      !verification.emailSent
        ? {
            email: created.email,
            code: verification.code,
            activationUrl: verification.activationUrl,
          }
        : undefined,
  };
}

export async function resendVerificationAction(
  userId: string
): Promise<AdminVerificationResult> {
  await requireGlobalAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      team: { select: { name: true } },
    },
  });

  if (!user) {
    return { error: "Usuário não encontrado." };
  }
  if (user.emailVerifiedAt && user.passwordHash) {
    return { error: "Este usuário já ativou a conta e definiu a senha." };
  }

  const verification = await issueVerificationForUser(
    { id: user.id, name: user.name, email: user.email },
    user.team?.name
  );

  revalidatePath("/admin");

  return {
    emailSent: verification.emailSent,
    deliveryMode: verification.deliveryMode,
    emailError: verification.emailError,
    devPreview:
      !verification.emailSent
        ? {
            email: user.email,
            code: verification.code,
            activationUrl: verification.activationUrl,
          }
        : undefined,
  };
}

export async function assignUserTeamAction(
  userId: string,
  teamId: string | null
): Promise<{ error?: string }> {
  const admin = await requireGlobalAdmin();

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, teamId: true },
  });
  if (!targetUser) {
    return { error: "Usuário não encontrado." };
  }

  if (teamId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { _count: { select: { members: true } } },
    });
    if (!team) {
      return { error: "Equipe não encontrada." };
    }
    if (
      targetUser.teamId !== teamId &&
      team.maxMembers > 0 &&
      team._count.members >= team.maxMembers
    ) {
      return {
        error: `A equipe "${team.name}" já atingiu o limite de ${team.maxMembers} membros.`,
      };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { teamId },
  });

  if (targetUser.id === admin.id) {
    await createSession({
      userId: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
      teamId,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/", "layout");
  revalidatePath("/membros");
  return {};
}

export async function toggleUserRoleAction(
  userId: string,
  role: UserRole
): Promise<{ error?: string }> {
  const admin = await requireGlobalAdmin();

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, teamId: true },
  });
  if (!targetUser) {
    return { error: "Usuário não encontrado." };
  }

  if (targetUser.role === "GLOBAL_ADMIN" && role !== "GLOBAL_ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "GLOBAL_ADMIN" },
    });
    if (adminCount <= 1) {
      return {
        error: "O sistema precisa manter pelo menos 1 Administrador Global.",
      };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  if (targetUser.id === admin.id) {
    await createSession({
      userId: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role,
      teamId: targetUser.teamId,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return {};
}
