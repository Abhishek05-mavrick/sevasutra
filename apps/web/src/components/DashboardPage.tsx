import React, { useState } from "react";
import type { EvaluationResult } from "rules-schema";
import type { Language, TranslationDictionary } from "../i18n.js";
import type { SchemeSummary } from "../types.js";

interface Props {
  apiBase: string;
  lang: Language;
  t: TranslationDictionary;
  schemes: SchemeSummary[];
  results: EvaluationResult[];
  token: string | null;
  onEvaluateAll: () => void;
  onFillAshaAndEvaluate: () => void;
}

export function DashboardPage({
  apiBase,
  lang,
  t,
  schemes,
  results,
  token,
  onEvaluateAll,
  onFillAshaAndEvaluate,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [benefitFilter, setBenefitFilter] = useState("all");
  const [savedOnly, setSavedOnly] = useState(false);

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [checkedDocsByScheme, setCheckedDocsByScheme] = useState<Record<string, Record<string, boolean>>>({});
  const [redirectStatusByScheme, setRedirectStatusByScheme] = useState<Record<string, string>>({});

  const [feedbackScheme, setFeedbackScheme] = useState("");
  const [feedbackType, setFeedbackType] = useState("outdated_info");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const eligibleCount = results.filter((r) => r.state === "eligible").length;
  const partialCount = results.filter((r) => r.state === "partially_eligible").length;
  const closingSoonCount = results.filter((r) => r.deadline.status === "closing_soon").length;
  const reviewCount = results.filter((r) => r.state === "needs_manual_review").length;

  function toggleSaved(schemeId: string) {
    setSavedIds((prev) =>
      prev.includes(schemeId) ? prev.filter((id) => id !== schemeId) : [...prev, schemeId],
    );
  }

  function toggleCompare(schemeId: string) {
    setCompareIds((prev) => {
      if (prev.includes(schemeId)) return prev.filter((id) => id !== schemeId);
      if (prev.length >= 3) return [...prev.slice(1), schemeId];
      return [...prev, schemeId];
    });
  }

  async function toggleDocChecklist(scheme: SchemeSummary, docType: string, evalId: string) {
    const prev = checkedDocsByScheme[scheme.scheme_id] ?? {};
    const next = { ...prev, [docType]: !prev[docType] };
    setCheckedDocsByScheme((cur) => ({ ...cur, [scheme.scheme_id]: next }));

    if (token) {
      await fetch(`${apiBase}/applications/checklist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scheme_id: scheme.scheme_id,
          checked_docs: next,
          evaluation_id: evalId,
        }),
      });
    }
  }

  async function openOfficialPortal(scheme: SchemeSummary, evalId: string) {
    if (token) {
      const checklistRes = await fetch(`${apiBase}/applications/checklist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scheme_id: scheme.scheme_id,
          checked_docs: checkedDocsByScheme[scheme.scheme_id] ?? {},
          evaluation_id: evalId,
        }),
      });
      if (checklistRes.ok) {
        const appRecord = (await checklistRes.json()) as { id: string };
        await fetch(`${apiBase}/applications/${appRecord.id}/redirect`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
    setRedirectStatusByScheme((cur) => ({ ...cur, [scheme.scheme_id]: "redirected" }));
    window.open(scheme.url, "_blank", "noopener,noreferrer");
  }

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackMsg.trim()) return;
    await fetch(`${apiBase}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheme_id: feedbackScheme || undefined,
        feedback_type: feedbackType,
        message: feedbackMsg,
      }),
    });
    setFeedbackMsg("");
    setFeedbackSaved(true);
  }

  const filteredResults = results.filter((res) => {
    const meta = schemes.find((s) => s.scheme_id === res.scheme_id);
    if (stateFilter !== "all" && res.state !== stateFilter) return false;
    if (benefitFilter !== "all" && res.benefit.type !== benefitFilter) return false;
    if (savedOnly && !savedIds.includes(res.scheme_id)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hay = `${meta?.title ?? ""} ${res.scheme_id} ${res.benefit.basis}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const comparedResults = results.filter((r) => compareIds.includes(r.scheme_id));

  return (
    <section aria-labelledby="discover-heading">
      {/* KPI Summary Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{eligibleCount}</div>
          <div className="kpi-label">Likely Eligible</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{partialCount}</div>
          <div className="kpi-label">Partially Eligible</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{closingSoonCount}</div>
          <div className="kpi-label">Closing Soon</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{savedIds.length}</div>
          <div className="kpi-label">Saved Schemes</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{Object.keys(redirectStatusByScheme).length}</div>
          <div className="kpi-label">Redirected / Applied</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{reviewCount}</div>
          <div className="kpi-label">Manual Review</div>
        </div>
      </div>

      {/* Filters & Quick Actions */}
      <div className="card">
        <div className="header-row" style={{ marginBottom: "0.75rem" }}>
          <h2 id="discover-heading" style={{ margin: 0 }}>{t.navDiscover}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button type="button" className="btn" onClick={onFillAshaAndEvaluate}>
              {t.fillDefaultAsha} &amp; Evaluate
            </button>
            <button type="button" className="btn btn-primary" onClick={onEvaluateAll}>
              {t.runCheck}
            </button>
          </div>
        </div>

        <div className="grid">
          <div>
            <label htmlFor="f-search">Search Schemes</label>
            <input
              id="f-search"
              type="text"
              placeholder="PM-KISAN, housing, scholarship..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="f-state">Eligibility State</label>
            <select id="f-state" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="all">All States ({results.length})</option>
              <option value="eligible">{t.likelyEligible}</option>
              <option value="partially_eligible">{t.partiallyEligible}</option>
              <option value="not_eligible">{t.notEligible}</option>
              <option value="needs_manual_review">{t.needsReview}</option>
              <option value="expired_or_closed">{t.expiredOrClosed}</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-benefit">Benefit Type</label>
            <select id="f-benefit" value={benefitFilter} onChange={(e) => setBenefitFilter(e.target.value)}>
              <option value="all">All Benefit Types</option>
              <option value="cash">Cash</option>
              <option value="subsidy">Subsidy</option>
              <option value="insurance">Insurance</option>
              <option value="non_cash">Non-cash / Service</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
              <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} />
              Show Saved Only ({savedIds.length})
            </label>
          </div>
        </div>
      </div>

      {/* Benefit Breakdown (No cross-scheme summing per Phase 5 rules) */}
      {results.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Benefit Basis Summary (Per-Scheme — Never Summed or Guaranteed)</h3>
          <div className="grid">
            {results
              .filter((r) => r.state === "eligible" || r.state === "partially_eligible")
              .map((r) => (
                <div key={r.scheme_id} className="card-subtle">
                  <strong>{schemes.find((s) => s.scheme_id === r.scheme_id)?.title ?? r.scheme_id}</strong>
                  <div>
                    <span className="badge badge-info">{r.benefit.type}</span>{" "}
                    <span className="badge badge-unverified">{r.benefit.certainty}</span>
                  </div>
                  {r.benefit.stated_amount && (
                    <div style={{ marginTop: "0.3rem", fontWeight: 600 }}>
                      Stated: ₹{(r.benefit.stated_amount.min ?? 0).toLocaleString("en-IN")} – ₹
                      {(r.benefit.stated_amount.max ?? 0).toLocaleString("en-IN")} ({r.benefit.stated_amount.frequency})
                    </div>
                  )}
                  <div className="muted" style={{ marginTop: "0.2rem" }}>{r.benefit.basis}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison */}
      {comparedResults.length >= 2 && (
        <div className="card">
          <div className="header-row">
            <h3 style={{ margin: 0 }}>Scheme Comparison ({comparedResults.length})</h3>
            <button type="button" className="btn btn-sm" onClick={() => setCompareIds([])}>Clear Comparison</button>
          </div>
          <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Scheme</th>
                  <th>State</th>
                  <th>Benefit &amp; Certainty</th>
                  <th>Deadline</th>
                  <th>Missing Info</th>
                  <th>Source Freshness</th>
                </tr>
              </thead>
              <tbody>
                {comparedResults.map((r) => (
                  <tr key={r.scheme_id}>
                    <td><strong>{schemes.find((s) => s.scheme_id === r.scheme_id)?.title ?? r.scheme_id}</strong></td>
                    <td><span className={`badge badge-${r.state}`}>{r.state}</span></td>
                    <td>
                      {r.benefit.type} ({r.benefit.certainty})
                      {r.benefit.estimated_maximum ? ` — up to ₹${r.benefit.estimated_maximum.toLocaleString("en-IN")}` : ""}
                    </td>
                    <td>{r.deadline.status}{r.deadline.closes ? ` (${r.deadline.closes})` : ""}</td>
                    <td>{r.missing_info.map((m) => m.key).join(", ") || "None"}</td>
                    <td>{r.source_freshness.last_verified_on} ({r.source_freshness.age_days}d)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scheme Results */}
      {results.length === 0 ? (
        <div className="card">
          <p>
            No evaluation run yet. Click <strong>{t.fillDefaultAsha} &amp; Evaluate</strong> above or open{" "}
            <strong>{t.navProfile}</strong> to enter your details.
          </p>
        </div>
      ) : (
        filteredResults.map((res) => {
          const meta = schemes.find((s) => s.scheme_id === res.scheme_id);
          const isSaved = savedIds.includes(res.scheme_id);
          const isCompared = compareIds.includes(res.scheme_id);
          const reqDocs = meta?.required_documents ?? [];
          const checkedMap = checkedDocsByScheme[res.scheme_id] ?? {};
          const checkedCount = reqDocs.filter((d) => checkedMap[d.document_type]).length;
          const progressPct = reqDocs.length > 0 ? Math.round((checkedCount / reqDocs.length) * 100) : 100;

          return (
            <article key={res.scheme_id} className="card">
              <div className="header-row">
                <div>
                  <h3 style={{ margin: 0 }}>{meta?.title ?? res.scheme_id}</h3>
                  <div className="muted">
                    Rule v{res.rule_version} | Eval ID: <code>{res.evaluation_id}</code> |{" "}
                    <span className="badge badge-unverified">{t.needsHumanVerification}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                  <span className={`badge badge-${res.state}`}>{res.state}</span>
                  <button type="button" className="btn btn-sm" onClick={() => toggleSaved(res.scheme_id)}>
                    {isSaved ? "★ Saved" : "☆ Save"}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => toggleCompare(res.scheme_id)}>
                    {isCompared ? "✓ Comparing" : "Compare"}
                  </button>
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: "0.85rem" }}>
                <div className="card-subtle">
                  <h4 style={{ marginTop: 0 }}>{t.passedCriteria} ({res.passed.length})</h4>
                  {res.passed.length === 0 ? (
                    <p className="muted">None yet.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                      {res.passed.map((c) => (
                        <li key={c.node_id}>{lang === "hi" && c.explain.hi ? c.explain.hi : c.explain.en}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="card-subtle">
                  <h4 style={{ marginTop: 0 }}>{t.failedCriteria} ({res.failed.length})</h4>
                  {res.failed.length === 0 ? (
                    <p className="muted">No unmet or pending criteria.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                      {res.failed.map((c) => (
                        <li key={c.node_id}>
                          <strong>[{c.outcome}]</strong> {lang === "hi" && c.explain.hi ? c.explain.hi : c.explain.en}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {res.what_would_change.length > 0 && (
                <div className="card-subtle" style={{ marginTop: "0.75rem" }}>
                  <strong>{t.whatWouldChange}</strong>
                  <ul style={{ margin: "0.3rem 0 0 1.2rem" }}>
                    {res.what_would_change.map((w) => (
                      <li key={w.node_id}>{lang === "hi" && w.condition_description.hi ? w.condition_description.hi : w.condition_description.en}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Phase 6: Interactive Document Checklist & Official Portal Redirect */}
              {meta && (
                <div className="card-subtle" style={{ marginTop: "0.75rem" }}>
                  <div className="header-row" style={{ marginBottom: "0.4rem" }}>
                    <strong>{t.missingDocuments} ({checkedCount}/{reqDocs.length} ready)</strong>
                    <span className="muted">
                      Status: <code>{redirectStatusByScheme[res.scheme_id] ?? "checklist_in_progress"}</code>
                    </span>
                  </div>
                  <div className="progress-track" aria-label={`Checklist progress ${progressPct}%`}>
                    <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="grid" style={{ marginTop: "0.6rem" }}>
                    {reqDocs.map((d) => (
                      <label key={d.document_type} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 500 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(checkedMap[d.document_type])}
                          onChange={() => toggleDocChecklist(meta, d.document_type, res.evaluation_id)}
                        />
                        <span>
                          {d.document_type} {d.required ? "(Required)" : "(Optional)"}
                          {d.alternatives?.length ? ` [Alt: ${d.alternatives.join(", ")}]` : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="header-row" style={{ marginTop: "0.75rem" }}>
                    <span className="muted">
                      {t.benefitBasis}: {res.benefit.basis}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => openOfficialPortal(meta, res.evaluation_id)}
                    >
                      {t.openOfficialPortal}
                    </button>
                  </div>
                </div>
              )}

              <p className="muted" style={{ marginBottom: 0, marginTop: "0.6rem" }}>
                <strong>{t.sourceDetails}:</strong> {res.source_freshness.source_url} | Verified:{" "}
                {res.source_freshness.last_verified_on} ({res.source_freshness.age_days} days old) | Deadline:{" "}
                {res.deadline.status}
              </p>
            </article>
          );
        })
      )}

      {/* Feedback Form */}
      <div className="card">
        <h3>{t.feedbackTitle}</h3>
        <form onSubmit={submitFeedback} className="grid">
          <div>
            <label htmlFor="fb-scheme">Scheme (optional)</label>
            <select id="fb-scheme" value={feedbackScheme} onChange={(e) => setFeedbackScheme(e.target.value)}>
              <option value="">General / Platform</option>
              {schemes.map((s) => (
                <option key={s.scheme_id} value={s.scheme_id}>{s.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fb-type">Issue Type</label>
            <select id="fb-type" value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}>
              <option value="outdated_info">Outdated guideline / amount</option>
              <option value="broken_link">Broken official URL</option>
              <option value="rule_discrepancy">Eligibility rule discrepancy</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="fb-msg">Details</label>
            <input id="fb-msg" type="text" value={feedbackMsg} onChange={(e) => setFeedbackMsg(e.target.value)} placeholder="Describe the issue..." />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
            <button type="submit" className="btn">{t.submitFeedback}</button>
            {feedbackSaved && <span className="badge badge-eligible">Saved</span>}
          </div>
        </form>
      </div>
    </section>
  );
}
