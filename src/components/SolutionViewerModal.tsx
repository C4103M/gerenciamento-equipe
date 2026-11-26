"use client";

import type { Platform } from "@prisma/client";
import { Code2, ExternalLink, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { MemberAvatar, PlatformBadge } from "@/components/Badges";
import { SolutionCodeBlock } from "@/components/SolutionCodeBlock";
import { cn } from "@/lib/utils";
import type { MemberSummary } from "@/types";

export interface SolutionViewerModalProps {
  open: boolean;
  onClose: () => void;
  problemLogId: string;
  title: string;
  problemUrl: string;
  platform: Platform;
  author: Pick<MemberSummary, "name" | "avatarColor">;
  solutionUrl?: string | null;
}

/** Accessible dialog fetching and displaying pasted solution source code on demand. */
export function SolutionViewerModal({
  open,
  onClose,
  problemLogId,
  title,
  problemUrl,
  platform,
  author,
  solutionUrl,
}: SolutionViewerModalProps) {
  if (!open) return null;

  return (
    <SolutionViewerContent
      key={problemLogId}
      onClose={onClose}
      problemLogId={problemLogId}
      title={title}
      problemUrl={problemUrl}
      platform={platform}
      author={author}
      solutionUrl={solutionUrl}
    />
  );
}

function SolutionViewerContent({
  onClose,
  problemLogId,
  title,
  problemUrl,
  platform,
  author,
  solutionUrl,
}: Omit<SolutionViewerModalProps, "open">) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform={platform} />
              <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/80 py-0.5 pr-2.5 pl-1 text-xs text-zinc-200">
                <MemberAvatar member={author} size="sm" />
                <span className="font-medium">{author.name}</span>
              </div>
            </div>

            <h2
              id={titleId}
              className="truncate text-base font-semibold tracking-tight text-zinc-100 sm:text-lg"
            >
              {title}
            </h2>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <a
                href={problemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <span>Abrir enunciado</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>

              {solutionUrl ? (
                <a
                  href={solutionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
                >
                  <span>Abrir link da resolução</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar visualizador de solução"
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Code Viewer */}
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <SolutionCodeBlock
            problemLogId={problemLogId}
            maxHeightClass="max-h-[58vh]"
          />
        </div>
      </div>
    </div>
  );
}

export interface SolutionLinksProps {
  problemLogId?: string | null;
  title: string;
  problemUrl: string;
  platform: Platform;
  author: Pick<MemberSummary, "name" | "avatarColor">;
  solutionUrl?: string | null;
  hasSolutionCode?: boolean;
  size?: "sm" | "xs";
}

/** Compact action pills for opening an external solution link or viewing pasted code in a modal. */
export function SolutionLinks({
  problemLogId,
  title,
  problemUrl,
  platform,
  author,
  solutionUrl,
  hasSolutionCode = false,
  size = "sm",
}: SolutionLinksProps) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const canViewCode = Boolean(hasSolutionCode && problemLogId);

  if (!solutionUrl && !canViewCode) {
    return null;
  }

  const pillSizeClass =
    size === "xs"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : "px-2.5 py-0.5 text-xs gap-1.5";
  const iconSizeClass = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <>
      <div className="inline-flex flex-wrap items-center gap-1.5">
        {solutionUrl ? (
          <a
            href={solutionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 font-medium text-emerald-300 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/20",
              pillSizeClass
            )}
          >
            <span>Ver resolução</span>
            <ExternalLink className={cn(iconSizeClass, "shrink-0")} aria-hidden="true" />
          </a>
        ) : null}

        {canViewCode && problemLogId ? (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className={cn(
              "inline-flex items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 font-medium text-indigo-300 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              pillSizeClass
            )}
          >
            <Code2 className={cn(iconSizeClass, "shrink-0")} aria-hidden="true" />
            <span>Ver código</span>
          </button>
        ) : null}
      </div>

      {canViewCode && problemLogId && viewerOpen ? (
        <SolutionViewerModal
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          problemLogId={problemLogId}
          title={title}
          problemUrl={problemUrl}
          platform={platform}
          author={author}
          solutionUrl={solutionUrl}
        />
      ) : null}
    </>
  );
}
