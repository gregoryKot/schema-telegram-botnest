import type { TrackerSummary } from './todayFeed';

/** Подпись единственной кнопки главной «Сегодня» — по состоянию трекера за сегодня.
 *  Отдельный файл, а не экспорт из HomeTiles.tsx: файл компонента экспортирует только
 *  компоненты (react-refresh/only-export-components). */
export function trackerCta({ filled, total }: TrackerSummary): string {
  if (filled === 0 || total === 0) return 'Отметить состояние';
  if (filled < total) return 'Продолжить';
  return 'Посмотреть сегодня';
}
