/** Знаки техник «Справочника», нарисованные после первых 14 (webapp: art/TechniqueSigns*.tsx);
 *  входят в реестр SIGN_KEYS и в знаки листов GUIDE_SIGNS. */
export const TECHNIQUE_OWN_SIGN_KEYS = [
  // TechniqueSignsScenes.tsx — сцены, разговоры, части
  'scene_look',
  'talk_inner',
  'talk_screen',
  'talk_schema',
  'talk_now',
  'three_chairs',
  'ambivalence',
  'courtroom',
  'socratic',
  'attune',
  'keepsake',
  'warm_self',
  // TechniqueSignsSteps.tsx — шаги, мысли, границы
  'diary_sheet',
  'pebble_bowl',
  'try_step',
  'activation',
  'approach',
  'values',
  'life_line',
  'window',
  'levels_heart',
  'defusion',
  'pie',
  'rewind',
  // TechniqueSignsArntz.tsx — техники из книги Арнца и ван Гендерен о ПРЛ
  'scatter',
  'need_ring',
  'guess_mode',
  'bypass',
  'figures',
  // TechniqueSignsFarrell.tsx — техники из книги Фаррелл, Рейсс и Шоу
  'mode_plan',
  'plan_ahead',
  'bubble',
  // TechniqueSignsHeath.tsx — техники из книги Хис и Стартап
  'mask',
  'probe',
  'intimacy',
  'trauma_lines',
  'recent_scene',
  'if_then',
  'three_parts',
  // TechniqueSignsRoediger.tsx — техники из книги Рёдигера, Стивенс и Брокмана
  'family_tree',
  // TechniqueSignsLuz.tsx — техники из книги Луз и соавторов о детях и подростках
  'finger_puppets',
  'stand_above',
  'balance_axes',
  'side_seat',
  // TechniqueSignsVreeswijk.tsx — практики осознанности из книги ван Фресвайк
  'breathing_space',
  'body_scan',
  'schema_lens',
  'healthy_light',
  // TechniqueSignsRafaeli.tsx — техники из книги Рафаэли, Бернштейн и Янга
  'rupture_mend',
  'life_columns',
  // TechniqueSignsFarrellShaw.tsx — техники из тетради Фаррелл и Шоу
  'monitor_ring',
  'mode_page',
  'review_rows',
] as const;
export type TechniqueOwnSign = (typeof TECHNIQUE_OWN_SIGN_KEYS)[number];
