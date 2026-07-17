import { ConsoleLogger } from '@nestjs/common';
import { notifyAdminWithFallback } from '../utils/admin-alert';

export class AlertLogger extends ConsoleLogger {
  // Simple in-memory throttle: don't send same error more than once per 60s
  private readonly seen = new Map<string, number>();

  error(message: unknown, ...optionalParams: unknown[]) {
    super.error(message, ...optionalParams);
    this.alert(typeof message === 'string' ? message : JSON.stringify(message));
  }

  private alert(message: string) {
    const now = Date.now();
    // Evict entries older than 1 hour to prevent unbounded Map growth
    for (const [k, t] of this.seen)
      if (now - t > 3_600_000) this.seen.delete(k);

    // Нормализованный ключ (аудит 2026-07, I-4): числа/uuid/hex заменяются
    // плейсхолдером, иначе «Failed … id=1», «id=2», … — это разные ключи, и
    // массовый сбой обходит троттлинг лавиной DM админу.
    const key = message
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<uuid>')
      .replace(/\d+/g, '<n>')
      .slice(0, 100);
    const lastSent = this.seen.get(key) ?? 0;
    if (now - lastSent < 60_000) return;
    this.seen.set(key, now);

    // Telegram first, e-mail fallback. Fire-and-forget — never throws.
    void notifyAdminWithFallback(
      `🚨 Ошибка на сервере\n${message.slice(0, 300)}`,
      '🚨 Ошибка на сервере SchemeHappens',
    );
  }
}
