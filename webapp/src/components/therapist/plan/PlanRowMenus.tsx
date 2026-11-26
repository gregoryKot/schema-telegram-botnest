import { PLAN_STATUSES, type PlanItem, type PlanStatus } from '../../../../../shared/src/therapy/plan/planItem';
import { PlanPickMenu } from './PlanPickMenu';
import { statusLabel, type PhaseOption } from './planModel';

/** Кнопка статуса: тап открывает меню из пяти статусов. */
export function StatusMenu({ status, busy, onPick }: { status: PlanStatus; busy: boolean; onPick: (s: PlanStatus) => void }) {
  const label = statusLabel(status);
  return (
    <PlanPickMenu
      className={`pl-status pl-status--${status}`} disabled={busy} label={`Статус: ${label}. Выбрать`}
      current={status} onPick={(s) => s !== status && onPick(s)} options={PLAN_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
    >
      {label}
    </PlanPickMenu>
  );
}

/** «В фазу…»: фазы пути и «Без фазы», текущая отмечена. */
export function PhaseMenu({ item, busy, phases, onPick }: { item: PlanItem; busy: boolean; phases: PhaseOption[]; onPick: (id: number | null) => void }) {
  return (
    <PlanPickMenu
      className="ds-btn ds-btn--sm ds-btn--secondary pl-phase-btn" disabled={busy} label="Перенести пункт в фазу"
      current={item.phaseId} onPick={onPick}
      options={[...phases.map((p) => ({ value: p.id as number | null, label: p.name })), { value: null, label: 'Без фазы' }]}
    >
      В фазу…
    </PlanPickMenu>
  );
}
