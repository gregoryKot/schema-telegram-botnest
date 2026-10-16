import { fmtDate, momentDayKey } from '../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS, getModeById } from '../../schemaTherapyData';
import type { ClientDetail } from './clientSheetTypes';
import { ClientConceptFields } from './ClientConceptFields';
import { ClientConceptGraph } from './ClientConceptGraph';
import '../../styles/therapist-concept.css';
import { ConceptViewSwitch, useConceptView } from '../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';

interface Props { detail: ClientDetail; onOpenCanvas?: (mapId: number) => void }

export function ClientConceptTab({ detail, onOpenCanvas }: Props) {
  const {
    saveStatus, exportCopied, handleExport, conceptError,
    concept,
    activeSchemaIds, activeModeIds,
    ysqSchemaIds, expandedSnapshot, setExpandedSnapshot,
  } = detail;
  // Вид выбирается один раз при открытии вкладки (см. useConceptView).
  const [view, setView] = useConceptView(activeModeIds.length);

  return (
    <div className="page-inner-wide u-pt40">
      <div className="ds-head-row tcp-head">
        <div>
          <h2 className="ds-h2">Концептуализация</h2>
          <div className="ds-sub" style={{ marginTop: 4 }}>Схема-карта, цели терапии и связь с детским опытом</div>
        </div>
        <div className="tcp-head-actions">
          <span className="tcp-save">
            {saveStatus === 'saving' ? 'сохраняю…' : saveStatus === 'saved' ? '✓ сохранено' : saveStatus === 'pending' ? 'автосохранение' : ''}
          </span>
          <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={handleExport}>
            ↗ Экспорт{exportCopied ? ' ✓' : ''}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <ConceptViewSwitch view={view} onChange={setView} />
      </div>

      {conceptError && <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--r-8)', background: 'color-mix(in srgb, var(--c-rose) 10%, transparent)', color: 'var(--c-rose)', fontSize: 13 }}>{conceptError}</div>}

      <div className="doc-grid" style={view === 'graph' ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}>
        {view === 'graph' ? (
          <ClientConceptGraph detail={detail} onOpenCanvas={onOpenCanvas} />
        ) : (
          <ClientConceptFields detail={detail} />
        )}

        {/* Right sidebar */}
        <aside>
          {/* YSQ cross-reference */}
          {ysqSchemaIds.length > 0 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
              <div className="eyebrow u-mb14">Сверка с YSQ</div>
              <div className="u-col8">
                {ysqSchemaIds.slice(0, 6).map(id => {
                  const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
                  const inConcept = activeSchemaIds.includes(id);
                  return (
                    <div key={id} className="u-ac8">
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{s?.name ?? id}</span>
                      {!inConcept && <span style={{ fontSize: 11, color: 'var(--c-amber)', fontWeight: 500 }}>+ добавить?</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* History */}
          {concept?.history && concept.history.length > 0 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
              <div className="eyebrow u-mb12">История версий · {concept.history.length}</div>
              <div className="u-col6">
                {concept.history.slice(0, 5).map((h, i: number) => {
                  const vNum = concept.history.length - i;
                  const isOpen = expandedSnapshot === i;
                  const textFields: { label: string; val: string | null }[] = [
                    { label: 'Ранний опыт', val: h.earlyExperience },
                    { label: 'Неудовл. потребности', val: h.unmetNeeds },
                    { label: 'Триггеры', val: h.triggers },
                    { label: 'Копинг-стратегии', val: h.copingStyles },
                    { label: 'Цели', val: h.goals },
                    { label: 'Текущие проблемы', val: h.currentProblems },
                    { label: 'Переходы режимов', val: h.modeTransitions ?? null },
                  ].filter(f => f.val?.trim());
                  return (
                    <div key={i} style={{ borderRadius: 'var(--r-8)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedSnapshot(isOpen ? null : i)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-8)', padding: '9px 12px', background: isOpen ? 'var(--surface-2)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-ghost)', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--text-sub)', flex: 1 }}>Версия {vNum}</span>
                        <span className="u-faint11">{fmtDate(momentDayKey(h.savedAt))}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-ghost)', marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                          {/* Schema chips */}
                          {h.schemaIds.length > 0 && (
                            <div className="u-mb10">
                              <div className="eyebrow u-mb6">Схемы</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                                {h.schemaIds.map((id: string) => {
                                  const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
                                  const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === id));
                                  return (
                                    <span key={id} className="tag-mini">
                                      <span className="swatch" style={{ background: domain?.color ?? 'var(--accent)' }} />
                                      {s?.name ?? id}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* Mode chips */}
                          {h.modeIds.length > 0 && (
                            <div className="u-mb10">
                              <div className="eyebrow u-mb6">Режимы</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                                {h.modeIds.map((id: string) => {
                                  const m = getModeById(id);
                                  const group = MODE_GROUPS.find(g => g.items.some(x => x.id === id));
                                  return (
                                    <span key={id} className="tag-mini">
                                      <span className="swatch" style={{ background: group?.color ?? 'var(--c-plum)' }} />
                                      {m?.name ?? id}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* Text fields */}
                          {textFields.length > 0 && (
                            <div className="u-col8">
                              {textFields.map(f => (
                                <div key={f.label}>
                                  <div className="eyebrow" style={{ marginBottom: 2 }}>{f.label}</div>
                                  <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{f.val}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {h.schemaIds.length === 0 && h.modeIds.length === 0 && textFields.length === 0 && (
                            <div className="u-faint12">Нет данных</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
