import { exerciseCard, type ExId } from '../../../../shared/src/exercises/exerciseCatalog';
import { ENTITY_LOOK, type PaperHue, type SignKey } from '../../../../shared/src/theme/entityLook';
import { taskEntity } from '../../sections/practice/taskEntity';

export type TaskType = 'diary_streak' | 'tracker_streak' | 'belief_check' | 'letter_to_self' | 'safe_place' | 'flashcard' | 'schema_intro' | 'mode_intro' | 'custom';
/** Бумага и знак — сущности, куда задание ведёт (ENTITY_LOOK, как у TaskSign), а не templateHue по названию (b20). */
export type TaskOption = { type: TaskType; label: string; sub: string; hasStreak?: boolean; time: string; hue: PaperHue; sign: SignKey };

/** Задания-упражнения библиотеки: срок берётся из каталога, а не своей цифрой (QA 2026-11, М6). */
export const TASK_EXERCISE = {
  schema_intro: 'schema', mode_intro: 'mode', belief_check: 'belief', letter_to_self: 'letter', safe_place: 'safe',
} as const satisfies Partial<Record<TaskType, ExId>>;
const libTime = (t: keyof typeof TASK_EXERCISE) => exerciseCard(TASK_EXERCISE[t]).time;
// Порядок — плитки 3 и 2 в ряд: соседи по бумаге не ближе 40° (одна пара на телефоне — почему, в taskOptions.test.ts).
const RAW_OPTIONS: Omit<TaskOption, 'hue' | 'sign'>[] = [
  { type: 'tracker_streak', label: 'Трекер потребностей',  sub: 'Отмечать потребности N дней подряд',        hasStreak: true, time: '2–3 мин/день' },
  { type: 'schema_intro',   label: 'Карточка схемы',       sub: 'Познакомиться со схемой – 7 вопросов',      time: libTime('schema_intro') },
  { type: 'mode_intro',     label: 'Карточка режима',      sub: 'Познакомиться со своим режимом',            time: libTime('mode_intro') },
  { type: 'letter_to_self', label: exerciseCard('letter').title, sub: 'Что тогда важно было услышать', time: libTime('letter_to_self') },
  { type: 'safe_place',     label: 'Безопасное место',     sub: 'Описать и перечитывать',                   time: libTime('safe_place') },
  { type: 'diary_streak',   label: 'Дневник',              sub: 'Заполнять N дней подряд',                  hasStreak: true, time: '5–10 мин/день' },
  { type: 'belief_check',   label: 'Проверить убеждение',  sub: 'Собрать доказательства за и против',        time: libTime('belief_check') },
  { type: 'flashcard',      label: 'Мне плохо',            sub: 'Три вдоха и четыре шага',                  time: '10 мин' },
  { type: 'custom',         label: 'Своё задание',         sub: 'Любой текст в свободной форме',   time: '–' },
];

const lookOf = (type: TaskType) => ENTITY_LOOK[taskEntity({ type, text: '' })];
export const TASK_OPTIONS: TaskOption[] = RAW_OPTIONS.map(o => ({ ...o, hue: lookOf(o.type).hue, sign: lookOf(o.type).sign }));

export const STREAK_OPTIONS = [3, 7, 14, 30];
