"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { MemberAvatar, TopicBadge } from "@/components/Badges";
import { buildDashboardHref } from "@/lib/dashboard";
import type { PeriodFilterValue } from "@/lib/period";
import { cn } from "@/lib/utils";
import type { TopicItem } from "@/types";

export interface DashboardMemberTopicStat extends TopicItem {
  count: number;
}

export interface DashboardMemberCardItem {
  id: string;
  name: string;
  email: string;
  cfHandle: string | null;
  lcHandle: string | null;
  avatarColor: string;
  isCurrentUser: boolean;
  solvedCount: number;
  reviewCount: number;
  totalLogs: number;
  totalAttempts: number;
  accuracyRate: number;
  topTopics: DashboardMemberTopicStat[];
}

export interface DashboardMemberGridProps {
  members: DashboardMemberCardItem[];
  selectedMemberId: string | null;
  periodFilter: PeriodFilterValue;
}

/** Interactive grid of team member cards that switches the dashboard between team and individual tracking. */
export function DashboardMemberGrid({
  members,
  selectedMemberId,
  periodFilter,
}: DashboardMemberGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticMemberId, setOptimisticMemberId] =
    useOptimistic(selectedMemberId);

  const hasSelection = optimisticMemberId !== null;

  function selectMember(nextId: string | null) {
    if (nextId === selectedMemberId) return;
    startTransition(() => {
      setOptimisticMemberId(nextId);
      router.push(buildDashboardHref(periodFilter, nextId), { scroll: false });
    });
  }

  function handleToggleMember(memberId: string) {
    selectMember(memberId === optimisticMemberId ? null : memberId);
  }

  return (
    <section aria-labelledby="members-grid-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Users className="h-5 w-5 text-indigo-400" aria-hidden="true" />
          <h2
            id="members-grid-heading"
            className="text-lg font-semibold tracking-tight text-zinc-100"
          >
            Membros da Equipe
          </h2>
          {isPending ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-indigo-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>Atualizando...</span>
            </span>
          ) : !hasSelection ? (
            <span className="text-xs text-zinc-500">
              Clique em um membro para acompanhar individualmente
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hasSelection ? (
            <button
              type="button"
              onClick={() => selectMember(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-indigo-500/50 hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <X className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
              <span>Ver visão da equipe</span>
            </button>
          ) : null}

          <Link
            href="/membros"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
          >
            <span>Gerenciar equipe & perfil</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => {
          const isSelected = optimisticMemberId === member.id;

          return (
            <article
              key={member.id}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-5 transition-all",
                isSelected
                  ? "border-indigo-500 bg-indigo-500/[0.08] ring-2 ring-indigo-500/35 shadow-lg shadow-indigo-950/30"
                  : hasSelection
                    ? "border-zinc-800/80 bg-zinc-900/50 opacity-75 hover:border-indigo-500/40 hover:bg-zinc-900/85 hover:opacity-100"
                    : cn(
                        "bg-zinc-900/70 hover:border-indigo-500/60 hover:bg-zinc-900",
                        member.isCurrentUser
                          ? "border-indigo-500/40"
                          : "border-zinc-800"
                      )
              )}
            >
              <button
                type="button"
                onClick={() => handleToggleMember(member.id)}
                aria-pressed={isSelected}
                aria-label={
                  isSelected
                    ? `Voltar para a visão da equipe (selecionado: ${member.name})`
                    : `Acompanhar progresso individual de ${member.name}`
                }
                className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              />

              <div className="pointer-events-none relative z-20 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar member={member} size="lg" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-zinc-100">
                          {member.name}
                        </h3>
                        {member.isCurrentUser ? (
                          <span className="shrink-0 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
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
                            className="pointer-events-auto inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-300 transition-colors hover:bg-sky-500/20"
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
                            className="pointer-events-auto inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-300 transition-colors hover:bg-amber-500/20"
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

                  {isSelected ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-400/40 bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      <span>Visualizando</span>
                    </span>
                  ) : null}
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

              {/* Top Topics + Selection Cue */}
              <div className="pointer-events-none relative z-20 mt-4 border-t border-zinc-800/80 pt-3">
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

                <div className="mt-3 flex items-center justify-between border-t border-zinc-800/60 pt-2.5 text-[11px] font-medium">
                  {isSelected ? (
                    <span className="text-indigo-300">
                      Visualizando progresso · clique para ver equipe
                    </span>
                  ) : (
                    <>
                      <span className="text-zinc-500 transition-colors group-hover:text-indigo-300">
                        Ver progresso individual
                      </span>
                      <ArrowUpRight
                        className="h-3.5 w-3.5 text-zinc-500 transition-colors group-hover:text-indigo-300"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
