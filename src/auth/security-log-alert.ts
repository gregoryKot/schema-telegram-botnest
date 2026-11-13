import { mskStamp } from '../utils/owner-card';

// DM владельцу о событии безопасности: тип события, внутренние id и время.
// ip, user-agent, путь и свободный текст (`summary`, `detail`, `reason`)
// остаются в структурном логе приложения — в Telegram они не уходят.

/** Поля DM: внутренние id, классификация и счётчики — без данных человека. */
export const DM_FIELDS: ReadonlySet<string> = new Set([
  'userId',
  'target',
  'source',
  'targetId',
  'sourceId',
  'adminId',
  'requestId',
  'event',
  'role',
  'provider',
  'host',
  'suppressed',
  'suppressedSinceLastAlert',
  'sourceLive',
  'targetLive',
]);

/** Текст DM: заголовок, разрешённые поля (до 80 знаков), время и хвост подавления. */
export function securityAlertText(
  event: string,
  data: Record<string, unknown>,
  suppressed: number,
  at: Date,
): string {
  const fields = Object.entries(data)
    .filter(([k]) => DM_FIELDS.has(k))
    .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`);
  return [
    `🔐 ${event}`,
    ...fields,
    `время: ${mskStamp(at)}`,
    'Подробности — в логе приложения.',
    // Непустой счётчик — бюджет прошлого окна упирался в потолок.
    ...(suppressed > 0 ? ['', `ещё ${suppressed} за окно`] : []),
  ].join('\n');
}
