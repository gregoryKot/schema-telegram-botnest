// id справочника для проверки записи в данных клиента — копия shared/src/schemaTherapy/content/
// (rootDir бэкенда — ./src); сверку держит kb-ids.sync.spec.ts. Потребности — NEED_IDS бота.
import { NEED_IDS } from '../bot/bot.service';

export const SCHEMA_IDS: readonly string[] = [
  'emotional_deprivation',
  'abandonment',
  'mistrust',
  'defectiveness',
  'social_isolation',
  'dependence',
  'vulnerability',
  'enmeshment',
  'failure',
  'entitlement',
  'insufficient_self_control',
  'subjugation',
  'self_sacrifice',
  'approval_seeking',
  'negativity',
  'emotion_inhibition_fear',
  'emotional_inhibition',
  'unrelenting_standards',
  'punitiveness_self',
  'punitiveness_others',
];

export const MODE_IDS: readonly string[] = [
  'vulnerable_child',
  'lonely_child',
  'abandoned_child',
  'humiliated_child',
  'dependent_child',
  'angry_child',
  'stubborn_child',
  'enraged_child',
  'impulsive_child',
  'undisciplined_child',
  'compliant_surrenderer',
  'helpless_surrenderer',
  'detached_protector',
  'detached_self_soother',
  'avoidant_protector',
  'angry_protector',
  'self_aggrandiser',
  'overcontroller',
  'perfectionistic_oc',
  'suspicious_oc',
  'invincible_oc',
  'flagellating_oc',
  'compulsive_oc',
  'worrying_oc',
  'scolding_oc',
  'bully_attack',
  'manipulative',
  'predator',
  'attention_seeker',
  'pollyanna',
  'demanding_critic',
  'punitive_critic',
  'guilt_critic',
  'happy_child',
  'healthy_adult',
  'good_parent',
];

/** Свой режим терапевта: `cm_<id TherapistCustomMode>` (webapp/src/components/modeMap/useCustomModes.ts). */
const CUSTOM_MODE_RE = /^cm_[A-Za-z0-9_-]{1,61}$/;

export type KbIdKind = 'schema' | 'mode' | 'need' | 'modeOrCustom';

const SETS: Record<Exclude<KbIdKind, 'modeOrCustom'>, ReadonlySet<string>> = {
  schema: new Set(SCHEMA_IDS),
  mode: new Set(MODE_IDS),
  need: new Set<string>(NEED_IDS),
};

/** id есть в справочнике (`modeOrCustom` — ещё и свой режим терапевта). */
export function isKbId(kind: KbIdKind, id: unknown): boolean {
  if (typeof id !== 'string') return false;
  if (kind === 'modeOrCustom')
    return SETS.mode.has(id) || CUSTOM_MODE_RE.test(id);
  return SETS[kind].has(id);
}
