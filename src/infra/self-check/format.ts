import type { SelfCheckSnapshot } from './state';

export function ago(ts: number, now: number): string {
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
// Пробы, чей зелёный исход пока стоит на документации площадки, а не на
// записанном ответе: /stats показывает их detail, пока ответ не лёг в фикстуру.
const UNRECORDED_GREEN = new Set(['postbox', 'yandexOAuth']);

function unrecordedGreen(snap: SelfCheckSnapshot): string {
  const lines = snap.results
    .filter(
      (r) => r.ok && UNRECORDED_GREEN.has(r.id) && r.detail !== 'выключено',
    )
    .map((r) => `• ${r.title}: ${r.detail}`);
  return lines.length
    ? `\nОтветы новых площадок (ждут записи в тесты):\n${lines.join('\n')}`
    : '';
}

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
  const green = unrecordedGreen(snap);
  if (failed.length === 0) {
    return `${title}\n${when} Всё в порядке.${green}`;
  }
  const lines = failed.map((f) => `• ${f.title}: ${f.detail}`);
  return `${title}\n${when} Не в порядке:\n${lines.join('\n')}${green}`;
}
