import { useTr } from '../../utils/addressForm';
import type { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { hueStyle } from '../../lib/tone';
import { ClientOverviewSidebar } from './ClientOverviewSidebar';
import { diaryPreview, groupSchemasByDomain, summarizeModes } from './clientOverviewModel';
import type { ClientDetail } from './clientSheetTypes';
import '../../styles/therapist-card.css';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

export function ClientOverviewTab({ selectedClient, detail }: Props) {
  const tr = useTr();
  const { localConcept, concept, activeSchemaIds, activeModeIds, notes, clientDiary, setClientTab } = detail;
  const goals = (localConcept.goals || concept?.goals) as string | undefined;
  const domains = groupSchemasByDomain(activeSchemaIds);
  const modeCols = summarizeModes(activeModeIds);
  const entries = diaryPreview(clientDiary);
  const isEmpty = !goals && activeSchemaIds.length === 0 && activeModeIds.length === 0 && notes.length === 0 && clientDiary.length === 0;

  return (
    <div className="tk-ov">
      <div className="tk-col">
        {goals && (
          <div className="ds-card tk-goal">
            <div className="tk-quote" aria-hidden>“</div>
            <div>
              <div className="ds-label">Цель терапии</div>
              <div className="tk-goal-text">{goals}</div>
              <button className="ds-link" onClick={() => setClientTab('concept')}>Открыть концептуализацию →</button>
            </div>
          </div>
        )}

        {domains.length > 0 && (
          <section className="tk-block">
            <div className="ds-head-row" style={{ justifyContent: 'flex-start' }}>
              <h3 className="ds-h2">Активные схемы</h3>
              <span className="ds-sub">{activeSchemaIds.length} в работе</span>
            </div>
            <div className="tk-tiles">
              {domains.map(d => (
                <div key={d.id} className="tk-tile tone-soft tone-ink" style={hueStyle(d.hue)}>
                  <div className="tk-tile-title">{d.name}</div>
                  {d.schemas.map(s => (
                    <div key={s.id} className="tk-tile-item"><span className="ds-dot tone-fill" />{s.name}</div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeModeIds.length > 0 && (
          <section className="tk-block">
            <div className="ds-head-row">
              <h3 className="ds-h2">Карта режимов</h3>
              <button className="ds-link" onClick={() => setClientTab('concept')}>Редактировать →</button>
            </div>
            <div className="tk-modes">
              {modeCols.map(g => (
                <div key={g.id} className="tk-mode-col tone-border" style={hueStyle(g.hue)}>
                  <div className="tk-tile-title tone-ink">{g.name}</div>
                  {g.modes.length === 0 ? <div className="tk-empty">—</div> : g.modes.map(m => <div key={m.id}>{m.name}</div>)}
                </div>
              ))}
            </div>
          </section>
        )}

        {notes.length > 0 && (
          <section className="tk-block tk-block--tight">
            <div className="ds-head-row">
              <h3 className="ds-h2">Заметка сессии</h3>
              <button className="ds-link" onClick={() => setClientTab('sessions')}>Все заметки →</button>
            </div>
            <div className="tk-note-text">{notes[0].text}</div>
            <div className="tk-hint">{fmtDate(notes[0].date)}</div>
          </section>
        )}

        {entries.length > 0 && (
          <section className="tk-block tk-block--tight">
            <div className="ds-head-row">
              <h3 className="ds-h2">Последние записи клиента</h3>
              <button className="ds-link" onClick={() => setClientTab('client_notes')}>Все записи →</button>
            </div>
            {entries.map((e, i) => (
              <div key={i} className="tk-entry">
                <span className="ds-chip ds-chip--sm tone-tint" style={hueStyle(e.hue)}>{e.typeLabel}</span>
                <div className="tk-entry-body">
                  <div className="tk-entry-title">{e.title}</div>
                  {e.excerpt && <div className="tk-entry-excerpt">{e.excerpt}</div>}
                </div>
                <span className="tk-entry-date">{fmtDate(e.date)}</span>
              </div>
            ))}
          </section>
        )}

        {isEmpty && (
          <div className="tk-block tk-block--tight">
            <div className="tk-hint">
              {tr('Заполни концептуализацию, чтобы увидеть схемы и режимы клиента', 'Заполните концептуализацию, чтобы увидеть схемы и режимы клиента')}
            </div>
            <div><button className="ds-btn ds-btn--sm" onClick={() => setClientTab('concept')}>Открыть концептуализацию</button></div>
          </div>
        )}
      </div>

      <ClientOverviewSidebar selectedClient={selectedClient} detail={detail} />
    </div>
  );
}
