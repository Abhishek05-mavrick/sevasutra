import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";
import { SAMPLE_PROFILES } from "rules-fixtures";
import type { OtpProvider, OidcProvider } from "platform-core";

describe("engine-api HTTP integration tests", () => {
  it("GET /health reports deterministic engine with no LLM in decision path", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: "ok",
      engine: "deterministic",
      llm_in_decision_path: false,
    });
  });

  it("POST /evaluate and POST /evaluations/:id/replay reproduce identical output", async () => {
    const { app } = buildApp();
    const evalRes = await app.inject({
      method: "POST",
      url: "/evaluate",
      payload: {
        scheme_id: "pm-kisan",
        profile_snapshot: SAMPLE_PROFILES.asha,
        as_of: "2025-06-15",
      },
    });
    expect(evalRes.statusCode).toBe(200);
    const body = evalRes.json();
    expect(body.state).toBe("eligible");
    expect(body.disclaimer_key).toBe("informational_not_official_decision");

    const replayRes = await app.inject({
      method: "POST",
      url: `/evaluations/${body.evaluation_id}/replay`,
    });
    expect(replayRes.statusCode).toBe(200);
    expect(replayRes.json().identical).toBe(true);
  });

  it("POST /evaluate/batch returns deterministic ordering across all seed schemes", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/evaluate/batch",
      payload: {
        profile_snapshot: SAMPLE_PROFILES.asha,
        as_of: "2025-06-15",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(5);
    const ids = body.results.map((r: { scheme_id: string }) => r.scheme_id);
    expect(ids).toEqual([...ids].sort());
  });

  it("enforces Explorer vs Verified Applicant RBAC and explicit consent on profile save", async () => {
    let sentOtp = "";
    const otpProvider: OtpProvider = {
      name: "test-otp",
      async sendOtp(_p, code) {
        sentOtp = code;
        return { accepted: true };
      },
    };
    const oidcProvider: OidcProvider = {
      name: "test-oidc",
      async verifyIdToken(t) {
        return t === "google-ok" ? { sub: "g-1", email: "e@example.com", name: "Explorer" } : null;
      },
    };

    const { app } = buildApp({ otpProvider, oidcProvider });

    // Google explorer cannot save profile facts
    const gRes = await app.inject({
      method: "POST",
      url: "/auth/google/explorer",
      payload: { id_token: "google-ok" },
    });
    const explorerToken = gRes.json().token;
    const forbidden = await app.inject({
      method: "PUT",
      url: "/profile/facts",
      headers: { authorization: `Bearer ${explorerToken}` },
      payload: { facts: [] },
    });
    expect(forbidden.statusCode).toBe(403);

    // Phone OTP login -> Verified Applicant -> needs consent before saving
    const otpReq = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phone: "9876543210", purpose: "login" },
    });
    const otpVerify = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { challenge_id: otpReq.json().challenge_id, otp: sentOtp },
    });
    const applicantToken = otpVerify.json().token;

    const noConsent = await app.inject({
      method: "PUT",
      url: "/profile/facts",
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { facts: SAMPLE_PROFILES.minimal },
    });
    expect(noConsent.statusCode).toBe(403);
    expect(noConsent.json().error).toBe("profile_consent_required");

    await app.inject({
      method: "POST",
      url: "/consent/grant",
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { purpose: "profile_eligibility", policy_version: "1.0" },
    });

    const saved = await app.inject({
      method: "PUT",
      url: "/profile/facts",
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { facts: SAMPLE_PROFILES.asha },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().saved).toBe(true);
  });

  it("POST /chat blocks sensitive data and answers eligibility via deterministic engine", async () => {
    const { app } = buildApp();

    const blocked = await app.inject({
      method: "POST",
      url: "/chat",
      payload: { question: "Here is my Aadhaar 1234", language: "en" },
    });
    expect(blocked.statusCode).toBe(200);
    expect(blocked.json().refused).toBe(true);

    const allowed = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {
        question: "Am I eligible for PM-KISAN?",
        scheme_id: "pm-kisan",
        facts: SAMPLE_PROFILES.asha,
        as_of: "2025-06-15",
      },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().refused).toBe(false);
    expect(allowed.json().eligibility_result.state).toBe("eligible");
  });

  it("handles Document Vault upload, signed-url download, deletion, and POST /rag/evaluate", async () => {
    let sentOtp = "";
    const otpProvider: OtpProvider = {
      name: "test-otp",
      async sendOtp(_p, code) {
        sentOtp = code;
        return { accepted: true };
      },
    };
    const { app } = buildApp({ otpProvider });

    const otpReq = await app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone: "9876543210" } });
    const otpVerify = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { challenge_id: otpReq.json().challenge_id, otp: sentOtp },
    });
    const token = otpVerify.json().token;

    await app.inject({
      method: "POST",
      url: "/consent/grant",
      headers: { authorization: `Bearer ${token}` },
      payload: { purpose: "document_vault", policy_version: "1.0" },
    });

    const uploadRes = await app.inject({
      method: "POST",
      url: "/documents/upload",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        document_type: "aadhaar",
        filename: "test.pdf",
        mime_type: "application/pdf",
        content_base64: Buffer.from("%PDF-1.4 sample").toString("base64"),
      },
    });
    expect(uploadRes.statusCode).toBe(200);
    const docId = uploadRes.json().id;

    const sigRes = await app.inject({
      method: "GET",
      url: `/documents/${docId}/signed-url`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sigRes.statusCode).toBe(200);
    const dlRes = await app.inject({ method: "GET", url: sigRes.json().signed_path });
    expect(dlRes.statusCode).toBe(200);

    const ragRes = await app.inject({
      method: "POST",
      url: "/rag/evaluate",
      payload: { question: "farmer land support", facts: SAMPLE_PROFILES.asha, as_of: "2025-06-15" },
    });
    expect(ragRes.statusCode).toBe(200);
    expect(ragRes.json().retrieved_schemes.length).toBeGreaterThan(0);

    const delRes = await app.inject({
      method: "DELETE",
      url: `/documents/${docId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(delRes.statusCode).toBe(200);
  });
});
