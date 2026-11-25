# AGENTS.md — Sahayak (PS 26) coding-agent instructions

> Rename or copy to `CLAUDE.md` if your agent reads that filename instead.

## Project in one paragraph
Sahayak helps Indian citizens discover government schemes and scholarships and understand eligibility. It is **not** a government service and never guarantees approval. The current phase is **Phase 4: the deterministic eligibility engine**. The engine is the only authority on eligibility. LLMs may explain results, never decide them.

## Non-negotiable rules
1. **Determinism.** `rules-engine` is pure: no I/O, no network, no `Date.now()`, no `Math.random()`, no env reads. Time comes in as `now`/`as_of`. Same inputs → identical output.
2. **No LLM in the decision path.** No model calls, prompts, or embeddings inside `packages/rules-engine`.
3. **Three-valued logic.** Every predicate returns TRUE / FALSE / UNKNOWN / CONFLICT with a reason. Never coerce UNKNOWN to false or true.
4. **Explain everything.** Each node records pass/fail/unknown and a human-readable reason (en + hi). No opaque scores.
5. **Immutable rule versions.** Published rules are never edited. Create a new version. Old evaluations must replay identically.
6. **No proxy inference.** Never infer caste, religion, disability, income, gender or legal status from names, addresses, language, photos, or other proxies. Only read declared fact keys.
7. **No invented facts.** Never fabricate scheme amounts, dates, guideline sections, URLs or hashes. If you cannot verify, mark `needs_human_verification`, add `TODO(verify): <question>`, and ask the user for the official PDF.
8. **No secrets or PII in logs.** Never log OTPs, tokens, Aadhaar/bank numbers, document contents, or fact values. Mask sensitive keys in traces.
9. **Wording.** Say "likely eligible based on the information provided" and "final decision rests with the scheme authority". Never imply guaranteed approval or official status.
10. **Don't claim integrations are live.** myScheme, NSP, DigiLocker, UIDAI, API Setu: only interfaces and mocks.

## Aggregate state order (do not change without asking)
`expired_or_closed` → rule `review_required` ⇒ `needs_manual_review` → any mandatory FALSE or exclusion TRUE ⇒ `not_eligible` → mandatory CONFLICT ⇒ `needs_manual_review` → UNKNOWN/unverified ⇒ `partially_eligible` → else `eligible`.

## Stack and layout
- TypeScript strict, Node 20+, pnpm workspaces, Vitest, fast-check, Zod.
- `packages/rules-schema` — Zod + JSON Schema (rules, facts, results)
- `packages/rules-engine` — pure evaluator (no deps on DB/HTTP)
- `packages/rules-fixtures` — seed schemes, profiles, test cases
- `apps/engine-api` — thin Fastify wrapper + Postgres persistence
- `docs/` — decision-log.md, known-limitations.md, rule-authoring-guide.md

## Commands
- `pnpm install`
- `pnpm test` — all unit + property tests
- `pnpm test:rules` — fixture/regression/golden suites
- `pnpm lint` / `pnpm typecheck`
- `pnpm demo --profile <file> --scheme <id>` — CLI evaluation
Run `pnpm typecheck && pnpm test` before every commit. Keep the suite green.

## Coding conventions
- Small pure functions; no classes holding hidden state in the engine.
- Exhaustive `switch` on node types with a `never` check.
- Dates are ISO strings; "today" is an Asia/Kolkata calendar date passed in by the caller.
- Money in integer rupees (or paise) — no floating point for amounts.
- Every new predicate or derived function needs: schema entry, evaluator, explanation template (en+hi), unit tests, boundary tests.
- Public types live in `rules-schema`; don't duplicate them.
- Errors: return structured error objects at API edges; never swallow exceptions inside the engine.

## Rule authoring requirements
Every scheme rule ships with tests for: eligible, ineligible, boundary age, boundary income, missing document, conflicting facts, expired deadline, state mismatch, unknown mandatory fact, manual-review, exception applied. CI must fail if any are missing. Every rule cites source title, URL, section, effective date, last-verified date, source hash.

## Workflow expectations
1. Read the task, state a short plan, then implement in the order given in the phase prompt.
2. Write tests first or alongside each unit.
3. Commit small with behaviour-describing messages.
4. If a requirement is ambiguous or you'd have to guess legal/eligibility content, **stop and ask**.
5. At the end of the phase deliver: demo, API contract, DB migration, test evidence, known limitations, decision log.

## Never do
- Don't edit published rule versions or golden files without explicit approval.
- Don't add network calls, scraping, or LLM calls to `rules-engine`.
- Don't store or print Aadhaar numbers, bank details, or raw document contents.
- Don't automate government portals, CAPTCHAs or OTPs.
- Don't present third-party/corporate scholarships as government schemes.
- Don't mark seed data as verified.