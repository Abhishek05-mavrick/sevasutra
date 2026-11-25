-- Sahayak (PS 26) — Initial PostgreSQL Schema Migration
-- Covers Phases 1–10 core entities:
-- users, identities, otp_challenges, sessions, consents,
-- sources, source_snapshots, schemes, scheme_versions, eligibility_rules, rule_test_cases,
-- profiles, profile_facts, documents, document_extractions,
-- evaluations, applications, external_applications,
-- notifications, translations, feedback, audit_events.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Identity & Access (Phase 1)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('explorer', 'verified_applicant', 'curator', 'support_operator', 'admin')),
  display_name TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_encrypted TEXT,
  is_minor BOOLEAN NOT NULL DEFAULT FALSE,
  guardian_user_id UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('phone_otp', 'google_oidc')),
  provider_subject TEXT NOT NULL, -- normalised E.164 phone or OIDC sub
  email TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'register', 'link_account', 'guardian_consent')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_otp_phone ON otp_challenges(phone_e164, created_at DESC);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_label TEXT,
  ip_hash TEXT,
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_consents_user_purpose ON consents(user_id, purpose);

-- 2. Source Registry & Knowledge System (Phase 3 & 9)
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  owner_authority TEXT NOT NULL,
  integration_method TEXT NOT NULL,
  licence_status TEXT NOT NULL,
  partner_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE source_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT REFERENCES sources(id),
  url TEXT NOT NULL,
  http_status INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  parser_version TEXT,
  source_version TEXT,
  object_storage_key TEXT,
  reviewer_status TEXT NOT NULL DEFAULT 'needs_human_verification'
);

CREATE TABLE schemes (
  scheme_id TEXT PRIMARY KEY,
  official_name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  ministry_department TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('local', 'central', 'state', 'ut', 'joint', 'third_party')),
  state_ut_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT NOT NULL,
  scholarship_type TEXT CHECK (scholarship_type IN ('central', 'state', 'university', 'corporate_csr', 'fellowship')),
  is_non_government BOOLEAN NOT NULL DEFAULT FALSE,
  provider_name TEXT,
  target_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  application_mode TEXT NOT NULL CHECK (application_mode IN ('official_url', 'official_portal', 'authorised_api', 'csc_offline', 'department_office', 'unavailable')),
  official_portal_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable scheme & rule versions (never UPDATE a published row)
CREATE TABLE scheme_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id TEXT NOT NULL REFERENCES schemes(scheme_id),
  content_version TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('active', 'closed', 'upcoming', 'suspended', 'discontinued')),
  publish_status TEXT NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'pending_review', 'published', 'superseded')),
  curator_status TEXT NOT NULL DEFAULT 'needs_human_verification' CHECK (curator_status IN ('needs_human_verification', 'verified')),
  summary_en TEXT NOT NULL,
  summary_hi TEXT,
  metadata JSONB NOT NULL,
  source_snapshot_id UUID REFERENCES source_snapshots(id),
  created_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scheme_id, content_version)
);

CREATE TABLE eligibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id TEXT NOT NULL REFERENCES schemes(scheme_id),
  scheme_version_id UUID NOT NULL REFERENCES scheme_versions(id),
  rule_version TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_until DATE,
  rule_payload JSONB NOT NULL, -- full SchemeRuleVersion JSON
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scheme_id, rule_version)
);

CREATE TABLE rule_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eligibility_rule_id UUID NOT NULL REFERENCES eligibility_rules(id) ON DELETE CASCADE,
  case_type TEXT NOT NULL,
  name TEXT NOT NULL,
  facts_payload JSONB NOT NULL,
  as_of DATE NOT NULL,
  expected_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Progressive Profile & Document Vault (Phase 2)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fact_key TEXT NOT NULL,
  fact_value JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('user_entered', 'document_extracted', 'government_verified', 'operator_verified')),
  collected_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  confirmed_by_user BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profile_facts_key ON profile_facts(profile_id, fact_key);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256_hash TEXT NOT NULL,
  object_storage_key TEXT NOT NULL, -- encrypted object key; never public URL
  virus_scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (virus_scan_status IN ('pending', 'clean', 'infected', 'failed')),
  expires_at DATE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ocr_provider TEXT NOT NULL,
  suggested_facts JSONB NOT NULL,
  confirmed_by_user BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Evaluations & Replay (Phase 4)
CREATE TABLE evaluations (
  evaluation_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scheme_id TEXT NOT NULL REFERENCES schemes(scheme_id),
  rule_version TEXT NOT NULL,
  content_version TEXT NOT NULL,
  evaluated_at DATE NOT NULL,
  input_hash TEXT NOT NULL,
  masked_facts_snapshot JSONB NOT NULL,
  derived_fn_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  engine_version TEXT NOT NULL,
  result_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_evaluations_user ON evaluations(user_id, created_at DESC);

-- 5. Applications & External Submissions (Phase 6)
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheme_id TEXT NOT NULL REFERENCES schemes(scheme_id),
  evaluation_id TEXT REFERENCES evaluations(evaluation_id),
  status TEXT NOT NULL CHECK (status IN (
    'not_started', 'checklist_in_progress', 'ready_to_apply', 'redirected',
    'submitted_externally', 'reference_received', 'under_verification',
    'approved', 'rejected', 'withdrawn', 'unknown'
  )),
  checklist_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved_at TIMESTAMPTZ,
  redirected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE external_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  adapter_name TEXT NOT NULL,
  consent_id UUID NOT NULL REFERENCES consents(id),
  outgoing_field_map JSONB NOT NULL,
  external_reference_no TEXT,
  external_status TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  dead_lettered BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Reminders, Translations, Feedback & Audit (Phases 7-10)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  category TEXT NOT NULL CHECK (category IN (
    'profile_completion', 'missing_documents', 'upcoming_deadline',
    'deadline_change', 'renewal_due', 'application_status', 'rule_impact_change'
  )),
  dedup_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'suppressed_quiet_hours', 'unsubscribed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  field_name TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  validated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, language_code, field_name)
);

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scheme_id TEXT REFERENCES schemes(scheme_id),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('outdated_info', 'broken_link', 'wrong_benefit', 'rule_discrepancy', 'other')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- strictly redacted, no PII/secrets
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_target ON audit_events(target_type, target_id, created_at DESC);
