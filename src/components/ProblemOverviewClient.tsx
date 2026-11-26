"use client";

import type { Platform } from "@prisma/client";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Code2,
  ExternalLink,
  Link2,
  MessageSquareQuote,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DifficultyBadge,
  MemberAvatar,
  PlatformBadge,
  ProposalStatusBadge,
  TopicBadge,
} from "@/components/Badges";
import {
  ProblemFormModal,
  type ProblemFormPrefill,
} from "@/components/ProblemFormModal";
import { SolutionCodeBlock } from "@/components/SolutionCodeBlock";
import { cn, formatRelativeDate } from "@/lib/utils";
import type {
  MemberSummary,
  ProblemLogItem,
  ProposedProblemItem,
  TopicItem,
} from "@/types";

export type OverviewLogItem = ProblemLogItem;
export type OverviewProposalItem = ProposedProblemItem;

export interface ProblemOverviewData {
  anchorId: string;
  title: string;
  url: string;
  platform: Platform;
  externalId: string | null;
  externalRating: number | null;
  topics: TopicItem[];
}

export interface ProblemOverviewClientProps {
  currentUserId: string;
  problem: ProblemOverviewData;
  logs: OverviewLogItem[];
  proposals: OverviewProposalItem[];
  members: MemberSummary[];
  allTopics: TopicItem[];
}

/** Interactive problem overview showing team participation, proposals, and expandable solutions. */
export function ProblemOverviewClient({
  currentUserId,
  problem,
  logs,
  proposals,
  members,
  allTopics,
}: ProblemOverviewClientProps) {
  const [openSolutionIds, setOpenSolutionIds] = useState<
    Record<string, boolean>
  >({});
  const [codeCache, setCodeCache] = useState<Record<string, string | null>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<OverviewLogItem | null>(
    null
  );

  const currentUserLog = useMemo(() => {
    const mine = logs.filter((log) => log.userId === currentUserId);
    if (mine.length === 0) return null;
    return mine.find((log) => log.solved) ?? mine[0];
  }, [logs, currentUserId]);

  const solvedLogs = useMemo(() => logs.filter((log) => log.solved), [logs]);
  const reviewOrAttemptedCount = useMemo(
    () => logs.filter((log) => !log.solved || log.needsReview).length,
    [logs]
  );

  const solutionEntries = useMemo(
    () =>
      logs.filter(
        (log) =>
          log.solved && (log.hasSolutionCode || Boolean(log.solutionUrl))
      ),
    [logs]
  );

  const solvedMemberCount = useMemo(
    () => new Set(solvedLogs.map((log) => log.userId)).size,
    [solvedLogs]
  );

  const missingMembers = useMemo(() => {
    const loggedUserIds = new Set(logs.map((log) => log.userId));
    return members.filter((m) => !loggedUserIds.has(m.id));
  }, [logs, members]);

  const prefill = useMemo<ProblemFormPrefill>(
    () => ({
      title: problem.title,
      url: problem.url,
      externalId: problem.externalId,
      externalRating: problem.externalRating,
      topicIds: problem.topics.map((t) => t.id),
    }),
    [problem]
  );

  function toggleSolution(id: string) {
    setOpenSolutionIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function openMyEditModal() {
    if (!currentUserLog) return;
    setEditingProblem(currentUserLog);
    setModalOpen(true);
  }

  function openNewRegisterModal() {
    setEditingProblem(null);
    setModalOpen(true);
  }

  return (
    <div className="space-y-8">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/questoes"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Voltar para Questões</span>
        </Link>

        {currentUserLog ? (
          <button
            type="button"
            onClick={openMyEditModal}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3.5 py-2 text-xs font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Editar meu registro</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={openNewRegisterModal}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>+ Registrar minha resolução</span>
          </button>
        )}
      </div>

      {/* Header Card */}
      <header className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform={problem.platform} />
              {problem.externalRating ? (
                <span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-xs font-medium text-sky-300">
                  CF {problem.externalRating}
                </span>
              ) : null}
              {problem.topics.map((topic) => (
                <TopicBadge key={topic.id} topic={topic} />
              ))}
            </div>

            <h1 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
              {problem.title}
            </h1>
          </div>

          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition-colors hover:border-indigo-500/50 hover:bg-zinc-800 hover:text-indigo-200"
          >
            <span>Abrir enunciado</span>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 gap-3 border-t border-zinc-800/80 pt-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <CheckCircle2
                className="h-3.5 w-3.5 text-emerald-400"
                aria-hidden="true"
              />
              <span>Resolvida por</span>
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-zinc-100">
              {solvedMemberCount}
              <span className="text-xs font-normal text-zinc-500">
                /{members.length}
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <RotateCcw
                className="h-3.5 w-3.5 text-amber-400"
                aria-hidden="true"
              />
              <span>Tentaram / Revisão</span>
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-zinc-100">
              {reviewOrAttemptedCount}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Send
                className="h-3.5 w-3.5 text-indigo-400"
                aria-hidden="true"
              />
              <span>Propostas</span>
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-zinc-100">
              {proposals.length}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Code2
                className="h-3.5 w-3.5 text-sky-400"
                aria-hidden="true"
              />
              <span>Soluções</span>
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-zinc-100">
              {solutionEntries.length}
            </p>
          </div>
        </div>
      </header>

      {/* Section: Soluções (Accordion) */}
      <section aria-labelledby="solutions-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-indigo-400" aria-hidden="true" />
            <h2
              id="solutions-heading"
              className="text-lg font-semibold tracking-tight text-zinc-100"
            >
              Soluções
            </h2>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-300">
              {solutionEntries.length}
            </span>
          </div>

          {currentUserLog?.solved ? (
            <button
              type="button"
              onClick={openMyEditModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-200"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {currentUserLog.hasSolutionCode || currentUserLog.solutionUrl
                  ? "Atualizar minha solução"
                  : "Adicionar minha solução"}
              </span>
            </button>
          ) : null}
        </div>

        {solutionEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-10 text-center">
            <Code2 className="mb-2 h-7 w-7 text-zinc-600" aria-hidden="true" />
            <p className="text-sm font-medium text-zinc-300">
              Nenhuma solução (código ou link) cadastrada ainda.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Quando alguém resolver e colar o código ou vincular o link da
              submissão, a solução aparecerá aqui.
            </p>
            {currentUserLog?.solved ? (
              <button
                type="button"
                onClick={openMyEditModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3.5 py-2 text-xs font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/25"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>+ Adicionar minha solução</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {solutionEntries.map((entry) => {
              const isOpen = Boolean(openSolutionIds[entry.id]);
              const isMe = entry.userId === currentUserId;

              return (
                <div
                  key={entry.id}
                  className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/65 transition-colors hover:border-zinc-700/90"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleSolution(entry.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                      <MemberAvatar member={entry.user} size="sm" />
                      <span className="font-semibold text-zinc-100">
                        {entry.user.name}
                      </span>
                      {isMe ? (
                        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                          Você
                        </span>
                      ) : null}

                      {entry.hasSolutionCode ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                          <Code2 className="h-3 w-3" aria-hidden="true" />
                          <span>Código</span>
                        </span>
                      ) : null}

                      {entry.solutionUrl ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                          <Link2 className="h-3 w-3" aria-hidden="true" />
                          <span>Link</span>
                        </span>
                      ) : null}

                      <span className="text-xs text-zinc-500">
                        {entry.attemptCount}{" "}
                        {entry.attemptCount === 1 ? "tentativa" : "tentativas"}{" "}
                        · {formatRelativeDate(entry.createdAt)}
                      </span>
                    </div>

                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200",
                        isOpen && "rotate-180 text-indigo-300"
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen ? (
                    <div className="space-y-3 border-t border-zinc-800/80 bg-zinc-950/50 p-4">
                      {entry.solutionUrl ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-xs">
                          <div className="flex min-w-0 items-center gap-2 text-emerald-200">
                            <Link2
                              className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                              aria-hidden="true"
                            />
                            <span className="truncate font-mono text-[11px] text-emerald-200/85">
                              {entry.solutionUrl}
                            </span>
                          </div>
                          <a
                            href={entry.solutionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 font-medium text-emerald-100 transition-colors hover:bg-emerald-500/30"
                          >
                            <span>Abrir link da resolução</span>
                            <ExternalLink
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          </a>
                        </div>
                      ) : null}

                      {entry.notes ? (
                        <div className="flex items-start gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-300">
                          <MessageSquareText
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500"
                            aria-hidden="true"
                          />
                          <div>
                            <span className="mr-1.5 font-semibold text-zinc-400">
                              Observações:
                            </span>
                            <span className="whitespace-pre-wrap break-words">
                              {entry.notes}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {entry.hasSolutionCode ? (
                        <SolutionCodeBlock
                          problemLogId={entry.id}
                          cachedCode={
                            entry.id in codeCache
                              ? codeCache[entry.id]
                              : undefined
                          }
                          onCodeLoaded={(code) =>
                            setCodeCache((prev) => ({
                              ...prev,
                              [entry.id]: code,
                            }))
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section: Quem fez (Participação da Equipe) */}
      <section aria-labelledby="participants-heading" className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          <h2
            id="participants-heading"
            className="text-lg font-semibold tracking-tight text-zinc-100"
          >
            Quem fez
          </h2>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-300">
            {logs.length}
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-8 text-center text-sm text-zinc-400">
            Nenhum membro registrou tentativa ou resolução desta questão ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {logs.map((log) => {
              const isMe = log.userId === currentUserId;
              return (
                <article
                  key={log.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <MemberAvatar member={log.user} size="sm" />
                        <span className="truncate text-sm font-semibold text-zinc-100">
                          {log.user.name}
                        </span>
                        {isMe ? (
                          <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                            Você
                          </span>
                        ) : null}
                      </div>

                      {isMe ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProblem(log);
                            setModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          <span>Editar</span>
                        </button>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {log.solved ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Resolvida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                          Não resolvida
                        </span>
                      )}

                      {log.needsReview ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-300">
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
                          Em revisão
                        </span>
                      ) : null}

                      <DifficultyBadge difficulty={log.perceivedDifficulty} />

                      <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                        {log.attemptCount}{" "}
                        {log.attemptCount === 1 ? "tentativa" : "tentativas"}
                      </span>

                      <span className="text-xs text-zinc-500">
                        {formatRelativeDate(log.createdAt)}
                      </span>
                    </div>

                    {log.notes ? (
                      <div className="flex items-start gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-2 text-xs leading-relaxed text-zinc-300">
                        <MessageSquareText
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500"
                          aria-hidden="true"
                        />
                        <p className="whitespace-pre-wrap break-words">
                          {log.notes}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {missingMembers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-400">
            <span className="font-medium text-zinc-500">
              Ainda não registraram:
            </span>
            {missingMembers.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 py-0.5 pr-2.5 pl-1 text-zinc-300"
              >
                <MemberAvatar member={member} size="sm" />
                <span>{member.name}</span>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* Section: Propostas */}
      <section aria-labelledby="proposals-heading" className="space-y-3">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-indigo-400" aria-hidden="true" />
          <h2
            id="proposals-heading"
            className="text-lg font-semibold tracking-tight text-zinc-100"
          >
            Propostas
          </h2>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-300">
            {proposals.length}
          </span>
        </div>

        {proposals.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-500">
            Nenhuma proposta registrada para esta questão.
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((proposal) => {
              const isSelfSaved = proposal.proposerId === proposal.assigneeId;
              const isProposer = proposal.proposerId === currentUserId;
              const isAssignee = proposal.assigneeId === currentUserId;

              return (
                <article
                  key={proposal.id}
                  className="space-y-2.5 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
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

                    <div className="flex flex-wrap items-center gap-1.5">
                      {proposal.suggestedDifficulty ? (
                        <DifficultyBadge
                          difficulty={proposal.suggestedDifficulty}
                        />
                      ) : null}
                      <ProposalStatusBadge status={proposal.status} />
                    </div>
                  </div>

                  {proposal.message ? (
                    <div className="flex items-start gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-300">
                      <MessageSquareQuote
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400"
                        aria-hidden="true"
                      />
                      <span className="whitespace-pre-wrap break-words">
                        {proposal.message}
                      </span>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ProblemFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProblem(null);
        }}
        topics={allTopics}
        initialProblem={editingProblem}
        prefill={editingProblem ? null : prefill}
      />
    </div>
  );
}
