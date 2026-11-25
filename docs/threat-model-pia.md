# Threat Model & Privacy Impact Assessment (PIA) — Sahayak (PS 26)

Aligned with the **Digital Personal Data Protection Act, 2023 (DPDP Act)** and OWASP Top 10 controls.

## 1. Threat Model (STRIDE Summary)

| Threat Category | Attack Vector / Risk | Mitigation Implemented / Required |
|-----------------|----------------------|-----------------------------------|
| **Spoofing** | OTP brute-force or phone enumeration | Hashed OTP (`scrypt` + per-challenge salt), max 3 verification attempts, per-phone & per-IP rate limiting, short OTP TTL (5 min), constant-time comparison |
| **Spoofing / Privilege Escalation** | Google OIDC Explorer tries to submit application or access admin routes | Strict RBAC separation (`explorer` vs `verified_applicant` vs `curator`/`admin`); Google Sign-In never grants application privileges without explicit phone OTP linking; Admin routes require MFA |
| **Tampering** | Modifying published eligibility rules or silent edits by operator | Rule versions are immutable (`scheme_versions` + `eligibility_rules` append-only); every evaluation stores `scheme_id`, `rule_version`, `evaluation_id`, and input snapshot hash; audit log records actor + diff |
| **Tampering (AI / RAG)** | Prompt injection inside scraped PDFs or scheme descriptions | Treat retrieved document text strictly as untrusted data; run prompt-injection pattern checks before passing to LLM; LLM never computes eligibility (only `rules-engine` does) |
| **Information Disclosure** | PII / sensitive attributes (caste, income, disability, Aadhaar, bank) leaked in logs, traces, or email subjects | Sensitive fact keys masked (`***`) in default traces and API logs; audit logger strips `otp`, `token`, `aadhaar`, `bank_account`, `password`; email subjects contain no sensitive details; documents use short-lived signed URLs only |
| **Denial of Service** | Deeply nested/cyclic rules or huge file uploads | `lintRule()` enforces max tree depth (20) and max node count (500); Zod schemas reject unknown/malformed payloads; upload validator enforces max file size and MIME allowlist |
| **Repudiation** | Disputed consent, rule change, or external submission | Append-only `audit_events` and `consents` ledger with timestamp, actor, purpose, and idempotency keys |

## 2. Privacy Impact Assessment (DPDP Act 2023)

1. **Data Minimisation:** Progressive profiling collects only broad discovery attributes initially (age band/DOB, state) and asks sensitive questions (caste, disability, income) only when a user explores a scheme whose rule actually requires them. `"prefer_not_to_say"` is supported as a first-class legal value.
2. **No Proxy Inference:** The engine strictly rejects any rule referencing uncatalogued keys and never infers caste, religion, disability, income, gender, or legal status from names, addresses, language, or photos.
3. **Purpose Limitation & Explicit Consent:** Profile persistence, document extraction (OCR), email/SMS reminders, and external API data sharing each require separate, granular, revocable consent.
4. **Data Principal Rights:** APIs and UI provide full **view**, **correction**, **JSON export**, **consent withdrawal**, and **account/document deletion** workflows.
5. **Children's Data:** Minors (`<18`) require parent/guardian details and verified parental consent controls before saving a full profile or documents.
6. **Model Training Prohibition:** Citizen profiles, facts, and uploaded documents are **never** used to train general AI/ML models.
7. **Retention & Deletion:** OTP challenges purge on expiry/use; unconfirmed OCR suggestions are discarded if rejected; user-initiated deletion cascades across `profiles`, `profile_facts`, `documents`, and object storage objects while retaining only anonymised security audit metadata where legally required.
