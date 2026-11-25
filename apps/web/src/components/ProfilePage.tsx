import React, { useEffect, useState } from "react";
import type { Fact } from "rules-schema";
import type { TranslationDictionary } from "../i18n.js";
import {
  ASHA_FIXTURE_FORM,
  EMPTY_PROFILE_FORM,
  RAVI_FIXTURE_FORM,
  type ProfileFormState,
} from "../types.js";

interface NextQuestion {
  fact_key: string;
  stage: "discovery" | "scheme_specific";
  needed_by_schemes: string[];
  definition: { description: string };
}

interface Props {
  apiBase: string;
  t: TranslationDictionary;
  form: ProfileFormState;
  setForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  facts: Fact[];
  token: string | null;
  hasProfileConsent: boolean;
  onEvaluateAll: () => void;
  onGrantProfileConsent: () => Promise<void>;
}

export function ProfilePage({
  apiBase,
  t,
  form,
  setForm,
  facts,
  token,
  hasProfileConsent,
  onEvaluateAll,
  onGrantProfileConsent,
}: Props) {
  const [nextQuestions, setNextQuestions] = useState<NextQuestion[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/profile/next-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts, as_of: "2025-06-15" }),
    })
      .then((r) => r.json())
      .then((d: { questions?: NextQuestion[] }) => setNextQuestions(d.questions ?? []))
      .catch(() => setNextQuestions([]));
  }, [apiBase, facts]);

  async function saveToAccount() {
    setSaveMessage(null);
    setSaveError(null);
    if (!token) {
      setSaveError("Sign in with Twilio OTP in 'Account, OTP & Consent' to save your profile.");
      return;
    }
    if (!hasProfileConsent) {
      await onGrantProfileConsent();
    }
    const res = await fetch(`${apiBase}/profile/facts`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ facts }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaveError(data.error ?? "Failed to save profile.");
    } else {
      setSaveMessage(`Saved ${facts.length} facts to your account (sensitive keys masked in logs).`);
    }
  }

  return (
    <section aria-labelledby="profile-heading">
      <div className="card">
        <div className="header-row">
          <div>
            <h2 id="profile-heading" style={{ margin: 0 }}>{t.progressiveProfileTitle}</h2>
            <p className="muted" style={{ marginTop: "0.25rem" }}>{t.progressiveProfileHint}</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setForm(ASHA_FIXTURE_FORM)}
            >
              {t.fillDefaultAsha}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setForm(RAVI_FIXTURE_FORM)}
            >
              {t.fillDefaultRavi}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setForm(EMPTY_PROFILE_FORM)}
            >
              {t.clearProfile}
            </button>
          </div>
        </div>

        {nextQuestions.length > 0 && (
          <div className="card-subtle" style={{ marginBottom: "1rem" }}>
            <strong>Recommended Next Questions (Progressive Discovery):</strong>
            <ul style={{ margin: "0.35rem 0 0 1.2rem" }}>
              {nextQuestions.map((q) => (
                <li key={q.fact_key}>
                  <code>{q.fact_key}</code> ({q.stage}) — {q.definition.description}
                  {q.needed_by_schemes.length > 0 && (
                    <span className="muted"> [needed by {q.needed_by_schemes.join(", ")}]</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {saveError && (
          <div className="card-subtle" role="alert" style={{ background: "var(--err-bg)", color: "var(--err-text)", marginBottom: "0.75rem" }}>
            {saveError}
          </div>
        )}
        {saveMessage && (
          <div className="card-subtle" role="status" style={{ background: "var(--ok-bg)", color: "var(--ok-text)", marginBottom: "0.75rem" }}>
            {saveMessage}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onEvaluateAll();
          }}
        >
          <h3>1. Basic Discovery & Location</h3>
          <div className="grid">
            <div>
              <label htmlFor="p-dob">Date of Birth</label>
              <input id="p-dob" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </div>
            <div>
              <label htmlFor="p-state">State Code (e.g. KA, MH)</label>
              <input id="p-state" type="text" value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label htmlFor="p-district">District</label>
              <input id="p-district" type="text" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
            </div>
            <div>
              <label htmlFor="p-area">Area Type</label>
              <select id="p-area" value={form.areaType} onChange={(e) => setForm({ ...form, areaType: e.target.value })}>
                <option value="">Not specified</option>
                <option value="rural">Rural</option>
                <option value="urban">Urban</option>
                <option value="semi_urban">Semi-Urban</option>
              </select>
            </div>
          </div>

          <h3 style={{ marginTop: "1.2rem" }}>2. Demographics & Income (Optional / &ldquo;Prefer not to say&rdquo; supported)</h3>
          <div className="grid">
            <div>
              <label htmlFor="p-gender">Gender</label>
              <select id="p-gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Not specified</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="transgender">Transgender</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label htmlFor="p-cat">Social Category</label>
              <select id="p-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Not specified</option>
                <option value="general">General</option>
                <option value="sc">SC</option>
                <option value="st">ST</option>
                <option value="obc">OBC</option>
                <option value="ews">EWS</option>
                <option value="minority">Minority</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label htmlFor="p-inc">Annual Household Income (INR)</label>
              <input id="p-inc" type="number" value={form.annualIncome} onChange={(e) => setForm({ ...form, annualIncome: e.target.value })} />
            </div>
            <div>
              <label htmlFor="p-size">Household Size</label>
              <input id="p-size" type="number" min={1} value={form.householdSize} onChange={(e) => setForm({ ...form, householdSize: e.target.value })} />
            </div>
          </div>

          <h3 style={{ marginTop: "1.2rem" }}>3. Livelihood, Education & Household Flags</h3>
          <div className="grid">
            <div>
              <label htmlFor="p-bpl">Below Poverty Line (BPL)?</label>
              <select id="p-bpl" value={form.isBpl} onChange={(e) => setForm({ ...form, isBpl: e.target.value })}>
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label htmlFor="p-farmer">Farmer?</label>
              <select id="p-farmer" value={form.isFarmer} onChange={(e) => setForm({ ...form, isFarmer: e.target.value })}>
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label htmlFor="p-land">Land Holding (Hectares)</label>
              <input id="p-land" type="number" step="0.1" value={form.landHectares} onChange={(e) => setForm({ ...form, landHectares: e.target.value })} />
            </div>
            <div>
              <label htmlFor="p-student">Currently Enrolled Student?</label>
              <select id="p-student" value={form.isStudent} onChange={(e) => setForm({ ...form, isStudent: e.target.value })}>
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label htmlFor="p-edu">Education Level</label>
              <select id="p-edu" value={form.educationLevel} onChange={(e) => setForm({ ...form, educationLevel: e.target.value })}>
                <option value="">Not specified</option>
                <option value="higher_secondary">Higher Secondary (11–12)</option>
                <option value="iti">ITI</option>
                <option value="diploma">Diploma</option>
                <option value="undergraduate">Undergraduate</option>
                <option value="postgraduate">Postgraduate</option>
                <option value="phd">PhD</option>
              </select>
            </div>
            <div>
              <label htmlFor="p-emp">Regular Government/Formal Employment?</label>
              <select id="p-emp" value={form.isEmployed} onChange={(e) => setForm({ ...form, isEmployed: e.target.value })}>
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <h3 style={{ marginTop: "1.2rem" }}>4. Self-Declared Available Documents</h3>
          <div className="grid">
            {(
              [
                ["docAadhaar", "Aadhaar Card"],
                ["docBankPassbook", "Bank Passbook"],
                ["docCasteCert", "Caste Certificate"],
                ["docIncomeCert", "Income Certificate"],
                ["docLandRecord", "Land Record (7/12)"],
                ["docRationCard", "Ration Card"],
                ["docEducationCert", "Bonafide / Enrollment Certificate"],
              ] as Array<[keyof ProfileFormState, string]>
            ).map(([key, label]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.25rem" }}>
            <button type="submit" className="btn btn-primary">{t.runCheck}</button>
            <button type="button" className="btn" onClick={saveToAccount}>{t.saveProfileToAccount}</button>
          </div>
        </form>
      </div>
    </section>
  );
}
