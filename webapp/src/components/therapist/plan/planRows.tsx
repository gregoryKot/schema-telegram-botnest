import type { ReactNode } from 'react';
import type { Tr } from '../../../../../shared/src/schemaTherapy/guide/types';
import type { Guide } from '../../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';
import { PlanItemRow } from './PlanItemRow';
import { planSourceLink, type PlanSourceLink } from './planSource';
import type { PlanItems } from './usePlanItems';

/** Строка пункта; `order` — стрелки перестановки (только раскладка «По каналам»). */
export type RenderPlanRow = (item: PlanItem, order?: { canUp: boolean; canDown: boolean }) => ReactNode;

interface Deps {
  plan: PlanItems;
  texts: Guide | null | undefined;
  tr: Tr;
  openSource: (open: NonNullable<PlanSourceLink['open']>) => void;
  onAssign: (item: PlanItem) => void;
  onDelete: (item: PlanItem) => void;
}

/** Одна строка пункта с одними обработчиками для обеих раскладок плана: по каналам и по фазам. */
export function makeRenderPlanRow({ plan, texts, tr, openSource, onAssign, onDelete }: Deps): RenderPlanRow {
  return function renderPlanRow(item, order) {
    const link = planSourceLink(texts, tr, item);
    return (
      <PlanItemRow
        key={item.id} item={item} busy={plan.busyId !== null}
        sourceLink={link}
        onCycleStatus={() => void plan.cycleStatus(item)}
        onOpenSource={() => link?.open && openSource(link.open)}
        onAssign={() => onAssign(item)}
        linkPending={item.taskId == null && plan.pendingLinks[item.id] != null}
        onRetryLink={() => void plan.retryLink(item.id)}
        onSaveText={(text) => plan.saveText(item.id, text)}
        onDelete={() => { plan.clearError(); onDelete(item); }}
        canUp={order?.canUp ?? false} canDown={order?.canDown ?? false} onMove={(dir) => void plan.move(item, dir)}
      />
    );
  };
}
