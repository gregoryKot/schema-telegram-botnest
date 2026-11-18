// Знак листа техники. У первых 14 техник знак свой; техники, добавленные позже (#1366),
// берут знак родственной техники или мотива — своих рисунков у них пока нет.
import type {
  CoreTechniqueId, SchemaTechniqueId, TechniqueId,
} from '../../../../shared/src/schemaTherapy/guide/techniqueIds';
import type { GuideSign } from './guideSignsModel';

export const CORE_TECHNIQUE_SIGN: Record<CoreTechniqueId, GuideSign> = {
  imagery_rescripting: 'rescript',
  future_imagery: 'horizon',
  chairwork: 'talk',
  historical_role_play: 'talk_past',
  flashcards: 'flashcard',
  cognitive_work: 'pebbles',
  letters: 'sheets',
  pattern_breaking: 'pattern_steps',
  mindfulness: 'breath',
  empathic_confrontation: 'heart_frame',
  pros_cons: 'scales',
  mode_interview: 'spotlight',
  self_compassion: 'heart',
  healthy_adult_imagery: 'grown',
};

const SCHEMA_TECHNIQUE_SIGN: Record<SchemaTechniqueId, GuideSign> = {
  limited_reparenting: 'child_care',
  limit_setting: 'limits',
  diagnostic_imagery: 'rescript',
  safe_place_imagery: 'shelter',
  mode_dialogue_imagery: 'talk',
  anger_expression: 'flare',
  mode_map: 'cluster',
  schema_diary: 'sheets',
};

export const TECHNIQUE_SIGN: Record<TechniqueId, GuideSign> = {
  ...CORE_TECHNIQUE_SIGN,
  ...SCHEMA_TECHNIQUE_SIGN,
};
