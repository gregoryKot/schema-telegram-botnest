import type { TechniqueGuide, TechniqueGuideBuilder } from '../types';
import { TECHNIQUE_BUILDERS as BASE } from './all';
import { ARNTZ_CONCEPT_BY_TECHNIQUE } from './arntzByTechnique';

const withArntz = (t: TechniqueGuide): TechniqueGuide => {
  const extra = ARNTZ_CONCEPT_BY_TECHNIQUE[t.id];
  return extra ? { ...t, more: [...(t.more ?? []), ...extra] } : t;
};

export const TECHNIQUE_BUILDERS: TechniqueGuideBuilder[] = BASE.map(
  (build) => (tr) => build(tr).map(withArntz),
);
