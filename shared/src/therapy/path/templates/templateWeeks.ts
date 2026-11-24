import type { PathTemplate } from './types';

/** Срок шаблона целиком, недель; у какой-то фазы срока нет — null (общего срока не назвать). */
export function pathTemplateWeeks(template: PathTemplate): number | null {
  let sum = 0;
  for (const p of template.phases) {
    if (p.weeks == null) return null;
    sum += p.weeks;
  }
  return sum;
}
