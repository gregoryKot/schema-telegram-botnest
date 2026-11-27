// Знак листа техники: у каждой свой, общих между техниками нет (guideSignsModel.test.tsx). Техники пар 'need_vs_wish', 'mutual_reparenting', 'couple_friendship', 'couple_chairwork' — в couplesTechniqueSign.ts.
// Первые 14 — GuideSignsTechniques.tsx и мотивы кабинета, остальные — TechniqueSigns*.tsx.
import type {
  BorrowedTechniqueId, CambridgeTechniqueId, CoreTechniqueId, SchemaTechniqueId, TechniqueId,
  YoungTechniqueId, ArntzTechniqueId, ArntzJacobTechniqueId, FarrellTechniqueId, HeathTechniqueId, RoedigerTechniqueId,
  LuzTechniqueId,
  VreeswijkTechniqueId,
  RafaeliTechniqueId,
  FarrellShawTechniqueId,
} from '../../../../shared/src/schemaTherapy/guide/techniqueIds';
import type { GuideSign } from './guideSignsModel';
import { COUPLES_TECHNIQUE_SIGN } from './couplesTechniqueSign';

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
  problem_solving: 'check',
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
  two_axis_check: 'scatter',
  need_cycle: 'need_ring',
  guess_the_mode: 'guess_mode',
};

const ARNTZ_JACOB_TECHNIQUE_SIGN: Record<ArntzJacobTechniqueId, GuideSign> = {
  coping_bypass: 'bypass',
  mode_figures: 'figures',
};

const FARRELL_TECHNIQUE_SIGN: Record<FarrellTechniqueId, GuideSign> = {
  mode_management_plan: 'mode_plan',
  healthy_adult_plan: 'plan_ahead',
  safety_bubble: 'bubble',
  story_unmet_need: 'storm_need',
};

const FARRELL_SHAW_TECHNIQUE_SIGN: Record<FarrellShawTechniqueId, GuideSign> = {
  monitoring_cycle: 'monitor_ring',
  mode_awareness_summary: 'mode_page',
  progress_by_mode: 'review_rows',
};

const HEATH_TECHNIQUE_SIGN: Record<HeathTechniqueId, GuideSign> = {
  creative_mode_work: 'mask',
  probe_phrases: 'probe',
  intimacy_dialogue: 'intimacy',
  trauma_map: 'trauma_lines',
  recent_event_imagery: 'recent_scene',
  mental_contrasting_imagery: 'if_then',
  three_parts_check_in: 'three_parts',
};

const ROEDIGER_TECHNIQUE_SIGN: Record<RoedigerTechniqueId, GuideSign> = {
  genogram: 'family_tree',
  perspective_change: 'stand_above',
  body_mode_positions: 'side_seat',
};

const LUZ_TECHNIQUE_SIGN: Record<LuzTechniqueId, GuideSign> = { child_mode_play: 'finger_puppets' };
const VREESWIJK_TECHNIQUE_SIGN: Record<VreeswijkTechniqueId, GuideSign> = {
  three_minute_breathing_space: 'breathing_space',
  mindfulness_practices: 'body_scan',
  schema_awareness_practice: 'schema_lens',
  healthy_modes_mindfulness: 'healthy_light',
};

const RAFAELI_TECHNIQUE_SIGN: Record<RafaeliTechniqueId, GuideSign> = {
  rupture_repair: 'rupture_mend',
  historical_life_review: 'life_columns',
};

export const TECHNIQUE_SIGN: Record<TechniqueId, GuideSign> = {
  ...CORE_TECHNIQUE_SIGN,
  ...SCHEMA_TECHNIQUE_SIGN,
  ...CAMBRIDGE_TECHNIQUE_SIGN,
  ...YOUNG_TECHNIQUE_SIGN,
  ...ARNTZ_TECHNIQUE_SIGN,
  ...ARNTZ_JACOB_TECHNIQUE_SIGN,
  ...FARRELL_TECHNIQUE_SIGN,
  ...HEATH_TECHNIQUE_SIGN,
  ...ROEDIGER_TECHNIQUE_SIGN,
  ...LUZ_TECHNIQUE_SIGN,
  ...VREESWIJK_TECHNIQUE_SIGN,
  ...RAFAELI_TECHNIQUE_SIGN,
  ...COUPLES_TECHNIQUE_SIGN,
  ...FARRELL_SHAW_TECHNIQUE_SIGN,
  ...BORROWED_TECHNIQUE_SIGN,
};
