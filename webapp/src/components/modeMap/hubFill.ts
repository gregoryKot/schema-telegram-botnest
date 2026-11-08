import type { ModeMapNode } from '../../api';
import { circleGeometry } from '../../../../shared/src/therapy/conceptGraph/diagram/diagramCircle';
import { NEED_ORDER } from '../../../../shared/src/needs/needData';
import { HUB_DIAMETER, nodesInsideHub } from './hubGeometry';
import type { Draft } from './modeDraft';

// Круг потребностей, поставленный руками, собирается так же, как в схеме случая
// (conceptToModeMap): пять таблеток 2–1–2 из общей раскладки circleGeometry.
// Раньше из палитры приезжал пустой круг, и как его заполнять, было не понять.

type Pt = { x: number; y: number };
type Box = Parameters<typeof nodesInsideHub>[0];

/** Таблетки потребностей круга с левым верхним углом `at`; `skip` — needId, которые уже стоят внутри. */
export function hubNeedNodes(
  hubId: string, at: Pt, diameter = HUB_DIAMETER, skip: ReadonlySet<string> = new Set(), stamp = Date.now(),
): ModeMapNode[] {
  const r = diameter / 2;
  return circleGeometry(diameter, { x: at.x + r, y: at.y + r }).needs
    .filter((d) => d.needId && !skip.has(d.needId))
    .map((d) => ({
      id: `${hubId}_need_${d.needId}_${stamp}`, type: 'need' as const, position: { x: d.x, y: d.y },
      // мелкий шрифт, как у схемы случая: крупный текст налезал бы на соседнюю таблетку
      data: { label: d.label, needId: d.needId, customColor: d.color, fontSize: 'sm' as const },
    }));
}

/** Фигура из палитры → ноды холста: круг потребностей приезжает сразу с пятью потребностями внутри. */
export function expandDraft(draft: Draft, position: Pt): ModeMapNode[] {
  const node: ModeMapNode = { ...draft, position };
  return draft.type === 'needs' ? [node, ...hubNeedNodes(draft.id, position, draft.data.diameter)] : [node];
}

/** Потребности, которых нет внутри круга (по needId таблеток, чей центр в круге), в порядке NEED_ORDER. */
export function missingHubNeeds<T extends Box>(hub: Box, nodes: T[]): string[] {
  const inside = new Set(nodesInsideHub(hub, nodes)
    .map((n) => (n.data as ModeMapNode['data'] | undefined)?.needId)
    .filter((id): id is string => !!id));
  return NEED_ORDER.filter((id) => !inside.has(id));
}
