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

interface NormalizedCfProblem {
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
}

const PROBLEMSET_TTL_MS = 6 * 60 * 60 * 1000;
const CONTEST_TTL_MS = 24 * 60 * 60 * 1000;

let problemsetCache: {
  map: Map<string, NormalizedCfProblem>;
  expiresAt: number;
} | null = null;
let problemsetInFlight: Promise<Map<string, NormalizedCfProblem> | null> | null =
  null;

const contestProblemsCache = new Map<
  number,
  { problems: NormalizedCfProblem[]; expiresAt: number }
>();

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

function getCodeforcesApiCredentials(): {
  key: string;
  secret: string;
} | null {
  const key = process.env.CODEFORCES_API_KEY?.trim();
  const secret = process.env.CODEFORCES_API_SECRET?.trim();
  if (!key || !secret) return null;
  return { key, secret };
}

function generateSixDigitRand(): string {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

async function sha512Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function compareAsciiParamEntry(
  a: [string, string],
  b: [string, string]
): number {
  if (a[0] < b[0]) return -1;
  if (a[0] > b[0]) return 1;
  if (a[1] < b[1]) return -1;
  if (a[1] > b[1]) return 1;
  return 0;
}

async function buildSignedCodeforcesUrl(
  method: string,
  paramsObj: Record<string, string>,
  credentials: { key: string; secret: string }
): Promise<string> {
  const rand = generateSixDigitRand();
  const time = Math.floor(Date.now() / 1000);
  const entries = Object.entries({
    ...paramsObj,
    apiKey: credentials.key,
    time: String(time),
  }).sort(compareAsciiParamEntry);

  const rawQs = entries.map(([k, v]) => `${k}=${v}`).join("&");
  const encodedQs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const hexHash = await sha512Hex(
    `${rand}/${method}?${rawQs}#${credentials.secret}`
  );
  return `https://codeforces.com/api/${method}?${encodedQs}&apiSig=${rand}${hexHash}`;
}

/**
 * Parses any Codeforces problem URL (contest, problemset, gym, group)
 * or shorthand problem code (e.g. "1800E2", "1800-E2", "CF 1800E2", "106178/H").
 */
export function parseCodeforcesRef(raw: string): CodeforcesProblemRef | null {
  const input = raw.trim();
  if (!input) return null;

  let contestId: number | null = null;
  let index: string | null = null;
  let isGymUrl = false;
  let groupCode: string | null = null;

  const groupMatch = input.match(
    /codeforces\.com\/group\/([A-Za-z0-9]+)\/contest\/(\d+)\/problem\/([A-Za-z][A-Za-z0-9]*)/i
  );
  if (groupMatch) {
    groupCode = groupMatch[1];
    contestId = Number.parseInt(groupMatch[2], 10);
    index = groupMatch[3].toUpperCase();
    isGymUrl = true;
  }

  if (contestId === null || !index) {
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
          /codeforces\.com\/gym\/(\d+)\/([A-Za-z][0-9]{0,2})(?:[/?#]|$)/i,
        isGym: true,
      },
      {
        regex:
          /codeforces\.com\/problemset\/gymProblem\/(\d+)\/([A-Za-z][A-Za-z0-9]*)/i,
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
  }

  if (contestId === null || !index) {
    const codeMatch = input.match(
      /^(?:(?:CF|GYM)\s*[\/\-_:\s]*)?(\d{1,7})[\s\-_/]?([A-Za-z][A-Za-z0-9]{0,3})$/i
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
  const canonicalUrl = groupCode
    ? `https://codeforces.com/group/${groupCode}/contest/${contestId}/problem/${index}`
    : isGym
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
  if (lower.includes("authenticated")) {
    return "Este contest ou gym exige chave de API do Codeforces configurada (CODEFORCES_API_KEY e CODEFORCES_API_SECRET).";
  }
  if (lower.includes("private") || lower.includes("denied")) {
    return "Este contest ou gym é privado e não pode ser consultado pela API.";
  }
  if (lower.includes("api")) {
    return "Falha na autenticação com a API do Codeforces. Verifique CODEFORCES_API_KEY e CODEFORCES_API_SECRET.";
  }
  if (lower.includes("not found") || lower.includes("handles:")) {
    return "Handle ou contest não encontrado no Codeforces.";
  }
  if (lower.includes("contestid") || lower.includes("not started")) {
    return "Contest não encontrado ou ainda indisponível na API pública do Codeforces.";
  }
  return `Erro da API do Codeforces: ${comment}`;
}

function normalizeCfProblem(
  raw: CfApiProblem,
  fallbackContestId: number
): NormalizedCfProblem {
  return {
    contestId: raw.contestId ?? fallbackContestId,
    index: raw.index.trim().toUpperCase(),
    name: raw.name,
    rating:
      typeof raw.rating === "number" && Number.isFinite(raw.rating)
        ? raw.rating
        : null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}

async function loadProblemsetMap(): Promise<Map<
  string,
  NormalizedCfProblem
> | null> {
  const now = Date.now();
  if (problemsetCache && problemsetCache.expiresAt > now) {
    return problemsetCache.map;
  }

  if (problemsetInFlight) {
    return problemsetInFlight;
  }

  problemsetInFlight = (async () => {
    try {
      const res = await fetch(
        "https://codeforces.com/api/problemset.problems",
        {
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
          headers: { Accept: "application/json" },
        }
      );

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as {
        status?: string;
        result?: {
          problems?: CfApiProblem[];
        };
      };

      if (data.status !== "OK" || !Array.isArray(data.result?.problems)) {
        return null;
      }

      const map = new Map<string, NormalizedCfProblem>();
      for (const raw of data.result.problems) {
        if (typeof raw.contestId !== "number" || !raw.index) continue;
        const normalized = normalizeCfProblem(raw, raw.contestId);
        map.set(`${normalized.contestId}:${normalized.index}`, normalized);
      }

      problemsetCache = {
        map,
        expiresAt: Date.now() + PROBLEMSET_TTL_MS,
      };
      return map;
    } catch {
      return null;
    } finally {
      problemsetInFlight = null;
    }
  })();

  return problemsetInFlight;
}

async function fetchContestProblems(
  contestId: number,
  useAuth: boolean
): Promise<{
  problems?: NormalizedCfProblem[];
  error?: string;
}> {
  const cached = contestProblemsCache.get(contestId);
  if (cached && cached.expiresAt > Date.now()) {
    return { problems: cached.problems };
  }

  let endpoint: string;
  let timeoutMs: number;

  if (useAuth) {
    const credentials = getCodeforcesApiCredentials();
    if (!credentials) {
      return {
        error:
          "Este gym ou contest exige chave de API do Codeforces. Configure CODEFORCES_API_KEY e CODEFORCES_API_SECRET no arquivo .env.",
      };
    }
    endpoint = await buildSignedCodeforcesUrl(
      "contest.standings",
      { contestId: String(contestId), from: "1", count: "1" },
      credentials
    );
    timeoutMs = 12_000;
  } else {
    endpoint = `https://codeforces.com/api/contest.standings?contestId=${contestId}`;
    timeoutMs = 15_000;
  }

  try {
    const res = await fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
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

    const problems = data.result.problems.map((p) =>
      normalizeCfProblem(p, contestId)
    );
    contestProblemsCache.set(contestId, {
      problems,
      expiresAt: Date.now() + CONTEST_TTL_MS,
    });

    return { problems };
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

export async function fetchCodeforcesProblem(
  contestId: number,
  index: string,
  options?: { isGym?: boolean }
): Promise<{
  problem?: NormalizedCfProblem;
  error?: string;
}> {
  const targetIndex = index.trim().toUpperCase();
  const isGymOrGroup = Boolean(options?.isGym) || contestId >= 100000;

  if (!isGymOrGroup) {
    const psMap = await loadProblemsetMap();
    const fromPs = psMap?.get(`${contestId}:${targetIndex}`);
    if (fromPs) {
      return { problem: fromPs };
    }
  }

  const { problems, error } = await fetchContestProblems(
    contestId,
    isGymOrGroup
  );
  if (error || !problems) {
    return {
      error: error ?? "Não foi possível obter os dados do problema.",
    };
  }

  const matched = problems.find((p) => p.index === targetIndex);
  if (!matched) {
    return {
      error: `Problema ${contestId}${targetIndex} não encontrado no contest ${contestId}.`,
    };
  }

  return { problem: matched };
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

  const paramsObj: Record<string, string> = { handle: cleanHandle };
  if (typeof count === "number" && count > 0) {
    paramsObj.from = "1";
    paramsObj.count = String(Math.floor(count));
  }

  const credentials = getCodeforcesApiCredentials();
  const endpoint = credentials
    ? await buildSignedCodeforcesUrl("user.status", paramsObj, credentials)
    : `https://codeforces.com/api/user.status?${new URLSearchParams(paramsObj).toString()}`;

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
      sampleProblem.contestId ??
      latestSub.contestId ??
      Number(externalId.split(":")[1]);
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
