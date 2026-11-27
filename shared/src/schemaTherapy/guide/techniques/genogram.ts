import type { TechniqueGuideBuilder } from '../types';
import { buildGenogramBase } from './genogramBase';
import { GENOGRAM_STEVENS_MORE, GENOGRAM_STEVENS_STEPS } from './genogramStevens';

export const buildGenogramTechniques: TechniqueGuideBuilder = (tr) =>
  buildGenogramBase(tr).map((t) => ({
    ...t,
    steps: [...t.steps, ...GENOGRAM_STEVENS_STEPS],
    more: [...(t.more ?? []), ...GENOGRAM_STEVENS_MORE],
  }));
