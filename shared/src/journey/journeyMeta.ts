// «Мой путь» — общая логика архива активности для обоих фронтендов
// (правило №3: общий код — в shared). Типы ленты зеркалят бэкендовый
// JourneyItemType (src/bot/journey.service.ts); незнакомый тип не ломает
// UI — journeyTypeMeta отдаёт нейтральный фолбэк.

// Группы для фильтра ленты (чипы «что показать»).
export type JourneyGroup =
  'tracker' | 'diary' | 'practice' | 'test' | 'exercise' | 'cards';

export interface JourneyTypeMeta {
  emoji: string;
  label: string;
  group: JourneyGroup;
}

// Реестр типов ленты. Ключи зеркалят бэкендовый JourneyItemType
// (src/bot/journey.service.ts) — тип ниже произведён из этих ключей,
// поэтому единственное место правки на фронте — этот объект.
export const JOURNEY_TYPE_META = {
  tracker_day: { emoji: '📊', label: 'Трекер потребностей', group: 'tracker' },
  note: { emoji: '📝', label: 'Заметка дня', group: 'tracker' },
  schema_diary: { emoji: '📔', label: 'Схемный дневник', group: 'diary' },
  mode_diary: { emoji: '🎭', label: 'Дневник режимов', group: 'diary' },
  gratitude: { emoji: '🌱', label: 'Благодарность', group: 'diary' },
  practice: { emoji: '🌿', label: 'Своя практика', group: 'practice' },
  plan_done: { emoji: '✅', label: 'Практика по плану', group: 'practice' },
  ysq: { emoji: '📋', label: 'Тест схем', group: 'test' },
  belief_check: { emoji: '⚖️', label: 'Проверка убеждения', group: 'exercise' },
  letter: { emoji: '✉️', label: 'Письмо себе', group: 'exercise' },
  flashcard: { emoji: '🆘', label: 'Кризисная карточка', group: 'exercise' },
  safe_place: { emoji: '🏝', label: 'Безопасное место', group: 'exercise' },
  schema_note: { emoji: '🧩', label: 'Карточка схемы', group: 'cards' },
  mode_note: { emoji: '🎪', label: 'Карточка режима', group: 'cards' },
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
}

export interface JourneyItem {
  /** Обычно JourneyItemType; незнакомое значение с бэка — не ошибка (фолбэк) */
  type: string;
  /** ISO-датавремя или YYYY-MM-DD */
  at: string;
  needId?: string;
  modeId?: string;
  schemaIds?: string[];
}

export interface JourneyData {
  counts: JourneyCounts;
  items: JourneyItem[];
}

const UNKNOWN_META: JourneyTypeMeta = {
  emoji: '✨',
  label: 'Запись',
  group: 'exercise',
};

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
  { id: 'practice', label: 'Практики' },
  { id: 'test', label: 'Тесты' },
  { id: 'exercise', label: 'Упражнения' },
  { id: 'cards', label: 'Карточки' },
];

// Цвет группы: css — переменная для UI (есть в обоих фронтендах),
// hex — тот же цвет для canvas-карточек (canvas не резолвит var()).
export const JOURNEY_GROUP_COLORS: Record<
  JourneyGroup,
  { css: string; hex: string }
> = {
  tracker: { css: 'var(--accent-blue)', hex: '#60a5fa' },
  diary: { css: 'var(--accent)', hex: '#a78bfa' },
  practice: { css: 'var(--accent-green)', hex: '#34d399' },
  test: { css: 'var(--accent-yellow)', hex: '#facc15' },
  exercise: { css: 'var(--accent-orange)', hex: '#fb923c' },
  cards: { css: 'var(--accent-indigo)', hex: '#818cf8' },
};

export type SortDir = 'desc' | 'asc';

/** Сортировка ленты по времени; не мутирует вход. */
export function sortJourneyItems(
  items: readonly JourneyItem[],
  dir: SortDir,
): JourneyItem[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...items].sort(
    (a, b) => sign * (Date.parse(a.at) - Date.parse(b.at)),
  );
}

export function filterJourneyItems(
  items: readonly JourneyItem[],
  group: JourneyGroup | 'all',
): JourneyItem[] {
  if (group === 'all') return [...items];
  return items.filter((i) => journeyTypeMeta(i.type).group === group);
}

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

// Имена потребностей для подписи строки ленты (источник — needData фронтендов;
// это стабильные продуктовые названия, тут только отображение).
export const JOURNEY_NEED_NAMES: Record<string, string> = {
  attachment: 'Привязанность',
  autonomy: 'Автономия',
  expression: 'Выражение чувств',
  play: 'Спонтанность',
  limits: 'Границы',
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
  const d = new Date(at.length === 10 ? `${at}T00:00:00` : at);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('ru-RU', {
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
    const d = new Date(item.at.length === 10 ? `${item.at}T00:00:00` : item.at);
    if (Number.isNaN(d.getTime())) {
      undated.push(item);
      continue;
    }
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    const raw = d.toLocaleDateString('ru-RU', {
      month: 'long',
      ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
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
  const d = new Date(at.length === 10 ? `${at}T00:00:00` : at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export interface JourneyCardRow {
  emoji: string;
  label: string;
  day: string;
  hex: string;
}

/** Готовые строки для canvas-карточки «лента по времени». Чистая. */
export function buildJourneyCardRows(
  items: readonly JourneyItem[],
  max = 8,
): JourneyCardRow[] {
  return items.slice(0, max).map((item) => {
    const meta = journeyTypeMeta(item.type);
    return {
      emoji: meta.emoji,
      label: meta.label,
      day: formatJourneyDay(item.at),
      hex: JOURNEY_GROUP_COLORS[meta.group].hex,
    };
  });
}
