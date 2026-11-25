import type { TechniqueGuide, TechniqueGuideBuilder } from '../types';
import { TECHNIQUE_BUILDERS as BASE } from './all';
import {
  confrontationArntz4,
  limitSettingArntz4,
  reparentingArntz4,
} from './arntzGeneralMore';

/** Дополнения гл. 4 Арнтц и Якоб к «Подробнее» техник по id. */
const TECHNIQUE_MORE: Record<string, string[]> = {
  empathic_confrontation: confrontationArntz4,
  limited_reparenting: reparentingArntz4,
  limit_setting: limitSettingArntz4,
};

const withArntz = (t: TechniqueGuide): TechniqueGuide => {
  const extra = TECHNIQUE_MORE[t.id];
  return extra ? { ...t, more: [...(t.more ?? []), ...extra] } : t;
};

export const TECHNIQUE_BUILDERS: TechniqueGuideBuilder[] = BASE.map(
  (build) => (tr) => build(tr).map(withArntz),
);
