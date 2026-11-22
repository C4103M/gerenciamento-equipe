import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Layers,
  Percent,
  RotateCcw,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  DifficultyBadge,
  MemberAvatar,
  PlatformBadge,
  TopicBadge,
} from "@/components/Badges";
import { DashboardClient } from "@/components/DashboardClient";
import { requireTeamMember } from "@/lib/auth";
import { getCachedTeamMembers, getCachedTopics } from "@/lib/cache";
import {
  buildPrismaProblemPeriodWhere,
  formatPeriodLabel,
  parsePeriodSearchParams,
} from "@/lib/period";
import { prisma } from "@/lib/prisma";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { MemberSummary, TopicItem } from "@/types";

interface TopTopicStat extends TopicItem {
  count: number;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string }>;
}) {
  const [resolvedParams, currentUser] = await Promise.all([
    searchParams,
    requireTeamMember(),
  ]);

  const periodFilter = parsePeriodSearchParams(resolvedParams);
  const periodWhere = buildPrismaProblemPeriodWhere(periodFilter);
  const isPeriodFiltered = periodFilter.preset !== "all";
  const periodLabel = formatPeriodLabel(periodFilter);

  const [teamMembers, serializedTopics, logsSummary, latestLogs, openProposalsCount] =
    await Promise.all([
      getCachedTeamMembers(currentUser.teamId),
      getCachedTopics(),
      prisma.problemLog.findMany({
        where: { teamId: currentUser.teamId, ...periodWhere },
        select: {
          userId: true,
          solved: true,
          needsReview: true,
          attemptCount: true,
          topics: {
            select: { id: true },
          },
        },
      }),
      prisma.problemLog.findMany({
        where: { teamId: currentUser.teamId, ...periodWhere },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              cfHandle: true,
              lcHandle: true,
              avatarColor: true,
            },
          },
          topics: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
            },
          },
        },
      }),
      prisma.proposedProblem.count({
        where: {
          teamId: currentUser.teamId,
          status: { in: ["PENDENTE", "VISUALIZADO", "TENTOU"] },
        },
      }),
    ]);

  const topicsById = new Map<string, TopicItem>(
    serializedTopics.map((topic) => [topic.id, topic])
  );

  const memberStatsMap = new Map<
    string,
    {
      totalLogs: number;
      solvedCount: number;
      reviewCount: number;
      totalAttempts: number;
      topicCounts: Map<string, number>;
    }
  >();

  const topicStatsMap = new Map<string, { totalCount: number; solvedCount: number }>();

  let totalSolvedCount = 0;
  let activeReviewCount = 0;

  for (const log of logsSummary) {
    if (log.solved) totalSolvedCount += 1;
    if (log.needsReview) activeReviewCount += 1;

    let mStats = memberStatsMap.get(log.userId);
    if (!mStats) {
      mStats = {
        totalLogs: 0,
        solvedCount: 0,
        reviewCount: 0,
        totalAttempts: 0,
        topicCounts: new Map<string, number>(),
      };
      memberStatsMap.set(log.userId, mStats);
    }

    mStats.totalLogs += 1;
    if (log.solved) mStats.solvedCount += 1;
    if (log.needsReview) mStats.reviewCount += 1;
    mStats.totalAttempts += log.attemptCount;

    for (const topicRef of log.topics) {
      mStats.topicCounts.set(
        topicRef.id,
        (mStats.topicCounts.get(topicRef.id) ?? 0) + 1
      );

      const tStats = topicStatsMap.get(topicRef.id);
      if (tStats) {
        tStats.totalCount += 1;
        if (log.solved) tStats.solvedCount += 1;
      } else {
        topicStatsMap.set(topicRef.id, {
          totalCount: 1,
          solvedCount: log.solved ? 1 : 0,
        });
      }
    }
  }

  const totalLogsCount = logsSummary.length;
  const resolutionRate =
    totalLogsCount > 0
      ? Math.round((totalSolvedCount / totalLogsCount) * 100)
      : 0;

  const teammates: MemberSummary[] = teamMembers.filter(
    (u) => u.id !== currentUser.id
  );

  const memberCards = teamMembers.map((u) => {
    const stats = memberStatsMap.get(u.id);
    const totalLogs = stats?.totalLogs ?? 0;
    const solvedCount = stats?.solvedCount ?? 0;
    const reviewCount = stats?.reviewCount ?? 0;
    const totalAttempts = stats?.totalAttempts ?? 0;
    const accuracyRate =
      totalLogs > 0 ? Math.round((solvedCount / totalLogs) * 100) : 0;

    const topTopics: TopTopicStat[] = [];
    if (stats) {
      for (const [topicId, count] of stats.topicCounts.entries()) {
        const topic = topicsById.get(topicId);
        if (topic) {
          topTopics.push({ ...topic, count });
        }
      }
      topTopics.sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR")
      );
    }

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      cfHandle: u.cfHandle,
      lcHandle: u.lcHandle,
      avatarColor: u.avatarColor,
      isCurrentUser: u.id === currentUser.id,
      solvedCount,
      reviewCount,
      totalLogs,
      totalAttempts,
      accuracyRate,
      topTopics: topTopics.slice(0, 3),
    };
  });

  const topicCoverage = serializedTopics
    .map((t) => {
      const counts = topicStatsMap.get(t.id);
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        color: t.color,
        totalCount: counts?.totalCount ?? 0,
        solvedCount: counts?.solvedCount ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.totalCount - a.totalCount ||
        b.solvedCount - a.solvedCount ||
        a.name.localeCompare(b.name, "pt-BR")
    );

  const maxTopicCount = Math.max(
    1,
    ...topicCoverage.map((topic) => topic.totalCount)
  );
  const practicedTopicsCount = topicCoverage.filter(
    (t) => t.totalCount > 0
  ).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <header className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
              <Trophy className="h-4 w-4" aria-hidden="true" />
            </span>
            <h1 className="font-mono text-2xl font-bold tracking-tight text-zinc-100">
              {currentUser.team.name} — Painel da Equipe
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <p>
              Visão geral de resoluções, revisões ativas, cobertura de tópicos e
              propostas do time.
            </p>
            {isPeriodFiltered ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-200">
                <span>Período: {periodLabel}</span>
                <Link
                  href="/"
                  className="text-indigo-300 underline hover:text-white"
                >
                  Ver global
                </Link>
              </span>
            ) : null}
          </div>
        </div>

        <DashboardClient
          topics={serializedTopics}
          teammates={teammates}
          periodFilter={periodFilter}
        />
      </header>

      {/* 4 Summary KPI Cards */}
      <section
        aria-label="Indicadores da equipe"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-400">
              Questões Resolvidas pela Equipe
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-100">
              {totalSolvedCount}
            </span>
            <span className="text-xs text-zinc-500">
              de {totalLogsCount} registros
            </span>
          </div>
        </div>

        <Link
          href="/revisao"
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-colors hover:border-amber-500/40 hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-400">
              Fila de Revisão Ativa
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-100">
              {activeReviewCount}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 opacity-80 transition group-hover:opacity-100">
              Ver revisão
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href="/propostos"
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-colors hover:border-indigo-500/40 hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-400">
              Propostas em Aberto
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
              <Send className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-100">
              {openProposalsCount}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 opacity-80 transition group-hover:opacity-100">
              Ver propostas
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-400">
              Taxa de Resolução (%)
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
              <Percent className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-100">
              {resolutionRate}%
            </span>
            <span className="text-xs text-zinc-500">
              {practicedTopicsCount}/{topicCoverage.length} tópicos praticados
            </span>
          </div>
        </div>
      </section>

      {/* Membros da Equipe (Grid 3 colunas) */}
      <section aria-labelledby="members-grid-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-400" aria-hidden="true" />
            <h2
              id="members-grid-heading"
              className="text-lg font-semibold tracking-tight text-zinc-100"
            >
              Membros da Equipe
            </h2>
          </div>
          <Link
            href="/membros"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
          >
            <span>Gerenciar equipe & perfil</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memberCards.map((member) => (
            <article
              key={member.id}
              className={cn(
                "flex flex-col justify-between rounded-2xl border bg-zinc-900/70 p-5 transition-colors",
                member.isCurrentUser
                  ? "border-indigo-500/40"
                  : "border-zinc-800"
              )}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar member={member} size="lg" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-zinc-100">
                          {member.name}
                        </h3>
                        {member.isCurrentUser ? (
                          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                            Você
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {member.cfHandle ? (
                          <a
                            href={`https://codeforces.com/profile/${encodeURIComponent(member.cfHandle)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-300 transition-colors hover:bg-sky-500/20"
                          >
                            <span>CF: {member.cfHandle}</span>
                            <ExternalLink
                              className="h-2.5 w-2.5"
                              aria-hidden="true"
                            />
                          </a>
                        ) : null}

                        {member.lcHandle ? (
                          <a
                            href={`https://leetcode.com/u/${encodeURIComponent(member.lcHandle)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-300 transition-colors hover:bg-amber-500/20"
                          >
                            <span>LC: {member.lcHandle}</span>
                            <ExternalLink
                              className="h-2.5 w-2.5"
                              aria-hidden="true"
                            />
                          </a>
                        ) : null}

                        {!member.cfHandle && !member.lcHandle ? (
                          <span className="text-zinc-500">
                            Sem handles vinculados
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Member Stats */}
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-emerald-400">
                      {member.solvedCount}
                    </p>
                    <p className="text-[11px] text-zinc-400">Resolvidas</p>
                  </div>
                  <div className="border-x border-zinc-800/80">
                    <p className="text-lg font-bold text-amber-400">
                      {member.reviewCount}
                    </p>
                    <p className="text-[11px] text-zinc-400">Em Revisão</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-zinc-100">
                      {member.accuracyRate}%
                    </p>
                    <p className="text-[11px] text-zinc-400">Taxa de acerto</p>
                  </div>
                </div>
              </div>

              {/* Top Topics */}
              <div className="mt-4 border-t border-zinc-800/80 pt-3">
                <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                  Principais tópicos
                </p>
                {member.topTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {member.topTopics.map((topic) => (
                      <TopicBadge key={topic.id} topic={topic} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Nenhuma questão registrada ainda.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Cobertura por Tópicos + Atividade Recente da Equipe (2-column grid) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cobertura por Tópicos */}
        <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-400" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold tracking-tight text-zinc-100">
                  Cobertura por Tópicos
                </h2>
                <p className="text-xs text-zinc-400">
                  {practicedTopicsCount} de {topicCoverage.length} tópicos com
                  registros da equipe
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
            {topicCoverage.map((topic) => {
              const isUntouched = topic.totalCount === 0;
              const totalWidthPct = isUntouched
                ? 0
                : Math.max(8, Math.round((topic.totalCount / maxTopicCount) * 100));
              const solvedWidthPct =
                topic.totalCount > 0
                  ? Math.round((topic.solvedCount / topic.totalCount) * 100)
                  : 0;

              return (
                <div
                  key={topic.id}
                  className={cn(
                    "space-y-1.5 rounded-xl border px-3.5 py-2.5 transition-colors",
                    isUntouched
                      ? "border-zinc-800/60 bg-zinc-950/35 opacity-70"
                      : "border-zinc-800 bg-zinc-950/70"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: topic.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium text-zinc-200">
                        {topic.name}
                      </span>
                    </div>

                    {isUntouched ? (
                      <span className="shrink-0 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                        Sem questões ainda
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-zinc-400">
                        <strong className="text-zinc-100">
                          {topic.solvedCount}
                        </strong>
                        /{topic.totalCount}{" "}
                        {topic.totalCount === 1 ? "questão" : "questões"}
                      </span>
                    )}
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/90">
                    {!isUntouched ? (
                      <div
                        className="h-full overflow-hidden rounded-full bg-zinc-600/60 transition-all"
                        style={{ width: `${totalWidthPct}%` }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${solvedWidthPct}%`,
                            backgroundColor: topic.color,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Atividade Recente da Equipe */}
        <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <Activity
                className="h-5 w-5 text-emerald-400"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-base font-semibold tracking-tight text-zinc-100">
                  Atividade Recente da Equipe
                </h2>
                <p className="text-xs text-zinc-400">
                  Últimas {latestLogs.length} questões registradas pelo time
                </p>
              </div>
            </div>
            <Link
              href="/questoes"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
            >
              <span>Ver todas</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {latestLogs.length > 0 ? (
            <div className="space-y-3">
              {latestLogs.map((log) => (
                <article
                  key={log.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 transition-colors hover:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <a
                        href={log.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-zinc-100 transition-colors hover:text-indigo-400"
                      >
                        <span className="truncate">{log.title}</span>
                        <ExternalLink
                          className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-colors group-hover:text-indigo-400"
                          aria-hidden="true"
                        />
                      </a>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <PlatformBadge platform={log.platform} />
                        {log.externalRating ? (
                          <span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-xs font-medium text-sky-300">
                            CF {log.externalRating}
                          </span>
                        ) : null}
                        <DifficultyBadge difficulty={log.perceivedDifficulty} />
                        {log.solved ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
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
                            Revisão
                          </span>
                        ) : null}
                      </div>

                      {log.topics.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {log.topics.map((topic) => (
                            <TopicBadge key={topic.id} topic={topic} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-800/80 pt-2.5 text-xs text-zinc-400">
                    <div className="flex items-center gap-2">
                      <MemberAvatar member={log.user} size="sm" />
                      <span className="font-medium text-zinc-300">
                        {log.user.name}
                      </span>
                      <span className="text-zinc-600" aria-hidden="true">
                        •
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {log.attemptCount}{" "}
                        {log.attemptCount === 1 ? "tentativa" : "tentativas"}
                      </span>
                    </div>
                    <time
                      dateTime={log.createdAt.toISOString()}
                      className="text-zinc-500"
                    >
                      {formatRelativeDate(log.createdAt)}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-12 text-center">
              <BookOpen
                className="mb-2 h-8 w-8 text-zinc-600"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-zinc-300">
                Nenhuma questão registrada ainda
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Clique em &quot;+ Registrar Questão&quot; no topo para começar o
                histórico da equipe.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
