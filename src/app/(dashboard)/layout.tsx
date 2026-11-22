import { Navbar } from "@/components/Navbar";
import { requireUser } from "@/lib/auth";
import { getCachedUserNavData } from "@/lib/cache";
import type { MemberSummary } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await requireUser();

  const {
    unreadNotifications,
    recentNotifications,
    myReviewCount,
    myPendingProposalsCount,
  } = await getCachedUserNavData(currentUser.id, currentUser.teamId);

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
