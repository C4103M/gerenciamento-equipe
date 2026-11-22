import type { Difficulty } from "@prisma/client";
import type { TopicItem } from "@/types";

export interface CodeforcesProblemRef {
  contestId: number;
  index: string;
  isGym: boolean;
  code: string;
  externalId: string;
  canonicalUrl: string;
}

export interface CfApiProblem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type?: string;
  points?: number;
  rating?: number;
  tags?: string[];
}

export interface CfApiSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  problem: CfApiProblem;
  verdict?: string;
}

export interface AggregatedCfProblem {
  externalId: string;
  contestId: number;
  index: string;
  isGym: boolean;
  code: string;
  title: string;
  canonicalUrl: string;
  rating: number | null;
  tags: string[];
  solved: boolean;
  attemptCount: number;
  activityAt: string;
  withinGraceWindow: boolean;
  latestSubmissionId: number;
}

export const CF_TAG_TO_TOPIC_SLUGS: Record<string, string[]> = {
  dp: ["programacao-dinamica"],
  dsu: ["union-find-dsu"],
  "binary search": ["busca-binaria"],
  "ternary search": ["busca-binaria"],
  "shortest paths": ["caminhos-minimos"],
  trees: ["arvore"],
  graphs: ["grafos"],
  "dfs and similar": ["grafos"],
  flows: ["grafos"],
  "graph matchings": ["grafos"],
  "2-sat": ["grafos"],
  "two pointers": ["two-pointers"],
  bitmasks: ["bitmask"],
  "data structures": ["estruturas-de-dados"],
  strings: ["strings"],
  "string suffix structures": ["strings"],
  "expression parsing": ["strings", "pilha"],
  hashing: ["strings", "estruturas-de-dados"],
  math: ["matematica-computacional"],
  probabilities: ["matematica-computacional"],
  matrices: ["matematica-computacional"],
  fft: ["matematica-computacional"],
  games: ["matematica-computacional"],
  "number theory": ["teoria-dos-numeros"],
  "chinese remainder theorem": ["teoria-dos-numeros"],
  combinatorics: ["combinatoria"],
  geometry: ["geometria-computacional"],
  greedy: ["algoritmos-gulosos"],
  schedules: ["algoritmos-gulosos"],
  "divide and conquer": ["divisao-e-conquista"],
  "meet-in-the-middle": ["divisao-e-conquista"],
  "brute force": ["backtracking"],
  sortings: ["ordenacao"],
  implementation: ["implementacao-ad-hoc"],
  "constructive algorithms": ["implementacao-ad-hoc"],
  interactive: ["implementacao-ad-hoc"],
  "*special": ["implementacao-ad-hoc"],
};

/**
 * Parses any Codeforces problem URL (contest, problemset, gym, group)
 * or shorthand problem code (e.g. "1800E2", "1800-E2", "CF 1800E2").
 */
export function parseCodeforcesRef(raw: string): CodeforcesProblemRef | null {
  const input = raw.trim();
  if (!input) return null;

  let contestId: number | null = null;
  let index: string | null = null;
  let isGymUrl = false;

  const urlPatterns: Array<{ regex: RegExp; isGym: boolean }> = [
    {
      regex:
        /codeforces\.com\/problemset\/problem\/(\d+)\/([A-Za-z][A-Za-z0-9]*)/i,
      isGym: false,
    },
    {
      regex:
        /codeforces\.com\/contest\/(\d+)\/problem\/([A-Za-z][A-Za-z0-9]*)/i,
      isGym: false,
    },
    {
      regex:
        /codeforces\.com\/contest\/(\d+)\/([A-Za-z][A-Za-z0-9]*)(?:[/?#]|$)/i,
      isGym: false,
    },
    {
      regex: /codeforces\.com\/gym\/(\d+)\/problem\/([A-Za-z][A-Za-z0-9]*)/i,
      isGym: true,
    },
    {
      regex:
        /codeforces\.com\/problemset\/gymProblem\/(\d+)\/([A-Za-z][A-Za-z0-9]*)/i,
      isGym: true,
    },
    {
      regex:
        /codeforces\.com\/group\/[A-Za-z0-9]+\/contest\/(\d+)\/problem\/([A-Za-z][A-Za-z0-9]*)/i,
      isGym: true,
    },
  ];

  for (const { regex, isGym } of urlPatterns) {
    const match = input.match(regex);
    if (match) {
      contestId = Number.parseInt(match[1], 10);
      index = match[2].toUpperCase();
      isGymUrl = isGym;
      break;
    }
  }

  if (contestId === null || !index) {
    const codeMatch = input.match(
      /^(?:CF\s*)?(\d{1,7})[\s\-_/]?([A-Za-z][A-Za-z0-9]{0,3})$/i
    );
    if (codeMatch) {
      contestId = Number.parseInt(codeMatch[1], 10);
      index = codeMatch[2].toUpperCase();
    }
  }

  if (!contestId || !Number.isFinite(contestId) || contestId <= 0 || !index) {
    return null;
  }

  const isGym = isGymUrl || contestId >= 100000;
  const code = `${contestId}${index}`;
  const externalId = `cf:${contestId}:${index}`;
  const canonicalUrl = isGym
    ? `https://codeforces.com/gym/${contestId}/problem/${index}`
    : `https://codeforces.com/problemset/problem/${contestId}/${index}`;

  return {
    contestId,
    index,
    isGym,
    code,
    externalId,
    canonicalUrl,
  };
}

export function formatCodeforcesTitle(
  contestId: number,
  index: string,
  name: string
): string {
  const cleanName = name.trim();
  const upperIndex = index.toUpperCase();
  return cleanName
    ? `CF ${contestId}${upperIndex} - ${cleanName}`
    : `CF ${contestId}${upperIndex}`;
}

export function mapCfRatingToDifficulty(
  rating?: number | null
): Difficulty | null {
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0) {
    return null;
  }
  if (rating <= 1100) return "FACIL";
  if (rating <= 1500) return "MEDIO";
  if (rating <= 2000) return "DIFICIL";
  return "MUITO_DIFICIL";
}

export function mapCfTagsToTopicIds(
  cfTags: string[],
  allTopics: TopicItem[],
  fallbackSlug?: string
): string[] {
  const slugToId = new Map<string, string>();
  for (const topic of allTopics) {
    slugToId.set(topic.slug, topic.id);
  }

  const matched = new Set<string>();
  for (const rawTag of cfTags) {
    const slugs = CF_TAG_TO_TOPIC_SLUGS[rawTag.trim().toLowerCase()];
    if (!slugs) continue;
    for (const slug of slugs) {
      const id = slugToId.get(slug);
      if (id) {
        matched.add(id);
      }
    }
  }

  if (matched.size === 0 && fallbackSlug) {
    const fallbackId = slugToId.get(fallbackSlug);
    if (fallbackId) {
      matched.add(fallbackId);
    }
  }

  return Array.from(matched);
}

function translateCodeforcesApiComment(comment?: string): string {
  if (!comment) {
    return "A API do Codeforces retornou um erro inesperado.";
  }
  const lower = comment.toLowerCase();
  if (lower.includes("call limit exceeded")) {
    return "Limite de requisições da API do Codeforces atingido. Aguarde alguns segundos e tente novamente.";
  }
  if (lower.includes("not found") || lower.includes("handles:")) {
    return "Handle ou contest não encontrado no Codeforces.";
  }
  if (lower.includes("contestid") || lower.includes("not started")) {
    return "Contest não encontrado ou ainda indisponível na API pública do Codeforces.";
  }
  if (lower.includes("private") || lower.includes("denied")) {
    return "Este contest ou gym é privado e não pode ser consultado pela API pública.";
  }
  return `Erro da API do Codeforces: ${comment}`;
}

export async function fetchCodeforcesProblem(
  contestId: number,
  index: string
): Promise<{
  problem?: {
    contestId: number;
    index: string;
    name: string;
    rating: number | null;
    tags: string[];
  };
  error?: string;
}> {
  const endpoint = `https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`;

  try {
    const res = await fetch(endpoint, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });

    if (res.status === 503 || res.status === 429) {
      return {
        error:
          "A API do Codeforces está temporariamente sobrecarregada. Tente novamente em instantes.",
      };
    }

    const data = (await res.json()) as {
      status?: string;
      comment?: string;
      result?: {
        problems?: CfApiProblem[];
      };
    };

    if (data.status !== "OK" || !data.result?.problems) {
      return { error: translateCodeforcesApiComment(data.comment) };
    }

    const targetIndex = index.trim().toUpperCase();
    const matched = data.result.problems.find(
      (p) => p.index.trim().toUpperCase() === targetIndex
    );

    if (!matched) {
      return {
        error: `Problema ${contestId}${targetIndex} não encontrado no contest ${contestId}.`,
      };
    }

    return {
      problem: {
        contestId: matched.contestId ?? contestId,
        index: matched.index.trim().toUpperCase(),
        name: matched.name,
        rating:
          typeof matched.rating === "number" && Number.isFinite(matched.rating)
            ? matched.rating
            : null,
        tags: Array.isArray(matched.tags) ? matched.tags : [],
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        error:
          "Tempo esgotado ao consultar a API do Codeforces. Tente novamente.",
      };
    }
    return {
      error:
        "Não foi possível conectar à API do Codeforces. Verifique sua conexão ou preencha manualmente.",
    };
  }
}

export async function fetchCodeforcesUserStatus(
  handle: string,
  count?: number
): Promise<{
  submissions?: CfApiSubmission[];
  error?: string;
}> {
  const cleanHandle = handle.trim();
  if (!cleanHandle) {
    return { error: "Handle do Codeforces não configurado." };
  }

  const params = new URLSearchParams({ handle: cleanHandle });
  if (typeof count === "number" && count > 0) {
    params.set("from", "1");
    params.set("count", String(Math.floor(count)));
  }

  const endpoint = `https://codeforces.com/api/user.status?${params.toString()}`;

  try {
    const res = await fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      headers: { Accept: "application/json" },
    });

    if (res.status === 503 || res.status === 429) {
      return {
        error:
          "A API do Codeforces está limitando requisições no momento. Aguarde alguns segundos e tente novamente.",
      };
    }

    const data = (await res.json()) as {
      status?: string;
      comment?: string;
      result?: CfApiSubmission[];
    };

    if (data.status !== "OK" || !Array.isArray(data.result)) {
      return { error: translateCodeforcesApiComment(data.comment) };
    }

    return { submissions: data.result };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        error:
          "Tempo esgotado ao buscar submissões no Codeforces. Tente limitar para as últimas 200 submissões ou tente novamente.",
      };
    }
    return {
      error:
        "Falha de rede ao consultar as submissões no Codeforces. Tente novamente.",
    };
  }
}

export function aggregateCodeforcesSubmissions(
  submissions: CfApiSubmission[],
  graceMinutes: number,
  nowMs: number = Date.now()
): AggregatedCfProblem[] {
  const groups = new Map<string, CfApiSubmission[]>();

  for (const sub of submissions) {
    const contestId = sub.contestId ?? sub.problem?.contestId;
    const rawIndex = sub.problem?.index;
    if (
      typeof contestId !== "number" ||
      !Number.isFinite(contestId) ||
      contestId <= 0 ||
      !rawIndex
    ) {
      continue;
    }

    if (!sub.verdict || sub.verdict === "TESTING") {
      continue;
    }

    const index = rawIndex.trim().toUpperCase();
    const externalId = `cf:${contestId}:${index}`;
    const existing = groups.get(externalId);
    if (existing) {
      existing.push(sub);
    } else {
      groups.set(externalId, [sub]);
    }
  }

  const aggregated: AggregatedCfProblem[] = [];

  for (const [externalId, list] of groups.entries()) {
    list.sort(
      (a, b) => a.creationTimeSeconds - b.creationTimeSeconds || a.id - b.id
    );

    const nonCe = list.filter((s) => s.verdict !== "COMPILATION_ERROR");
    const countable = nonCe.length > 0 ? nonCe : list;

    const firstOkIdx = countable.findIndex((s) => s.verdict === "OK");
    const solved = firstOkIdx !== -1;

    const latestSub = list[list.length - 1];
    const sampleProblem =
      list.find((s) => typeof s.problem?.rating === "number")?.problem ??
      latestSub.problem;

    const contestId =
      sampleProblem.contestId ?? latestSub.contestId ?? Number(externalId.split(":")[1]);
    const index = sampleProblem.index.trim().toUpperCase();
    const isGym = contestId >= 100000;
    const code = `${contestId}${index}`;
    const canonicalUrl = isGym
      ? `https://codeforces.com/gym/${contestId}/problem/${index}`
      : `https://codeforces.com/problemset/problem/${contestId}/${index}`;

    const attemptCount = solved
      ? Math.max(1, firstOkIdx + 1)
      : Math.max(1, countable.length);

    const activitySub = solved ? countable[firstOkIdx] : latestSub;
    const activityMs = activitySub.creationTimeSeconds * 1000;
    const lastActivityMs = latestSub.creationTimeSeconds * 1000;

    const withinGraceWindow =
      !solved &&
      graceMinutes > 0 &&
      nowMs - lastActivityMs < graceMinutes * 60_000;

    aggregated.push({
      externalId,
      contestId,
      index,
      isGym,
      code,
      title: formatCodeforcesTitle(contestId, index, sampleProblem.name ?? ""),
      canonicalUrl,
      rating:
        typeof sampleProblem.rating === "number" &&
        Number.isFinite(sampleProblem.rating)
          ? sampleProblem.rating
          : null,
      tags: Array.isArray(sampleProblem.tags) ? sampleProblem.tags : [],
      solved,
      attemptCount,
      activityAt: new Date(activityMs).toISOString(),
      withinGraceWindow,
      latestSubmissionId: latestSub.id,
    });
  }

  aggregated.sort(
    (a, b) =>
      new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime()
  );

  return aggregated;
}
