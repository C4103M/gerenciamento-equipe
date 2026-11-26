"use client";

import type { Difficulty, ProposalStatus } from "@prisma/client";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Eye,
  Loader2,
  MessageSquareQuote,
  Minus,
  Plus,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  deleteProposalAction,
  markProposalViewedAction,
  updateProposalStatusAction,
} from "@/actions/proposals";
import {
  DifficultyBadge,
  MemberAvatar,
  PlatformBadge,
  ProposalStatusBadge,
  TopicBadge,
} from "@/components/Badges";
import { ProposeProblemModal } from "@/components/ProposeProblemModal";
import { SolutionFieldsInput } from "@/components/SolutionFieldsInput";
import { SolutionLinks } from "@/components/SolutionViewerModal";
import { parseCodeforcesRef } from "@/lib/codeforces";
import { DIFFICULTY_META, PROPOSAL_STATUS_META } from "@/lib/platform";
import { cn, formatRelativeDate } from "@/lib/utils";
import type {
  MemberSummary,
  ProposedProblemItem,
  SolutionAttachMode,
  TopicItem,
} from "@/types";

export interface PropostosClientProps {
  currentUserId: string;
  currentUser: MemberSummary;
  proposals: ProposedProblemItem[];
  members: MemberSummary[];
  teammates: MemberSummary[];
  topics: TopicItem[];
  initialTab?: string;
  initialMemberId?: string;
  highlightId?: string;
}

type ProposalsTab = "recebidos" | "salvos" | "enviados" | "todos";
type StatusFilter = "ALL" | ProposalStatus;

const VALID_TABS: ProposalsTab[] = ["recebidos", "salvos", "enviados", "todos"];

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "PENDENTE", label: PROPOSAL_STATUS_META.PENDENTE.label },
  { value: "VISUALIZADO", label: PROPOSAL_STATUS_META.VISUALIZADO.label },
  { value: "TENTOU", label: PROPOSAL_STATUS_META.TENTOU.label },
  { value: "FEITO", label: PROPOSAL_STATUS_META.FEITO.label },
  { value: "DESCARTADO", label: PROPOSAL_STATUS_META.DESCARTADO.label },
];

const DIFFICULTY_OPTIONS: Difficulty[] = [
  "FACIL",
  "MEDIO",
  "DIFICIL",
  "MUITO_DIFICIL",
];

function resolveInitialTab(initialTab?: string): ProposalsTab {
  if (initialTab && VALID_TABS.includes(initialTab as ProposalsTab)) {
    return initialTab as ProposalsTab;
  }
  return "recebidos";
}

interface StatusModalState {
  proposal: ProposedProblemItem;
  targetStatus: "TENTOU" | "FEITO";
}

/** Client interface for viewing, proposing, and responding to team problem proposals. */
export function PropostosClient({
  currentUserId,
  currentUser,
  proposals,
  members,
  teammates,
  topics,
  initialTab,
  initialMemberId = "ALL",
  highlightId,
}: PropostosClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ProposalsTab>(() =>
    resolveInitialTab(initialTab)
  );
  const [memberFilter, setMemberFilter] = useState<string>(initialMemberId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [proposeModalMode, setProposeModalMode] = useState<
    "propose" | "self" | null
  >(null);
  const [statusModal, setStatusModal] = useState<StatusModalState | null>(null);
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`proposal-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId]);

  const recipientCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of proposals) {
      counts.set(p.assigneeId, (counts.get(p.assigneeId) ?? 0) + 1);
    }
    return counts;
  }, [proposals]);

  const tabCounts = useMemo(() => {
    let recebidos = 0;
    let salvos = 0;
    let enviados = 0;
    for (const p of proposals) {
      const isSelfSaved = p.proposerId === p.assigneeId;
      if (isSelfSaved) {
        if (p.assigneeId === currentUserId) salvos += 1;
      } else {
        if (p.assigneeId === currentUserId) recebidos += 1;
        if (p.proposerId === currentUserId) enviados += 1;
      }
    }
    return {
      recebidos,
      salvos,
      enviados,
      todos: proposals.length,
    };
  }, [proposals, currentUserId]);

  const tabProposals = useMemo(() => {
    return proposals.filter((p) => {
      const isSelfSaved = p.proposerId === p.assigneeId;
      if (activeTab === "recebidos") {
        return p.assigneeId === currentUserId && !isSelfSaved;
      }
      if (activeTab === "salvos") {
        return p.assigneeId === currentUserId && isSelfSaved;
      }
      if (activeTab === "enviados") {
        return p.proposerId === currentUserId && !isSelfSaved;
      }
      if (memberFilter !== "ALL") {
        return p.assigneeId === memberFilter;
      }
      return true;
    });
  }, [proposals, activeTab, currentUserId, memberFilter]);

  const filteredProposals = useMemo(() => {
    if (statusFilter === "ALL") return tabProposals;
    return tabProposals.filter((p) => p.status === statusFilter);
  }, [tabProposals, statusFilter]);

  async function handleMarkViewed(proposalId: string) {
    setActionError(null);
    setBusyProposalId(proposalId);
    try {
      const result = await markProposalViewedAction(proposalId);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setActionError("Não foi possível marcar a proposta como visualizada.");
    } finally {
      setBusyProposalId(null);
    }
  }

  function handleProblemLinkClick(proposal: ProposedProblemItem) {
    if (
      proposal.assigneeId === currentUserId &&
      proposal.proposerId !== proposal.assigneeId &&
      proposal.status === "PENDENTE"
    ) {
      void markProposalViewedAction(proposal.id).then(() => {
        router.refresh();
      });
    }
  }

  async function handleDiscard(proposalId: string) {
    setActionError(null);
    setBusyProposalId(proposalId);
    try {
      const result = await updateProposalStatusAction(proposalId, {
        status: "DESCARTADO",
      });
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setActionError("Não foi possível descartar a proposta.");
    } finally {
      setBusyProposalId(null);
    }
  }

  async function handleDelete(proposalId: string) {
    setActionError(null);
    setBusyProposalId(proposalId);
    try {
      const result = await deleteProposalAction(proposalId);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setActionError("Não foi possível remover a proposta.");
    } finally {
      setBusyProposalId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
              <Send className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Problemas Propostos
            </h1>
          </div>
          <p className="text-sm text-zinc-400">
            Envie desafios estratégicos para seus colegas de equipe e acompanhe
            quem já visualizou, tentou ou resolveu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setProposeModalMode("self")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Bookmark className="h-4 w-4" aria-hidden="true" />
            <span>+ Salvar p/ Depois</span>
          </button>

          <button
            type="button"
            onClick={() => setProposeModalMode("propose")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>+ Propor Problema</span>
          </button>
        </div>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Fechar alerta"
            className="rounded p-1 text-rose-300/80 hover:bg-rose-500/20 hover:text-rose-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Tabs & Status Filter Pills */}
      <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
        <div
          className="flex flex-wrap gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-1"
          role="tablist"
          aria-label="Visualização de problemas propostos"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "recebidos"}
            onClick={() => setActiveTab("recebidos")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors",
              activeTab === "recebidos"
                ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <span>Recebidos de Colegas</span>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
              {tabCounts.recebidos}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "salvos"}
            onClick={() => setActiveTab("salvos")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors",
              activeTab === "salvos"
                ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Para Fazer Depois</span>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
              {tabCounts.salvos}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "enviados"}
            onClick={() => setActiveTab("enviados")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors",
              activeTab === "enviados"
                ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <span>Propostos por Mim</span>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
              {tabCounts.enviados}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "todos"}
            onClick={() => setActiveTab("todos")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors",
              activeTab === "todos"
                ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <span>Todos da Equipe</span>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
              {tabCounts.todos}
            </span>
          </button>
        </div>

        {/* Recipient Filter Pills (Todos da Equipe tab) */}
        {activeTab === "todos" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">
              Destinatário:
            </span>
            <button
              type="button"
              onClick={() => setMemberFilter("ALL")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                memberFilter === "ALL"
                  ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              )}
            >
              <span>Todos</span>
              <span className="font-mono text-[11px] opacity-75">
                {proposals.length}
              </span>
            </button>
            {members.map((member) => {
              const active = memberFilter === member.id;
              const count = recipientCounts.get(member.id) ?? 0;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() =>
                    setMemberFilter((prev) =>
                      prev === member.id ? "ALL" : member.id
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  )}
                >
                  <span>{member.name}</span>
                  <span className="font-mono text-[11px] opacity-75">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Status:</span>
          {STATUS_FILTER_OPTIONS.map((opt) => {
            const active = statusFilter === opt.value;
            const count =
              opt.value === "ALL"
                ? tabProposals.length
                : tabProposals.filter((p) => p.status === opt.value).length;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                    : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                )}
              >
                <span>{opt.label}</span>
                <span className="font-mono text-[11px] opacity-75">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Proposals List */}
      {filteredProposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
            {activeTab === "salvos" ? (
              <Bookmark className="h-5 w-5 text-amber-400" />
            ) : (
              <Send className="h-5 w-5 text-indigo-400" />
            )}
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            {activeTab === "salvos"
              ? "Nenhuma questão salva para depois"
              : "Nenhum problema proposto encontrado"}
          </h2>
          <p className="mt-1 max-w-md text-sm text-zinc-400">
            {statusFilter !== "ALL"
              ? "Não há itens com este status na aba selecionada."
              : activeTab === "salvos"
                ? 'Salve questões para praticar depois usando o botão "+ Salvar p/ Depois".'
                : activeTab === "recebidos"
                  ? "Quando alguém da equipe indicar uma questão para você, ela aparecerá aqui."
                  : "Use o botão acima para propor um problema para seus colegas."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProposals.map((proposal) => {
            const isAssignee = proposal.assigneeId === currentUserId;
            const isProposer = proposal.proposerId === currentUserId;
            const isSelfSaved = proposal.proposerId === proposal.assigneeId;
            const isBusy = busyProposalId === proposal.id;
            const isHighlighted = highlightId === proposal.id;
            const canRespond =
              isAssignee &&
              proposal.status !== "FEITO" &&
              proposal.status !== "DESCARTADO";

            return (
              <article
                key={proposal.id}
                id={`proposal-${proposal.id}`}
                className={cn(
                  "group relative flex flex-col gap-4 rounded-2xl border bg-zinc-900/60 p-5 transition-colors",
                  isHighlighted
                    ? "border-indigo-500/70 ring-2 ring-indigo-500/40"
                    : "border-zinc-800/90 hover:border-indigo-500/50 hover:bg-zinc-900/90"
                )}
              >
                <Link
                  href={`/questoes/${proposal.resultingLogId ?? proposal.id}`}
                  onClick={() => handleProblemLinkClick(proposal)}
                  aria-label={`Abrir overview de ${proposal.title}`}
                  className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                />
                {/* Top row: Proposer -> Assignee (or Self-Saved) + Delete */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {isSelfSaved ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                          <Bookmark className="h-3 w-3" aria-hidden="true" />
                          <span>Para fazer depois</span>
                        </span>
                        <div className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/80 py-1 pr-2.5 pl-1.5">
                          <MemberAvatar member={proposal.assignee} size="sm" />
                          <span className="font-medium text-zinc-200">
                            {proposal.assignee.name}
                          </span>
                          {isAssignee ? (
                            <span className="text-[10px] font-semibold text-indigo-400">
                              (você)
                            </span>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/80 py-1 pr-2.5 pl-1.5">
                          <MemberAvatar member={proposal.proposer} size="sm" />
                          <span className="font-medium text-zinc-200">
                            {proposal.proposer.name}
                          </span>
                          {isProposer ? (
                            <span className="text-[10px] font-semibold text-indigo-400">
                              (você)
                            </span>
                          ) : null}
                        </div>

                        <ArrowRight
                          className="h-3.5 w-3.5 text-zinc-500"
                          aria-hidden="true"
                        />

                        <div className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/80 py-1 pr-2.5 pl-1.5">
                          <MemberAvatar member={proposal.assignee} size="sm" />
                          <span className="font-medium text-zinc-200">
                            {proposal.assignee.name}
                          </span>
                          {isAssignee ? (
                            <span className="text-[10px] font-semibold text-indigo-400">
                              (você)
                            </span>
                          ) : null}
                        </div>
                      </>
                    )}

                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400">
                      {formatRelativeDate(proposal.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <ProposalStatusBadge status={proposal.status} />
                    {isProposer ? (
                      <button
                        type="button"
                        onClick={() => void handleDelete(proposal.id)}
                        disabled={isBusy}
                        title="Cancelar / remover proposta"
                        aria-label={`Remover proposta ${proposal.title}`}
                        className="relative z-20 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Title + Badges */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <PlatformBadge platform={proposal.platform} />
                    {proposal.suggestedDifficulty ? (
                      <DifficultyBadge
                        difficulty={proposal.suggestedDifficulty}
                      />
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 text-base font-semibold text-zinc-100 transition-colors group-hover:text-indigo-300">
                      {proposal.title}
                    </span>
                    <a
                      href={proposal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleProblemLinkClick(proposal)}
                      title="Abrir enunciado na plataforma"
                      aria-label={`Abrir enunciado de ${proposal.title}`}
                      className="relative z-20 inline-flex shrink-0 items-center rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-indigo-400"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>

                  {proposal.topics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {proposal.topics.map((topic) => (
                        <TopicBadge key={topic.id} topic={topic} />
                      ))}
                    </div>
                  ) : null}

                  {proposal.message ? (
                    <div className="flex items-start gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-300">
                      <MessageSquareQuote
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400"
                        aria-hidden="true"
                      />
                      <span className="whitespace-pre-wrap">
                        {proposal.message}
                      </span>
                    </div>
                  ) : null}

                  {proposal.status === "FEITO" &&
                  (proposal.solutionUrl ||
                    (proposal.hasSolutionCode && proposal.resultingLogId)) ? (
                    <div className="relative z-20 w-fit">
                      <SolutionLinks
                        problemLogId={proposal.resultingLogId}
                        title={proposal.title}
                        problemUrl={proposal.url}
                        platform={proposal.platform}
                        author={proposal.assignee}
                        solutionUrl={proposal.solutionUrl}
                        hasSolutionCode={proposal.hasSolutionCode}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Assignee Interactive Controls */}
                {isAssignee &&
                ((!isSelfSaved && proposal.status === "PENDENTE") ||
                  canRespond) ? (
                  <div className="relative z-20 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800/70 pt-3">
                    {!isSelfSaved && proposal.status === "PENDENTE" ? (
                      <button
                        type="button"
                        onClick={() => void handleMarkViewed(proposal.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/20 disabled:opacity-50"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        <span>Visualizado</span>
                      </button>
                    ) : null}

                    {canRespond ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleDiscard(proposal.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Descartar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({
                              proposal,
                              targetStatus: "TENTOU",
                            })
                          }
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Tentei e Errei (Vai p/ Revisão)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({
                              proposal,
                              targetStatus: "FEITO",
                            })
                          }
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Consegui Fazer!</span>
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {/* Propose / Save For Later Problem Modal */}
      <ProposeProblemModal
        open={proposeModalMode !== null}
        onClose={() => setProposeModalMode(null)}
        currentUser={currentUser}
        defaultSelfOnly={proposeModalMode === "self"}
        teammates={teammates}
        topics={topics}
      />

      {/* Proposal Outcome Modal (TENTOU / FEITO) */}
      {statusModal ? (
        <ProposalResponseModal
          proposal={statusModal.proposal}
          targetStatus={statusModal.targetStatus}
          onClose={() => setStatusModal(null)}
          onCompleted={() => {
            setStatusModal(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ProposalResponseModal({
  proposal,
  targetStatus,
  onClose,
  onCompleted,
}: {
  proposal: ProposedProblemItem;
  targetStatus: "TENTOU" | "FEITO";
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<Difficulty>(
    proposal.suggestedDifficulty ?? "MEDIO"
  );
  const [attemptCount, setAttemptCount] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const [solutionUrl, setSolutionUrl] = useState("");
  const [solutionCode, setSolutionCode] = useState("");
  const [solutionMode, setSolutionMode] = useState<SolutionAttachMode>(() =>
    parseCodeforcesRef(proposal.url) ? "link" : "code"
  );
  const [dismissedAutoLink, setDismissedAutoLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAttempted = targetStatus === "TENTOU";

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
      const result = await updateProposalStatusAction(proposal.id, {
        status: targetStatus,
        perceivedDifficulty,
        notes,
        attemptCount: Math.max(1, Math.floor(attemptCount || 1)),
        ...(!isAttempted
          ? {
              solutionMode,
              allowAutoSolutionLink: !dismissedAutoLink,
              solutionUrl:
                solutionMode === "link" ? solutionUrl || null : null,
              solutionCode: solutionMode === "code" ? solutionCode : null,
            }
          : {}),
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      onCompleted();
    } catch {
      setError("Não foi possível atualizar o status da proposta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-response-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="min-w-0 pr-3">
            <h2
              id="proposal-response-title"
              className="text-base font-semibold text-zinc-100"
            >
              {isAttempted
                ? "Registrar Tentativa (Ir para Revisão)"
                : "Concluir Questão Proposta"}
            </h2>
            <p className="truncate text-xs text-zinc-400">{proposal.title}</p>
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

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
              >
                {error}
              </div>
            ) : null}

            {isAttempted ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-200">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                  aria-hidden="true"
                />
                <span>
                  Ao confirmar, esta questão será salva automaticamente na sua
                  Lista de Revisão.
                </span>
              </div>
            ) : null}

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

            <div className="space-y-1.5">
              <label
                htmlFor="proposal-attempt-count"
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
                  id="proposal-attempt-count"
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
                htmlFor="proposal-response-notes"
                className="block text-sm font-medium text-zinc-200"
              >
                {isAttempted
                  ? "Onde travou ou o que precisa revisar?"
                  : "Anotações da solução"}
              </label>
              <textarea
                id="proposal-response-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  isAttempted
                    ? "Descreva em qual caso de teste travou, ideia inicial ou dúvida para discutir com a equipe..."
                    : "Resumo da abordagem, complexidade de tempo/espaço..."
                }
                className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            {!isAttempted ? (
              <SolutionFieldsInput
                mode={solutionMode}
                onModeChange={setSolutionMode}
                problemUrl={proposal.url}
                solutionUrl={solutionUrl}
                onSolutionUrlChange={setSolutionUrl}
                dismissedAutoLink={dismissedAutoLink}
                onDismissAutoLinkChange={setDismissedAutoLink}
                solutionCode={solutionCode}
                onSolutionCodeChange={setSolutionCode}
                disabled={isSubmitting}
                codeInputId="proposal-solution-code"
              />
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 bg-zinc-900/95 px-6 py-4">
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
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                isAttempted
                  ? "bg-amber-600 hover:bg-amber-500"
                  : "bg-emerald-600 hover:bg-emerald-500"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : isAttempted ? (
                <span>Salvar na Revisão</span>
              ) : (
                <span>Confirmar Resolução</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
