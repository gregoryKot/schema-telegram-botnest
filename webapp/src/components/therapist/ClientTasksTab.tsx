import '../../styles/therapist-tabs.css';
import { pressable } from '../../utils/a11y';
import { todayStr } from '../../utils/format';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { hueStyle } from '../../lib/tone';
import type { ClientDetail } from './clientSheetTypes';
import { STATUS_BADGE, STATUS_LABEL, isOpenStatus, orderTasks, taskMeta, taskStatus, templateHue } from './taskModel';

interface Props {
  detail: ClientDetail;
}

const TEMPLATES = [
  { t: 'Схема-карточка', sub: 'Триггеры · чувства · мысли · корни · реальность · поведение' },
  { t: 'Дневник режима', sub: '5–7 эпизодов, фокус на конкретном режиме' },
  { t: 'Письмо себе', sub: 'От Здорового Взрослого к Уязвимому Ребёнку' },
  { t: 'Imagery rescripting', sub: 'Аудио-практика, 12 минут' },
];

export function ClientTasksTab({ detail }: Props) {
  const { clientTasks, setShowAssign } = detail;
  const today = todayStr();
  // Активное — то, что ещё ждёт клиента; «не вышло» закрыто и не считается.
  const activeCount = clientTasks.filter(t => isOpenStatus(taskStatus(t, today))).length;
  const ordered = orderTasks(clientTasks, today);

  return (
    <div className="ds-page tb-page tb-tasks">
      <div className="tb-col">
        <div className="tb-big">
          <span className="ds-num tb-big-num">{activeCount}</span>
          <span className="tb-big-cap">
            {pluralRu(activeCount, 'активное домашнее задание', 'активных домашних задания', 'активных домашних заданий')}
          </span>
        </div>

        {clientTasks.length === 0 ? (
          <div>
            <div className="tb-empty">
              Нет назначенных заданий. Домашние практики помогают закрепить работу между сессиями.
            </div>
            <button onClick={() => setShowAssign(true)} className="ds-btn tb-mt16">Назначить первое задание</button>
          </div>
        ) : (
          <div className="tb-task-list">
            {ordered.map(t => {
              const status = taskStatus(t, today);
              const done = status === 'done';
              const meta = taskMeta(t, status);
              return (
                <div key={t.id} className={`ds-card ds-card--row tb-task${done ? ' is-done' : ''}`}>
                  <span className={`tb-check${done ? ' is-done' : ''}`} aria-hidden="true">{done ? '✓' : ''}</span>
                  <div className="tb-task-main">
                    <div className="tb-task-text">{resolveTaskDisplayText(t, 'full')}</div>
                    <div className="tb-meta">{meta}</div>
                  </div>
                  <span className={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="tb-col tb-col--tight">
        <div className="ds-h3">Назначить из шаблона</div>
        {TEMPLATES.map(card => (
          <div key={card.t} className="tb-tpl tone-tint" style={hueStyle(templateHue(card.t))} {...pressable(() => setShowAssign(true))}>
            <div className="tb-tpl-head"><span>{card.t}</span><span aria-hidden="true">+</span></div>
            <div className="tb-tpl-sub">{card.sub}</div>
          </div>
        ))}
        <button onClick={() => setShowAssign(true)} className="ds-btn ds-btn--secondary">+ Назначить</button>
      </div>
    </div>
  );
}
