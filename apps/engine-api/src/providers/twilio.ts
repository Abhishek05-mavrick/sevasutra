import type { OtpProvider, SmsProvider } from "platform-core";

export interface TwilioConfig {
  accountSid: string;
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
  whatsappFrom?: string;
  whatsappContentSid?: string;
  otpContentSid?: string;
}

/**
 * Twilio messaging adapter implementing OtpProvider and SmsProvider.
 * Never logs OTP codes, auth tokens, or API secrets.
 */
export class TwilioMessagingProvider implements OtpProvider, SmsProvider {
  readonly name = "twilio";

  constructor(
    private readonly config: TwilioConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private authHeader(): string {
    const user = this.config.apiKeySid && this.config.apiKeySecret
      ? this.config.apiKeySid
      : this.config.accountSid;
    const pass = this.config.apiKeySid && this.config.apiKeySecret
      ? this.config.apiKeySecret
      : (this.config.authToken ?? "");
    return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  }

  private async postMessage(params: URLSearchParams): Promise<{ ok: boolean; sid?: string; error_code?: number; error_message?: string }> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { code?: number; message?: string };
      return { ok: false, error_code: errBody.code, error_message: errBody.message };
    }
    const json = (await res.json()) as { sid?: string };
    return { ok: true, sid: json.sid };
  }

  async sendOtp(
    phoneE164: string,
    otpCode: string,
    purpose: string,
  ): Promise<{ accepted: boolean; provider_ref?: string; error?: string }> {
    const from = this.config.whatsappFrom;
    if (!from) return { accepted: false, error: "twilio_from_unconfigured" };

    const isWhatsApp = from.startsWith("whatsapp:");
    const to = isWhatsApp ? `whatsapp:${phoneE164}` : phoneE164;

    const form = new URLSearchParams({ To: to, From: from });
    if (this.config.otpContentSid) {
      form.set("ContentSid", this.config.otpContentSid);
      form.set("ContentVariables", JSON.stringify({ "1": otpCode }));
    } else if (isWhatsApp && this.config.whatsappContentSid) {
      // Fall back to configured WhatsApp Content template if dedicated OTP template SID is empty
      form.set("ContentSid", this.config.whatsappContentSid);
      form.set("ContentVariables", JSON.stringify({ "1": otpCode }));
    } else {
      form.set(
        "Body",
        `Your Sahayak verification code for ${purpose} is ${otpCode}. Valid for 5 minutes. Do not share this code.`,
      );
    }

    const res = await this.postMessage(form);
    return {
      accepted: res.ok,
      provider_ref: res.sid,
      error: res.ok ? undefined : `twilio_${res.error_code ?? "send_failed"}`,
    };
  }

  async sendSms(
    phoneE164: string,
    templateId: string,
    bodyText: string,
  ): Promise<{ sent: boolean; error?: string }> {
    const from = this.config.whatsappFrom;
    if (!from) return { sent: false, error: "twilio_from_unconfigured" };

    const isWhatsApp = from.startsWith("whatsapp:");
    const to = isWhatsApp ? `whatsapp:${phoneE164}` : phoneE164;

    const form = new URLSearchParams({ To: to, From: from });
    const contentSid = templateId || this.config.whatsappContentSid;
    if (contentSid) {
      form.set("ContentSid", contentSid);
      form.set("ContentVariables", JSON.stringify({ "1": bodyText }));
    } else {
      form.set("Body", bodyText);
    }

    const res = await this.postMessage(form);
    return res.ok ? { sent: true } : { sent: false, error: "twilio_send_failed" };
  }
}
