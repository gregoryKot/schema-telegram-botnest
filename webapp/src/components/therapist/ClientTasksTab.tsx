import { useState } from 'react';
import '../../styles/therapist-tabs.css';
import { api, type UserTask } from '../../api';
import { pressable } from '../../utils/a11y';
import { HistoryConfirmDialog } from '../HistoryConfirmDialog';
import { MMIcon } from '../modeMapIcons';
import { todayStr } from '../../utils/format';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { ASSIGN_LEAD_OFFLINE } from '../../../../shared/src/tasks/assignCopy';
import { isVirtualId } from '../../../../shared/src/utils/sameId';
import { therapistClosesTask, useTherapistTaskActions } from '../../../../shared/src/therapy/useTherapistTaskActions';
import { hueStyle } from '../../lib/tone';
import type { ClientDetail } from './clientSheetTypes';
import { isOpenStatus, orderTasks, taskMeta, taskStatus, templateHue } from './taskModel';
import { TabArt, TaskArt } from './TabTitle';
import { PaperEmpty } from '../art/PaperEmpty';
import { TaskStatusBadge } from '../TaskStatusBadge';
import { ASSIGN_TEMPLATES, type AssignPreset } from './assignTemplates';

interface Props {
  detail: ClientDetail;
  /** Открыть лист назначения; шаблон передаёт тип и текст. */
  onAssign: (preset?: AssignPreset) => void;
  onTasksChanged?: () => void;
}

export function ClientTasksTab({ detail, onAssign, onTasksChanged }: Props) {
  const { clientTasks, setClientTasks, selectedClient } = detail;
  const today = todayStr();
  // Удаление и отметка у офлайн-клиента — общая с мини-аппом механика; успех перечитывает доску «Задания».
  const actions = useTherapistTaskActions(api, setClientTasks, onTasksChanged);
  const [confirmDelete, setConfirmDelete] = useState<UserTask | null>(null);
  // Офлайн-клиенту — только «Своё задание»: упражнения приложения ему не подходят (shared/tasks/assignCopy).
  const offline = !!selectedClient && isVirtualId(selectedClient.telegramId);
  // Активное — то, что ещё ждёт клиента; «не вышло» закрыто и не считается.
  const activeCount = clientTasks.filter(t => isOpenStatus(taskStatus(t, today))).length;
  const ordered = orderTasks(clientTasks, today);

  return (
    <div className="ds-page tb-tasks">
      <div className="tb-col">
        <div className="tb-big"><TabArt motif="check" />
          <span className="ds-num tb-big-num">{activeCount}</span>
          <span className="tb-big-cap">
            {pluralRu(activeCount, 'активное домашнее задание', 'активных домашних задания', 'активных домашних заданий')}
          </span>
        </div>

        {clientTasks.length === 0 ? (
          <div>
            <PaperEmpty>Нет назначенных заданий. Домашние практики помогают закрепить работу между сессиями.</PaperEmpty>
            <button onClick={() => onAssign()} className="ds-btn tb-mt16">Назначить первое задание</button>
          </div>
        ) : (
          <div className="tb-task-list">
            {ordered.map(t => {
              const status = taskStatus(t, today);
              const done = status === 'done';
              return (
                <div key={t.id} className={`ds-card ds-card--row tb-task${done ? ' is-done' : ''}`}>
                  <TaskArt task={t} /><div className="tb-task-main">
                    <div className="tb-task-text">{resolveTaskDisplayText(t, 'full')}</div>
                    <div className="tb-meta">{taskMeta(t, status)}</div>
                  </div>
                  <TaskStatusBadge status={status} />
                  {therapistClosesTask(t) && (
                    <button className="ds-btn ds-btn--sm ds-btn--secondary" disabled={actions.busyId === t.id} onClick={() => void actions.markDone(t.id)}>
                      Выполнено
                    </button>
                  )}
                  <button type="button" className="ds-btn ds-btn--icon" aria-label="Удалить задание" disabled={actions.busyId === t.id} onClick={() => setConfirmDelete(t)}><MMIcon name="trash" size={16} /></button>
                </div>
              );
            })}
          </div>
        )}
        {actions.error && !confirmDelete && <div className="tb-error" role="alert">{actions.error}</div>}
      </div>

      <div className="tb-col tb-col--tight">
        {offline ? (
          <div className="tb-meta">{ASSIGN_LEAD_OFFLINE}</div>
        ) : (
          <>
            <div className="ds-h3">Назначить из шаблона</div>
            {ASSIGN_TEMPLATES.map(card => (
              <div key={card.title} className="tb-tpl tone-tint" style={hueStyle(templateHue(card.title))} {...pressable(() => onAssign(card.preset))}>
                <div className="tb-tpl-head"><span>{card.title}</span><span aria-hidden="true">+</span></div>
                <div className="tb-tpl-sub">{card.sub}</div>
              </div>
            ))}
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
