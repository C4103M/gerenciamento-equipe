"use client";

import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createTopicAction } from "@/actions/topics";
import { TopicBadge } from "@/components/Badges";
import { cn, slugify } from "@/lib/utils";
import type { TopicItem } from "@/types";

export interface TopicSelectorProps {
  allTopics: TopicItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onTopicCreated?: (topic: TopicItem) => void;
}

/**
 * Interactive multi-select topic picker with search filtering, removable pills,
 * and inline database topic creation via `createTopicAction`.
 */
export function TopicSelector({
  allTopics,
  selectedIds,
  onChange,
  onTopicCreated,
}: TopicSelectorProps) {
  const [query, setQuery] = useState("");
  const [createdTopics, setCreatedTopics] = useState<TopicItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mergedTopics = useMemo(() => {
    const byId = new Map<string, TopicItem>();
    for (const topic of allTopics) {
      byId.set(topic.id, topic);
    }
    for (const topic of createdTopics) {
      if (!byId.has(topic.id)) {
        byId.set(topic.id, topic);
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR")
    );
  }, [allTopics, createdTopics]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedTopics = useMemo(
    () => mergedTopics.filter((t) => selectedSet.has(t.id)),
    [mergedTopics, selectedSet]
  );

  const trimmedQuery = query.trim();
  const normalizedQuery = slugify(trimmedQuery);

  const filteredTopics = useMemo(() => {
    if (!trimmedQuery) return mergedTopics;
    const lower = trimmedQuery.toLowerCase();
    return mergedTopics.filter(
      (topic) =>
        topic.name.toLowerCase().includes(lower) ||
        (normalizedQuery.length > 0 && topic.slug.includes(normalizedQuery))
    );
  }, [mergedTopics, trimmedQuery, normalizedQuery]);

  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return false;
    const lower = trimmedQuery.toLowerCase();
    return mergedTopics.some(
      (topic) =>
        topic.name.toLowerCase() === lower ||
        (normalizedQuery.length > 0 && topic.slug === normalizedQuery)
    );
  }, [mergedTopics, trimmedQuery, normalizedQuery]);

  function toggleTopic(topicId: string) {
    setError(null);
    if (selectedSet.has(topicId)) {
      onChange(selectedIds.filter((id) => id !== topicId));
    } else {
      onChange([...selectedIds, topicId]);
    }
  }

  async function handleCreateTopic() {
    const nameToCreate = query.trim();
    if (nameToCreate.length < 2) {
      setError("Digite pelo menos 2 caracteres para criar um novo tópico.");
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setIsCreating(true);
    try {
      const result = await createTopicAction(nameToCreate);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.topic) {
        const created = result.topic;
        setCreatedTopics((prev) =>
          prev.some((t) => t.id === created.id) ? prev : [...prev, created]
        );
        if (!selectedSet.has(created.id)) {
          onChange([...selectedIds, created.id]);
        }
        onTopicCreated?.(created);
        setQuery("");
      }
    } catch {
      setError("Não foi possível criar o tópico. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Selected topic pills */}
      <div className="flex min-h-[36px] flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
        {selectedTopics.length > 0 ? (
          selectedTopics.map((topic) => (
            <TopicBadge
              key={topic.id}
              topic={topic}
              onRemove={() => toggleTopic(topic.id)}
            />
          ))
        ) : (
          <span className="text-xs text-zinc-500">
            Nenhum tópico selecionado — escolha abaixo ou crie um novo
          </span>
        )}
      </div>

      {/* Search & inline create bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (trimmedQuery.length >= 2 && !hasExactMatch && !isCreating) {
                  void handleCreateTopic();
                }
              }
            }}
            placeholder="Buscar ou digitar novo tópico..."
            aria-label="Buscar ou criar tópico"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pr-8 pl-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setError(null);
                inputRef.current?.focus();
              }}
              aria-label="Limpar busca de tópicos"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-zinc-500 transition-colors hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void handleCreateTopic()}
          disabled={isCreating || hasExactMatch}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
            trimmedQuery.length >= 2 && !hasExactMatch
              ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25"
              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
            (isCreating || hasExactMatch) && "cursor-not-allowed opacity-50"
          )}
        >
          {isCreating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          <span>Criar tópico</span>
        </button>
      </div>

      {error ? (
        <p className="text-xs text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      {/* Quick-create banner when query doesn't match an existing topic */}
      {trimmedQuery.length >= 2 && !hasExactMatch ? (
        <button
          type="button"
          onClick={() => void handleCreateTopic()}
          disabled={isCreating}
          className="flex w-full items-center justify-between rounded-lg border border-dashed border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-left text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
        >
          <span className="flex items-center gap-1.5">
            {isCreating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>
              + Criar tópico{" "}
              <strong className="font-semibold text-white">
                &ldquo;{trimmedQuery}&rdquo;
              </strong>
            </span>
          </span>
          <span className="text-[11px] text-indigo-300/80">Enter</span>
        </button>
      ) : null}

      {/* Available topics grid */}
      <div className="max-h-44 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
        {filteredTopics.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {filteredTopics.map((topic) => {
              const isSelected = selectedSet.has(topic.id);
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => toggleTopic(topic.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    isSelected
                      ? "border-indigo-500/50 bg-indigo-500/15 text-zinc-100"
                      : "border-zinc-800/80 bg-zinc-900/70 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/80"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: topic.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium">{topic.name}</span>
                  </span>
                  {isSelected ? (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-indigo-400"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-zinc-500">
            Nenhum tópico encontrado para &ldquo;{trimmedQuery}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
