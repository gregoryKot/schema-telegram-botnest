/** Первые 14 техник библиотеки (guide/techniques/{imagery,chairs,stance,homework}.ts). */
export type CoreTechniqueId =
  | 'imagery_rescripting'
  | 'future_imagery'
  | 'chairwork'
  | 'historical_role_play'
  | 'flashcards'
  | 'cognitive_work'
  | 'letters'
  | 'pattern_breaking'
  | 'mindfulness'
  | 'empathic_confrontation'
  | 'pros_cons'
  | 'mode_interview'
  | 'self_compassion'
  | 'healthy_adult_imagery';

import type {
  FarrellShawTechniqueId,
  FarrellTechniqueId,
} from './techniqueIdsFarrell';
/** Техники схема-терапии, добавленные позже (#1366). */
export type SchemaTechniqueId =
  | 'limited_reparenting'
  | 'limit_setting'
  | 'diagnostic_imagery'
  | 'safe_place_imagery'
  | 'mode_dialogue_imagery'
  | 'anger_expression'
  | 'mode_map'
  | 'schema_diary'
  | 'positive_data_log'
  | 'behavioral_experiment'
  | 'transitional_objects'
  | 'play_and_joy'
  | 'body_grounding'
  | 'values_overview'
  | 'couple_mode_cycle'
  | 'online_chairwork';

/** Техники из других подходов (#1366): у записи заполнены `approach` и `pairsWith`. */
export type BorrowedTechniqueId =
  | 'behavioral_activation'
  | 'socratic_dialogue'
  | 'exposure'
  | 'chain_analysis'
  | 'distress_tolerance'
  | 'validation_levels'
  | 'defusion'
  | 'compassionate_self'
  | 'motivational_interviewing'
  | 'window_of_tolerance'
  | 'stop_rewind_explore'
  | 'life_line'
  | 'downward_arrow'
  | 'problem_solving';

/** Техники схема-терапии из Кембриджского руководства (пачка 7 карты). */
export type CambridgeTechniqueId =
  | 'schema_attunement'
  | 'responsibility_pie'
  | 'courtroom'
  | 'healthy_adult_three_chairs'
  | 'need_now_question';

/** Техники схема-терапии из книги Янга (пачка 8 карты). */
export type YoungTechniqueId = 'schema_dialogue';

/** Техники из книги Арнца и ван Гендерен о ПРЛ (карта «Арнц-ПРЛ»). */
export type ArntzTechniqueId =
  'current_role_play' | 'two_axis_check' | 'need_cycle' | 'guess_the_mode';

/** Техники из книги Арнтц и Якоб «Практическое руководство» (карта «Арнтц-Якоб»). */
export type ArntzJacobTechniqueId = 'coping_bypass' | 'mode_figures';

export type { FarrellShawTechniqueId, FarrellTechniqueId };

/** Техники из книги Хис и Стартап о креативных методах (карта «Хис-Стартап»). */
export type HeathTechniqueId =
  | 'creative_mode_work'
  | 'probe_phrases'
  | 'intimacy_dialogue'
  | 'three_parts_check_in'
  | 'trauma_map'
  | 'recent_event_imagery'
  | 'mental_contrasting_imagery';

/** Техники из книги Рёдигера, Стивенс и Брокмана (карта «Редигер»). */
export type RoedigerTechniqueId =
  'genogram' | 'perspective_change' | 'body_mode_positions';

/** Техники из книги Луз и соавторов о схема-терапии с детьми и подростками (карта «Дети»). */
export type LuzTechniqueId = 'child_mode_play';
/** Техники из книги ван Фресвайк, Брурсен и Шуринк (карта «ван Фресвайк»). */
export type VreeswijkTechniqueId =
  | 'three_minute_breathing_space'
  | 'mindfulness_practices'
  | 'schema_awareness_practice'
  | 'healthy_modes_mindfulness';

/** Техники из книги Рафаэли, Бернштейн и Янга (карта «Рафаэли»). */
export type RafaeliTechniqueId = 'rupture_repair' | 'historical_life_review';

/** Техника из библиотеки (guide/techniques/*). */
export type TechniqueId =
  | CoreTechniqueId
  | SchemaTechniqueId
  | CambridgeTechniqueId
  | YoungTechniqueId
  | ArntzTechniqueId
  | ArntzJacobTechniqueId
  | FarrellTechniqueId
  | FarrellShawTechniqueId
  | HeathTechniqueId
  | RoedigerTechniqueId
  | LuzTechniqueId
  | VreeswijkTechniqueId
  | RafaeliTechniqueId
  | BorrowedTechniqueId;
