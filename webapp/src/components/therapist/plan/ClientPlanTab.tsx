import { useState } from 'react';
import '../../../styles/therapist-tabs.css';
import type { TherapyClientSummary } from '../../../api';
import type { TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import { useGuide } from '../../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';
import { useTr } from '../../../utils/addressForm';
import { HistoryConfirmDialog } from '../../HistoryConfirmDialog';
import { Skeleton } from '../../Skeleton';
import { TaskCreateSheet } from '../../TaskCreateSheet';
import type { ClientDetail } from '../clientSheetTypes';
import { useConceptGuide } from '../guide/useConceptGuide';
import { guideMarkClient } from '../guide/marks/useClientGuideMarks';
import { PlanGoals } from './PlanGoals';
import { PlanChannels } from './PlanChannels';
import { PlanLayoutSwitch, type PlanLayout } from './PlanLayoutSwitch';
import { makeRenderPlanRow } from './planRows';
import type { PlanSourceLink } from './planSource';
import { usePlanItems } from './usePlanItems';
import { PathLayout } from './path/PathLayout';
import { usePath } from './path/usePath';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
  /** Задание создано из пункта — доска «Задания» перечитывается. */
  onTasksChanged?: () => void;
}

/** Силуэт плана: подпись рубрики и лист со строками «статус — текст». */
function PlanSkeleton() {
  return (
    <div className="pl-group" aria-hidden>
      <Skeleton width={110} height={11} />
      <div className="pp-leaf pl-list">
        {[72, 58, 64].map((w) => <div key={w} className="pl-item"><Skeleton width={96} height={36} /><Skeleton width={`${w}%`} height={16} /></div>)}
      </div>
    </div>
  );
}

/**
 * Вкладка «План работы» карточки клиента (#1337): сверху цель терапии (поле концептуализации), ниже пункты —
 * по рубрикам справочника или по фазам пути клиента (#1522); есть путь — по умолчанию по фазам. Пункт со ссылкой на статью открывает её тем же листом, что схема случая
 * (useConceptGuide); «Дать заданием» — обычный лист «Новое задание» с текстом пункта, созданное задание
 * запоминается в пункте. Монтируется с ключом клиента: состояние плана — одного клиента.
 */
export function ClientPlanTab({ selectedClient, detail, onTasksChanged }: Props) {
  const tr = useTr();
  const plan = usePlanItems(selectedClient.telegramId);
  const path = usePath(selectedClient.telegramId);
  const guide = useConceptGuide({ plan: { clientId: selectedClient.telegramId, onAdded: plan.reload }, client: guideMarkClient(selectedClient) });
  const texts = useGuide();
  const [layout, setLayout] = useState<PlanLayout | null>(null);
  const [assignItem, setAssignItem] = useState<PlanItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlanItem | null>(null);
  const { items } = plan;

  const openSource = ({ kind, id }: NonNullable<PlanSourceLink['open']>) => {
    if (kind === 'mode') guide.actions.onOpenMode(id);
    else if (kind === 'schema') guide.actions.onOpenSchema(id);
    else guide.actions.onOpenTechnique(id as TechniqueId);
  };
  const renderRow = makeRenderPlanRow({ plan, texts, tr, openSource, onAssign: setAssignItem, onDelete: setConfirmDelete });
  // Раскладку выбирают руками; до выбора — по фазам, если путь есть. Ждём путь, чтобы раскладка не прыгала.
  const shown: PlanLayout = layout ?? (path.path ? 'phases' : 'channels');

  return (
    <div className="ds-page tb-page--narrow">
      <PlanGoals detail={detail} />

      {plan.failed ? (
        <div className="pl-fail" role="alert">
          <span className="tb-error">План не загрузился.</span>
          <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={plan.reload}>Повторить</button>
        </div>
      ) : items === null || (path.path === undefined && !path.failed && layout === null) ? <PlanSkeleton /> : (
        <>
          <PlanLayoutSwitch value={shown} onChange={setLayout} />
          {shown === 'phases'
            ? <PathLayout path={path} plan={plan} items={items} renderRow={renderRow} />
            : <PlanChannels items={items} plan={plan} renderRow={renderRow} />}
          {plan.error && !confirmDelete && <div className="tb-error" role="alert">{plan.error}</div>}
        </>
      )}

      {guide.sheets}

      {assignItem && (
        <TaskCreateSheet
          clientId={selectedClient.telegramId} clientName={selectedClient.name ?? undefined}
          defaultType="custom" defaultText={assignItem.text}
          onCreated={(task) => { void plan.linkTask(assignItem.id, task.id); detail.onTaskAssigned(); onTasksChanged?.(); }}
          onClose={() => setAssignItem(null)}
        />
      )}

      {confirmDelete && (
        <HistoryConfirmDialog
          title="Удалить пункт?"
          message={`«${confirmDelete.text}» пропадёт из плана. Вернуть его нельзя.${confirmDelete.taskId != null ? ' Выданное задание останется.' : ''}`}
          confirmLabel="Удалить" busyLabel="Удаляю…"
          busy={plan.busyId === confirmDelete.id} error={plan.error}
          run={() => plan.remove(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
