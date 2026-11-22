import {
  AdminClient,
  type AdminTeamItem,
  type AdminUserItem,
} from "@/components/AdminClient";
import { requireGlobalAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const admin = await requireGlobalAdmin();

  const [teamsRaw, usersRaw, logsAgg] = await Promise.all([
    prisma.team.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        members: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            teamId: true,
            cfHandle: true,
            lcHandle: true,
            avatarColor: true,
            emailVerifiedAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            proposedProblems: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        cfHandle: true,
        lcHandle: true,
        avatarColor: true,
        emailVerifiedAt: true,
        createdAt: true,
        team: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.problemLog.groupBy({
      by: ["teamId", "solved", "needsReview"],
      _count: { _all: true },
    }),
  ]);

  const statsByTeamId = new Map<
    string,
    { totalLogs: number; solvedLogs: number; reviewLogs: number }
  >();
  for (const row of logsAgg) {
    const current = statsByTeamId.get(row.teamId) ?? {
      totalLogs: 0,
      solvedLogs: 0,
      reviewLogs: 0,
    };
    const count = row._count._all;
    current.totalLogs += count;
    if (row.solved) current.solvedLogs += count;
    if (row.needsReview) current.reviewLogs += count;
    statsByTeamId.set(row.teamId, current);
  }

  const teams: AdminTeamItem[] = teamsRaw.map((team) => {
    const teamStats = statsByTeamId.get(team.id) ?? {
      totalLogs: 0,
      solvedLogs: 0,
      reviewLogs: 0,
    };

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      inviteCode: team.inviteCode,
      description: team.description,
      maxMembers: team.maxMembers,
      createdAt: team.createdAt.toISOString(),
      members: team.members.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        teamId: member.teamId,
        teamName: team.name,
        cfHandle: member.cfHandle,
        lcHandle: member.lcHandle,
        avatarColor: member.avatarColor,
        emailVerifiedAt: member.emailVerifiedAt
          ? member.emailVerifiedAt.toISOString()
          : null,
        createdAt: member.createdAt.toISOString(),
      })),
      stats: {
        totalLogs: teamStats.totalLogs,
        solvedLogs: teamStats.solvedLogs,
        reviewLogs: teamStats.reviewLogs,
        proposalsCount: team._count.proposedProblems,
      },
    };
  });

  const users: AdminUserItem[] = usersRaw.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: user.teamId,
    teamName: user.team?.name ?? null,
    cfHandle: user.cfHandle,
    lcHandle: user.lcHandle,
    avatarColor: user.avatarColor,
    emailVerifiedAt: user.emailVerifiedAt
      ? user.emailVerifiedAt.toISOString()
      : null,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <AdminClient
      currentAdminId={admin.id}
      currentAdminTeamId={admin.teamId}
      teams={teams}
      users={users}
    />
  );
}
