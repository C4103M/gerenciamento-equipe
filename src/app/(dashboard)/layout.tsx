import { Navbar } from "@/components/Navbar";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MemberSummary, NotificationItem } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await requireUser();

  const [
    unreadNotifications,
    recentNotificationsRaw,
    myReviewCount,
    myPendingProposalsCount,
  ] = await Promise.all([
    prisma.notification.count({
      where: { userId: currentUser.id, read: false },
    }),
    prisma.notification.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    currentUser.teamId
      ? prisma.problemLog.count({
          where: {
            userId: currentUser.id,
            teamId: currentUser.teamId,
            needsReview: true,
          },
        })
      : Promise.resolve(0),
    currentUser.teamId
      ? prisma.proposedProblem.count({
          where: {
            assigneeId: currentUser.id,
            teamId: currentUser.teamId,
            status: { in: ["PENDENTE", "VISUALIZADO"] },
          },
        })
      : Promise.resolve(0),
  ]);

  const userSummary: MemberSummary = {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    cfHandle: currentUser.cfHandle,
    lcHandle: currentUser.lcHandle,
    avatarColor: currentUser.avatarColor,
    role: currentUser.role,
    teamId: currentUser.teamId,
  };

  const recentNotifications: NotificationItem[] = recentNotificationsRaw.map(
    (n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.read,
      emailSent: n.emailSent,
      proposedProblemId: n.proposedProblemId,
      createdAt: n.createdAt.toISOString(),
    })
  );

  return (
    <Navbar
      user={userSummary}
      team={currentUser.team}
      userRole={currentUser.role}
      unreadNotifications={unreadNotifications}
      recentNotifications={recentNotifications}
      myReviewCount={myReviewCount}
      myPendingProposalsCount={myPendingProposalsCount}
    >
      {children}
    </Navbar>
  );
}
