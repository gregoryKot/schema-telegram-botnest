import { Injectable, Logger } from '@nestjs/common';

// Lightweight audit channel: posts security-relevant events to the admin
// Telegram chat, plus structured server logs. Use sparingly — admin will
// mute everything if we spam.

export type SecurityEvent =
  | 'login_success'
  | 'login_failed'
  | 'merge_initiated'
  | 'merge_confirmed'
  | 'provider_linked'
  | 'provider_unlinked'
  | 'role_changed'
  | 'therapist_request_submitted'
  | 'therapist_request_decided'
  | 'csrf_blocked'
  | 'rate_limited'
  | 'suspicious_initdata';

// Events we DM the admin about. Verbose events (success login etc) only
// go to server logs.
const ALERT_EVENTS = new Set<SecurityEvent>([
  'merge_confirmed',
  'role_changed',
  'therapist_request_submitted',
  'csrf_blocked',
  'suspicious_initdata',
]);

@Injectable()
export class SecurityLogService {
  private readonly logger = new Logger('SecurityAudit');

  log(event: SecurityEvent, data: Record<string, unknown>): void {
    const line = `[${event}] ${JSON.stringify(this.redact(data))}`;
    this.logger.log(line);
    if (ALERT_EVENTS.has(event)) {
      this.alertAdmin(event, data).catch(() => null);
    }
  }

  // Strip obvious secrets before logging.
  private redact(data: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      const lower = k.toLowerCase();
      if (lower.includes('token') || lower.includes('password') || lower.includes('secret') || lower === 'initdata') {
        out[k] = '[redacted]';
      } else if (typeof v === 'bigint') {
        out[k] = v.toString();
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private async alertAdmin(event: SecurityEvent, data: Record<string, unknown>): Promise<void> {
    const token = process.env.BOT_TOKEN;
    const adminId = process.env.ADMIN_ID;
    if (!token || !adminId) return;
    const redacted = this.redact(data);
    const text =
      `🔐 *${event}*\n` +
      Object.entries(redacted).map(([k, v]) => `${k}: \`${String(v).slice(0, 80)}\``).join('\n');
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: adminId, text, parse_mode: 'Markdown' }),
      });
    } catch (e) {
      this.logger.warn(`Admin alert failed: ${(e as Error).message}`);
    }
  }
}
