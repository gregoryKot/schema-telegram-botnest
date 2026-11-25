import type { TechniqueId } from '../types';

/** Депрессия: режимы и схемы статьи. Первыми идут прежние id, затем из табл. 13.1 и раздела о схемах Кембриджа гл. 13. */
export const depressionModeIds: string[] = [
  'detached_protector',
  'worrying_oc',
  'invincible_oc',
  'self_aggrandiser',
  'happy_child',
  'vulnerable_child',
  'angry_child',
  'angry_protector',
  'guilt_critic',
  'punitive_critic',
  'demanding_critic',
  'compliant_surrenderer',
  'helpless_surrenderer',
  'avoidant_protector',
  'perfectionistic_oc',
  'detached_self_soother',
  'impulsive_child',
];

export const depressionSchemaIds: string[] = [
  'failure',
  'defectiveness',
  'emotional_deprivation',
  'self_sacrifice',
  'social_isolation',
];

export const depressionTechniques: TechniqueId[] = [
  'need_now_question',
  'behavioral_activation',
  'pattern_breaking',
  'defusion',
  'imagery_rescripting',
];
