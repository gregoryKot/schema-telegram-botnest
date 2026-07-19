import { useTr } from '../../utils/addressForm';
import type { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS, getModeById } from '../../schemaTherapyData';
import { ClientOverviewSidebar } from './ClientOverviewSidebar';
import type { ClientDetail } from './clientSheetTypes';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

export function ClientOverviewTab({ selectedClient, detail }: Props) {
  const tr = useTr();
  const {
    localConcept, concept, activeSchemaIds, activeModeIds, notes, clientDiary,
    setClientTab,
  } = detail;

  return (
    <div className="page-inner-wide" style={{ paddingTop: 40 }}>
      <div className="doc-grid">
        <div>
          {/* Therapy goals – shown as a quiet quote */}
          {(localConcept.goals || concept?.goals) && (
            <div className="section">
              <div className="eyebrow" style={{ marginBottom: 14 }}>Цель терапии</div>
              <div style={{ fontSize: 22, lineHeight: 1.45, color: 'var(--text)', letterSpacing: '-0.02em', maxWidth: 720, fontWeight: 400 }}>
                {(localConcept.goals || concept?.goals) as string}
              </div>
              <button className="link" style={{ marginTop: 16, fontSize: 13, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setClientTab('concept')}>
                Открыть концептуализацию →
              </button>
            </div>
          )}

          {/* Active schemas by domain */}
          {activeSchemaIds.length > 0 && (
            <div className="section">
              <div className="section-head" style={{ marginBottom: 20 }}>
                <h3>Активные схемы</h3>
                <span className="hint">{activeSchemaIds.length} в работе</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {SCHEMA_DOMAINS.map(domain => {
                  const active = domain.schemas.filter(s => activeSchemaIds.includes(s.id));
                  if (active.length === 0) return null;
                  return (
                    <div key={domain.id}>
                      <div className="eyebrow" style={{ color: domain.color, marginBottom: 8 }}>{domain.domain}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 24, rowGap: 6 }}>
                        {active.map(s => (
                          <div key={s.id} className="tag-mini">
                            <span className="swatch" style={{ background: domain.color }} />
                            {s.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode map */}
          {activeModeIds.length > 0 && (
            <div className="section">
              <div className="section-head" style={{ marginBottom: 20 }}>
                <h3>Карта режимов</h3>
                <span className="hint">{activeModeIds.length} в работе</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
                {MODE_GROUPS.map(group => {
                  const active = group.items.filter(m => activeModeIds.includes(m.id));
                  return (
                    <div key={group.id}>
                      <div className="eyebrow" style={{ color: group.color, marginBottom: 10 }}>{group.group}</div>
                      {active.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>–</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {active.map(m => (
                            <div key={m.id} style={{ fontSize: 13, color: 'var(--text)' }}>{m.name}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Last session note */}
          {notes.length > 0 && (
            <div className="section">
              <div className="section-head" style={{ marginBottom: 16 }}>
                <h3>Заметка сессии</h3>
                <button className="link" style={{ fontSize: 13, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setClientTab('sessions')}>Все заметки →</button>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-sub)', maxWidth: 720 }}>{notes[0].text}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>{fmtDate(notes[0].date)}</div>
            </div>
          )}

          {/* Client diary entries preview */}
          {clientDiary.length > 0 && (
            <div className="section">
              <div className="section-head" style={{ marginBottom: 16 }}>
                <h3>Последние записи клиента</h3>
                <button className="link" style={{ fontSize: 13, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setClientTab('client_notes')}>Все записи →</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clientDiary.slice(0, 5).map((entry, i) => {
                  let color: string;
                  let title: string;
                  let typeLabel: string;
                  if (entry.type === 'schema') {
                    const firstId = entry.schemaIds?.[0];
                    const domain = firstId ? SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === firstId)) : null;
                    const schema = firstId ? SCHEMA_DOMAINS.flatMap(d => d.schemas).find(s => s.id === firstId) : null;
                    color = domain?.color ?? 'var(--accent)';
                    title = schema ? `${schema.emoji} ${schema.name}` : (entry.schemaIds?.join(', ') ?? 'Схема');
                    const extra = (entry.schemaIds?.length ?? 0) > 1 ? ` +${(entry.schemaIds?.length ?? 1) - 1}` : '';
                    title += extra;
                    typeLabel = 'Схема-дневник';
                  } else if (entry.type === 'mode') {
                    const mode = getModeById(entry.modeId ?? '');
                    const group = mode ? MODE_GROUPS.find(g => g.items.some(m => m.id === entry.modeId)) : null;
                    color = group?.color ?? 'var(--c-plum)';
                    title = mode ? `${mode.emoji} ${mode.name}` : (entry.modeId ?? 'Режим');
                    typeLabel = 'Режим-дневник';
                  } else {
                    color = 'var(--c-moss)';
                    title = 'Благодарность';
                    typeLabel = 'Дневник благодарности';
                  }
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', borderLeft: `3px solid ${color}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{typeLabel}</span>
                        </div>
                        {entry.excerpt && (
                          <div style={{ fontSize: 12, color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                            {entry.excerpt}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtDate(entry.date)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {activeSchemaIds.length === 0 && activeModeIds.length === 0 && notes.length === 0 && clientDiary.length === 0 && (
            <div className="section">
              <div style={{ padding: '32px 0', color: 'var(--text-faint)', fontSize: 14 }}>
                {tr('Заполни концептуализацию, чтобы увидеть схемы и режимы клиента', 'Заполните концептуализацию, чтобы увидеть схемы и режимы клиента')}
              </div>
              <button onClick={() => setClientTab('concept')} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Открыть концептуализацию
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <ClientOverviewSidebar selectedClient={selectedClient} detail={detail} />
      </div>
    </div>
  );
}
