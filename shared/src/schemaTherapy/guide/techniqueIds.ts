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
  | 'downward_arrow';

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

/** Техники из книги Фаррелл, Рейсс и Шоу (карта «Фаррелл»). */
export type FarrellTechniqueId =
  | 'mode_management_plan'
  | 'healthy_adult_plan'
  | 'safety_bubble';

/** Техника из библиотеки (guide/techniques/*). */
export type TechniqueId =
  | CoreTechniqueId
  | SchemaTechniqueId
  | CambridgeTechniqueId
  | YoungTechniqueId
  | ArntzTechniqueId
  | FarrellTechniqueId
  | BorrowedTechniqueId;
