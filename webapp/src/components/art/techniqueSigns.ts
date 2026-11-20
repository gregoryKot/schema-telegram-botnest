// Знак листа техники. У первых 14 техник знак свой; техники, добавленные позже (#1366),
// берут знак родственной техники или мотива — своих рисунков у них пока нет.
import type {
  BorrowedTechniqueId, CambridgeTechniqueId, CoreTechniqueId, SchemaTechniqueId, TechniqueId,
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
  positive_data_log: 'pebbles',
  behavioral_experiment: 'pattern_steps',
  transitional_objects: 'flashcard',
  play_and_joy: 'together',
  body_grounding: 'breath',
  values_overview: 'horizon',
  couple_mode_cycle: 'ribbon',
  online_chairwork: 'talk',
};

const BORROWED_TECHNIQUE_SIGN: Record<BorrowedTechniqueId, GuideSign> = {
  behavioral_activation: 'pattern_steps',
  socratic_dialogue: 'spotlight',
  exposure: 'horizon',
  chain_analysis: 'beads',
  distress_tolerance: 'breath',
  validation_levels: 'heart_frame',
  defusion: 'pebbles',
  compassionate_self: 'heart',
  motivational_interviewing: 'scales',
  window_of_tolerance: 'limits',
  stop_rewind_explore: 'talk_past',
  life_line: 'ribbon',
  downward_arrow: 'layers',
};

const CAMBRIDGE_TECHNIQUE_SIGN: Record<CambridgeTechniqueId, GuideSign> = {
  schema_attunement: 'spotlight',
  responsibility_pie: 'scales',
  courtroom: 'scales',
  healthy_adult_three_chairs: 'grown',
  need_now_question: 'cup',
};

export const TECHNIQUE_SIGN: Record<TechniqueId, GuideSign> = {
  ...CORE_TECHNIQUE_SIGN,
  ...SCHEMA_TECHNIQUE_SIGN,
  ...CAMBRIDGE_TECHNIQUE_SIGN,
  ...BORROWED_TECHNIQUE_SIGN,
};
