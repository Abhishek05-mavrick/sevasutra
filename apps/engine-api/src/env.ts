import fs from "node:fs";
import path from "node:path";

/**
 * Load key=value pairs from a .env file into process.env without overwriting
 * existing environment variables. Checks cwd and up to 3 parent directories.
 */
export function loadDotEnv(startDir: string = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, "utf8");
      applyDotEnvContent(raw);
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function applyDotEnvContent(raw: string): void {
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

export interface RuntimeConfig {
  host: string;
  port: number;
  corsOrigin: string;
  llm?: {
    provider: string;
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  twilio?: {
    accountSid: string;
    authToken?: string;
    apiKeySid?: string;
    apiKeySecret?: string;
    whatsappFrom?: string;
    whatsappContentSid?: string;
    otpContentSid?: string;
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  const host = process.env["HOST"] || "127.0.0.1";
  const port = Number(process.env["PORT"] || 8000);
  const corsOrigin = process.env["CORS_ORIGIN"] || "http://127.0.0.1:5173";

  const llmProvider = process.env["LLM_PROVIDER"];
  const openaiKey = process.env["OPENAI_API_KEY"];
  const llm =
    llmProvider === "openai" && openaiKey
      ? {
          provider: llmProvider,
          apiKey: openaiKey,
          baseUrl: process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1",
          model: process.env["OPENAI_MODEL"] || "gpt-4o-mini",
        }
      : undefined;

  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const apiKeySid = process.env["TWILIO_API_KEY_SID"];
  const apiKeySecret = process.env["TWILIO_API_KEY_SECRET"];
  const hasTwilioAuth = Boolean(accountSid && (authToken || (apiKeySid && apiKeySecret)));

  const twilio = hasTwilioAuth
    ? {
        accountSid: accountSid!,
        authToken: authToken || undefined,
        apiKeySid: apiKeySid || undefined,
        apiKeySecret: apiKeySecret || undefined,
        whatsappFrom: process.env["TWILIO_WHATSAPP_FROM"] || undefined,
        whatsappContentSid: process.env["TWILIO_WHATSAPP_CONTENT_SID"] || undefined,
        otpContentSid: process.env["TWILIO_OTP_CONTENT_SID"] || undefined,
      }
    : undefined;

  return { host, port, corsOrigin, llm, twilio };
}
