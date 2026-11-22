"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

export async function markNotificationReadAction(id: string): Promise<void> {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });

  updateTag(CACHE_TAGS.userNav(user.id));
  revalidatePath("/notificacoes");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });

  updateTag(CACHE_TAGS.userNav(user.id));
  revalidatePath("/notificacoes");
}
