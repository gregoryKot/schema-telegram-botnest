import type { ClientDetail, ClientTab } from './clientSheetTypes';
import { CLIENT_TAB_LABELS } from './clientTabLabels';
import { useTabsBar } from './useTabsBar';

/** Вкладки карточки клиента; счётчик — тихий (tk-count) и только когда в данных есть число > 0. Прокрутка к
 *  активной и маска у края с невидимыми вкладками — useTabsBar (b30). */
export function ClientTabs({ detail }: { detail: ClientDetail }) {
  const { clientSchemaNotesData, clientModeNotesData, clientTasks, notesPage, clientData, clientDiary, clientTab, setClientTab } = detail;
  const counts: Partial<Record<ClientTab, number>> = {
    sessions: notesPage.total, tasks: clientTasks.length, ysq: clientData?.ysqHistory?.length ?? 0,
    client_notes: clientSchemaNotesData.length + clientModeNotesData.length + clientDiary.length,
  };
  const { ref, onScroll, fadeClassName } = useTabsBar(clientTab);
  return (
    <div className={`ds-tabs tk-tabs${fadeClassName}`} role="tablist" ref={ref} onScroll={onScroll}>
      {CLIENT_TAB_LABELS.map(([t, label]) => (
        <button key={t} role="tab" aria-selected={clientTab === t} className={`ds-tab${clientTab === t ? ' is-active' : ''}`} onClick={() => setClientTab(t)}>
          {label}
          {(counts[t] ?? 0) > 0 && <span className="ds-count tk-count">{counts[t]}</span>}
        </button>
      ))}
    </div>
  );
}
