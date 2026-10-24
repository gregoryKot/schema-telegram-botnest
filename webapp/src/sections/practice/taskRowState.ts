import type { UserTask } from '../../api';
import { ALL_SCHEMAS, ALL_MODES } from '../../schemaTherapyData';

const STREAK_TYPES = ['diary_streak', 'tracker_streak'];

const opensCard = (t: UserTask) => ALL_SCHEMAS.some(s => s.id === t.text) || ALL_MODES.some(m => m.id === t.text);

/** Какие действия у строки (как FullTaskRow в мини-аппе): чистая логика, под тестом. */
export function taskRowState(task: UserTask, hasComplete: boolean) {
  const doneToday = !!task.doneToday;
  return {
    doneToday,
    // «Готово» — у своих и назначенных заданий-самоотметок, которые ещё не закрыты.
    showComplete: !doneToday && task.done === null && task.type === 'custom' && hasComplete,
    // Строка открывается тапом, пока не сделана сегодня. Стрелка-подсказка — не у своих целей
    // (у них справа «Готово», как в мини-аппе), кроме custom с id схемы/режима: он открывает карточку.
    openable: !doneToday,
    showCta: !doneToday && (task.type !== 'custom' || opensCard(task)),
    streakNote: doneToday && STREAK_TYPES.includes(task.type),
  };
}
