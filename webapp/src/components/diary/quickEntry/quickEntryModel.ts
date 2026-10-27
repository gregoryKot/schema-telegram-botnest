import type { DiaryQuickTag } from '../../../../../shared/src/analytics/homeTile';

// Чистая модель «Дневника одной страницей»: теги, подписи и то, что уходит на
// сервер по каждому тегу. Без React и без сети — покрыта quickEntryModel.test.ts.

export type QuickTag = DiaryQuickTag;

export const QUICK_TAGS: ReadonlyArray<{ id: QuickTag; label: string }> = [
  { id: 'thought', label: 'Просто мысль' },
  { id: 'schema', label: 'Схема' },
  { id: 'mode', label: 'Режим' },
  { id: 'gratitude', label: 'Благодарность' },
];

/** Сервер держит до 20 пунктов на день, форма благодарности — пять. */
export const GRATITUDE_MAX_ITEMS = 5;

/** Теги, у которых после текста есть второй экран (выбор схемы / режима). */
export const hasSecondStep = (tag: QuickTag): boolean => tag === 'schema' || tag === 'mode';

/** Запись схем без схем и эмоций — так сохраняется «Просто мысль» и «Схема» без выбора. */
export function schemaEntryInput(text: string, schemaIds: string[] = []) {
  return { trigger: text.trim(), emotions: [], schemaIds };
}

export function modeEntryInput(text: string, modeId: string) {
  return { modeId, situation: text.trim() };
}

/** Пункты дня после добавления текста; null — пять пунктов уже есть, места нет. */
export function appendGratitudeItem(existing: readonly string[], text: string): string[] | null {
  const kept = existing.filter((s) => s.trim().length > 0);
  if (kept.length >= GRATITUDE_MAX_ITEMS) return null;
  return [...kept, text.trim()];
}

/**
 * Поля формы благодарности с текстом из быстрой записи: он встаёт в первый пустой
 * пункт, а если пустых нет — новым пунктом (пока их меньше пяти).
 */
export function mergeInitialItem(items: readonly string[], text: string): string[] {
  const value = text.trim();
  if (!value || items.includes(value)) return [...items];
  const blank = items.findIndex((s) => s.trim().length === 0);
  if (blank >= 0) return items.map((s, i) => (i === blank ? value : s));
  return items.length < GRATITUDE_MAX_ITEMS ? [...items, value] : [...items];
}

