// Вид листов вкладки «Путь терапии» и фаз конструктора «По фазам»: один источник на справочник, лист
// фазы и карточку плана (правило №3). Стадии идут по кругу палитры, как путь: слива → глина → солома
// → мох → бирюза → небо; обзор остаётся сиренью вкладки. Записи — числа PAPER_HUE литералами (как у
// ENTITY_LOOK): таблица, которую никто не читает, выпадает из главного чанка при сборке.
import type { Look, SheetLook } from './entityLook';
import { PAPER_HUE, type PaperHue } from './signKeys';

/** Стадии пути по порядку: id листа справочника и ключ вида фазы шаблона (PathTemplatePhase.look). */
export const PHASE_LOOK_KEYS = [
  'assessment',
  'safety',
  'awareness',
  'managing',
  'healing',
  'autonomy',
] as const;
export type PhaseLookKey = (typeof PHASE_LOOK_KEYS)[number];

export const PHASE_LOOK: Record<PhaseLookKey, Look> = {
  assessment: { hue: 310, sign: 'path_assessment' },
  safety: { hue: 28, sign: 'path_safety' },
  awareness: { hue: 70, sign: 'path_awareness' },
  managing: { hue: 145, sign: 'path_managing' },
  healing: { hue: 195, sign: 'path_healing' },
  autonomy: { hue: 240, sign: 'path_autonomy' },
};

/** Фаза шаблона после автономии (завершение, поддерживающие встречи): листа справочника у неё нет, круг палитры идёт дальше — сирень. */
export const ENDING_LOOK: Look = { hue: 290, sign: 'path_ending' };
/** Ключ вида фазы шаблона: стадия справочника, которой фаза соответствует (одна из её guidePhaseIds), или завершение. */
export const TEMPLATE_LOOK_KEYS = [...PHASE_LOOK_KEYS, 'ending'] as const;
export type TemplateLookKey = (typeof TEMPLATE_LOOK_KEYS)[number];

/** Обзор, сквозные темы и шаблоны: лист пути → вид (id листов — shared/…/guide/phases/). */
const OTHER_LOOK: Record<string, Look> = {
  overview: { hue: PAPER_HUE.lilac, sign: 'path_overview' },
  mode_order: { hue: 28, sign: 'path_mode_order' },
  techniques_timeline: { hue: 45, sign: 'path_timeline' },
  session_frame: { hue: 240, sign: 'path_session' },
  progress_markers: { hue: 145, sign: 'path_progress' },
  stuck_reasons: { hue: 310, sign: 'path_stuck' },
  novice_checklist: { hue: 70, sign: 'path_checklist' },
  protocols: { hue: 195, sign: 'path_protocols' },
};
/** Оттенок шаблона по его id; у листа шаблона один общий знак. */
const TEMPLATE_HUE: Record<string, PaperHue> = {
  general: 290,
  bpd24: 195,
  brief50: 70,
};

/** Префикс id листа шаблона; тот же, что TEMPLATE_SHEET_PREFIX (guide/phases/templateSheets.ts) — сверяет pathLook.test.ts. */
export const TEMPLATE_SHEET_PREFIX_ID = 'template_';

export const phaseLook = (key: TemplateLookKey): Look => (key === 'ending' ? ENDING_LOOK : PHASE_LOOK[key]);

/** Вид листа вкладки по id: стадия, обзор, сквозная тема или шаблон; неизвестный — сирень без знака. */
export function pathSheetLook(id: string): SheetLook {
  if (Object.hasOwn(PHASE_LOOK, id)) return PHASE_LOOK[id as PhaseLookKey];
  if (Object.hasOwn(OTHER_LOOK, id)) return OTHER_LOOK[id];
  if (id.startsWith(TEMPLATE_SHEET_PREFIX_ID)) {
    const hue = TEMPLATE_HUE[id.slice(TEMPLATE_SHEET_PREFIX_ID.length)];
    if (hue !== undefined) return { hue, sign: 'path_template' };
  }
  return { hue: PAPER_HUE.lilac };
}
