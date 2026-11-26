"use client";

import type { Difficulty } from "@prisma/client";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Tag,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type BatchCommitSummary,
  commitMemberCodeforcesSyncBatchAction,
  type MemberSyncPreview,
  previewMemberCodeforcesSyncAction,
  type SyncCommitItem,
  type SyncItemAction,
  type SyncPreviewItem,
} from "@/actions/codeforces";
import { MemberAvatar } from "@/components/Badges";
import { TopicSelector } from "@/components/TopicSelector";
import { DIFFICULTY_META } from "@/lib/platform";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { MemberSummary, TopicItem } from "@/types";

export interface CodeforcesSyncModalProps {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  members: MemberSummary[];
  topics: TopicItem[];
}

type SyncStep = "select" | "triage" | "summary";
type TriageTypeFilter =
  | "ALL"
  | "NEW_SOLVED"
  | "NEW_ATTEMPTED"
  | "UPSOLVE_REVIEW"
  | "UPDATE_SOLUTION_LINK"
  | "PROPOSALS";

interface TriageItemState extends SyncPreviewItem {
  selected: boolean;
}

interface MemberExecutionResult {
  memberId: string;
  memberName: string;
  cfHandle: string | null;
  error?: string;
  alreadySyncedCount: number;
  skippedGraceCount: number;
  skippedUnresolvedCount: number;
  summary: BatchCommitSummary;
}

const DIFFICULTIES: Difficulty[] = [
  "FACIL",
  "MEDIO",
  "DIFICIL",
  "MUITO_DIFICIL",
];

const BATCH_COMMIT_SIZE = 40;
const PAGE_SIZE = 30;
const CF_RATE_LIMIT_DELAY_MS = 2100;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function emptyBatchSummary(): BatchCommitSummary {
  return {
    createdSolved: 0,
    createdAttempted: 0,
    upsolvedReview: 0,
    updatedAttempts: 0,
    updatedSolutionLinks: 0,
    proposalsUpdated: 0,
    skippedDuplicates: 0,
  };
}

function mergeBatchSummary(
  target: BatchCommitSummary,
  delta: BatchCommitSummary
): BatchCommitSummary {
  return {
    createdSolved: target.createdSolved + delta.createdSolved,
    createdAttempted: target.createdAttempted + delta.createdAttempted,
    upsolvedReview: target.upsolvedReview + delta.upsolvedReview,
    updatedAttempts: target.updatedAttempts + delta.updatedAttempts,
    updatedSolutionLinks:
      target.updatedSolutionLinks + delta.updatedSolutionLinks,
    proposalsUpdated: target.proposalsUpdated + delta.proposalsUpdated,
    skippedDuplicates: target.skippedDuplicates + delta.skippedDuplicates,
  };
}

function toCommitItem(item: TriageItemState | SyncPreviewItem): SyncCommitItem {
  return {
    externalId: item.externalId,
    title: item.title,
    canonicalUrl: item.canonicalUrl,
    rating: item.rating,
    action: item.action,
    solved: item.solved,
    needsReview: item.needsReview,
    attemptCount: Math.max(1, Math.floor(item.attemptCount || 1)),
    perceivedDifficulty: item.perceivedDifficulty,
    topicIds: item.topicIds,
    activityAt: item.activityAt,
    existingLogId: item.existingLogId,
    notes: item.notes,
    solutionUrl: item.solved ? item.solutionUrl : null,
  };
}

const ACTION_BADGE_META: Record<
  SyncItemAction,
  { label: string; className: string }
> = {
  NEW_SOLVED: {
    label: "Nova AC",
    className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  },
  NEW_ATTEMPTED: {
    label: "Vai p/ Revisão",
    className: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  },
  UPSOLVE_REVIEW: {
    label: "Conclui Revisão",
    className: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  },
  UPDATE_ATTEMPTS: {
    label: "Atualiza Tentativas",
    className: "border-zinc-700 bg-zinc-800/90 text-zinc-200",
  },
  UPDATE_SOLUTION_LINK: {
    label: "Link Resolução",
    className: "border-teal-500/30 bg-teal-500/15 text-teal-300",
  },
  LINK_PROPOSAL: {
    label: "Vincula Proposta",
    className: "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
  },
};

/**
 * Manual Codeforces synchronization modal with per-member checkbox selection,
 * quick triage review, and 1-click batch import.
 */
export function CodeforcesSyncModal({
  open,
  onClose,
  currentUserId,
  members,
  topics,
}: CodeforcesSyncModalProps) {
  if (!open) return null;

  return (
    <CodeforcesSyncContent
      onClose={onClose}
      currentUserId={currentUserId}
      members={members}
      topics={topics}
    />
  );
}

function CodeforcesSyncContent({
  onClose,
  currentUserId,
  members,
  topics,
}: Omit<CodeforcesSyncModalProps, "open">) {
  const router = useRouter();

  const membersWithHandle = useMemo(
    () => members.filter((m) => Boolean(m.cfHandle?.trim())),
    [members]
  );

  const [step, setStep] = useState<SyncStep>("select");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => {
    const me = members.find(
      (m) => m.id === currentUserId && Boolean(m.cfHandle?.trim())
    );
    if (me) return [me.id];
    return membersWithHandle.map((m) => m.id);
  });

  const [scope, setScope] = useState<"all" | "recent200">("all");
  const [includeUnresolved, setIncludeUnresolved] = useState(true);
  const [graceMinutes, setGraceMinutes] = useState<number>(120);

  const [isRunning, setIsRunning] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [previews, setPreviews] = useState<MemberSyncPreview[]>([]);
  const [previewErrors, setPreviewErrors] = useState<
    Array<{ memberId: string; memberName: string; cfHandle: string | null; error: string }>
  >([]);
  const [triageItems, setTriageItems] = useState<TriageItemState[]>([]);
  const [memberFilterId, setMemberFilterId] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<TriageTypeFilter>("ALL");
  const [expandedTopicKey, setExpandedTopicKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [executionResults, setExecutionResults] = useState<
    MemberExecutionResult[]
  >([]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isRunning) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, onClose]);

  const topicMap = useMemo(() => {
    const map = new Map<string, TopicItem>();
    for (const t of topics) {
      map.set(t.id, t);
    }
    return map;
  }, [topics]);

  const allHandlesSelected =
    membersWithHandle.length > 0 &&
    selectedMemberIds.length === membersWithHandle.length;

  function toggleMember(memberId: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  function toggleAllMembersWithHandle() {
    if (allHandlesSelected) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(membersWithHandle.map((m) => m.id));
    }
  }

  async function commitMemberInBatches(
    memberId: string,
    memberName: string,
    itemsToCommit: SyncCommitItem[]
  ): Promise<{ summary: BatchCommitSummary; error?: string }> {
    let combined = emptyBatchSummary();

    if (itemsToCommit.length === 0) {
      const res = await commitMemberCodeforcesSyncBatchAction({
        memberId,
        items: [],
        markSyncedNow: true,
      });
      if (res.error) return { summary: combined, error: res.error };
      return { summary: res.summary ?? combined };
    }

    const totalChunks = Math.ceil(itemsToCommit.length / BATCH_COMMIT_SIZE);
    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const start = chunkIdx * BATCH_COMMIT_SIZE;
      const slice = itemsToCommit.slice(start, start + BATCH_COMMIT_SIZE);
      const isLast = chunkIdx === totalChunks - 1;

      const importedEnd = Math.min(start + slice.length, itemsToCommit.length);
      setProgressText(
        `Importando ${importedEnd}/${itemsToCommit.length} de ${memberName}...`
      );

      const res = await commitMemberCodeforcesSyncBatchAction({
        memberId,
        items: slice,
        markSyncedNow: isLast,
      });

      if (res.error) {
        return { summary: combined, error: res.error };
      }
      if (res.summary) {
        combined = mergeBatchSummary(combined, res.summary);
      }
    }

    return { summary: combined };
  }

  async function handleFetchForTriage() {
    if (selectedMemberIds.length === 0 || isRunning) return;
    setGlobalError(null);
    setIsRunning(true);
    setPreviewErrors([]);

    const selectedMembers = members.filter((m) =>
      selectedMemberIds.includes(m.id)
    );
    const collectedPreviews: MemberSyncPreview[] = [];
    const collectedErrors: Array<{
      memberId: string;
      memberName: string;
      cfHandle: string | null;
      error: string;
    }> = [];

    try {
      for (let i = 0; i < selectedMembers.length; i++) {
        const member = selectedMembers[i];
        if (i > 0) {
          setProgressText(
            `Aguardando limite da API do Codeforces para consultar ${member.name}...`
          );
          await sleep(CF_RATE_LIMIT_DELAY_MS);
        }

        setProgressText(
          `Consultando Codeforces de ${member.name} (${i + 1}/${selectedMembers.length})...`
        );

        const res = await previewMemberCodeforcesSyncAction({
          memberId: member.id,
          scope,
          graceMinutes,
          includeUnresolved,
        });

        if (res.error || !res.preview) {
          collectedErrors.push({
            memberId: member.id,
            memberName: member.name,
            cfHandle: member.cfHandle,
            error: res.error ?? "Falha ao consultar submissões.",
          });
          continue;
        }

        collectedPreviews.push(res.preview);
      }

      if (collectedPreviews.length === 0 && collectedErrors.length > 0) {
        setGlobalError(
          collectedErrors
            .map((e) => `${e.memberName}: ${e.error}`)
            .join(" | ")
        );
        return;
      }

      const flattened: TriageItemState[] = collectedPreviews.flatMap((p) =>
        p.items.map((item) => ({
          ...item,
          selected: true,
        }))
      );

      setPreviews(collectedPreviews);
      setPreviewErrors(collectedErrors);
      setTriageItems(flattened);
      setMemberFilterId("ALL");
      setTypeFilter("ALL");
      setExpandedTopicKey(null);
      setPage(1);
      setStep("triage");
    } catch {
      setGlobalError(
        "Erro inesperado ao consultar submissões do Codeforces."
      );
    } finally {
      setIsRunning(false);
      setProgressText(null);
    }
  }

  async function handleOneClickSync() {
    if (selectedMemberIds.length === 0 || isRunning) return;
    setGlobalError(null);
    setIsRunning(true);

    const selectedMembers = members.filter((m) =>
      selectedMemberIds.includes(m.id)
    );
    const results: MemberExecutionResult[] = [];

    try {
      for (let i = 0; i < selectedMembers.length; i++) {
        const member = selectedMembers[i];
        if (i > 0) {
          setProgressText(
            `Aguardando limite da API do Codeforces para consultar ${member.name}...`
          );
          await sleep(CF_RATE_LIMIT_DELAY_MS);
        }

        setProgressText(
          `Buscando submissões de ${member.name} (${i + 1}/${selectedMembers.length})...`
        );

        const previewRes = await previewMemberCodeforcesSyncAction({
          memberId: member.id,
          scope,
          graceMinutes,
          includeUnresolved,
        });

        if (previewRes.error || !previewRes.preview) {
          results.push({
            memberId: member.id,
            memberName: member.name,
            cfHandle: member.cfHandle,
            error: previewRes.error ?? "Erro ao buscar submissões.",
            alreadySyncedCount: 0,
            skippedGraceCount: 0,
            skippedUnresolvedCount: 0,
            summary: emptyBatchSummary(),
          });
          continue;
        }

        const preview = previewRes.preview;
        const commitItems = preview.items.map(toCommitItem);
        const commitRes = await commitMemberInBatches(
          member.id,
          member.name,
          commitItems
        );

        results.push({
          memberId: member.id,
          memberName: member.name,
          cfHandle: member.cfHandle,
          error: commitRes.error,
          alreadySyncedCount: preview.alreadySyncedCount,
          skippedGraceCount: preview.skippedGraceCount,
          skippedUnresolvedCount: preview.skippedUnresolvedCount,
          summary: commitRes.summary,
        });
      }

      setExecutionResults(results);
      router.refresh();
      setStep("summary");
    } catch {
      setGlobalError(
        "Ocorreu um erro durante a sincronização em lote. Tente novamente."
      );
    } finally {
      setIsRunning(false);
      setProgressText(null);
    }
  }

  async function handleCommitTriage() {
    if (isRunning) return;
    setGlobalError(null);
    setIsRunning(true);

    const results: MemberExecutionResult[] = previewErrors.map((err) => ({
      memberId: err.memberId,
      memberName: err.memberName,
      cfHandle: err.cfHandle,
      error: err.error,
      alreadySyncedCount: 0,
      skippedGraceCount: 0,
      skippedUnresolvedCount: 0,
      summary: emptyBatchSummary(),
    }));

    try {
      for (const preview of previews) {
        const memberSelectedItems = triageItems
          .filter((item) => item.memberId === preview.memberId && item.selected)
          .map(toCommitItem);

        const commitRes = await commitMemberInBatches(
          preview.memberId,
          preview.memberName,
          memberSelectedItems
        );

        results.push({
          memberId: preview.memberId,
          memberName: preview.memberName,
          cfHandle: preview.cfHandle,
          error: commitRes.error,
          alreadySyncedCount: preview.alreadySyncedCount,
          skippedGraceCount: preview.skippedGraceCount,
          skippedUnresolvedCount: preview.skippedUnresolvedCount,
          summary: commitRes.summary,
        });
      }

      setExecutionResults(results);
      router.refresh();
      setStep("summary");
    } catch {
      setGlobalError("Erro ao importar as questões selecionadas.");
    } finally {
      setIsRunning(false);
      setProgressText(null);
    }
  }

  // Triage derived stats and filtering
  const triageStats = useMemo(() => {
    let newSolved = 0;
    let newAttempted = 0;
    let upsolve = 0;
    let solutionLinks = 0;
    let proposals = 0;
    for (const item of triageItems) {
      if (item.action === "NEW_SOLVED") newSolved += 1;
      if (item.action === "NEW_ATTEMPTED") newAttempted += 1;
      if (item.action === "UPSOLVE_REVIEW") upsolve += 1;
      if (item.action === "UPDATE_SOLUTION_LINK") solutionLinks += 1;
      proposals += item.matchingProposals.length;
    }

    const alreadySynced = previews.reduce(
      (sum, p) => sum + p.alreadySyncedCount,
      0
    );
    const graceSkipped = previews.reduce(
      (sum, p) => sum + p.skippedGraceCount,
      0
    );

    return {
      newSolved,
      newAttempted,
      upsolve,
      solutionLinks,
      proposals,
      alreadySynced,
      graceSkipped,
    };
  }, [triageItems, previews]);

  const filteredTriageItems = useMemo(() => {
    return triageItems.filter((item) => {
      if (memberFilterId !== "ALL" && item.memberId !== memberFilterId) {
        return false;
      }
      if (typeFilter === "NEW_SOLVED" && item.action !== "NEW_SOLVED") {
        return false;
      }
      if (typeFilter === "NEW_ATTEMPTED" && item.action !== "NEW_ATTEMPTED") {
        return false;
      }
      if (typeFilter === "UPSOLVE_REVIEW" && item.action !== "UPSOLVE_REVIEW") {
        return false;
      }
      if (
        typeFilter === "UPDATE_SOLUTION_LINK" &&
        item.action !== "UPDATE_SOLUTION_LINK"
      ) {
        return false;
      }
      if (
        typeFilter === "PROPOSALS" &&
        item.matchingProposals.length === 0
      ) {
        return false;
      }
      return true;
    });
  }, [triageItems, memberFilterId, typeFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTriageItems.length / PAGE_SIZE)
  );
  const safePage = Math.min(page, totalPages);
  const paginatedTriageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTriageItems.slice(start, start + PAGE_SIZE);
  }, [filteredTriageItems, safePage]);

  const totalSelectedForImport = useMemo(
    () => triageItems.filter((item) => item.selected).length,
    [triageItems]
  );

  function updateTriageItem(
    key: string,
    patch: Partial<Pick<TriageItemState, "selected" | "perceivedDifficulty" | "attemptCount" | "topicIds" | "notes">>
  ) {
    setTriageItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function setVisibleSelection(selected: boolean) {
    const visibleKeys = new Set(filteredTriageItems.map((i) => i.key));
    setTriageItems((prev) =>
      prev.map((item) =>
        visibleKeys.has(item.key) ? { ...item, selected } : item
      )
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cf-sync-modal-title"
      onClick={() => {
        if (!isRunning) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-300">
              <RefreshCw
                className={cn("h-4 w-4", isRunning && "animate-spin")}
                aria-hidden="true"
              />
            </span>
            <div>
              <h2
                id="cf-sync-modal-title"
                className="text-lg font-semibold tracking-tight text-zinc-100"
              >
                Sincronizar Codeforces
              </h2>
              <p className="text-xs text-zinc-400">
                {step === "select"
                  ? "Selecione os membros da equipe para buscar submissões sob demanda."
                  : step === "triage"
                    ? "Revise as questões novas, ajuste dificuldades, tentativas ou notas antes de importar."
                    : "Resumo da sincronização realizada."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            aria-label="Fechar modal de sincronização"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {globalError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{globalError}</span>
            </div>
          ) : null}

          {isRunning && progressText ? (
            <div className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-300" />
              <span>{progressText}</span>
            </div>
          ) : null}

          {/* STEP 1: Select Team Members */}
          {step === "select" ? (
            <div className="space-y-5">
              {/* Members Checklist */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <Users
                      className="h-4 w-4 text-sky-400"
                      aria-hidden="true"
                    />
                    <span>Membros da equipe</span>
                  </span>

                  {membersWithHandle.length > 0 ? (
                    <button
                      type="button"
                      onClick={toggleAllMembersWithHandle}
                      disabled={isRunning}
                      className="rounded-md px-2 py-1 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/15 hover:text-indigo-200 disabled:opacity-50"
                    >
                      {allHandlesSelected
                        ? "Limpar seleção"
                        : "Selecionar todos com handle"}
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {members.map((member) => {
                    const hasHandle = Boolean(member.cfHandle?.trim());
                    const checked =
                      hasHandle && selectedMemberIds.includes(member.id);
                    const isMe = member.id === currentUserId;

                    return (
                      <label
                        key={member.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors",
                          !hasHandle
                            ? "cursor-not-allowed border-zinc-800/70 bg-zinc-950/40 opacity-65"
                            : checked
                              ? "cursor-pointer border-sky-500/60 bg-sky-500/10"
                              : "cursor-pointer border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!hasHandle || isRunning}
                            onChange={() => toggleMember(member.id)}
                            className="h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 text-sky-500 focus:ring-sky-500 focus:ring-offset-0 disabled:opacity-40"
                          />
                          <MemberAvatar member={member} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium text-zinc-100">
                                {member.name}
                              </span>
                              {isMe ? (
                                <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                                  Você
                                </span>
                              ) : null}
                            </div>

                            {hasHandle ? (
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                <span className="font-mono text-sky-300">
                                  CF: {member.cfHandle}
                                </span>
                                {member.cfLastSyncedAt ? (
                                  <span className="text-[11px] text-zinc-500">
                                    · sync{" "}
                                    {formatRelativeDate(member.cfLastSyncedAt)}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-zinc-500">
                                    · nunca sincronizado
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                                <span>Sem handle Codeforces</span>
                                {isMe ? (
                                  <Link
                                    href="/perfil"
                                    onClick={onClose}
                                    className="font-medium text-indigo-400 underline hover:text-indigo-300"
                                  >
                                    Configurar
                                  </Link>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Sync Configuration */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="block text-xs font-semibold tracking-wide text-zinc-300 uppercase">
                    Alcance das submissões
                  </span>
                  <div className="flex flex-col gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-200">
                      <input
                        type="radio"
                        name="cf-scope"
                        checked={scope === "all"}
                        onChange={() => setScope("all")}
                        disabled={isRunning}
                        className="border-zinc-700 bg-zinc-950 text-sky-500 focus:ring-sky-500"
                      />
                      <span>
                        Todo o histórico (Global){" "}
                        <span className="text-zinc-500">
                          — ideal na 1ª sync
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-200">
                      <input
                        type="radio"
                        name="cf-scope"
                        checked={scope === "recent200"}
                        onChange={() => setScope("recent200")}
                        disabled={isRunning}
                        className="border-zinc-700 bg-zinc-950 text-sky-500 focus:ring-sky-500"
                      />
                      <span>Últimas 200 submissões (mais rápido)</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <span className="block text-xs font-semibold tracking-wide text-zinc-300 uppercase">
                    Regras para não resolvidas
                  </span>
                  <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={includeUnresolved}
                      onChange={(e) => setIncludeUnresolved(e.target.checked)}
                      disabled={isRunning}
                      className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-sky-500 focus:ring-sky-500"
                    />
                    <span>
                      Importar tentadas sem AC (WA/TLE/RE) para a Lista de
                      Revisão
                    </span>
                  </label>

                  {includeUnresolved ? (
                    <div className="flex items-center gap-2 pl-6">
                      <label
                        htmlFor="cf-grace-select"
                        className="text-xs text-zinc-400"
                      >
                        Carência após última submissão:
                      </label>
                      <select
                        id="cf-grace-select"
                        value={graceMinutes}
                        onChange={(e) =>
                          setGraceMinutes(Number(e.target.value))
                        }
                        disabled={isRunning}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
                      >
                        <option value={120}>2 horas (padrão)</option>
                        <option value={60}>1 hora</option>
                        <option value={0}>Sem carência</option>
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* STEP 2: Quick Triage */}
          {step === "triage" ? (
            <div className="space-y-4">
              {previewErrors.length > 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  <p className="font-semibold">
                    Alguns membros não puderam ser consultados:
                  </p>
                  <ul className="mt-1 list-disc pl-4">
                    {previewErrors.map((err) => (
                      <li key={err.memberId}>
                        <strong>{err.memberName}:</strong> {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* KPI Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                  <strong>{triageStats.newSolved}</strong> novas AC
                </span>
                <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                  <strong>{triageStats.newAttempted}</strong> p/ revisão
                </span>
                <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300">
                  <strong>{triageStats.upsolve}</strong> upsolvings
                </span>
                {triageStats.solutionLinks > 0 ? (
                  <span className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs text-teal-300">
                    <strong>{triageStats.solutionLinks}</strong> links de
                    resolução
                  </span>
                ) : null}
                <span className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-300">
                  <strong>{triageStats.proposals}</strong> baixas em propostas
                </span>
                <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-400">
                  {triageStats.alreadySynced} já sincronizadas
                </span>
                {triageStats.graceSkipped > 0 ? (
                  <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-400">
                    {triageStats.graceSkipped} em carência
                  </span>
                ) : null}
              </div>

              {triageItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-10 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Tudo em dia!
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    Nenhuma questão nova ou revisão pendente encontrada para os
                    membros selecionados.
                  </p>
                </div>
              ) : (
                <>
                  {/* Triage Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {previews.length > 1 ? (
                        <select
                          value={memberFilterId}
                          onChange={(e) => {
                            setMemberFilterId(e.target.value);
                            setPage(1);
                          }}
                          aria-label="Filtrar triagem por membro"
                          className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
                        >
                          <option value="ALL">Todos os membros</option>
                          {previews.map((p) => (
                            <option key={p.memberId} value={p.memberId}>
                              {p.memberName} ({p.items.length})
                            </option>
                          ))}
                        </select>
                      ) : null}

                      <select
                        value={typeFilter}
                        onChange={(e) => {
                          setTypeFilter(e.target.value as TriageTypeFilter);
                          setPage(1);
                        }}
                        aria-label="Filtrar triagem por tipo"
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
                      >
                        <option value="ALL">Todos os tipos</option>
                        <option value="NEW_SOLVED">Novas AC</option>
                        <option value="NEW_ATTEMPTED">Para Revisão</option>
                        <option value="UPSOLVE_REVIEW">
                          Upsolving de Revisão
                        </option>
                        <option value="UPDATE_SOLUTION_LINK">
                          Link de Resolução
                        </option>
                        <option value="PROPOSALS">Com Proposta</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVisibleSelection(true)}
                        disabled={isRunning}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        Selecionar visíveis
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibleSelection(false)}
                        disabled={isRunning}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                      >
                        Desmarcar visíveis
                      </button>
                    </div>
                  </div>

                  {/* Triage List */}
                  <div className="space-y-2.5">
                    {paginatedTriageItems.map((item) => {
                      const actionMeta = ACTION_BADGE_META[item.action];
                      const isTopicsExpanded = expandedTopicKey === item.key;
                      const resolvedTopics = item.topicIds
                        .map((id) => topicMap.get(id))
                        .filter((t): t is TopicItem => Boolean(t));

                      return (
                        <div
                          key={item.key}
                          className={cn(
                            "space-y-3 rounded-xl border p-3.5 transition-colors",
                            item.selected
                              ? "border-zinc-700 bg-zinc-950/80"
                              : "border-zinc-800/60 bg-zinc-950/35 opacity-60"
                          )}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={(e) =>
                                  updateTriageItem(item.key, {
                                    selected: e.target.checked,
                                  })
                                }
                                disabled={isRunning}
                                aria-label={`Selecionar ${item.title}`}
                                className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 text-indigo-500 focus:ring-indigo-500"
                              />
                              <div className="min-w-0 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <a
                                    href={item.canonicalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-100 hover:text-sky-300"
                                  >
                                    <span className="truncate">{item.title}</span>
                                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                                  </a>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                                    {item.memberName}
                                  </span>

                                  <span
                                    className={cn(
                                      "rounded-md border px-2 py-0.5 text-[11px] font-medium",
                                      actionMeta.className
                                    )}
                                  >
                                    {actionMeta.label}
                                  </span>

                                  {item.rating ? (
                                    <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] text-sky-300">
                                      CF {item.rating}
                                    </span>
                                  ) : null}

                                  {item.solved && item.solutionUrl ? (
                                    <a
                                      href={item.solutionUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
                                    >
                                      <span>Submissão CF</span>
                                      <ExternalLink
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                    </a>
                                  ) : null}

                                  <span className="text-[11px] text-zinc-500">
                                    {formatRelativeDate(item.activityAt)}
                                  </span>
                                </div>

                                {item.matchingProposals.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.matchingProposals.map((p) => (
                                      <span
                                        key={p.proposalId}
                                        className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-200"
                                      >
                                        <Send className="h-3 w-3" />
                                        <span>
                                          Baixa proposta de {p.proposerName} →{" "}
                                          {p.targetStatus}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {/* Per-row quick editors */}
                            <div className="flex flex-wrap items-center gap-2 pl-7 sm:shrink-0 sm:pl-0">
                              <select
                                value={item.perceivedDifficulty}
                                onChange={(e) =>
                                  updateTriageItem(item.key, {
                                    perceivedDifficulty: e.target
                                      .value as Difficulty,
                                  })
                                }
                                disabled={!item.selected || isRunning}
                                aria-label={`Dificuldade de ${item.title}`}
                                className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                              >
                                {DIFFICULTIES.map((diff) => (
                                  <option key={diff} value={diff}>
                                    {DIFFICULTY_META[diff].label}
                                  </option>
                                ))}
                              </select>

                              <label className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
                                <span className="text-[11px] text-zinc-400">
                                  Tentativas:
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={999}
                                  value={item.attemptCount}
                                  onChange={(e) => {
                                    const val = Number.parseInt(
                                      e.target.value,
                                      10
                                    );
                                    updateTriageItem(item.key, {
                                      attemptCount:
                                        Number.isFinite(val) && val >= 1
                                          ? val
                                          : 1,
                                    });
                                  }}
                                  disabled={!item.selected || isRunning}
                                  className="w-12 bg-transparent text-center font-mono text-xs font-semibold text-zinc-100 focus:outline-none"
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedTopicKey((prev) =>
                                    prev === item.key ? null : item.key
                                  )
                                }
                                disabled={!item.selected || isRunning}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                                  isTopicsExpanded
                                    ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                                )}
                              >
                                <Tag className="h-3 w-3" />
                                <span>{resolvedTopics.length} tópicos</span>
                              </button>
                            </div>
                          </div>

                          {/* Topic Pills Preview + Quick Note */}
                          <div className="flex flex-col gap-2 pl-7 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-1">
                              {resolvedTopics.map((topic) => (
                                <span
                                  key={topic.id}
                                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-zinc-200"
                                  style={{
                                    borderColor: `${topic.color}40`,
                                    backgroundColor: `${topic.color}15`,
                                  }}
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: topic.color }}
                                  />
                                  {topic.name}
                                </span>
                              ))}
                            </div>

                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) =>
                                updateTriageItem(item.key, {
                                  notes: e.target.value,
                                })
                              }
                              disabled={!item.selected || isRunning}
                              placeholder="Nota rápida opcional..."
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none sm:w-64"
                            />
                          </div>

                          {isTopicsExpanded ? (
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 pl-7">
                              <TopicSelector
                                allTopics={topics}
                                selectedIds={item.topicIds}
                                onChange={(nextIds) =>
                                  updateTriageItem(item.key, {
                                    topicIds: nextIds,
                                  })
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 ? (
                    <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-400">
                      <span>
                        Página {safePage} de {totalPages} (
                        {filteredTriageItems.length} itens)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          Anterior
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={safePage >= totalPages}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                        >
                          Próxima
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {/* STEP 3: Summary */}
          {step === "summary" ? (
            <div className="space-y-4">
              {executionResults.map((res) => (
                <div
                  key={res.memberId}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-zinc-100">
                        {res.memberName}
                      </h3>
                      {res.cfHandle ? (
                        <span className="font-mono text-xs text-sky-300">
                          ({res.cfHandle})
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-zinc-500">
                      {res.alreadySyncedCount} já sincronizadas
                    </span>
                  </div>

                  {res.error ? (
                    <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                      {res.error}
                    </p>
                  ) : (
                    <div
                      className={cn(
                        "mt-3 grid grid-cols-2 gap-2 text-center",
                        res.summary.updatedSolutionLinks > 0
                          ? "sm:grid-cols-6"
                          : "sm:grid-cols-5"
                      )}
                    >
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
                        <p className="text-lg font-bold text-emerald-400">
                          {res.summary.createdSolved}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          AC importadas
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
                        <p className="text-lg font-bold text-amber-400">
                          {res.summary.createdAttempted}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          P/ revisão
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
                        <p className="text-lg font-bold text-sky-400">
                          {res.summary.upsolvedReview}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          Upsolvings
                        </p>
                      </div>
                      {res.summary.updatedSolutionLinks > 0 ? (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
                          <p className="text-lg font-bold text-teal-400">
                            {res.summary.updatedSolutionLinks}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            Links atualiz.
                          </p>
                        </div>
                      ) : null}
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
                        <p className="text-lg font-bold text-indigo-400">
                          {res.summary.proposalsUpdated}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          Propostas
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
                        <p className="text-lg font-bold text-zinc-200">
                          {res.summary.updatedAttempts}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          Tentativas atual.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900/95 px-6 py-4">
          {step === "select" ? (
            <>
              <span className="text-xs text-zinc-400">
                {selectedMemberIds.length}{" "}
                {selectedMemberIds.length === 1
                  ? "membro selecionado"
                  : "membros selecionados"}
              </span>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isRunning}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => void handleOneClickSync()}
                  disabled={selectedMemberIds.length === 0 || isRunning}
                  className="inline-flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" aria-hidden="true" />
                  <span>Sincronizar em 1 clique</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleFetchForTriage()}
                  disabled={selectedMemberIds.length === 0 || isRunning}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>Buscar para Triagem</span>
                </button>
              </div>
            </>
          ) : step === "triage" ? (
            <>
              <button
                type="button"
                onClick={() => setStep("select")}
                disabled={isRunning}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isRunning}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleCommitTriage()}
                  disabled={isRunning}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Importando...</span>
                    </>
                  ) : totalSelectedForImport > 0 ? (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      <span>
                        Importar {totalSelectedForImport}{" "}
                        {totalSelectedForImport === 1
                          ? "selecionada"
                          : "selecionadas"}
                      </span>
                    </>
                  ) : (
                    <span>Concluir sem importar</span>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-zinc-400">
                Sincronização concluída manualmente.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
