import type { ModeMapKind } from '../../api';
import type { Look } from '../../../../shared/src/theme/entityLook';

/**
 * Знак и бумага типа графической карты (docs/design/APP_2026-11.md, b34): плитки экрана «нет карт» и
 * строки меню «Новая карта». Концептуализация — слои схем на глине, карта режимов — круги на небе,
 * ситуация — лента «Что случилось» на шалфее, пара — разговор на сливе, свободный холст — листы на
 * соломе. Соседние плитки (порядок MAP_KINDS, ряды по пять и по три) — не ближе 40° по кругу оттенков.
 */
export const KIND_LOOK: Record<ModeMapKind, Look> = {
  concept: { hue: 28, sign: 'layers' },
  personality: { hue: 240, sign: 'cluster' },
  problem: { hue: 135, sign: 'ribbon' },
  couple: { hue: 310, sign: 'talk' },
  free: { hue: 70, sign: 'sheets' },
};
