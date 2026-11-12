import type { CSSProperties } from 'react';
import type { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { useIsMobile } from '../useIsMobile';
import { ClientOverviewSidebar } from './ClientOverviewSidebar';
import { SignHead } from './SignArt';
import { ClientQuickActions } from './ClientQuickActions';
import { PaperGroups } from './ClientOverviewGroups';
import { OverviewEmpty, OverviewEntries } from './ClientOverviewParts';
import { diaryPreview, groupSchemasByDomain, summarizeModes } from './clientOverviewModel';
import { domainLook, ENTITY_LOOK, modeGroupLook } from '../../../../shared/src/theme/entityLook';
import type { ClientDetail } from './clientSheetTypes';
import '../../styles/therapist-card.css';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

const paper = (h: number) => ({ '--h': h }) as CSSProperties;

// «Обзор» карточки клиента (#906; живая бумага — b30, APP_2026-11.md). Цель терапии — лист соломы («Коротко»
// схемы случая); схемы и режимы — группы на бумаге домена и группы со своим знаком (PaperGroups → SignGroup,
// как у клиента в «Моих паттернах»); заметка сессии и последние записи — белые листы с тенью-слоем
// (OverviewEntries). Пустой «Обзор» — одна сцена (OverviewEmpty). На телефоне первой строкой —
// «+ Задание / + Заметка» (ClientQuickActions): закреплённой панели нет.
export function ClientOverviewTab({ selectedClient, detail }: Props) {
  const phone = useIsMobile();
  const { localConcept, concept, activeSchemaIds, activeModeIds, notes, clientDiary, setClientTab } = detail;
  const goals = (localConcept.goals || concept?.goals) as string | undefined;
  const domains = groupSchemasByDomain(activeSchemaIds).map(d => ({ id: d.id, name: d.name, look: domainLook(d.id) ?? ENTITY_LOOK.schemas, items: d.schemas }));
  const groups = summarizeModes(activeModeIds).filter(g => g.modes.length > 0).map(g => ({ id: g.id, name: g.name, look: modeGroupLook(g.id), items: g.modes }));
  const entries = diaryPreview(clientDiary);
  const isEmpty = !goals && activeSchemaIds.length === 0 && activeModeIds.length === 0 && notes.length === 0 && clientDiary.length === 0;

  return (
    <div className="tk-ov">
      <div className="tk-col">
        {phone && <ClientQuickActions detail={detail} />}

        {goals && (
          <section className="pp-paper tk-goal" style={paper(70)}>
            <SignHead kind="layers" className="ds-label">Цель терапии</SignHead>
            <p className="tk-text">{goals}</p>
            <button className="ds-link" onClick={() => setClientTab('concept')}>Открыть концептуализацию →</button>
          </section>
        )}

        {domains.length > 0 && <PaperGroups label="Активные схемы" sub={`${activeSchemaIds.length} в работе`} groups={domains} />}

        {groups.length > 0 && (
          <PaperGroups label="Карта режимов" groups={groups}
            action={<button className="ds-link" onClick={() => setClientTab('concept')}>Редактировать →</button>} />
        )}

        {notes.length > 0 && (
          <section className="pp-leaf tk-leaf" style={paper(ENTITY_LOOK.note.hue)}>
            <div className="ds-head-row tk-card-head">
              <SignHead kind="pebbles" className="ds-label">Заметка сессии</SignHead>
              <button className="ds-link" onClick={() => setClientTab('sessions')}>Все заметки →</button>
            </div>
            <div className="tk-note-text">{notes[0].text}</div>
            <div className="ds-sub tk-note-date">{fmtDate(notes[0].date)}</div>
          </section>
        )}

        {entries.length > 0 && <OverviewEntries entries={entries} onAll={() => setClientTab('client_notes')} />}

        {isEmpty && <OverviewEmpty onOpen={() => setClientTab('concept')} />}
      </div>

      <ClientOverviewSidebar selectedClient={selectedClient} detail={detail} />
    </div>
  );
}
