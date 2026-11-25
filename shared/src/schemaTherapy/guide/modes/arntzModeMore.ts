import type { ModeGuide } from '../types';
import { CONCEPT } from './arntzConceptByMode';
import { BPD_MODE_TAIL } from './arntzBpdTail';
import { ARNTZ_CASES_ALL } from './arntzCasesAll';
import { withSessionSigns as withSigns } from './sessionSigns';

/** Дополнения Арнтц и Якоб по id режима; пункт табл. 3.3 withSessionSigns ставит последним. */
export const withSessionSigns = (g: ModeGuide): ModeGuide => {
  const extra = [
    ...(CONCEPT[g.modeId] ?? []),
    ...(ARNTZ_CASES_ALL[g.modeId] ?? []),
    ...(BPD_MODE_TAIL[g.modeId] ?? []),
  ];
  return withSigns(
    extra.length ? { ...g, more: [...(g.more ?? []), ...extra] } : g,
  );
};
