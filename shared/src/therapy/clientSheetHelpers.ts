// Общие чистые хелперы карточки клиента терапевта (webapp ↔ schema-miniapp,
// правило №3). indexColor и CONCEPT_FIELDS сведены 2026-08: канон — версия
// мини-аппа. Цвета согласованы с RosterSparkline (--accent-* определены в
// обоих фронтендах, в webapp — алиасы --c-amber/--c-rose); поле goals есть
// в типе и на бэке, в webapp его форма теряла — доехало вместе со сведением.
//
// Даты сессий приходят календарным днём (`2026-01-15`, поле input[type=date]).
// Разбирает их utils/calendarDate — полночью UTC: до инцидента 2026-09-17
// день читался в зоне машины, и «1 месяц в терапии» на западном смещении
// превращался в «2 месяца» (месяц старта съезжал на предыдущий).
import { dateStringMs, dateStringParts } from '../utils/calendarDate';
import { fmtDate } from '../utils/format';

export const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function calcTherapyDuration(startDateStr: string): string {
  const start = dateStringParts(startDateStr);
  if (!start) return '';
  const now = new Date();
  const months =
    (now.getFullYear() - start.year) * 12 + (now.getMonth() + 1 - start.month);
  if (months < 1) {
    const days = Math.floor(
      (now.getTime() - dateStringMs(startDateStr)) / 86400000,
    );
    if (days < 1) return 'сегодня';
    const m10 = days % 10,
      m100 = days % 100;
    const w =
      m100 >= 11 && m100 <= 19
        ? 'дней'
        : m10 === 1
          ? 'день'
          : m10 >= 2 && m10 <= 4
            ? 'дня'
            : 'дней';
    return `${days} ${w}`;
  }
  const m10 = months % 10,
    m100 = months % 100;
  const w =
    m100 >= 11 && m100 <= 19
      ? 'месяцев'
      : m10 === 1
        ? 'месяц'
        : m10 >= 2 && m10 <= 4
          ? 'месяца'
          : 'месяцев';
  return `${months} ${w}`;
}

export function nextSessionLabel(dateStr: string): string {
  const [datePart, timePart] = dateStr.includes('T')
    ? dateStr.split('T')
    : [dateStr, null];
  const parts = dateStringParts(datePart);
  if (!parts) return '';
  // Число и месяц — через fmtDate: копию списка месяцев тут держать нечего.
  const base = `${DAY_NAMES[parts.weekday]}, ${fmtDate(datePart)}`;
  return timePart ? `${base} · ${timePart}` : base;
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
      'Что запускает переход в уязвимого ребёнка? Как активируется карающий критик? Когда появляется здоровый взрослый?...',
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
