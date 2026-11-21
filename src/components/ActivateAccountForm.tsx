"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { activateAccountAction, type AuthActionState } from "@/actions/auth";

export interface ActivateAccountFormProps {
  token?: string;
  presetUser?: {
    name: string;
    email: string;
    teamName: string | null;
    cfHandle: string | null;
    lcHandle: string | null;
  } | null;
}

const initialAuthState: AuthActionState = {};

export function ActivateAccountForm({
  token,
  presetUser,
}: ActivateAccountFormProps) {
  const [state, formAction, isPending] = useActionState(
    activateAccountAction,
    initialAuthState
  );
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <div className="space-y-5">
      {presetUser && (
        <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3.5 text-sm">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-zinc-100">{presetUser.name}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-zinc-300">
                <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="truncate">{presetUser.email}</span>
              </p>
              {presetUser.teamName && (
                <p className="flex items-center gap-1.5 text-xs text-indigo-300">
                  <Users className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  <span>Equipe: {presetUser.teamName}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token ?? ""} />

        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{state.error}</span>
          </div>
        )}

        {!presetUser && (
          <div className="space-y-1.5">
            <label
              htmlFor="activate-email"
              className="block text-sm font-medium text-zinc-300"
            >
              E-mail cadastrado
            </label>
            <input
              id="activate-email"
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
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="activate-code"
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-300"
          >
            <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
            Código de Verificação (6 dígitos)
          </label>
          <input
            id="activate-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.35em] text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="activate-password"
            className="block text-sm font-medium text-zinc-300"
          >
            Nova Senha
          </label>
          <input
            id="activate-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="activate-confirm-password"
            className="block text-sm font-medium text-zinc-300"
          >
            Confirmar Senha
          </label>
          <input
            id="activate-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita sua nova senha"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="activate-cf"
              className="block text-xs font-medium text-zinc-400"
            >
              Codeforces (opcional)
            </label>
            <input
              id="activate-cf"
              name="cfHandle"
              type="text"
              defaultValue={presetUser?.cfHandle ?? ""}
              placeholder="ex: tourist"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="activate-lc"
              className="block text-xs font-medium text-zinc-400"
            >
              LeetCode (opcional)
            </label>
            <input
              id="activate-lc"
              name="lcHandle"
              type="text"
              defaultValue={presetUser?.lcHandle ?? ""}
              placeholder="ex: neal_wu"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Ativando conta...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              <span>Validar e-mail e criar senha</span>
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-400">
        Já ativou sua conta?{" "}
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
