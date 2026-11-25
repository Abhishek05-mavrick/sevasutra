# Product Requirements Document (PRD) — Sahayak (PS 26)

## 1. Overview
**Sahayak** is a multilingual, privacy-by-design web platform that helps Indian citizens discover central, state, UT, and third-party welfare schemes and scholarships, understand deterministic eligibility and required documents, receive opt-in reminders, and proceed to authorised application channels.

**Non-negotiable product boundary:** Sahayak is **not** a government department and never guarantees approval. Every eligibility result uses clear informational wording (*"likely eligible based on the information provided"*, *"final decision rests with the scheme authority"*) and cites the rule inputs, official source URL, version/effective date, and last verification date.

## 2. User Roles & Permissions
| Role | Authentication | Capabilities | Restrictions |
|------|----------------|--------------|--------------|
| **Explorer** | Guest or Google Sign-In (OIDC) | Search/browse schemes, read plain-language summaries, run ad-hoc exploration | Cannot submit applications, upload documents, or save a verified profile |
| **Verified Applicant** | Indian mobile number + OTP (plus optional linked Google Explorer account) | Save progressive profile, upload/manage documents in vault, track checklists & application states, receive reminders | Explicit consent required per purpose; cannot edit published rules |
| **Administrator / Content Curator** | Phone/Auth + Mandatory MFA | Create/edit draft scheme versions, upload source PDFs, manage translations, publish after dual review | Cannot edit published rule versions in place (immutable); must run regression suite |
| **Support Operator** | Role-scoped Auth + MFA | Review user feedback, flag broken links or outdated content, respond to escalations | Cannot silently alter published eligibility results |

## 3. Pilot Scope Decision (Phase 0 Gate)
**Recommended Pilot Mode:** **Discovery + Assisted Checklist MVP (Official Portal Redirect)**
- Users discover schemes, run deterministic eligibility evaluations, prepare a verified document checklist, and redirect to the official scheme portal in a new tab.
- **No automated scraping, form filling, CAPTCHA solving, or unofficial OTP/Aadhaar flows.**
- Authorised API integrations (API Setu, DigiLocker, myScheme partner API) sit behind pluggable adapters and are enabled only after written partner approval and sandbox verification.

> **Open Decision for Stakeholder:** Confirm whether Pilot v1 remains **Discovery + Official-Portal Redirect** or includes **Authorised API Submission** for a named partner scheme.

## 4. Phased Architecture Summary
- **Phase 0:** PRD, Data-Flow Diagram, Source & Licensing Register, Threat Model & PIA, Consent Matrix.
- **Phase 1:** Multilingual (EN + HI extensible) accessible foundation, Phone OTP auth, Google OIDC Explorer auth, account linking, RBAC + Admin MFA, consent ledger.
- **Phase 2:** Progressive citizen profile with provenance (`user_entered`, `document_extracted`, `government_verified`, `operator_verified`) and encrypted document vault with signed URLs and human-confirmed OCR suggestions.
- **Phase 3:** Versioned Scheme & Scholarship Knowledge System with immutable rule/content versions and explicit third-party/CSR labelling.
- **Phase 4:** Pure, deterministic three-valued eligibility engine (`TRUE` / `FALSE` / `UNKNOWN` / `CONFLICT`).
- **Phase 5:** Dashboard & Discovery UI with separation of stated vs estimated maximum benefit and household vs individual view.
- **Phase 6:** Assisted application workflow (checklist + official portal redirect + authorised API adapter interface).
- **Phase 7:** Grounded RAG chatbot over approved versioned records only; delegates eligibility checks to the deterministic engine.
- **Phase 8:** Job-queued email reminders (and opt-in SMS/WhatsApp adapters) with quiet hours, deduplication, and zero sensitive data in subject lines.
- **Phase 9:** Admin & Quality console with dual-review publishing, rule diffing, impact analysis, and regression gates.
- **Phase 10:** Security, privacy-by-design, observability, and comprehensive automated testing.
