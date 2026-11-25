import crypto from "node:crypto";
import type { Fact } from "rules-schema";

export const ALLOWED_DOC_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB

export interface DocumentUploadRequest {
  user_id: string;
  document_type: string;
  mime_type: string;
  content: Buffer;
  expires_at?: string;
}

export interface StoredDocumentMeta {
  id: string;
  user_id: string;
  document_type: string;
  mime_type: string;
  byte_size: number;
  sha256_hash: string;
  storage_key: string;
  virus_scan_status: "clean" | "infected" | "failed";
  expires_at?: string;
  created_at: string;
}

export interface VirusScanner {
  scan(content: Buffer): Promise<"clean" | "infected" | "failed">;
}

export interface ObjectStorageProvider {
  putEncrypted(key: string, content: Buffer, mimeType: string): Promise<void>;
  createSignedDownloadUrl(key: string, ttlSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

/** OCR returns suggested facts ONLY — never auto-confirmed into the citizen profile. */
export interface OcrProvider {
  readonly name: string;
  extractSuggestions(documentType: string, content: Buffer, mimeType: string): Promise<Array<{
    key: string;
    value: unknown;
    confidence: number;
  }>>;
}

export function validateDocumentUpload(mimeType: string, byteLength: number): string | null {
  if (!ALLOWED_DOC_MIME_TYPES.has(mimeType)) {
    return "unsupported_file_type";
  }
  if (byteLength <= 0 || byteLength > MAX_DOC_BYTES) {
    return "file_size_out_of_bounds";
  }
  return null;
}

/** Convert an OCR suggestion into an unconfirmed Fact that requires user confirmation. */
export function suggestionToUnconfirmedFact(
  key: string,
  value: unknown,
  collectedAt: string,
): Fact {
  return {
    key,
    value,
    source: "document_extracted",
    collected_at: collectedAt,
    confirmed_by_user: false, // Rule: extraction is suggestion only until confirmed
  };
}

export function computeDocumentSha256(content: Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}
