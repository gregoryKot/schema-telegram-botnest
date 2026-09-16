// Снимок последнего прогона самопроверки — общий на процесс синглтон, тот же
// приём, что у dbOutage (../logger/db-outage.ts) и calDavHealth
// (../booking/caldav-health.ts). SelfCheckService (пишет раз в час/после
// старта) и HealthController/StatsReportService (читают) не связаны DI —
// только этим импортом, чтобы не тянуть infra/self-check в api/ и bot/
// модули только ради одного значения.
export interface SelfCheckResultEntry {
  id: string;
  title: string;
  critical: boolean;
  ok: boolean;
  detail: string;
}

export interface SelfCheckSnapshot {
  /** Unix ms прогона, который дал этот снимок, или null — ещё не бежала. */
  ranAt: number | null;
  results: SelfCheckResultEntry[];
}

const EMPTY: SelfCheckSnapshot = { ranAt: null, results: [] };

class SelfCheckStateHolder {
  private snapshot: SelfCheckSnapshot = EMPTY;

  set(results: SelfCheckResultEntry[], now: number = Date.now()): void {
    this.snapshot = { ranAt: now, results };
  }

  get(): SelfCheckSnapshot {
    return this.snapshot;
  }

  /** Сброс между тестами. */
  reset(): void {
    this.snapshot = EMPTY;
  }
}

/** Единственный на процесс держатель снимка. */
export const selfCheckState = new SelfCheckStateHolder();
