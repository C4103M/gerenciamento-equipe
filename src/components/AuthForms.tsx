"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  KeyRound,
  Loader2,
  LogIn,
  UserPlus,
} from "lucide-react";
import {
  loginAction,
  registerAction,
  type AuthActionState,
} from "@/actions/auth";
import { cn } from "@/lib/utils";

const AVATAR_COLOR_PRESETS = [
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#10b981", label: "Esmeralda" },
  { hex: "#f59e0b", label: "Âmbar" },
  { hex: "#ec4899", label: "Rosa" },
  { hex: "#06b6d4", label: "Ciano" },
  { hex: "#8b5cf6", label: "Violeta" },
] as const;

const initialAuthState: AuthActionState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialAuthState
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{state.error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-zinc-300"
          >
            E-mail
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-zinc-300"
          >
            Senha
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Entrando...</span>
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              <span>Entrar</span>
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-400">
        Recebeu um código de verificação?{" "}
        <Link
          href="/ativar"
          className="font-medium text-indigo-400 transition hover:text-indigo-300"
        >
          Ativar conta e criar senha
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(
    registerAction,
    initialAuthState
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cfHandle, setCfHandle] = useState("");
  const [lcHandle, setLcHandle] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [avatarColor, setAvatarColor] = useState<string>(
    AVATAR_COLOR_PRESETS[0].hex
  );

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="avatarColor" value={avatarColor} />

        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{state.error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="register-name"
            className="block text-sm font-medium text-zinc-300"
          >
            Nome
          </label>
          <input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome na equipe"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="register-email"
            className="block text-sm font-medium text-zinc-300"
          >
            E-mail
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="register-password"
            className="block text-sm font-medium text-zinc-300"
          >
            Senha
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="register-cf"
              className="block text-xs font-medium text-zinc-400"
            >
              Codeforces (opcional)
            </label>
            <input
              id="register-cf"
              name="cfHandle"
              type="text"
              value={cfHandle}
              onChange={(e) => setCfHandle(e.target.value)}
              placeholder="ex: tourist"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="register-lc"
              className="block text-xs font-medium text-zinc-400"
            >
              LeetCode (opcional)
            </label>
            <input
              id="register-lc"
              name="lcHandle"
              type="text"
              value={lcHandle}
              onChange={(e) => setLcHandle(e.target.value)}
              placeholder="ex: neal_wu"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-zinc-300">
            Cor do avatar
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            {AVATAR_COLOR_PRESETS.map((preset) => {
              const selected = avatarColor === preset.hex;
              return (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => setAvatarColor(preset.hex)}
                  aria-label={`Cor ${preset.label}`}
                  aria-pressed={selected}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition",
                    selected
                      ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-105"
                      : "opacity-80 hover:opacity-100"
                  )}
                  style={{ backgroundColor: preset.hex }}
                >
                  {selected && <Check className="h-4 w-4 text-white" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="register-invite"
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-300"
          >
            <KeyRound className="h-3.5 w-3.5 text-amber-400" />
            Código de Convite da Equipe
          </label>
          <input
            id="register-invite"
            name="inviteCode"
            type="text"
            required
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Ex: NFS2026"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 font-mono text-sm text-zinc-100 placeholder:font-sans placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <p className="text-xs text-zinc-500">
            Solicite o código da sua equipe ao Administrador Global.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Criando conta...</span>
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              <span>Criar conta</span>
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-400">
        Já faz parte da equipe?{" "}
        <Link
          href="/login"
          className="font-medium text-indigo-400 transition hover:text-indigo-300"
        >
          Fazer login
        </Link>
      </p>
    </div>
  );
}
