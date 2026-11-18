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
  | 'schema_diary';

/** Техника из библиотеки (guide/techniques/*). */
export type TechniqueId = CoreTechniqueId | SchemaTechniqueId;
