"use client";

import type { Difficulty, Platform } from "@prisma/client";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
import { LeetCodeSyncModal } from "@/components/LeetCodeSyncModal";
import { PeriodFilterButton } from "@/components/PeriodFilterButton";
import { ProblemFormModal } from "@/components/ProblemFormModal";
import { SolutionLinks } from "@/components/SolutionViewerModal";
import type { PeriodFilterValue } from "@/lib/period";
import { DIFFICULTY_META, PLATFORM_META } from "@/lib/platform";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { MemberSummary, ProblemLogItem, TopicItem } from "@/types";

export type QuestoesStatusFilter = "ALL" | "SOLVED" | "REVIEW";

export interface QuestoesFilterState {
  q: string;
  member: string;
  topic: string;
  platform: "ALL" | Platform;
  difficulty: "ALL" | Difficulty;
  status: QuestoesStatusFilter;
  period: PeriodFilterValue;
}

export interface QuestoesClientProps {
  currentUserId: string;
  initialProblems: ProblemLogItem[];
  filteredCount: number;
  totalTeamCount: number;
  currentPage: number;
  pageSize: number;
  topics: TopicItem[];
  members: MemberSummary[];
  initialFilters: QuestoesFilterState;
}

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

function buildQuestoesUrl(
  filters: QuestoesFilterState,
  page: number
): string {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.member !== "ALL") sp.set("member", filters.member);
  if (filters.topic !== "ALL") sp.set("topic", filters.topic);
  if (filters.platform !== "ALL") sp.set("platform", filters.platform);
  if (filters.difficulty !== "ALL") sp.set("difficulty", filters.difficulty);
  if (filters.status !== "ALL") sp.set("status", filters.status);
  if (filters.period.preset !== "all") {
    sp.set("periodo", filters.period.preset);
    if (filters.period.preset === "custom") {
      if (filters.period.from) sp.set("from", filters.period.from);
      if (filters.period.to) sp.set("to", filters.period.to);
    }
  }
  if (page > 1) sp.set("page", String(page));

  const query = sp.toString();
  return query ? `/questoes?${query}` : "/questoes";
}

/** Server-paginated, filterable list and management view for team problem logs. */
export function QuestoesClient({
  currentUserId,
  initialProblems,
  filteredCount,
  totalTeamCount,
  currentPage,
  pageSize,
  topics,
  members,
  initialFilters,
}: QuestoesClientProps) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();

  const [prevInitialQ, setPrevInitialQ] = useState(initialFilters.q);
  const [search, setSearch] = useState(initialFilters.q);
  if (initialFilters.q !== prevInitialQ) {
    setPrevInitialQ(initialFilters.q);
    if (search === prevInitialQ) {
      setSearch(initialFilters.q);
    }
  }

  const debounceTimerRef = useRef<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [lcSyncModalOpen, setLcSyncModalOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<ProblemLogItem | null>(
    null
  );

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const hasActiveFilters =
    initialFilters.q.length > 0 ||
    initialFilters.member !== "ALL" ||
    initialFilters.topic !== "ALL" ||
    initialFilters.platform !== "ALL" ||
    initialFilters.difficulty !== "ALL" ||
    initialFilters.status !== "ALL" ||
    initialFilters.period.preset !== "all";

  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const rangeStart = filteredCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(filteredCount, currentPage * pageSize);

  function applyFilterPatch(patch: Partial<QuestoesFilterState>) {
    const nextFilters: QuestoesFilterState = {
      ...initialFilters,
      ...patch,
    };
    const url = buildQuestoesUrl(nextFilters, 1);
    startTransition(() => {
      router.replace(url, { scroll: false });
    });
  }

  function handleSearchChange(nextValue: string) {
    setSearch(nextValue);
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      applyFilterPatch({ q: nextValue.trim() });
    }, 300);
  }

  function clearFilters() {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSearch("");
    startTransition(() => {
      router.replace("/questoes", { scroll: false });
    });
  }

  function goToPage(nextPage: number) {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    if (clamped === currentPage) return;
    const url = buildQuestoesUrl(initialFilters, clamped);
    startTransition(() => {
      router.push(url, { scroll: true });
    });
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
            onClick={() => setLcSyncModalOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3.5 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-amber-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Sincronizar LeetCode</span>
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
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por título ou observação..."
              aria-label="Buscar por título ou observação"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pr-3.5 pl-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>

          {hasActiveFilters || search.trim().length > 0 ? (
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
              value={initialFilters.member}
              onChange={(e) => applyFilterPatch({ member: e.target.value })}
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
              value={initialFilters.topic}
              onChange={(e) => applyFilterPatch({ topic: e.target.value })}
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
              value={initialFilters.platform}
              onChange={(e) =>
                applyFilterPatch({
                  platform: e.target.value as "ALL" | Platform,
                })
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
              value={initialFilters.difficulty}
              onChange={(e) =>
                applyFilterPatch({
                  difficulty: e.target.value as "ALL" | Difficulty,
                })
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
              value={initialFilters.status}
              onChange={(e) =>
                applyFilterPatch({
                  status: e.target.value as QuestoesStatusFilter,
                })
              }
              className={SELECT_CLASS}
            >
              <option value="ALL">Status: Todos</option>
              <option value="SOLVED">Resolvidas</option>
              <option value="REVIEW">Em Revisão</option>
            </select>
          </div>

          <PeriodFilterButton
            value={initialFilters.period}
            onChange={(nextPeriod) => applyFilterPatch({ period: nextPeriod })}
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
          <span>
            {filteredCount === 0 ? (
              <>
                Exibindo <strong className="font-semibold text-zinc-200">0</strong>{" "}
                questões
              </>
            ) : (
              <>
                Exibindo{" "}
                <strong className="font-semibold text-zinc-200">
                  {rangeStart}–{rangeEnd}
                </strong>{" "}
                de{" "}
                <strong className="font-semibold text-zinc-200">
                  {filteredCount}
                </strong>{" "}
                {filteredCount === 1 ? "questão" : "questões"}
              </>
            )}
            {hasActiveFilters && totalTeamCount !== filteredCount ? (
              <span className="text-zinc-500">
                {" "}
                (de {totalTeamCount} no total)
              </span>
            ) : null}
          </span>
        </div>

        {isNavigating ? (
          <span className="inline-flex items-center gap-1.5 text-indigo-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>Atualizando...</span>
          </span>
        ) : null}
      </div>

      {/* Problem List */}
      {initialProblems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400">
            <Code2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-zinc-200">
            {totalTeamCount === 0
              ? "Nenhuma questão registrada ainda"
              : "Nenhuma questão encontrada"}
          </h2>
          <p className="mt-1 max-w-md text-sm text-zinc-400">
            {totalTeamCount === 0
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
        <>
          <ul
            className={cn(
              "space-y-3 transition-opacity",
              isNavigating && "opacity-60"
            )}
          >
            {initialProblems.map((problem) => {
              const isOwner = problem.userId === currentUserId;
              const isBusy = pendingActionId === problem.id;
              const isConfirmingDelete = confirmDeleteId === problem.id;

              return (
                <li
                  key={problem.id}
                  className="group relative rounded-xl border border-zinc-800/90 bg-zinc-900/65 p-4 transition hover:border-indigo-500/50 hover:bg-zinc-900/90"
                >
                  <Link
                    href={`/questoes/${problem.id}`}
                    aria-label={`Abrir overview de ${problem.title}`}
                    className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  />

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    {/* Main Content */}
                    <div className="min-w-0 flex-1 space-y-2.5">
                      {/* Title & Badges Row */}
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 truncate text-base font-semibold text-zinc-100 transition group-hover:text-indigo-300">
                          {problem.title}
                        </span>
                        <a
                          href={problem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir enunciado na plataforma"
                          aria-label={`Abrir enunciado de ${problem.title}`}
                          className="relative z-20 inline-flex shrink-0 items-center rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-indigo-400"
                        >
                          <ExternalLink
                            className="h-3.5 w-3.5"
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
                        <DifficultyBadge
                          difficulty={problem.perceivedDifficulty}
                        />

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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-400">
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

                        {problem.solved &&
                        (problem.solutionUrl || problem.hasSolutionCode) ? (
                          <div className="relative z-20 inline-flex items-center">
                            <SolutionLinks
                              problemLogId={problem.id}
                              title={problem.title}
                              problemUrl={problem.url}
                              platform={problem.platform}
                              author={problem.user}
                              solutionUrl={problem.solutionUrl}
                              hasSolutionCode={problem.hasSolutionCode}
                            />
                          </div>
                        ) : problem.solved && isOwner ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(problem)}
                            className="relative z-20 inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-700 bg-zinc-950/60 px-2 py-0.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-200"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                            <span>Adicionar resolução</span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Owner Actions */}
                    {isOwner ? (
                      <div className="relative z-20 flex shrink-0 flex-wrap items-center gap-1.5 border-t border-zinc-800/70 pt-2.5 lg:border-t-0 lg:pt-0">
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

          {/* Pagination Controls */}
          {totalPages > 1 ? (
            <nav
              aria-label="Paginação de questões"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3 text-xs text-zinc-300"
            >
              <span className="text-zinc-400">
                Página{" "}
                <strong className="font-mono font-semibold text-zinc-100">
                  {currentPage}
                </strong>{" "}
                de{" "}
                <strong className="font-mono font-semibold text-zinc-100">
                  {totalPages}
                </strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1 || isNavigating}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Anterior</span>
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages || isNavigating}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span>Próxima</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </nav>
          ) : null}
        </>
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

      <LeetCodeSyncModal
        open={lcSyncModalOpen}
        onClose={() => setLcSyncModalOpen(false)}
        currentUserId={currentUserId}
        members={members}
        topics={topics}
      />
    </div>
  );
}
