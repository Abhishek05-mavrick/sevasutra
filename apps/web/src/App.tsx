import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { EvaluationResult, Fact } from "rules-schema";
import { getTranslations, type Language } from "./i18n.js";
import {
  ASHA_FIXTURE_FORM,
  EMPTY_PROFILE_FORM,
  type AuthUserSummary,
  type ProfileFormState,
  type SchemeSummary,
} from "./types.js";
import { AuthConsentPage } from "./components/AuthConsentPage.js";
import { ProfilePage } from "./components/ProfilePage.js";
import { DocumentVaultPage } from "./components/DocumentVaultPage.js";
import { DashboardPage } from "./components/DashboardPage.js";
import { RagAssistantPage } from "./components/RagAssistantPage.js";
import { AdminVerifyPage } from "./components/AdminVerifyPage.js";

const API_BASE = import.meta.env["VITE_API_URL"] ?? "http://127.0.0.1:8000";
const TODAY_IST = "2025-06-15";

type Tab = "discover" | "profile" | "documents" | "assistant" | "auth" | "admin";

function formToFacts(form: ProfileFormState): Fact[] {
  const facts: Fact[] = [];
  const push = (key: string, value: unknown) => {
    facts.push({
      key,
      value,
      source: "user_entered",
      collected_at: TODAY_IST,
      confirmed_by_user: true,
    });
  };

  if (form.dob) push("applicant.dob", form.dob);
  if (form.stateCode) push("applicant.state_of_domicile", form.stateCode);
  if (form.district) push("applicant.district", form.district);
  if (form.areaType) push("applicant.area_type", form.areaType);
  if (form.gender) push("applicant.gender", form.gender);
  if (form.category) push("applicant.category", form.category);
  if (form.educationLevel) push("applicant.education_level", form.educationLevel);
  if (form.annualIncome !== "") push("household.annual_income", Number(form.annualIncome));
  if (form.householdSize !== "") push("household.size", Number(form.householdSize));
  if (form.landHectares !== "") push("applicant.land_holding_hectares", Number(form.landHectares));
  if (form.isBpl !== "") push("applicant.is_bpl", form.isBpl === "true");
  if (form.isFarmer !== "") push("applicant.is_farmer", form.isFarmer === "true");
  if (form.isStudent !== "") push("applicant.is_student", form.isStudent === "true");
  if (form.isEmployed !== "") push("applicant.is_employed", form.isEmployed === "true");

  if (form.docAadhaar) push("document.aadhaar", true);
  if (form.docBankPassbook) push("document.bank_passbook", true);
  if (form.docCasteCert) push("document.caste_certificate", true);
  if (form.docIncomeCert) push("document.income_certificate", true);
  if (form.docLandRecord) push("document.land_record", true);
  if (form.docRationCard) push("document.ration_card", true);
  if (form.docEducationCert) push("document.education_certificate", true);

  push("applicant.benefits_received", []);
  return facts;
}

export function App() {
  const [lang, setLang] = useState<Language>("en");
  const [tab, setTab] = useState<Tab>("discover");
  const [schemes, setSchemes] = useState<SchemeSummary[]>([]);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM);
  const [apiError, setApiError] = useState<string | null>(null);

  // Auth & consent state
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUserSummary | null>(null);
  const [activeConsents, setActiveConsents] = useState<Record<string, boolean>>({});
  const [serverDocFacts, setServerDocFacts] = useState<Fact[]>([]);

  const t = getTranslations(lang);

  const facts = useMemo(() => {
    const formFacts = formToFacts(form);
    const formKeys = new Set(formFacts.map((f) => f.key));
    return [...formFacts, ...serverDocFacts.filter((df) => !formKeys.has(df.key))];
  }, [form, serverDocFacts]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    fetch(`${API_BASE}/schemes`)
      .then((r) => r.json())
      .then((data: SchemeSummary[]) => setSchemes(data))
      .catch(() => setApiError(`API not reachable on ${API_BASE}.`));
  }, []);

  const refreshConsentsAndFacts = useCallback(async (tok?: string) => {
    const activeToken = tok ?? token;
    if (!activeToken) return;
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    if (meRes.ok) {
      const meData = (await meRes.json()) as {
        user: AuthUserSummary;
        consents: Array<{ purpose: string; granted: boolean; withdrawn_at?: string }>;
      };
      setUser(meData.user);
      const map: Record<string, boolean> = {};
      for (const c of meData.consents) {
        map[c.purpose] = Boolean(c.granted && !c.withdrawn_at);
      }
      setActiveConsents(map);
    }

    const profRes = await fetch(`${API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    if (profRes.ok) {
      const pData = (await profRes.json()) as { facts: Fact[] };
      setServerDocFacts(pData.facts);
    }
  }, [token]);

  async function runBatchEvaluation(customForm?: ProfileFormState) {
    setApiError(null);
    const activeFacts = customForm ? formToFacts(customForm) : facts;
    try {
      const res = await fetch(`${API_BASE}/evaluate/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_snapshot: activeFacts, as_of: TODAY_IST }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: EvaluationResult[] };
      setResults(data.results);
      setTab("discover");
    } catch {
      setApiError("Could not evaluate against API. Verify engine-api is running.");
    }
  }

  async function grantConsent(purpose: string) {
    if (!token) return;
    await fetch(`${apiBaseOrDefault()}/consent/grant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ purpose, policy_version: "1.0" }),
    });
    await refreshConsentsAndFacts();
  }

  function apiBaseOrDefault(): string {
    return API_BASE;
  }

  return (
    <div>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="notice-banner" role="note">
        {t.officialNotice}
      </div>

      <header className="header">
        <div className="container">
          <div className="header-row">
            <div>
              <h1 style={{ margin: 0 }}>{t.appTitle}</h1>
              <p className="muted" style={{ margin: 0 }}>{t.tagline}</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <span className={`badge ${user ? "badge-eligible" : "badge-info"}`}>
                {user ? `${t.roleApplicant}: ${user.phone_masked ?? user.id}` : t.roleExplorer}
              </span>
              <div>
                <label htmlFor="lang-select" style={{ display: "inline", marginRight: "0.4rem" }}>
                  {t.languageLabel}:
                </label>
                <select
                  id="lang-select"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Language)}
                  style={{ width: "auto" }}
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
            </div>
          </div>

          <nav className="nav" aria-label="Primary navigation">
            {(
              [
                ["discover", t.navDiscover],
                ["profile", t.navProfile],
                ["documents", t.navDocuments],
                ["assistant", t.navAssistant],
                ["auth", t.navAuth],
                ["admin", t.navAdmin],
              ] as Array<[Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`btn ${tab === key ? "btn-primary" : ""}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main id="main-content" className="container">
        {apiError && (
          <div className="card" role="alert" style={{ background: "var(--err-bg)", color: "var(--err-text)" }}>
            {apiError}
          </div>
        )}

        {tab === "discover" && (
          <DashboardPage
            apiBase={API_BASE}
            lang={lang}
            t={t}
            schemes={schemes}
            results={results}
            token={token}
            onEvaluateAll={() => runBatchEvaluation()}
            onFillAshaAndEvaluate={() => {
              setForm(ASHA_FIXTURE_FORM);
              runBatchEvaluation(ASHA_FIXTURE_FORM);
            }}
          />
        )}

        {tab === "profile" && (
          <ProfilePage
            apiBase={API_BASE}
            t={t}
            form={form}
            setForm={setForm}
            facts={facts}
            token={token}
            hasProfileConsent={Boolean(activeConsents["profile_eligibility"])}
            onEvaluateAll={() => runBatchEvaluation()}
            onGrantProfileConsent={() => grantConsent("profile_eligibility")}
          />
        )}

        {tab === "documents" && (
          <DocumentVaultPage
            apiBase={API_BASE}
            t={t}
            token={token}
            hasVaultConsent={Boolean(activeConsents["document_vault"])}
            schemes={schemes}
            onGrantVaultConsent={() => grantConsent("document_vault")}
            onNavigateAuth={() => setTab("auth")}
            onFactsUpdated={() => refreshConsentsAndFacts()}
          />
        )}

        {tab === "assistant" && (
          <RagAssistantPage apiBase={API_BASE} lang={lang} t={t} facts={facts} />
        )}

        {tab === "auth" && (
          <AuthConsentPage
            apiBase={API_BASE}
            t={t}
            token={token}
            user={user}
            activeConsents={activeConsents}
            onAuthenticated={async (newTok, newUser) => {
              setToken(newTok);
              setUser(newUser);
              await refreshConsentsAndFacts(newTok);
            }}
            onRefreshConsents={() => refreshConsentsAndFacts()}
            onLogout={() => {
              setToken(null);
              setUser(null);
              setActiveConsents({});
              setServerDocFacts([]);
            }}
          />
        )}

        {tab === "admin" && (
          <AdminVerifyPage apiBase={API_BASE} t={t} schemes={schemes} />
        )}
      </main>
    </div>
  );
}
