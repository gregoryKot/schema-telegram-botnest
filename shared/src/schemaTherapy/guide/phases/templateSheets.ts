// Листы шаблонов пути на вкладке «Путь терапии»: собираются из данных shared/src/therapy/path/templates —
// тех же, из которых строится путь клиента. Текст шаблона правят там, не здесь.
import {
  buildPathTemplates,
  pathTemplateWeeks,
  type PathTemplate,
  type PathTemplatePhase,
} from '../../../therapy/path/templates';
import { pluralRu } from '../../../utils/pluralRu';
import { parseAddress } from '../address/addressFormat';
import type { TechniqueId, Tr } from '../types';
import type { PhaseGuide } from './types';

/** Приставка id листа шаблона: `template_<id шаблона>`. */
export const TEMPLATE_SHEET_PREFIX = 'template_';

export const weeksLabel = (n: number): string =>
  `${n} ${pluralRu(n, 'неделя', 'недели', 'недель')}`;

const uniq = <T>(items: T[]): T[] => [...new Set(items)];

/** id статей нужного вида среди рекомендованных адресов шаблона, по порядку фаз. */
function recommendedIds(template: PathTemplate, kind: string): string[] {
  return uniq(
    template.phases.flatMap((p) =>
      p.recommended.flatMap((address) => {
        const parts = parseAddress(address);
        return parts?.kind === kind ? [parts.articleId] : [];
      }),
    ),
  );
}

function stageLine(
  phase: PathTemplatePhase,
  index: number,
  names: Map<string, string>,
): string {
  const term = [
    weeksLabel(phase.weeks) +
      (phase.weeksFrom === 'estimate' ? ' условно' : ''),
    phase.sessionsHint,
  ]
    .filter(Boolean)
    .join(', ');
  const guide = phase.guidePhaseIds
    .flatMap((id) => names.get(id) ?? [])
    .map((name) => `«${name}»`)
    .join(', ');
  return [
    `${index + 1}. ${phase.name} — ${term}.`,
    `Цель: ${phase.goal}.`,
    `Терапевт: ${phase.therapist}`,
    `Позиция: ${phase.stance}`,
    guide && `В ленте фаз: ${guide}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

const perPhase = (
  template: PathTemplate,
  pick: (p: PathTemplatePhase) => string[],
): string[] => template.phases.map((p) => `${p.name}: ${pick(p).join('; ')}.`);

/** Лист шаблона: фазы со сроками, критерии перехода и ошибки по фазам, переходы к режимам, техникам и заметкам. */
export function templateSheet(
  template: PathTemplate,
  path: PhaseGuide[],
): PhaseGuide {
  const names = new Map(path.map((p) => [p.id, p.name]));
  const total = pathTemplateWeeks(template);
  return {
    id: TEMPLATE_SHEET_PREFIX + template.id,
    group: 'templates',
    name: template.name,
    goal: template.summary,
    essence: template.essence,
    timing: `${template.timing} Всего в шаблоне ${weeksLabel(total)}.`,
    stages: template.phases.map((p, i) => stageLine(p, i, names)),
    modeIds: recommendedIds(template, 'mode'),
    techniques: recommendedIds(template, 'technique') as TechniqueId[],
    noteIds: recommendedIds(template, 'note'),
    transition: perPhase(template, (p) => p.transition),
    mistakes: perPhase(template, (p) => p.mistakes),
    caveats: template.caveats,
    sources: template.sources,
  };
}

export function buildTemplateSheets(tr: Tr, path: PhaseGuide[]): PhaseGuide[] {
  return buildPathTemplates(tr).map((t) => templateSheet(t, path));
}
