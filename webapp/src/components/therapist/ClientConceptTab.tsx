import type { ClientConceptualization } from '../../api';
import { fmtDate } from '../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS, getModeById } from '../../schemaTherapyData';
import type { useClientDetail } from './useClientDetail';
import { CONCEPT_FIELDS } from './sheetHelpers';

export function ClientConceptTab({ detail }: { detail: ReturnType<typeof useClientDetail> }) {
  const {
    concept, localConcept, patchConcept, conceptError, saveStatus,
    exportCopied, handleExport, activeSchemaIds, toggleSchemaId,
    activeModeIds, toggleModeId, ysqSchemaIds, expandedSnapshot, setExpandedSnapshot,
  } = detail;

  return (
    <div className="page-inner-wide" style={{ paddingTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Концептуализация</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>Схема-карта, цели терапии и связь с детским опытом</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)', minWidth: 120, textAlign: 'right' }}>
            {saveStatus === 'saving' ? 'сохраняю…' : saveStatus === 'saved' ? '✓ сохранено' : saveStatus === 'pending' ? 'автосохранение' : ''}
          </span>
          <button onClick={handleExport} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>
            ↗ Экспорт{exportCopied ? ' ✓' : ''}
          </button>
        </div>
      </div>

      {conceptError && <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: 'color-mix(in srgb, var(--c-rose) 10%, transparent)', color: 'var(--c-rose)', fontSize: 13 }}>{conceptError}</div>}

      <div className="doc-grid">
        <div>
          {/* Goals */}
          <div className="section">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Цели схема-терапии</div>
            <textarea
              className="textarea"
              value={(localConcept.goals as string) ?? ''}
              onChange={e => patchConcept({ goals: e.target.value })}
              placeholder="Что должно измениться. Конкретные результаты, на которые направлена работа."
              rows={3}
              style={{ fontSize: 15, lineHeight: 1.6, borderColor: 'var(--accent-line)' }}
            />
          </div>

          {/* Schema selection */}
          <div className="section">
            <div className="section-head" style={{ marginBottom: 20 }}>
              <h3>Актуальные схемы</h3>
              <span className="hint">{activeSchemaIds.length} активны из 20</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {SCHEMA_DOMAINS.map(domain => (
                <div key={domain.id}>
                  <div className="eyebrow" style={{ color: domain.color, marginBottom: 10 }}>{domain.domain}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {domain.schemas.map(s => {
                      const active = activeSchemaIds.includes(s.id);
                      return (
                        <button key={s.id} onClick={() => toggleSchemaId(s.id)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: active ? 600 : 400, background: active ? domain.color : 'var(--surface-2)', color: active ? 'var(--on-accent)' : 'var(--text-faint)', border: `1px solid ${active ? domain.color : 'var(--line)'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mode selection */}
          <div className="section">
            <div className="section-head" style={{ marginBottom: 20 }}>
              <h3>Карта режимов</h3>
              <span className="hint">{activeModeIds.length} в работе</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {MODE_GROUPS.map(group => (
                <div key={group.id}>
                  <div className="eyebrow" style={{ color: group.color, marginBottom: 10 }}>{group.group}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {group.items.map(m => {
                      const active = activeModeIds.includes(m.id);
                      return (
                        <button key={m.id} onClick={() => toggleModeId(m.id)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: active ? 600 : 400, background: active ? group.color : 'var(--surface-2)', color: active ? 'var(--on-accent)' : 'var(--text-faint)', border: `1px solid ${active ? group.color : 'var(--line)'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Text fields */}
          {CONCEPT_FIELDS.map(field => (
            <div key={String(field.key)} className="section">
              <div className="eyebrow" style={{ marginBottom: 12 }}>{field.label}</div>
              <textarea
                className="textarea"
                value={(localConcept[field.key as keyof ClientConceptualization] as string) ?? ''}
                onChange={e => patchConcept({ [field.key]: e.target.value })}
                placeholder={field.placeholder}
                rows={4}
              />
            </div>
          ))}
        </div>

        {/* Right sidebar */}
        <aside>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Что заполнено</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              ['Цели терапии', !!(localConcept.goals || concept?.goals)],
              ['Ранний опыт', !!(localConcept.earlyExperience || concept?.earlyExperience)],
              ['Неудовл. потребности', !!(localConcept.unmetNeeds || concept?.unmetNeeds)],
              ['Триггеры', !!(localConcept.triggers || concept?.triggers)],
              ['Копинги', !!(localConcept.copingStyles || concept?.copingStyles)],
              ['Переходы режимов', !!(localConcept.modeTransitions || concept?.modeTransitions)],
              ['Актуальные проблемы', !!(localConcept.currentProblems || concept?.currentProblems)],
            ] as [string, boolean][]).map(([label, has]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: has ? 'var(--accent)' : 'var(--text-ghost)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: has ? 'var(--text)' : 'var(--text-faint)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* YSQ cross-reference */}
          {ysqSchemaIds.length > 0 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
              <div className="eyebrow" style={{ marginBottom: 14 }}>Сверка с YSQ</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ysqSchemaIds.slice(0, 6).map(id => {
                  const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
                  const inConcept = activeSchemaIds.includes(id);
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <div className="eyebrow" style={{ marginBottom: 12 }}>История версий · {concept.history.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {concept.history.slice(0, 5).map((h: any, i: number) => {
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
                    <div key={i} style={{ borderRadius: 8, border: '1px solid var(--line)', overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedSnapshot(isOpen ? null : i)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: isOpen ? 'var(--surface-2)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-ghost)', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--text-sub)', flex: 1 }}>Версия {vNum}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{fmtDate(h.savedAt.slice(0, 10))}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-ghost)', marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                          {/* Schema chips */}
                          {h.schemaIds.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div className="eyebrow" style={{ marginBottom: 6 }}>Схемы</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
                            <div style={{ marginBottom: 10 }}>
                              <div className="eyebrow" style={{ marginBottom: 6 }}>Режимы</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {textFields.map(f => (
                                <div key={f.label}>
                                  <div className="eyebrow" style={{ marginBottom: 2 }}>{f.label}</div>
                                  <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{f.val}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {h.schemaIds.length === 0 && h.modeIds.length === 0 && textFields.length === 0 && (
                            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Нет данных</div>
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
