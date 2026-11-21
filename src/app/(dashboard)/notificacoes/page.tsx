import { NotificacoesClient } from "@/components/NotificacoesClient";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NotificationItem } from "@/types";

export default async function NotificacoesPage() {
  const currentUser = await requireUser();

  const notificationsRaw = await prisma.notification.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  const notifications: NotificationItem[] = notificationsRaw.map((n) => ({
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
  }));

  return <NotificacoesClient notifications={notifications} />;
}
