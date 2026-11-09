// Счётчики блока «Вход в мессенджере» (/stats) и разбор строк запроса
// AuthHealthMetricsService.getMetrics. Что считается (находка 2026-11-08):
// пара «обмен подписи на сессию прошёл / не прошёл» — messenger_launch и
// messenger_launch_failed с причиной, пишут ручки обмена telegram/webapp и
// max/webapp (src/auth/exchange-failure.report.ts). auth_rejected — пустая
// подпись в TelegramAuthGuard: её шлют только окна мини-аппа, открытые до его
// удаления, поэтому она отдельной строкой «старые окна».
//
// Строка без известной площадки или причины не считается: так выглядит
// подделка через POST /api/event, у которой sanitizeMeta отрезал meta.
import {
  LAUNCH_HOSTS,
  type LaunchHost,
} from '../analytics/launch-platforms.constants';

export type Window = 'day' | 'week';
/** Обмен прошёл (ok) и не прошёл — подпись устарела или не сошлась. */
export type ExchangeKind = 'ok' | 'expired' | 'suspicious';
export type ExchangeCounts = Record<ExchangeKind, Record<Window, number>>;

export interface AuthHealthMetrics {
  hosts: Record<LaunchHost, ExchangeCounts>;
  /** Пустая подпись от старых окон мини-аппа за неделю. */
  legacyEmptyWeek: number;
}

/** Строка `GROUP BY name, meta->>'host', meta->>'reason'`. */
export interface AuthHealthRow {
  name: string;
  host: string | null;
  reason: string | null;
  day: bigint;
  week: bigint;
}

const HOST_SET: ReadonlySet<string | null> = new Set(LAUNCH_HOSTS);
const zero = () => ({ day: 0, week: 0 });
const emptyHost = (): ExchangeCounts => ({
  ok: zero(),
  expired: zero(),
  suspicious: zero(),
});

/** Какую клетку пополняет строка; null — строка не наша. */
function kindOf(r: AuthHealthRow): ExchangeKind | 'legacy' | null {
  if (r.name === 'messenger_launch') return 'ok';
  if (r.name === 'auth_rejected') return 'legacy';
  if (r.name !== 'messenger_launch_failed') return null;
  return r.reason === 'expired' || r.reason === 'suspicious' ? r.reason : null;
}

/** Строки запроса → счётчики блока. Чистая функция, пустой ввод — нули. */
export function parseAuthHealthRows(rows: AuthHealthRow[]): AuthHealthMetrics {
  const m: AuthHealthMetrics = {
    hosts: { telegram: emptyHost(), max: emptyHost() },
    legacyEmptyWeek: 0,
  };
  for (const r of rows) {
    const kind = kindOf(r);
    if (kind === null || !HOST_SET.has(r.host)) continue;
    if (kind === 'legacy') {
      m.legacyEmptyWeek += Number(r.week);
      continue;
    }
    const cell = m.hosts[r.host as LaunchHost][kind];
    cell.day += Number(r.day);
    cell.week += Number(r.week);
  }
  return m;
}
