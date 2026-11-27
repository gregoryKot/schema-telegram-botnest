import type { TechniqueGuide } from '../types';

/** Подмена полей одной записи в готовом списке: так чужие файлы из бейслайна размера не растут. */
export const patchTechnique = (
  list: TechniqueGuide[],
  id: string,
  fn: (t: TechniqueGuide) => Partial<TechniqueGuide>,
): TechniqueGuide[] => list.map((t) => (t.id === id ? { ...t, ...fn(t) } : t));
