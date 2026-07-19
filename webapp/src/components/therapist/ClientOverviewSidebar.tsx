import type { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { ClientSparkline } from './Sparklines';
import { DAY_NAMES, indexColor, nextSessionLabel } from './clientSheetHelpers';
import type { ClientDetail } from './clientSheetTypes';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

export function ClientOverviewSidebar({ selectedClient, detail }: Props) {
  const {
    clientHistory, setClientTab, setShowAssign,
    editingNextSession, setEditingNextSession, localNextSession, setLocalNextSession,
    editingStartDate, setEditingStartDate, localStartDate, setLocalStartDate,
    saveSessionInfo, sessionInfoSaving, exportCopied, handleExport,
  } = detail;

  return (
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
  );
}
