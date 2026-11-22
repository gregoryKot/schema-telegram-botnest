import type { ReactNode } from 'react';
import type { Tr } from '../../../../../shared/src/schemaTherapy/guide/types';
import type { Guide } from '../../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';
import type { PlanWorkSummary } from '../../../../../shared/src/therapy/plan/planWork';
import { PlanItemRow } from './PlanItemRow';
import { PlanWorkLine } from './PlanWorkLine';
import { planSourceLink, type PlanSourceLink } from './planSource';
import type { PhaseOption } from './planModel';
import type { PlanItems } from './usePlanItems';

/** Строка пункта; `order` — стрелки перестановки (только раскладка «По каналам»). */
export type RenderPlanRow = (item: PlanItem, order?: { canUp: boolean; canDown: boolean }, phases?: PhaseOption[]) => ReactNode;

interface Deps {
  plan: PlanItems;
  texts: Guide | null | undefined;
  tr: Tr;
  openSource: (open: NonNullable<PlanSourceLink['open']>) => void;
  onAssign: (item: PlanItem) => void;
  onDelete: (item: PlanItem) => void;
  /** Сводка «работали» по пунктам; `onOpenSession` — открыть запись (нет — строка без тапа). */
  work?: Map<number, PlanWorkSummary>;
  onOpenSession?: (noteId: number) => void;
}

/** Одна строка пункта с одними обработчиками для обеих раскладок плана: по каналам и по фазам. */
export function makeRenderPlanRow({ plan, texts, tr, openSource, onAssign, onDelete, work, onOpenSession }: Deps): RenderPlanRow {
  return function renderPlanRow(item, order, phases) {
    const link = planSourceLink(texts, tr, item);
    const summary = work?.get(item.id);
    return (
      <PlanItemRow
        key={item.id} item={item} busy={plan.busyId !== null}
        sourceLink={link} work={summary && <PlanWorkLine summary={summary} onOpen={onOpenSession} />}
        onSetStatus={(status) => void plan.setStatus(item, status)}
        onOpenSource={() => link?.open && openSource(link.open)}
        onAssign={() => onAssign(item)}
        linkPending={item.taskId == null && plan.pendingLinks[item.id] != null}
        onRetryLink={() => void plan.retryLink(item.id)}
        onSaveText={(text) => plan.saveText(item.id, text)}
        onDelete={() => { plan.clearError(); onDelete(item); }}
        canUp={order?.canUp ?? false} canDown={order?.canDown ?? false} onMove={(dir) => void plan.move(item, dir)}
        phases={phases} onSetPhase={(phaseId) => void plan.setPhase(item, phaseId)}
      />
    );
  };
}
