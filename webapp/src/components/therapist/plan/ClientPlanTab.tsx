import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../styles/therapist-tabs.css';
import type { TherapyClientSummary } from '../../../api';
import type { TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import { useGuide } from '../../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { PlanItem, PlanRubric, PlanSource } from '../../../../../shared/src/therapy/plan/planItem';
import { useTr } from '../../../utils/addressForm';
import { HistoryConfirmDialog } from '../../HistoryConfirmDialog';
import { Skeleton } from '../../Skeleton';
import { TaskCreateSheet } from '../../TaskCreateSheet';
import { PaperEmpty } from '../../art/PaperEmpty';
import type { ClientDetail } from '../clientSheetTypes';
import { useConceptGuide } from '../guide/useConceptGuide';
import { PlanGoals } from './PlanGoals';
import { PlanItemForm } from './PlanItemForm';
import { PlanItemRow } from './PlanItemRow';
import { groupPlan, isEmptyPlan } from './planModel';
import { planSourceTitle } from './planSource';
import { usePlanItems } from './usePlanItems';

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
 * Вкладка «План работы» карточки клиента (#1337): сверху цель терапии (поле концептуализации), ниже пункты по
 * рубрикам справочника. Пункт со ссылкой на статью открывает её тем же листом, что схема случая
 * (useConceptGuide); «Дать заданием» — обычный лист «Новое задание» с текстом пункта, созданное задание
 * запоминается в пункте. Монтируется с ключом клиента: состояние плана — одного клиента.
 */
export function ClientPlanTab({ selectedClient, detail, onTasksChanged }: Props) {
  const tr = useTr();
  const navigate = useNavigate();
  const plan = usePlanItems(selectedClient.telegramId);
  const guide = useConceptGuide();
  const texts = useGuide();
  const [adding, setAdding] = useState(false);
  const [rubric, setRubric] = useState<PlanRubric>('custom');
  const [assignItem, setAssignItem] = useState<PlanItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlanItem | null>(null);
  const { items } = plan;

  const openSource = ({ kind, id }: PlanSource) => {
    if (kind === 'mode') guide.actions.onOpenMode(id);
    else if (kind === 'schema') guide.actions.onOpenSchema(id);
    else guide.actions.onOpenTechnique(id as TechniqueId);
  };
  const addButton = <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setAdding(true)}>+ Свой пункт</button>;

  return (
    <div className="ds-page tb-page--narrow pl-plan">
      <PlanGoals detail={detail} />

      {plan.failed ? (
        <div className="pl-fail" role="alert">
          <span className="tb-error">План не загрузился.</span>
          <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={plan.reload}>Повторить</button>
        </div>
      ) : items === null ? <PlanSkeleton /> : (
        <>
          {groupPlan(items).map((g) => (
            <section key={g.rubric} className="pl-group">
              <h3 className="ds-label">{g.label}</h3>
              <div className="pp-leaf pl-list">
                {g.items.map((item) => (
                  <PlanItemRow
                    key={item.id} item={item} busy={plan.busyId !== null}
                    sourceTitle={planSourceTitle(texts, tr, item.source)}
                    onCycleStatus={() => void plan.cycleStatus(item)}
                    onOpenSource={() => item.source && openSource(item.source)}
                    onAssign={() => setAssignItem(item)}
                    linkPending={item.taskId == null && plan.pendingLinks[item.id] != null}
                    onRetryLink={() => void plan.retryLink(item.id)}
                    onSaveText={(text) => plan.saveText(item.id, text)}
                    onDelete={() => { plan.clearError(); setConfirmDelete(item); }}
                  />
                ))}
              </div>
            </section>
          ))}

          {adding ? (
            <div className="pp-leaf pl-add">
              <PlanItemForm
                rubric={rubric} onRubric={setRubric} busy={plan.busyId === 'new'}
                onSave={(text) => plan.add(rubric, text)} onClose={() => setAdding(false)}
              />
            </div>
          ) : isEmptyPlan(items) ? (
            <div>
              <PaperEmpty title="В плане пока пусто">
                {tr(
                  'Запиши сюда, что планируешь делать с клиентом: свои пункты или идеи из справочника — «Как работать», «На сессии», «Между сессиями».',
                  'Запишите сюда, что планируете делать с клиентом: свои пункты или идеи из справочника — «Как работать», «На сессии», «Между сессиями».',
                )}
              </PaperEmpty>
              <div className="tb-actions tb-mt16">
                <button type="button" className="ds-btn" onClick={() => navigate('/cabinet/guide')}>Открыть справочник</button>
                {addButton}
              </div>
            </div>
          ) : <div>{addButton}</div>}
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
