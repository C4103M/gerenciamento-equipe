"use client";

import type { Difficulty } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { lookupCodeforcesProblemAction } from "@/actions/codeforces";
import { lookupLeetCodeProblemAction } from "@/actions/leetcode";
import {
  createProblemLogAction,
  updateProblemLogAction,
} from "@/actions/problems";
import { PlatformBadge } from "@/components/Badges";
import { TopicSelector } from "@/components/TopicSelector";
import { parseCodeforcesRef } from "@/lib/codeforces";
import { parseLeetCodeRef } from "@/lib/leetcode";
import { DIFFICULTY_META, detectPlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";
import type { ProblemLogItem, TopicItem } from "@/types";

export interface ProblemFormModalProps {
  open: boolean;
  onClose: () => void;
  topics: TopicItem[];
  initialProblem?: ProblemLogItem | null;
}

const DIFFICULTY_OPTIONS: Difficulty[] = [
  "FACIL",
  "MEDIO",
  "DIFICIL",
  "MUITO_DIFICIL",
];

/** Modal dialog for logging a new problem or editing an existing problem log. */
export function ProblemFormModal({
  open,
  onClose,
  topics,
  initialProblem = null,
}: ProblemFormModalProps) {
  if (!open) return null;

  return (
    <ProblemFormContent
      key={initialProblem?.id ?? "new-problem"}
      onClose={onClose}
      topics={topics}
      initialProblem={initialProblem}
    />
  );
}

function ProblemFormContent({
  onClose,
  topics,
  initialProblem,
}: Omit<ProblemFormModalProps, "open">) {
  const router = useRouter();
  const isEditing = Boolean(initialProblem);

  const [title, setTitle] = useState(initialProblem?.title ?? "");
  const [url, setUrl] = useState(initialProblem?.url ?? "");
  const [externalId, setExternalId] = useState<string | null>(
    initialProblem?.externalId ?? null
  );
  const [externalRating, setExternalRating] = useState<number | null>(
    initialProblem?.externalRating ?? null
  );
  const [topicIds, setTopicIds] = useState<string[]>(
    initialProblem?.topics.map((t) => t.id) ?? []
  );
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<Difficulty>(
    initialProblem?.perceivedDifficulty ?? "MEDIO"
  );
  const [attemptCount, setAttemptCount] = useState<number>(
    initialProblem?.attemptCount ?? 1
  );
  const [solved, setSolved] = useState<boolean>(initialProblem?.solved ?? true);
  const [needsReview, setNeedsReview] = useState<boolean>(
    initialProblem?.needsReview ?? false
  );
  const [notes, setNotes] = useState(initialProblem?.notes ?? "");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupPlatform, setLookupPlatform] = useState<
    "CODEFORCES" | "LEETCODE" | null
  >(null);
  const [lookupStatus, setLookupStatus] = useState<{
    platform: "CODEFORCES" | "LEETCODE";
    type: "success" | "error";
    text: string;
    tags?: string[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastAutoLookedUpRef = useRef<string | null>(
    initialProblem
      ? (parseCodeforcesRef(initialProblem.url)?.externalId ??
          parseLeetCodeRef(initialProblem.url)?.externalId ??
          null)
      : null
  );
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
  const lcRef = !cfRef && trimmedUrl ? parseLeetCodeRef(trimmedUrl) : null;
  const detectedPlatform = cfRef
    ? "CODEFORCES"
    : lcRef
      ? "LEETCODE"
      : trimmedUrl
        ? detectPlatform(trimmedUrl)
        : null;

  async function performProblemLookup(rawInput: string, force: boolean) {
    const parsedCf = parseCodeforcesRef(rawInput);
    const parsedLc = !parsedCf ? parseLeetCodeRef(rawInput) : null;
    if (!parsedCf && !parsedLc) return;

    const targetExternalId = parsedCf
      ? parsedCf.externalId
      : parsedLc!.externalId;
    const targetPlatform: "CODEFORCES" | "LEETCODE" = parsedCf
      ? "CODEFORCES"
      : "LEETCODE";

    if (!force && lastAutoLookedUpRef.current === targetExternalId) {
      return;
    }

    lastAutoLookedUpRef.current = targetExternalId;
    const seq = ++lookupSeqRef.current;
    setIsLookingUp(true);
    setLookupPlatform(targetPlatform);
    setLookupStatus(null);

    try {
      if (parsedCf) {
        const result = await lookupCodeforcesProblemAction(rawInput);
        if (lookupSeqRef.current !== seq) return;

        if (result.error || !result.data) {
          setLookupStatus({
            platform: "CODEFORCES",
            type: "error",
            text:
              result.error ?? "Não foi possível carregar dados do Codeforces.",
          });
          return;
        }

        const data = result.data;
        setTitle(data.title);
        setUrl(data.canonicalUrl);
        setExternalId(data.externalId);
        setExternalRating(data.rating);
        if (data.matchedTopicIds.length > 0) {
          setTopicIds(data.matchedTopicIds);
        }
        if (data.suggestedDifficulty) {
          setPerceivedDifficulty(data.suggestedDifficulty);
        }

        const ratingPart = data.rating
          ? `Rating ${data.rating}`
          : "Sem rating oficial";
        setLookupStatus({
          platform: "CODEFORCES",
          type: "success",
          text: `Autopreenchido via Codeforces · ${ratingPart}`,
          tags: data.rawTags,
        });
      } else {
        const result = await lookupLeetCodeProblemAction(rawInput);
        if (lookupSeqRef.current !== seq) return;

        if (result.error || !result.data) {
          setLookupStatus({
            platform: "LEETCODE",
            type: "error",
            text:
              result.error ?? "Não foi possível carregar dados do LeetCode.",
          });
          return;
        }

        const data = result.data;
        setTitle(data.title);
        setUrl(data.canonicalUrl);
        setExternalId(data.externalId);
        setExternalRating(null);
        if (data.matchedTopicIds.length > 0) {
          setTopicIds(data.matchedTopicIds);
        }
        if (data.suggestedDifficulty) {
          setPerceivedDifficulty(data.suggestedDifficulty);
        }

        const diffPart = data.lcDifficulty
          ? `Dificuldade ${data.lcDifficulty}`
          : "Sem dificuldade oficial";
        setLookupStatus({
          platform: "LEETCODE",
          type: "success",
          text: `Autopreenchido via LeetCode · ${diffPart}`,
          tags: data.rawTags,
        });
      }
    } catch {
      if (lookupSeqRef.current !== seq) return;
      setLookupStatus({
        platform: targetPlatform,
        type: "error",
        text:
          targetPlatform === "CODEFORCES"
            ? "Erro de comunicação ao consultar o Codeforces."
            : "Erro de comunicação ao consultar o LeetCode.",
      });
    } finally {
      if (lookupSeqRef.current === seq) {
        setIsLookingUp(false);
        setLookupPlatform(null);
      }
    }
  }

  function handleUrlChange(nextValue: string) {
    setUrl(nextValue);
    setLookupStatus(null);

    const parsedCf = parseCodeforcesRef(nextValue);
    const parsedLc = !parsedCf ? parseLeetCodeRef(nextValue) : null;
    const parsedExtId = parsedCf?.externalId ?? parsedLc?.externalId ?? null;

    if (!parsedExtId) {
      setExternalId(null);
      setExternalRating(null);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      return;
    }

    if (parsedExtId !== externalId) {
      setExternalId(parsedExtId);
      setExternalRating(null);
    }

    if (isEditing) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void performProblemLookup(nextValue, false);
    }, 450);
  }

  function handleUrlPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    if (isEditing) return;
    const pasted = e.clipboardData.getData("text");
    if (parseCodeforcesRef(pasted) || parseLeetCodeRef(pasted)) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      void performProblemLookup(pasted, false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

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
      const payload = {
        title,
        url,
        topicIds,
        perceivedDifficulty,
        solved,
        needsReview: solved ? needsReview : true,
        notes,
        attemptCount: Math.max(1, Math.floor(attemptCount || 1)),
        externalId: cfRef?.externalId ?? lcRef?.externalId ?? externalId,
        externalRating,
      };

      const result = initialProblem
        ? await updateProblemLogAction(initialProblem.id, payload)
        : await createProblemLogAction(payload);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError("Ocorreu um erro ao salvar a questão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="problem-modal-title"
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
              id="problem-modal-title"
              className="text-lg font-semibold tracking-tight text-zinc-100"
            >
              {isEditing ? "Editar Questão" : "Registrar Questão"}
            </h2>
            <p className="text-xs text-zinc-400">
              {isEditing
                ? "Atualize os detalhes, tópicos ou status desta questão."
                : "Registre uma questão praticada para acompanhar o progresso da equipe."}
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

            {/* URL or CF code + Instant Autofill */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="problem-url"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Link ou código da questão{" "}
                  <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  {cfRef ? (
                    <button
                      type="button"
                      onClick={() => void performProblemLookup(trimmedUrl, true)}
                      disabled={isLookingUp || isSubmitting}
                      className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
                    >
                      {isLookingUp ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {isLookingUp ? "Buscando CF..." : "Preencher do CF"}
                      </span>
                    </button>
                  ) : lcRef ? (
                    <button
                      type="button"
                      onClick={() => void performProblemLookup(trimmedUrl, true)}
                      disabled={isLookingUp || isSubmitting}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      {isLookingUp ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {isLookingUp ? "Buscando LC..." : "Preencher do LC"}
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
                  id="problem-url"
                  type="text"
                  inputMode="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onPaste={handleUrlPaste}
                  placeholder="Cole link do CF/LeetCode/CSES ou digite 1800E2 / LC two-sum..."
                  required
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pr-3.5 pl-10 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              {isLookingUp ? (
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    lookupPlatform === "LEETCODE"
                      ? "text-amber-300"
                      : "text-sky-300"
                  )}
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>
                    {lookupPlatform === "LEETCODE"
                      ? "Consultando dados da questão no LeetCode..."
                      : "Consultando dados da questão no Codeforces..."}
                  </span>
                </p>
              ) : lookupStatus ? (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs",
                    lookupStatus.type === "error"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                      : lookupStatus.platform === "LEETCODE"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border-sky-500/30 bg-sky-500/10 text-sky-200"
                  )}
                >
                  <p className="font-medium">{lookupStatus.text}</p>
                  {lookupStatus.tags && lookupStatus.tags.length > 0 ? (
                    <p
                      className={cn(
                        "mt-1 text-[11px]",
                        lookupStatus.platform === "LEETCODE"
                          ? "text-amber-300/80"
                          : "text-sky-300/80"
                      )}
                    >
                      {lookupStatus.platform === "LEETCODE"
                        ? "Tags LC:"
                        : "Tags CF:"}{" "}
                      {lookupStatus.tags.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Dica: cole link do Codeforces/LeetCode ou use o código (ex:{" "}
                  <span className="font-mono text-zinc-400">1800E2</span> ou{" "}
                  <span className="font-mono text-zinc-400">LC two-sum</span>)
                  para preencher título, tópicos e dificuldade.
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label
                htmlFor="problem-title"
                className="block text-sm font-medium text-zinc-200"
              >
                Título da questão <span className="text-rose-400">*</span>
              </label>
              <input
                id="problem-title"
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

            {/* Perceived Difficulty & Attempt Count */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="space-y-2 sm:col-span-8">
                <div className="flex items-center justify-between gap-2">
                  <span className="block text-sm font-medium text-zinc-200">
                    Dificuldade percebida
                  </span>
                  {externalRating ? (
                    <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-300">
                      CF {externalRating}
                    </span>
                  ) : null}
                </div>
                <div
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  role="radiogroup"
                  aria-label="Dificuldade percebida"
                >
                  {DIFFICULTY_OPTIONS.map((diff) => {
                    const meta = DIFFICULTY_META[diff];
                    const active = perceivedDifficulty === diff;
                    return (
                      <button
                        key={diff}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setPerceivedDifficulty(diff)}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                          active
                            ? cn(meta.className, "ring-1 ring-current/40")
                            : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        )}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 sm:col-span-4">
                <label
                  htmlFor="problem-attempt-count"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Número de tentativas
                </label>
                <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 p-1">
                  <button
                    type="button"
                    onClick={() =>
                      setAttemptCount((prev) => Math.max(1, prev - 1))
                    }
                    disabled={attemptCount <= 1 || isSubmitting}
                    aria-label="Diminuir número de tentativas"
                    className="inline-flex h-7 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    id="problem-attempt-count"
                    type="number"
                    min={1}
                    max={999}
                    value={attemptCount}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setAttemptCount(
                        Number.isFinite(val) && val >= 1 ? val : 1
                      );
                    }}
                    className="w-full bg-transparent text-center font-mono text-sm font-semibold text-zinc-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttemptCount((prev) => Math.min(999, prev + 1))
                    }
                    disabled={isSubmitting}
                    aria-label="Aumentar número de tentativas"
                    className="inline-flex h-7 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Solved Switch & Review Rules */}
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span
                    id="solved-switch-label"
                    className="block text-sm font-semibold text-zinc-100"
                  >
                    Conseguiu fazer?
                  </span>
                  <p className="text-xs text-zinc-400">
                    {solved
                      ? "Questão marcada como resolvida."
                      : "Questão marcada como não resolvida."}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={solved}
                  aria-labelledby="solved-switch-label"
                  onClick={() => setSolved((prev) => !prev)}
                  className={cn(
                    "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    solved
                      ? "border-emerald-500/60 bg-emerald-500/25"
                      : "border-amber-500/60 bg-amber-500/20"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full shadow transition-transform",
                      solved
                        ? "translate-x-6 bg-emerald-400"
                        : "translate-x-0 bg-amber-400"
                    )}
                  />
                </button>
              </div>

              {!solved ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                    aria-hidden="true"
                  />
                  <span>
                    Questões não resolvidas vão automaticamente para a Lista de
                    Revisão.
                  </span>
                </div>
              ) : (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3 py-2.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={needsReview}
                    onChange={(e) => setNeedsReview(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  <span className="flex items-center gap-1.5 leading-relaxed">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                      aria-hidden="true"
                    />
                    Também adicionar à lista de revisão para praticar novamente
                    depois
                  </span>
                </label>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label
                htmlFor="problem-notes"
                className="block text-sm font-medium text-zinc-200"
              >
                Observações
              </label>
              <textarea
                id="problem-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ideia da solução, complexidade, onde travou ou dicas para revisão..."
                className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 bg-zinc-900/95 px-6 py-4">
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
                  <span>Salvando...</span>
                </>
              ) : (
                <span>
                  {isEditing ? "Salvar alterações" : "Registrar questão"}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
