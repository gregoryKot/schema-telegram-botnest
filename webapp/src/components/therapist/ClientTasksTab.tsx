import { useState } from 'react';
import '../../styles/client-practice.css'; // строка задания .cp-task и task-row.css — общие с клиентом
import '../../styles/therapist-tabs.css';
import { api, type UserTask } from '../../api';
import { HistoryConfirmDialog } from '../HistoryConfirmDialog';
import { MMIcon } from '../modeMapIcons';
import { todayStr } from '../../utils/format';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { ASSIGN_LEAD_OFFLINE } from '../../../../shared/src/tasks/assignCopy';
import { isVirtualId } from '../../../../shared/src/utils/sameId';
import { therapistClosesTask, useTherapistTaskActions } from '../../../../shared/src/therapy/useTherapistTaskActions';
import type { ClientDetail } from './clientSheetTypes';
import { isOpenStatus, orderTasks, taskMeta, taskStatus } from './taskModel';
import { TaskArt } from './TabTitle';
import { PaperEmpty } from '../art/PaperEmpty';
import { Check } from '../art/PaperArtSigns';
import { useIsMobile } from '../useIsMobile';
import { TaskStatusBadge } from '../TaskStatusBadge';
import type { AssignPreset } from './assignTemplates';
import { AssignTemplateTiles } from './AssignTemplateTiles';
import { TechniqueJournalBlock } from './TechniqueJournalBlock';

interface Props {
  detail: ClientDetail;
  /** Открыть лист назначения; шаблон передаёт тип и текст. */
  onAssign: (preset?: AssignPreset) => void;
  onTasksChanged?: () => void;
  /** Журнал техник пуст — переход на «Концептуализацию»; `takeJournalFocus` — см. TechniqueJournalBlock. */
  onOpenConcept?: () => void;
  takeJournalFocus?: () => boolean;
}

// Задания — то, что клиент делает между сессиями; ниже «На сессиях» — журнал техник (TechniqueJournalBlock).
export function ClientTasksTab({ detail, onAssign, onTasksChanged, onOpenConcept, takeJournalFocus }: Props) {
  const { clientTasks, setClientTasks, selectedClient } = detail;
  const today = todayStr();
  const actions = useTherapistTaskActions(api, setClientTasks, onTasksChanged); // успех перечитывает доску «Задания»
  // Одна залитая кнопка: на компьютере — «+ Задание» в шапке (ClientHeader), на телефоне её там нет.
  const phone = useIsMobile();
  const [confirmDelete, setConfirmDelete] = useState<UserTask | null>(null);
  // Офлайн-клиенту — только «Своё задание»: упражнения приложения ему не подходят (shared/tasks/assignCopy).
  const offline = !!selectedClient && isVirtualId(selectedClient.telegramId);
  // Активное — то, что ещё ждёт клиента; «не вышло» закрыто и не считается.
  const activeCount = clientTasks.filter(t => isOpenStatus(taskStatus(t, today))).length;
  const ordered = orderTasks(clientTasks, today);

  return (
    <div className="ds-page tb-tasks">
      <div className="tb-col">
        <div className="tb-big">
          <span className="ds-num tb-big-num">{activeCount}</span>
          <span className="tb-big-cap">
            {pluralRu(activeCount, 'активное домашнее задание', 'активных домашних задания', 'активных домашних заданий')}
          </span>
        </div>

        {clientTasks.length === 0 ? (
          <div>
            <PaperEmpty art={Check}>Нет назначенных заданий. Домашние практики помогают закрепить работу между сессиями.</PaperEmpty>
            <button onClick={() => onAssign()} className={phone ? 'ds-btn tb-mt16' : 'ds-btn ds-btn--secondary tb-mt16'}>Назначить первое задание</button>
          </div>
        ) : (
          <div className="cp-task-list tb-task-list">
            {ordered.map(t => {
              const status = taskStatus(t, today);
              // Раскладка — общая строка задания (task-row.css): знак, название со сроком и статусом, действия в слоте
              // .cp-task-acts; в узком списке действия уходят второй строкой (ClientTasksTab.layout.test.tsx).
              return (
                <div key={t.id} className={`ds-card ds-card--row cp-task tb-task${status === 'done' ? ' cp-task--done' : ''}`}>
                  <TaskArt task={t} />
                  <div className="cp-task-body">
                    <div className="cp-task-title tb-task-text">{resolveTaskDisplayText(t, 'full')}</div>
                    <div className="tb-task-meta">
                      <span className="tb-meta">{taskMeta(t, status)}</span>
                      <TaskStatusBadge status={status} paper />
                    </div>
                  </div>
                  <div className="cp-task-acts">
                    {therapistClosesTask(t) && (
                      <button className="ds-btn ds-btn--sm ds-btn--secondary" disabled={actions.busyId === t.id} aria-busy={actions.busyId === t.id || undefined} onClick={() => void actions.markDone(t.id)}>
                        Выполнено
                      </button>
                    )}
                    <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label="Удалить задание" disabled={actions.busyId === t.id} onClick={() => setConfirmDelete(t)}><MMIcon name="trash" size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {actions.error && !confirmDelete && <div className="tb-error" role="alert">{actions.error}</div>}
        <TechniqueJournalBlock detail={detail} onOpenConcept={onOpenConcept} takeFocus={takeJournalFocus} />
      </div>

      <div className="tb-col tb-col--tight">
        {offline ? <div className="tb-meta">{ASSIGN_LEAD_OFFLINE}</div> : (
          <>
            <div className="ds-h3">Назначить из шаблона</div>
            <AssignTemplateTiles onAssign={onAssign} />
          </>
        )}
        <button onClick={() => onAssign()} className="ds-btn ds-btn--secondary">+ Назначить</button>
      </div>

      {confirmDelete && (
        <HistoryConfirmDialog
          title="Удалить задание?"
          message={`«${resolveTaskDisplayText(confirmDelete, 'full')}» ${offline ? 'пропадёт из карточки' : 'пропадёт у клиента и из карточки'}. Вернуть его нельзя.`}
          confirmLabel="Удалить"
          busyLabel="Удаляю…"
          busy={actions.busyId === confirmDelete.id}
          error={actions.error}
          run={() => actions.remove(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
