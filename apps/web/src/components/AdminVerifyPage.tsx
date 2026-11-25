import React, { useEffect, useState } from "react";
import type { TranslationDictionary } from "../i18n.js";
import type { SchemeSummary } from "../types.js";

interface Props {
  apiBase: string;
  t: TranslationDictionary;
  schemes: SchemeSummary[];
}

export function AdminVerifyPage({ apiBase, t, schemes }: Props) {
  const [feedback, setFeedback] = useState<Array<{ id: string; scheme_id?: string; feedback_type: string; message: string; created_at: string }>>([]);
  const [ruleJson, setRuleJson] = useState("");
  const [validationResult, setValidationResult] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/feedback`)
      .then((r) => r.json())
      .then((d: { feedback?: typeof feedback }) => setFeedback(d.feedback ?? []))
      .catch(() => setFeedback([]));
  }, [apiBase]);

  async function validateRuleJson(e: React.FormEvent) {
    e.preventDefault();
    try {
      const parsed = JSON.parse(ruleJson);
      const res = await fetch(`${apiBase}/rules/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setValidationResult(JSON.stringify(data, null, 2));
    } catch {
      setValidationResult("Invalid JSON syntax.");
    }
  }

  return (
    <section aria-labelledby="admin-heading">
      <div className="card">
        <h2 id="admin-heading">{t.navAdmin}</h2>
        <p className="muted">
          Published rule versions are immutable. Every seed scheme remains marked{" "}
          <code>needs_human_verification</code> until a curator verifies it against the official guideline PDF.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Scheme ID</th>
                <th>Title</th>
                <th>Rule / Content Version</th>
                <th>Lifecycle</th>
                <th>Last Verified</th>
                <th>Curator Status</th>
              </tr>
            </thead>
            <tbody>
              {schemes.map((s) => (
                <tr key={s.scheme_id}>
                  <td><code>{s.scheme_id}</code></td>
                  <td>{s.title}</td>
                  <td>v{s.rule_version} / {s.content_version}</td>
                  <td>{s.lifecycle_status}</td>
                  <td>{s.last_verified_on}</td>
                  <td><span className="badge badge-unverified">{s.curator_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>User-Reported Content Feedback ({feedback.length})</h3>
          {feedback.length === 0 ? (
            <p className="muted">No feedback submitted in this session.</p>
          ) : (
            <ul>
              {feedback.map((f) => (
                <li key={f.id}>
                  <strong>[{f.feedback_type}]</strong> {f.scheme_id ?? "general"}: {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={validateRuleJson} className="card">
          <h3>Rule Schema &amp; Fact-Catalogue Linter</h3>
          <label htmlFor="rule-json-input">Paste SchemeRuleVersion JSON</label>
          <textarea
            id="rule-json-input"
            rows={5}
            value={ruleJson}
            onChange={(e) => setRuleJson(e.target.value)}
            placeholder='{"scheme_id":"..."}'
          />
          <div style={{ marginTop: "0.5rem" }}>
            <button type="submit" className="btn btn-primary btn-sm">Validate Rule</button>
          </div>
          {validationResult && (
            <pre style={{ marginTop: "0.5rem", background: "var(--surface-alt)", padding: "0.5rem", overflowX: "auto" }}>
              {validationResult}
            </pre>
          )}
        </form>
      </div>
    </section>
  );
}
