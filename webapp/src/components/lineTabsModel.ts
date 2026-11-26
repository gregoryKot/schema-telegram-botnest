// Клавиатура вкладок LineTabs (шаблон tablist).
/** Куда ведёт клавиша: ←/→ — по кругу, Home/End — к краям; иная клавиша — null. */
export function stepTab<T>(ids: readonly T[], current: T, key: string): T | null {
  if (!ids.length) return null;
  const i = ids.indexOf(current);
  if (key === 'ArrowRight') return ids[(i + 1) % ids.length];
  if (key === 'ArrowLeft') return ids[(i - 1 + ids.length) % ids.length];
  if (key === 'Home') return ids[0];
  if (key === 'End') return ids[ids.length - 1];
  return null;
}
