import { describe, it, expect } from "vitest";
import { applyDotEnvContent } from "../env.js";
import { OpenAiCompatibleLlmProvider } from "./openai-llm.js";
import { TwilioMessagingProvider } from "./twilio.js";

describe("env & providers", () => {
  it("parses .env key=value lines without overwriting existing process.env", () => {
    const key = "SAHAYAK_TEST_ENV_VAR";
    delete process.env[key];
    applyDotEnvContent(`# comment\n${key}=hello\n`);
    expect(process.env[key]).toBe("hello");
    applyDotEnvContent(`${key}=overwritten`);
    expect(process.env[key]).toBe("hello");
    delete process.env[key];
  });

  it("OpenAiCompatibleLlmProvider sends grounded prompt with deterministic result", async () => {
    let capturedBody = "";
    const mockFetch = (async (_url: unknown, init?: RequestInit) => {
      capturedBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "Grounded explanation." } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const llm = new OpenAiCompatibleLlmProvider(
      { apiKey: "test-key", baseUrl: "https://api.example.com/v1/", model: "test-model" },
      mockFetch,
    );

    const out = await llm.explainFromSources({
      question: "Tell me about PM-KISAN",
      language: "en",
      sources: [
        {
          scheme_id: "pm-kisan",
          title: "PM-KISAN",
          url: "https://pmkisan.gov.in/",
          effective_from: "2019-02-01",
          last_verified_on: "2025-01-01",
          stale: false,
          text: "Farmer support",
        },
      ],
    });

    expect(out).toBe("Grounded explanation.");
    expect(capturedBody).toContain("PM-KISAN");
    expect(capturedBody).toContain("test-model");
  });

  it("TwilioMessagingProvider formats WhatsApp OTP request without logging secrets", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    const mockFetch = (async (url: unknown, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ sid: "SM123" }), { status: 201 });
    }) as typeof fetch;

    const twilio = new TwilioMessagingProvider(
      {
        accountSid: "ACtest",
        authToken: "tok",
        whatsappFrom: "whatsapp:+10000000000",
      },
      mockFetch,
    );

    const res = await twilio.sendOtp("+919876543210", "123456", "login");
    expect(res.accepted).toBe(true);
    expect(res.provider_ref).toBe("SM123");
    expect(capturedUrl).toContain("ACtest/Messages.json");
    expect(capturedBody).toContain("whatsapp%3A%2B919876543210");
  });
});
