export type ReminderCategory =
  | "profile_completion"
  | "missing_documents"
  | "upcoming_deadline"
  | "deadline_change"
  | "renewal_due"
  | "application_status"
  | "rule_impact_change";

export interface NotificationPreference {
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  quiet_hours_start_ist: number; // e.g. 21 (9 PM)
  quiet_hours_end_ist: number;   // e.g. 8  (8 AM)
}

export interface EmailMessage {
  to: string;
  subject: string;
  body_text: string;
  dedup_key: string;
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(msg: EmailMessage): Promise<{ sent: boolean; message_id?: string; error?: string }>;
}

export interface SmsProvider {
  readonly name: string;
  sendSms(phoneE164: string, dltTemplateId: string, bodyText: string): Promise<{ sent: boolean; error?: string }>;
}

/** Check if an hour (0–23 IST) falls inside quiet hours. */
export function isQuietHourIst(hourIst: number, startHour: number = 21, endHour: number = 8): boolean {
  if (startHour > endHour) {
    return hourIst >= startHour || hourIst < endHour;
  }
  return hourIst >= startHour && hourIst < endHour;
}

/** Sanitize email subjects so no Aadhaar, OTP, income, or document links ever appear. */
export function buildSafeReminderSubject(category: ReminderCategory, schemeTitle: string): string {
  const safeTitle = schemeTitle.replace(/[\r\n]/g, " ").slice(0, 60);
  switch (category) {
    case "upcoming_deadline":
      return `Sahayak Reminder: Upcoming application deadline for ${safeTitle}`;
    case "missing_documents":
      return `Sahayak Reminder: Document checklist update for ${safeTitle}`;
    case "rule_impact_change":
      return `Sahayak Update: Scheme criteria updated for ${safeTitle}`;
    case "renewal_due":
      return `Sahayak Reminder: Renewal window approaching for ${safeTitle}`;
    case "application_status":
      return `Sahayak Update: Application checklist status for ${safeTitle}`;
    case "deadline_change":
      return `Sahayak Update: Deadline change notice for ${safeTitle}`;
    case "profile_completion":
      return `Sahayak Reminder: Complete your profile for better scheme matches`;
  }
}

export class ReminderQueue {
  private readonly sentDedupKeys = new Set<string>();
  private readonly preferences = new Map<string, NotificationPreference>();

  setPreference(pref: NotificationPreference): void {
    this.preferences.set(pref.user_id, pref);
  }

  getPreference(userId: string): NotificationPreference {
    return (
      this.preferences.get(userId) ?? {
        user_id: userId,
        email_enabled: false, // explicit opt-in default
        sms_enabled: false,
        whatsapp_enabled: false,
        quiet_hours_start_ist: 21,
        quiet_hours_end_ist: 8,
      }
    );
  }

  async dispatchEmail(
    userId: string,
    email: string,
    category: ReminderCategory,
    schemeTitle: string,
    bodyText: string,
    dedupKey: string,
    hourIst: number,
    provider: EmailProvider,
  ): Promise<{ status: "sent" | "deduplicated" | "unsubscribed" | "quiet_hours" | "failed" }> {
    const pref = this.getPreference(userId);
    if (!pref.email_enabled) return { status: "unsubscribed" };
    if (this.sentDedupKeys.has(dedupKey)) return { status: "deduplicated" };
    if (isQuietHourIst(hourIst, pref.quiet_hours_start_ist, pref.quiet_hours_end_ist)) {
      return { status: "quiet_hours" };
    }

    const res = await provider.sendEmail({
      to: email,
      subject: buildSafeReminderSubject(category, schemeTitle),
      body_text: bodyText,
      dedup_key: dedupKey,
    });

    if (!res.sent) return { status: "failed" };
    this.sentDedupKeys.add(dedupKey);
    return { status: "sent" };
  }
}
