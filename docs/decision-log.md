# Decision Log

## Sahayak — Phase 4: Deterministic Eligibility Engine

### Decision 1: Aggregate State Resolution Order

**Date:** 2025-01-01
**Decision:** Follow the strict resolution order documented in AGENTS.md:

1. `expired_or_closed` — lifecycle not `active`, or evaluation date outside effective range
2. `needs_manual_review` — if `review_required` is set on the rule
3. `not_eligible` — any mandatory node is FALSE, or any exclusion is TRUE
4. `needs_manual_review` — mandatory CONFLICT with no definite failure
5. `partially_eligible` — no failure, no conflict, but UNKNOWN or unverified facts
6. `eligible` — every mandatory node TRUE and documents satisfied

**Rationale:** A definite FALSE always beats UNKNOWN/CONFLICT elsewhere in the tree. This ensures conservative results: we never tell a user they're eligible when a mandatory criterion has failed.

### Decision 2: Source Freshness — Stale Flag vs State Downgrade

**Date:** 2025-01-01
**Decision:** When source freshness exceeds the threshold (default 180 days), we set `stale: true` on the result but do **not** downgrade `eligible` to `needs_manual_review`.

**Rationale:** Per plan.md: "keep state but add the stale flag". The plan notes this may change.

### Decision 3: Conflict Resolution via Source Precedence

**Date:** 2025-01-01
**Decision:** When two facts for the same key disagree, attempt resolution via source precedence: `government_verified` > `operator_verified` > `document_extracted` (confirmed) > `user_entered`.

If precedence resolves the conflict, record which fact won and which were overridden. If two facts at the same precedence level disagree, the key is CONFLICT.

### Decision 4: "What Would Change" — Single-Fact Flips Only

**Date:** 2025-01-01
**Decision:** The what-if analysis only considers single-fact flips (changing one fact at a time). No combinatorial search. Capped at 5 items. Never suggests misrepresenting facts.

### Decision 5: Benefit Estimation — Never Guaranteed

**Date:** 2025-01-01
**Decision:** Benefit estimates are labelled with certainty (`stated`, `estimated_max`, or `not_estimable`). Non-cash and service benefits are always `not_estimable`. Estimates are never aggregated across schemes (Phase 5 concern).

### Decision 6: No Synthetic/Invented Data

**Date:** 2025-01-01
**Decision:** All seed scheme data references real Indian government schemes. However, every seed is marked `curator_status: "needs_human_verification"` and amounts, thresholds, and guideline citations include `TODO(verify)` notes. The engine never claims a scheme is verified unless a human curator confirms it against the official PDF.

### Decision 7: Money in Integer Rupees

**Date:** 2025-01-01
**Decision:** All monetary amounts are in integer rupees (no paise, no floating point) to avoid precision errors.

### Decision 8: Dates as ISO Strings with IST Convention

**Date:** 2025-01-01
**Decision:** All dates are ISO "YYYY-MM-DD" strings. "Today" is an Asia/Kolkata calendar date passed in by the caller. The engine never calls Date.now() or reads the system clock.
