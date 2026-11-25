import type { ModeGuide } from '../types';
import {
  avoidanceArntzConcept,
  surrenderArntzConcept,
} from './arntzConceptMore';
import { ARNTZ_CASES_ALL } from './arntzCasesAll';
import { withSessionSigns as withSigns } from './sessionSigns';

/** Образцы гл. 2.1.3 «Подробнее» к режимам избегания и капитуляции; id — режимы с этими образцами. */
const CONCEPT: Record<string, string[]> = {
  avoidant_protector: avoidanceArntzConcept,
  angry_protector: avoidanceArntzConcept,
  compliant_surrenderer: surrenderArntzConcept,
  helpless_surrenderer: surrenderArntzConcept,
};

/** Дополнения Арнтц и Якоб по id режима; пункт табл. 3.3 withSessionSigns ставит последним. */
export const withSessionSigns = (g: ModeGuide): ModeGuide => {
  const extra = [
    ...(CONCEPT[g.modeId] ?? []),
    ...(ARNTZ_CASES_ALL[g.modeId] ?? []),
  ];
  return withSigns(
    extra.length ? { ...g, more: [...(g.more ?? []), ...extra] } : g,
  );
};
