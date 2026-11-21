"use client";

import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Info,
  RefreshCw,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { NotificationItem } from "@/types";

export interface NotificacoesClientProps {
  notifications: NotificationItem[];
}

/** Client view for the notification center with read/unread states and quick navigation. */
export function NotificacoesClient({ notifications }: NotificacoesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  function handleMarkAllRead() {
    if (unreadCount === 0) return;
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  function handleNotificationClick(notification: NotificationItem) {
    startTransition(async () => {
      if (!notification.read) {
        await markNotificationReadAction(notification.id);
      }
      router.push(notification.link || "/propostos");
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
              <Bell className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Central de Notificações
            </h1>
            {unreadCount > 0 ? (
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-300">
                {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-zinc-400">
            Acompanhe novos problemas propostos pelos colegas e atualizações de
            resolução.
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || isPending}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/15 hover:text-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <CheckCheck className="h-4 w-4 text-indigo-400" aria-hidden="true" />
          <span>Marcar todas como lidas</span>
        </button>
      </div>

      {/* Info Card */}
      <div className="flex items-start gap-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-3.5 text-xs leading-relaxed text-indigo-200">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400"
          aria-hidden="true"
        />
        <p>
          As notificações in-app registram desafios propostos e atualizações de
          status. A arquitetura já está preparada para envio automático por
          e-mail assim que o provedor SMTP/Resend for ativado.
        </p>
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
            <BellOff className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            Nenhuma notificação por enquanto
          </h2>
          <p className="mt-1 max-w-md text-sm text-zinc-400">
            Quando alguém da equipe propor uma questão para você ou atualizar uma
            proposta sua, o aviso aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notification) => {
            const isProposal = notification.type === "PROBLEM_PROPOSED";
            const Icon = isProposal ? Send : RefreshCw;

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                disabled={isPending}
                className={cn(
                  "group flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  !notification.read
                    ? "border-indigo-500/40 bg-indigo-500/10 hover:border-indigo-400/60 hover:bg-indigo-500/15"
                    : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80"
                )}
              >
                <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-indigo-400">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {!notification.read ? (
                    <span
                      className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-indigo-400 ring-2 ring-zinc-950"
                      aria-label="Não lida"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {!notification.read ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-indigo-400"
                          aria-hidden="true"
                        />
                      ) : null}
                      <p
                        className={cn(
                          "truncate text-sm font-semibold",
                          !notification.read
                            ? "text-zinc-100"
                            : "text-zinc-300"
                        )}
                      >
                        {notification.title}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {formatRelativeDate(notification.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-zinc-400">
                    {notification.body}
                  </p>
                </div>

                <ChevronRight
                  className="mt-2 h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
