// Реестр шаблонов пути клиента (#1522). Новый шаблон — файл рядом и строка здесь; сверка — templates.test.ts.
import type { Tr } from '../../../needs/types';
import { buildBpd24Template } from './bpd24';
import { buildBrief50Template } from './brief50';
import { buildGeneralTemplate } from './general';
import type { PathTemplate, PathTemplateBuilder } from './types';

export type {
  PathTemplate,
  PathTemplateBuilder,
  PathTemplatePhase,
} from './types';

/** Шаблоны в порядке показа: общий первым. */
export const PATH_TEMPLATE_BUILDERS: PathTemplateBuilder[] = [
  buildGeneralTemplate,
  buildBrief50Template,
  buildBpd24Template,
];

export function buildPathTemplates(tr: Tr): PathTemplate[] {
  return PATH_TEMPLATE_BUILDERS.map((build) => build(tr));
}

/** Шаблон по id; такого нет — null. */
export function pathTemplate(tr: Tr, id: string): PathTemplate | null {
  return buildPathTemplates(tr).find((t) => t.id === id) ?? null;
}

/** Срок шаблона целиком, недель. */
export function pathTemplateWeeks(template: PathTemplate): number {
  return template.phases.reduce((sum, p) => sum + p.weeks, 0);
}
