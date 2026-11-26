// Пояс устройства без словаря названий: его зовут на старте обоих фронтендов
// (api.init), и словарь RUSSIAN_TZ_NAMES (timeZoneNames.ts) не должен ехать в
// стартовый чанк ради одной строки — он нужен только выбору пояса в настройках.

/** `true`, если строка — распознаваемый Intl часовой пояс IANA. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Пояс устройства (Intl); не определился — undefined, а не догадка. */
export function deviceTimeZone(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimeZone(tz) ? tz : undefined;
  } catch {
    return undefined;
  }
}
