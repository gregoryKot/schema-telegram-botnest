import type { ClientDetail, ClientTab } from './clientSheetTypes';

/** Вкладки карточки клиента; счётчик показывается только когда в данных есть число > 0. */
export function ClientTabs({ detail }: { detail: ClientDetail }) {
  const { clientSchemaNotesData, clientModeNotesData, clientTasks, notes, clientData, clientDiary, clientTab, setClientTab } = detail;
  const tabs: [ClientTab, string, number | null][] = [
    ['overview', 'Обзор', null],
    ['concept', 'Концептуализация', null],
    ['mode_map', 'Карта режимов', null],
    ['sessions', 'Сессии', notes.length],
    ['tasks', 'Задания', clientTasks.length],
    ['ysq', 'Схемы', clientData?.ysqHistory?.length ?? 0],
    ['client_notes', 'Записи клиента', clientSchemaNotesData.length + clientModeNotesData.length + clientDiary.length],
  ];
  return (
    <div className="ds-tabs" role="tablist">
      {tabs.map(([t, label, count]) => (
        <button key={t} role="tab" aria-selected={clientTab === t} className={`ds-tab${clientTab === t ? ' is-active' : ''}`} onClick={() => setClientTab(t)}>
          {label}
          {count != null && count > 0 && <span className="ds-count">{count}</span>}
        </button>
      ))}
    </div>
  );
}
