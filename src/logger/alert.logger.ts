import { ConsoleLogger } from '@nestjs/common';
import { notifyAdminWithFallback } from '../utils/admin-alert';

export class AlertLogger extends ConsoleLogger {
  // Simple in-memory throttle: don't send same error more than once per 60s
  private readonly seen = new Map<string, number>();

  error(message: any, ...optionalParams: any[]) {
    super.error(message, ...optionalParams);
    this.alert(String(message));
  }

  private alert(message: string) {
    const now = Date.now();
    // Evict entries older than 1 hour to prevent unbounded Map growth
    for (const [k, t] of this.seen) if (now - t > 3_600_000) this.seen.delete(k);

    const key = message.slice(0, 100);
    const lastSent = this.seen.get(key) ?? 0;
    if (now - lastSent < 60_000) return;
    this.seen.set(key, now);

    // Telegram first, e-mail fallback. Fire-and-forget — never throws.
    void notifyAdminWithFallback(`🚨 Ошибка на сервере\n${message.slice(0, 300)}`, '🚨 Ошибка на сервере SchemaLab');
  }
}
