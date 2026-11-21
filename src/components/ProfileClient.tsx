"use client";

import type { UserRole } from "@prisma/client";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  changePasswordAction,
  type ProfileActionState,
  updateProfileAction,
} from "@/actions/auth";
import { MemberAvatar } from "@/components/Badges";
import { cn } from "@/lib/utils";

export interface ProfileUserData {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cfHandle: string | null;
  lcHandle: string | null;
  avatarColor: string;
  createdAt: string;
  teamName: string | null;
}

export interface ProfileClientProps {
  user: ProfileUserData;
}

const AVATAR_COLOR_PRESETS = [
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#10b981", label: "Esmeralda" },
  { hex: "#f59e0b", label: "Âmbar" },
  { hex: "#ec4899", label: "Rosa" },
  { hex: "#06b6d4", label: "Ciano" },
  { hex: "#8b5cf6", label: "Violeta" },
] as const;

const initialActionState: ProfileActionState = {};

function ActionFeedbackBanner({ state }: { state: ProfileActionState }) {
  if (!state.error && !state.success) return null;

  return (
    <div className="space-y-2">
      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-rose-400"
            aria-hidden="true"
          />
          <span>{state.error}</span>
        </div>
      ) : null}

      {state.success ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
            aria-hidden="true"
          />
          <span>{state.success}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Client view for managing the authenticated user's profile and password. */
export function ProfileClient({ user }: ProfileClientProps) {
  const [profileState, profileFormAction, isProfilePending] = useActionState(
    updateProfileAction,
    initialActionState
  );
  const [passwordState, passwordFormAction, isPasswordPending] = useActionState(
    changePasswordAction,
    initialActionState
  );

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [cfHandle, setCfHandle] = useState(user.cfHandle ?? "");
  const [lcHandle, setLcHandle] = useState(user.lcHandle ?? "");
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);

  const pwFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (passwordState.success) {
      pwFormRef.current?.reset();
    }
  }, [passwordState.success]);

  const isGlobalAdmin = user.role === "GLOBAL_ADMIN";
  const memberSince = new Date(user.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const displayName = name.trim() || user.name;
  const displayEmail = email.trim() || user.email;

  return (
    <div className="space-y-6">
      {/* Identity & Live Avatar Preview Header Card */}
      <section
        aria-label="Resumo do perfil"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <MemberAvatar
              member={{
                name: displayName,
                avatarColor,
              }}
              size="lg"
            />
            <div className="min-w-0 space-y-1">
              <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-100">
                {displayName}
              </h2>
              <p className="flex items-center gap-1.5 truncate text-sm text-zinc-400">
                <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                <span className="truncate">{displayEmail}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                isGlobalAdmin
                  ? "border-pink-500/30 bg-gradient-to-r from-pink-500/15 to-indigo-500/15 text-pink-200"
                  : "border-zinc-700 bg-zinc-800/80 text-zinc-300"
              )}
            >
              {isGlobalAdmin ? (
                <ShieldCheck className="h-3.5 w-3.5 text-pink-400" aria-hidden="true" />
              ) : (
                <User className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
              )}
              <span>
                {isGlobalAdmin ? "Administrador Global" : "Membro"}
              </span>
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                user.teamName
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-200"
                  : "border-zinc-800 bg-zinc-950/70 text-zinc-400"
              )}
            >
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{user.teamName ?? "Sem equipe"}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-400">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
              <span>Membro desde {memberSince}</span>
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Card 1 — Dados da Conta */}
        <section
          aria-labelledby="dados-conta-heading"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm lg:col-span-7"
        >
          <div className="flex items-start gap-3 border-b border-zinc-800 pb-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
              <UserCog className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="dados-conta-heading"
                className="text-base font-semibold tracking-tight text-zinc-100"
              >
                Dados da Conta
              </h2>
              <p className="text-xs text-zinc-400">
                Atualize seu nome, e-mail, handles de juízes online e cor do avatar.
              </p>
            </div>
          </div>

          <form action={profileFormAction} className="mt-5 space-y-5">
            <input type="hidden" name="avatarColor" value={avatarColor} />

            <ActionFeedbackBanner state={profileState} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-name"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Nome <span className="text-rose-400">*</span>
                </label>
                <input
                  id="profile-name"
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="profile-email"
                  className="block text-sm font-medium text-zinc-200"
                >
                  E-mail <span className="text-rose-400">*</span>
                </label>
                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="profile-cf"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Handle Codeforces{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    (opcional)
                  </span>
                </label>
                <input
                  id="profile-cf"
                  name="cfHandle"
                  type="text"
                  value={cfHandle}
                  onChange={(e) => setCfHandle(e.target.value)}
                  placeholder="ex: tourist"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="profile-lc"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Handle LeetCode{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    (opcional)
                  </span>
                </label>
                <input
                  id="profile-lc"
                  name="lcHandle"
                  type="text"
                  value={lcHandle}
                  onChange={(e) => setLcHandle(e.target.value)}
                  placeholder="ex: neal_wu"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <span className="block text-sm font-medium text-zinc-200">
                  Cor do avatar
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {AVATAR_COLOR_PRESETS.map((preset) => {
                    const selected =
                      avatarColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setAvatarColor(preset.hex)}
                        aria-label={`Cor ${preset.label}`}
                        aria-pressed={selected}
                        title={preset.label}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                          selected
                            ? "scale-105 ring-2 ring-white ring-offset-2 ring-offset-zinc-900"
                            : "opacity-80 hover:opacity-100"
                        )}
                        style={{ backgroundColor: preset.hex }}
                      >
                        {selected ? (
                          <Check className="h-4 w-4 text-white" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isProfilePending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isProfilePending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    <span>Salvar Dados</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Card 2 — Alterar Senha */}
        <section
          aria-labelledby="alterar-senha-heading"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm lg:col-span-5"
        >
          <div className="flex items-start gap-3 border-b border-zinc-800 pb-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="alterar-senha-heading"
                className="text-base font-semibold tracking-tight text-zinc-100"
              >
                Alterar Senha
              </h2>
              <p className="text-xs text-zinc-400">
                Defina uma nova senha de acesso com pelo menos 6 caracteres.
              </p>
            </div>
          </div>

          <form
            ref={pwFormRef}
            action={passwordFormAction}
            className="mt-5 space-y-4"
          >
            <ActionFeedbackBanner state={passwordState} />

            <div className="space-y-1.5">
              <label
                htmlFor="current-password"
                className="block text-sm font-medium text-zinc-200"
              >
                Senha atual <span className="text-rose-400">*</span>
              </label>
              <input
                id="current-password"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-zinc-200"
              >
                Nova senha <span className="text-rose-400">*</span>
              </label>
              <input
                id="new-password"
                name="newPassword"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Mínimo de 6 caracteres"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-zinc-200"
              >
                Confirmar nova senha <span className="text-rose-400">*</span>
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Repita a nova senha"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPasswordPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-100 shadow-sm transition-colors hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPasswordPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Atualizando...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    <span>Atualizar Senha</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
