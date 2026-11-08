import type { TherapyClientSummary } from '../../api';
import { hueStyle } from '../../lib/tone';
import { ClientIndexCard } from './ClientIndexCard';
import { NextSessionCard, StartDateCard } from './ClientSessionInfoCards';
import { OfflineInviteCard } from './OfflineInviteCard';
import { SignHead } from './SignArt';
import { MeetingDaysCard } from './MeetingDaysCard';
import { needBars } from './clientOverviewModel';
import type { ClientDetail } from './clientSheetTypes';
import { CONCEPT_EXPORT_EMPTY } from '../../../../shared/src/therapy/conceptExport';
import { isVirtualClient } from '../../../../shared/src/therapy/clientSheetHelpers';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

// Сайдбар «Обзора» (#906): карточки-строки ds-card--row с подписью ds-label;
// акцентная заливка — только у «Следующей сессии» (одна CTA на экран). Действия
// внизу — строка кнопок без карточки: рамка вокруг рамочных кнопок — шум.
export function ClientOverviewSidebar({ selectedClient, detail }: Props) {
  const { clientHistory, setClientTab, exportCopied, exportEmpty, handleExport } = detail;
  const todayIndex = selectedClient.todayIndex;
  const needs = needBars(clientHistory[0]?.ratings);
  // «+ Задание» и «+ Заметка» — в шапке (ноутбук) или первой строкой «Обзора» (телефон,
  // ClientQuickActions); здесь только остальные. Пустой концепт — экспорт недоступен с подсказкой;
  // офлайн-клиенту YSQ не запросить (нет Telegram) — кнопки нет, а не путь в «YSQ недоступен».
  const btn = 'ds-btn ds-btn--secondary ds-btn--sm';

  return (
    <aside className="tk-side">
      <NextSessionCard selectedClient={selectedClient} detail={detail} />
      <MeetingDaysCard key={String(selectedClient.telegramId)} selectedClient={selectedClient} detail={detail} />
      <StartDateCard selectedClient={selectedClient} detail={detail} />
      {isVirtualClient(selectedClient) && <OfflineInviteCard selectedClient={selectedClient} />}

      {todayIndex != null && <ClientIndexCard todayIndex={todayIndex} history={clientHistory} />}
      {needs.length > 0 && (
        <div className="ds-card ds-card--row">
          <SignHead kind="strokes" className="ds-label">Потребности сегодня</SignHead>
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
        {!isVirtualClient(selectedClient) && <button className={btn} onClick={() => setClientTab('ysq')}>Запросить тест на схемы</button>}
        <button className={btn} onClick={handleExport} disabled={exportEmpty}>Экспорт концепта{exportCopied ? ' ✓' : ''}</button>
      </div>
      {exportEmpty && <p className="ds-sub">{CONCEPT_EXPORT_EMPTY}</p>}
    </aside>
  );
}
