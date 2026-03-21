import { ConsoleLogger } from '@nestjs/common';

export class AlertLogger extends ConsoleLogger {
  private readonly botToken = process.env.BOT_TOKEN;
  private readonly adminId = process.env.ADMIN_ID;

  // Simple in-memory throttle: don't send same error more than once per 60s
  private readonly seen = new Map<string, number>();

  error(message: any, ...optionalParams: any[]) {
    super.error(message, ...optionalParams);
    this.alert(String(message));
  }

  private alert(message: string) {
    if (!this.botToken || !this.adminId) return;

    const now = Date.now();
    // Evict entries older than 1 hour to prevent unbounded Map growth
    for (const [k, t] of this.seen) if (now - t > 3_600_000) this.seen.delete(k);

    const key = message.slice(0, 100);
    const lastSent = this.seen.get(key) ?? 0;
    if (now - lastSent < 60_000) return;
    this.seen.set(key, now);

    const text = `🚨 *Ошибка на сервере*\n\`${message.slice(0, 300)}\``;
    fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: this.adminId, text, parse_mode: 'Markdown' }),
    }).catch(() => null); // fire and forget, никогда не бросает
  }
}
