/**
 * Ретрай с линейным бэкоффом для транзиентных сбоев (сеть на старте
 * контейнера и т.п.). Возвращает true при успехе, false если все попытки
 * исчерпаны — решать, алертить ли, остаётся вызывающему.
 */
export async function retryWithBackoff(
  fn: () => Promise<unknown>,
  opts: { attempts?: number; baseDelayMs?: number } = {},
): Promise<boolean> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 5_000;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await fn();
      return true;
    } catch {
      if (attempt === attempts) return false;
      await new Promise((r) => setTimeout(r, attempt * base));
    }
  }
  return false;
}
