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
] as const;
export type TechniqueOwnSign = (typeof TECHNIQUE_OWN_SIGN_KEYS)[number];
