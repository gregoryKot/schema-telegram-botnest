// Блок «Показ экрана в кабинете» для /stats (правило №8: событие, которого нет в отчёте,
// невидимо). Чистый форматтер, покрыт тестом, включая пустую БД; язык простой.
import type { ScreenShareMetrics } from './screen-share-metrics.types';

/** Текстовый блок для /stats. Чистая функция. */
export function formatScreenShareMetrics(m: ScreenShareMetrics): string {
  const lines = ['🖥 <b>Показ экрана в кабинете</b> (за месяц)'];
  if (m.on30 === 0) {
    lines.push(
      'Пока никто из терапевтов не прятал список клиентов на время показа экрана.',
    );
    return lines.join('\n');
  }
  lines.push(
    `Прятали список клиентов на время показа экрана ${m.on30} раз, терапевтов: ${m.therapists30}`,
  );
  return lines.join('\n');
}
