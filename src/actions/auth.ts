"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, createSession, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface AuthActionState {
  error?: string;
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "E-mail ou senha inválidos." };
  }

  if (!user.passwordHash || !user.emailVerifiedAt) {
    return {
      error:
        "Sua conta ainda não foi ativada. Utilize o código de verificação e o link enviados para o seu e-mail para criar sua senha.",
    };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "E-mail ou senha inválidos." };
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    teamId: user.teamId,
  });

  if (user.role === "GLOBAL_ADMIN" && !user.teamId) {
    redirect("/admin");
  }
  if (!user.teamId) {
    redirect("/sem-equipe");
  }

  redirect("/");
}

export async function activateAccountAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const token = String(formData.get("token") ?? "").trim();
  const emailInput = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "")
    .trim()
    .replace(/\s+/g, "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const cfHandle = String(formData.get("cfHandle") ?? "").trim();
  const lcHandle = String(formData.get("lcHandle") ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return { error: "Informe o código de verificação de 6 dígitos enviado ao seu e-mail." };
  }
  if (!password || password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "As senhas não coincidem." };
  }

  let record = null;

  if (token) {
    record = await prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true },
    });
  } else {
    if (!emailInput || !emailInput.includes("@")) {
      return { error: "Informe seu e-mail cadastrado." };
    }
    const userByEmail = await prisma.user.findUnique({
      where: { email: emailInput },
      select: { id: true },
    });
    if (userByEmail) {
      record = await prisma.verificationToken.findFirst({
        where: {
          userId: userByEmail.id,
          usedAt: null,
        },
        orderBy: { createdAt: "desc" },
        include: { user: true },
      });
    }
  }

  if (!record) {
    return {
      error:
        "Link ou código de verificação inválido. Solicite um novo envio ao Administrador Global.",
    };
  }

  if (record.usedAt) {
    return {
      error:
        "Este link de ativação já foi utilizado. Faça login com a sua senha.",
    };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return {
      error:
        "Este código expirou. Peça ao Administrador Global para reenviar a verificação.",
    };
  }

  if (record.code !== code) {
    return {
      error: "Código de verificação incorreto. Confira os 6 dígitos no seu e-mail.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  const updatedUser = await prisma.$transaction(async (tx) => {
    await tx.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    });

    return tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        emailVerifiedAt: now,
        cfHandle: cfHandle || record.user.cfHandle,
        lcHandle: lcHandle || record.user.lcHandle,
      },
    });
  });

  await createSession({
    userId: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
    teamId: updatedUser.teamId,
  });

  revalidatePath("/admin");
  revalidatePath("/membros");

  if (updatedUser.role === "GLOBAL_ADMIN" && !updatedUser.teamId) {
    redirect("/admin");
  }
  if (!updatedUser.teamId) {
    redirect("/sem-equipe");
  }
  redirect("/");
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  void formData;
  return {
    error:
      "O cadastro de novos membros é feito pelo Administrador Global. Acesse /ativar com o link e o código enviados ao seu e-mail.",
  };
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export interface ProfileActionState {
  error?: string;
  success?: string;
}

export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const currentUser = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const cfHandle = String(formData.get("cfHandle") ?? "").trim() || null;
  const lcHandle = String(formData.get("lcHandle") ?? "").trim() || null;
  const avatarColor = String(formData.get("avatarColor") ?? "#6366f1").trim();

  if (!name || name.length < 2) {
    return { error: "Nome deve ter pelo menos 2 caracteres." };
  }
  if (!email || !email.includes("@")) {
    return { error: "E-mail inválido." };
  }

  if (email !== currentUser.email) {
    const duplicate = await prisma.user.findUnique({ where: { email } });
    if (duplicate) {
      return { error: "Este e-mail já está em uso por outro usuário." };
    }
  }

  const cfHandleChanged = (cfHandle ?? "") !== (currentUser.cfHandle ?? "");

  const updated = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      name,
      email,
      cfHandle,
      lcHandle,
      ...(cfHandleChanged ? { cfLastSyncedAt: null } : {}),
      avatarColor: /^#[0-9a-fA-F]{6}$/.test(avatarColor)
        ? avatarColor
        : currentUser.avatarColor,
    },
  });

  await createSession({
    userId: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    teamId: updated.teamId,
  });

  revalidatePath("/", "layout");
  revalidatePath("/membros");
  revalidatePath("/admin");
  revalidatePath("/perfil");
  return { success: "Perfil atualizado com sucesso!" };
}

export async function changePasswordAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const currentUser = await requireUser();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Preencha a senha atual, a nova senha e a confirmação." };
  }
  if (newPassword.length < 6) {
    return { error: "A nova senha deve ter pelo menos 6 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "A confirmação da nova senha não coincide." };
  }

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return { error: "Conta sem senha cadastrada para alteração." };
  }

  const matchesCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matchesCurrent) {
    return { error: "A senha atual está incorreta." };
  }

  const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsOld) {
    return { error: "A nova senha deve ser diferente da senha atual." };
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: currentUser.id },
    data: { passwordHash: newHash },
  });

  revalidatePath("/perfil");
  return { success: "Senha atualizada com sucesso!" };
}
