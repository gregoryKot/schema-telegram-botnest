// Бумага фигур диаграммы (редизайн 2026-11, b32): заливка — бумага группы
// режима, домена схемы или потребности, контур — тот же оттенок тоном глубже,
// а не насыщенная обводка. Цвет — формулой бумаги paper.css (L и C общие,
// различается только оттенок). Значки на линиях потребностей — тон контура:
// глина «блокирует», мох «есть опора», к белой подложке не ниже 3:1.
import {
  getModeById,
  getSchemaById,
} from '../../../schemaTherapy/schemaTherapyData';
import { paperEdge, paperFill } from '../../../modeMap/nodePaperTone';
import { DOMAIN_HUE, MODE_GROUP_HUE, NEED_HUE } from '../../../theme/entityHue';
import type { DiagramNode } from './diagramTypes';

/** Оттенок бумаги фигуры: режим — группа, схема и её опыт — домен, потребность — своя. */
export function nodeHue(node: DiagramNode): number | undefined {
  if (node.kind === 'placeholder') return undefined;
  if (node.modeId)
    return MODE_GROUP_HUE[getModeById(node.modeId)?.groupId ?? ''];
  if (node.schemaId)
    return DOMAIN_HUE[getSchemaById(node.schemaId)?.domainId ?? ''];
  return node.needId
    ? (NEED_HUE as Record<string, number | undefined>)[node.needId]
    : undefined;
}

// Лицо и контур — бумага узла, общая с холстом карт (modeMap/nodePaperTone.ts).
export { paperEdge, paperFill };

/** Заливка и контур фигуры; без оттенка (заготовка, свой режим) — тихая нейтральная бумага. */
export function shapePaint(hue: number | undefined, faint?: boolean) {
  return hue === undefined
    ? { fill: 'var(--paper-sunk)', stroke: 'var(--line-strong)' }
    : { fill: paperFill(hue), stroke: paperEdge(hue, faint) };
}

/** Линия и значок связи с потребностью: глина — схема блокирует, мох — есть опора. */
export const NEED_LINK = {
  blocks: { line: 'oklch(0.66 0.08 28)', badge: 'oklch(0.5 0.1 28)' },
  meets: { line: 'oklch(0.64 0.07 145)', badge: 'oklch(0.48 0.08 145)' },
} as const;
