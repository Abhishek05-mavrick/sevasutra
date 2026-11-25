import type { SchemeRuleVersion, DeadlineInfo } from "rules-schema";

/** Compute deadline info for a scheme. */
export function computeDeadline(
  scheme: SchemeRuleVersion,
  evaluationDate: string,
): DeadlineInfo {
  const window = scheme.application_window;

  if (!window) {
    return { status: "unknown" };
  }

  if (window.rolling) {
    return { status: "rolling" };
  }

  if (window.closes) {
    if (evaluationDate > window.closes) {
      return {
        closes: window.closes,
        days_remaining: 0,
        status: "closed",
      };
    }

    const remaining = daysBetween(evaluationDate, window.closes);

    return {
      closes: window.closes,
      days_remaining: remaining,
      status: remaining <= 30 ? "closing_soon" : "open",
    };
  }

  if (window.opens && evaluationDate < window.opens) {
    return { status: "unknown" }; // Not yet open
  }

  return { status: "open" };
}

/** Pure day difference computation. Both dates in ISO "YYYY-MM-DD" format. */
function daysBetween(from: string, to: string): number {
  const f = parseDateToEpochDay(from);
  const t = parseDateToEpochDay(to);
  return t - f;
}

/** Convert ISO date to epoch day number (days since epoch). Pure arithmetic. */
function parseDateToEpochDay(iso: string): number {
  const parts = iso.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);

  // Use a simple day count formula (Rata Die variant)
  const a = Math.floor((14 - m) / 12);
  const yr = y + 4800 - a;
  const mo = m + 12 * a - 3;
  return d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045;
}
