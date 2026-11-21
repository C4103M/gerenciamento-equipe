"use client";

import type { Difficulty } from "@prisma/client";
import { Check, Link2, Loader2, Send, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { proposeProblemAction } from "@/actions/proposals";
import { MemberAvatar, PlatformBadge } from "@/components/Badges";
import { TopicSelector } from "@/components/TopicSelector";
import { DIFFICULTY_META, detectPlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";
import type { MemberSummary, TopicItem } from "@/types";

export interface ProposeProblemModalProps {
  open: boolean;
  onClose: () => void;
  teammates: MemberSummary[];
  topics: TopicItem[];
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

/** Modal dialog for proposing a competitive programming problem to teammates. */
export function ProposeProblemModal({
  open,
  onClose,
  teammates,
  topics,
}: ProposeProblemModalProps) {
  if (!open) return null;

  return (
    <ProposeProblemContent
      onClose={onClose}
      teammates={teammates}
      topics={topics}
    />
  );
}

function ProposeProblemContent({
  onClose,
  teammates,
  topics,
}: Omit<ProposeProblemModalProps, "open">) {
  const router = useRouter();

  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [suggestedDifficulty, setSuggestedDifficulty] =
    useState<Difficulty | null>(null);
  const [message, setMessage] = useState("");
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

  const trimmedUrl = url.trim();
  const detectedPlatform = trimmedUrl ? detectPlatform(trimmedUrl) : null;
  const allSelected =
    teammates.length > 0 && assigneeIds.length === teammates.length;

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
      setAssigneeIds(teammates.map((m) => m.id));
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
              Propor Questão para a Equipe
            </h2>
            <p className="text-xs text-zinc-400">
              Indique um problema relevante para seus colegas treinarem.
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
                {teammates.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleSelectAllToggle}
                    className="rounded-md px-2 py-1 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/15 hover:text-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {allSelected ? "Limpar seleção" : "Selecionar todos"}
                  </button>
                ) : null}
              </div>

              {teammates.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {teammates.map((member) => {
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
                            ? "border-indigo-500/60 bg-indigo-500/10"
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
                            <p className="truncate text-sm font-medium text-zinc-100">
                              {member.name}
                            </p>
                            <p className="truncate text-xs text-zinc-400">
                              {handles || member.email}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                            checked
                              ? "border-indigo-500 bg-indigo-500 text-white"
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
                  Nenhum outro membro disponível na equipe no momento.
                </div>
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
                placeholder="Ex: CSES - Dynamic Range Minimum Queries"
                required
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            {/* URL + Live Platform Badge */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="propose-url"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Link da questão <span className="text-rose-400">*</span>
                </label>
                {detectedPlatform ? (
                  <PlatformBadge platform={detectedPlatform} />
                ) : null}
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
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://cses.fi/problemset/task/1649"
                  required
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pr-3.5 pl-10 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>
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
              <span className="block text-sm font-medium text-zinc-200">
                Dificuldade sugerida{" "}
                <span className="text-xs font-normal text-zinc-500">
                  (opcional)
                </span>
              </span>
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
                placeholder="Recado ou dica opcional para os colegas (ex: 'Boa para treinar SegTree lazy!')..."
                className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900/95 px-6 py-4">
            <span className="text-xs text-zinc-400">
              {assigneeIds.length > 0
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
                    <span>Enviando...</span>
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
