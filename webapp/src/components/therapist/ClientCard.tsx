import { pressable } from '../../utils/a11y';
import type { TherapyClientSummary } from '../../api';
import { rosterActivity, rosterMeeting, rosterSchemas } from './rosterModel';
import { clientDisplayName } from '../../../../shared/src/therapy/clientInitials';

interface Props {
  client: TherapyClientSummary;
  today: string;
  onOpen: (client: TherapyClientSummary) => void;
  /** «выполнено с прошлой встречи: N» — тихим текстом рядом с активностью; нет выполненных — нет отметки. */
  tasksMark?: string | null;
}

// Строка «Клиентов» (К31) — ритм оглавления: на телефоне имя и встреча, под ними тихая строка
// «активность · схемы»; на компьютере те же ячейки — колонки таблицы под шапкой ClientRosterHead.
export function ClientCard({ client, today, onOpen, tasksMark }: Props) {
  const schemas = rosterSchemas(client.schemaIds);
  return (
    <div className="ds-list-row ds-list-row--hover tc-row" {...pressable(() => onOpen(client))}>
      <div className="tc-name">{clientDisplayName(client)}</div>
      <div className="tc-when">{rosterMeeting(client, today)}</div>
      <div className="tc-sub">
        <span className="tc-activity">
          {rosterActivity(client)}
          {tasksMark && <span className="tc-tasks">{tasksMark}</span>}
        </span>
        {schemas && <span className="tc-schemas">{schemas}</span>}
      </div>
      <span className="tc-go" aria-hidden="true">→</span>
    </div>
  );
}

/** Шапка колонок таблицы клиентов — только на компьютере (на телефоне скрыта CSS). */
export function ClientRosterHead() {
  return (
    <div className="tc-head" aria-hidden="true">
      <span className="ds-label">Клиент</span>
      <span className="ds-label">Активность</span>
      <span className="ds-label">Встреча</span>
      <span className="ds-label">Схемы</span>
    </div>
  );
}
