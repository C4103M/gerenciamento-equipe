"use client";

import type { Difficulty } from "@prisma/client";
import {
  AlertTriangle,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
  Filter,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { resolveReviewProblemAction } from "@/actions/problems";
import {
  DifficultyBadge,
  MemberAvatar,
  PlatformBadge,
  TopicBadge,
} from "@/components/Badges";
import { DIFFICULTY_META } from "@/lib/platform";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { ProblemLogItem, TopicItem } from "@/types";

export interface ReviewProblemItem extends ProblemLogItem {
  fromProposalProposerName?: string | null;
}

export interface RevisaoClientProps {
  currentUserId: string;
  problems: ReviewProblemItem[];
  topics: TopicItem[];
}

type ReviewScope = "mine" | "team";

const DIFFICULTY_OPTIONS: Difficulty[] = [
  "FACIL",
  "MEDIO",
  "DIFICIL",
  "MUITO_DIFICIL",
];

/** Client interface for the shared team review list and individual review resolution. */
export function RevisaoClient({
  currentUserId,
  problems,
  topics,
}: RevisaoClientProps) {
  const router = useRouter();

  const [scope, setScope] = useState<ReviewScope>("mine");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvingProblem, setResolvingProblem] =
    useState<ReviewProblemItem | null>(null);

  const myCount = useMemo(
    () => problems.filter((p) => p.userId === currentUserId).length,
    [problems, currentUserId]
  );

  const filteredProblems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return problems.filter((problem) => {
      if (scope === "mine" && problem.userId !== currentUserId) {
        return false;
      }
      if (
        selectedTopicId !== "all" &&
        !problem.topics.some((t) => t.id === selectedTopicId)
      ) {
        return false;
      }
      if (query) {
        const haystack = [
          problem.title,
          problem.url,
          problem.notes ?? "",
          problem.user.name,
          problem.fromProposalProposerName ?? "",
          ...problem.topics.map((t) => t.name),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [problems, scope, currentUserId, selectedTopicId, searchQuery]);

  const hasActiveFilters =
    selectedTopicId !== "all" || searchQuery.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-300">
              <RotateCcw className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Lista de Revisão
            </h1>
          </div>
          <p className="text-sm text-zinc-400">
            Questões que travaram na primeira tentativa ou foram marcadas para
            praticar novamente. Visível para toda a equipe acompanhar onde cada
            membro está reforçando a base.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 sm:self-auto">
          <span className="font-mono font-semibold text-amber-300">
            {myCount}
          </span>
          <span>na sua lista</span>
          <span className="text-zinc-600">·</span>
          <span className="font-mono font-semibold text-zinc-100">
            {problems.length}
          </span>
          <span>na equipe</span>
        </div>
      </div>

      {/* Scope Tabs + Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Scope tabs */}
          <div
            className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-1"
            role="tablist"
            aria-label="Escopo da lista de revisão"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === "mine"}
              onClick={() => setScope("mine")}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors",
                scope === "mine"
                  ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span>Minha Lista</span>
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
                {myCount}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === "team"}
              onClick={() => setScope("team")}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors",
                scope === "team"
                  ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Toda a Equipe</span>
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
                {problems.length}
              </span>
            </button>
          </div>

          {/* Search & Topic Filter */}
          <div className="flex flex-1 flex-col gap-2.5 sm:flex-row lg:max-w-xl">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, anotação ou membro..."
                aria-label="Buscar questões para revisão"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pr-3 pl-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            <div className="relative sm:w-52">
              <Filter
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                aria-label="Filtrar por tópico"
                className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-950 py-2 pr-8 pl-9 text-sm text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              >
                <option value="all">Todos os tópicos</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedTopicId("all");
                  setSearchQuery("");
                }}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
                Limpar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Review Cards */}
      {filteredProblems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            {hasActiveFilters
              ? "Nenhuma questão encontrada com esses filtros"
              : scope === "mine"
                ? "Sua lista de revisão está em dia!"
                : "Nenhuma questão pendente de revisão na equipe"}
          </h2>
          <p className="mt-1 max-w-md text-sm text-zinc-400">
            {hasActiveFilters
              ? "Tente limpar a busca ou selecionar outro tópico."
              : scope === "mine"
                ? "Questões não resolvidas ou marcadas para revisar aparecerão aqui automaticamente."
                : "Quando algum membro marcar uma questão para revisar ou tentar uma proposta sem resolver, ela aparecerá aqui."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProblems.map((item) => {
            const isOwner = item.userId === currentUserId;
            const originBadge = item.fromProposalProposerName
              ? {
                  label: `Veio de proposta de ${item.fromProposalProposerName}`,
                  className:
                    "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
                  icon: Send,
                }
              : !item.solved
                ? {
                    label: "Não resolvida na 1ª tentativa",
                    className:
                      "border-amber-500/30 bg-amber-500/10 text-amber-300",
                    icon: AlertTriangle,
                  }
                : {
                    label: "Marcada p/ revisão",
                    className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
                    icon: BookmarkCheck,
                  };
            const OriginIcon = originBadge.icon;

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 transition-colors hover:border-zinc-700/90"
              >
                <div className="space-y-3">
                  {/* Top metadata row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlatformBadge platform={item.platform} />
                      <DifficultyBadge difficulty={item.perceivedDifficulty} />
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
                          originBadge.className
                        )}
                      >
                        <OriginIcon className="h-3 w-3" aria-hidden="true" />
                        <span>{originBadge.label}</span>
                      </span>
                      <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-xs text-zinc-400">
                        {item.attemptCount}{" "}
                        {item.attemptCount === 1 ? "tentativa" : "tentativas"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <MemberAvatar member={item.user} size="sm" />
                      <span className="font-medium text-zinc-200">
                        {item.user.name}
                      </span>
                      {isOwner ? (
                        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                          Você
                        </span>
                      ) : null}
                      <span className="text-zinc-600">·</span>
                      <span>{formatRelativeDate(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Title + Link */}
                  <div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-base font-semibold text-zinc-100 transition-colors hover:text-indigo-300"
                    >
                      <span>{item.title}</span>
                      <ExternalLink
                        className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-indigo-400"
                        aria-hidden="true"
                      />
                    </a>
                  </div>

                  {/* Topics */}
                  {item.topics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.topics.map((topic) => (
                        <TopicBadge key={topic.id} topic={topic} />
                      ))}
                    </div>
                  ) : null}

                  {/* Previous notes */}
                  {item.notes ? (
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-300">
                      <span className="mr-1.5 font-semibold text-zinc-400">
                        Anotações anteriores:
                      </span>
                      <span className="whitespace-pre-wrap">{item.notes}</span>
                    </div>
                  ) : null}
                </div>

                {/* Action footer */}
                {isOwner ? (
                  <div className="flex items-center justify-end border-t border-zinc-800/70 pt-3">
                    <button
                      type="button"
                      onClick={() => setResolvingProblem(item)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>Concluir Revisão (Consegui Fazer!)</span>
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {/* Resolve Review Modal */}
      {resolvingProblem ? (
        <ResolveReviewModal
          problem={resolvingProblem}
          onClose={() => setResolvingProblem(null)}
          onResolved={() => {
            setResolvingProblem(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ResolveReviewModal({
  problem,
  onClose,
  onResolved,
}: {
  problem: ReviewProblemItem;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<Difficulty>(
    problem.perceivedDifficulty
  );
  const [attemptCount, setAttemptCount] = useState<number>(
    Math.max(1, problem.attemptCount + 1)
  );
  const [notes, setNotes] = useState(problem.notes ?? "");
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await resolveReviewProblemAction(problem.id, {
        perceivedDifficulty,
        notes,
        attemptCount: Math.max(1, Math.floor(attemptCount || 1)),
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      onResolved();
    } catch {
      setError("Não foi possível concluir a revisão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-review-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="min-w-0 pr-3">
            <h2
              id="resolve-review-title"
              className="text-base font-semibold text-zinc-100"
            >
              Concluir Revisão
            </h2>
            <p className="truncate text-xs text-zinc-400">{problem.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar modal"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 p-6">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <span className="block text-sm font-medium text-zinc-200">
              Dificuldade final percebida
            </span>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="radiogroup"
              aria-label="Dificuldade final percebida"
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

          <div className="space-y-1.5">
            <label
              htmlFor="review-attempt-count"
              className="block text-sm font-medium text-zinc-200"
            >
              Número de tentativas
            </label>
            <div className="flex w-40 items-center rounded-lg border border-zinc-800 bg-zinc-950 p-1">
              <button
                type="button"
                onClick={() => setAttemptCount((prev) => Math.max(1, prev - 1))}
                disabled={attemptCount <= 1 || isSubmitting}
                aria-label="Diminuir número de tentativas"
                className="inline-flex h-7 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                id="review-attempt-count"
                type="number"
                min={1}
                max={999}
                value={attemptCount}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  setAttemptCount(Number.isFinite(val) && val >= 1 ? val : 1);
                }}
                className="w-full bg-transparent text-center font-mono text-sm font-semibold text-zinc-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setAttemptCount((prev) => Math.min(999, prev + 1))
                }
                disabled={isSubmitting}
                aria-label="Aumentar número de tentativas"
                className="inline-flex h-7 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="review-lesson-notes"
              className="block text-sm font-medium text-zinc-200"
            >
              O que você aprendeu / observações finais
            </label>
            <textarea
              id="review-lesson-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Registre o insight principal, erro que evitou ou complexidade final..."
              className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Concluindo...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirmar Resolução</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
