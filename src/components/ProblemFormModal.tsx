"use client";

import type { Difficulty } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Loader2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createProblemLogAction,
  updateProblemLogAction,
} from "@/actions/problems";
import { PlatformBadge } from "@/components/Badges";
import { TopicSelector } from "@/components/TopicSelector";
import { DIFFICULTY_META, detectPlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";
import type { ProblemLogItem, TopicItem } from "@/types";

export interface ProblemFormModalProps {
  open: boolean;
  onClose: () => void;
  topics: TopicItem[];
  initialProblem?: ProblemLogItem | null;
}

const DIFFICULTY_OPTIONS: Difficulty[] = [
  "FACIL",
  "MEDIO",
  "DIFICIL",
  "MUITO_DIFICIL",
];

/** Modal dialog for logging a new problem or editing an existing problem log. */
export function ProblemFormModal({
  open,
  onClose,
  topics,
  initialProblem = null,
}: ProblemFormModalProps) {
  if (!open) return null;

  return (
    <ProblemFormContent
      key={initialProblem?.id ?? "new-problem"}
      onClose={onClose}
      topics={topics}
      initialProblem={initialProblem}
    />
  );
}

function ProblemFormContent({
  onClose,
  topics,
  initialProblem,
}: Omit<ProblemFormModalProps, "open">) {
  const router = useRouter();
  const isEditing = Boolean(initialProblem);

  const [title, setTitle] = useState(initialProblem?.title ?? "");
  const [url, setUrl] = useState(initialProblem?.url ?? "");
  const [topicIds, setTopicIds] = useState<string[]>(
    initialProblem?.topics.map((t) => t.id) ?? []
  );
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<Difficulty>(
    initialProblem?.perceivedDifficulty ?? "MEDIO"
  );
  const [solved, setSolved] = useState<boolean>(initialProblem?.solved ?? true);
  const [needsReview, setNeedsReview] = useState<boolean>(
    initialProblem?.needsReview ?? false
  );
  const [notes, setNotes] = useState(initialProblem?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  const trimmedUrl = url.trim();
  const detectedPlatform = trimmedUrl ? detectPlatform(trimmedUrl) : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 2) {
      setError("Informe o título da questão (mínimo de 2 caracteres).");
      return;
    }
    if (!trimmedUrl) {
      setError("Informe o link da questão (Codeforces, LeetCode, etc.).");
      return;
    }
    if (topicIds.length === 0) {
      setError("Selecione pelo menos 1 tópico.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title,
        url,
        topicIds,
        perceivedDifficulty,
        solved,
        needsReview: solved ? needsReview : true,
        notes,
      };

      const result = initialProblem
        ? await updateProblemLogAction(initialProblem.id, payload)
        : await createProblemLogAction(payload);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError("Ocorreu um erro ao salvar a questão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="problem-modal-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2
              id="problem-modal-title"
              className="text-lg font-semibold tracking-tight text-zinc-100"
            >
              {isEditing ? "Editar Questão" : "Registrar Questão"}
            </h2>
            <p className="text-xs text-zinc-400">
              {isEditing
                ? "Atualize os detalhes, tópicos ou status desta questão."
                : "Registre uma questão praticada para acompanhar o progresso da equipe."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar modal"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
              >
                {error}
              </div>
            ) : null}

            {/* Title */}
            <div className="space-y-1.5">
              <label
                htmlFor="problem-title"
                className="block text-sm font-medium text-zinc-200"
              >
                Título da questão <span className="text-rose-400">*</span>
              </label>
              <input
                id="problem-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Codeforces 1800E2 - Unforgivable Curse"
                required
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            {/* URL + Live Platform Badge */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="problem-url"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Link da questão <span className="text-rose-400">*</span>
                </label>
                {detectedPlatform ? (
                  <PlatformBadge platform={detectedPlatform} />
                ) : null}
              </div>
              <div className="relative">
                <Link2
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id="problem-url"
                  type="text"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://codeforces.com/problemset/problem/..."
                  required
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pr-3.5 pl-10 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Topics */}
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-zinc-200">
                Tópicos <span className="text-rose-400">*</span>
              </span>
              <TopicSelector
                allTopics={topics}
                selectedIds={topicIds}
                onChange={setTopicIds}
              />
            </div>

            {/* Perceived Difficulty */}
            <div className="space-y-2">
              <span className="block text-sm font-medium text-zinc-200">
                Dificuldade percebida
              </span>
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                role="radiogroup"
                aria-label="Dificuldade percebida"
              >
                {DIFFICULTY_OPTIONS.map((diff) => {
                  const meta = DIFFICULTY_META[diff];
                  const active = perceivedDifficulty === diff;
                  return (
                    <button
                      key={diff}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPerceivedDifficulty(diff)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        active
                          ? cn(meta.className, "ring-1 ring-current/40")
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      )}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Solved Switch & Review Rules */}
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span
                    id="solved-switch-label"
                    className="block text-sm font-semibold text-zinc-100"
                  >
                    Conseguiu fazer?
                  </span>
                  <p className="text-xs text-zinc-400">
                    {solved
                      ? "Questão marcada como resolvida."
                      : "Questão marcada como não resolvida."}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={solved}
                  aria-labelledby="solved-switch-label"
                  onClick={() => setSolved((prev) => !prev)}
                  className={cn(
                    "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    solved
                      ? "border-emerald-500/60 bg-emerald-500/25"
                      : "border-amber-500/60 bg-amber-500/20"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full shadow transition-transform",
                      solved
                        ? "translate-x-6 bg-emerald-400"
                        : "translate-x-0 bg-amber-400"
                    )}
                  />
                </button>
              </div>

              {!solved ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                    aria-hidden="true"
                  />
                  <span>
                    Questões não resolvidas vão automaticamente para a Lista de
                    Revisão.
                  </span>
                </div>
              ) : (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3 py-2.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={needsReview}
                    onChange={(e) => setNeedsReview(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  <span className="flex items-center gap-1.5 leading-relaxed">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                      aria-hidden="true"
                    />
                    Também adicionar à lista de revisão para praticar novamente
                    depois
                  </span>
                </label>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label
                htmlFor="problem-notes"
                className="block text-sm font-medium text-zinc-200"
              >
                Observações
              </label>
              <textarea
                id="problem-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ideia da solução, complexidade, onde travou ou dicas para revisão..."
                className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 bg-zinc-900/95 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>
                  {isEditing ? "Salvar alterações" : "Registrar questão"}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
