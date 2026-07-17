import { useTr } from '../../utils/addressForm';
import { fmtDate } from '../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS, getModeById } from '../../schemaTherapyData';
import { ClientSparkline } from './Sparklines';
import type { useClientDetail } from './useClientDetail';
import { DAY_NAMES, nextSessionLabel, indexColor } from './sheetHelpers';

export function ClientOverviewTab({ detail }: { detail: ReturnType<typeof useClientDetail> }) {
  const tr = useTr();
  const {
    selectedClient, notes, concept, clientHistory, clientDiary,
    localConcept, setClientTab, setShowAssign, exportCopied, handleExport,
    activeSchemaIds, activeModeIds,
    editingStartDate, setEditingStartDate, localStartDate, setLocalStartDate,
    editingNextSession, setEditingNextSession, localNextSession, setLocalNextSession,
    sessionInfoSaving, saveSessionInfo,
  } = detail;
  if (!selectedClient) return null;

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
                  let color = 'var(--text-faint)';
                  let title = '';
                  let typeLabel = '';
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
        <aside>
          {/* Next session */}
          <div className="section">
            <div className="eyebrow" style={{ marginBottom: 14 }}>Следующая сессия</div>
            {editingNextSession ? (
              <div>
                <input
                  type="datetime-local"
                  value={localNextSession}
                  onChange={e => setLocalNextSession(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 13 }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={async () => { await saveSessionInfo({ nextSession: localNextSession || null }); setEditingNextSession(false); }} disabled={sessionInfoSaving} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 12, cursor: 'pointer' }}>
                    {sessionInfoSaving ? '...' : 'Сохранить'}
                  </button>
                  <button onClick={() => setEditingNextSession(false)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 12, cursor: 'pointer' }}>Отмена</button>
                </div>
              </div>
            ) : (
              <div>
                {selectedClient.nextSession ? (
                  <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em' }}>
                    {nextSessionLabel(selectedClient.nextSession)}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Не установлена</div>
                )}
                {selectedClient.meetingDays && selectedClient.meetingDays.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>
                    {selectedClient.meetingDays.map(d => DAY_NAMES[d]).join(', ')} еженедельно
                  </div>
                )}
                <button onClick={() => { setEditingNextSession(true); setLocalNextSession(selectedClient.nextSession ?? ''); }} style={{ background: 'none', border: 'none', padding: '8px 0 0', fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}>
                  Изменить →
                </button>
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />

          {/* Start date */}
          <div className="section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Начало терапии</div>
            {editingStartDate ? (
              <div>
                <input
                  type="date"
                  value={localStartDate}
                  onChange={e => setLocalStartDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 13 }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={async () => { await saveSessionInfo({ therapyStartDate: localStartDate || null }); setEditingStartDate(false); }} disabled={sessionInfoSaving} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 12, cursor: 'pointer' }}>
                    {sessionInfoSaving ? '...' : 'Сохранить'}
                  </button>
                  <button onClick={() => setEditingStartDate(false)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 12, cursor: 'pointer' }}>Отмена</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: 'var(--text)' }}>
                  {selectedClient.therapyStartDate ? fmtDate(selectedClient.therapyStartDate) : <span style={{ color: 'var(--text-faint)' }}>Не указана</span>}
                </span>
                <button onClick={() => { setEditingStartDate(true); setLocalStartDate(selectedClient.therapyStartDate ?? ''); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}>
                  изменить
                </button>
              </div>
            )}
          </div>

          {/* Wellbeing index + sparkline */}
          {selectedClient.todayIndex != null && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
              <div className="section">
                <div className="eyebrow" style={{ marginBottom: 12 }}>Индекс сегодня</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 52, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, color: indexColor(selectedClient.todayIndex) }}>
                    {selectedClient.todayIndex.toFixed(1)}
                  </div>
                  {clientHistory.length >= 7 && (() => {
                    const prev = clientHistory.slice(1, 8).map(d => d.index).filter(v => v != null) as number[];
                    if (!prev.length) return null;
                    const avgPrev = prev.reduce((s, v) => s + v, 0) / prev.length;
                    const diff = selectedClient.todayIndex - avgPrev;
                    return (
                      <span style={{ fontSize: 12, color: diff >= 0 ? 'var(--c-moss)' : 'var(--c-rose)', fontWeight: 500 }}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)} к нед.
                      </span>
                    );
                  })()}
                </div>
                {clientHistory.length >= 3 && (
                  <ClientSparkline
                    values={clientHistory.slice(0, 14).map(d => d.index).reverse()}
                    color={indexColor(selectedClient.todayIndex)}
                  />
                )}
                {clientHistory.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>
                    {clientHistory.length} дн. · {clientHistory.length} оценок
                  </div>
                )}
              </div>
            </>
          )}

          {/* Needs today */}
          {clientHistory.length > 0 && (() => {
            const today = clientHistory[0];
            if (!today || Object.keys(today.ratings).length === 0) return null;
            const NEED_LABELS: Record<string, { label: string; color: string }> = {
              attachment: { label: 'Привязанность', color: 'var(--c-plum)' },
              autonomy:   { label: 'Автономия',     color: 'var(--c-slate)' },
              expression: { label: 'Выражение чувств', color: 'var(--c-rose)' },
              play:       { label: 'Спонтанность',  color: 'var(--c-moss)' },
              limits:     { label: 'Границы',       color: 'var(--c-amber)' },
            };
            return (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
                <div className="section">
                  <div className="eyebrow" style={{ marginBottom: 14 }}>Потребности сегодня</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Object.entries(NEED_LABELS).map(([id, { label, color }]) => {
                      const v = today.ratings[id];
                      if (v == null) return null;
                      return (
                        <div key={id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{label}</div>
                          <div style={{ width: 80, height: 3, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${v * 10}%`, height: '100%', background: color, borderRadius: 2 }} />
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: v <= 4 ? 'var(--c-rose)' : v <= 6 ? 'var(--c-amber)' : color, minWidth: 14, textAlign: 'right' }}>{v}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />

          {/* Quick actions */}
          <div className="section">
            <div className="eyebrow" style={{ marginBottom: 14 }}>Действия</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: '+ Заметка сессии', action: () => setClientTab('sessions') },
                { label: '+ Назначить задание', action: () => setShowAssign(true) },
                { label: '→ Запросить тест', action: () => setClientTab('ysq') },
                { label: `↗ Экспорт концепта${exportCopied ? ' ✓' : ''}`, action: handleExport },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--accent)', cursor: 'pointer' }}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
