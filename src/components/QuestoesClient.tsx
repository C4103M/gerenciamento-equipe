"use client";

import type { Difficulty, Platform } from "@prisma/client";
import {
  CheckCircle2,
  Code2,
  ExternalLink,
  Filter,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  deleteProblemLogAction,
  toggleNeedsReviewAction,
} from "@/actions/problems";
import {
  DifficultyBadge,
  MemberAvatar,
  PlatformBadge,
  TopicBadge,
} from "@/components/Badges";
import { CodeforcesSyncModal } from "@/components/CodeforcesSyncModal";
import { PeriodFilterButton } from "@/components/PeriodFilterButton";
import { ProblemFormModal } from "@/components/ProblemFormModal";
import { isDateInPeriod, type PeriodFilterValue } from "@/lib/period";
import { DIFFICULTY_META, PLATFORM_META } from "@/lib/platform";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { MemberSummary, ProblemLogItem, TopicItem } from "@/types";

export interface QuestoesClientProps {
  currentUserId: string;
  initialProblems: ProblemLogItem[];
  topics: TopicItem[];
  members: MemberSummary[];
}

type StatusFilter = "ALL" | "SOLVED" | "REVIEW";

const PLATFORMS: Platform[] = [
  "CODEFORCES",
  "LEETCODE",
  "ATCODER",
  "BEECROWD",
  "CSES",
  "OUTRO",
];

const DIFFICULTIES: Difficulty[] = [
  "FACIL",
  "MEDIO",
  "DIFICIL",
  "MUITO_DIFICIL",
];

const SELECT_CLASS =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

/** Client-side searchable, filterable list and management view for team problem logs. */
export function QuestoesClient({
  currentUserId,
  initialProblems,
  topics,
  members,
}: QuestoesClientProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState<string>("ALL");
  const [topicId, setTopicId] = useState<string>("ALL");
  const [platform, setPlatform] = useState<"ALL" | Platform>("ALL");
  const [difficulty, setDifficulty] = useState<"ALL" | Difficulty>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>({
    preset: "all",
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<ProblemLogItem | null>(
    null
  );

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasActiveFilters =
    search.trim().length > 0 ||
    memberId !== "ALL" ||
    topicId !== "ALL" ||
    platform !== "ALL" ||
    difficulty !== "ALL" ||
    status !== "ALL" ||
    periodFilter.preset !== "all";

  const filteredProblems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return initialProblems.filter((problem) => {
      if (query) {
        const matchesTitle = problem.title.toLowerCase().includes(query);
        const matchesNotes =
          problem.notes?.toLowerCase().includes(query) ?? false;
        if (!matchesTitle && !matchesNotes) return false;
      }

      if (memberId !== "ALL" && problem.userId !== memberId) return false;
      if (
        topicId !== "ALL" &&
        !problem.topics.some((topic) => topic.id === topicId)
      ) {
        return false;
      }
      if (platform !== "ALL" && problem.platform !== platform) return false;
      if (difficulty !== "ALL" && problem.perceivedDifficulty !== difficulty) {
        return false;
      }
      if (status === "SOLVED" && !problem.solved) return false;
      if (status === "REVIEW" && !problem.needsReview) return false;
      if (
        !isDateInPeriod(problem.reviewedAt ?? problem.createdAt, periodFilter)
      ) {
        return false;
      }

      return true;
    });
  }, [
    initialProblems,
    search,
    memberId,
    topicId,
    platform,
    difficulty,
    status,
    periodFilter,
  ]);

  function clearFilters() {
    setSearch("");
    setMemberId("ALL");
    setTopicId("ALL");
    setPlatform("ALL");
    setDifficulty("ALL");
    setStatus("ALL");
    setPeriodFilter({ preset: "all" });
  }

  function openCreateModal() {
    setEditingProblem(null);
    setModalOpen(true);
  }

  function openEditModal(problem: ProblemLogItem) {
    setEditingProblem(problem);
    setModalOpen(true);
  }

  async function handleToggleReview(problem: ProblemLogItem) {
    if (!problem.solved || pendingActionId) return;
    setActionError(null);
    setPendingActionId(problem.id);
    try {
      const result = await toggleNeedsReviewAction(
        problem.id,
        !problem.needsReview
      );
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setActionError("Não foi possível atualizar o status de revisão.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleDelete(id: string) {
    if (pendingActionId) return;
    setActionError(null);
    setPendingActionId(id);
    try {
      const result = await deleteProblemLogAction(id);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setConfirmDeleteId(null);
      router.refresh();
    } catch {
      setActionError("Não foi possível excluir a questão.");
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Questões da Equipe
          </h1>
          <p className="text-sm text-zinc-400">
            Histórico completo de problemas praticados, observações e itens em
            revisão.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSyncModalOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3.5 py-2.5 text-sm font-medium text-sky-200 transition hover:bg-sky-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Sincronizar Codeforces</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>+ Registrar Questão</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <section
        aria-label="Filtros de questões"
        className="space-y-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou observação..."
              aria-label="Buscar por título ou observação"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pr-3.5 pl-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Limpar filtros</span>
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label htmlFor="filter-member" className="sr-only">
              Filtrar por membro
            </label>
            <select
              id="filter-member"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="ALL">Membro: Todos</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-topic" className="sr-only">
              Filtrar por tópico
            </label>
            <select
              id="filter-topic"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="ALL">Tópico: Todos</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-platform" className="sr-only">
              Filtrar por plataforma
            </label>
            <select
              id="filter-platform"
              value={platform}
              onChange={(e) =>
                setPlatform(e.target.value as "ALL" | Platform)
              }
              className={SELECT_CLASS}
            >
              <option value="ALL">Plataforma: Todas</option>
              {PLATFORMS.map((item) => (
                <option key={item} value={item}>
                  {PLATFORM_META[item].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-difficulty" className="sr-only">
              Filtrar por dificuldade
            </label>
            <select
              id="filter-difficulty"
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as "ALL" | Difficulty)
              }
              className={SELECT_CLASS}
            >
              <option value="ALL">Dificuldade: Todas</option>
              {DIFFICULTIES.map((item) => (
                <option key={item} value={item}>
                  {DIFFICULTY_META[item].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-status" className="sr-only">
              Filtrar por status
            </label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className={SELECT_CLASS}
            >
              <option value="ALL">Status: Todos</option>
              <option value="SOLVED">Resolvidas</option>
              <option value="REVIEW">Em Revisão</option>
            </select>
          </div>

          <PeriodFilterButton
            value={periodFilter}
            onChange={setPeriodFilter}
            variant="filter"
            align="right"
          />
        </div>
      </section>

      {/* Action Error Alert */}
      {actionError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Dispensar erro"
            className="rounded p-1 text-rose-300/80 hover:bg-rose-500/20 hover:text-rose-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Count Header */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
          <span>
            Exibindo{" "}
            <strong className="font-semibold text-zinc-200">
              {filteredProblems.length}
            </strong>{" "}
            de{" "}
            <strong className="font-semibold text-zinc-200">
              {initialProblems.length}
            </strong>{" "}
            {initialProblems.length === 1 ? "questão" : "questões"}
          </span>
        </div>
      </div>

      {/* Problem List */}
      {filteredProblems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400">
            <Code2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-zinc-200">
            {initialProblems.length === 0
              ? "Nenhuma questão registrada ainda"
              : "Nenhuma questão encontrada"}
          </h2>
          <p className="mt-1 max-w-md text-sm text-zinc-400">
            {initialProblems.length === 0
              ? "Comece registrando a primeira questão praticada pela equipe."
              : "Tente ajustar os termos de busca ou limpar os filtros ativos."}
          </p>
          <div className="mt-5">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span>Limpar filtros</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>+ Registrar Questão</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredProblems.map((problem) => {
            const isOwner = problem.userId === currentUserId;
            const isBusy = pendingActionId === problem.id;
            const isConfirmingDelete = confirmDeleteId === problem.id;

            return (
              <li
                key={problem.id}
                className="rounded-xl border border-zinc-800/90 bg-zinc-900/65 p-4 transition hover:border-zinc-700/90"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  {/* Main Content */}
                  <div className="min-w-0 flex-1 space-y-2.5">
                    {/* Title & Badges Row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={problem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex min-w-0 items-center gap-1.5 text-base font-semibold text-zinc-100 transition hover:text-indigo-400"
                      >
                        <span className="truncate">{problem.title}</span>
                        <ExternalLink
                          className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition group-hover:text-indigo-400"
                          aria-hidden="true"
                        />
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <PlatformBadge platform={problem.platform} />
                      {problem.externalRating ? (
                        <span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-xs font-medium text-sky-300">
                          CF {problem.externalRating}
                        </span>
                      ) : null}
                      <DifficultyBadge difficulty={problem.perceivedDifficulty} />

                      {problem.solved ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          <CheckCircle2
                            className="h-3 w-3 shrink-0"
                            aria-hidden="true"
                          />
                          Resolvida
                        </span>
                      ) : null}

                      {problem.needsReview ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                          <RotateCcw
                            className="h-3 w-3 shrink-0"
                            aria-hidden="true"
                          />
                          Na Lista de Revisão
                        </span>
                      ) : null}

                      {problem.topics.map((topic) => (
                        <TopicBadge key={topic.id} topic={topic} />
                      ))}
                    </div>

                    {/* Notes Box */}
                    {problem.notes ? (
                      <div className="flex items-start gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/70 px-3 py-2 text-xs leading-relaxed text-zinc-300">
                        <MessageSquareText
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500"
                          aria-hidden="true"
                        />
                        <p className="whitespace-pre-wrap break-words">
                          {problem.notes}
                        </p>
                      </div>
                    ) : null}

                    {/* Author & Metadata */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                      <span className="inline-flex items-center gap-2 font-medium text-zinc-300">
                        <MemberAvatar member={problem.user} size="sm" />
                        <span>{problem.user.name}</span>
                      </span>
                      <span className="text-zinc-600" aria-hidden="true">
                        •
                      </span>
                      <span>{formatRelativeDate(problem.createdAt)}</span>
                      <span className="text-zinc-600" aria-hidden="true">
                        •
                      </span>
                      <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                        {problem.attemptCount}{" "}
                        {problem.attemptCount === 1
                          ? "tentativa"
                          : "tentativas"}
                      </span>
                    </div>
                  </div>

                  {/* Owner Actions */}
                  {isOwner ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-zinc-800/70 pt-2.5 lg:border-t-0 lg:pt-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleReview(problem)}
                        disabled={!problem.solved || isBusy}
                        title={
                          problem.solved
                            ? problem.needsReview
                              ? "Remover da lista de revisão"
                              : "Adicionar à lista de revisão"
                            : "Questões não resolvidas permanecem na lista de revisão até serem resolvidas."
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                          !problem.solved
                            ? "cursor-not-allowed border-zinc-800 bg-zinc-950/50 text-zinc-500 opacity-60"
                            : problem.needsReview
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                              : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
                        )}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {problem.needsReview ? "Em Revisão" : "Revisar"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(problem)}
                        disabled={isBusy}
                        aria-label={`Editar ${problem.title}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Editar</span>
                      </button>

                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 p-1">
                          <button
                            type="button"
                            onClick={() => void handleDelete(problem.id)}
                            disabled={isBusy}
                            className="rounded px-2 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-50"
                          >
                            {isBusy ? "Excluindo..." : "Confirmar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isBusy}
                            className="rounded px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(problem.id)}
                          disabled={isBusy}
                          aria-label={`Excluir ${problem.title}`}
                          className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-400 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ProblemFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProblem(null);
        }}
        topics={topics}
        initialProblem={editingProblem}
      />

      <CodeforcesSyncModal
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        currentUserId={currentUserId}
        members={members}
        topics={topics}
      />
    </div>
  );
}
