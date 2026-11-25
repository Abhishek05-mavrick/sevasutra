import crypto from "node:crypto";
import type { Fact } from "rules-schema";
import {
  computeDocumentSha256,
  suggestionToUnconfirmedFact,
  validateDocumentUpload,
  type OcrProvider,
  type StoredDocumentMeta,
  type VirusScanner,
} from "./documents.js";
import type { AuditLogger } from "./audit.js";

export interface VaultDocumentRecord extends StoredDocumentMeta {
  filename: string;
  content_base64: string; // Stored only in private vault; never exposed via public URL
  suggested_facts: Array<{ key: string; value: unknown; confidence: number }>;
  extraction_confirmed: boolean;
}

interface SignedAccessToken {
  document_id: string;
  user_id: string;
  expires_at: number;
}

/**
 * In-memory encrypted-boundary Document Vault (Phase 2).
 * - Validates MIME type & size
 * - Runs pluggable VirusScanner before accepting
 * - Never generates public URLs (short-lived signed tokens only)
 * - OCR extractions are suggestions ONLY until user explicitly confirms
 */
export class DocumentVaultService {
  private readonly docs = new Map<string, VaultDocumentRecord>();
  private readonly signedTokens = new Map<string, SignedAccessToken>();

  constructor(
    private readonly virusScanner: VirusScanner,
    private readonly audit: AuditLogger,
    private readonly ocrProvider?: OcrProvider,
  ) {}

  async uploadDocument(params: {
    user_id: string;
    document_type: string;
    filename: string;
    mime_type: string;
    content: Buffer;
    expires_at?: string;
    ocr_consented: boolean;
    nowIso: string;
  }): Promise<{ ok: true; document: Omit<VaultDocumentRecord, "content_base64"> } | { ok: false; error: string }> {
    const validationErr = validateDocumentUpload(params.mime_type, params.content.byteLength);
    if (validationErr) return { ok: false, error: validationErr };

    const scanStatus = await this.virusScanner.scan(params.content);
    if (scanStatus !== "clean") {
      return { ok: false, error: `virus_scan_${scanStatus}` };
    }

    const id = `doc-${crypto.randomUUID()}`;
    const sha256 = computeDocumentSha256(params.content);
    const storageKey = `vault/${params.user_id}/${id}`;

    let suggestions: Array<{ key: string; value: unknown; confidence: number }> = [];
    if (params.ocr_consented && this.ocrProvider) {
      suggestions = await this.ocrProvider.extractSuggestions(
        params.document_type,
        params.content,
        params.mime_type,
      );
    }

    const record: VaultDocumentRecord = {
      id,
      user_id: params.user_id,
      document_type: params.document_type,
      filename: params.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120),
      mime_type: params.mime_type,
      byte_size: params.content.byteLength,
      sha256_hash: sha256,
      storage_key: storageKey,
      virus_scan_status: scanStatus,
      expires_at: params.expires_at,
      created_at: params.nowIso,
      content_base64: params.content.toString("base64"),
      suggested_facts: suggestions,
      extraction_confirmed: false,
    };

    this.docs.set(id, record);
    this.audit.record({
      actor_id: params.user_id,
      actor_role: "verified_applicant",
      action: "document_uploaded",
      target_type: "document",
      target_id: id,
      metadata: { document_type: params.document_type, byte_size: record.byte_size, ocr_ran: params.ocr_consented },
    });

    return { ok: true, document: this.stripContent(record) };
  }

  listForUser(userId: string): Array<Omit<VaultDocumentRecord, "content_base64">> {
    return [...this.docs.values()]
      .filter((d) => d.user_id === userId)
      .map((d) => this.stripContent(d));
  }

  /** Build a short-lived signed download token (never a permanent public URL). */
  createSignedToken(documentId: string, userId: string, ttlSeconds: number = 60, nowMs: number = Date.now()): string | null {
    const doc = this.docs.get(documentId);
    if (!doc || doc.user_id !== userId) return null;
    const sig = crypto.randomBytes(20).toString("hex");
    this.signedTokens.set(sig, {
      document_id: documentId,
      user_id: userId,
      expires_at: nowMs + ttlSeconds * 1000,
    });
    return sig;
  }

  readViaSignedToken(documentId: string, sig: string, nowMs: number = Date.now()): {
    mime_type: string;
    filename: string;
    content: Buffer;
  } | null {
    const tok = this.signedTokens.get(sig);
    if (!tok || tok.document_id !== documentId || nowMs > tok.expires_at) {
      return null;
    }
    const doc = this.docs.get(documentId);
    if (!doc || doc.user_id !== tok.user_id) return null;
    return {
      mime_type: doc.mime_type,
      filename: doc.filename,
      content: Buffer.from(doc.content_base64, "base64"),
    };
  }

  confirmExtraction(
    documentId: string,
    userId: string,
    confirmed: boolean,
    nowIso: string,
  ): { ok: true; confirmed_facts: Fact[] } | { ok: false; error: string } {
    const doc = this.docs.get(documentId);
    if (!doc || doc.user_id !== userId) return { ok: false, error: "document_not_found" };
    if (!confirmed) {
      doc.suggested_facts = [];
      return { ok: true, confirmed_facts: [] };
    }

    doc.extraction_confirmed = true;
    const facts: Fact[] = doc.suggested_facts.map((s) => ({
      ...suggestionToUnconfirmedFact(s.key, s.value, nowIso),
      confirmed_by_user: true,
      verified_at: nowIso,
    }));

    // Also confirm document presence fact
    facts.push({
      key: `document.${doc.document_type}`,
      value: true,
      source: "document_extracted",
      collected_at: nowIso,
      verified_at: nowIso,
      expires_at: doc.expires_at,
      confirmed_by_user: true,
    });

    return { ok: true, confirmed_facts: facts };
  }

  deleteDocument(documentId: string, userId: string): boolean {
    const doc = this.docs.get(documentId);
    if (!doc || doc.user_id !== userId) return false;
    this.docs.delete(documentId);
    this.audit.record({
      actor_id: userId,
      actor_role: "verified_applicant",
      action: "document_deleted",
      target_type: "document",
      target_id: documentId,
    });
    return true;
  }

  deleteAllForUser(userId: string): void {
    for (const [id, doc] of this.docs) {
      if (doc.user_id === userId) this.docs.delete(id);
    }
  }

  private stripContent(doc: VaultDocumentRecord): Omit<VaultDocumentRecord, "content_base64"> {
    const { content_base64: _hidden, ...rest } = doc;
    return rest;
  }
}
