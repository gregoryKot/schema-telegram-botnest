import type { SelfCheckResultEntry } from './state';

/** Пока красно — напоминание не чаще раза в 6 часов (тот же ритм, что
 * caldav-health.ts REMIND_EVERY_MS). */
const REMIND_EVERY_MS = 6 * 3_600_000;

/**
 * Состояние алерта самопроверки — по образцу CalDavHealthTracker
 * (../../booking/caldav-health.ts) и DbOutageTracker (../logger/db-outage.ts):
 * ОДНО состояние на процесс, DM по смене состояния, не на каждый прогон.
 */
export class SelfCheckAlertTracker {
  private open = false;
  private lastAlertAt: number | null = null;

  get isOpen(): boolean {
    return this.open;
  }

  reset(): void {
    this.open = false;
    this.lastAlertAt = null;
  }

  /** Решает, нужен ли DM по итогам прогона. null — молчать (лог остаётся
   * на вызывающем). */
  noteResult(
    failed: SelfCheckResultEntry[],
    now: number = Date.now(),
  ): string | null {
    if (failed.length === 0) {
      const wasOpen = this.open;
      this.open = false;
      this.lastAlertAt = null;
      return wasOpen ? '✅ Самопроверка снова зелёная — всё в порядке.' : null;
    }
    const remind =
      this.open &&
      this.lastAlertAt !== null &&
      now - this.lastAlertAt >= REMIND_EVERY_MS;
    if (this.open && !remind) return null;
    this.open = true;
    this.lastAlertAt = now;
    const header =
      failed.length === 1
        ? '🚨 Самопроверка нашла проблему:'
        : `🚨 Самопроверка нашла проблемы (${failed.length}):`;
    const lines = failed.map((f) => `• ${f.title}: ${f.detail}`);
    return `${header}\n${lines.join('\n')}`;
  }
}

/** Единственный на процесс трекер. */
export const selfCheckAlerts = new SelfCheckAlertTracker();
