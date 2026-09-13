// Здоровье чтения личного календаря (CalDAV/iCloud) — трекер состояния и
// блок для /stats. Найдено 2026-09-13 по логам, случайно: iCloud отвечал 403
// на чтение занятости, код писал `logger.warn` и возвращал «занятости нет» —
// слоты показывались поверх личных встреч, и ни DM, ни письма, ни строки в
// /stats об этом не было (правило №14: обработанная авария невидимее
// необработанной). Тот же приём, что у dbOutage (src/logger/db-outage.ts):
// авария — ОДНО состояние, алерт на смену состояния, не на каждый запрос
// (слоты читаются часто, чат превратился бы в шум).

export type CalDavFailureKind = 'auth' | 'timeout' | 'http' | 'network';

export interface CalDavHealthSnapshot {
  lastOkAt: number | null;
  lastFailAt: number | null;
  lastFailKind: CalDavFailureKind | null;
  lastFailDetail: string | null;
  failCount: number;
  consecutiveFails: number;
  open: boolean;
}

// 401/403 — учётные данные не работают: это детерминированно, открываем сразу.
// Таймаут/сеть/прочий HTTP бывают разовыми — открываем после двух подряд.
const OPEN_AFTER_TRANSIENT = 2;
// Пока авария открыта — напоминание не чаще раза в 6 часов.
const REMIND_EVERY_MS = 6 * 3_600_000;

export const KIND_TEXT: Record<CalDavFailureKind, string> = {
  auth: 'iCloud отвергает учётные данные (401/403) — похоже, протух пароль приложения Apple',
  timeout: 'iCloud не отвечает вовремя',
  http: 'iCloud отвечает ошибкой',
  network: 'до iCloud не достучаться',
};

export class CalDavHealthTracker {
  private s: CalDavHealthSnapshot = empty();
  private lastAlertAt: number | null = null;

  snapshot(): CalDavHealthSnapshot {
    return { ...this.s };
  }

  reset(): void {
    this.s = empty();
    this.lastAlertAt = null;
  }

  /** Успешное чтение. Возвращает текст алерта о восстановлении, если авария была открыта. */
  noteSuccess(now: number = Date.now()): string | null {
    const wasOpen = this.s.open;
    this.s.lastOkAt = now;
    this.s.consecutiveFails = 0;
    this.s.open = false;
    this.lastAlertAt = null;
    return wasOpen
      ? '✅ Календарь снова читается — слоты опять учитывают личные встречи.'
      : null;
  }

  /** Сбой чтения. Возвращает текст алерта, если пора будить админа. */
  noteFailure(
    kind: CalDavFailureKind,
    detail: string,
    now: number = Date.now(),
  ): string | null {
    this.s.failCount += 1;
    this.s.consecutiveFails += 1;
    this.s.lastFailAt = now;
    this.s.lastFailKind = kind;
    this.s.lastFailDetail = detail.slice(0, 200);
    const shouldOpen =
      kind === 'auth' || this.s.consecutiveFails >= OPEN_AFTER_TRANSIENT;
    if (!shouldOpen) return null;
    const remind =
      this.s.open &&
      this.lastAlertAt !== null &&
      now - this.lastAlertAt >= REMIND_EVERY_MS;
    if (this.s.open && !remind) return null;
    this.s.open = true;
    this.lastAlertAt = now;
    return (
      `🚨 Календарь не читается: ${KIND_TEXT[kind]}.\n` +
      `Слоты на сайте показываются БЕЗ учёта личных встреч — клиент может занять время поверх встречи из календаря.\n` +
      (kind === 'auth' ? 'Обновите APPLE_APP_PASSWORD в env.\n' : '') +
      `Подробность: ${this.s.lastFailDetail}`
    );
  }
}

function empty(): CalDavHealthSnapshot {
  return {
    lastOkAt: null,
    lastFailAt: null,
    lastFailKind: null,
    lastFailDetail: null,
    failCount: 0,
    consecutiveFails: 0,
    open: false,
  };
}

/** Единственный трекер процесса — тот же приём, что dbOutage. */
export const calDavHealth = new CalDavHealthTracker();

function ago(ts: number, now: number): string {
  const min = Math.max(0, Math.round((now - ts) / 60_000));
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} ч назад` : `${Math.round(h / 24)} дн назад`;
}

/** Блок для /stats из живого трекера и env (единственная точка сборки). */
export function renderCalendarHealthBlock(
  env: NodeJS.ProcessEnv = process.env,
  now: number = Date.now(),
): string {
  return formatCalendarHealth(
    calDavHealth.snapshot(),
    Boolean(env.APPLE_ID?.trim() && env.APPLE_APP_PASSWORD?.trim()),
    env.CALENDAR_BLOCK_SLOTS === 'true',
    now,
  );
}

/** Блок «Календарь» для /stats. Чистая функция; язык — без терминов. */
export function formatCalendarHealth(
  s: CalDavHealthSnapshot,
  configured: boolean,
  blocking: boolean,
  now: number = Date.now(),
): string {
  const lines = ['📅 <b>Личный календарь</b>'];
  if (!configured) {
    lines.push(
      'Календарь не подключён (нет APPLE_ID/APPLE_APP_PASSWORD): слоты не учитывают личные встречи.',
    );
    return lines.join('\n');
  }
  lines.push(
    blocking
      ? 'Занятые в календаре часы скрываются из слотов.'
      : 'Занятые в календаре часы НЕ скрываются из слотов (CALENDAR_BLOCK_SLOTS выключен).',
  );
  if (s.lastOkAt === null && s.lastFailAt === null) {
    lines.push('С запуска приложения календарь ещё ни разу не читали.');
    return lines.join('\n');
  }
  if (s.open && s.lastFailKind) {
    lines.push(
      `⚠️ Сейчас НЕ читается (${ago(s.lastFailAt ?? now, now)}): ${KIND_TEXT[s.lastFailKind]}.`,
    );
  } else if (s.lastOkAt !== null) {
    lines.push(`Последнее успешное чтение: ${ago(s.lastOkAt, now)}.`);
  }
  lines.push(
    s.failCount === 0
      ? 'Сбоев чтения с запуска не было.'
      : `Сбоев чтения с запуска: ${s.failCount}.`,
  );
  return lines.join('\n');
}
