import * as needColors from '../../../../shared/src/needs/needColors';

/** color-mix: works with CSS vars AND hex. Replaces the old hex-alpha hack. */
export function cm(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

// Цвет — только из needColors.ts (правило №4), без хардкода здесь.
export const NEED_IDS = needColors.NEED_COLOR_ORDER.map((id) => ({
  id,
  color: needColors.needColor(id),
}));

export function readLocalIds(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function shortName(name: string): string {
  const part = name.split(' / ')[0];
  return part
    .replace('Эмоциональная ', 'Эмоц. ')
    .replace('Социальная ', 'Соц. ')
    .replace('Недостаточность ', 'Недост. ');
}

export function needScoreColor(v: number) {
  if (v <= 3) return 'var(--accent-red)';
  if (v <= 6) return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}
