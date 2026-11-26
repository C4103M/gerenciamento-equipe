"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Eraser,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { lookupUserCodeforcesSubmissionAction } from "@/actions/codeforces";
import { parseCodeforcesRef } from "@/lib/codeforces";
import { MAX_SOLUTION_CODE_LENGTH } from "@/lib/url";
import { cn } from "@/lib/utils";
import type { SolutionAttachMode } from "@/types";

export interface SolutionAutoLookupHint {
  externalId: string;
  cfHandle: string | null;
  cfHandleConfigured: boolean;
  error?: string | null;
}

export interface SolutionFieldsInputProps {
  mode: SolutionAttachMode;
  onModeChange: (mode: SolutionAttachMode) => void;
  problemUrl: string;
  solutionUrl: string;
  onSolutionUrlChange: (value: string) => void;
  dismissedAutoLink?: boolean;
  onDismissAutoLinkChange?: (dismissed: boolean) => void;
  solutionCode: string;
  onSolutionCodeChange: (value: string) => void;
  disabled?: boolean;
  isLoadingCode?: boolean;
  deferAutoLookup?: boolean;
  externalLookupHint?: SolutionAutoLookupHint | null;
  codeInputId?: string;
}

interface ResolvedLookupState {
  key: string;
  cfHandle: string | null;
  cfHandleConfigured: boolean;
  error: string | null;
}

/**
 * Solution attachment selector allowing the user to choose exclusively between
 * an automatic Codeforces submission link or pasting solution source code.
 * Manual solution URL typing is intentionally disabled.
 */
export function SolutionFieldsInput({
  mode,
  onModeChange,
  problemUrl,
  solutionUrl,
  onSolutionUrlChange,
  dismissedAutoLink = false,
  onDismissAutoLinkChange,
  solutionCode,
  onSolutionCodeChange,
  disabled = false,
  isLoadingCode = false,
  deferAutoLookup = false,
  externalLookupHint = null,
  codeInputId,
}: SolutionFieldsInputProps) {
  const generatedId = useId();
  const resolvedCodeId = codeInputId ?? `${generatedId}-solution-code`;
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [resolvedState, setResolvedState] =
    useState<ResolvedLookupState | null>(null);

  const trimmedProblemUrl = problemUrl.trim();
  const cfRef = useMemo(
    () => (trimmedProblemUrl ? parseCodeforcesRef(trimmedProblemUrl) : null),
    [trimmedProblemUrl]
  );

  const targetKey = cfRef ? `${cfRef.externalId}:${refreshNonce}` : null;
  const hintCoversCurrent = Boolean(
    cfRef &&
      externalLookupHint &&
      externalLookupHint.externalId === cfRef.externalId &&
      refreshNonce === 0
  );

  const shouldAutoFetch =
    mode === "link" &&
    Boolean(cfRef) &&
    Boolean(targetKey) &&
    !deferAutoLookup &&
    !dismissedAutoLink &&
    !hintCoversCurrent &&
    resolvedState?.key !== targetKey &&
    (refreshNonce > 0 || !solutionUrl);

  const isFetchingLink =
    shouldAutoFetch ||
    (mode === "link" &&
      Boolean(cfRef) &&
      deferAutoLookup &&
      refreshNonce === 0 &&
      !solutionUrl &&
      !dismissedAutoLink);

  useEffect(() => {
    if (!shouldAutoFetch || !targetKey || !trimmedProblemUrl) return;

    let cancelled = false;
    void lookupUserCodeforcesSubmissionAction(trimmedProblemUrl)
      .then((res) => {
        if (cancelled) return;
        setResolvedState({
          key: targetKey,
          cfHandle: res.cfHandle,
          cfHandleConfigured: res.cfHandleConfigured,
          error: res.error ?? null,
        });
        if (!res.error) {
          onSolutionUrlChange(res.solutionUrl ?? "");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedState({
          key: targetKey,
          cfHandle: null,
          cfHandleConfigured: true,
          error: "Erro ao consultar suas submissões no Codeforces.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [shouldAutoFetch, targetKey, trimmedProblemUrl, onSolutionUrlChange]);

  const currentLookupMeta =
    resolvedState?.key === targetKey
      ? resolvedState
      : hintCoversCurrent && externalLookupHint
        ? {
            cfHandle: externalLookupHint.cfHandle,
            cfHandleConfigured: externalLookupHint.cfHandleConfigured,
            error: externalLookupHint.error ?? null,
          }
        : null;

  const codeLength = solutionCode.length;
  const isOverLimit = codeLength > MAX_SOLUTION_CODE_LENGTH;

  function handleRefreshLookup() {
    onDismissAutoLinkChange?.(false);
    setRefreshNonce((n) => n + 1);
  }

  function handleRemoveLink() {
    onDismissAutoLinkChange?.(true);
    onSolutionUrlChange("");
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="block text-sm font-medium text-zinc-200">
          Solução{" "}
          <span className="text-xs font-normal text-zinc-500">(opcional)</span>
        </span>

        <div
          className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5"
          role="radiogroup"
          aria-label="Forma de anexar a solução"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "link"}
            disabled={disabled}
            onClick={() => onModeChange("link")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50",
              mode === "link"
                ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Link automático</span>
            <span className="rounded bg-sky-500/20 px-1 py-0.5 font-mono text-[10px] text-sky-300">
              CF
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={mode === "code"}
            disabled={disabled}
            onClick={() => onModeChange("code")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50",
              mode === "code"
                ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Colar código</span>
          </button>
        </div>
      </div>

      {mode === "link" ? (
        !trimmedProblemUrl ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
            Informe o link ou código da questão do Codeforces acima para o
            sistema montar automaticamente o link da sua submissão aceita (AC).
          </div>
        ) : !cfRef ? (
          <div className="flex flex-col gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-xs text-zinc-300 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-relaxed text-zinc-400">
              Montagem automática de link está disponível apenas para questões
              do Codeforces. Para esta plataforma, cole o código da solução.
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onModeChange("code")}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/25 disabled:opacity-50 sm:self-auto"
            >
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Trocar para Colar código</span>
            </button>
          </div>
        ) : isFetchingLink ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3.5 py-3 text-xs text-sky-200">
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin text-sky-300"
              aria-hidden="true"
            />
            <span>
              Montando link da sua submissão aceita no Codeforces...
            </span>
          </div>
        ) : solutionUrl ? (
          <div className="space-y-2">
            <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Link montado automaticamente (Codeforces)</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <a
                    href={solutionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/25"
                  >
                    <span>Abrir</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={handleRefreshLookup}
                    title="Buscar novamente sua última submissão AC no Codeforces"
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" aria-hidden="true" />
                    <span>Atualizar</span>
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={handleRemoveLink}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    <span>Remover</span>
                  </button>
                </div>
              </div>

              <p className="rounded-md border border-emerald-500/20 bg-zinc-950/80 px-2.5 py-1.5 font-mono text-[11px] break-all text-zinc-200">
                {solutionUrl}
              </p>
            </div>

            {currentLookupMeta?.error ? (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{currentLookupMeta.error}</span>
              </p>
            ) : null}
          </div>
        ) : dismissedAutoLink ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 text-xs text-zinc-400">
            <span>Link automático removido para este registro.</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={handleRefreshLookup}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span>Buscar novamente</span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onModeChange("code")}
                className="inline-flex items-center gap-1 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/25 disabled:opacity-50"
              >
                <Code2 className="h-3 w-3" aria-hidden="true" />
                <span>Colar código</span>
              </button>
            </div>
          </div>
        ) : currentLookupMeta && !currentLookupMeta.cfHandleConfigured ? (
          <div className="flex flex-col gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-xs text-zinc-300 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-relaxed text-zinc-400">
              Configure seu handle do Codeforces no{" "}
              <Link
                href="/perfil"
                className="font-medium text-sky-300 underline hover:text-sky-200"
              >
                Perfil
              </Link>{" "}
              para o sistema montar o link automaticamente, ou cole o código.
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onModeChange("code")}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/25 disabled:opacity-50 sm:self-auto"
            >
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Colar código</span>
            </button>
          </div>
        ) : currentLookupMeta?.error ? (
          <div className="flex flex-col gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                aria-hidden="true"
              />
              <span>{currentLookupMeta.error}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={handleRefreshLookup}
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span>Tentar novamente</span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onModeChange("code")}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                <Code2 className="h-3 w-3" aria-hidden="true" />
                <span>Colar código</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-xs text-zinc-300 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-relaxed text-zinc-400">
              Nenhuma submissão aceita (AC) encontrada para{" "}
              <span className="font-mono text-zinc-200">
                {currentLookupMeta?.cfHandle ?? "seu handle"}
              </span>{" "}
              em <span className="font-mono text-zinc-200">{cfRef.code}</span>.
              Você pode buscar novamente após enviar no CF ou colar o código.
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={handleRefreshLookup}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span>Buscar novamente</span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onModeChange("code")}
                className="inline-flex items-center gap-1 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/25 disabled:opacity-50"
              >
                <Code2 className="h-3 w-3" aria-hidden="true" />
                <span>Colar código</span>
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={resolvedCodeId}
              className="text-xs font-medium text-zinc-300"
            >
              Código-fonte da solução
            </label>

            {!isLoadingCode && codeLength > 0 ? (
              <button
                type="button"
                onClick={() => onSolutionCodeChange("")}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
              >
                <Eraser className="h-3 w-3" aria-hidden="true" />
                <span>Limpar</span>
              </button>
            ) : null}
          </div>

          {isLoadingCode ? (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-6 text-xs text-zinc-400">
              <Loader2
                className="h-4 w-4 animate-spin text-indigo-400"
                aria-hidden="true"
              />
              <span>Carregando código salvo...</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <textarea
                id={resolvedCodeId}
                rows={7}
                spellCheck={false}
                value={solutionCode}
                onChange={(e) => onSolutionCodeChange(e.target.value)}
                disabled={disabled}
                placeholder="Cole aqui o código-fonte aceito (C++, Python, Java, etc.)..."
                className={cn(
                  "w-full resize-y rounded-lg border bg-zinc-950 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:ring-2 focus:outline-none disabled:opacity-50",
                  isOverLimit
                    ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20"
                    : "border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500/20"
                )}
              />
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">
                  Indentação preservada para leitura e cópia rápida pela equipe.
                </span>
                <span
                  className={cn(
                    "font-mono",
                    isOverLimit ? "font-semibold text-rose-400" : "text-zinc-500"
                  )}
                >
                  {codeLength.toLocaleString("pt-BR")} /{" "}
                  {MAX_SOLUTION_CODE_LENGTH.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
