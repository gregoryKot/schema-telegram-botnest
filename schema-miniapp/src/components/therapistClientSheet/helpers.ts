import { ClientConceptualization } from '../../api';

export const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function calcTherapyDuration(startDateStr: string): string {
  const start = new Date(startDateStr);
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (months < 1) {
    const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
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
  const [, m, d] = datePart.split('-');
  const MONTHS = [
    'янв',
    'фев',
    'мар',
    'апр',
    'май',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ];
  const date = new Date(datePart + 'T00:00:00');
  const base = `${DAY_NAMES[date.getDay()]}, ${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`;
  return timePart ? `${base} · ${timePart}` : base;
}

function _streakEmoji(s: number) {
  if (s >= 7) return '🔥';
  if (s >= 1) return '🌱';
  return '🫥';
}
void _streakEmoji;

export function indexColor(v: number) {
  if (v >= 7) return '#06d6a0';
  if (v >= 4) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

export const CONCEPT_FIELDS: {
  key: keyof ClientConceptualization;
  label: string;
  placeholder: string;
}[] = [
  {
    key: 'earlyExperience',
    label: 'Ранний дисфункциональный опыт',
    placeholder:
      'Значимые события и паттерны из детства и юности, которые сформировали схемы...',
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
