const MAX_URL_LENGTH = 2000;
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
