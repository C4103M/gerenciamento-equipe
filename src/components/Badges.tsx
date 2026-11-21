import type { Difficulty, Platform, ProposalStatus } from "@prisma/client";
import { X } from "lucide-react";
import {
  DIFFICULTY_META,
  PLATFORM_META,
  PROPOSAL_STATUS_META,
} from "@/lib/platform";
import { cn } from "@/lib/utils";
import type { MemberSummary, TopicItem } from "@/types";

const BADGE_BASE_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** Badge displaying the competitive programming platform. */
export function PlatformBadge({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform];
  return (
    <span className={cn(BADGE_BASE_CLASS, meta.className)} title={meta.label}>
      {meta.label}
    </span>
  );
}

/** Badge displaying the perceived or suggested difficulty level. */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const meta = DIFFICULTY_META[difficulty];
  return (
    <span className={cn(BADGE_BASE_CLASS, meta.className)}>{meta.label}</span>
  );
}

/** Badge displaying the current status of a proposed problem. */
export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const meta = PROPOSAL_STATUS_META[status];
  return (
    <span className={cn(BADGE_BASE_CLASS, meta.className)}>{meta.label}</span>
  );
}

/** Colored topic pill with an optional remove action for interactive selectors. */
export function TopicBadge({
  topic,
  onRemove,
}: {
  topic: TopicItem;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium text-zinc-100 whitespace-nowrap"
      style={{
        borderColor: `${topic.color}50`,
        backgroundColor: `${topic.color}1a`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: topic.color }}
        aria-hidden="true"
      />
      <span>{topic.name}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover tópico ${topic.name}`}
          className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const AVATAR_SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
} as const;

/** Circular member avatar displaying initials over the user's avatarColor. */
export function MemberAvatar({
  member,
  size = "md",
}: {
  member: Pick<MemberSummary, "name" | "avatarColor">;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/15 select-none",
        AVATAR_SIZE_CLASSES[size]
      )}
      style={{ backgroundColor: member.avatarColor }}
      title={member.name}
      aria-label={member.name}
    >
      {getInitials(member.name)}
    </span>
  );
}
