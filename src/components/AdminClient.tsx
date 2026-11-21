"use client";

import type { UserRole } from "@prisma/client";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Dices,
  ExternalLink,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  type AdminVerificationResult,
  assignUserTeamAction,
  createTeamAction,
  createTeamMemberByAdminAction,
  deleteTeamAction,
  resendVerificationAction,
  toggleUserRoleAction,
  updateTeamAction,
} from "@/actions/admin";
import { MemberAvatar } from "@/components/Badges";
import { cn, formatRelativeDate } from "@/lib/utils";

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string | null;
  teamName: string | null;
  cfHandle: string | null;
  lcHandle: string | null;
  avatarColor: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface AdminTeamItem {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  description: string | null;
  maxMembers: number;
  createdAt: string;
  members: AdminUserItem[];
  stats: {
    totalLogs: number;
    solvedLogs: number;
    reviewLogs: number;
    proposalsCount: number;
  };
}

export interface AdminClientProps {
  currentAdminId: string;
  currentAdminTeamId: string | null;
  teams: AdminTeamItem[];
  users: AdminUserItem[];
}

const AVATAR_COLOR_PRESETS = [
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#10b981", label: "Esmeralda" },
  { hex: "#f59e0b", label: "Âmbar" },
  { hex: "#ec4899", label: "Rosa" },
  { hex: "#06b6d4", label: "Ciano" },
  { hex: "#8b5cf6", label: "Violeta" },
] as const;

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
    code += INVITE_CODE_ALPHABET[idx];
  }
  return code;
}

/** Global System Administrator Panel client interface for managing teams, members, and roles. */
export function AdminClient({
  currentAdminId,
  currentAdminTeamId,
  teams,
  users,
}: AdminClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [verificationPreview, setVerificationPreview] = useState<{
    email: string;
    code: string;
    activationUrl: string;
    isResend?: boolean;
  } | null>(null);
  const [copiedPreviewField, setCopiedPreviewField] = useState<
    "code" | "url" | null
  >(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null);
  const [confirmDeleteTeamId, setConfirmDeleteTeamId] = useState<string | null>(
    null
  );

  // Team create/edit modal state
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<AdminTeamItem | null>(null);

  // Add member / new user modal state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberModalInitialTeamId, setMemberModalInitialTeamId] =
    useState<string>("");
  const [memberModalInitialRole, setMemberModalInitialRole] =
    useState<UserRole>("MEMBER");

  const globalAdminCount = users.filter(
    (u) => u.role === "GLOBAL_ADMIN"
  ).length;
  const unassignedCount = users.filter((u) => !u.teamId).length;
  const totalLogsAllTeams = teams.reduce(
    (sum, t) => sum + t.stats.totalLogs,
    0
  );
  const totalSolvedAllTeams = teams.reduce(
    (sum, t) => sum + t.stats.solvedLogs,
    0
  );
  const totalProposalsAllTeams = teams.reduce(
    (sum, t) => sum + t.stats.proposalsCount,
    0
  );

  function openCreateTeamModal() {
    setEditingTeam(null);
    setTeamModalOpen(true);
  }

  function openEditTeamModal(team: AdminTeamItem) {
    setEditingTeam(team);
    setTeamModalOpen(true);
  }

  function openCreateUserModal() {
    setMemberModalInitialTeamId("");
    setMemberModalInitialRole("MEMBER");
    setMemberModalOpen(true);
  }

  function openAddTeamMemberModal(team: AdminTeamItem) {
    setMemberModalInitialTeamId(team.id);
    setMemberModalInitialRole("MEMBER");
    setMemberModalOpen(true);
  }

  async function handleCopyInviteCode(teamId: string, inviteCode: string) {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedTeamId(teamId);
      window.setTimeout(() => {
        setCopiedTeamId((prev) => (prev === teamId ? null : prev));
      }, 2000);
    } catch {
      setFeedback({
        type: "error",
        message: "Não foi possível copiar o código de convite automaticamente.",
      });
    }
  }

  async function handleCopyPreviewField(
    field: "code" | "url",
    value: string
  ) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPreviewField(field);
      window.setTimeout(() => {
        setCopiedPreviewField((prev) => (prev === field ? null : prev));
      }, 2000);
    } catch {
      setFeedback({
        type: "error",
        message: "Não foi possível copiar para a área de transferência.",
      });
    }
  }

  function handleVerificationFeedback(
    res: AdminVerificationResult,
    email: string,
    options?: { isResend?: boolean }
  ) {
    if (res.emailSent) {
      setVerificationPreview(null);
      setFeedback({
        type: "success",
        message: options?.isResend
          ? `Novo código e link de ativação enviados para ${email}.`
          : `Usuário cadastrado! Código e link de ativação enviados para ${email}.`,
      });
      return;
    }

    if (res.devPreview) {
      setFeedback(null);
      setCopiedPreviewField(null);
      setVerificationPreview({
        email: res.devPreview.email,
        code: res.devPreview.code,
        activationUrl: res.devPreview.activationUrl,
        isResend: options?.isResend,
      });
      return;
    }

    if (res.emailError) {
      setVerificationPreview(null);
      setFeedback({
        type: "error",
        message: res.emailError,
      });
      return;
    }

    setVerificationPreview(null);
    setFeedback({
      type: "success",
      message: options?.isResend
        ? `Código de verificação reenviado para ${email}.`
        : `Usuário cadastrado (${email}).`,
    });
  }

  function handleResendVerification(user: AdminUserItem, key: string) {
    setFeedback(null);
    setBusyKey(key);
    startTransition(async () => {
      try {
        const res = await resendVerificationAction(user.id);
        if (res.error) {
          setFeedback({ type: "error", message: res.error });
          return;
        }
        handleVerificationFeedback(res, user.email, { isResend: true });
        router.refresh();
      } catch {
        setFeedback({
          type: "error",
          message: "Erro ao reenviar código de verificação. Tente novamente.",
        });
      } finally {
        setBusyKey(null);
      }
    });
  }

  function handleAssignTeam(
    userId: string,
    teamId: string | null,
    key: string,
    options?: { redirectHome?: boolean; successMessage?: string }
  ) {
    setFeedback(null);
    setBusyKey(key);
    startTransition(async () => {
      try {
        const result = await assignUserTeamAction(userId, teamId);
        if (result.error) {
          setFeedback({ type: "error", message: result.error });
          return;
        }
        if (options?.successMessage) {
          setFeedback({ type: "success", message: options.successMessage });
        }
        if (options?.redirectHome) {
          router.push("/");
        }
        router.refresh();
      } catch {
        setFeedback({
          type: "error",
          message: "Erro ao atualizar a equipe do usuário. Tente novamente.",
        });
      } finally {
        setBusyKey(null);
      }
    });
  }

  function handleDeleteTeam(team: AdminTeamItem) {
    setFeedback(null);
    setBusyKey(`delete-${team.id}`);
    startTransition(async () => {
      try {
        const result = await deleteTeamAction(team.id);
        if (result.error) {
          setFeedback({ type: "error", message: result.error });
          return;
        }
        setConfirmDeleteTeamId(null);
        setFeedback({
          type: "success",
          message: `Equipe "${team.name}" excluída com sucesso.`,
        });
        router.refresh();
      } catch {
        setFeedback({
          type: "error",
          message: "Erro ao excluir a equipe. Tente novamente.",
        });
      } finally {
        setBusyKey(null);
      }
    });
  }

  function handleToggleRole(user: AdminUserItem) {
    const nextRole: UserRole =
      user.role === "GLOBAL_ADMIN" ? "MEMBER" : "GLOBAL_ADMIN";
    setFeedback(null);
    setBusyKey(`role-${user.id}`);
    startTransition(async () => {
      try {
        const result = await toggleUserRoleAction(user.id, nextRole);
        if (result.error) {
          setFeedback({ type: "error", message: result.error });
          return;
        }
        setFeedback({
          type: "success",
          message:
            nextRole === "GLOBAL_ADMIN"
              ? `${user.name} promovido(a) a Administrador Global.`
              : `${user.name} alterado(a) para Membro.`,
        });
        router.refresh();
      } catch {
        setFeedback({
          type: "error",
          message: "Erro ao alterar permissão do usuário. Tente novamente.",
        });
      } finally {
        setBusyKey(null);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <h1 className="font-mono text-2xl font-bold tracking-tight text-zinc-100">
              Painel do Administrador Global
            </h1>
          </div>
          <p className="text-sm text-zinc-400">
            Gerencie múltiplas equipes de programação competitiva, códigos de
            convite, alocação de integrantes e permissões globais do sistema.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={openCreateUserModal}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 shadow-sm transition-colors hover:border-indigo-500/40 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <UserPlus className="h-4 w-4 text-indigo-400" aria-hidden="true" />
            <span>+ Novo Usuário</span>
          </button>

          <button
            type="button"
            onClick={openCreateTeamModal}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>+ Nova Equipe</span>
          </button>
        </div>
      </header>

      {/* Inline Feedback Banner */}
      {feedback ? (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            feedback.type === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          )}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "error" ? (
              <AlertCircle
                className="h-4 w-4 shrink-0 text-rose-400"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-emerald-400"
                aria-hidden="true"
              />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Fechar aviso"
            className="rounded-lg p-1 text-current/70 transition-colors hover:bg-white/10 hover:text-current"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Dev Email Verification Preview Banner */}
      {verificationPreview ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900/90 to-indigo-500/10 p-5 text-sm text-zinc-200 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-300">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-amber-200">
                    Preview de Ativação (E-mail não configurado no .env)
                  </h3>
                  {verificationPreview.isResend ? (
                    <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                      Código reenviado
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-zinc-400">
                  Destinatário:{" "}
                  <strong className="font-mono text-zinc-100">
                    {verificationPreview.email}
                  </strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setVerificationPreview(null)}
              aria-label="Fechar preview de ativação"
              className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* 6-digit verification code */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
              <div>
                <span className="block text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                  Código de verificação (6 dígitos)
                </span>
                <span className="font-mono text-lg font-bold tracking-[0.25em] text-amber-300">
                  {verificationPreview.code}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  void handleCopyPreviewField(
                    "code",
                    verificationPreview.code
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-amber-500/40 hover:bg-zinc-800"
              >
                {copiedPreviewField === "code" ? (
                  <>
                    <Check
                      className="h-3.5 w-3.5 text-emerald-400"
                      aria-hidden="true"
                    />
                    <span className="text-emerald-300">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copiar código</span>
                  </>
                )}
              </button>
            </div>

            {/* Activation URL */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                  Link de ativação
                </span>
                <p className="truncate font-mono text-xs text-indigo-300">
                  {verificationPreview.activationUrl}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyPreviewField(
                      "url",
                      verificationPreview.activationUrl
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-indigo-500/40 hover:bg-zinc-800"
                >
                  {copiedPreviewField === "url" ? (
                    <>
                      <Check
                        className="h-3.5 w-3.5 text-emerald-400"
                        aria-hidden="true"
                      />
                      <span className="text-emerald-300">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copiar link</span>
                    </>
                  )}
                </button>
                <a
                  href={verificationPreview.activationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/25"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Abrir página /ativar</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4 Global KPI Cards */}
      <section
        aria-label="Indicadores globais"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          label="Equipes Cadastradas"
          value={teams.length}
          subtitle={`${teams.filter((t) => t.members.length > 0).length} com integrantes`}
          icon={Building2}
          accentClass="text-indigo-400 bg-indigo-500/15 border-indigo-500/30"
        />
        <KpiCard
          label="Usuários Totais"
          value={users.length}
          subtitle={`${globalAdminCount} admin global • ${unassignedCount} sem equipe`}
          icon={Users}
          accentClass="text-sky-400 bg-sky-500/15 border-sky-500/30"
        />
        <KpiCard
          label="Questões Registradas"
          value={totalLogsAllTeams}
          subtitle={`${totalSolvedAllTeams} resolvidas em todas as equipes`}
          icon={Code2}
          accentClass="text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
        />
        <KpiCard
          label="Propostas Registradas"
          value={totalProposalsAllTeams}
          subtitle="Indicações entre colegas"
          icon={Send}
          accentClass="text-amber-400 bg-amber-500/15 border-amber-500/30"
        />
      </section>

      {/* Teams Grid */}
      <section aria-labelledby="admin-teams-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2
              id="admin-teams-heading"
              className="text-lg font-semibold tracking-tight text-zinc-100"
            >
              Equipes ({teams.length})
            </h2>
            <p className="text-xs text-zinc-400">
              Visualize a ocupação, convites e membros de cada equipe, ou acesse
              uma equipe para navegar no dashboard dela.
            </p>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
            <Building2
              className="mb-3 h-10 w-10 text-zinc-600"
              aria-hidden="true"
            />
            <h3 className="text-base font-semibold text-zinc-200">
              Nenhuma equipe cadastrada
            </h3>
            <p className="mt-1 max-w-md text-xs text-zinc-400">
              Crie sua primeira equipe para gerar um código de convite e
              começar a alocar integrantes.
            </p>
            <button
              type="button"
              onClick={openCreateTeamModal}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Criar primeira equipe</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {teams.map((team) => {
              const isCurrentAdminTeam = currentAdminTeamId === team.id;
              const isFull =
                team.maxMembers > 0 && team.members.length >= team.maxMembers;
              const isConfirmingDelete = confirmDeleteTeamId === team.id;
              const isDeleting =
                isPending && busyKey === `delete-${team.id}`;
              const isAccessing =
                isPending && busyKey === `access-${team.id}`;

              return (
                <article
                  key={team.id}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border bg-zinc-900/70 p-6 transition-colors",
                    isCurrentAdminTeam
                      ? "border-indigo-500/50"
                      : "border-zinc-800"
                  )}
                >
                  <div className="space-y-4">
                    {/* Team Top Info */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-zinc-100">
                            {team.name}
                          </h3>
                          {isCurrentAdminTeam ? (
                            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                              Equipe ativa
                            </span>
                          ) : null}
                        </div>
                        {team.description ? (
                          <p className="text-xs text-zinc-400">
                            {team.description}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-500 italic">
                            Sem descrição cadastrada.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            isFull
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              : "border-zinc-700 bg-zinc-950/70 text-zinc-300"
                          )}
                        >
                          <Users className="h-3 w-3" aria-hidden="true" />
                          <span>
                            {team.members.length} / {team.maxMembers} membros
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Invite Code & Team Stats */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                          Convite:
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyInviteCode(team.id, team.inviteCode)
                          }
                          title="Copiar código de convite"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-indigo-300 transition-colors hover:bg-indigo-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <span>{team.inviteCode}</span>
                          {copiedTeamId === team.id ? (
                            <>
                              <Check
                                className="h-3.5 w-3.5 text-emerald-400"
                                aria-hidden="true"
                              />
                              <span className="font-sans text-[11px] text-emerald-300">
                                Copiado!
                              </span>
                            </>
                          ) : (
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2
                            className="h-3.5 w-3.5 text-emerald-400"
                            aria-hidden="true"
                          />
                          <strong className="text-zinc-200">
                            {team.stats.solvedLogs}
                          </strong>{" "}
                          resolvidas
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <RotateCcw
                            className="h-3.5 w-3.5 text-amber-400"
                            aria-hidden="true"
                          />
                          <strong className="text-zinc-200">
                            {team.stats.reviewLogs}
                          </strong>{" "}
                          revisão
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Send
                            className="h-3.5 w-3.5 text-indigo-400"
                            aria-hidden="true"
                          />
                          <strong className="text-zinc-200">
                            {team.stats.proposalsCount}
                          </strong>{" "}
                          propostas
                        </span>
                      </div>
                    </div>

                    {/* Member Roster */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                        <span>Integrantes</span>
                        <span>Criada {formatRelativeDate(team.createdAt)}</span>
                      </div>

                      {team.members.length === 0 ? (
                        <p className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3.5 py-3 text-xs text-zinc-500">
                          Nenhum integrante nesta equipe ainda.
                        </p>
                      ) : (
                        <ul className="divide-y divide-zinc-800/70 rounded-xl border border-zinc-800/80 bg-zinc-950/50">
                          {team.members.map((member) => {
                            const removingKey = `remove-${team.id}-${member.id}`;
                            const resendKey = `resend-team-${team.id}-${member.id}`;
                            const isRemoving =
                              isPending && busyKey === removingKey;
                            const isResending =
                              isPending && busyKey === resendKey;

                            return (
                              <li
                                key={member.id}
                                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <MemberAvatar member={member} size="sm" />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="truncate text-sm font-medium text-zinc-200">
                                        {member.name}
                                      </span>
                                      {member.role === "GLOBAL_ADMIN" ? (
                                        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                                          Admin Global
                                        </span>
                                      ) : null}
                                      <VerificationStatusBadge
                                        emailVerifiedAt={member.emailVerifiedAt}
                                      />
                                    </div>
                                    <p className="truncate text-xs text-zinc-500">
                                      {member.email}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-1.5">
                                  {!member.emailVerifiedAt ? (
                                    <button
                                      type="button"
                                      disabled={isPending}
                                      onClick={() =>
                                        handleResendVerification(
                                          member,
                                          resendKey
                                        )
                                      }
                                      title={`Reenviar código de verificação para ${member.email}`}
                                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isResending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Mail
                                          className="h-3.5 w-3.5"
                                          aria-hidden="true"
                                        />
                                      )}
                                      <span className="hidden sm:inline">
                                        Reenviar código
                                      </span>
                                    </button>
                                  ) : null}

                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() =>
                                      handleAssignTeam(
                                        member.id,
                                        null,
                                        removingKey,
                                        {
                                          successMessage: `${member.name} removido(a) da equipe "${team.name}".`,
                                        }
                                      )
                                    }
                                    title={`Remover ${member.name} da equipe`}
                                    aria-label={`Remover ${member.name} da equipe`}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isRemoving ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <UserMinus className="h-3.5 w-3.5" />
                                    )}
                                    <span className="hidden sm:inline">
                                      Remover
                                    </span>
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Team Actions Row */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAddTeamMemberModal(team)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-200"
                      >
                        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>+ Membro</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditTeamModal(team)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Editar</span>
                      </button>

                      {isCurrentAdminTeam ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleAssignTeam(
                              currentAdminId,
                              null,
                              `access-${team.id}`,
                              {
                                successMessage: `Você saiu da equipe "${team.name}".`,
                              }
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isAccessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>Sair da Equipe</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleAssignTeam(
                              currentAdminId,
                              team.id,
                              `access-${team.id}`,
                              { redirectHome: true }
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isAccessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRight
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )}
                          <span>Acessar Equipe</span>
                        </button>
                      )}
                    </div>

                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDeleteTeam(team)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>Confirmar</span>
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setConfirmDeleteTeamId(null)}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setConfirmDeleteTeamId(team.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Usuários & Permissões Section */}
      <section aria-labelledby="admin-users-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="admin-users-heading"
              className="text-lg font-semibold tracking-tight text-zinc-100"
            >
              Usuários &amp; Permissões ({users.length})
            </h2>
            <p className="text-xs text-zinc-400">
              Altere a equipe vinculada de qualquer usuário ou gerencie o papel
              de Administrador Global.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
          {users.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-400">
              Nenhum usuário cadastrado no sistema.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800/80">
              {users.map((user) => {
                const isSelf = user.id === currentAdminId;
                const isGlobalAdmin = user.role === "GLOBAL_ADMIN";
                const disableDemoteSelf =
                  isGlobalAdmin && globalAdminCount <= 1;
                const isRoleUpdating =
                  isPending && busyKey === `role-${user.id}`;
                const isTeamUpdating =
                  isPending && busyKey === `user-team-${user.id}`;
                const resendKey = `resend-user-${user.id}`;
                const isResending = isPending && busyKey === resendKey;

                return (
                  <div
                    key={user.id}
                    className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-zinc-900/90 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar member={user} size="md" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-zinc-100">
                            {user.name}
                          </span>
                          {isSelf ? (
                            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                              Você
                            </span>
                          ) : null}
                          <VerificationStatusBadge
                            emailVerifiedAt={user.emailVerifiedAt}
                          />
                          <span className="text-[11px] text-zinc-500">
                            • entrou {formatRelativeDate(user.createdAt)}
                          </span>
                        </div>
                        <p className="truncate text-xs text-zinc-400">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {!user.emailVerifiedAt ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleResendVerification(user, resendKey)
                          }
                          title={`Reenviar código de verificação para ${user.email}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isResending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>Reenviar código</span>
                        </button>
                      ) : null}
                      {/* Team Selector */}
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`user-team-${user.id}`}
                          className="sr-only"
                        >
                          Equipe de {user.name}
                        </label>
                        <select
                          id={`user-team-${user.id}`}
                          value={user.teamId ?? ""}
                          disabled={isPending}
                          onChange={(e) => {
                            const nextTeamId = e.target.value || null;
                            handleAssignTeam(
                              user.id,
                              nextTeamId,
                              `user-team-${user.id}`,
                              {
                                successMessage: nextTeamId
                                  ? `Equipe de ${user.name} atualizada.`
                                  : `${user.name} desvinculado(a) de equipe.`,
                              }
                            );
                          }}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Sem equipe</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.members.length}/{t.maxMembers})
                            </option>
                          ))}
                        </select>
                        {isTeamUpdating ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin text-indigo-400"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>

                      {/* Role Toggle Button */}
                      <button
                        type="button"
                        disabled={isPending || disableDemoteSelf}
                        onClick={() => handleToggleRole(user)}
                        title={
                          disableDemoteSelf
                            ? "O sistema precisa manter pelo menos 1 Administrador Global."
                            : isGlobalAdmin
                              ? "Alterar para Membro"
                              : "Promover a Administrador Global"
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
                          isGlobalAdmin
                            ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25"
                            : "border-zinc-700 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800"
                        )}
                      >
                        {isRoleUpdating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isGlobalAdmin ? (
                          <ShieldCheck
                            className="h-3.5 w-3.5 text-indigo-400"
                            aria-hidden="true"
                          />
                        ) : (
                          <Shield
                            className="h-3.5 w-3.5 text-zinc-400"
                            aria-hidden="true"
                          />
                        )}
                        <span>
                          {isGlobalAdmin ? "GLOBAL_ADMIN" : "MEMBER"}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Create / Edit Team Modal */}
      {teamModalOpen ? (
        <TeamFormModal
          key={editingTeam?.id ?? "new-team"}
          initialTeam={editingTeam}
          onClose={() => setTeamModalOpen(false)}
          onSuccess={(message) => {
            setTeamModalOpen(false);
            setFeedback({ type: "success", message });
            router.refresh();
          }}
        />
      ) : null}

      {/* Add Member / New User Modal */}
      {memberModalOpen ? (
        <AddMemberModal
          key={`${memberModalInitialTeamId || "no-team"}-${memberModalInitialRole}`}
          teams={teams}
          initialTeamId={memberModalInitialTeamId}
          initialRole={memberModalInitialRole}
          onClose={() => setMemberModalOpen(false)}
          onSuccess={(res, submittedEmail) => {
            setMemberModalOpen(false);
            handleVerificationFeedback(res, submittedEmail, { isResend: false });
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function VerificationStatusBadge({
  emailVerifiedAt,
}: {
  emailVerifiedAt: string | null;
}) {
  if (emailVerifiedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        <span>Verificado</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
      <Clock className="h-3 w-3" aria-hidden="true" />
      <span>Aguardando ativação</span>
    </span>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  accentClass,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <span
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg border",
            accentClass
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-zinc-100">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
    </div>
  );
}

function TeamFormModal({
  initialTeam,
  onClose,
  onSuccess,
}: {
  initialTeam: AdminTeamItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const isEditing = Boolean(initialTeam);
  const [name, setName] = useState(initialTeam?.name ?? "");
  const [inviteCode, setInviteCode] = useState(
    initialTeam?.inviteCode ?? generateInviteCode()
  );
  const [maxMembers, setMaxMembers] = useState<number>(
    initialTeam?.maxMembers ?? 3
  );
  const [description, setDescription] = useState(
    initialTeam?.description ?? ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("O nome da equipe deve ter pelo menos 2 caracteres.");
      return;
    }
    if (inviteCode.trim().length < 3) {
      setError("O código de convite deve ter pelo menos 3 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        inviteCode: inviteCode.trim().toUpperCase(),
        maxMembers: Number.isFinite(maxMembers) ? maxMembers : 3,
        description: description.trim() || undefined,
      };

      const result = initialTeam
        ? await updateTeamAction(initialTeam.id, payload)
        : await createTeamAction(payload);

      if (result.error) {
        setError(result.error);
        return;
      }

      onSuccess(
        isEditing
          ? `Equipe "${payload.name}" atualizada com sucesso.`
          : `Equipe "${payload.name}" criada com sucesso.`
      );
    } catch {
      setError("Ocorreu um erro ao salvar a equipe. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-modal-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2
              id="team-modal-title"
              className="text-lg font-semibold tracking-tight text-zinc-100"
            >
              {isEditing ? "Editar Equipe" : "+ Nova Equipe"}
            </h2>
            <p className="text-xs text-zinc-400">
              {isEditing
                ? "Atualize os dados, capacidade ou código de convite da equipe."
                : "Configure uma nova equipe e seu código de acesso."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar modal"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label
                htmlFor="team-name"
                className="block text-sm font-medium text-zinc-200"
              >
                Nome da equipe <span className="text-rose-400">*</span>
              </label>
              <input
                id="team-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Nunca Foi Sort()"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="team-invite-code"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Código de convite <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="team-invite-code"
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) =>
                      setInviteCode(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "")
                      )
                    }
                    placeholder="EX: ICPC26"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 font-mono text-sm text-zinc-100 uppercase placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setInviteCode(generateInviteCode())}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                  >
                    <Dices className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Gerar código</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="team-max-members"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Máx. membros
                </label>
                <input
                  id="team-max-members"
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={maxMembers}
                  onChange={(e) =>
                    setMaxMembers(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="team-description"
                className="block text-sm font-medium text-zinc-200"
              >
                Descrição <span className="text-xs text-zinc-500">(opcional)</span>
              </label>
              <textarea
                id="team-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Equipe titular para a Maratona SBC / ICPC"
                className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>{isEditing ? "Salvar alterações" : "Criar equipe"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddMemberModal({
  teams,
  initialTeamId,
  initialRole,
  onClose,
  onSuccess,
}: {
  teams: AdminTeamItem[];
  initialTeamId: string;
  initialRole: UserRole;
  onClose: () => void;
  onSuccess: (res: AdminVerificationResult, email: string) => void;
}) {
  const [memberTeamId, setMemberTeamId] = useState<string>(initialTeamId);
  const [memberRole, setMemberRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cfHandle, setCfHandle] = useState("");
  const [lcHandle, setLcHandle] = useState("");
  const [avatarColor, setAvatarColor] = useState<string>(
    AVATAR_COLOR_PRESETS[0].hex
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTeam = teams.find((t) => t.id === memberTeamId) ?? null;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("Nome deve ter pelo menos 2 caracteres.");
      return;
    }
    if (!email.trim().includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await createTeamMemberByAdminAction({
        teamId: memberTeamId || null,
        role: memberRole,
        name: name.trim(),
        email: normalizedEmail,
        cfHandle: cfHandle.trim() || undefined,
        lcHandle: lcHandle.trim() || undefined,
        avatarColor,
      });

      if (res.error) {
        setError(res.error);
        return;
      }

      onSuccess(res, normalizedEmail);
    } catch {
      setError("Ocorreu um erro ao cadastrar o usuário. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-modal-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2
              id="add-member-modal-title"
              className="text-lg font-semibold tracking-tight text-zinc-100"
            >
              Adicionar Membro / Novo Usuário
            </h2>
            <p className="text-xs text-zinc-400">
              {selectedTeam ? (
                <>
                  Equipe:{" "}
                  <strong className="text-zinc-200">{selectedTeam.name}</strong>{" "}
                  ({selectedTeam.members.length}/{selectedTeam.maxMembers}{" "}
                  membros)
                </>
              ) : (
                "Cadastre um usuário sem equipe ou vincule a uma equipe existente."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar modal"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-3 text-xs leading-relaxed text-indigo-200">
              <Mail
                className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400"
                aria-hidden="true"
              />
              <span>
                O usuário receberá um código de verificação de 6 dígitos e um
                link de ativação por e-mail para validar a conta e criar a
                própria senha.
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="member-team"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Equipe
                </label>
                <select
                  id="member-team"
                  value={memberTeamId}
                  onChange={(e) => setMemberTeamId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                >
                  <option value="">Sem equipe</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.members.length}/{t.maxMembers})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="member-role"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Papel no sistema
                </label>
                <select
                  id="member-role"
                  value={memberRole}
                  onChange={(e) =>
                    setMemberRole(
                      e.target.value === "GLOBAL_ADMIN"
                        ? "GLOBAL_ADMIN"
                        : "MEMBER"
                    )
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                >
                  <option value="MEMBER">Membro</option>
                  <option value="GLOBAL_ADMIN">Administrador Global</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="member-name"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Nome completo <span className="text-rose-400">*</span>
                </label>
                <input
                  id="member-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Ana Beatriz"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="member-email"
                  className="block text-sm font-medium text-zinc-200"
                >
                  E-mail <span className="text-rose-400">*</span>
                </label>
                <input
                  id="member-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="membro@equipe.dev"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="member-cf-handle"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Codeforces Handle{" "}
                  <span className="text-xs text-zinc-500">(opcional)</span>
                </label>
                <input
                  id="member-cf-handle"
                  type="text"
                  value={cfHandle}
                  onChange={(e) => setCfHandle(e.target.value)}
                  placeholder="ex: tourist"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="member-lc-handle"
                  className="block text-sm font-medium text-zinc-200"
                >
                  LeetCode Handle{" "}
                  <span className="text-xs text-zinc-500">(opcional)</span>
                </label>
                <input
                  id="member-lc-handle"
                  type="text"
                  value={lcHandle}
                  onChange={(e) => setLcHandle(e.target.value)}
                  placeholder="ex: neal_wu"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-zinc-200">
                Cor do avatar
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                {AVATAR_COLOR_PRESETS.map((preset) => {
                  const selected = avatarColor === preset.hex;
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setAvatarColor(preset.hex)}
                      aria-label={`Selecionar cor ${preset.label}`}
                      aria-pressed={selected}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        selected
                          ? "border-white ring-2 ring-indigo-500/40"
                          : "border-transparent opacity-80 hover:opacity-100"
                      )}
                      style={{ backgroundColor: preset.hex }}
                    >
                      {selected ? (
                        <Check className="h-4 w-4 text-white" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Cadastrar membro</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
