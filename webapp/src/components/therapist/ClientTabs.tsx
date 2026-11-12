import type { ClientDetail, ClientTab } from './clientSheetTypes';
import { useTabsBar } from './useTabsBar';

/** Вкладки карточки клиента; счётчик — тихий (tk-count) и только когда в данных есть число > 0. Прокрутка к
 *  активной и маска у края с невидимыми вкладками — useTabsBar (b30). */
export function ClientTabs({ detail }: { detail: ClientDetail }) {
  const { clientSchemaNotesData, clientModeNotesData, clientTasks, notesPage, clientData, clientDiary, clientTab, setClientTab } = detail;
  const tabs: [ClientTab, string, number | null][] = [
    ['overview', 'Обзор', null],
    ['concept', 'Концептуализация', null],
    ['mode_map', 'Графические карты', null],
    ['sessions', 'Сессии', notesPage.total],
    ['tasks', 'Задания', clientTasks.length],
    ['ysq', 'Схемы', clientData?.ysqHistory?.length ?? 0],
    ['client_notes', 'Записи клиента', clientSchemaNotesData.length + clientModeNotesData.length + clientDiary.length],
  ];
  const { ref, onScroll, fadeClassName } = useTabsBar(clientTab);
  return (
    <div className={`ds-tabs tk-tabs${fadeClassName}`} role="tablist" ref={ref} onScroll={onScroll}>
      {tabs.map(([t, label, count]) => (
        <button key={t} role="tab" aria-selected={clientTab === t} className={`ds-tab${clientTab === t ? ' is-active' : ''}`} onClick={() => setClientTab(t)}>
          {label}
          {count != null && count > 0 && <span className="ds-count tk-count">{count}</span>}
        </button>
      ))}
    </div>
  );
}
