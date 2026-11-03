import { useTr } from '../../utils/addressForm';
import type { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { hueStyle } from '../../lib/tone';
import { useIsMobile } from '../useIsMobile';
import { ClientOverviewSidebar } from './ClientOverviewSidebar';
import { ClientQuickActions } from './ClientQuickActions';
import { ToneGroupsCard } from './ClientOverviewGroups';
import { diaryPreview, groupSchemasByDomain, summarizeModes } from './clientOverviewModel';
import type { ClientDetail } from './clientSheetTypes';
import '../../styles/therapist-card.css';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

// «Обзор» карточки клиента (#906, волна 1): каждая секция — ds-card с подписью
// ds-label (заголовок секции = подпись карточки, второго кегля засечного нет),
// цель терапии — обычным текстом, схемы и режимы — строками с точкой тона,
// пустые группы режимов не показываются. На телефоне первой строкой —
// «+ Задание / + Заметка» (ClientQuickActions): закреплённой панели больше нет.
export function ClientOverviewTab({ selectedClient, detail }: Props) {
  const tr = useTr();
  const phone = useIsMobile();
  const { localConcept, concept, activeSchemaIds, activeModeIds, notes, clientDiary, setClientTab } = detail;
  const goals = (localConcept.goals || concept?.goals) as string | undefined;
  const domains = groupSchemasByDomain(activeSchemaIds).map(d => ({ ...d, items: d.schemas }));
  const groups = summarizeModes(activeModeIds).filter(g => g.modes.length > 0).map(g => ({ ...g, items: g.modes }));
  const entries = diaryPreview(clientDiary);
  const isEmpty = !goals && activeSchemaIds.length === 0 && activeModeIds.length === 0 && notes.length === 0 && clientDiary.length === 0;

  return (
    <div className="tk-ov">
      <div className="tk-col">
        {phone && <ClientQuickActions detail={detail} />}

        {goals && (
          <section className="ds-card tk-goal">
            <div className="ds-label">Цель терапии</div>
            <p className="tk-text">{goals}</p>
            <button className="ds-link" onClick={() => setClientTab('concept')}>Открыть концептуализацию →</button>
          </section>
        )}

        {domains.length > 0 && (
          <ToneGroupsCard label="Активные схемы" sub={`${activeSchemaIds.length} в работе`} groups={domains} />
        )}

        {groups.length > 0 && (
          <ToneGroupsCard label="Карта режимов" groups={groups}
            action={<button className="ds-link" onClick={() => setClientTab('mode_map')}>Редактировать →</button>} />
        )}

        {notes.length > 0 && (
          <section className="ds-card">
            <div className="ds-head-row tk-card-head">
              <span className="ds-label">Заметка сессии</span>
              <button className="ds-link" onClick={() => setClientTab('sessions')}>Все заметки →</button>
            </div>
            <div className="tk-note-text">{notes[0].text}</div>
            <div className="ds-sub tk-note-date">{fmtDate(notes[0].date)}</div>
          </section>
        )}

        {entries.length > 0 && (
          <section className="ds-card">
            <div className="ds-head-row tk-card-head">
              <span className="ds-label">Последние записи</span>
              <button className="ds-link" onClick={() => setClientTab('client_notes')}>Все записи →</button>
            </div>
            {entries.map((e, i) => (
              <div key={i} className="ds-list-row tk-entry">
                <span className="ds-chip ds-chip--sm tone-tint" style={hueStyle(e.hue)}>{e.typeLabel}</span>
                <div className="tk-entry-body">
                  <div className="ds-list-title">{e.title}</div>
                  {e.excerpt && <div className="ds-list-sub tk-entry-excerpt">{e.excerpt}</div>}
                </div>
                <span className="ds-sub">{fmtDate(e.date)}</span>
              </div>
            ))}
          </section>
        )}

        {isEmpty && (
          <section className="ds-card">
            <p className="ds-empty">
              {tr('Заполни концептуализацию, чтобы увидеть схемы и режимы клиента', 'Заполните концептуализацию, чтобы увидеть схемы и режимы клиента')}
            </p>
            <div className="tk-start"><button className="ds-btn ds-btn--sm" onClick={() => setClientTab('concept')}>Открыть концептуализацию</button></div>
          </section>
        )}
      </div>

      <ClientOverviewSidebar selectedClient={selectedClient} detail={detail} />
    </div>
  );
}
