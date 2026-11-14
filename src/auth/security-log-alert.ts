import { mskStamp } from '../utils/owner-card';

// DM владельцу о событии безопасности: тип события, внутренние id и время.
// ip, user-agent, путь и свободный текст (`summary`, `detail`, `reason`)
// остаются в структурном логе приложения — в Telegram они не уходят.

const isNumber = (v: string): boolean => /^\d{1,20}$/.test(v);
const oneOf =
  (...known: string[]) =>
  (v: string): boolean =>
    known.includes(v);

/**
 * Поля DM и допустимые значения: id и счётчики — только цифры, остальное —
 * из известного перечня. Значение мимо проверки (имя, Host, путь, referrer
 * под тем же ключом) в DM не попадает: вместо него «—».
 */
export const DM_FIELDS: ReadonlyMap<string, (v: string) => boolean> = new Map([
  ['userId', isNumber],
  ['target', isNumber],
  ['source', isNumber],
  ['targetId', isNumber],
  ['sourceId', isNumber],
  ['adminId', isNumber],
  ['requestId', isNumber],
  ['suppressed', isNumber],
  ['suppressedSinceLastAlert', isNumber],
  ['sourceLive', isNumber],
  ['targetLive', isNumber],
  ['event', oneOf('2fa_enabled', '2fa_disabled')],
  ['role', oneOf('CLIENT', 'THERAPIST')],
  ['provider', oneOf('telegram', 'vk', 'yandex', 'max', 'email', 'google')],
  ['host', oneOf('telegram', 'max')],
]);

/** Текст DM: заголовок, разрешённые поля (вне перечня — «—»), время и хвост подавления. */
export function securityAlertText(
  event: string,
  data: Record<string, unknown>,
  suppressed: number,
  at: Date,
): string {
  const fields = Object.entries(data).flatMap(([k, v]) => {
    const ok = DM_FIELDS.get(k);
    if (!ok) return [];
    return [`${k}: ${ok(String(v)) ? String(v) : '—'}`];
  });
  return [
    `🔐 ${event}`,
    ...fields,
    `время: ${mskStamp(at)}`,
    'Подробности — в логе приложения.',
    // Непустой счётчик — бюджет прошлого окна упирался в потолок.
    ...(suppressed > 0 ? ['', `ещё ${suppressed} за окно`] : []),
  ].join('\n');
}
