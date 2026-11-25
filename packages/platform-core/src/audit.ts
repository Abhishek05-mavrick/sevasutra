export interface AuditEvent {
  id: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const REDACTED_KEYS = new Set([
  "otp",
  "otp_code",
  "token",
  "access_token",
  "refresh_token",
  "aadhaar",
  "aadhaar_number",
  "bank_account",
  "account_number",
  "ifsc",
  "password",
  "secret",
  "document_content",
  "fact_value",
  "value",
]);

/** Recursively redact sensitive keys before writing to any audit log. */
export function redactMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (REDACTED_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactMetadata(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export class AuditLogger {
  private readonly events: AuditEvent[] = [];

  record(
    entry: Omit<AuditEvent, "id" | "created_at" | "metadata"> & {
      metadata?: Record<string, unknown>;
    },
    nowIso: string = new Date().toISOString(),
  ): AuditEvent {
    const event: AuditEvent = {
      id: `aud-${this.events.length + 1}`,
      actor_id: entry.actor_id,
      actor_role: entry.actor_role,
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id,
      metadata: redactMetadata(entry.metadata ?? {}),
      created_at: nowIso,
    };
    this.events.push(event);
    return event;
  }

  listForTarget(targetType: string, targetId: string): readonly AuditEvent[] {
    return this.events.filter((e) => e.target_type === targetType && e.target_id === targetId);
  }

  listAll(): readonly AuditEvent[] {
    return this.events;
  }
}
