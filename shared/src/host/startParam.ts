// Параметр запуска (`start_param` Telegram/MAX, `?startapp=` в браузере):
// что он просит открыть. Чистый разбор, одинаковый для обоих фронтендов
// (правило №3). Значение подконтрольно отправителю ссылки, поэтому неизвестное
// не угадывается: оно игнорируется.
export type StartAction =
  | { kind: 'join'; joinKind: 'pair' | 'therapy'; code: string }
  | { kind: 'diaries' }
  | { kind: 'tracker' };

const JOIN_PREFIXES: ReadonlyArray<['pair' | 'therapy', string]> = [
  ['pair', 'pair_'],
  ['therapy', 'therapy_'],
];

export function parseStartParam(
  raw: string | null | undefined,
): StartAction | null {
  if (!raw) return null;
  for (const [joinKind, prefix] of JOIN_PREFIXES) {
    if (raw.startsWith(prefix)) {
      const code = raw.slice(prefix.length);
      return code ? { kind: 'join', joinKind, code } : null;
    }
  }
  if (raw === 'diaries') return { kind: 'diaries' };
  if (raw === 'tracker') return { kind: 'tracker' };
  return null;
}
