import { useState } from 'react';
import { fmtDate, momentDayKey } from '../../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS, getModeById } from '../../../schemaTherapyData';
import { ConfirmDialog } from '../../ConfirmDialog';
import type { ClientDetail } from '../clientSheetTypes';
import { snapshotToConceptFields } from '../../../../../shared/src/therapy/conceptSnapshotRestore';

// История версий концептуализации — содержимое раскрывашки «История версий»
// под вкладкой (ConceptFoldouts; заголовок с числом там). Вынесено из
// ClientConceptTab, правило №10) + «Восстановить»: паритет с мини-аппом
// (ConceptHistoryPanel). Восстановление идёт через patchConcept → обычное
// автосохранение; текущая версия при этом сама попадает в историю на сервере,
// поэтому откат обратим — об этом и текст подтверждения.
export function ConceptVersionHistory({ detail }: { detail: ClientDetail }) {
  const { concept, expandedSnapshot, setExpandedSnapshot, patchConcept } = detail;
  // Индекс версии, ожидающей подтверждения (null — диалога нет).
  const [restoreIdx, setRestoreIdx] = useState<number | null>(null);
  if (!concept?.history || concept.history.length === 0) return null;
  const pending = restoreIdx !== null ? concept.history[restoreIdx] : undefined;

  return (
    <>
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
                  <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" style={{ marginTop: 12 }} onClick={() => setRestoreIdx(i)}>
                    Восстановить эту версию
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {restoreIdx !== null && pending && (
        <ConfirmDialog
          title={`Восстановить версию ${concept.history.length - restoreIdx}?`}
          message="Текущие поля заменятся содержимым этой версии. То, что сейчас, останется в истории — к нему можно вернуться."
          confirmLabel="Восстановить"
          danger={false}
          onConfirm={() => {
            patchConcept(snapshotToConceptFields(pending));
            setRestoreIdx(null);
          }}
          onCancel={() => setRestoreIdx(null)}
        />
      )}
    </>
  );
}
