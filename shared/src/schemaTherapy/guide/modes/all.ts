import type { ModeGuideBuilder } from '../types';
import { buildVulnerableChildGuides } from './child';
import { buildAngryChildGuides } from './childAngry';
import { buildCriticGuides } from './critic';
import { buildSurrenderGuides, buildAvoidanceGuides } from './arntzIntroMore';
import { buildOvercontrolGuides } from './overcontrol';
import { buildAttackGuides } from './attack';
import { buildHealthyGuides } from './healthy';

/** Сборщики разделов режимов в порядке групп справочника. */
export const MODE_BUILDERS: ModeGuideBuilder[] = [
  buildVulnerableChildGuides,
  buildAngryChildGuides,
  buildCriticGuides,
  buildSurrenderGuides,
  buildAvoidanceGuides,
  buildOvercontrolGuides,
  buildAttackGuides,
  buildHealthyGuides,
];
