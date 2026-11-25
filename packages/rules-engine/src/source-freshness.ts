import type { SchemeRuleVersion, SourceFreshness } from "rules-schema";

/** Compute source freshness info. Default stale threshold: 180 days. */
export function computeSourceFreshness(
  scheme: SchemeRuleVersion,
  evaluationDate: string,
  staleThresholdDays: number = 180,
): SourceFreshness {
  const ageDays = daysBetween(scheme.source.last_verified_on, evaluationDate);
  return {
    last_verified_on: scheme.source.last_verified_on,
    age_days: ageDays,
    stale: ageDays > staleThresholdDays,
    source_url: scheme.source.url,
    source_hash: scheme.source.source_hash,
  };
}

function daysBetween(from: string, to: string): number {
  const f = parseDateToEpochDay(from);
  const t = parseDateToEpochDay(to);
  return Math.max(0, t - f);
}

function parseDateToEpochDay(iso: string): number {
  const parts = iso.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const a = Math.floor((14 - m) / 12);
  const yr = y + 4800 - a;
  const mo = m + 12 * a - 3;
  return d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045;
}
