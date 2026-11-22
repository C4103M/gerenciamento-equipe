import type { Difficulty } from "@prisma/client";
import type { TopicItem } from "@/types";

export interface LeetCodeProblemRef {
  titleSlug: string;
  externalId: string;
  canonicalUrl: string;
}

export type LcDifficulty = "Easy" | "Medium" | "Hard";

export interface LcTopicTag {
  name: string;
  slug: string;
}

export interface NormalizedLcProblem {
  frontendId: string | null;
  title: string;
  titleSlug: string;
  difficulty: LcDifficulty | null;
  isPaidOnly: boolean;
  tags: LcTopicTag[];
}

export interface LcApiAcSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
}

export interface LcApiSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
  statusDisplay: string;
  lang?: string;
}

export interface AggregatedLcProblem {
  externalId: string;
  titleSlug: string;
  frontendId: string | null;
  code: string;
  title: string;
  canonicalUrl: string;
  lcDifficulty: LcDifficulty | null;
  tagNames: string[];
  tagSlugs: string[];
  solved: boolean;
  attemptCount: number;
  activityAt: string;
  latestAcAt: string | null;
  withinGraceWindow: boolean;
  latestSubmissionId: string;
}

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";
const QUESTION_TTL_MS = 24 * 60 * 60 * 1000;
const BATCH_CHUNK_SIZE = 20;
const MAX_SLUG_LENGTH = 150;
const LC_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const questionCache = new Map<
  string,
  { problem: NormalizedLcProblem; expiresAt: number }
>();

export const LC_TAG_TO_TOPIC_SLUGS: Record<string, string[]> = {
  "dynamic-programming": ["programacao-dinamica"],
  memoization: ["programacao-dinamica"],
  "union-find": ["union-find-dsu"],
  "binary-search": ["busca-binaria"],
  "shortest-path": ["caminhos-minimos"],
  tree: ["arvore"],
  "binary-tree": ["arvore"],
  "binary-search-tree": ["arvore"],
  trie: ["arvore", "strings"],
  graph: ["grafos"],
  "depth-first-search": ["grafos"],
  "breadth-first-search": ["grafos"],
  "topological-sort": ["grafos"],
  "strongly-connected-component": ["grafos"],
  "biconnected-component": ["grafos"],
  "minimum-spanning-tree": ["grafos"],
  "eulerian-circuit": ["grafos"],
  "two-pointers": ["two-pointers"],
  "sliding-window": ["two-pointers"],
  "bit-manipulation": ["bitmask"],
  bitmask: ["bitmask"],
  "segment-tree": ["segment-tree-bit"],
  "binary-indexed-tree": ["segment-tree-bit"],
  stack: ["pilha"],
  "monotonic-stack": ["pilha"],
  queue: ["fila-deque"],
  "monotonic-queue": ["fila-deque"],
  "heap-priority-queue": ["estruturas-de-dados"],
  "hash-table": ["estruturas-de-dados"],
  "linked-list": ["estruturas-de-dados"],
  "doubly-linked-list": ["estruturas-de-dados"],
  "ordered-set": ["estruturas-de-dados"],
  "data-stream": ["estruturas-de-dados"],
  design: ["estruturas-de-dados"],
  "prefix-sum": ["estruturas-de-dados"],
  "line-sweep": ["estruturas-de-dados"],
  string: ["strings"],
  "string-matching": ["strings"],
  "rolling-hash": ["strings"],
  "suffix-array": ["strings"],
  math: ["matematica-computacional"],
  "probability-and-statistics": ["matematica-computacional"],
  matrix: ["matematica-computacional"],
  "game-theory": ["matematica-computacional"],
  brainteaser: ["matematica-computacional"],
  randomized: ["matematica-computacional"],
  "rejection-sampling": ["matematica-computacional"],
  "reservoir-sampling": ["matematica-computacional"],
  "number-theory": ["teoria-dos-numeros"],
  combinatorics: ["combinatoria"],
  counting: ["combinatoria"],
  geometry: ["geometria-computacional"],
  greedy: ["algoritmos-gulosos"],
  "divide-and-conquer": ["divisao-e-conquista"],
  "merge-sort": ["divisao-e-conquista"],
  quickselect: ["divisao-e-conquista"],
  backtracking: ["backtracking"],
  recursion: ["backtracking"],
  enumeration: ["backtracking"],
  sorting: ["ordenacao"],
  "bucket-sort": ["ordenacao"],
  "counting-sort": ["ordenacao"],
  "radix-sort": ["ordenacao"],
  simulation: ["implementacao-ad-hoc"],
  interactive: ["implementacao-ad-hoc"],
  iterator: ["implementacao-ad-hoc"],
};

function isValidLeetCodeSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && LC_SLUG_REGEX.test(slug);
}

function normalizeLcDifficulty(raw?: string | null): LcDifficulty | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower === "easy") return "Easy";
  if (lower === "medium") return "Medium";
  if (lower === "hard") return "Hard";
  return null;
}

/**
 * Parses LeetCode problem URLs (leetcode.com/problems/..., contest URLs, leetcode.cn)
 * or explicit LC shorthand (e.g. "LC two-sum", "leetcode:two-sum").
 */
export function parseLeetCodeRef(raw: string): LeetCodeProblemRef | null {
  const input = raw.trim();
  if (!input) return null;

  let candidateSlug: string | null = null;

  const urlMatch = input.match(
    /^(?:https?:\/\/)?(?:www\.)?leetcode\.(?:com|cn)\/(?:contest\/[^/?#]+\/)?problems\/([a-z0-9-]+)(?:[/?#]|$)/i
  );
  if (urlMatch) {
    candidateSlug = urlMatch[1].toLowerCase();
  }

  if (!candidateSlug) {
    const shorthandMatch = input.match(
      /^(?:LC|LEETCODE)[\s:/_-]+([a-z0-9]+(?:-[a-z0-9]+)*)$/i
    );
    if (shorthandMatch) {
      candidateSlug = shorthandMatch[1].toLowerCase();
    }
  }

  if (!candidateSlug || !isValidLeetCodeSlug(candidateSlug)) {
    return null;
  }

  return {
    titleSlug: candidateSlug,
    externalId: `lc:${candidateSlug}`,
    canonicalUrl: `https://leetcode.com/problems/${candidateSlug}/`,
  };
}

export function formatLeetCodeTitle(
  frontendId: string | null | undefined,
  title: string,
  fallbackSlug?: string
): string {
  const cleanId = frontendId?.trim();
  const cleanTitle = title.trim();
  if (cleanId && cleanTitle) {
    return `LC ${cleanId} - ${cleanTitle}`;
  }
  if (cleanTitle) {
    return `LC - ${cleanTitle}`;
  }
  return `LC - ${fallbackSlug?.trim() || "Problema"}`;
}

export function mapLcDifficultyToDifficulty(
  diff?: string | null
): Difficulty | null {
  if (!diff) return null;
  const lower = diff.trim().toLowerCase();
  if (lower === "easy") return "FACIL";
  if (lower === "medium") return "MEDIO";
  if (lower === "hard") return "DIFICIL";
  return null;
}

export function mapLcTagsToTopicIds(
  lcTagSlugs: string[],
  allTopics: TopicItem[],
  fallbackSlug?: string
): string[] {
  const slugToId = new Map<string, string>();
  for (const topic of allTopics) {
    slugToId.set(topic.slug, topic.id);
  }

  const matched = new Set<string>();
  for (const rawSlug of lcTagSlugs) {
    const slugs = LC_TAG_TO_TOPIC_SLUGS[rawSlug.trim().toLowerCase()];
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

interface GraphQLRawResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

interface RawLcQuestion {
  questionFrontendId?: string | null;
  title?: string | null;
  titleSlug?: string | null;
  difficulty?: string | null;
  isPaidOnly?: boolean | null;
  topicTags?: Array<{ name?: string | null; slug?: string | null }> | null;
}

function normalizeLcQuestion(
  raw: RawLcQuestion,
  fallbackSlug: string
): NormalizedLcProblem | null {
  const rawSlug = raw.titleSlug?.trim().toLowerCase() || fallbackSlug;
  if (!isValidLeetCodeSlug(rawSlug)) {
    return null;
  }

  const tags: LcTopicTag[] = [];
  if (Array.isArray(raw.topicTags)) {
    for (const t of raw.topicTags) {
      const slug = t.slug?.trim().toLowerCase();
      const name = t.name?.trim();
      if (slug && name) {
        tags.push({ name, slug });
      }
    }
  }

  return {
    frontendId: raw.questionFrontendId?.trim() || null,
    title: raw.title?.trim() || rawSlug,
    titleSlug: rawSlug,
    difficulty: normalizeLcDifficulty(raw.difficulty),
    isPaidOnly: Boolean(raw.isPaidOnly),
    tags,
  };
}

async function postLeetCodeGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  timeoutMs = 15_000
): Promise<{ data?: T; errors?: Array<{ message?: string }>; error?: string }> {
  try {
    const res = await fetch(LEETCODE_GRAPHQL_URL, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Referer: "https://leetcode.com/",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 403) {
      return {
        error:
          "O LeetCode bloqueou temporariamente a consulta (proteção Cloudflare / HTTP 403). Tente novamente em alguns minutos.",
      };
    }

    if (res.status === 429 || res.status === 503) {
      return {
        error:
          "Limite de requisições do LeetCode atingido temporariamente. Aguarde alguns segundos e tente novamente.",
      };
    }

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    if (!contentType.toLowerCase().includes("application/json")) {
      const lower = text.toLowerCase();
      if (
        lower.includes("cloudflare") ||
        lower.includes("just a moment") ||
        lower.includes("<html")
      ) {
        return {
          error:
            "O LeetCode bloqueou temporariamente a consulta (proteção Cloudflare / HTTP 403). Tente novamente em alguns minutos.",
        };
      }
      return {
        error: `Resposta inesperada do LeetCode (HTTP ${res.status}). Tente novamente.`,
      };
    }

    let parsed: GraphQLRawResponse<T>;
    try {
      parsed = JSON.parse(text) as GraphQLRawResponse<T>;
    } catch {
      return {
        error:
          "O LeetCode bloqueou temporariamente a consulta (proteção Cloudflare / HTTP 403). Tente novamente em alguns minutos.",
      };
    }

    if (!res.ok && !parsed.data && !parsed.errors?.length) {
      return {
        error: `O LeetCode retornou erro HTTP ${res.status}. Tente novamente.`,
      };
    }

    return {
      data: parsed.data,
      errors: parsed.errors,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        error: "Tempo esgotado ao consultar o LeetCode. Tente novamente.",
      };
    }
    return {
      error:
        "Não foi possível conectar ao LeetCode. Verifique sua conexão ou tente novamente.",
    };
  }
}

const QUESTION_DETAILS_QUERY = `
  query questionDetails($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      title
      titleSlug
      difficulty
      isPaidOnly
      topicTags {
        name
        slug
      }
    }
  }
`;

export async function fetchLeetCodeQuestion(titleSlug: string): Promise<{
  problem?: NormalizedLcProblem;
  error?: string;
}> {
  const cleanSlug = titleSlug.trim().toLowerCase();
  if (!isValidLeetCodeSlug(cleanSlug)) {
    return { error: "Slug do problema LeetCode inválido." };
  }

  const now = Date.now();
  const cached = questionCache.get(cleanSlug);
  if (cached && cached.expiresAt > now) {
    return { problem: cached.problem };
  }

  const res = await postLeetCodeGraphQL<{ question?: RawLcQuestion | null }>(
    QUESTION_DETAILS_QUERY,
    { titleSlug: cleanSlug },
    12_000
  );

  if (res.error) {
    return { error: res.error };
  }

  if (!res.data?.question) {
    return { error: "Problema não encontrado no LeetCode." };
  }

  const normalized = normalizeLcQuestion(res.data.question, cleanSlug);
  if (!normalized) {
    return { error: "Não foi possível interpretar os dados do problema." };
  }

  questionCache.set(cleanSlug, {
    problem: normalized,
    expiresAt: Date.now() + QUESTION_TTL_MS,
  });

  return { problem: normalized };
}

export async function fetchLeetCodeQuestionsBatch(
  titleSlugs: string[]
): Promise<Map<string, NormalizedLcProblem>> {
  const result = new Map<string, NormalizedLcProblem>();
  const now = Date.now();
  const uncached: string[] = [];
  const seen = new Set<string>();

  for (const rawSlug of titleSlugs) {
    const cleanSlug = rawSlug.trim().toLowerCase();
    if (!isValidLeetCodeSlug(cleanSlug) || seen.has(cleanSlug)) {
      continue;
    }
    seen.add(cleanSlug);

    const cached = questionCache.get(cleanSlug);
    if (cached && cached.expiresAt > now) {
      result.set(cleanSlug, cached.problem);
    } else {
      uncached.push(cleanSlug);
    }
  }

  for (let i = 0; i < uncached.length; i += BATCH_CHUNK_SIZE) {
    const chunk = uncached.slice(i, i + BATCH_CHUNK_SIZE);
    const varDecls = chunk.map((_, idx) => `$s${idx}: String!`).join(", ");
    const fields = chunk
      .map(
        (_, idx) => `
          q${idx}: question(titleSlug: $s${idx}) {
            questionFrontendId
            title
            titleSlug
            difficulty
            isPaidOnly
            topicTags {
              name
              slug
            }
          }
        `
      )
      .join("\n");

    const query = `query batchQuestionDetails(${varDecls}) {\n${fields}\n}`;
    const variables: Record<string, string> = {};
    chunk.forEach((slug, idx) => {
      variables[`s${idx}`] = slug;
    });

    const res = await postLeetCodeGraphQL<
      Record<string, RawLcQuestion | null | undefined>
    >(query, variables, 15_000);

    if (res.error || !res.data) {
      continue;
    }

    chunk.forEach((slug, idx) => {
      const raw = res.data?.[`q${idx}`];
      if (!raw) return;
      const normalized = normalizeLcQuestion(raw, slug);
      if (!normalized) return;
      questionCache.set(slug, {
        problem: normalized,
        expiresAt: Date.now() + QUESTION_TTL_MS,
      });
      result.set(slug, normalized);
    });
  }

  return result;
}

const USER_RECENT_SUBMISSIONS_QUERY = `
  query userRecentSubmissions($username: String!, $limit: Int!) {
    matchedUser(username: $username) {
      username
    }
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
    recentSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
  }
`;

export async function fetchLeetCodeUserRecentSubmissions(
  username: string
): Promise<{
  recentAc?: LcApiAcSubmission[];
  recentAll?: LcApiSubmission[];
  error?: string;
}> {
  const cleanHandle = username.trim();
  if (!cleanHandle) {
    return { error: "Handle do LeetCode não configurado." };
  }

  const res = await postLeetCodeGraphQL<{
    matchedUser?: { username?: string } | null;
    recentAcSubmissionList?: LcApiAcSubmission[] | null;
    recentSubmissionList?: LcApiSubmission[] | null;
  }>(
    USER_RECENT_SUBMISSIONS_QUERY,
    { username: cleanHandle, limit: 20 },
    20_000
  );

  if (res.error) {
    return { error: res.error };
  }

  const errMsg = res.errors
    ?.map((e) => e.message ?? "")
    .join(" ")
    .toLowerCase();

  if (
    res.data?.matchedUser === null ||
    (errMsg && errMsg.includes("not exist"))
  ) {
    return { error: `Handle "${cleanHandle}" não encontrado no LeetCode.` };
  }

  if (!res.data) {
    const firstMsg = res.errors?.[0]?.message;
    return {
      error: firstMsg
        ? `Erro da API do LeetCode: ${firstMsg}`
        : "Não foi possível consultar as submissões no LeetCode.",
    };
  }

  return {
    recentAc: Array.isArray(res.data.recentAcSubmissionList)
      ? res.data.recentAcSubmissionList
      : [],
    recentAll: Array.isArray(res.data.recentSubmissionList)
      ? res.data.recentSubmissionList
      : [],
  };
}

function parseTimestampMs(rawTimestamp: string): number | null {
  const seconds = Number(rawTimestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return Math.round(seconds * 1000);
}

function compareSubmissionOrder(
  a: LcApiSubmission,
  b: LcApiSubmission
): number {
  const tsDiff = Number(a.timestamp) - Number(b.timestamp);
  if (tsDiff !== 0) return tsDiff;
  return Number(a.id) - Number(b.id);
}

export function aggregateLeetCodeSubmissions(
  recentAc: LcApiAcSubmission[],
  recentAll: LcApiSubmission[],
  metadataBySlug: Map<string, NormalizedLcProblem>,
  graceMinutes: number,
  nowMs: number = Date.now()
): AggregatedLcProblem[] {
  const acBySlug = new Map<string, LcApiAcSubmission>();
  for (const ac of recentAc) {
    const slug = ac.titleSlug?.trim().toLowerCase();
    if (!slug || !isValidLeetCodeSlug(slug)) continue;
    if (parseTimestampMs(ac.timestamp) === null) continue;
    const prev = acBySlug.get(slug);
    if (
      !prev ||
      Number(ac.timestamp) > Number(prev.timestamp) ||
      (ac.timestamp === prev.timestamp && Number(ac.id) > Number(prev.id))
    ) {
      acBySlug.set(slug, { ...ac, titleSlug: slug });
    }
  }

  const allBySlug = new Map<string, LcApiSubmission[]>();
  for (const sub of recentAll) {
    const slug = sub.titleSlug?.trim().toLowerCase();
    if (!slug || !isValidLeetCodeSlug(slug)) continue;
    if (parseTimestampMs(sub.timestamp) === null) continue;
    const normalizedSub: LcApiSubmission = { ...sub, titleSlug: slug };
    const list = allBySlug.get(slug);
    if (list) {
      list.push(normalizedSub);
    } else {
      allBySlug.set(slug, [normalizedSub]);
    }
  }

  const allSlugs = new Set<string>([...acBySlug.keys(), ...allBySlug.keys()]);
  const aggregated: AggregatedLcProblem[] = [];

  for (const titleSlug of allSlugs) {
    const acRecord = acBySlug.get(titleSlug);
    const list = allBySlug.get(titleSlug) ?? [];
    list.sort(compareSubmissionOrder);

    const nonCe = list.filter(
      (s) => s.statusDisplay.trim().toLowerCase() !== "compile error"
    );
    const countable = nonCe.length > 0 ? nonCe : list;

    const firstOkIdx = countable.findIndex(
      (s) => s.statusDisplay.trim().toLowerCase() === "accepted"
    );
    const solved = firstOkIdx !== -1 || Boolean(acRecord);

    const attemptCount =
      firstOkIdx !== -1
        ? Math.max(1, firstOkIdx + 1)
        : solved
          ? 1
          : Math.max(1, countable.length);

    const latestSub = list.length > 0 ? list[list.length - 1] : undefined;

    let activityMs: number | null = null;
    if (firstOkIdx !== -1) {
      activityMs = parseTimestampMs(countable[firstOkIdx].timestamp);
    } else if (acRecord) {
      activityMs = parseTimestampMs(acRecord.timestamp);
    } else if (latestSub) {
      activityMs = parseTimestampMs(latestSub.timestamp);
    }
    if (activityMs === null) continue;

    let latestAcMs: number | null = null;
    for (const sub of list) {
      if (sub.statusDisplay.trim().toLowerCase() === "accepted") {
        const ms = parseTimestampMs(sub.timestamp);
        if (ms !== null && (latestAcMs === null || ms > latestAcMs)) {
          latestAcMs = ms;
        }
      }
    }
    if (acRecord) {
      const acMs = parseTimestampMs(acRecord.timestamp);
      if (acMs !== null && (latestAcMs === null || acMs > latestAcMs)) {
        latestAcMs = acMs;
      }
    }

    let lastActivityMs = 0;
    for (const sub of list) {
      const ms = parseTimestampMs(sub.timestamp);
      if (ms !== null && ms > lastActivityMs) {
        lastActivityMs = ms;
      }
    }
    if (acRecord) {
      const acMs = parseTimestampMs(acRecord.timestamp);
      if (acMs !== null && acMs > lastActivityMs) {
        lastActivityMs = acMs;
      }
    }

    const withinGraceWindow =
      !solved &&
      graceMinutes > 0 &&
      nowMs - lastActivityMs < graceMinutes * 60_000;

    const meta = metadataBySlug.get(titleSlug);
    const rawTitle = meta?.title ?? acRecord?.title ?? latestSub?.title ?? titleSlug;
    const frontendId = meta?.frontendId ?? null;
    const code = frontendId ? `#${frontendId}` : titleSlug;
    const latestSubmissionId = latestSub?.id ?? acRecord?.id ?? "";

    aggregated.push({
      externalId: `lc:${titleSlug}`,
      titleSlug,
      frontendId,
      code,
      title: formatLeetCodeTitle(frontendId, rawTitle, titleSlug),
      canonicalUrl: `https://leetcode.com/problems/${titleSlug}/`,
      lcDifficulty: meta?.difficulty ?? null,
      tagNames: meta?.tags.map((t) => t.name) ?? [],
      tagSlugs: meta?.tags.map((t) => t.slug) ?? [],
      solved,
      attemptCount,
      activityAt: new Date(activityMs).toISOString(),
      latestAcAt: latestAcMs !== null ? new Date(latestAcMs).toISOString() : null,
      withinGraceWindow,
      latestSubmissionId,
    });
  }

  aggregated.sort(
    (a, b) =>
      new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime()
  );

  return aggregated;
}
