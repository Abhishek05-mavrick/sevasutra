import React, { useCallback, useEffect, useState } from "react";
import type { TranslationDictionary } from "../i18n.js";
import type { SchemeSummary, VaultDocItem } from "../types.js";

const DOC_TYPES = [
  "aadhaar",
  "income_certificate",
  "caste_certificate",
  "domicile_certificate",
  "disability_certificate",
  "bank_passbook",
  "ration_card",
  "education_certificate",
  "land_record",
  "voter_id",
  "pan_card",
] as const;

interface Props {
  apiBase: string;
  t: TranslationDictionary;
  token: string | null;
  hasVaultConsent: boolean;
  schemes: SchemeSummary[];
  onGrantVaultConsent: () => Promise<void>;
  onNavigateAuth: () => void;
  onFactsUpdated: () => Promise<void>;
}

export function DocumentVaultPage({
  apiBase,
  t,
  token,
  hasVaultConsent,
  schemes,
  onGrantVaultConsent,
  onNavigateAuth,
  onFactsUpdated,
}: Props) {
  const [docs, setDocs] = useState<VaultDocItem[]>([]);
  const [docType, setDocType] = useState<string>("income_certificate");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [runOcr, setRunOcr] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const fetchDocs = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/documents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { documents: VaultDocItem[] };
      setDocs(data.documents);
    }
  }, [apiBase, token]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    if (!token) {
      setErrorMsg("Please verify your phone via Twilio OTP first.");
      return;
    }
    if (!selectedFile) {
      setErrorMsg("Select a PDF, JPG, PNG, or WEBP file to upload.");
      return;
    }
    if (!hasVaultConsent) {
      await onGrantVaultConsent();
    }

    setUploading(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const contentBase64 = btoa(binary);

      const res = await fetch(`${apiBase}/documents/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_type: docType,
          filename: selectedFile.name,
          mime_type: selectedFile.type || "application/pdf",
          content_base64: contentBase64,
          expires_at: expiresAt || undefined,
          run_ocr: runOcr,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(`Upload rejected: ${data.error ?? res.statusText}`);
      } else {
        setStatusMsg(`Uploaded "${data.filename}" cleanly (SHA-256 verified, virus scan: ${data.virus_scan_status}).`);
        setSelectedFile(null);
        await fetchDocs();
        await onFactsUpdated();
      }
    } catch {
      setErrorMsg("Failed to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function openSignedDownload(docId: string) {
    if (!token) return;
    const res = await fetch(`${apiBase}/documents/${docId}/signed-url`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { signed_path: string };
    window.open(`${apiBase}${data.signed_path}`, "_blank", "noopener,noreferrer");
  }

  async function confirmOcr(docId: string, confirmed: boolean) {
    if (!token) return;
    await fetch(`${apiBase}/documents/${docId}/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirmed }),
    });
    await fetchDocs();
    await onFactsUpdated();
  }

  async function deleteDoc(docId: string) {
    if (!token) return;
    await fetch(`${apiBase}/documents/${docId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchDocs();
  }

  const uploadedTypes = new Set(docs.map((d) => d.document_type));

  return (
    <section aria-labelledby="docs-heading">
      <div className="card">
        <h2 id="docs-heading">{t.documentsPageTitle}</h2>
        <p className="muted">{t.documentsPageHint}</p>

        {!token && (
          <div className="card-subtle" style={{ marginBottom: "1rem", background: "var(--warn-bg)", color: "var(--warn-text)" }}>
            <strong>Verified Applicant Required:</strong> Sign in with Twilio OTP to upload and store documents in your encrypted vault.{" "}
            <button type="button" className="btn btn-sm btn-primary" onClick={onNavigateAuth} style={{ marginLeft: "0.5rem" }}>
              Go to Twilio OTP Sign-In
            </button>
          </div>
        )}

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

        <form onSubmit={handleUpload} className="card-subtle">
          <div className="grid">
            <div>
              <label htmlFor="doc-type">Document Type</label>
              <select id="doc-type" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((dt) => (
                  <option key={dt} value={dt}>{dt}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="doc-expiry">Expiry Date (optional)</label>
              <input id="doc-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div>
              <label htmlFor="doc-file">File (PDF, JPG, PNG, WEBP — max 10 MB)</label>
              <input
                id="doc-file"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", fontWeight: 500 }}>
            <input type="checkbox" checked={runOcr} onChange={(e) => setRunOcr(e.target.checked)} />
            Request OCR field extraction (suggestions only — requires your confirmation before saving to profile)
          </label>

          <div style={{ marginTop: "0.85rem" }}>
            <button type="submit" className="btn btn-primary" disabled={uploading || !token}>
              {uploading ? "Scanning & Uploading..." : t.uploadDocumentBtn}
            </button>
          </div>
        </form>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Your Vault Documents ({docs.length})</h3>
          {docs.length === 0 ? (
            <p className="muted">No documents uploaded yet.</p>
          ) : (
            docs.map((d) => (
              <div key={d.id} className="card-subtle" style={{ marginBottom: "0.75rem" }}>
                <div className="header-row">
                  <div>
                    <strong>{d.document_type}</strong> — {d.filename}
                    <div className="muted">
                      {(d.byte_size / 1024).toFixed(1)} KB | SHA-256: <code>{d.sha256_hash.slice(0, 12)}…</code>
                      {d.expires_at ? ` | Expires: ${d.expires_at}` : ""}
                    </div>
                  </div>
                  <span className={`badge badge-${d.virus_scan_status}`}>{d.virus_scan_status}</span>
                </div>

                {d.suggested_facts.length > 0 && !d.extraction_confirmed && (
                  <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "var(--warn-bg)", borderRadius: "6px" }}>
                    <strong>OCR Suggestions (Unconfirmed):</strong>
                    <ul>
                      {d.suggested_facts.map((sf) => (
                        <li key={sf.key}>{sf.key}: {String(sf.value)}</li>
                      ))}
                    </ul>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => confirmOcr(d.id, true)}>Confirm</button>{" "}
                    <button type="button" className="btn btn-sm" onClick={() => confirmOcr(d.id, false)}>Reject</button>
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
                  <button type="button" className="btn btn-sm" onClick={() => openSignedDownload(d.id)}>
                    Download via Short-Lived Signed URL (60s)
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteDoc(d.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3>Document Coverage Across Curated Schemes</h3>
          {schemes.map((s) => (
            <div key={s.scheme_id} style={{ paddingBottom: "0.65rem", marginBottom: "0.65rem", borderBottom: "1px solid var(--border)" }}>
              <strong>{s.title}</strong>
              <ul style={{ margin: "0.3rem 0 0 1.2rem" }}>
                {s.required_documents.map((req) => {
                  const hasIt = uploadedTypes.has(req.document_type);
                  return (
                    <li key={req.document_type}>
                      {hasIt ? "✅" : req.required ? "⬜" : "➖"} <strong>{req.document_type}</strong>{" "}
                      ({req.required ? "Required" : "Optional"})
                      {req.alternatives && req.alternatives.length > 0 && (
                        <span className="muted"> — Alternatives: {req.alternatives.join(", ")}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
