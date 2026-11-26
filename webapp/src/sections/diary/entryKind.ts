// Тип записи и его ярлык — одни для ленты «Сегодня» на главной и для «Записей».
// QA клиента 2026-11, М1: «Просто мысль» на главной была подписана «Схема», а в
// «Записях» — «Мысль»; у каждого экрана была своя таблица ярлыков.

export type EntryKind = 'schema' | 'thought' | 'mode' | 'case' | 'gratitude' | 'tracker';

export const ENTRY_KIND_LABEL: Record<EntryKind, string> = {
  schema: 'Схема',
  thought: 'Мысль',
  mode: 'Режим',
  case: 'Разбор',
  gratitude: 'Благодарность',
  tracker: 'Трекер',
};

/** Запись дневника схем без схем и чувств — так сохраняется «Просто мысль». */
export function schemaEntryKind(e: { schemaIds: readonly string[]; emotions: readonly unknown[] }): 'schema' | 'thought' {
  return e.schemaIds.length === 0 && e.emotions.length === 0 ? 'thought' : 'schema';
}

/** Запись режима из потока «Что случилось» (маркер fromCase) — разбор, а не запись дневника. */
export function modeEntryKind(e: { fromCase?: boolean }): 'mode' | 'case' {
  return e.fromCase === true ? 'case' : 'mode';
}
