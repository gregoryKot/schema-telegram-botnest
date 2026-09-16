import type { SelfCheckSnapshot } from './state';

function ago(ts: number, now: number): string {
  const min = Math.max(0, Math.round((now - ts) / 60_000));
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} ч назад` : `${Math.round(h / 24)} дн назад`;
}

/**
 * Блок «Самопроверка» для /stats (правило №8 CLAUDE.md: метрика без отчёта
 * невидима). Чистый форматтер поверх снимка state.ts. Язык простой — «не
 * работает», а не «probe failed».
 */
export function formatSelfCheck(
  snap: SelfCheckSnapshot,
  now: number = Date.now(),
): string {
  const title = '🩺 <b>Самопроверка</b>';
  if (snap.ranAt === null) {
    return `${title}: ещё не запускалась.`;
  }
  const when = `Последняя проверка: ${ago(snap.ranAt, now)}.`;
  const failed = snap.results.filter((r) => !r.ok);
  if (failed.length === 0) {
    return `${title}\n${when} Всё в порядке.`;
  }
  const lines = failed.map((f) => `• ${f.title}: ${f.detail}`);
  return `${title}\n${when} Не в порядке:\n${lines.join('\n')}`;
}
