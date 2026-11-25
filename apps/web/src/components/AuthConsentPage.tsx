import React, { useState } from "react";
import type { TranslationDictionary } from "../i18n.js";
import type { AuthUserSummary } from "../types.js";

const CONSENT_PURPOSES = [
  { id: "profile_eligibility", label: "Save progressive profile facts for eligibility checks" },
  { id: "document_vault", label: "Store uploaded documents in encrypted private vault" },
  { id: "document_ocr_extract", label: "Allow OCR extraction suggestions (confirmation required)" },
  { id: "reminders_email", label: "Receive opt-in email reminders for deadlines & updates" },
  { id: "reminders_sms_whatsapp", label: "Receive opt-in SMS/WhatsApp deadline & status alerts" },
] as const;

interface Props {
  apiBase: string;
  t: TranslationDictionary;
  token: string | null;
  user: AuthUserSummary | null;
  activeConsents: Record<string, boolean>;
  onAuthenticated: (token: string, user: AuthUserSummary) => void;
  onRefreshConsents: () => Promise<void>;
  onLogout: () => void;
}

export function AuthConsentPage({
  apiBase,
  t,
  token,
  user,
  activeConsents,
  onAuthenticated,
  onRefreshConsents,
  onLogout,
}: Props) {
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reminder prefs
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState(21);
  const [quietEnd, setQuietEnd] = useState(8);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "login" }),
      });
      const data = await res.json();
      if (!res.ok || !data.challenge_id) {
        setErrorMsg(`OTP request failed: ${data.error ?? res.statusText}`);
      } else {
        setChallengeId(data.challenge_id);
        setStatusMsg("Twilio OTP dispatched. Check your WhatsApp/SMS and enter the 6-digit code below.");
      }
    } catch {
      setErrorMsg("Network error requesting OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setErrorMsg(`Verification failed: ${data.error ?? res.statusText}`);
      } else {
        onAuthenticated(data.token, {
          id: data.user.id,
          role: data.user.role,
          phone_masked: data.user.phone_e164
            ? `${String(data.user.phone_e164).slice(0, 5)}*****${String(data.user.phone_e164).slice(-2)}`
            : undefined,
        });
        setChallengeId(null);
        setOtp("");
        setStatusMsg("Verified Applicant session active.");
      }
    } catch {
      setErrorMsg("Network error verifying OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleConsent(purpose: string, currentlyActive: boolean) {
    if (!token) return;
    const url = currentlyActive ? `${apiBase}/consent/withdraw` : `${apiBase}/consent/grant`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ purpose, policy_version: "1.0" }),
    });
    await onRefreshConsents();
  }

  async function saveReminderPrefs(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await fetch(`${apiBase}/reminders/preferences`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email_enabled: emailEnabled,
        sms_enabled: false,
        whatsapp_enabled: whatsappEnabled,
        quiet_hours_start_ist: quietStart,
        quiet_hours_end_ist: quietEnd,
      }),
    });
    setStatusMsg("Reminder preferences saved (IST quiet hours respected).");
  }

  async function exportMyData() {
    if (!token) return;
    const res = await fetch(`${apiBase}/account/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sahayak-data-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (!token) return;
    await fetch(`${apiBase}/account`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    onLogout();
    setStatusMsg("Account, profile facts, documents, and consents deleted.");
  }

  return (
    <section aria-labelledby="auth-heading">
      <div className="card">
        <h2 id="auth-heading">{t.authTitle}</h2>
        <p className="muted">{t.authSubtitle}</p>

        {errorMsg && (
          <div className="card-subtle" role="alert" style={{ background: "var(--err-bg)", color: "var(--err-text)", marginBottom: "0.75rem" }}>
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div className="card-subtle" role="status" style={{ background: "var(--ok-bg)", color: "var(--ok-text)", marginBottom: "0.75rem" }}>
            {statusMsg}
          </div>
        )}

        {!user ? (
          <div className="grid-2">
            <form onSubmit={requestOtp} className="card-subtle">
              <h3>Step 1: Request Twilio OTP</h3>
              <label htmlFor="otp-phone">Indian Mobile Number (+91 or 10 digits)</label>
              <input
                id="otp-phone"
                type="tel"
                placeholder="+919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <p className="muted" style={{ marginTop: "0.4rem" }}>
                OTP verification authenticates your account; it does not prove scheme eligibility.
              </p>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Send OTP via Twilio
              </button>
            </form>

            <form onSubmit={verifyOtp} className="card-subtle">
              <h3>Step 2: Verify 6-Digit OTP</h3>
              <label htmlFor="otp-code">OTP Code</label>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={!challengeId}
                required
              />
              <p className="muted" style={{ marginTop: "0.4rem" }}>
                Max 3 attempts per challenge (15-minute lockout on brute force).
              </p>
              <button type="submit" className="btn btn-primary" disabled={busy || !challengeId}>
                Verify & Sign In
              </button>
            </form>
          </div>
        ) : (
          <div className="card-subtle">
            <div className="header-row">
              <div>
                <strong>Signed in:</strong> {user.phone_masked ?? user.id}{" "}
                <span className="badge badge-eligible">{user.role}</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="btn btn-sm" onClick={exportMyData}>
                  Export My Data (JSON)
                </button>
                <button type="button" className="btn btn-sm" onClick={onLogout}>
                  Sign Out
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={deleteAccount}>
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {user && (
        <div className="grid-2">
          <div className="card">
            <h3>DPDP Consent Controls</h3>
            <p className="muted">Grant or withdraw purpose-specific consent at any time.</p>
            {CONSENT_PURPOSES.map((p) => {
              const active = Boolean(activeConsents[p.id]);
              return (
                <div key={p.id} className="header-row" style={{ padding: "0.45rem 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <strong>{p.id}</strong>
                    <div className="muted">{p.label}</div>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-sm ${active ? "btn-primary" : ""}`}
                    onClick={() => toggleConsent(p.id, active)}
                  >
                    {active ? "Granted (Withdraw)" : "Grant Consent"}
                  </button>
                </div>
              );
            })}
          </div>

          <form onSubmit={saveReminderPrefs} className="card">
            <h3>Reminder & Quiet Hours Preferences (Phase 8)</h3>
            <p className="muted">No sensitive details or document links appear in email/SMS subjects.</p>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
              Enable Email Deadline & Rule Update Reminders
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <input type="checkbox" checked={whatsappEnabled} onChange={(e) => setWhatsappEnabled(e.target.checked)} />
              Enable Twilio WhatsApp Alerts
            </label>
            <div className="grid">
              <div>
                <label htmlFor="qh-start">Quiet Hours Start (IST 0–23)</label>
                <input id="qh-start" type="number" min={0} max={23} value={quietStart} onChange={(e) => setQuietStart(Number(e.target.value))} />
              </div>
              <div>
                <label htmlFor="qh-end">Quiet Hours End (IST 0–23)</label>
                <input id="qh-end" type="number" min={0} max={23} value={quietEnd} onChange={(e) => setQuietEnd(Number(e.target.value))} />
              </div>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <button type="submit" className="btn btn-primary">Save Preferences</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
