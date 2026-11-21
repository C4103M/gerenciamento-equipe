"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  Save,
  UserCog,
} from "lucide-react";
import { useActionState, useState } from "react";
import { type ProfileActionState, updateProfileAction } from "@/actions/auth";
import { MemberAvatar } from "@/components/Badges";
import { cn } from "@/lib/utils";
import type { MemberSummary } from "@/types";

export interface MemberDetailStats extends MemberSummary {
  createdAt: string;
  solvedCount: number;
  reviewCount: number;
  totalLogs: number;
  totalAttempts: number;
  accuracyRate: number;
  proposedToMeCount: number;
  proposedByMeCount: number;
  topTopics: Array<{
    id: string;
    name: string;
    slug: string;
    color: string;
    count: number;
  }>;
}

export interface MembersClientProps {
  currentUser: MemberSummary;
  members: MemberDetailStats[];
}

const AVATAR_COLOR_PRESETS = [
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#10b981", label: "Esmeralda" },
  { hex: "#f59e0b", label: "Âmbar" },
  { hex: "#ec4899", label: "Rosa" },
  { hex: "#06b6d4", label: "Ciano" },
  { hex: "#8b5cf6", label: "Violeta" },
] as const;

const initialProfileState: ProfileActionState = {};

/** Client component rendering the logged-in member's profile editor form. */
export function MembersClient({ currentUser, members }: MembersClientProps) {
  const [state, formAction, isPending] = useActionState(
    updateProfileAction,
    initialProfileState
  );

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [cfHandle, setCfHandle] = useState(currentUser.cfHandle ?? "");
  const [lcHandle, setLcHandle] = useState(currentUser.lcHandle ?? "");
  const [avatarColor, setAvatarColor] = useState(currentUser.avatarColor);

  const myStats = members.find((m) => m.id === currentUser.id);

  return (
    <section
      aria-labelledby="meu-perfil-heading"
      className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <MemberAvatar
            member={{
              name: name.trim() || currentUser.name,
              avatarColor,
            }}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2">
              <UserCog
                className="h-4 w-4 text-indigo-400"
                aria-hidden="true"
              />
              <h2
                id="meu-perfil-heading"
                className="text-lg font-semibold tracking-tight text-zinc-100"
              >
                Meu Perfil
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Atualize seu nome, e-mail, handles de juízes online e cor do avatar.
            </p>
          </div>
        </div>

        {myStats ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-1">
              <strong className="text-emerald-400">{myStats.solvedCount}</strong>{" "}
              resolvidas
            </span>
            <span className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-1">
              <strong className="text-indigo-300">
                {myStats.proposedToMeCount}
              </strong>{" "}
              recebidas
            </span>
            <span className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-1">
              <strong className="text-zinc-200">
                {myStats.proposedByMeCount}
              </strong>{" "}
              enviadas
            </span>
          </div>
        ) : null}
      </div>

      <form action={formAction} className="mt-5 space-y-5">
        <input type="hidden" name="avatarColor" value={avatarColor} />

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

        <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
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
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>Salvar alterações</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
