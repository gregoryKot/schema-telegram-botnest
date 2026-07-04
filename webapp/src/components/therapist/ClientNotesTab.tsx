import { useState } from 'react';
import { SCHEMA_DOMAINS, MODE_GROUPS, getModeById } from '../../schemaTherapyData';
import { fmtDate } from '../../utils/format';

type DiaryEntry = {
  type: 'schema' | 'mode' | 'gratitude';
  date: string;
  schemaIds?: string[];
  modeId?: string;
  excerpt: string;
};

type SchemaNoteData = {
  schemaId: string;
  triggers: string; feelings: string; thoughts: string;
  origins: string; reality: string; healthyView: string; behavior: string;
};

type ModeNoteData = {
  modeId: string;
  triggers: string; feelings: string; thoughts: string;
  needs: string; behavior: string;
};

interface Props {
  clientSchemaNotesData: SchemaNoteData[];
  clientModeNotesData: ModeNoteData[];
  clientDiary: DiaryEntry[];
}

export function ClientNotesTab({ clientSchemaNotesData, clientModeNotesData, clientDiary }: Props) {
  const [expandedDiary, setExpandedDiary] = useState<number | null>(null);

  const total = clientDiary.length + clientSchemaNotesData.length + clientModeNotesData.length;

  if (total === 0) {
    return (
      <div className="page-inner-wide" style={{ paddingTop: 40 }}>
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
          Клиент ещё не заполнял дневник
        </div>
      </div>
    );
  }

  return (
    <div className="page-inner-wide" style={{ paddingTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Записи клиента</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>{total} записей</div>
        </div>
      </div>

      {/* Diary entries (timestamped events) */}
      {clientDiary.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Дневник событий · {clientDiary.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clientDiary.map((entry, i) => {
              let color = 'var(--text-faint)';
              let title = '';
              let typeLabel = '';
              if (entry.type === 'schema') {
                const firstId = entry.schemaIds?.[0];
                const domain = firstId ? SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === firstId)) : null;
                const schema = firstId ? SCHEMA_DOMAINS.flatMap(d => d.schemas).find(s => s.id === firstId) : null;
                color = domain?.color ?? 'var(--accent)';
                title = schema ? `${schema.emoji} ${schema.name}` : (entry.schemaIds?.join(', ') ?? 'Схема');
                if ((entry.schemaIds?.length ?? 0) > 1) title += ` +${(entry.schemaIds?.length ?? 1) - 1}`;
                typeLabel = 'Схема-дневник';
              } else if (entry.type === 'mode') {
                const mode = getModeById(entry.modeId ?? '');
                const group = mode ? MODE_GROUPS.find(g => g.items.some(m => m.id === entry.modeId)) : null;
                color = group?.color ?? 'var(--accent)';
                title = mode ? `${mode.emoji} ${mode.name}` : (entry.modeId ?? 'Режим');
                typeLabel = 'Режим-дневник';
              } else {
                color = 'var(--c-moss)';
                title = 'Благодарность';
                typeLabel = 'Дневник благодарности';
              }
              const expanded = expandedDiary === i;
              return (
                <div
                  key={i}
                  style={{ borderLeft: `3px solid ${color}`, paddingLeft: 16, paddingBottom: 20, marginBottom: 4, cursor: 'pointer' }}
                  onClick={() => setExpandedDiary(expanded ? null : i)}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 10 }}>{typeLabel}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtDate(entry.date)}</span>
                  </div>
                  {!expanded && entry.excerpt && (
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.excerpt}
                    </div>
                  )}
                  {expanded && entry.excerpt && (
                    <div style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: 8, maxWidth: 720 }}>
                      {entry.excerpt}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Schema notes (static reflection cards) */}
      {clientSchemaNotesData.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Схема-карточки · {clientSchemaNotesData.length}</div>
          {clientSchemaNotesData.map(n => {
            const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === n.schemaId);
            const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === n.schemaId));
            return (
              <div key={n.schemaId} style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 3, height: 16, borderRadius: 2, background: domain?.color ?? 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{s?.emoji} {s?.name ?? n.schemaId}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 28px' }}>
                  {[
                    { label: 'Триггеры', val: n.triggers },
                    { label: 'Чувства', val: n.feelings },
                    { label: 'Мысли', val: n.thoughts },
                    { label: 'Корни', val: n.origins },
                    { label: 'Проверка реальности', val: n.reality },
                    { label: 'Здоровый взгляд', val: n.healthyView },
                    { label: 'Поведение', val: n.behavior },
                  ].filter(f => f.val?.trim()).map(f => (
                    <div key={f.label}>
                      <div className="eyebrow" style={{ marginBottom: 4 }}>{f.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{f.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mode notes (static reflection cards) */}
      {clientModeNotesData.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Режим-карточки · {clientModeNotesData.length}</div>
          {clientModeNotesData.map(n => {
            const m = getModeById(n.modeId);
            const group = MODE_GROUPS.find(g => g.items.some(x => x.id === n.modeId));
            return (
              <div key={n.modeId} style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 3, height: 16, borderRadius: 2, background: group?.color ?? 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{m?.emoji} {m?.name ?? n.modeId}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 28px' }}>
                  {[
                    { label: 'Триггеры', val: n.triggers },
                    { label: 'Чувства', val: n.feelings },
                    { label: 'Мысли', val: n.thoughts },
                    { label: 'Потребности', val: n.needs },
                    { label: 'Поведение', val: n.behavior },
                  ].filter(f => f.val?.trim()).map(f => (
                    <div key={f.label}>
                      <div className="eyebrow" style={{ marginBottom: 4 }}>{f.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{f.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
