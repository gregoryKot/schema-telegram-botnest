import { pluralRu } from '../../../../../../shared/src/utils/pluralRu';
import { pathTemplateWeeks, type PathTemplate } from '../../../../../../shared/src/therapy/path/templates';
import { formatPhaseRange, parseWeeks } from './pathView';
import type { PhaseDates } from '../../../../../../shared/src/therapy/path/pathPlan';

/** Строка под названием фазы: срок, примерные даты, подсказка в сессиях; чего нет — не показывается. */
export function phaseWhen(weeks: number | null, dates: PhaseDates | null, sessionsHint?: string): string {
  return [weeks != null ? `${weeks} нед.` : null, dates ? `примерно ${formatPhaseRange(dates)}` : null, sessionsHint]
    .filter(Boolean).join(' · ');
}

/** Поле срока, которое можно оставить пустым: пусто — без срока (`weeks: null`); не число в пределах — `valid: false`. */
export function parseOptionalWeeks(value: string): { valid: boolean; weeks: number | null } {
  if (value.trim() === '') return { valid: true, weeks: null };
  const weeks = parseWeeks(value);
  return { valid: weeks != null, weeks };
}

/** Строка шаблона в выборе: число фаз и, если у каждой есть срок, недели целиком. */
export function templateSize(t: PathTemplate): string {
  const weeks = pathTemplateWeeks(t);
  return `${t.phases.length} ${pluralRu(t.phases.length, 'фаза', 'фазы', 'фаз')}${weeks == null ? '' : ` · ${weeks} нед.`}`;
}
