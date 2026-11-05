import { useEffect, useRef } from 'react';
import { scrollIntoViewSafe } from '../../../../shared/src/utils/scrollIntoView';
import type { ClientDetail, ClientTab } from './clientSheetTypes';

/** Вкладки карточки клиента; счётчик показывается только когда в данных есть число > 0. */
export function ClientTabs({ detail }: { detail: ClientDetail }) {
  const { clientSchemaNotesData, clientModeNotesData, clientTasks, notesPage, clientData, clientDiary, clientTab, setClientTab } = detail;
  const tabs: [ClientTab, string, number | null][] = [
    ['overview', 'Обзор', null],
    ['concept', 'Концептуализация', null],
    ['mode_map', 'Карта режимов', null],
    ['sessions', 'Сессии', notesPage.total],
    ['tasks', 'Задания', clientTasks.length],
    ['ysq', 'Схемы', clientData?.ysqHistory?.length ?? 0],
    ['client_notes', 'Записи клиента', clientSchemaNotesData.length + clientModeNotesData.length + clientDiary.length],
  ];
  // Переход кнопкой («+ Заметка», «Запросить YSQ») меняет вкладку мимо полосы:
  // активная уезжала за край и не была видна (QA 2026-11, T-11).
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollIntoViewSafe(bar.current?.querySelector('[aria-selected="true"]'), { block: 'nearest', inline: 'center' });
  }, [clientTab]);
  return (
    <div className="ds-tabs" role="tablist" ref={bar}>
      {tabs.map(([t, label, count]) => (
        <button key={t} role="tab" aria-selected={clientTab === t} className={`ds-tab${clientTab === t ? ' is-active' : ''}`} onClick={() => setClientTab(t)}>
          {label}
          {count != null && count > 0 && <span className="ds-count">{count}</span>}
        </button>
      ))}
    </div>
  );
}
