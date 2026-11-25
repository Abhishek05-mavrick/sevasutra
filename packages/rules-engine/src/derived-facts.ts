/**
 * Derived facts — pure functions registered by name, versioned.
 * No I/O, no network, no Date.now(). All dates passed in.
 */

export interface DerivedFactResult {
  value: unknown;
  version: string;
}

/**
 * Compute age in full years on a reference date, given a date of birth.
 * Uses IST (Asia/Kolkata) calendar date convention.
 */
export function ageOn(dob: string, referenceDate: string): number {
  const birth = parseISODate(dob);
  const ref = parseISODate(referenceDate);

  let age = ref.year - birth.year;
  if (
    ref.month < birth.month ||
    (ref.month === birth.month && ref.day < birth.day)
  ) {
    age--;
  }
  return age;
}

/** Convert income to annual. period: "monthly" | "annual" | "daily" */
export function annualIncome(income: number, period: string): number {
  switch (period) {
    case "annual":
      return income;
    case "monthly":
      return income * 12;
    case "daily":
      return income * 365;
    default:
      return income; // assume annual
  }
}

/** Indian academic year: starts 1 June (or 1 July in some states). Returns "2025-26" style. */
export function academicYear(date: string, startMonth: number = 6): string {
  const d = parseISODate(date);
  const startYear = d.month >= startMonth ? d.year : d.year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

/**
 * Compute a derived fact by name.
 * Returns undefined if the derived fact is not registered.
 */
export function computeDerivedFact(
  name: string,
  args: Record<string, unknown>,
): DerivedFactResult | undefined {
  switch (name) {
    case "age_on":
      if (typeof args["dob"] === "string" && typeof args["reference_date"] === "string") {
        return { value: ageOn(args["dob"], args["reference_date"]), version: "1.0.0" };
      }
      return undefined;
    case "annual_income":
      if (typeof args["income"] === "number" && typeof args["period"] === "string") {
        return { value: annualIncome(args["income"], args["period"]), version: "1.0.0" };
      }
      return undefined;
    case "academic_year":
      if (typeof args["date"] === "string") {
        const startMonth = typeof args["start_month"] === "number" ? args["start_month"] : 6;
        return { value: academicYear(args["date"], startMonth), version: "1.0.0" };
      }
      return undefined;
    default:
      return undefined;
  }
}

/** Parse ISO date string "YYYY-MM-DD" into components. Pure, no timezone issues. */
function parseISODate(iso: string): { year: number; month: number; day: number } {
  const parts = iso.split("-");
  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2]),
  };
}
