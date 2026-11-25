import crypto from "node:crypto";

export type ApplicationStatus =
  | "not_started"
  | "checklist_in_progress"
  | "ready_to_apply"
  | "redirected"
  | "submitted_externally"
  | "reference_received"
  | "under_verification"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "unknown";

export interface ApplicationRecord {
  id: string;
  user_id: string;
  scheme_id: string;
  evaluation_id?: string;
  status: ApplicationStatus;
  checklist_checked: Record<string, boolean>;
  official_portal_url: string;
  external_reference_no?: string;
  redirected_at?: string;
  updated_at: string;
}

export interface AuthorisedPortalSubmissionRequest {
  idempotency_key: string;
  scheme_id: string;
  consent_id: string;
  mapped_fields: Record<string, unknown>;
}

/**
 * Adapter interface for authorised external application APIs (Phase 6).
 * Only used when the scheme authority provides an approved API & user gave per-submission consent.
 * Default behaviour is official-portal redirect + checklist.
 */
export interface AuthorisedPortalAdapter {
  readonly adapter_name: string;
  readonly is_live: boolean;
  previewFieldMapping(schemeId: string, facts: Record<string, unknown>): Record<string, unknown>;
  submitWithConsent(req: AuthorisedPortalSubmissionRequest): Promise<{
    accepted: boolean;
    external_reference_no?: string;
    fallback_url?: string;
    error?: string;
  }>;
}

export class ApplicationWorkflowService {
  private readonly applications = new Map<string, ApplicationRecord>();

  startOrUpdateChecklist(
    userId: string,
    schemeId: string,
    officialPortalUrl: string,
    checkedDocs: Record<string, boolean>,
    evaluationId: string | undefined,
    nowIso: string,
  ): ApplicationRecord {
    const existing = [...this.applications.values()].find(
      (a) => a.user_id === userId && a.scheme_id === schemeId,
    );

    const allChecked = Object.values(checkedDocs).length > 0 && Object.values(checkedDocs).every(Boolean);
    const nextStatus: ApplicationStatus = allChecked ? "ready_to_apply" : "checklist_in_progress";

    if (existing) {
      existing.checklist_checked = { ...existing.checklist_checked, ...checkedDocs };
      existing.status = existing.status === "not_started" || existing.status === "checklist_in_progress"
        ? nextStatus
        : existing.status;
      existing.updated_at = nowIso;
      return existing;
    }

    const created: ApplicationRecord = {
      id: `app-${crypto.randomUUID()}`,
      user_id: userId,
      scheme_id: schemeId,
      evaluation_id: evaluationId,
      status: nextStatus,
      checklist_checked: checkedDocs,
      official_portal_url: officialPortalUrl,
      updated_at: nowIso,
    };
    this.applications.set(created.id, created);
    return created;
  }

  recordOfficialPortalRedirect(applicationId: string, nowIso: string): ApplicationRecord | null {
    const app = this.applications.get(applicationId);
    if (!app) return null;
    app.status = "redirected";
    app.redirected_at = nowIso;
    app.updated_at = nowIso;
    return app;
  }

  updateExternalStatus(
    applicationId: string,
    status: ApplicationStatus,
    externalReferenceNo: string | undefined,
    nowIso: string,
  ): ApplicationRecord | null {
    const app = this.applications.get(applicationId);
    if (!app) return null;
    app.status = status;
    if (externalReferenceNo) app.external_reference_no = externalReferenceNo;
    app.updated_at = nowIso;
    return app;
  }

  listForUser(userId: string): ApplicationRecord[] {
    return [...this.applications.values()].filter((a) => a.user_id === userId);
  }
}
