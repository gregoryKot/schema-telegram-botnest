import { templateHue } from '../therapist/taskModel';
import { exerciseCard, type ExId } from '../../../../shared/src/exercises/exerciseCatalog';

export type TaskType = 'diary_streak' | 'tracker_streak' | 'belief_check' | 'letter_to_self' | 'safe_place' | 'flashcard' | 'schema_intro' | 'mode_intro' | 'custom';

export type TaskOption = { type: TaskType; label: string; sub: string; hasStreak?: boolean; time: string; hue: number };

type RawOption = Omit<TaskOption, 'hue'>;

/** Задания-упражнения библиотеки: срок берётся из каталога, а не своей цифрой (QA 2026-11, М6). */
export const TASK_EXERCISE = {
  schema_intro: 'schema', mode_intro: 'mode', belief_check: 'belief', letter_to_self: 'letter', safe_place: 'safe',
} as const satisfies Partial<Record<TaskType, ExId>>;
const libTime = (t: keyof typeof TASK_EXERCISE) => exerciseCard(TASK_EXERCISE[t]).time;

const RAW_OPTIONS: RawOption[] = [
  { type: 'tracker_streak', label: 'Трекер потребностей',  sub: 'Отмечать потребности N дней подряд',        hasStreak: true, time: '2–3 мин/день' },
  { type: 'schema_intro',   label: 'Карточка схемы',       sub: 'Познакомиться со схемой – 7 вопросов',      time: libTime('schema_intro') },
  { type: 'mode_intro',     label: 'Карточка режима',      sub: 'Познакомиться со своим режимом',            time: libTime('mode_intro') },
  { type: 'belief_check',   label: 'Проверить убеждение',  sub: 'Собрать доказательства за и против',        time: libTime('belief_check') },
  { type: 'letter_to_self', label: 'Письмо себе',          sub: 'Написать Уязвимому Ребёнку',               time: libTime('letter_to_self') },
  { type: 'safe_place',     label: 'Безопасное место',     sub: 'Описать и перечитывать',                   time: libTime('safe_place') },
  { type: 'diary_streak',   label: 'Дневник',              sub: 'Заполнять N дней подряд',                  hasStreak: true, time: '5–10 мин/день' },
  { type: 'flashcard',      label: 'Мне плохо',            sub: 'Три вдоха и четыре шага',                  time: '10 мин' },
  { type: 'custom',         label: 'Своё задание',         sub: 'Любой текст в свободной форме',   time: '–' },
];

export const TASK_OPTIONS: TaskOption[] = RAW_OPTIONS.map(o => ({ ...o, hue: templateHue(o.label) }));

export const STREAK_OPTIONS = [3, 7, 14, 30];
