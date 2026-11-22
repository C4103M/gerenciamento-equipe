import type { PeriodFilterValue } from "@/lib/period";

function appendPeriodParams(
  sp: URLSearchParams,
  period?: PeriodFilterValue
): void {
  if (!period || period.preset === "all") return;
  sp.set("periodo", period.preset);
  if (period.preset === "custom") {
    if (period.from) sp.set("from", period.from);
    if (period.to) sp.set("to", period.to);
  }
}

/** Builds a dashboard `/` URL preserving the active period filter and optional member selection. */
export function buildDashboardHref(
  period: PeriodFilterValue,
  memberId?: string | null
): string {
  const sp = new URLSearchParams();
  if (memberId) {
    sp.set("membro", memberId);
  }
  appendPeriodParams(sp, period);
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

/** Builds a `/questoes` drill-down URL matching the query params accepted by QuestoesPage. */
export function buildQuestoesHref(options: {
  memberId?: string | null;
  topicId?: string | null;
  status?: "SOLVED" | "REVIEW";
  period?: PeriodFilterValue;
}): string {
  const sp = new URLSearchParams();
  if (options.memberId) {
    sp.set("member", options.memberId);
  }
  if (options.topicId) {
    sp.set("topic", options.topicId);
  }
  if (options.status) {
    sp.set("status", options.status);
  }
  appendPeriodParams(sp, options.period);
  const qs = sp.toString();
  return qs ? `/questoes?${qs}` : "/questoes";
}
