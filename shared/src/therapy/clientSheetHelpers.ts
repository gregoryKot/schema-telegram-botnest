// Общие чистые хелперы карточки клиента терапевта (webapp ↔ schema-miniapp,
// правило №3). indexColor и CONCEPT_FIELDS сведены 2026-08: канон — версия
// мини-аппа. Цвета согласованы с RosterSparkline (--accent-* есть в обоих
// фронтендах, в webapp — алиасы --c-amber/--c-rose); поле goals есть в типе
// и на бэке, в webapp форма его теряла — доехало вместе со сведением.
// Даты сессий — календарный день (`2026-01-15`), utils/calendarDate читает его
// полночью UTC: до инцидента 2026-09-17 день читался в зоне машины, и «1 месяц
// в терапии» на западном смещении превращался в «2 месяца».
import { dateStringMs, dateStringParts } from '../utils/calendarDate';
import { fmtDate, todayStr } from '../utils/format';
import { momentDayKey } from '../utils/momentDate';
import { pluralRu } from '../utils/pluralRu';
import { isVirtualId } from '../utils/sameId';
import type { UserId } from '../userId';

export const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/**
 * Офлайн-клиент (без Telegram): бэкенд отдаёт для него отрицательный
 * telegramId (-rel.id). По `name` его не отличить: name у такого клиента —
 * расшифрованное virtualClientName, то есть непустое.
 */
export function isVirtualClient(c: { telegramId: UserId }): boolean {
  return isVirtualId(c.telegramId);
}

/** Срок «в работе» до местного сегодня (дату начала терапевт вводит по своим
 *  часам). Месяц — когда прошёл целиком: число дошло до числа начала (31-е в
 *  коротком месяце — последний день), 30 сен → 26 окт — «26 дней». Начало в
 *  будущем — пусто: срока ещё нет. */
export function calcTherapyDuration(
  startDateStr: string,
  today: string = todayStr(),
): string {
  const startDay = momentDayKey(startDateStr);
  const s = dateStringParts(startDay);
  const t = dateStringParts(today);
  if (!s || !t || startDay > today) return '';
  const monthEnd = new Date(Date.UTC(t.year, t.month, 0)).getUTCDate();
  const months =
    (t.year - s.year) * 12 +
    (t.month - s.month) -
    (t.day < Math.min(s.day, monthEnd) ? 1 : 0);
  if (months >= 1)
    return `${months} ${pluralRu(months, 'месяц', 'месяца', 'месяцев')}`;
  const days = Math.round(
    (dateStringMs(today) - dateStringMs(startDay)) / 86400000,
  );
  return days < 1
    ? 'сегодня'
    : `${days} ${pluralRu(days, 'день', 'дня', 'дней')}`;
}

/** Отмечался сегодня по СВОЕМУ календарю: daysSinceActive сервер считает в
 *  зоне клиента. «Сегодня клиента» терапевт не знает (QA 2026-10-26). */
export const isActiveToday = (c: {
  daysSinceActive?: number | null;
}): boolean => c.daysSinceActive === 0;

export function nextSessionLabel(dateStr: string): string {
  const [datePart, timePart] = dateStr.includes('T')
    ? dateStr.split('T')
    : [dateStr, null];
  const parts = dateStringParts(datePart);
  if (!parts) return '';
  // Число, месяц и (если не текущий) год — через fmtDate: копию списка
  // месяцев тут держать нечего. Время — часы и минуты, без секунд.
  const base = `${DAY_NAMES[parts.weekday]}, ${fmtDate(datePart)}`;
  return timePart ? `${base} · ${timePart.slice(0, 5)}` : base;
}

/** Цвет индекса дня клиента; согласован с цветами RosterSparkline. */
export function indexColor(v: number) {
  if (v >= 7) return '#06d6a0';
  if (v >= 4) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

// Поля текстовой концептуализации. Ключи — литеральный union: он входит в
// keyof ClientConceptualization обоих фронтендов (тип намеренно локален —
// в webapp у него ещё mode-map поля).
export type ConceptTextField =
  | 'earlyExperience'
  | 'unmetNeeds'
  | 'triggers'
  | 'copingStyles'
  | 'modeTransitions'
  | 'currentProblems'
  | 'goals';

export const CONCEPT_FIELDS: {
  key: ConceptTextField;
  label: string;
  placeholder: string;
}[] = [
  {
    key: 'earlyExperience',
    label: 'Ранний дисфункциональный опыт',
    placeholder:
      'События и паттерны из детства и юности, которые сформировали схемы...',
  },
  {
    key: 'unmetNeeds',
    label: 'Неудовлетворённые базовые потребности',
    placeholder:
      'Привязанность, автономия, свобода выражения, игра/спонтанность, реалистичные границы...',
  },
  {
    key: 'triggers',
    label: 'Схемные триггеры',
    placeholder:
      'Ситуации, слова, интонации, отношения — что запускает схемные реакции...',
  },
  {
    key: 'copingStyles',
    label: 'Стили совладания',
    placeholder:
      'Капитуляция, избегание, гиперкомпенсация — типичные паттерны для каждой схемы...',
  },
  {
    key: 'modeTransitions',
    label: 'Переключение режимов',
    placeholder:
      'Что запускает переход в Уязвимого Ребёнка? Как активируется Карающий Критик? Когда появляется Здоровый Взрослый?...',
  },
  {
    key: 'currentProblems',
    label: 'Актуальные проблемы и симптомы',
    placeholder: 'С чем обратился клиент, текущие жалобы, симптоматика...',
  },
  {
    key: 'goals',
    label: 'Цели схема-терапии',
    placeholder:
      'Что должно измениться? Конкретные результаты, на которые направлена работа...',
  },
];
