import * as needColors from '../../../../shared/src/needs/needColors';

/** color-mix: works with CSS vars AND hex. Replaces the old hex-alpha hack. */
export function cm(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/** Keep hex() for dot/icon backgrounds where we need a solid resolved color */
const VAR_HEX: Record<string, string> = {
  'var(--accent-red)': '#f87171',
  'var(--accent-orange)': '#fb923c',
  'var(--accent-yellow)': '#facc15',
  'var(--accent-green)': '#4ade80',
  'var(--accent-indigo)': '#9a5b3e',
  'var(--accent-blue)': '#2f6f9e',
  'var(--accent)': '#9a5b3e',
};
export function hex(color: string) {
  return VAR_HEX[color] ?? color;
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
