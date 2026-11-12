import type { CSSProperties } from 'react';
import type { TherapyClientSummary } from '../../api';
import { NextSessionCard, StartDateCard } from './ClientSessionInfoCards';
import { OfflineInviteCard } from './OfflineInviteCard';
import { MeetingDaysCard } from './MeetingDaysCard';
import { ClientTrackerSheet } from './ClientTrackerSheet';
import { needBars } from './clientOverviewModel';
import type { ClientDetail } from './clientSheetTypes';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { CONCEPT_EXPORT_EMPTY } from '../../../../shared/src/therapy/conceptExport';
import { isVirtualClient } from '../../../../shared/src/therapy/clientSheetHelpers';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

// Сайдбар «Обзора» (#906; живая бумага — b30). «Встречи» — один лист неба (ENTITY_LOOK.therapist, Talk один раз)
// с тремя строками вместо тёмной плитки и трёх белых карточек; трекер — лист соломы (ClientTrackerSheet).
// Действия внизу — строка кнопок без карточки: рамка вокруг рамочных кнопок — шум.
export function ClientOverviewSidebar({ selectedClient, detail }: Props) {
  const { clientHistory, setClientTab, exportCopied, exportEmpty, handleExport } = detail;
  // «+ Задание» и «+ Заметка» — в шапке (ноутбук) или первой строкой «Обзора» (телефон,
  // ClientQuickActions); здесь только остальные. Пустой концепт — экспорт недоступен с подсказкой;
  // офлайн-клиенту YSQ не запросить (нет Telegram) — кнопки нет, а не путь в «YSQ недоступен».
  const btn = 'ds-btn ds-btn--secondary ds-btn--sm';

  return (
    <aside className="tk-side">
      <section className="pp-paper tk-meet" style={{ '--h': ENTITY_LOOK.therapist.hue } as CSSProperties}>
        <NextSessionCard selectedClient={selectedClient} detail={detail} />
        <MeetingDaysCard key={String(selectedClient.telegramId)} selectedClient={selectedClient} detail={detail} />
        <StartDateCard selectedClient={selectedClient} detail={detail} />
      </section>
      {isVirtualClient(selectedClient) && <OfflineInviteCard selectedClient={selectedClient} />}
      <ClientTrackerSheet todayIndex={selectedClient.todayIndex} history={clientHistory} needs={needBars(clientHistory[0]?.ratings)} />

      <div className="tk-quick">
        {!isVirtualClient(selectedClient) && <button className={btn} onClick={() => setClientTab('ysq')}>Запросить тест на схемы</button>}
        <button className={btn} onClick={handleExport} disabled={exportEmpty}>Экспорт концепта{exportCopied ? ' ✓' : ''}</button>
      </div>
      {exportEmpty && <p className="ds-sub">{CONCEPT_EXPORT_EMPTY}</p>}
    </aside>
  );
}
