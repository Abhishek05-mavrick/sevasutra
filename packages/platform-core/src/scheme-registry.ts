import type { SchemeRuleVersion } from "rules-schema";

export type SchemeLevel = "local" | "central" | "state" | "ut" | "joint" | "third_party";
export type ScholarshipType = "central" | "state" | "university" | "corporate_csr" | "fellowship";
export type ApplicationMode =
  | "official_url"
  | "official_portal"
  | "authorised_api"
  | "csc_offline"
  | "department_office"
  | "unavailable";

export interface CanonicalSchemeMetadata {
  scheme_id: string;
  official_name: string;
  aliases: string[];
  ministry_department: string;
  level: SchemeLevel;
  state_ut_scope: string[];
  category: string;
  scholarship_type?: ScholarshipType;
  is_non_government: boolean;
  provider_name?: string;
  target_groups: string[];
  application_mode: ApplicationMode;
  official_portal_url: string;
  summary: { en: string; hi?: string };
}

export interface SchemeFilter {
  ministry?: string;
  level?: SchemeLevel;
  state?: string;
  category?: string;
  benefit_type?: string;
  application_mode?: ApplicationMode;
  scholarship_type?: ScholarshipType;
  query?: string;
}

export function filterSchemes(
  items: ReadonlyArray<{ metadata: CanonicalSchemeMetadata; rule: SchemeRuleVersion }>,
  filter: SchemeFilter,
): Array<{ metadata: CanonicalSchemeMetadata; rule: SchemeRuleVersion }> {
  return items.filter(({ metadata, rule }) => {
    if (filter.ministry && metadata.ministry_department !== filter.ministry) return false;
    if (filter.level && metadata.level !== filter.level) return false;
    if (filter.state && metadata.state_ut_scope.length > 0 && !metadata.state_ut_scope.includes(filter.state)) {
      return false;
    }
    if (filter.category && metadata.category !== filter.category) return false;
    if (filter.benefit_type && rule.benefit.type !== filter.benefit_type) return false;
    if (filter.application_mode && metadata.application_mode !== filter.application_mode) return false;
    if (filter.scholarship_type && metadata.scholarship_type !== filter.scholarship_type) return false;
    if (filter.query) {
      const q = filter.query.toLowerCase();
      const hay = `${metadata.official_name} ${metadata.aliases.join(" ")} ${metadata.summary.en}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
