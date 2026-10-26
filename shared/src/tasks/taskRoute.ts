// Куда ведёт задание по тапу — одна маршрутизация на все экраны обоих
// фронтендов (правило №3, «одна механика — один компонент»). До 2026-10-26
// маршрут жил тремя копиями: «Практика» сайта, «Помощь» мини-аппа и «Сегодня»
// сайта. Третья разошлась: «Проверить убеждение», «Письмо себе» и «Безопасное
// место» открывали экран настроек, «Разобрать ситуацию по шагам» и «Своё
// задание» — ничего (инцидент в docs/INCIDENTS.md, QA-проход 2026-10-26).
// Экран превращает маршрут в своё действие (лист, оверлей, раздел), а сам
// выбор «что открыть» и «закрывает ли упражнение задание» живёт только здесь.
import type { UserTask } from '../apiTypes';
import { findLegacyTaskTarget } from './taskTitle';

/** Упражнения, у которых есть `onComplete`: сохранение закрывает задание. */
export type TaskExercise =
  'belief_check' | 'letter_to_self' | 'safe_place' | 'flashcard';

export type TaskRoute =
  | { kind: 'diary' }
  | { kind: 'tracker' }
  | { kind: 'childhood_wheel' }
  | { kind: 'exercise'; exercise: TaskExercise }
  /** Карточка схемы/режима; без id — выбор из списка. */
  | { kind: 'schema'; id?: string }
  | { kind: 'mode'; id?: string }
  /** «Своё задание»: делается вне приложения, закрывается кнопкой «Готово». */
  | { kind: 'self' }
  | { kind: 'none' };

const EXERCISES: readonly string[] = [
  'belief_check',
  'letter_to_self',
  'safe_place',
  'flashcard',
] satisfies readonly TaskExercise[];

// schema_diary/mode_diary — стрик-типы из DTO (прогресс считает бэкенд), в
// формах создания их нет, но назначенное ими задание ведёт в дневник.
const DIARY_TYPES = ['diary_streak', 'schema_diary', 'mode_diary'];

export function taskRoute(task: Pick<UserTask, 'type' | 'text'>): TaskRoute {
  const { type, text } = task;
  if (DIARY_TYPES.includes(type)) return { kind: 'diary' };
  if (type === 'tracker_streak') return { kind: 'tracker' };
  if (type === 'childhood_wheel') return { kind: 'childhood_wheel' };
  if (EXERCISES.includes(type))
    return { kind: 'exercise', exercise: type as TaskExercise };
  if (type === 'schema_intro') return { kind: 'schema', id: text || undefined };
  if (type === 'mode_intro') return { kind: 'mode', id: text || undefined };
  // Задания старого формата хранили id схемы/режима прямо в тексте.
  const legacy = findLegacyTaskTarget(text);
  if (legacy) return { kind: legacy.type, id: legacy.id };
  return type === 'custom' ? { kind: 'self' } : { kind: 'none' };
}

/**
 * Закрывает ли сохранение упражнения само задание. Да — у упражнений и
 * карточек (своих целей тоже: иначе «Проверить убеждение» из «Моих целей»
 * не закрывалось ничем). Нет — у серий (их закрывает бэкенд по прогрессу) и
 * у «Своего задания» (кнопка «Готово»).
 */
export function completesOnSave(route: TaskRoute): boolean {
  return (
    route.kind === 'exercise' ||
    route.kind === 'schema' ||
    route.kind === 'mode'
  );
}
