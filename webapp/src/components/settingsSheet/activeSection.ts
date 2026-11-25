// Скроллспай оглавления листа «Настройки» (SettingsSideNav.tsx): чистая часть без DOM.
/** Раздел, который сейчас читают (оглавление, SettingsSideNav): последний, чей заголовок поднялся до линии `line` (px от верха прокрутки). */
export function activeSectionId(heads: readonly { id: string; top: number }[], line: number): string | null {
  let cur = heads[0]?.id ?? null;
  for (const h of heads) if (h.top <= line) cur = h.id;
  return cur;
}
