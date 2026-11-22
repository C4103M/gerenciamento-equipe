import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Info,
  RotateCcw,
  Send,
  Target,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { MemberAvatar, TopicBadge } from "@/components/Badges";
import {
  type MemberDetailStats,
  MembersClient,
} from "@/components/MembersClient";
import { requireTeamMember } from "@/lib/auth";
import { getCachedTopics } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import type { MemberSummary, TopicItem } from "@/types";

export default async function MembersPage() {
  const currentUser = await requireTeamMember();

  const [usersRaw, topicsList, logsSummary] = await Promise.all([
    prisma.user.findMany({
      where: { teamId: currentUser.teamId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        cfHandle: true,
        lcHandle: true,
        avatarColor: true,
        createdAt: true,
        _count: {
          select: {
            proposedToMe: { where: { teamId: currentUser.teamId } },
            proposedByMe: { where: { teamId: currentUser.teamId } },
          },
        },
      },
    }),
    getCachedTopics(),
    prisma.problemLog.findMany({
      where: { teamId: currentUser.teamId },
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
  ]);

  const topicsById = new Map<string, TopicItem>(
    topicsList.map((topic) => [topic.id, topic])
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

  for (const log of logsSummary) {
    let stats = memberStatsMap.get(log.userId);
    if (!stats) {
      stats = {
        totalLogs: 0,
        solvedCount: 0,
        reviewCount: 0,
        totalAttempts: 0,
        topicCounts: new Map<string, number>(),
      };
      memberStatsMap.set(log.userId, stats);
    }

    stats.totalLogs += 1;
    if (log.solved) stats.solvedCount += 1;
    if (log.needsReview) stats.reviewCount += 1;
    stats.totalAttempts += log.attemptCount;

    for (const topicRef of log.topics) {
      stats.topicCounts.set(
        topicRef.id,
        (stats.topicCounts.get(topicRef.id) ?? 0) + 1
      );
    }
  }

  const currentUserSummary: MemberSummary = {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    cfHandle: currentUser.cfHandle,
    lcHandle: currentUser.lcHandle,
    avatarColor: currentUser.avatarColor,
  };

  const members: MemberDetailStats[] = usersRaw.map((u) => {
    const stats = memberStatsMap.get(u.id);
    const totalLogs = stats?.totalLogs ?? 0;
    const solvedCount = stats?.solvedCount ?? 0;
    const reviewCount = stats?.reviewCount ?? 0;
    const totalAttempts = stats?.totalAttempts ?? 0;
    const accuracyRate =
      totalLogs > 0 ? Math.round((solvedCount / totalLogs) * 100) : 0;

    const topTopics: Array<TopicItem & { count: number }> = [];
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
      createdAt: u.createdAt.toISOString(),
      solvedCount,
      reviewCount,
      totalLogs,
      totalAttempts,
      accuracyRate,
      proposedToMeCount: u._count.proposedToMe,
      proposedByMeCount: u._count.proposedByMe,
      topTopics: topTopics.slice(0, 4),
    };
  });

  const maxMembers = currentUser.team.maxMembers;
  const hasOpenSlots = maxMembers > 0 && members.length < maxMembers;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
            <h1 className="font-mono text-2xl font-bold tracking-tight text-zinc-100">
              Equipe — {currentUser.team.name}
            </h1>
          </div>
          <p className="text-sm text-zinc-400">
            Integrantes cadastrados, métricas individuais detalhadas e edição do
            seu perfil.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 text-xs font-medium text-zinc-300 sm:self-auto">
          <Users className="h-4 w-4 text-indigo-400" aria-hidden="true" />
          <span>
            {maxMembers > 0
              ? `${members.length}/${maxMembers} ${
                  members.length === 1 ? "membro ativo" : "membros ativos"
                }`
              : `${members.length} ${
                  members.length === 1 ? "membro ativo" : "membros ativos"
                }`}
          </span>
        </div>
      </header>

      {/* Helpful banner when team has available slots */}
      {hasOpenSlots ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400"
              aria-hidden="true"
            />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-indigo-200">
                Sua equipe ainda está abaixo da capacidade máxima (
                {members.length}/{maxMembers}).
              </p>
              <p className="text-xs text-indigo-200/80">
                Compartilhe o código de convite{" "}
                <code className="rounded border border-indigo-400/30 bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-100">
                  {currentUser.team.inviteCode}
                </code>{" "}
                para que os demais colegas criem suas contas na página{" "}
                <code className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[11px] text-indigo-100">
                  /cadastro
                </code>{" "}
                e participem da equipe.
              </p>
            </div>
          </div>

          <Link
            href="/cadastro"
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition-colors hover:bg-indigo-500/30 sm:self-auto"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Link de cadastro (/cadastro)</span>
          </Link>
        </div>
      ) : null}

      {/* Member Profile Edit Form */}
      <MembersClient currentUser={currentUserSummary} members={members} />

      {/* Detailed Per-Member Breakdown Cards */}
      <section aria-labelledby="members-breakdown-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="members-breakdown-heading"
            className="text-lg font-semibold tracking-tight text-zinc-100"
          >
            Membros Cadastrados ({members.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {members.map((member) => {
            const isMe = member.id === currentUser.id;
            const joinedDate = new Date(member.createdAt).toLocaleDateString(
              "pt-BR",
              {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }
            );

            return (
              <article
                key={member.id}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border bg-zinc-900/70 p-6",
                  isMe ? "border-indigo-500/40" : "border-zinc-800"
                )}
              >
                <div className="space-y-5">
                  {/* Member Identity */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <MemberAvatar member={member} size="lg" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-zinc-100">
                            {member.name}
                          </h3>
                          {isMe ? (
                            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                              Você
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-zinc-400">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Desde {joinedDate}</span>
                    </span>
                  </div>

                  {/* Handles */}
                  <div className="flex flex-wrap items-center gap-2">
                    {member.cfHandle ? (
                      <a
                        href={`https://codeforces.com/profile/${encodeURIComponent(member.cfHandle)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-mono text-xs text-sky-300 transition-colors hover:bg-sky-500/20"
                      >
                        <span>Codeforces: {member.cfHandle}</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-xs text-zinc-500">
                        Codeforces: não informado
                      </span>
                    )}

                    {member.lcHandle ? (
                      <a
                        href={`https://leetcode.com/u/${encodeURIComponent(member.lcHandle)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-xs text-amber-300 transition-colors hover:bg-amber-500/20"
                      >
                        <span>LeetCode: {member.lcHandle}</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-xs text-zinc-500">
                        LeetCode: não informado
                      </span>
                    )}
                  </div>

                  {/* Detailed Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-emerald-400"
                          aria-hidden="true"
                        />
                        <span>Resolvidas</span>
                      </div>
                      <p className="mt-1 text-xl font-bold text-zinc-100">
                        {member.solvedCount}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        de {member.totalLogs} registros
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <RotateCcw
                          className="h-3.5 w-3.5 text-amber-400"
                          aria-hidden="true"
                        />
                        <span>Em revisão</span>
                      </div>
                      <p className="mt-1 text-xl font-bold text-zinc-100">
                        {member.reviewCount}
                      </p>
                      <p className="text-[11px] text-zinc-500">pendentes</p>
                    </div>

                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <Target
                          className="h-3.5 w-3.5 text-sky-400"
                          aria-hidden="true"
                        />
                        <span>Taxa acerto</span>
                      </div>
                      <p className="mt-1 text-xl font-bold text-zinc-100">
                        {member.accuracyRate}%
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {member.totalAttempts} tentativas
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
                      <p className="mt-1 text-xl font-bold text-zinc-100">
                        {member.proposedToMeCount}
                        <span className="mx-1 text-sm font-normal text-zinc-500">
                          /
                        </span>
                        {member.proposedByMeCount}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        receb. / env.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Top Practiced Topics */}
                <div className="mt-5 border-t border-zinc-800/80 pt-3.5">
                  <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                    Tópicos mais praticados
                  </p>
                  {member.topTopics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {member.topTopics.map((topic) => (
                        <TopicBadge key={topic.id} topic={topic} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Nenhum tópico praticado ainda.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
