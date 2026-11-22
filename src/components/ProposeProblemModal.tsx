"use client";

import type { Difficulty } from "@prisma/client";
import {
  Bookmark,
  Check,
  Link2,
  Loader2,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { lookupCodeforcesProblemAction } from "@/actions/codeforces";
import { proposeProblemAction } from "@/actions/proposals";
import { MemberAvatar, PlatformBadge } from "@/components/Badges";
import { TopicSelector } from "@/components/TopicSelector";
import { parseCodeforcesRef } from "@/lib/codeforces";
import { DIFFICULTY_META, detectPlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";
import type { MemberSummary, TopicItem } from "@/types";

export interface ProposeProblemModalProps {
  open: boolean;
  onClose: () => void;
  teammates: MemberSummary[];
  topics: TopicItem[];
  currentUser?: MemberSummary;
  defaultSelfOnly?: boolean;
}

const SUGGESTED_DIFFICULTY_OPTIONS: Array<{
  value: Difficulty | null;
  label: string;
  activeClass: string;
}> = [
  {
    value: null,
    label: "Nenhum",
    activeClass: "border-indigo-500/50 bg-indigo-500/15 text-indigo-200",
  },
  {
    value: "FACIL",
    label: DIFFICULTY_META.FACIL.label,
    activeClass: DIFFICULTY_META.FACIL.className,
  },
  {
    value: "MEDIO",
    label: DIFFICULTY_META.MEDIO.label,
    activeClass: DIFFICULTY_META.MEDIO.className,
  },
  {
    value: "DIFICIL",
    label: DIFFICULTY_META.DIFICIL.label,
    activeClass: DIFFICULTY_META.DIFICIL.className,
  },
  {
    value: "MUITO_DIFICIL",
    label: DIFFICULTY_META.MUITO_DIFICIL.label,
    activeClass: DIFFICULTY_META.MUITO_DIFICIL.className,
  },
];

/** Modal dialog for proposing a problem to teammates or saving one for yourself. */
export function ProposeProblemModal({
  open,
  onClose,
  teammates,
  topics,
  currentUser,
  defaultSelfOnly = false,
}: ProposeProblemModalProps) {
  if (!open) return null;

  return (
    <ProposeProblemContent
      onClose={onClose}
      teammates={teammates}
      topics={topics}
      currentUser={currentUser}
      defaultSelfOnly={defaultSelfOnly}
    />
  );
}

function ProposeProblemContent({
  onClose,
  teammates,
  topics,
  currentUser,
  defaultSelfOnly = false,
}: Omit<ProposeProblemModalProps, "open">) {
  const router = useRouter();

  const [assigneeIds, setAssigneeIds] = useState<string[]>(() =>
    defaultSelfOnly && currentUser ? [currentUser.id] : []
  );
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [suggestedDifficulty, setSuggestedDifficulty] =
    useState<Difficulty | null>(null);
  const [cfRating, setCfRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isLookingUpCf, setIsLookingUpCf] = useState(false);
  const [cfLookupStatus, setCfLookupStatus] = useState<{
    type: "success" | "error";
    text: string;
    tags?: string[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastAutoLookedUpRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupSeqRef = useRef(0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isSubmitting, onClose]);

  const trimmedUrl = url.trim();
  const cfRef = trimmedUrl ? parseCodeforcesRef(trimmedUrl) : null;
  const detectedPlatform = cfRef
    ? "CODEFORCES"
    : trimmedUrl
      ? detectPlatform(trimmedUrl)
      : null;

  async function performCfLookup(rawInput: string, force: boolean) {
    const parsed = parseCodeforcesRef(rawInput);
    if (!parsed) return;

    if (!force && lastAutoLookedUpRef.current === parsed.externalId) {
      return;
    }

    lastAutoLookedUpRef.current = parsed.externalId;
    const seq = ++lookupSeqRef.current;
    setIsLookingUpCf(true);
    setCfLookupStatus(null);

    try {
      const result = await lookupCodeforcesProblemAction(rawInput);
      if (lookupSeqRef.current !== seq) return;

      if (result.error || !result.data) {
        setCfLookupStatus({
          type: "error",
          text:
            result.error ?? "Não foi possível carregar dados do Codeforces.",
        });
        return;
      }

      const data = result.data;
      setTitle(data.title);
      setUrl(data.canonicalUrl);
      setCfRating(data.rating);
      if (data.matchedTopicIds.length > 0) {
        setTopicIds(data.matchedTopicIds);
      }
      if (data.suggestedDifficulty) {
        setSuggestedDifficulty(data.suggestedDifficulty);
      }

      const ratingPart = data.rating
        ? `Rating ${data.rating}`
        : "Sem rating oficial";
      setCfLookupStatus({
        type: "success",
        text: `Autopreenchido via Codeforces · ${ratingPart}`,
        tags: data.rawTags,
      });
    } catch {
      if (lookupSeqRef.current !== seq) return;
      setCfLookupStatus({
        type: "error",
        text: "Erro de comunicação ao consultar o Codeforces.",
      });
    } finally {
      if (lookupSeqRef.current === seq) {
        setIsLookingUpCf(false);
      }
    }
  }

  function handleUrlChange(nextValue: string) {
    setUrl(nextValue);
    setCfLookupStatus(null);

    const parsed = parseCodeforcesRef(nextValue);
    if (!parsed) {
      setCfRating(null);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void performCfLookup(nextValue, false);
    }, 450);
  }

  function handleUrlPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    const parsed = parseCodeforcesRef(pasted);
    if (parsed) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      void performCfLookup(pasted, false);
    }
  }
  const selectableMembers = currentUser
    ? [currentUser, ...teammates]
    : teammates;
  const allSelected =
    selectableMembers.length > 0 &&
    assigneeIds.length === selectableMembers.length;
  const isSelfOnly = Boolean(
    currentUser &&
      assigneeIds.length === 1 &&
      assigneeIds[0] === currentUser.id
  );

  function toggleTeammate(memberId: string) {
    setAssigneeIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  function handleSelectAllToggle() {
    if (allSelected) {
      setAssigneeIds([]);
    } else {
      setAssigneeIds(selectableMembers.map((m) => m.id));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (assigneeIds.length === 0) {
      setError("Selecione pelo menos 1 membro da equipe para propor.");
      return;
    }
    if (title.trim().length < 2) {
      setError("Informe o título da questão (mínimo de 2 caracteres).");
      return;
    }
    if (!trimmedUrl) {
      setError("Informe o link da questão (Codeforces, LeetCode, etc.).");
      return;
    }
    if (topicIds.length === 0) {
      setError("Selecione pelo menos 1 tópico.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await proposeProblemAction({
        assigneeIds,
        title,
        url,
        topicIds,
        suggestedDifficulty,
        message,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError("Não foi possível enviar a proposta. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="propose-modal-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2
              id="propose-modal-title"
              className="text-lg font-semibold tracking-tight text-zinc-100"
            >
              {isSelfOnly
                ? "Salvar Questão para Depois"
                : "Propor Questão para a Equipe"}
            </h2>
            <p className="text-xs text-zinc-400">
              {isSelfOnly
                ? "Salve uma questão na sua fila pessoal para resolver mais tarde."
                : "Indique um problema relevante para seus colegas treinarem."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar modal"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
              >
                {error}
              </div>
            ) : null}

            {/* Teammates Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
                  <Users
                    className="h-4 w-4 text-indigo-400"
                    aria-hidden="true"
                  />
                  <span>
                    Para quem enviar? <span className="text-rose-400">*</span>
                  </span>
                </span>
                {selectableMembers.length > 1 ? (
                  <button
                    type="button"
                    onClick={handleSelectAllToggle}
                    className="rounded-md px-2 py-1 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/15 hover:text-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {allSelected ? "Limpar seleção" : "Selecionar todos"}
                  </button>
                ) : null}
              </div>

              {selectableMembers.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selectableMembers.map((member) => {
                    const isSelf = Boolean(
                      currentUser && member.id === currentUser.id
                    );
                    const checked = assigneeIds.includes(member.id);
                    const handles = [
                      member.cfHandle ? `CF: ${member.cfHandle}` : null,
                      member.lcHandle ? `LC: ${member.lcHandle}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <label
                        key={member.id}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
                          checked
                            ? isSelf
                              ? "border-amber-500/60 bg-amber-500/10"
                              : "border-indigo-500/60 bg-indigo-500/10"
                            : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTeammate(member.id)}
                          className="sr-only"
                        />
                        <div className="flex min-w-0 items-center gap-3">
                          <MemberAvatar member={member} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-medium text-zinc-100">
                                {isSelf ? "Você (Para fazer depois)" : member.name}
                              </p>
                              {isSelf ? (
                                <Bookmark
                                  className="h-3.5 w-3.5 shrink-0 text-amber-400"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </div>
                            <p className="truncate text-xs text-zinc-400">
                              {isSelf
                                ? "Fila pessoal · sem notificação"
                                : handles || member.email}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                            checked
                              ? isSelf
                                ? "border-amber-500 bg-amber-500 text-zinc-950"
                                : "border-indigo-500 bg-indigo-500 text-white"
                              : "border-zinc-700 bg-zinc-900 text-transparent"
                          )}
                          aria-hidden="true"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-400">
                  Nenhum membro disponível na equipe no momento.
                </div>
              )}
            </div>

            {/* URL or CF code + Instant Autofill */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="propose-url"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Link ou código da questão{" "}
                  <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  {cfRef ? (
                    <button
                      type="button"
                      onClick={() => void performCfLookup(trimmedUrl, true)}
                      disabled={isLookingUpCf || isSubmitting}
                      className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
                    >
                      {isLookingUpCf ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {isLookingUpCf ? "Buscando CF..." : "Preencher do CF"}
                      </span>
                    </button>
                  ) : null}
                  {detectedPlatform ? (
                    <PlatformBadge platform={detectedPlatform} />
                  ) : null}
                </div>
              </div>
              <div className="relative">
                <Link2
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id="propose-url"
                  type="text"
                  inputMode="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onPaste={handleUrlPaste}
                  placeholder="Cole link do CF/CSES/LeetCode ou digite 1800E2..."
                  required
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pr-3.5 pl-10 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              {isLookingUpCf ? (
                <p className="flex items-center gap-1.5 text-xs text-sky-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Consultando dados da questão no Codeforces...</span>
                </p>
              ) : cfLookupStatus ? (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs",
                    cfLookupStatus.type === "success"
                      ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  )}
                >
                  <p className="font-medium">{cfLookupStatus.text}</p>
                  {cfLookupStatus.tags && cfLookupStatus.tags.length > 0 ? (
                    <p className="mt-1 text-[11px] text-sky-300/80">
                      Tags CF: {cfLookupStatus.tags.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Dica: cole um link do Codeforces ou digite só o código (ex:{" "}
                  <span className="font-mono text-zinc-400">1800E2</span>) para
                  preencher título, tópicos e dificuldade sugerida.
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label
                htmlFor="propose-title"
                className="block text-sm font-medium text-zinc-200"
              >
                Título da questão <span className="text-rose-400">*</span>
              </label>
              <input
                id="propose-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: CF 1800E2 - Unforgivable Curse (hard version)"
                required
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            {/* Topics */}
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-zinc-200">
                Tópicos <span className="text-rose-400">*</span>
              </span>
              <TopicSelector
                allTopics={topics}
                selectedIds={topicIds}
                onChange={setTopicIds}
              />
            </div>

            {/* Suggested Difficulty (optional) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="block text-sm font-medium text-zinc-200">
                  Dificuldade sugerida{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    (opcional)
                  </span>
                </span>
                {cfRating ? (
                  <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-300">
                    CF {cfRating}
                  </span>
                ) : null}
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Dificuldade sugerida"
              >
                {SUGGESTED_DIFFICULTY_OPTIONS.map((option) => {
                  const active = suggestedDifficulty === option.value;
                  return (
                    <button
                      key={option.value ?? "none"}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSuggestedDifficulty(option.value)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        active
                          ? cn(option.activeClass, "ring-1 ring-current/40")
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label
                htmlFor="propose-message"
                className="block text-sm font-medium text-zinc-200"
              >
                Recado ou dica{" "}
                <span className="text-xs font-normal text-zinc-500">
                  (opcional)
                </span>
              </label>
              <textarea
                id="propose-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  isSelfOnly
                    ? "Lembrete ou anotação para quando for resolver (ex: 'Treinar DP com bitmask')..."
                    : "Recado ou dica opcional para os colegas (ex: 'Boa para treinar SegTree lazy!')..."
                }
                className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900/95 px-6 py-4">
            <span className="text-xs text-zinc-400">
              {isSelfOnly
                ? "Salvo na sua fila pessoal"
                : assigneeIds.length > 0
                  ? `${assigneeIds.length} ${assigneeIds.length === 1 ? "membro selecionado" : "membros selecionados"}`
                  : "Selecione ao menos 1 membro"}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isSelfOnly ? "Salvando..." : "Enviando..."}</span>
                  </>
                ) : isSelfOnly ? (
                  <>
                    <Bookmark className="h-4 w-4" />
                    <span>Salvar para depois</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Propor questão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
