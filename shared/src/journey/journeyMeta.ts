// «Мой путь» — общая логика архива активности для обоих фронтендов
// (правило №3: общий код — в shared). Типы ленты зеркалят бэкендовый
// JourneyItemType (src/bot/journey.service.ts); незнакомый тип не ломает
// UI — journeyTypeMeta отдаёт нейтральный фолбэк.
//
// Даты записей (`at`) бывают двух видов — момент времени и календарный день.
// Разбор и показ обоих живёт в utils/calendarDate (инцидент 2026-09-17), а
// не строкой `at.length === 10 ? …` в каждой функции.
import {
  dateStringMs,
  dateStringParts,
  formatDateString,
} from '../utils/calendarDate';
import { exerciseCard } from '../exercises/exerciseCatalog';
const LETTER = exerciseCard('letter').title; // одно имя письма — из каталога

// Группы для фильтра ленты (чипы «что показать»).
export type JourneyGroup =
  'tracker' | 'diary' | 'practice' | 'test' | 'exercise' | 'cards';

export interface JourneyTypeMeta {
  label: string;
  group: JourneyGroup;
}

// Реестр типов ленты. Ключи зеркалят бэкендовый JourneyItemType
// (src/bot/journey.service.ts) — тип ниже произведён из этих ключей,
// поэтому единственное место правки на фронте — этот объект.
export const JOURNEY_TYPE_META = {
  tracker_day: { label: 'Трекер потребностей', group: 'tracker' },
  note: { label: 'Заметка дня', group: 'tracker' },
  schema_diary: { label: 'Схемный дневник', group: 'diary' },
  mode_diary: { label: 'Дневник режимов', group: 'diary' },
  gratitude: { label: 'Благодарность', group: 'diary' },
  practice: { label: 'Что меня питает', group: 'practice' },
  plan_done: { label: 'Шаг по плану', group: 'practice' },
  ysq: { label: 'Тест схем', group: 'test' },
  belief_check: { label: 'Проверка убеждения', group: 'exercise' },
  letter: { label: LETTER, group: 'exercise' },
  flashcard: { label: 'Кризисная карточка', group: 'exercise' },
  safe_place: { label: 'Безопасное место', group: 'exercise' },
  schema_note: { label: 'Карточка схемы', group: 'cards' },
  mode_note: { label: 'Карточка режима', group: 'cards' },
  breathing: { label: 'Дыхание', group: 'exercise' },
  grounding: { label: 'Заземление 5-4-3-2-1', group: 'exercise' },
  stop: { label: 'Техника «Стоп»', group: 'exercise' },
} satisfies Record<string, JourneyTypeMeta>;

export type JourneyItemType = keyof typeof JOURNEY_TYPE_META;

// Счётчики «сколько чего» из GET /api/journey (контракт бэкенда).
export interface JourneyCounts {
  trackerDays: number;
  notes: number;
  schemaDiary: number;
  modeDiary: number;
  gratitudeDays: number;
  practices: number;
  plansDone: number;
  ysqTests: number;
  childhoodDone: boolean;
  beliefChecks: number;
  letters: number;
  flashcards: number;
  safePlace: boolean;
  schemaNotes: number;
  modeNotes: number;
  breathingSessions: number;
  groundingSessions: number;
  stopSessions: number;
}

export interface JourneyItem {
  /** Обычно JourneyItemType; незнакомое значение с бэка — не ошибка (фолбэк) */
  type: string;
  /** ISO-датавремя или YYYY-MM-DD */
  at: string;
  /** id строки-источника — для подтяжки содержимого записи */
  id?: number;
  needId?: string;
  modeId?: string;
  schemaIds?: string[];
}

export interface JourneyData {
  counts: JourneyCounts;
  items: JourneyItem[];
}

const UNKNOWN_META: JourneyTypeMeta = { label: 'Запись', group: 'exercise' };

/** Мета типа с фолбэком: новый тип с бэка не роняет и не прячет ленту. */
export function journeyTypeMeta(type: string): JourneyTypeMeta {
  return JOURNEY_TYPE_META[type as JourneyItemType] ?? UNKNOWN_META;
}

// Чипы фильтра — порядок показа на экране.
export const JOURNEY_FILTERS: Array<{
  id: JourneyGroup | 'all';
  label: string;
}> = [
  { id: 'all', label: 'Всё' },
  { id: 'tracker', label: 'Трекер' },
  { id: 'diary', label: 'Дневники' },
  { id: 'practice', label: 'Что питает' },
  { id: 'test', label: 'Тесты' },
  { id: 'exercise', label: 'Упражнения' },
  { id: 'cards', label: 'Карточки' },
];

// Период ленты живёт в journeyPeriod (правило №10) — реэкспорт сохраняет
// единственный вход для фронтендов.
export {
  JOURNEY_PERIODS,
  JOURNEY_PERIOD_TITLE,
  JOURNEY_PERIOD_SUBTITLE,
  filterJourneyByPeriod,
} from './journeyPeriod';
export type { JourneyPeriod } from './journeyPeriod';

export type SortDir = 'desc' | 'asc';

/** Сортировка ленты по времени; не мутирует вход. */
export function sortJourneyItems(
  items: readonly JourneyItem[],
  dir: SortDir,
): JourneyItem[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...items].sort(
    (a, b) => sign * (dateStringMs(a.at) - dateStringMs(b.at)),
  );
}

export function filterJourneyItems(
  items: readonly JourneyItem[],
  group: JourneyGroup | 'all',
): JourneyItem[] {
  if (group === 'all') return [...items];
  return items.filter((i) => journeyTypeMeta(i.type).group === group);
}

// Имена потребностей для подписи строки ленты (источник — needData фронтендов;
// это стабильные продуктовые названия, тут только отображение).
export const JOURNEY_NEED_NAMES: Record<string, string> = {
  attachment: 'Привязанность',
  autonomy: 'Автономия',
  expression: 'Выражение чувств',
  play: 'Спонтанность',
  limits: 'Границы',
};

// Эмодзи потребностей — остался один потребитель, портрет профиля (portrait/portraitData.ts;
// «Мой путь» и его карточки рисуют знаки, b22/b23b). Та же пятёрка, что JOURNEY_NEED_NAMES;
// сверка (правило №4) — portrait/portraitData.test.ts.
export const JOURNEY_NEED_EMOJI: Record<string, string> = {
  attachment: '🤝',
  autonomy: '🧭',
  expression: '💬',
  play: '🎉',
  limits: '⚖️',
};

export interface JourneySubtitleSources {
  getModeById(id: string): { name: string } | undefined;
  getSchemaById(id: string): { name: string } | undefined;
}

/** Уточнение к строке ленты: имя режима/схемы/потребности (enum → название). */
export function journeyItemSubtitle(
  item: JourneyItem,
  src: JourneySubtitleSources,
): string | null {
  if (item.modeId) return src.getModeById(item.modeId)?.name ?? null;
  if (item.schemaIds?.length) {
    const names = item.schemaIds
      .map((id) => src.getSchemaById(id)?.name)
      .filter(Boolean);
    return names.length ? names.join(', ') : null;
  }
  if (item.needId) return JOURNEY_NEED_NAMES[item.needId] ?? null;
  return null;
}

/** «21 июля» / «21 июля 2025» (год — только если не текущий). Чистая. */
export function formatJourneyDate(at: string, now = new Date()): string {
  const parts = dateStringParts(at);
  if (!parts) return '';
  const sameYear = parts.year === now.getFullYear();
  return formatDateString(at, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export interface JourneyMonthGroup {
  /** YYYY-MM */
  key: string;
  /** «Июль» / «Декабрь 2025» (год — только чужой) */
  label: string;
  items: JourneyItem[];
}

/**
 * Группирует УЖЕ отсортированную ленту по месяцам, сохраняя порядок.
 * Записи с нечитаемой датой собираются в группу «Раньше» в конце. Чистая.
 */
export function groupJourneyByMonth(
  items: readonly JourneyItem[],
  now = new Date(),
): JourneyMonthGroup[] {
  const groups: JourneyMonthGroup[] = [];
  const undated: JourneyItem[] = [];
  for (const item of items) {
    const parts = dateStringParts(item.at);
    if (!parts) {
      undated.push(item);
      continue;
    }
    const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    const raw = formatDateString(item.at, {
      month: 'long',
      ...(parts.year === now.getFullYear() ? {} : { year: 'numeric' }),
    });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    groups.push({ key, label, items: [item] });
  }
  if (undated.length)
    groups.push({ key: 'undated', label: 'Раньше', items: undated });
  return groups;
}

/** «21 июля» без года — для компактной строки таймлайна. Чистая. */
export function formatJourneyDay(at: string): string {
  return formatDateString(at, { day: 'numeric', month: 'long' });
}
