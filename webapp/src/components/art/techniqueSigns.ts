// Знак листа техники: у каждой свой, общих между техниками нет (guideSignsModel.test.tsx).
// Первые 14 — GuideSignsTechniques.tsx и мотивы кабинета, остальные — TechniqueSigns*.tsx.
import type {
  BorrowedTechniqueId, CambridgeTechniqueId, CoreTechniqueId, SchemaTechniqueId, TechniqueId,
  YoungTechniqueId, ArntzTechniqueId,
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
  diagnostic_imagery: 'scene_look',
  safe_place_imagery: 'haven',
  mode_dialogue_imagery: 'talk_inner',
  anger_expression: 'flare',
  mode_map: 'cluster',
  schema_diary: 'diary_sheet',
  positive_data_log: 'pebble_bowl',
  behavioral_experiment: 'try_step',
  transitional_objects: 'keepsake',
  play_and_joy: 'together',
  body_grounding: 'grounded',
  values_overview: 'values',
  couple_mode_cycle: 'ribbon',
  online_chairwork: 'talk_screen',
};

const BORROWED_TECHNIQUE_SIGN: Record<BorrowedTechniqueId, GuideSign> = {
  behavioral_activation: 'activation',
  socratic_dialogue: 'socratic',
  exposure: 'approach',
  chain_analysis: 'beads',
  distress_tolerance: 'pause',
  validation_levels: 'levels_heart',
  defusion: 'defusion',
  compassionate_self: 'warm_self',
  motivational_interviewing: 'ambivalence',
  window_of_tolerance: 'window',
  stop_rewind_explore: 'rewind',
  life_line: 'life_line',
  downward_arrow: 'layers',
};

const CAMBRIDGE_TECHNIQUE_SIGN: Record<CambridgeTechniqueId, GuideSign> = {
  schema_attunement: 'attune',
  responsibility_pie: 'pie',
  courtroom: 'courtroom',
  healthy_adult_three_chairs: 'three_chairs',
  need_now_question: 'cup',
};

const YOUNG_TECHNIQUE_SIGN: Record<YoungTechniqueId, GuideSign> = {
  schema_dialogue: 'talk_schema',
};

const ARNTZ_TECHNIQUE_SIGN: Record<ArntzTechniqueId, GuideSign> = {
  current_role_play: 'talk_now',
};

export const TECHNIQUE_SIGN: Record<TechniqueId, GuideSign> = {
  ...CORE_TECHNIQUE_SIGN,
  ...SCHEMA_TECHNIQUE_SIGN,
  ...CAMBRIDGE_TECHNIQUE_SIGN,
  ...YOUNG_TECHNIQUE_SIGN,
  ...ARNTZ_TECHNIQUE_SIGN,
  ...BORROWED_TECHNIQUE_SIGN,
};
