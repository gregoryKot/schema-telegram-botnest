import { templateHue } from '../therapist/taskModel';

export type TaskType = 'diary_streak' | 'tracker_streak' | 'belief_check' | 'letter_to_self' | 'safe_place' | 'flashcard' | 'schema_intro' | 'mode_intro' | 'custom';

export type TaskOption = { type: TaskType; label: string; sub: string; hasStreak?: boolean; time: string; hue: number };

type RawOption = Omit<TaskOption, 'hue'>;

const RAW_OPTIONS: RawOption[] = [
  { type: 'tracker_streak', label: 'Трекер потребностей',  sub: 'Отмечать потребности N дней подряд',        hasStreak: true, time: '2–3 мин/день' },
  { type: 'schema_intro',   label: 'Карточка схемы',       sub: 'Познакомиться со схемой – 7 вопросов',      time: '15 мин' },
  { type: 'mode_intro',     label: 'Карточка режима',      sub: 'Познакомиться со своим режимом',            time: '10 мин' },
  { type: 'belief_check',   label: 'Проверить убеждение',  sub: 'Собрать доказательства за и против',        time: '20 мин' },
  { type: 'letter_to_self', label: 'Письмо себе',          sub: 'Написать Уязвимому Ребёнку',               time: '30 мин' },
  { type: 'safe_place',     label: 'Безопасное место',     sub: 'Описать и перечитывать',                   time: '20 мин' },
  { type: 'diary_streak',   label: 'Дневник',              sub: 'Заполнять N дней подряд',                  hasStreak: true, time: '5–10 мин/день' },
  { type: 'flashcard',      label: 'Мне сейчас плохо',     sub: 'Разобрать ситуацию – 5 шагов',             time: '10 мин' },
  { type: 'custom',         label: 'Своё задание',         sub: 'Любой текст в свободной форме',   time: '–' },
];

export const TASK_OPTIONS: TaskOption[] = RAW_OPTIONS.map(o => ({ ...o, hue: templateHue(o.label) }));

export const STREAK_OPTIONS = [3, 7, 14, 30];
