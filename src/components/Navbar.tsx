"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Code2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  RotateCcw,
  Send,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { logoutAction } from "@/actions/auth";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";
import { MemberAvatar } from "@/components/Badges";
import { IcpcBalloonsMark, IcpcTricolorBar } from "@/components/IcpcLogo";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { MemberSummary, NotificationItem, TeamSummary } from "@/types";

export interface NavbarProps {
  user: MemberSummary;
  team: TeamSummary | null;
  userRole: UserRole;
  unreadNotifications: number;
  recentNotifications: NotificationItem[];
  myReviewCount: number;
  myPendingProposalsCount: number;
  children: React.ReactNode;
}

interface NavItemConfig {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeTone?: "indigo" | "amber" | "rose";
  dividerAfter?: boolean;
}

const BADGE_TONE_CLASSES = {
  indigo: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  rose: "bg-rose-500/20 text-rose-300 border-rose-500/30",
} as const;

export function Navbar({
  user,
  team,
  userRole,
  unreadNotifications,
  recentNotifications,
  myReviewCount,
  myPendingProposalsCount,
  children,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isLoggingOut, startLogout] = useTransition();
  const [isUpdatingNotif, startNotifTransition] = useTransition();
  const notifContainerRef = useRef<HTMLDivElement>(null);

  const brandName = team ? team.name : "Nunca Foi ICPC";
  const isGlobalAdmin = userRole === "GLOBAL_ADMIN";
  const homeHref = team ? "/" : isGlobalAdmin ? "/admin" : "/sem-equipe";
  const profileHref = "/perfil";

  const navItems: NavItemConfig[] = [
    ...(isGlobalAdmin
      ? [
          {
            href: "/admin",
            label: "Admin Global",
            icon: ShieldCheck,
            dividerAfter: team !== null,
          },
        ]
      : []),
    ...(team !== null
      ? [
          { href: "/", label: "Dashboard", icon: LayoutDashboard },
          { href: "/questoes", label: "Questões", icon: Code2 },
          {
            href: "/revisao",
            label: "Lista de Revisão",
            icon: RotateCcw,
            badge: myReviewCount,
            badgeTone: "amber" as const,
          },
          {
            href: "/propostos",
            label: "Problemas Propostos",
            icon: Send,
            badge: myPendingProposalsCount,
            badgeTone: "indigo" as const,
          },
          { href: "/membros", label: "Equipe", icon: Users },
        ]
      : []),
    {
      href: "/notificacoes",
      label: "Notificações",
      icon: Bell,
      badge: unreadNotifications,
      badgeTone: "rose",
    },
    {
      href: "/perfil",
      label: "Meu Perfil",
      icon: UserCog,
    },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notifContainerRef.current &&
        !notifContainerRef.current.contains(event.target as Node)
      ) {
        setNotifOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotifOpen(false);
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function isActivePath(href: string): boolean {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleNotificationClick(notification: NotificationItem) {
    setNotifOpen(false);
    startNotifTransition(async () => {
      if (!notification.read) {
        await markNotificationReadAction(notification.id);
      }
      router.push(notification.link || "/notificacoes");
    });
  }

  function handleMarkAllRead() {
    startNotifTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  function handleLogout() {
    startLogout(async () => {
      await logoutAction();
    });
  }

  function renderNavLinks(onNavigate?: () => void) {
    return (
      <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(item.href);
          const showBadge = typeof item.badge === "number" && item.badge > 0;
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30"
                    : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active
                        ? "text-indigo-400"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {showBadge && (
                  <span
                    className={cn(
                      "inline-flex min-w-[1.35rem] items-center justify-center rounded-full border px-1.5 py-0.5 font-mono text-[11px] font-semibold",
                      BADGE_TONE_CLASSES[item.badgeTone ?? "indigo"]
                    )}
                  >
                    {item.badge! > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
              {item.dividerAfter && (
                <div className="my-2 border-t border-zinc-800/80" />
              )}
            </div>
          );
        })}
      </nav>
    );
  }

  function renderSidebarFooter() {
    return (
      <div className="border-t border-zinc-800/80 p-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-900/70 px-2.5 py-2">
          <Link
            href={profileHref}
            onClick={() => setMobileMenuOpen(false)}
            className="flex min-w-0 items-center gap-2.5 hover:opacity-90"
          >
            <MemberAvatar member={user} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-100">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Sair"
            aria-label="Sair da conta"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-red-400 disabled:opacity-50"
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    );
  }

  function renderBrandLink(onNavigate?: () => void) {
    return (
      <Link
        href={homeHref}
        onClick={onNavigate}
        className="flex min-w-0 items-center gap-2.5"
      >
        <IcpcBalloonsMark size="sm" />
        <div className="min-w-0">
          <span className="block truncate font-mono text-sm font-bold tracking-tight text-zinc-100">
            {brandName}
          </span>
          {team !== null && (
            <span className="block truncate font-mono text-[10px] text-zinc-500">
              Nunca Foi ICPC
            </span>
          )}
          {isGlobalAdmin && (
            <span className="mt-0.5 inline-flex items-center rounded border border-pink-500/30 bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-pink-300">
              Admin Global
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-zinc-800/80 lg:bg-zinc-900/50">
        <IcpcTricolorBar />
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-zinc-800/80 px-5">
          {renderBrandLink()}
        </div>
        {renderNavLinks()}
        {renderSidebarFooter()}
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-72 max-w-[85vw] flex-col border-r border-zinc-800 bg-zinc-950 shadow-2xl">
            <IcpcTricolorBar />
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-4">
              {renderBrandLink(() => setMobileMenuOpen(false))}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNavLinks(() => setMobileMenuOpen(false))}
            {renderSidebarFooter()}
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 shrink-0 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
          <IcpcTricolorBar />
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link
                href={homeHref}
                className="flex min-w-0 items-center gap-2 lg:hidden"
              >
                <IcpcBalloonsMark size="sm" />
                <span className="truncate font-mono text-sm font-bold text-zinc-100">
                  {brandName}
                </span>
                {isGlobalAdmin && (
                  <span className="hidden shrink-0 items-center rounded border border-pink-500/30 bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-pink-300 sm:inline-flex">
                    Admin Global
                  </span>
                )}
              </Link>
            </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification Bell Popover */}
            <div ref={notifContainerRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notificações"
                aria-expanded={notifOpen}
                className={cn(
                  "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100",
                  notifOpen && "border-indigo-500/50 bg-zinc-800 text-zinc-100"
                )}
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[10px] font-bold text-white shadow">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/60 sm:w-96">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-100">
                        Notificações
                      </span>
                      {unreadNotifications > 0 && (
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-rose-300">
                          {unreadNotifications} nova
                          {unreadNotifications > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {unreadNotifications > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        disabled={isUpdatingNotif}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 transition hover:text-indigo-300 disabled:opacity-50"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Marcar lidas
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 divide-y divide-zinc-800/70 overflow-y-auto">
                    {recentNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-zinc-500">
                        Nenhuma notificação recente.
                      </div>
                    ) : (
                      recentNotifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleNotificationClick(n)}
                          disabled={isUpdatingNotif}
                          className={cn(
                            "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-zinc-800/60",
                            !n.read && "bg-indigo-500/5"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                              n.read ? "bg-zinc-700" : "bg-indigo-400"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p
                                className={cn(
                                  "truncate text-xs font-semibold",
                                  n.read ? "text-zinc-300" : "text-zinc-100"
                                )}
                              >
                                {n.title}
                              </p>
                              <span className="shrink-0 text-[11px] text-zinc-500">
                                {formatRelativeDate(n.createdAt)}
                              </span>
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
                              {n.body}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="border-t border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-center">
                    <Link
                      href="/notificacoes"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs font-medium text-indigo-400 transition hover:text-indigo-300"
                    >
                      Ver todas as notificações
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User summary + Logout */}
            <Link
              href={profileHref}
              title="Meu Perfil — Editar dados e senha"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-indigo-500/40 hover:bg-zinc-800"
            >
              <MemberAvatar member={user} size="sm" />
              <span className="hidden max-w-[140px] truncate sm:inline">{user.name}</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sair"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 px-2.5 text-xs font-medium text-zinc-300 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
            >
              {isLoggingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
