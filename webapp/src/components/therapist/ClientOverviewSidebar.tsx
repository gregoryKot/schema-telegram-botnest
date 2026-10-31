import type { TherapyClientSummary } from '../../api';
import { indexLevel, hueStyle } from '../../lib/tone';
import { NextSessionCard, StartDateCard } from './ClientSessionInfoCards';
import { MeetingDaysCard } from './MeetingDaysCard';
import { indexSparkBars, needBars, weekDelta } from './clientOverviewModel';
import type { ClientDetail } from './clientSheetTypes';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

export function ClientOverviewSidebar({ selectedClient, detail }: Props) {
  const { clientHistory, setClientTab, exportCopied, handleExport } = detail;
  const todayIndex = selectedClient.todayIndex;
  const bars = clientHistory.length >= 3 ? indexSparkBars(clientHistory) : [];
  const delta = todayIndex != null ? weekDelta(clientHistory, todayIndex) : null;
  const needs = needBars(clientHistory[0]?.ratings);
  // «+ Задание» и «+ Заметка» — в шапке карточки (на телефоне — панель над
  // навигацией); здесь только действия, которых в шапке нет.
  const actions: [string, () => void][] = [
    ['Запросить YSQ', () => setClientTab('ysq')],
    [`Экспорт концепта${exportCopied ? ' ✓' : ''}`, handleExport],
  ];

  return (
    <aside className="tk-side">
      <NextSessionCard selectedClient={selectedClient} detail={detail} />
      <MeetingDaysCard key={String(selectedClient.telegramId)} selectedClient={selectedClient} detail={detail} />
      <StartDateCard selectedClient={selectedClient} detail={detail} />

      {todayIndex != null && (
        <div className="ds-card">
          <div className="tk-card-label">Индекс сегодня</div>
          <div className="tk-index">
            <span className={`ds-num ds-idx-${indexLevel(todayIndex)}`}>{todayIndex.toFixed(1)}</span>
            {delta != null && (
              <span className={`tk-delta ${delta >= 0 ? 'ds-idx-ok' : 'ds-idx-err'}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} к нед.</span>
            )}
          </div>
          {bars.length > 0 && (
            <>
              <div className="ds-spark" aria-hidden>
                {bars.map((b, i) => (
                  <i key={i} className={b.level === 'none' ? undefined : `is-${b.level}`} style={{ height: b.heightPct > 0 ? `${b.heightPct}%` : undefined }} />
                ))}
              </div>
              <div className="tk-hint">{bars.length} дн.</div>
            </>
          )}
        </div>
      )}

      {needs.length > 0 && (
        <div className="ds-card">
          <div className="tk-card-label">Потребности сегодня</div>
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

      <div className="ds-card tk-actions-grid">
        {actions.map(([label, run]) => (
          <button key={label} className="tk-action" onClick={run}>{label}</button>
        ))}
      </div>
    </aside>
  );
}
