// Строгий разбор цены из строки BookingSetting: только запись целого числа в
// границах [min, max], иначе null. parseInt тут опасен: '1e+22' читался как 1,
// '12abc' — как 12 (аудит 2026-10-11). Один разбор на цену сессии (parsePrice,
// price-rules.ts) и цену подписки (subscription-price.ts).
export function parseWholePrice(
  raw: string | undefined,
  min: number,
  max: number,
): number | null {
  if (raw === undefined) return null;
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}
