import type { Difficulty, Platform, ProposalStatus } from "@prisma/client";

export function detectPlatform(url: string): Platform {
  const normalized = url.toLowerCase();
  if (normalized.includes("codeforces.com")) return "CODEFORCES";
  if (normalized.includes("leetcode.com")) return "LEETCODE";
  if (normalized.includes("atcoder.jp")) return "ATCODER";
  if (normalized.includes("beecrowd.com") || normalized.includes("urionlinejudge.com")) {
    return "BEECROWD";
  }
  if (normalized.includes("cses.fi")) return "CSES";
  return "OUTRO";
}

export const PLATFORM_META: Record<
  Platform,
  { label: string; short: string; className: string }
> = {
  CODEFORCES: {
    label: "Codeforces",
    short: "CF",
    className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  LEETCODE: {
    label: "LeetCode",
    short: "LC",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  ATCODER: {
    label: "AtCoder",
    short: "AC",
    className: "bg-slate-500/20 text-slate-200 border-slate-500/30",
  },
  BEECROWD: {
    label: "Beecrowd",
    short: "BC",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  CSES: {
    label: "CSES",
    short: "CSES",
    className: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
  OUTRO: {
    label: "Outro",
    short: "URL",
    className: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  },
};

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; className: string }
> = {
  FACIL: {
    label: "Fácil",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  MEDIO: {
    label: "Médio",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  DIFICIL: {
    label: "Difícil",
    className: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
  MUITO_DIFICIL: {
    label: "Muito Difícil",
    className: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  },
};

export const PROPOSAL_STATUS_META: Record<
  ProposalStatus,
  { label: string; className: string }
> = {
  PENDENTE: {
    label: "Pendente",
    className: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  },
  VISUALIZADO: {
    label: "Visualizado",
    className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  TENTOU: {
    label: "Tentou (Revisão)",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  FEITO: {
    label: "Feito",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  DESCARTADO: {
    label: "Descartado",
    className: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
};
