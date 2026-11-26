import {
  extractCodeforcesGroupCode,
  fetchUserCodeforcesAcceptedSubmission,
  isValidCodeforcesSubmissionUrl,
  parseCodeforcesRef,
} from "@/lib/codeforces";
import { prisma } from "@/lib/prisma";
import {
  MAX_SOLUTION_CODE_LENGTH,
  normalizeOptionalSolutionCode,
  normalizeOptionalSolutionUrl,
} from "@/lib/url";
import type { SolutionAttachMode } from "@/types";

/**
 * Returns the subset of `ProblemLog` IDs that are solved and have non-null pasted `solutionCode`,
 * avoiding transferring full source code payloads on list views.
 */
export async function getLogIdsWithSolutionCode(
  logIds: string[]
): Promise<Set<string>> {
  const uniqueIds = Array.from(new Set(logIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    return new Set();
  }

  const rows = await prisma.problemLog.findMany({
    where: {
      id: { in: uniqueIds },
      solved: true,
      solutionCode: { not: null },
    },
    select: { id: true },
  });

  return new Set(rows.map((r) => r.id));
}

/**
 * Resolves and validates mutually exclusive solution fields (`solutionUrl` vs `solutionCode`)
 * on server mutations. Manual `solutionUrl` input is disallowed; submission links are only
 * accepted when auto-assembled for Codeforces problems.
 */
export async function resolveSubmittedSolution(params: {
  solved: boolean;
  problemUrl: string;
  userCfHandle?: string | null;
  solutionMode?: SolutionAttachMode;
  solutionUrl?: string | null;
  solutionCode?: string | null;
  allowAutoResolve?: boolean;
}): Promise<{
  error?: string;
  solutionUrl: string | null;
  solutionCode: string | null;
  updateSolutionCode: boolean;
}> {
  if (!params.solved) {
    return {
      solutionUrl: null,
      solutionCode: null,
      updateSolutionCode: true,
    };
  }

  const mode: SolutionAttachMode =
    params.solutionMode ??
    (params.solutionCode && params.solutionCode.trim().length > 0
      ? "code"
      : "link");

  if (mode === "code") {
    if (params.solutionCode === undefined) {
      return {
        solutionUrl: null,
        solutionCode: null,
        updateSolutionCode: false,
      };
    }

    const codeCheck = normalizeOptionalSolutionCode(params.solutionCode);
    if (codeCheck.tooLong) {
      return {
        error: `O código da solução não pode exceder ${MAX_SOLUTION_CODE_LENGTH} caracteres.`,
        solutionUrl: null,
        solutionCode: null,
        updateSolutionCode: false,
      };
    }

    return {
      solutionUrl: null,
      solutionCode: codeCheck.value,
      updateSolutionCode: true,
    };
  }

  const cfRef = parseCodeforcesRef(params.problemUrl);
  const rawUrl = params.solutionUrl?.trim() ?? "";

  if (!cfRef) {
    if (rawUrl.length > 0) {
      return {
        error:
          "O link da resolução é montado automaticamente apenas para questões do Codeforces.",
        solutionUrl: null,
        solutionCode: null,
        updateSolutionCode: true,
      };
    }
    return {
      solutionUrl: null,
      solutionCode: null,
      updateSolutionCode: true,
    };
  }

  if (rawUrl.length > 0) {
    const urlCheck = normalizeOptionalSolutionUrl(rawUrl);
    if (
      urlCheck.invalid ||
      !urlCheck.value ||
      !isValidCodeforcesSubmissionUrl(urlCheck.value, cfRef.contestId)
    ) {
      return {
        error:
          "O link da resolução deve ser montado automaticamente pelo sistema para esta questão do Codeforces.",
        solutionUrl: null,
        solutionCode: null,
        updateSolutionCode: true,
      };
    }

    return {
      solutionUrl: urlCheck.value,
      solutionCode: null,
      updateSolutionCode: true,
    };
  }

  if (params.allowAutoResolve !== false && params.userCfHandle?.trim()) {
    const groupCode = extractCodeforcesGroupCode(
      params.problemUrl,
      cfRef.contestId
    );
    const lookup = await fetchUserCodeforcesAcceptedSubmission(
      params.userCfHandle,
      cfRef.contestId,
      cfRef.index,
      { groupCode, timeoutMs: 5_000 }
    );

    return {
      solutionUrl: lookup.solutionUrl ?? null,
      solutionCode: null,
      updateSolutionCode: true,
    };
  }

  return {
    solutionUrl: null,
    solutionCode: null,
    updateSolutionCode: true,
  };
}
