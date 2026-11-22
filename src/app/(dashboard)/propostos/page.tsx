import { PropostosClient } from "@/components/PropostosClient";
import { requireTeamMember } from "@/lib/auth";
import { getCachedTeamMembers, getCachedTopics } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import type { MemberSummary, ProposedProblemItem } from "@/types";

export default async function PropostosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; id?: string; member?: string }>;
}) {
  const [params, currentUser] = await Promise.all([
    searchParams,
    requireTeamMember(),
  ]);

  const memberSelect = {
    id: true,
    name: true,
    email: true,
    cfHandle: true,
    lcHandle: true,
    avatarColor: true,
  } as const;

  const topicSelect = {
    id: true,
    name: true,
    slug: true,
    color: true,
  } as const;

  const [proposalsRaw, teamMembers, topics] = await Promise.all([
    prisma.proposedProblem.findMany({
      where: { teamId: currentUser.teamId },
      include: {
        proposer: { select: memberSelect },
        assignee: { select: memberSelect },
        topics: { select: topicSelect, orderBy: { name: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getCachedTeamMembers(currentUser.teamId),
    getCachedTopics(),
  ]);

  const proposals: ProposedProblemItem[] = proposalsRaw.map((p) => ({
    id: p.id,
    proposerId: p.proposerId,
    assigneeId: p.assigneeId,
    title: p.title,
    url: p.url,
    platform: p.platform,
    suggestedDifficulty: p.suggestedDifficulty,
    message: p.message,
    status: p.status,
    resultingLogId: p.resultingLogId,
    viewedAt: p.viewedAt ? p.viewedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    proposer: p.proposer,
    assignee: p.assignee,
    topics: p.topics,
  }));

  const teammates: MemberSummary[] = teamMembers
    .filter((m) => m.id !== currentUser.id)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const currentUserSummary: MemberSummary = {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    cfHandle: currentUser.cfHandle,
    lcHandle: currentUser.lcHandle,
    avatarColor: currentUser.avatarColor,
  };

  const requestedMember = params.member?.trim();
  const initialMemberId =
    requestedMember && teamMembers.some((m) => m.id === requestedMember)
      ? requestedMember
      : "ALL";

  return (
    <PropostosClient
      key={`${params.tab ?? "recebidos"}-${params.id ?? ""}-${initialMemberId}`}
      currentUserId={currentUser.id}
      currentUser={currentUserSummary}
      proposals={proposals}
      members={teamMembers}
      teammates={teammates}
      topics={topics}
      initialTab={params.tab}
      initialMemberId={initialMemberId}
      highlightId={params.id}
    />
  );
}
