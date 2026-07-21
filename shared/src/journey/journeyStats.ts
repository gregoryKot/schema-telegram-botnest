// Счётчики «сколько чего сделано» для hero/мини-карточек и share-текста
// «Моего пути». Вынесено из journeyMeta (лимит размера файла, правило №10).
import type { JourneyCounts } from './journeyMeta';

export interface JourneyStatRow {
  emoji: string;
  label: string;
  count: number;
}

/**
 * Строки-счётчики «сколько чего сделано» (только ненулевые), по убыванию.
 * Подписи — номинативные, без формы обращения. Идут и на экран, и на карточку.
 */
export function journeyStatRows(counts: JourneyCounts): JourneyStatRow[] {
  const rows: Array<[string, string, number]> = [
    ['📊', 'Дни с трекером', counts.trackerDays],
    ['📔', 'Схемный дневник', counts.schemaDiary],
    ['🎭', 'Дневник режимов', counts.modeDiary],
    ['🌱', 'Благодарности', counts.gratitudeDays],
    ['📝', 'Заметки дня', counts.notes],
    ['🌿', 'Свои практики', counts.practices],
    ['✅', 'Практики по плану', counts.plansDone],
    ['📋', 'Тест схем', counts.ysqTests],
    ['⚖️', 'Проверки убеждений', counts.beliefChecks],
    ['✉️', 'Письма себе', counts.letters],
    ['🆘', 'Кризисные карточки', counts.flashcards],
    ['🧩', 'Карточки схем', counts.schemaNotes],
    ['🎪', 'Карточки режимов', counts.modeNotes],
    ['🏝', 'Безопасное место', counts.safePlace ? 1 : 0],
    ['🎡', 'Колесо детства', counts.childhoodDone ? 1 : 0],
  ];
  return rows
    .filter(([, , count]) => count > 0)
    .sort((a, b) => b[2] - a[2])
    .map(([emoji, label, count]) => ({ emoji, label, count }));
}

/** Всего шагов — сумма всех счётчиков (булевы считаются одним шагом). */
export function journeyTotal(counts: JourneyCounts): number {
  return journeyStatRows(counts).reduce((sum, r) => sum + r.count, 0);
}
