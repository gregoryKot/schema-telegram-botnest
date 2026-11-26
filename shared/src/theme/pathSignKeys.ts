/** Знаки вкладки «Путь терапии» «Справочника» (webapp: art/PathSigns*.tsx): обзор, шесть стадий, семь
 *  сквозных тем и общий знак шаблона; входят в реестр SIGN_KEYS и в знаки листов GUIDE_SIGNS. */
export const PATH_SIGN_KEYS = [
  // PathSigns.tsx — обзор и стадии по порядку пути
  'path_overview',
  'path_assessment',
  'path_safety',
  'path_awareness',
  'path_managing',
  'path_healing',
  'path_autonomy',
  // PathSignsTopics.tsx — сквозные темы и шаблон
  'path_mode_order',
  'path_timeline',
  'path_session',
  'path_progress',
  'path_stuck',
  'path_checklist',
  'path_protocols',
  'path_template',
  // PathSignsEnding.tsx — фаза шаблона после автономии
  'path_ending',
] as const;
export type PathSign = (typeof PATH_SIGN_KEYS)[number];
