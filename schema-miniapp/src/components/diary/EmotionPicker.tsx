import { EMOTIONS, INTENSITY_LABELS } from '../../schemaTherapyData';
import { EmotionEntry } from '../../types';

// Выбор чувств в дневнике схем: сетка эмоций + интенсивность выбранных.
// Вынесено из SchemaEntrySheet.tsx (правило №10).
export function EmotionPicker({
  emotions,
  onToggle,
  onSetIntensity,
  color,
}: {
  emotions: EmotionEntry[];
  onToggle: (id: string) => void;
  onSetIntensity: (id: string, intensity: number) => void;
  color: string;
}) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 7,
          marginBottom: 10,
        }}
      >
        {EMOTIONS.map((em) => {
          const sel = emotions.find((e) => e.id === em.id);
          return (
            <button
              key={em.id}
              onClick={() => onToggle(em.id)}
              className="sel-btn"
              style={{
                background: sel ? 'var(--accent-bg)' : 'var(--surface)',
                border: sel
                  ? '1px solid var(--accent)'
                  : '1px solid rgba(34,30,27,0.1)',
                borderRadius: 999,
                padding: '10px 14px',
                minHeight: 44,
                color: sel ? 'var(--accent)' : 'var(--ink-2)',
                fontSize: 13,
                fontWeight: sel ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {em.label}
            </button>
          );
        })}
      </div>
      {emotions.map((em) => {
        const meta = EMOTIONS.find((e) => e.id === em.id)!;
        return (
          <div
            key={em.id}
            style={{
              marginBottom: 10,
              background: 'var(--surface-2)',
              borderRadius: 'var(--r-14)',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 10,
              }}
            >
              {meta.label}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {INTENSITY_LABELS.map((lbl, i) => (
                <button
                  key={i}
                  onClick={() => onSetIntensity(em.id, i + 1)}
                  className="sel-btn"
                  style={{
                    flex: 1,
                    background:
                      em.intensity === i + 1 ? color : 'var(--surface)',
                    border: '1px solid rgba(34,30,27,0.1)',
                    borderRadius: 'var(--r-10)',
                    padding: '10px 2px',
                    minHeight: 44,
                    color: em.intensity === i + 1 ? '#fff' : 'var(--muted)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
