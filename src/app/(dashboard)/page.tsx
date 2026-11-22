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
} from "lucide-react";
import Link from "next/link";
import {
  DifficultyBadge,
  MemberAvatar,
  PlatformBadge,
  TopicBadge,
} from "@/components/Badges";
import { DashboardClient } from "@/components/DashboardClient";
import {
  type DashboardMemberCardItem,
  DashboardMemberGrid,
  type DashboardMemberTopicStat,
} from "@/components/DashboardMemberGrid";
import { requireTeamMember } from "@/lib/auth";
import { getCachedTeamMembers, getCachedTopics } from "@/lib/cache";
import { buildDashboardHref, buildQuestoesHref } from "@/lib/dashboard";
import {
  buildPrismaProblemPeriodWhere,
  formatPeriodLabel,
  parsePeriodSearchParams,
} from "@/lib/period";
import { prisma } from "@/lib/prisma";
import { formatRelativeDate } from "@/lib/utils";
import type { MemberSummary, TopicItem } from "@/types";

const LATEST_LOG_INCLUDE = {
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
} as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string;
    from?: string;
    to?: string;
    membro?: string;
  }>;
}) {
  const [resolvedParams, currentUser] = await Promise.all([
    searchParams,
    requireTeamMember(),
  ]);

  const periodFilter = parsePeriodSearchParams(resolvedParams);
  const periodWhere = buildPrismaProblemPeriodWhere(periodFilter);
  const isPeriodFiltered = periodFilter.preset !== "all";
  const periodLabel = formatPeriodLabel(periodFilter);
  const requestedMemberId = resolvedParams.membro?.trim() || null;

  const [
    teamMembers,
    serializedTopics,
    logsSummary,
    initialLatestLogs,
    initialOpenProposalsCount,
  ] = await Promise.all([
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
      where: {
        teamId: currentUser.teamId,
        ...(requestedMemberId ? { userId: requestedMemberId } : {}),
        ...periodWhere,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: LATEST_LOG_INCLUDE,
    }),
    prisma.proposedProblem.count({
      where: {
        teamId: currentUser.teamId,
        ...(requestedMemberId ? { assigneeId: requestedMemberId } : {}),
        status: { in: ["PENDENTE", "VISUALIZADO", "TENTOU"] },
      },
    }),
  ]);

  const selectedMember = requestedMemberId
    ? (teamMembers.find((m) => m.id === requestedMemberId) ?? null)
    : null;

  const [latestLogs, scopedOpenProposalsCount] =
    requestedMemberId && !selectedMember
      ? await Promise.all([
          prisma.problemLog.findMany({
            where: { teamId: currentUser.teamId, ...periodWhere },
            orderBy: { createdAt: "desc" },
            take: 8,
            include: LATEST_LOG_INCLUDE,
          }),
          prisma.proposedProblem.count({
            where: {
              teamId: currentUser.teamId,
              status: { in: ["PENDENTE", "VISUALIZADO", "TENTOU"] },
            },
          }),
        ])
      : [initialLatestLogs, initialOpenProposalsCount];

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

  const topicStatsMap = new Map<
    string,
    { totalCount: number; solvedCount: number }
  >();

  let scopedTotalLogsCount = 0;
  let scopedSolvedCount = 0;
  let scopedActiveReviewCount = 0;
  let scopedTotalAttempts = 0;

  for (const log of logsSummary) {
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

    const matchesScope = !selectedMember || log.userId === selectedMember.id;
    if (matchesScope) {
      scopedTotalLogsCount += 1;
      if (log.solved) scopedSolvedCount += 1;
      if (log.needsReview) scopedActiveReviewCount += 1;
      scopedTotalAttempts += log.attemptCount;
    }

    for (const topicRef of log.topics) {
      mStats.topicCounts.set(
        topicRef.id,
        (mStats.topicCounts.get(topicRef.id) ?? 0) + 1
      );

      if (matchesScope) {
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
  }

  const scopedResolutionRate =
    scopedTotalLogsCount > 0
      ? Math.round((scopedSolvedCount / scopedTotalLogsCount) * 100)
      : 0;

  const teammates: MemberSummary[] = teamMembers.filter(
    (u) => u.id !== currentUser.id
  );

  const currentUserSummary: MemberSummary = {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    cfHandle: currentUser.cfHandle,
    lcHandle: currentUser.lcHandle,
    avatarColor: currentUser.avatarColor,
  };

  const memberCards: DashboardMemberCardItem[] = teamMembers.map((u) => {
    const stats = memberStatsMap.get(u.id);
    const totalLogs = stats?.totalLogs ?? 0;
    const solvedCount = stats?.solvedCount ?? 0;
    const reviewCount = stats?.reviewCount ?? 0;
    const totalAttempts = stats?.totalAttempts ?? 0;
    const accuracyRate =
      totalLogs > 0 ? Math.round((solvedCount / totalLogs) * 100) : 0;

    const topTopics: DashboardMemberTopicStat[] = [];
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

  const memberFirstName = selectedMember
    ? selectedMember.name.trim().split(/\s+/)[0] || selectedMember.name
    : null;

  const solvedCardHref = buildQuestoesHref({
    memberId: selectedMember?.id,
    status: "SOLVED",
    period: periodFilter,
  });

  const reviewCardHref = !selectedMember
    ? "/revisao?scope=team"
    : selectedMember.id === currentUser.id
      ? "/revisao"
      : `/revisao?scope=team&member=${encodeURIComponent(selectedMember.id)}`;

  const proposalsCardHref = !selectedMember
    ? "/propostos?tab=todos"
    : `/propostos?tab=todos&member=${encodeURIComponent(selectedMember.id)}`;

  const allLogsHref = buildQuestoesHref({
    memberId: selectedMember?.id,
    period: periodFilter,
  });

  const recentActivitySubtitle =
    latestLogs.length === 0
      ? selectedMember
        ? `Nenhuma questão registrada por ${selectedMember.name} neste recorte`
        : "Nenhuma questão registrada pelo time neste recorte"
      : latestLogs.length === 1
        ? selectedMember
          ? `Última questão registrada por ${selectedMember.name}`
          : "Última questão registrada pelo time"
        : selectedMember
          ? `Últimas ${latestLogs.length} questões registradas por ${selectedMember.name}`
          : `Últimas ${latestLogs.length} questões registradas pelo time`;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <header className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            {selectedMember ? (
              <MemberAvatar member={selectedMember} size="md" />
            ) : (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
                <Trophy className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
            <h1 className="font-mono text-2xl font-bold tracking-tight text-zinc-100">
              {selectedMember
                ? `${selectedMember.name} — Progresso Individual`
                : `${currentUser.team.name} — Painel da Equipe`}
            </h1>
            {selectedMember && selectedMember.id === currentUser.id ? (
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                Você
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <p>
              {selectedMember
                ? `Acompanhamento individual em ${currentUser.team.name}: resoluções, revisões ativas, tópicos abordados e propostas.`
                : "Visão geral de resoluções, revisões ativas, cobertura de tópicos e propostas do time."}
            </p>
          </div>

          {selectedMember || isPeriodFiltered ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {selectedMember ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/15 py-0.5 pr-2.5 pl-1.5 text-xs font-medium text-indigo-200">
                  <MemberAvatar member={selectedMember} size="sm" />
                  <span>Membro: {selectedMember.name}</span>
                  <Link
                    href={buildDashboardHref(periodFilter, null)}
                    scroll={false}
                    className="text-indigo-300 underline hover:text-white"
                  >
                    Voltar para a equipe
                  </Link>
                </span>
              ) : null}

              {isPeriodFiltered ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-200">
                  <span>Período: {periodLabel}</span>
                  <Link
                    href={buildDashboardHref(
                      { preset: "all" },
                      selectedMember?.id
                    )}
                    scroll={false}
                    className="text-indigo-300 underline hover:text-white"
                  >
                    Ver global
                  </Link>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <DashboardClient
          currentUser={currentUserSummary}
          topics={serializedTopics}
          teammates={teammates}
          periodFilter={periodFilter}
          selectedMemberId={selectedMember?.id ?? null}
        />
      </header>

      {/* 4 Summary KPI Cards */}
      <section
        aria-label={
          selectedMember
            ? `Indicadores de ${selectedMember.name}`
            : "Indicadores da equipe"
        }
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Link
          href={solvedCardHref}
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-colors hover:border-emerald-500/40 hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-zinc-400">
              {selectedMember
                ? `Questões Resolvidas por ${memberFirstName}`
                : "Questões Resolvidas pela Equipe"}
            </span>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-zinc-100">
                {scopedSolvedCount}
              </span>
              <span className="text-xs text-zinc-500">
                de {scopedTotalLogsCount}{" "}
                {scopedTotalLogsCount === 1 ? "registro" : "registros"}
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-400 opacity-80 transition group-hover:opacity-100">
              Ver questões
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href={reviewCardHref}
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-colors hover:border-amber-500/40 hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-zinc-400">
              {selectedMember
                ? `Revisões Pendentes de ${memberFirstName}`
                : "Fila de Revisão Ativa"}
            </span>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-100">
              {scopedActiveReviewCount}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-400 opacity-80 transition group-hover:opacity-100">
              Ver revisão
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link
          href={proposalsCardHref}
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-colors hover:border-indigo-500/40 hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-zinc-400">
              {selectedMember
                ? `Propostas em Aberto de ${memberFirstName}`
                : "Propostas em Aberto"}
            </span>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
              <Send className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-100">
              {scopedOpenProposalsCount}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-400 opacity-80 transition group-hover:opacity-100">
              Ver propostas
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-zinc-400">
              {selectedMember
                ? `Taxa de Resolução de ${memberFirstName}`
                : "Taxa de Resolução (%)"}
            </span>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
              <Percent className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-100">
              {scopedResolutionRate}%
            </span>
            <span className="text-xs text-zinc-500">
              {practicedTopicsCount}/{topicCoverage.length} tópicos ·{" "}
              {scopedTotalAttempts}{" "}
              {scopedTotalAttempts === 1 ? "tentativa" : "tentativas"}
            </span>
          </div>
        </div>
      </section>

      {/* Membros da Equipe (Grid 3 colunas interativo) */}
      <DashboardMemberGrid
        members={memberCards}
        selectedMemberId={selectedMember?.id ?? null}
        periodFilter={periodFilter}
      />

      {/* Cobertura por Tópicos + Atividade Recente (2-column grid) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cobertura por Tópicos */}
        <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-zinc-800 pb-4">
            <div className="flex min-w-0 items-center gap-2">
              <Layers
                className="h-5 w-5 shrink-0 text-indigo-400"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold tracking-tight text-zinc-100">
                  {selectedMember
                    ? `Tópicos Abordados por ${memberFirstName}`
                    : "Cobertura por Tópicos"}
                </h2>
                <p className="text-xs text-zinc-400">
                  {selectedMember
                    ? `${practicedTopicsCount} de ${topicCoverage.length} tópicos abordados por ${selectedMember.name}`
                    : `${practicedTopicsCount} de ${topicCoverage.length} tópicos com registros da equipe`}
                </p>
              </div>
            </div>

            {selectedMember ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/80 py-1 pr-2.5 pl-1.5 text-xs font-medium text-zinc-200">
                <MemberAvatar member={selectedMember} size="sm" />
                <span>{memberFirstName}</span>
              </span>
            ) : null}
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

              const innerContent = (
                <>
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
                </>
              );

              if (isUntouched) {
                return (
                  <div
                    key={topic.id}
                    className="space-y-1.5 rounded-xl border border-zinc-800/60 bg-zinc-950/35 px-3.5 py-2.5 opacity-70 transition-colors"
                  >
                    {innerContent}
                  </div>
                );
              }

              return (
                <Link
                  key={topic.id}
                  href={buildQuestoesHref({
                    memberId: selectedMember?.id,
                    topicId: topic.id,
                    period: periodFilter,
                  })}
                  className="block space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3.5 py-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
                >
                  {innerContent}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-zinc-800 pb-4">
            <div className="flex min-w-0 items-center gap-2">
              <Activity
                className="h-5 w-5 shrink-0 text-emerald-400"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold tracking-tight text-zinc-100">
                  {selectedMember
                    ? `Atividade Recente de ${memberFirstName}`
                    : "Atividade Recente da Equipe"}
                </h2>
                <p className="text-xs text-zinc-400">{recentActivitySubtitle}</p>
              </div>
            </div>
            <Link
              href={allLogsHref}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
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
                {selectedMember
                  ? `Nenhuma questão registrada por ${selectedMember.name}`
                  : "Nenhuma questão registrada ainda"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {isPeriodFiltered
                  ? selectedMember
                    ? `${selectedMember.name} não possui registros no período selecionado.`
                    : "Não há registros da equipe no período selecionado."
                  : selectedMember
                    ? `${selectedMember.name} ainda não registrou questões na equipe.`
                    : 'Clique em "+ Registrar Questão" no topo para começar o histórico da equipe.'}
              </p>
              {isPeriodFiltered ? (
                <Link
                  href={buildDashboardHref({ preset: "all" }, selectedMember?.id)}
                  scroll={false}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-indigo-500/50 hover:bg-zinc-800 hover:text-white"
                >
                  Ver todo o período
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
