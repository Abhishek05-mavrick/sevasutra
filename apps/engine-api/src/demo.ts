import { evaluate } from "rules-engine";
import { SEED_SCHEMES, SAMPLE_PROFILES } from "rules-fixtures";

/**
 * CLI Demo — evaluate a profile against all seed schemes.
 * Usage: node dist/demo.js
 *
 * This is a minimal demonstration. In production, profiles and
 * scheme selection would come from the API layer.
 */

const EVAL_DATE = "2025-06-15";

// Pick profile from CLI args or default to "asha"
const profileName = process.argv[2] ?? "asha";
const profile = SAMPLE_PROFILES[profileName as keyof typeof SAMPLE_PROFILES];

if (!profile) {
  console.error(`Unknown profile: "${profileName}". Available: ${Object.keys(SAMPLE_PROFILES).join(", ")}`);
  process.exit(1);
}

// Optional: filter to a specific scheme
const schemeFilter = process.argv[3];
const schemes = schemeFilter
  ? SEED_SCHEMES.filter((s) => s.scheme_id === schemeFilter)
  : SEED_SCHEMES;

if (schemes.length === 0) {
  console.error(`No scheme found with id: "${schemeFilter}". Available: ${SEED_SCHEMES.map((s) => s.scheme_id).join(", ")}`);
  process.exit(1);
}

console.log(`\n${"=".repeat(60)}`);
console.log(`  Sahayak — Eligibility Evaluation Demo`);
console.log(`  Profile: ${profileName}`);
console.log(`  Evaluation Date: ${EVAL_DATE}`);
console.log(`  Schemes: ${schemes.length}`);
console.log(`${"=".repeat(60)}\n`);

for (const scheme of schemes) {
  const result = evaluate(scheme, profile, EVAL_DATE);

  console.log(`── ${scheme.source.title} ──`);
  console.log(`   Scheme ID:    ${result.scheme_id}`);
  console.log(`   State:        ${stateEmoji(result.state)} ${result.state}`);
  console.log(`   Passed:       ${result.passed.length} criteria`);
  console.log(`   Failed:       ${result.failed.length} criteria`);
  console.log(`   Missing Info: ${result.missing_info.length} items`);
  console.log(`   Unverified:   ${result.unverified.length} facts`);
  console.log(`   Conflicts:    ${result.conflicts.length}`);
  console.log(`   Benefit:      ${formatBenefit(result.benefit)}`);
  console.log(`   Deadline:     ${result.deadline.status}`);
  console.log(`   Source Fresh:  ${result.source_freshness.stale ? "⚠ STALE" : "✓ OK"} (${result.source_freshness.age_days} days)`);
  console.log(`   Eval ID:      ${result.evaluation_id}`);

  if (result.what_would_change.length > 0) {
    console.log(`   What-If:`);
    for (const wi of result.what_would_change) {
      console.log(`     - ${wi.condition_description.en}`);
    }
  }

  console.log(`   Disclaimer:   This is informational, not an official decision.\n`);
}

function stateEmoji(state: string): string {
  switch (state) {
    case "eligible": return "✅";
    case "partially_eligible": return "🟡";
    case "not_eligible": return "❌";
    case "needs_manual_review": return "👁️";
    case "expired_or_closed": return "🔒";
    default: return "❓";
  }
}

function formatBenefit(benefit: { type: string; estimated_maximum?: number; certainty: string }): string {
  if (benefit.certainty === "not_estimable") return `${benefit.type} (not estimable)`;
  if (benefit.estimated_maximum !== undefined) {
    return `${benefit.type} — up to ₹${benefit.estimated_maximum.toLocaleString("en-IN")} (${benefit.certainty})`;
  }
  return `${benefit.type} (${benefit.certainty})`;
}
