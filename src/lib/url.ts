const MAX_URL_LENGTH = 2000;
export const MAX_SOLUTION_CODE_LENGTH = 50_000;
const EXPLICIT_SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/**
 * Validates and normalizes a user-supplied URL, allowing strictly HTTP(S) protocols.
 * Rejects dangerous schemes such as `javascript:`, `data:`, or `vbscript:`.
 */
export function sanitizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    return null;
  }

  const schemeMatch = trimmed.match(EXPLICIT_SCHEME_RE);
  let candidate = trimmed;

  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") {
      return null;
    }
  } else {
    if (trimmed.startsWith("//")) {
      return null;
    }
    candidate = `https://${trimmed}`;
  }

  if (candidate.length > MAX_URL_LENGTH) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      !parsed.hostname
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Validates an optional solution URL, allowing empty strings as `null`.
 * Non-empty values must be valid HTTP(S) URLs.
 */
export function normalizeOptionalSolutionUrl(raw?: string | null): {
  value: string | null;
  invalid: boolean;
} {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return { value: null, invalid: false };
  }
  const safeUrl = sanitizeHttpUrl(trimmed);
  if (!safeUrl) {
    return { value: null, invalid: true };
  }
  return { value: safeUrl, invalid: false };
}

/**
 * Normalizes an optional pasted solution source code while preserving leading indentation.
 */
export function normalizeOptionalSolutionCode(raw?: string | null): {
  value: string | null;
  tooLong: boolean;
} {
  if (!raw || raw.trim().length === 0) {
    return { value: null, tooLong: false };
  }
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  if (normalized.length > MAX_SOLUTION_CODE_LENGTH) {
    return { value: null, tooLong: true };
  }
  return { value: normalized, tooLong: false };
}
