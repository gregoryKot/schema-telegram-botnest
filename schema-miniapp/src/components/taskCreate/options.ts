import { SCHEMA_DOMAINS } from '../../schemaTherapyData';

export type TaskType =
  | 'diary_streak'
  | 'tracker_streak'
  | 'belief_check'
  | 'letter_to_self'
  | 'safe_place'
  | 'flashcard'
  | 'schema_intro'
  | 'mode_intro'
  | 'custom';

// Данные формы создания задания: пороги серий, каталог типов и плоский
// список схем. Вынесено из TaskCreateSheet.tsx (правило №10).

export const STREAK_OPTIONS = [3, 7, 14, 30];

export const TASK_OPTIONS: {
  type: TaskType;
  emoji: string;
  label: string;
  sub: string;
  hasStreak?: boolean;
}[] = [
  {
    type: 'diary_streak',
    emoji: '📔',
    label: 'Дневник',
    sub: 'Заполнять N дней подряд',
    hasStreak: true,
  },
  {
    type: 'tracker_streak',
    emoji: '📊',
    label: 'Трекер потребностей',
    sub: 'Отмечать N дней подряд',
    hasStreak: true,
  },
  {
    type: 'schema_intro',
    emoji: '🧩',
    label: 'Карточка схемы',
    sub: 'Познакомиться со своей схемой — 7 вопросов',
  },
  {
    type: 'mode_intro',
    emoji: '🔄',
    label: 'Карточка режима',
    sub: 'Познакомиться со своим режимом',
  },
  {
    type: 'belief_check',
    emoji: '🔍',
    label: 'Проверить убеждение',
    sub: 'Собрать доказательства за и против',
  },
  {
    type: 'letter_to_self',
    emoji: '✉️',
    label: 'Письмо себе',
    sub: 'Написать Уязвимому Ребёнку',
  },
  {
    type: 'safe_place',
    emoji: '🏡',
    label: 'Безопасное место',
    sub: 'Описать и перечитывать',
  },
  {
    type: 'flashcard',
    emoji: '🆘',
    label: 'Мне сейчас плохо',
    sub: 'Разобрать ситуацию — 5 шагов',
  },
  { type: 'custom', emoji: '✏️', label: 'Своё задание', sub: 'Любой текст' },
];

export const ALL_SCHEMAS_FLAT = SCHEMA_DOMAINS.flatMap((d) =>
  d.schemas.map((s) => ({
    id: s.id,
    name: s.name,
    domainColor: d.color,
  })),
);
