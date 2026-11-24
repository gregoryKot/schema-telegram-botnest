import type { PathTemplatePhase } from '../../../therapy/path/templates';
import { pluralRu } from '../../../utils/pluralRu';

export const weeksLabel = (n: number): string =>
  `${n} ${pluralRu(n, 'неделя', 'недели', 'недель')}`;

/** Срок фазы словами; срока нет — null, в строке фазы его просто нет. */
export const phaseWeeks = (phase: PathTemplatePhase): string | null =>
  phase.weeks == null
    ? null
    : weeksLabel(phase.weeks) +
      (phase.weeksFrom === 'estimate' ? ' условно' : '');

/** Срок шаблона: общего срока нет — только текст шаблона. */
export const templateTiming = (timing: string, total: number | null): string =>
  total == null ? timing : `${timing} Всего в шаблоне ${weeksLabel(total)}.`;
