import type { SelfCheckResultEntry } from './state';

/** Пока красно — напоминание не чаще раза в 6 часов (тот же ритм, что
 * caldav-health.ts REMIND_EVERY_MS). */
export const REMIND_EVERY_MS = 6 * 3_600_000;

export const SELF_CHECK_RECOVERED =
  '✅ Самопроверка снова зелёная — всё в порядке.';

/** Текст DM об упавших пробах — один для решения по базе и по памяти. */
export function formatSelfCheckAlert(failed: SelfCheckResultEntry[]): string {
  const header =
    failed.length === 1
      ? '🚨 Самопроверка нашла проблему:'
      : `🚨 Самопроверка нашла проблемы (${failed.length}):`;
  return `${header}\n${failed.map((f) => `• ${f.title}: ${f.detail}`).join('\n')}`;
}

/**
 * Запасное состояние алерта — ОДНО на процесс, DM по смене состояния. Основное
 * решение живёт в базе (alert-dedup.ts): память процесса теряется на каждом
 * деплое. Сюда решение откатывается, когда база недоступна.
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

  /** Решает, нужен ли DM по итогам прогона. null — молчать. */
  noteResult(
    failed: SelfCheckResultEntry[],
    now: number = Date.now(),
  ): string | null {
    if (failed.length === 0) {
      const wasOpen = this.open;
      this.reset();
      return wasOpen ? SELF_CHECK_RECOVERED : null;
    }
    const remind =
      this.open &&
      this.lastAlertAt !== null &&
      now - this.lastAlertAt >= REMIND_EVERY_MS;
    if (this.open && !remind) return null;
    this.open = true;
    this.lastAlertAt = now;
    return formatSelfCheckAlert(failed);
  }
}

/** Единственный на процесс трекер. */
export const selfCheckAlerts = new SelfCheckAlertTracker();
