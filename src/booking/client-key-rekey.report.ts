// Служебное сообщение владельцу о переводе ключей ClientMeeting
// (client-key-rekey.service.ts). Текст не для клиента: формы «ты/вы» в нём нет.

export interface RekeyStats {
  /** Строк переведено на новый ключ. */
  moved: number;
  /** Старых строк снято: под новым ключом строка уже была. */
  dropped: number;
  /** Строк старого формата без единой живой брони удалено. */
  purged: number;
  /** Броней, которых не открыл ни один ключ из env: в переносе не участвуют. */
  unreadable: number;
  /** Брони, где лежит ссылка на комнату, оставшуюся за другим контактом. */
  shared: number[];
  /** Брони со ссылкой на прежнюю комнату клиента, снятую с учёта. */
  stale: number[];
}

const ids = (list: number[]): string =>
  [...new Set(list)]
    .sort((a, b) => a - b)
    .map((id) => `№${id}`)
    .join(', ');

/** Текст сообщения или null, если владельцу сообщать нечего. */
export function rekeyReport(s: RekeyStats): string | null {
  if (s.shared.length === 0 && s.stale.length === 0) return null;
  const lines = ['🔑 Ключи комнат клиентов пересчитаны.'];
  if (s.shared.length > 0)
    lines.push(
      'Разные контакты делили одну комнату: она оставлена за первой бронью. ' +
        `Ссылка на эту комнату лежит и в бронях ${ids(s.shared)} — ` +
        'при следующей записи с этих контактов будет выдана другая комната.',
    );
  if (s.stale.length > 0)
    lines.push(
      'У клиента уже была новая комната, прежняя снята с учёта. ' +
        `Прежняя ссылка — в бронях ${ids(s.stale)}.`,
    );
  return lines.join('\n\n');
}

/** Строка лога прохода о нечитаемых бронях или null. В DM её нет: проход идёт на каждом старте. */
export function unreadableNote(n: number): string | null {
  if (n === 0) return null;
  return `не расшифровано броней: ${n} — ключа нет в env, в переносе они не участвуют`;
}
