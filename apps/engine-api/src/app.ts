import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import {
  evaluate,
  lintRule,
  diffRuleVersions,
  impactAnalysis,
} from "rules-engine";
import { SEED_SCHEMES } from "rules-fixtures";
import {
  EvaluationInputSchema,
  FactSchema,
  SchemeRuleVersionSchema,
  type EvaluationResult,
  type Fact,
  type SchemeRuleVersion,
} from "rules-schema";
import {
  AuditLogger,
  AuthService,
  ConsentStore,
  ApplicationWorkflowService,
  ReminderQueue,
  DocumentVaultService,
  selectNextProfileQuestions,
  maskSensitiveFacts,
  runRagEligibilityQuery,
  type OtpProvider,
  type OidcProvider,
  type LlmProvider,
  type VirusScanner,
  type OcrProvider,
  type Session,
} from "platform-core";
import { getRuntimeConfig } from "./env.js";
import { OpenAiCompatibleLlmProvider } from "./providers/openai-llm.js";
import { TwilioMessagingProvider } from "./providers/twilio.js";

export interface AppContext {
  app: FastifyInstance;
  auth: AuthService;
  consents: ConsentStore;
  audit: AuditLogger;
}

const DEFAULT_TODAY_IST = "2025-06-15";

export function buildApp(deps?: {
  otpProvider?: OtpProvider;
  oidcProvider?: OidcProvider;
  llmProvider?: LlmProvider;
  virusScanner?: VirusScanner;
  ocrProvider?: OcrProvider;
}): AppContext {
  // Never log request bodies or fact values in Fastify logger
  const app = Fastify({ logger: false, bodyLimit: 15 * 1024 * 1024 });
  const config = getRuntimeConfig();

  const audit = new AuditLogger();
  const consents = new ConsentStore();
  const applications = new ApplicationWorkflowService();
  const reminders = new ReminderQueue();

  const virusScanner: VirusScanner = deps?.virusScanner ?? {
    async scan(content: Buffer) {
      // Reject known EICAR test string or Windows PE executables
      if (content.subarray(0, 2).toString() === "MZ") return "infected";
      if (content.toString("utf8", 0, Math.min(content.length, 128)).includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) {
        return "infected";
      }
      return "clean";
    },
  };

  const vault = new DocumentVaultService(virusScanner, audit, deps?.ocrProvider);

  const defaultOtpProvider: OtpProvider =
    deps?.otpProvider ??
    (config.twilio
      ? new TwilioMessagingProvider(config.twilio)
      : {
          name: "unconfigured-otp-adapter",
          async sendOtp() {
            return { accepted: false };
          },
        });

  const defaultOidcProvider: OidcProvider = deps?.oidcProvider ?? {
    name: "unconfigured-google-oidc",
    async verifyIdToken() {
      return null;
    },
  };

  const llmProvider: LlmProvider | undefined =
    deps?.llmProvider ??
    (config.llm ? new OpenAiCompatibleLlmProvider(config.llm) : undefined);

  const auth = new AuthService(defaultOtpProvider, defaultOidcProvider, audit);

  const evaluationStore = new Map<
    string,
    { result: EvaluationResult; input: { scheme_id: string; rule_version: string; profile_snapshot: Fact[]; as_of: string } }
  >();
  const userProfiles = new Map<string, Fact[]>();
  const feedbackList: Array<{ id: string; scheme_id?: string; feedback_type: string; message: string; created_at: string }> = [];

  const allowedOrigins = new Set([
    config.corsOrigin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  // Security headers + CORS for web frontend
  app.addHook("onSend", async (request, reply, payload) => {
    const origin = request.headers.origin;
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header(
      "Access-Control-Allow-Origin",
      origin && allowedOrigins.has(origin) ? origin : config.corsOrigin,
    );
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
    return payload;
  });

  app.options("*", async (_req, reply) => reply.status(204).send());

  const getSessionFromHeader = (authHeader?: string): Session | null => {
    if (!authHeader?.startsWith("Bearer ")) return null;
    return auth.getSession(authHeader.slice(7));
  };

  // --- Health ---
  app.get("/health", async () => ({
    status: "ok",
    engine: "deterministic",
    llm_in_decision_path: false,
    adapters: {
      llm: llmProvider ? config.llm?.provider ?? llmProvider.name : "none",
      otp: defaultOtpProvider.name,
    },
  }));

  // --- Schemes ---
  app.get("/schemes", async () => {
    return SEED_SCHEMES.map((s) => ({
      scheme_id: s.scheme_id,
      rule_version: s.rule_version,
      content_version: s.content_version,
      effective_from: s.effective_from,
      application_window: s.application_window,
      lifecycle_status: s.lifecycle_status,
      title: s.source.title,
      summary: s.mandatory.explain ?? { en: s.source.title },
      url: s.source.url,
      last_verified_on: s.source.last_verified_on,
      curator_status: s.curator_status,
      benefit: s.benefit,
      quotas: s.quotas ?? [],
      caps: s.caps ?? [],
      required_documents: s.required_documents,
    }));
  });

  // --- Phase 4: Deterministic Eligibility Engine ---
  app.post("/evaluate", async (request, reply) => {
    const parseResult = EvaluationInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: "validation_error", details: parseResult.error.issues });
    }

    const { scheme_id, rule_version, profile_snapshot, as_of } = parseResult.data;
    const scheme = SEED_SCHEMES.find(
      (s) => s.scheme_id === scheme_id && (!rule_version || s.rule_version === rule_version),
    );
    if (!scheme) {
      return reply.status(404).send({ error: "scheme_not_found" });
    }

    const result = evaluate(scheme, profile_snapshot, as_of);
    evaluationStore.set(result.evaluation_id, {
      result,
      input: { scheme_id, rule_version: scheme.rule_version, profile_snapshot, as_of },
    });
    return result;
  });

  app.post("/evaluate/batch", async (request, reply) => {
    const schema = z.object({
      profile_snapshot: z.array(FactSchema),
      as_of: z.string(),
      scheme_ids: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", details: parsed.error.issues });
    }

    const schemes = parsed.data.scheme_ids
      ? SEED_SCHEMES.filter((s) => parsed.data.scheme_ids!.includes(s.scheme_id))
      : SEED_SCHEMES;
    const sortedSchemes = [...schemes].sort((a, b) => a.scheme_id.localeCompare(b.scheme_id));
    const results = sortedSchemes.map((s) => evaluate(s, parsed.data.profile_snapshot, parsed.data.as_of));
    return { results, count: results.length };
  });

  app.get("/evaluations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const stored = evaluationStore.get(id);
    if (!stored) return reply.status(404).send({ error: "not_found" });
    return { result: stored.result, input_meta: { scheme_id: stored.input.scheme_id, rule_version: stored.input.rule_version, as_of: stored.input.as_of } };
  });

  app.post("/evaluations/:id/replay", async (request, reply) => {
    const { id } = request.params as { id: string };
    const stored = evaluationStore.get(id);
    if (!stored) return reply.status(404).send({ error: "not_found" });

    const { scheme_id, rule_version, profile_snapshot, as_of } = stored.input;
    const scheme = SEED_SCHEMES.find((s) => s.scheme_id === scheme_id && s.rule_version === rule_version);
    if (!scheme) return reply.status(404).send({ error: "scheme_version_not_found" });

    const replayed = evaluate(scheme, profile_snapshot, as_of);
    return {
      original: stored.result,
      replayed,
      identical: JSON.stringify(stored.result) === JSON.stringify(replayed),
    };
  });

  app.post("/rules/validate", async (request) => {
    const parsed = SchemeRuleVersionSchema.safeParse(request.body);
    if (!parsed.success) {
      return { valid: false, schema_errors: parsed.error.issues, lint_errors: [] };
    }
    const lintErrors = lintRule(parsed.data);
    return { valid: lintErrors.length === 0, schema_errors: [], lint_errors: lintErrors };
  });

  app.post("/rules/diff", async (request, reply) => {
    const schema = z.object({ a: SchemeRuleVersionSchema, b: SchemeRuleVersionSchema });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error", details: parsed.error.issues });
    return diffRuleVersions(parsed.data.a as SchemeRuleVersion, parsed.data.b as SchemeRuleVersion);
  });

  app.post("/rules/impact", async (request, reply) => {
    const schema = z.object({
      old_version: SchemeRuleVersionSchema,
      new_version: SchemeRuleVersionSchema,
      profiles: z.array(z.object({ profile_id: z.string(), facts: z.array(FactSchema) })),
      as_of: z.string(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error", details: parsed.error.issues });
    return impactAnalysis(
      parsed.data.old_version as SchemeRuleVersion,
      parsed.data.new_version as SchemeRuleVersion,
      parsed.data.profiles,
      parsed.data.as_of,
    );
  });

  // --- Phase 1: Auth & Consent ---
  app.post("/auth/otp/request", async (request, reply) => {
    const schema = z.object({
      phone: z.string(),
      purpose: z.enum(["login", "register", "link_account"]).default("login"),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    const res = await auth.requestPhoneOtp(parsed.data.phone, parsed.data.purpose);
    if (!res.ok) return reply.status(400).send(res);
    return res;
  });

  app.post("/auth/otp/verify", async (request, reply) => {
    const schema = z.object({ challenge_id: z.string(), otp: z.string() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    const res = auth.verifyPhoneOtp(parsed.data.challenge_id, parsed.data.otp);
    if (!res.ok) return reply.status(401).send(res);
    return { user: res.user, token: res.session.token };
  });

  app.post("/auth/google/explorer", async (request, reply) => {
    const schema = z.object({ id_token: z.string() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    const res = await auth.signInWithGoogleExplorer(parsed.data.id_token);
    if (!res.ok) return reply.status(401).send(res);
    return { user: res.user, token: res.session.token };
  });

  app.get("/auth/me", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    const user = auth.getUserById(session.user_id);
    if (!user) return reply.status(401).send({ error: "unauthorized" });
    return {
      user: {
        id: user.id,
        role: user.role,
        display_name: user.display_name,
        preferred_language: user.preferred_language,
        phone_masked: user.phone_e164 ? `${user.phone_e164.slice(0, 5)}*****${user.phone_e164.slice(-2)}` : undefined,
      },
      consents: consents.exportUserConsents(user.id),
    };
  });

  app.post("/auth/logout", async (request) => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      auth.revokeSession(authHeader.slice(7));
    }
    return { logged_out: true };
  });

  app.post("/consent/grant", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    const schema = z.object({
      purpose: z.enum([
        "auth_phone_otp", "auth_google_oidc", "profile_eligibility",
        "document_vault", "document_ocr_extract", "reminders_email",
        "reminders_sms_whatsapp", "portal_data_share", "analytics_pseudonymous",
      ]),
      policy_version: z.string().default("1.0"),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    return consents.grant(session.user_id, parsed.data.purpose, parsed.data.policy_version, new Date().toISOString());
  });

  app.post("/consent/withdraw", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    const schema = z.object({ purpose: z.string() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    const withdrawn = consents.withdraw(session.user_id, parsed.data.purpose as never, new Date().toISOString());
    return { withdrawn };
  });

  app.get("/account/export", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    return {
      user_id: session.user_id,
      role: session.role,
      consents: consents.exportUserConsents(session.user_id),
      facts: userProfiles.get(session.user_id) ?? [],
      applications: applications.listForUser(session.user_id),
    };
  });

  app.delete("/account", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    userProfiles.delete(session.user_id);
    vault.deleteAllForUser(session.user_id);
    consents.deleteUserConsents(session.user_id);
    auth.deleteUser(session.user_id, new Date().toISOString());
    return { deleted: true };
  });

  // --- Phase 2: Progressive Profile & Document Vault ---
  app.get("/profile", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    const facts = userProfiles.get(session!.user_id) ?? [];
    return { facts, facts_masked: maskSensitiveFacts(facts) };
  });

  app.post("/documents/upload", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    if (!consents.hasActiveConsent(session!.user_id, "document_vault")) {
      return reply.status(403).send({ error: "document_vault_consent_required" });
    }
    const schema = z.object({
      document_type: z.string().min(1).max(64),
      filename: z.string().min(1).max(150),
      mime_type: z.string().min(1),
      content_base64: z.string().min(1),
      expires_at: z.string().optional(),
      run_ocr: z.boolean().default(false),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error", details: parsed.error.issues });

    const ocrConsented =
      parsed.data.run_ocr && consents.hasActiveConsent(session!.user_id, "document_ocr_extract");
    const content = Buffer.from(parsed.data.content_base64, "base64");
    const res = await vault.uploadDocument({
      user_id: session!.user_id,
      document_type: parsed.data.document_type,
      filename: parsed.data.filename,
      mime_type: parsed.data.mime_type,
      content,
      expires_at: parsed.data.expires_at,
      ocr_consented: ocrConsented,
      nowIso: new Date().toISOString(),
    });
    if (!res.ok) return reply.status(400).send(res);

    // Record unconfirmed document fact until confirmed or immediately mark uploaded
    const existing = userProfiles.get(session!.user_id) ?? [];
    const filtered = existing.filter((f) => f.key !== `document.${parsed.data.document_type}`);
    filtered.push({
      key: `document.${parsed.data.document_type}`,
      value: true,
      source: "document_extracted",
      collected_at: new Date().toISOString().slice(0, 10),
      expires_at: parsed.data.expires_at,
      confirmed_by_user: true,
    });
    userProfiles.set(session!.user_id, filtered);

    return res.document;
  });

  app.get("/documents", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    return { documents: vault.listForUser(session!.user_id) };
  });

  app.get("/documents/:id/signed-url", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    const { id } = request.params as { id: string };
    const sig = vault.createSignedToken(id, session!.user_id, 60);
    if (!sig) return reply.status(404).send({ error: "document_not_found" });
    return { signed_path: `/documents/${id}/download?sig=${sig}`, expires_in_seconds: 60 };
  });

  app.get("/documents/:id/download", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { sig } = request.query as { sig?: string };
    if (!sig) return reply.status(403).send({ error: "signed_token_required" });
    const file = vault.readViaSignedToken(id, sig);
    if (!file) return reply.status(403).send({ error: "invalid_or_expired_signed_token" });
    reply.header("Content-Type", file.mime_type);
    reply.header("Content-Disposition", `attachment; filename="${file.filename}"`);
    reply.header("Cache-Control", "no-store");
    return file.content;
  });

  app.post("/documents/:id/confirm", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    const { id } = request.params as { id: string };
    const schema = z.object({ confirmed: z.boolean() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    const res = vault.confirmExtraction(id, session!.user_id, parsed.data.confirmed, new Date().toISOString().slice(0, 10));
    if (!res.ok) return reply.status(404).send(res);
    if (res.confirmed_facts.length > 0) {
      const existing = userProfiles.get(session!.user_id) ?? [];
      const merged = [...existing.filter((f) => !res.confirmed_facts.some((cf) => cf.key === f.key)), ...res.confirmed_facts];
      userProfiles.set(session!.user_id, merged);
    }
    return res;
  });

  app.delete("/documents/:id", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    const { id } = request.params as { id: string };
    const deleted = vault.deleteDocument(id, session!.user_id);
    if (!deleted) return reply.status(404).send({ error: "document_not_found" });
    return { deleted: true };
  });
  app.post("/profile/next-questions", async (request, reply) => {
    const schema = z.object({ facts: z.array(FactSchema), as_of: z.string().default(DEFAULT_TODAY_IST) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    return { questions: selectNextProfileQuestions(parsed.data.facts, SEED_SCHEMES, parsed.data.as_of) };
  });

  app.put("/profile/facts", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    if (!consents.hasActiveConsent(session!.user_id, "profile_eligibility")) {
      return reply.status(403).send({ error: "profile_consent_required" });
    }
    const schema = z.object({ facts: z.array(FactSchema) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    userProfiles.set(session!.user_id, parsed.data.facts);
    return { saved: true, facts_masked: maskSensitiveFacts(parsed.data.facts) };
  });

  // --- Phase 6: Assisted Application Checklist & Redirect ---
  app.post("/applications/checklist", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    const schema = z.object({
      scheme_id: z.string(),
      checked_docs: z.record(z.boolean()),
      evaluation_id: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    const scheme = SEED_SCHEMES.find((s) => s.scheme_id === parsed.data.scheme_id);
    if (!scheme) return reply.status(404).send({ error: "scheme_not_found" });
    return applications.startOrUpdateChecklist(
      session!.user_id,
      scheme.scheme_id,
      scheme.source.url,
      parsed.data.checked_docs,
      parsed.data.evaluation_id,
      new Date().toISOString(),
    );
  });

  app.post("/applications/:id/redirect", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    const { id } = request.params as { id: string };
    const updated = applications.recordOfficialPortalRedirect(id, new Date().toISOString());
    if (!updated) return reply.status(404).send({ error: "application_not_found" });
    return updated;
  });

  app.get("/applications", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    return { applications: applications.listForUser(session!.user_id) };
  });

  app.put("/applications/:id/status", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    const { id } = request.params as { id: string };
    const schema = z.object({
      status: z.enum([
        "not_started", "checklist_in_progress", "ready_to_apply", "redirected",
        "submitted_externally", "reference_received", "under_verification",
        "approved", "rejected", "withdrawn", "unknown",
      ]),
      external_reference_no: z.string().max(120).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    const updated = applications.updateExternalStatus(
      id,
      parsed.data.status,
      parsed.data.external_reference_no,
      new Date().toISOString(),
    );
    if (!updated) return reply.status(404).send({ error: "application_not_found" });
    return updated;
  });

  // --- Phase 7: RAG Retrieval + Deterministic Eligibility + Grounded LLM Explanation ---
  const handleRagEndpoint = async (request: { body: unknown }, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) => {
    const schema = z.object({
      question: z.string().min(1).max(1000),
      language: z.enum(["en", "hi"]).default("en"),
      scheme_id: z.string().optional(),
      facts: z.array(FactSchema).optional(),
      as_of: z.string().default(DEFAULT_TODAY_IST),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });

    try {
      return await runRagEligibilityQuery({
        question: parsed.data.question,
        language: parsed.data.language,
        schemes: SEED_SCHEMES,
        schemeIdFilter: parsed.data.scheme_id,
        userFacts: parsed.data.facts,
        evaluationDate: parsed.data.as_of,
        llm: llmProvider,
      });
    } catch {
      return runRagEligibilityQuery({
        question: parsed.data.question,
        language: parsed.data.language,
        schemes: SEED_SCHEMES,
        schemeIdFilter: parsed.data.scheme_id,
        userFacts: parsed.data.facts,
        evaluationDate: parsed.data.as_of,
      });
    }
  };

  app.post("/chat", handleRagEndpoint);
  app.post("/rag/evaluate", handleRagEndpoint);

  // --- Phase 8: Reminder Preferences ---
  app.get("/reminders/preferences", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    return reminders.getPreference(session!.user_id);
  });

  app.put("/reminders/preferences", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["verified_applicant", "admin"])) {
      return reply.status(403).send({ error: "verified_applicant_required" });
    }
    const schema = z.object({
      email_enabled: z.boolean(),
      sms_enabled: z.boolean().default(false),
      whatsapp_enabled: z.boolean().default(false),
      quiet_hours_start_ist: z.number().int().min(0).max(23).default(21),
      quiet_hours_end_ist: z.number().int().min(0).max(23).default(8),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    const pref = { user_id: session!.user_id, ...parsed.data };
    reminders.setPreference(pref);
    return pref;
  });

  // --- Phase 9: Feedback & Admin Audit ---
  app.post("/feedback", async (request, reply) => {
    const schema = z.object({
      scheme_id: z.string().optional(),
      feedback_type: z.enum(["outdated_info", "broken_link", "wrong_benefit", "rule_discrepancy", "other"]),
      message: z.string().min(3).max(1000),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation_error" });
    const entry = {
      id: `fb-${feedbackList.length + 1}`,
      ...parsed.data,
      created_at: new Date().toISOString(),
    };
    feedbackList.push(entry);
    return entry;
  });

  app.get("/feedback", async () => ({ feedback: feedbackList }));

  app.get("/audit", async (request, reply) => {
    const session = getSessionFromHeader(request.headers.authorization);
    if (!auth.requireRole(session, ["admin", "support_operator", "curator"], true)) {
      return reply.status(403).send({ error: "staff_mfa_required" });
    }
    return { events: audit.listAll() };
  });

  return { app, auth, consents, audit };
}
