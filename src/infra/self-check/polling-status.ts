// Состояние long-polling бота как наблюдаемый факт (правило №21 CLAUDE.md,
// аудит 2026-10, backend#12): раньше «поллинг умер» не видел никто — getMe
// отвечал, /health был зелёным, а на /start бот молчал до следующего деплоя.
// Общий на процесс синглтон — тот же приём, что у selfCheckState (./state.ts):
// BotLauncher (src/telegram/telegram.launch.ts) пишет, проба читает, DI между
// ними не нужен.
export type PollingState =
  | 'idle' //     лаунчер ещё не запускали
  | 'starting' // launch() вызван, первый getUpdates ещё не вернулся
  | 'running' //  getUpdates отвечает
  | 'failed' //   launch() реджектнулся, ждём ретрая
  | 'stopped'; // штатная остановка (SIGTERM)

export interface PollingSnapshot {
  state: PollingState;
  /** Unix ms последней СМЕНЫ состояния (не последнего вызова set). */
  since: number;
  /** Последняя ошибка launch() — короткая, без секретов. */
  lastError: string | null;
}

class PollingStatusHolder {
  private snapshot: PollingSnapshot = {
    state: 'idle',
    since: Date.now(),
    lastError: null,
  };

  set(
    state: PollingState,
    lastError: string | null = null,
    now: number = Date.now(),
  ): void {
    const changed = state !== this.snapshot.state;
    this.snapshot = {
      state,
      since: changed ? now : this.snapshot.since,
      lastError:
        lastError ?? (state === 'failed' ? this.snapshot.lastError : null),
    };
  }

  get(): PollingSnapshot {
    return this.snapshot;
  }

  /** Сброс между тестами. */
  reset(now: number = Date.now()): void {
    this.snapshot = { state: 'idle', since: now, lastError: null };
  }
}

export const pollingStatus = new PollingStatusHolder();
