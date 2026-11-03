import type { TherapyClientSummary } from '../../api';
import { hueStyle } from '../../lib/tone';
import { ClientIndexCard } from './ClientIndexCard';
import { NextSessionCard, StartDateCard } from './ClientSessionInfoCards';
import { MeetingDaysCard } from './MeetingDaysCard';
import { needBars } from './clientOverviewModel';
import type { ClientDetail } from './clientSheetTypes';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

// Сайдбар «Обзора» (#906): карточки-строки ds-card--row с подписью ds-label;
// акцентная заливка — только у «Следующей сессии» (одна CTA на экран). Действия
// внизу — строка кнопок без карточки: рамка вокруг рамочных кнопок — шум.
export function ClientOverviewSidebar({ selectedClient, detail }: Props) {
  const { clientHistory, setClientTab, exportCopied, handleExport } = detail;
  const todayIndex = selectedClient.todayIndex;
  const needs = needBars(clientHistory[0]?.ratings);
  // «+ Задание» и «+ Заметка» — в шапке (ноутбук) или первой строкой «Обзора»
  // (телефон, ClientQuickActions); здесь только действия, которых там нет.
  const actions: [string, () => void][] = [
    ['Запросить YSQ', () => setClientTab('ysq')],
    [`Экспорт концепта${exportCopied ? ' ✓' : ''}`, handleExport],
  ];

  return (
    <aside className="tk-side">
      <NextSessionCard selectedClient={selectedClient} detail={detail} />
      <MeetingDaysCard key={String(selectedClient.telegramId)} selectedClient={selectedClient} detail={detail} />
      <StartDateCard selectedClient={selectedClient} detail={detail} />

      {todayIndex != null && <ClientIndexCard todayIndex={todayIndex} history={clientHistory} />}

      {needs.length > 0 && (
        <div className="ds-card ds-card--row">
          <h2 className="ds-label">Потребности сегодня</h2>
          <div className="tk-needs">
            {needs.map(n => (
              <div key={n.id} className="tk-need">
                <span>{n.label}</span>
                <div className="tk-need-bar"><div className="tone-fill" style={{ ...hueStyle(n.hue), width: `${n.widthPct}%` }} /></div>
                <b className={n.low ? 'is-low' : undefined}>{n.value}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tk-quick">
        {actions.map(([label, run]) => (
          <button key={label} className="ds-btn ds-btn--secondary ds-btn--sm" onClick={run}>{label}</button>
        ))}
      </div>
    </aside>
  );
}
