export type PeriodPreset =
  | "all"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "year"
  | "custom";

export interface PeriodFilterValue {
  preset: PeriodPreset;
  from?: string;
  to?: string;
}

export const PERIOD_PRESET_OPTIONS: Array<{
  value: Exclude<PeriodPreset, "custom">;
  label: string;
}> = [
  { value: "all", label: "Todo o período" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "month", label: "Este mês" },
  { value: "year", label: "Este ano" },
];

const VALID_PRESETS = new Set<PeriodPreset>([
  "all",
  "7d",
  "30d",
  "90d",
  "month",
  "year",
  "custom",
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDateString(value?: string): value is string {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() === m - 1 &&
    parsed.getDate() === d
  );
}

function parseIsoDateBoundary(
  value: string,
  endOfDay: boolean
): Date | undefined {
  if (!isValidIsoDateString(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatIsoDateForLabel(iso: string): string {
  if (!isValidIsoDateString(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function parsePeriodSearchParams(params?: {
  periodo?: string;
  from?: string;
  to?: string;
}): PeriodFilterValue {
  const rawPreset = params?.periodo?.trim() as PeriodPreset | undefined;
  if (!rawPreset || !VALID_PRESETS.has(rawPreset) || rawPreset === "all") {
    return { preset: "all" };
  }

  if (rawPreset === "custom") {
    const from = isValidIsoDateString(params?.from?.trim())
      ? params?.from?.trim()
      : undefined;
    const to = isValidIsoDateString(params?.to?.trim())
      ? params?.to?.trim()
      : undefined;
    if (!from && !to) {
      return { preset: "all" };
    }
    return { preset: "custom", from, to };
  }

  return { preset: rawPreset };
}

export function getPeriodDateBounds(
  filter: PeriodFilterValue,
  now: Date = new Date()
): { start?: Date; end?: Date } {
  if (filter.preset === "all") {
    return {};
  }

  if (filter.preset === "custom") {
    let start = filter.from ? parseIsoDateBoundary(filter.from, false) : undefined;
    let end = filter.to ? parseIsoDateBoundary(filter.to, true) : undefined;

    if (start && end && start.getTime() > end.getTime()) {
      const startIso = filter.to!;
      const endIso = filter.from!;
      start = parseIsoDateBoundary(startIso, false);
      end = parseIsoDateBoundary(endIso, true);
    }

    return { start, end };
  }

  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  if (filter.preset === "7d" || filter.preset === "30d" || filter.preset === "90d") {
    const days = filter.preset === "7d" ? 7 : filter.preset === "30d" ? 30 : 90;
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (days - 1),
      0,
      0,
      0,
      0
    );
    return { start, end };
  }

  if (filter.preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { start, end };
  }

  if (filter.preset === "year") {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { start, end };
  }

  return {};
}

export function isDateInPeriod(
  date: Date | string,
  filter: PeriodFilterValue,
  now: Date = new Date()
): boolean {
  if (filter.preset === "all") return true;
  const bounds = getPeriodDateBounds(filter, now);
  const target = typeof date === "string" ? new Date(date) : date;
  const ms = target.getTime();
  if (Number.isNaN(ms)) return false;

  if (bounds.start && ms < bounds.start.getTime()) return false;
  if (bounds.end && ms > bounds.end.getTime()) return false;
  return true;
}

export function formatPeriodLabel(filter: PeriodFilterValue): string {
  if (filter.preset === "custom") {
    if (filter.from && filter.to) {
      return `${formatIsoDateForLabel(filter.from)} – ${formatIsoDateForLabel(filter.to)}`;
    }
    if (filter.from) {
      return `A partir de ${formatIsoDateForLabel(filter.from)}`;
    }
    if (filter.to) {
      return `Até ${formatIsoDateForLabel(filter.to)}`;
    }
    return "Período personalizado";
  }

  const found = PERIOD_PRESET_OPTIONS.find((opt) => opt.value === filter.preset);
  return found?.label ?? "Todo o período";
}

export function buildPeriodQueryString(filter: PeriodFilterValue): string {
  if (filter.preset === "all") return "";
  const sp = new URLSearchParams();
  sp.set("periodo", filter.preset);
  if (filter.preset === "custom") {
    if (filter.from) sp.set("from", filter.from);
    if (filter.to) sp.set("to", filter.to);
  }
  return `?${sp.toString()}`;
}

export function buildPrismaProblemPeriodWhere(
  filter: PeriodFilterValue,
  now: Date = new Date()
): Record<string, unknown> {
  if (filter.preset === "all") return {};
  const bounds = getPeriodDateBounds(filter, now);
  if (!bounds.start && !bounds.end) return {};

  const dateRange: { gte?: Date; lte?: Date } = {};
  if (bounds.start) dateRange.gte = bounds.start;
  if (bounds.end) dateRange.lte = bounds.end;

  return {
    OR: [
      { reviewedAt: dateRange },
      { reviewedAt: null, createdAt: dateRange },
    ],
  };
}
