import crypto from "node:crypto";
import type { AuditLogger } from "./audit.js";

export type UserRole = "explorer" | "verified_applicant" | "curator" | "support_operator" | "admin";

export interface UserAccount {
  id: string;
  role: UserRole;
  display_name?: string;
  preferred_language: "en" | "hi";
  phone_e164?: string;
  google_sub?: string;
  mfa_enabled: boolean;
  deleted_at?: string;
}

export interface Session {
  token: string;
  user_id: string;
  role: UserRole;
  mfa_verified: boolean;
  expires_at: number;
}

/** Abstract OTP provider interface so SMS gateways (MSG91/Gupshup/Twilio/SNS) swap cleanly. */
export interface OtpProvider {
  readonly name: string;
  sendOtp(
    phoneE164: string,
    otpCode: string,
    purpose: string,
  ): Promise<{ accepted: boolean; provider_ref?: string; error?: string }>;
}

/** Abstract OIDC verifier for Google Sign-In (Explorer role ONLY). */
export interface OidcProvider {
  readonly name: string;
  verifyIdToken(idToken: string): Promise<{ sub: string; email?: string; name?: string } | null>;
}

/** Abstract Admin MFA verifier (e.g. TOTP). */
export interface MfaVerifier {
  verifyTotp(userId: string, code: string): Promise<boolean>;
}

interface OtpChallenge {
  id: string;
  phone_e164: string;
  salt: string;
  otp_hash: string;
  purpose: "login" | "register" | "link_account";
  attempts: number;
  max_attempts: number;
  expires_at: number;
  consumed: boolean;
}

const INDIAN_PHONE_RE = /^\+91[6-9]\d{9}$/;

/** Normalize 10-digit or +91 Indian mobile number to E.164. Returns null if invalid. */
export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  if (INDIAN_PHONE_RE.test(digits)) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  return null;
}

function hashOtp(otp: string, salt: string): string {
  return crypto.scryptSync(otp, salt, 32).toString("hex");
}

export class AuthService {
  private readonly users = new Map<string, UserAccount>();
  private readonly challenges = new Map<string, OtpChallenge>();
  private readonly lockouts = new Map<string, number>(); // phone -> lockedUntilMs
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly otpProvider: OtpProvider,
    private readonly oidcProvider: OidcProvider,
    private readonly audit: AuditLogger,
  ) {}

  async requestPhoneOtp(
    rawPhone: string,
    purpose: "login" | "register" | "link_account",
    nowMs: number = Date.now(),
  ): Promise<{ ok: true; challenge_id: string; expires_in_seconds: number } | { ok: false; error: string }> {
    const phone = normalizeIndianPhone(rawPhone);
    if (!phone) {
      return { ok: false, error: "invalid_indian_phone_number" };
    }

    const lockedUntil = this.lockouts.get(phone);
    if (lockedUntil && nowMs < lockedUntil) {
      return { ok: false, error: "phone_temporarily_locked" };
    }

    const otpCode = String(crypto.randomInt(100000, 999999));
    const salt = crypto.randomBytes(16).toString("hex");
    const challenge: OtpChallenge = {
      id: `otp-${crypto.randomUUID()}`,
      phone_e164: phone,
      salt,
      otp_hash: hashOtp(otpCode, salt),
      purpose,
      attempts: 0,
      max_attempts: 3,
      expires_at: nowMs + 5 * 60 * 1000,
      consumed: false,
    };

    this.challenges.set(challenge.id, challenge);
    const delivery = await this.otpProvider.sendOtp(phone, otpCode, purpose);
    if (!delivery.accepted) {
      return { ok: false, error: delivery.error ?? "otp_delivery_failed" };
    }

    // Never log the OTP value!
    this.audit.record({
      actor_id: null,
      actor_role: "system",
      action: "otp_requested",
      target_type: "otp_challenge",
      target_id: challenge.id,
      metadata: { purpose, provider: this.otpProvider.name },
    });

    return { ok: true, challenge_id: challenge.id, expires_in_seconds: 300 };
  }

  verifyPhoneOtp(
    challengeId: string,
    otpCode: string,
    nowMs: number = Date.now(),
  ): { ok: true; user: UserAccount; session: Session } | { ok: false; error: string } {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return { ok: false, error: "challenge_not_found" };
    if (challenge.consumed) return { ok: false, error: "challenge_already_used" };
    if (nowMs > challenge.expires_at) return { ok: false, error: "challenge_expired" };

    challenge.attempts += 1;
    const expected = Buffer.from(challenge.otp_hash, "hex");
    const actual = Buffer.from(hashOtp(otpCode, challenge.salt), "hex");
    const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!match) {
      if (challenge.attempts >= challenge.max_attempts) {
        challenge.consumed = true;
        this.lockouts.set(challenge.phone_e164, nowMs + 15 * 60 * 1000);
        return { ok: false, error: "max_attempts_exceeded_locked" };
      }
      return { ok: false, error: "invalid_otp" };
    }

    challenge.consumed = true;

    let user = [...this.users.values()].find((u) => u.phone_e164 === challenge.phone_e164 && !u.deleted_at);
    if (!user) {
      user = {
        id: `usr-${crypto.randomUUID()}`,
        role: "verified_applicant",
        preferred_language: "en",
        phone_e164: challenge.phone_e164,
        mfa_enabled: false,
      };
      this.users.set(user.id, user);
    }

    const session = this.createSession(user, false, nowMs);
    this.audit.record({
      actor_id: user.id,
      actor_role: user.role,
      action: "phone_otp_verified",
      target_type: "user",
      target_id: user.id,
      metadata: { session_created: true },
    });

    return { ok: true, user, session };
  }

  /** Google Sign-In strictly yields an Explorer account (never auto-grants application privileges). */
  async signInWithGoogleExplorer(
    idToken: string,
    nowMs: number = Date.now(),
  ): Promise<{ ok: true; user: UserAccount; session: Session } | { ok: false; error: string }> {
    const claims = await this.oidcProvider.verifyIdToken(idToken);
    if (!claims) return { ok: false, error: "invalid_oidc_token" };

    let user = [...this.users.values()].find((u) => u.google_sub === claims.sub && !u.deleted_at);
    if (!user) {
      user = {
        id: `usr-${crypto.randomUUID()}`,
        role: "explorer", // Strict invariant: Google sign-in stays Explorer
        display_name: claims.name,
        preferred_language: "en",
        google_sub: claims.sub,
        mfa_enabled: false,
      };
      this.users.set(user.id, user);
    }

    const session = this.createSession(user, false, nowMs);
    this.audit.record({
      actor_id: user.id,
      actor_role: user.role,
      action: "google_explorer_signin",
      target_type: "user",
      target_id: user.id,
    });

    return { ok: true, user, session };
  }

  /** Link an Explorer Google account to a verified phone number with explicit confirmation and conflict check. */
  linkExplorerPhone(
    explorerUserId: string,
    challengeId: string,
    otpCode: string,
    confirmedByUser: boolean,
    nowMs: number = Date.now(),
  ): { ok: true; user: UserAccount } | { ok: false; error: string } {
    if (!confirmedByUser) return { ok: false, error: "explicit_confirmation_required" };
    const explorer = this.users.get(explorerUserId);
    if (!explorer || explorer.deleted_at) return { ok: false, error: "user_not_found" };

    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.purpose !== "link_account") {
      return { ok: false, error: "invalid_link_challenge" };
    }

    const existingPhoneOwner = [...this.users.values()].find(
      (u) => u.phone_e164 === challenge.phone_e164 && u.id !== explorerUserId && !u.deleted_at,
    );
    if (existingPhoneOwner) {
      return { ok: false, error: "phone_already_linked_to_another_account" };
    }

    const verified = this.verifyPhoneOtp(challengeId, otpCode, nowMs);
    if (!verified.ok) return verified;

    // Remove auto-created user if verifyPhoneOtp created a separate record, then upgrade explorer
    if (verified.user.id !== explorer.id) {
      this.users.delete(verified.user.id);
    }
    explorer.phone_e164 = challenge.phone_e164;
    if (explorer.role === "explorer") {
      explorer.role = "verified_applicant";
    }

    this.audit.record({
      actor_id: explorer.id,
      actor_role: explorer.role,
      action: "explorer_phone_linked",
      target_type: "user",
      target_id: explorer.id,
    });

    return { ok: true, user: explorer };
  }

  getSession(token: string, nowMs: number = Date.now()): Session | null {
    const s = this.sessions.get(token);
    if (!s || nowMs > s.expires_at) return null;
    return s;
  }

  getUserById(userId: string): UserAccount | null {
    const u = this.users.get(userId);
    if (!u || u.deleted_at) return null;
    return u;
  }

  revokeSession(token: string): void {
    this.sessions.delete(token);
  }

  /** Role guard helper. Admins/curators must have mfa_verified when MFA is enforced. */
  requireRole(session: Session | null, allowed: readonly UserRole[], requireMfa = false): boolean {
    if (!session) return false;
    if (!allowed.includes(session.role)) return false;
    if (requireMfa && !session.mfa_verified) return false;
    return true;
  }

  seedStaffUser(user: UserAccount): void {
    this.users.set(user.id, user);
  }

  createStaffSession(user: UserAccount, mfaVerified: boolean, nowMs: number = Date.now()): Session {
    return this.createSession(user, mfaVerified, nowMs);
  }

  deleteUser(userId: string, nowIso: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.deleted_at = nowIso;
    for (const [token, s] of this.sessions) {
      if (s.user_id === userId) this.sessions.delete(token);
    }
    this.audit.record({
      actor_id: userId,
      actor_role: user.role,
      action: "account_deleted",
      target_type: "user",
      target_id: userId,
    });
    return true;
  }

  private createSession(user: UserAccount, mfaVerified: boolean, nowMs: number): Session {
    const session: Session = {
      token: crypto.randomBytes(24).toString("hex"),
      user_id: user.id,
      role: user.role,
      mfa_verified: mfaVerified,
      expires_at: nowMs + 24 * 60 * 60 * 1000,
    };
    this.sessions.set(session.token, session);
    return session;
  }
}
