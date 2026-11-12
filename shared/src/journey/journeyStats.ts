// Счётчики «сколько чего сделано» «Моего пути»: плитки экрана и карточка-сводка. Подписи — единственный
// реестр STAT_LABELS: сводка за всё время (серверные counts) и за период (записи ленты) называют занятие
// одинаково (правило №4, journeyStats.test.ts). Знак плитки и строки карточки итогов — journeyStatLook по `type`.
import type { JourneyCounts, JourneyItemType } from './journeyMeta';
import { JOURNEY_TYPE_META } from './journeyMeta';
import { CHILDHOOD_STAT } from './journeyLook';

export interface JourneyStatRow {
  type: string; // колесо детства — CHILDHOOD_STAT
  label: string;
  count: number;
}

/**
 * Подпись занятия в сводке — во множественном числе («Письма себе»), в отличие
 * от подписи одной записи в ленте («Письмо себе»).
 */
export const STAT_LABELS: Record<JourneyItemType, string> = {
  tracker_day: 'Дни с трекером',
  note: 'Заметки дня',
  schema_diary: 'Схемный дневник',
  mode_diary: 'Дневник режимов',
  gratitude: 'Благодарности',
  practice: 'Свои практики',
  plan_done: 'Практики по плану',
  ysq: 'Тест схем',
  belief_check: 'Проверки убеждений',
  letter: 'Письма себе',
  flashcard: 'Кризисные карточки',
  safe_place: 'Безопасное место',
  schema_note: 'Карточки схем',
  mode_note: 'Карточки режимов',
  breathing: 'Дыхательные практики',
  grounding: 'Заземление',
  stop: 'Техника «Стоп»',
};

const row = (type: JourneyItemType, count: number): JourneyStatRow => ({
  type,
  label: STAT_LABELS[type],
  count,
});

/**
 * Строки-счётчики «сколько чего сделано» (только ненулевые), по убыванию.
 * Подписи — номинативные, без формы обращения. Идут и на экран, и на карточку.
 */
export function journeyStatRows(counts: JourneyCounts): JourneyStatRow[] {
  const rows: JourneyStatRow[] = [
    row('tracker_day', counts.trackerDays),
    row('schema_diary', counts.schemaDiary),
    row('mode_diary', counts.modeDiary),
    row('gratitude', counts.gratitudeDays),
    row('note', counts.notes),
    row('practice', counts.practices),
    row('plan_done', counts.plansDone),
    row('ysq', counts.ysqTests),
    row('belief_check', counts.beliefChecks),
    row('letter', counts.letters),
    row('flashcard', counts.flashcards),
    row('schema_note', counts.schemaNotes),
    row('mode_note', counts.modeNotes),
    row('safe_place', counts.safePlace ? 1 : 0),
    // Колесо детства — единственное занятие без записи в ленте: только счётчик.
    {
      type: CHILDHOOD_STAT,
      label: 'Колесо детства',
      count: counts.childhoodDone ? 1 : 0,
    },
    row('breathing', counts.breathingSessions),
    row('grounding', counts.groundingSessions),
    row('stop', counts.stopSessions),
  ];
  return rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
}

/** Всего шагов — сумма всех счётчиков (булевы считаются одним шагом). */
export function journeyTotal(counts: JourneyCounts): number {
  return journeyStatRows(counts).reduce((sum, r) => sum + r.count, 0);
}

/**
 * Те же счётчики, но по конкретным записям ленты — нужны, когда включён фильтр
 * периода: серверные counts всегда за всё время, и сводка «за месяц» по ним
 * показала бы числа за всю историю. Чистая (тестируется).
 */
export function statRowsFromItems(
  items: readonly { type: string }[],
): JourneyStatRow[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => {
      const known = type in JOURNEY_TYPE_META;
      return {
        type,
        label: known ? STAT_LABELS[type as JourneyItemType] : type,
        count,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
