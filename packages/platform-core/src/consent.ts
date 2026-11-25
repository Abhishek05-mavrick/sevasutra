export type ConsentPurpose =
  | "auth_phone_otp"
  | "auth_google_oidc"
  | "profile_eligibility"
  | "document_vault"
  | "document_ocr_extract"
  | "reminders_email"
  | "reminders_sms_whatsapp"
  | "portal_data_share"
  | "analytics_pseudonymous";

export interface ConsentRecord {
  id: string;
  user_id: string;
  purpose: ConsentPurpose;
  policy_version: string;
  granted: boolean;
  granted_at: string;
  withdrawn_at?: string;
}

/** Explicit purpose-scoped consent ledger (DPDP Act 2023). */
export class ConsentStore {
  private readonly records: ConsentRecord[] = [];

  grant(userId: string, purpose: ConsentPurpose, policyVersion: string, nowIso: string): ConsentRecord {
    const record: ConsentRecord = {
      id: `cns-${this.records.length + 1}`,
      user_id: userId,
      purpose,
      policy_version: policyVersion,
      granted: true,
      granted_at: nowIso,
    };
    this.records.push(record);
    return record;
  }

  withdraw(userId: string, purpose: ConsentPurpose, nowIso: string): boolean {
    let changed = false;
    for (const r of this.records) {
      if (r.user_id === userId && r.purpose === purpose && r.granted && !r.withdrawn_at) {
        r.granted = false;
        r.withdrawn_at = nowIso;
        changed = true;
      }
    }
    return changed;
  }

  hasActiveConsent(userId: string, purpose: ConsentPurpose): boolean {
    const latest = [...this.records]
      .reverse()
      .find((r) => r.user_id === userId && r.purpose === purpose);
    return Boolean(latest && latest.granted && !latest.withdrawn_at);
  }

  exportUserConsents(userId: string): ConsentRecord[] {
    return this.records.filter((r) => r.user_id === userId);
  }

  deleteUserConsents(userId: string): void {
    for (let i = this.records.length - 1; i >= 0; i--) {
      if (this.records[i]!.user_id === userId) {
        this.records.splice(i, 1);
      }
    }
  }
}
