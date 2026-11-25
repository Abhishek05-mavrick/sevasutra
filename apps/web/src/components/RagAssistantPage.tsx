import React, { useState } from "react";
import type { EvaluationResult, Fact } from "rules-schema";
import type { Language, TranslationDictionary } from "../i18n.js";

interface ChatTurn {
  question: string;
  answer: string;
  refused: boolean;
  disclaimer: string;
  citations: Array<{ scheme_id: string; title: string; url: string; effective_from: string }>;
  retrieved_schemes?: Array<{
    scheme_id: string;
    title: string;
    score: number;
    evaluation: EvaluationResult;
  }>;
}

interface Props {
  apiBase: string;
  lang: Language;
  t: TranslationDictionary;
  facts: Fact[];
}

export function RagAssistantPage({ apiBase, lang, t, facts }: Props) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);

  const quickPrompts =
    lang === "hi"
      ? [
          "क्या मैं PM-KISAN के लिए पात्र हूँ?",
          "आवास और स्वास्थ्य बीमा योजनाओं की पात्रता बताएं",
          "SC/ST छात्रवृत्ति के लिए कौन से दस्तावेज़ चाहिए?",
        ]
      : [
          "Am I eligible for PM-KISAN farmer support?",
          "Which housing and health insurance schemes match my profile?",
          "What documents and income limit apply for SC/ST Post-Matric Scholarship?",
        ];

  async function askQuestion(qText: string) {
    if (!qText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/rag/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: qText,
          language: lang,
          facts,
          as_of: "2025-06-15",
        }),
      });
      const data = await res.json();
      setTurns((prev) => [
        {
          question: qText,
          answer: data.answer,
          refused: Boolean(data.refused),
          disclaimer: data.disclaimer,
          citations: data.citations ?? [],
          retrieved_schemes: data.retrieved_schemes ?? [],
        },
        ...prev,
      ]);
      setQuestion("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="rag-heading">
      <div className="card">
        <h2 id="rag-heading">{t.navAssistant}</h2>
        <p className="muted">{t.chatDisclaimer}</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "0.85rem" }}>
          {quickPrompts.map((p) => (
            <button key={p} type="button" className="btn btn-sm" onClick={() => askQuestion(p)}>
              {p}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            askQuestion(question);
          }}
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <input
            type="text"
            aria-label={t.chatPlaceholder}
            placeholder={t.chatPlaceholder}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Retrieving & Evaluating..." : t.chatAsk}
          </button>
        </form>
      </div>

      {turns.map((turn, idx) => (
        <article key={idx} className="card">
          <p style={{ marginTop: 0 }}>
            <strong>Question:</strong> {turn.question}
          </p>

          {turn.retrieved_schemes && turn.retrieved_schemes.length > 0 && (
            <div className="grid" style={{ marginBottom: "0.75rem" }}>
              {turn.retrieved_schemes.map((rs) => (
                <div key={rs.scheme_id} className="card-subtle">
                  <div className="header-row">
                    <strong>{rs.title}</strong>
                    <span className={`badge badge-${rs.evaluation.state}`}>{rs.evaluation.state}</span>
                  </div>
                  <div className="muted">
                    Retrieval score: {rs.score} | Passed: {rs.evaluation.passed.length} | Unmet/Pending:{" "}
                    {rs.evaluation.failed.length}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            className="card-subtle"
            style={turn.refused ? { background: "var(--warn-bg)", color: "var(--warn-text)" } : undefined}
          >
            <p style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{turn.answer}</p>
            <p className="muted" style={{ marginBottom: 0 }}>{turn.disclaimer}</p>
          </div>

          {turn.citations.length > 0 && (
            <div style={{ marginTop: "0.65rem" }}>
              <strong>Approved Source Citations:</strong>
              <ul style={{ margin: "0.25rem 0 0 1.2rem" }}>
                {turn.citations.map((c) => (
                  <li key={c.scheme_id}>
                    <a href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a>{" "}
                    <span className="muted">(effective {c.effective_from})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
